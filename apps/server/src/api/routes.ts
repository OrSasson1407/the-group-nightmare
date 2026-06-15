import { Router } from 'express';
import { getOrCreateRoom } from '../gateway/room_manager.js';
import { fetchRoomState } from '../db/rooms.js';

export const apiRouter = Router();

// Endpoint to fetch the initial room state before WebSockets connect
apiRouter.get('/rooms/:roomId', async (req, res) => {
  const { roomId } = req.params;
  
  try {
    // Check fast in-memory cache first
    let room = getOrCreateRoom(roomId);
    
    // If room is empty, try to hydrate from Supabase
    if (room.participants.length === 0) {
      const dbRoom = await fetchRoomState(roomId);
      if (dbRoom) {
         room = dbRoom;
         // Note: in a real app you'd inject this back into room_manager
      }
    }
    
    res.status(200).json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch room' });
  }
});
