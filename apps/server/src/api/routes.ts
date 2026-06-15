import { Router } from 'express';
import { randomBytes } from 'crypto';
import { findRoom, getOrCreateRoom, hydrateRoom, toPublicView } from '../gateway/room_manager.js';
import { fetchRoomState, persistRoomState } from '../db/rooms.js';

export const apiRouter = Router();

// POST /api/rooms - Create a new planning room with a cryptographically secure ID
apiRouter.post('/rooms', async (req, res) => {
  const roomId = randomBytes(16).toString('hex');
  const room = getOrCreateRoom(roomId);
  await persistRoomState(room);
  res.status(201).json({ success: true, data: { roomId, shareUrl: `/room/${roomId}` } });
});

// GET /api/rooms/:roomId - memory-first, then DB with proper hydration. 404 if not found anywhere.
apiRouter.get('/rooms/:roomId', async (req, res) => {
  const { roomId } = req.params;

  // Fix: validate format before any lookup (prevents phantom room creation)
  if (!roomId || !/^[a-f0-9]{32}$/.test(roomId)) {
    return res.status(400).json({ success: false, error: 'Invalid roomId format' });
  }

  try {
    // Try memory first (fast path)
    let room = findRoom(roomId);

    if (!room) {
      // Try Supabase and hydrate back into memory
      const dbRoom = await fetchRoomState(roomId);
      if (!dbRoom) {
        return res.status(404).json({ success: false, error: 'Room not found' });
      }
      hydrateRoom(dbRoom);
      room = dbRoom;
    }

    // Fix: return PublicRoomView - never expose constraintsMatrix via REST
    res.status(200).json({ success: true, data: toPublicView(room) });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch room' });
  }
});
