import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import { WS_EVENTS } from '@tgn/shared';
import { executeEngineOptimization } from '../engine/csp_solver_worker.js';
import {
  addParticipantToRoom,
  removeParticipantFromRoom,
  applyAvailabilityDelta,
  applyBudgetDelta,
  getOrCreateRoom,
  setSolving,
  toPublicView
} from './room_manager.js';

// Track socketId -> { roomId, participantId } for disconnect resolution
const socketRegistry = new Map<string, { roomId: string; participantId: string }>();

// Rate limit: track last solve trigger per room to prevent spam
const lastSolveTrigger = new Map<string, number>();
const SOLVE_RATE_LIMIT_MS = 5000;

function sanitize(str: unknown): string {
  return String(str ?? '').replace(/[\r\n\t]/g, ' ').slice(0, 100);
}

export function setupSocketGateway(httpServer: Server, clientOrigin: string) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: clientOrigin, methods: ['GET', 'POST'], credentials: true }
  });

  io.on('connection', (socket) => {
    console.log('[Socket] Client connected:', socket.id);

    socket.on(WS_EVENTS.JOIN_ROOM, (data) => {
      const roomId = sanitize(data?.roomId);
      const participantId = sanitize(data?.participantId);
      const displayName = sanitize(data?.displayName);
      if (!roomId || !participantId || !displayName) return;

      socket.join(roomId);
      socketRegistry.set(socket.id, { roomId, participantId });

      const participant = {
        id: participantId,
        displayName,
        isOnline: true,
        joinedAt: new Date().toISOString(),
        cursorColor: '#4f46e5'
      };

      const updatedRoom = addParticipantToRoom(roomId, participant);
      // Fix: broadcast PublicRoomView - never leaks constraintsMatrix/budget to other clients
      console.log(`[Socket] ${sanitize(displayName)} joined room ${roomId}. Size: ${updatedRoom.participants.length}`);
      io.to(roomId).emit(WS_EVENTS.ROOM_STATE, toPublicView(updatedRoom));
    });

    socket.on(WS_EVENTS.AVAILABILITY_CHANGE, (data) => {
      const roomId = sanitize(data?.roomId);
      const participantId = sanitize(data?.participantId);
      if (!roomId || !participantId || !data?.dateString) return;
      applyAvailabilityDelta(roomId, { ...data, roomId, participantId });
      socket.to(roomId).emit(WS_EVENTS.DELTA_BROADCAST, { ...data, roomId, participantId });
    });

    socket.on(WS_EVENTS.BUDGET_CHANGE, (data) => {
      const roomId = sanitize(data?.roomId);
      const participantId = sanitize(data?.participantId);
      if (!roomId || !participantId) return;
      applyBudgetDelta(roomId, { ...data, roomId, participantId });
      // Fix: do NOT broadcast budget delta to other clients - private data
    });

    socket.on(WS_EVENTS.TRIGGER_SOLVE, async (data) => {
      const roomId = sanitize(data?.roomId);
      if (!roomId) return;

      const liveRoomData = getOrCreateRoom(roomId);

      // isSolving guard: reject duplicate solve triggers
      if (liveRoomData.isSolving) {
        console.warn(`[Engine] Room ${roomId} already solving, ignoring duplicate.`);
        return;
      }

      // Rate limit: prevent rapid-fire triggers
      const now = Date.now();
      const lastTrigger = lastSolveTrigger.get(roomId) ?? 0;
      if (now - lastTrigger < SOLVE_RATE_LIMIT_MS) {
        console.warn(`[Engine] Room ${roomId} solve rate-limited.`);
        return;
      }
      lastSolveTrigger.set(roomId, now);

      setSolving(roomId, true);
      io.to(roomId).emit(WS_EVENTS.SOLVE_STARTED);

      try {
        console.log(`[Engine] Spinning up worker for Room ${roomId}...`);
        const result = await executeEngineOptimization(liveRoomData);
        liveRoomData.latestSolverResult = result;
        io.to(roomId).emit(WS_EVENTS.SOLVE_RESULT, result);
      } catch (error) {
        console.error('[Engine] Critical Solver Error:', error);
        // Fix: emit SOLVE_ERROR so client isn't left hanging after SOLVE_STARTED
        io.to(roomId).emit(WS_EVENTS.SOLVE_ERROR, { roomId, message: 'Solver encountered an internal error.' });
      } finally {
        setSolving(roomId, false);
      }
    });

    socket.on('disconnect', () => {
      const reg = socketRegistry.get(socket.id);
      if (reg) {
        const { roomId, participantId } = reg;
        const updatedRoom = removeParticipantFromRoom(roomId, participantId);
        if (updatedRoom) {
          // Fix: emit PARTICIPANT_LEAVE event (was defined in WS_EVENTS but never fired)
          io.to(roomId).emit(WS_EVENTS.PARTICIPANT_LEAVE, { participantId });
          io.to(roomId).emit(WS_EVENTS.ROOM_STATE, toPublicView(updatedRoom));
        }
        socketRegistry.delete(socket.id);
        console.log(`[Socket] ${participantId} disconnected from room ${roomId}`);
      }
    });
  });

  return io;
}
