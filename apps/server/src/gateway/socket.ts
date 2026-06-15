import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import { WS_EVENTS } from '@tgn/shared';
import { executeEngineOptimization } from '../engine/csp_solver_worker.js';
import { 
  addParticipantToRoom, 
  applyAvailabilityDelta, 
  applyBudgetDelta, 
  getOrCreateRoom 
} from './room_manager.js';

export function setupSocketGateway(httpServer: Server, clientOrigin: string) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: clientOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('[Socket] Client connected:', socket.id);

    socket.on(WS_EVENTS.JOIN_ROOM, (data) => {
      socket.join(data.roomId);
      
      const participant = {
        id: data.participantId,
        displayName: data.displayName,
        isOnline: true,
        joinedAt: new Date().toISOString(),
        cursorColor: '#4f46e5'
      };

      const updatedRoom = addParticipantToRoom(data.roomId, participant);
      console.log(`[Socket] User ${data.displayName} joined. Room size: ${updatedRoom.participants.length}`);
      
      io.to(data.roomId).emit(WS_EVENTS.ROOM_STATE, updatedRoom);
    });

    socket.on(WS_EVENTS.AVAILABILITY_CHANGE, (data) => {
      applyAvailabilityDelta(data.roomId, data);
      socket.to(data.roomId).emit(WS_EVENTS.DELTA_BROADCAST, data);
    });

    socket.on(WS_EVENTS.BUDGET_CHANGE, (data) => {
      applyBudgetDelta(data.roomId, data);
      socket.to(data.roomId).emit(WS_EVENTS.DELTA_BROADCAST, data);
    });

    socket.on(WS_EVENTS.TRIGGER_SOLVE, async (data) => {
      io.to(data.roomId).emit(WS_EVENTS.SOLVE_STARTED);
      try {
        const liveRoomData = getOrCreateRoom(data.roomId);
        console.log(`[Engine] Spinning up workers for Room ${data.roomId}...`);
        const result = await executeEngineOptimization(liveRoomData);
        liveRoomData.latestSolverResult = result;
        io.to(data.roomId).emit(WS_EVENTS.SOLVE_RESULT, result);
      } catch (error) {
        console.error('[Engine] Critical Solver Error:', error);
      }
    });
  });

  return io;
}