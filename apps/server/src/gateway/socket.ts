import { Server as SocketIOServer } from 'socket.io';
import { Server } from 'http';
import { WS_EVENTS } from '@tgn/shared';
// We will create the engine file in Step 5
import { executeEngineOptimization } from '../engine/csp_solver_worker.js';

export function setupSocketGateway(httpServer: Server, clientOrigin: string) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: clientOrigin,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log([Socket] Client connected:  + socket.id);

    // 1. Join Planning Room
    socket.on(WS_EVENTS.JOIN_ROOM, (data) => {
      socket.join(data.roomId);
      console.log([Socket] User \ joined room \);
      
      socket.to(data.roomId).emit(WS_EVENTS.PARTICIPANT_JOIN, {
         id: data.participantId,
         displayName: data.displayName,
         isOnline: true,
         joinedAt: new Date().toISOString()
      });
    });

    // 2. Stream Availability Deltas (Zero Friction Live Sync)
    socket.on(WS_EVENTS.AVAILABILITY_CHANGE, (data) => {
      socket.to(data.roomId).emit(WS_EVENTS.DELTA_BROADCAST, data);
    });

    // 3. Stream Budget Deltas (E2E Encrypted Payload)
    socket.on(WS_EVENTS.BUDGET_CHANGE, (data) => {
      socket.to(data.roomId).emit(WS_EVENTS.DELTA_BROADCAST, data);
    });

    // 4. Trigger The Brain (28-Second Engine)
    socket.on(WS_EVENTS.TRIGGER_SOLVE, async (data) => {
      io.to(data.roomId).emit(WS_EVENTS.SOLVE_STARTED);
      try {
        console.log([Engine] Spinning up worker threads for Room \...);
        const result = await executeEngineOptimization(data.sessionData);
        io.to(data.roomId).emit(WS_EVENTS.SOLVE_RESULT, result);
        console.log([Engine] Computation finalized and broadcasted.);
      } catch (error) {
        console.error('[Engine] Critical Solver Error:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log([Socket] Client disconnected:  + socket.id);
    });
  });

  return io;
}
