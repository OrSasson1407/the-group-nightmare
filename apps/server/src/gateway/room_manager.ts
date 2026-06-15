import type { PlanningRoomSession, AvailabilityDelta, BudgetDelta, Participant, PublicRoomView } from '@tgn/shared';
import { isValidDateString } from '../engine/heuristics.js';
import { persistRoomState } from '../db/rooms.js';

const ROOM_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

interface RoomEntry {
  session: PlanningRoomSession;
  lastAccessedAt: number;
  persistTimer: ReturnType<typeof setTimeout> | null;
}

const activeRooms = new Map<string, RoomEntry>();

// Periodic cleanup of expired rooms every 30 min
setInterval(() => {
  const now = Date.now();
  for (const [roomId, entry] of activeRooms.entries()) {
    if (now - entry.lastAccessedAt > ROOM_TTL_MS) {
      if (entry.persistTimer) clearTimeout(entry.persistTimer);
      activeRooms.delete(roomId);
      console.log(`[RoomManager] Evicted stale room: ${roomId}`);
    }
  }
}, 1000 * 60 * 30).unref();

// Debounced persist: waits 500ms after last write before hitting Supabase
function schedulePersist(entry: RoomEntry) {
  if (entry.persistTimer) clearTimeout(entry.persistTimer);
  entry.persistTimer = setTimeout(() => {
    entry.persistTimer = null;
    persistRoomState(entry.session);
  }, 500);
}

// Strip internal state before broadcasting to clients
export function toPublicView(room: PlanningRoomSession): PublicRoomView {
  return {
    roomId: room.roomId,
    createdAt: room.createdAt,
    participants: room.participants,
    latestSolverResult: room.latestSolverResult
  };
}

// Returns null if room does not exist - use this for GET /rooms/:id
export function findRoom(roomId: string): PlanningRoomSession | null {
  const entry = activeRooms.get(roomId);
  if (!entry) return null;
  entry.lastAccessedAt = Date.now();
  return entry.session;
}

// Creates room if not exists - use only for JOIN flow
export function getOrCreateRoom(roomId: string): PlanningRoomSession {
  if (!activeRooms.has(roomId)) {
    const session: PlanningRoomSession = {
      roomId,
      createdAt: new Date().toISOString(),
      participants: [],
      constraintsMatrix: {},
      latestSolverResult: null,
      isSolving: false
    };
    activeRooms.set(roomId, { session, lastAccessedAt: Date.now(), persistTimer: null });
  } else {
    activeRooms.get(roomId)!.lastAccessedAt = Date.now();
  }
  return activeRooms.get(roomId)!.session;
}

// Inject a room fetched from DB back into the in-memory map
export function hydrateRoom(session: PlanningRoomSession): void {
  if (!activeRooms.has(session.roomId)) {
    activeRooms.set(session.roomId, { session, lastAccessedAt: Date.now(), persistTimer: null });
  }
}

export function setSolving(roomId: string, value: boolean): void {
  const entry = activeRooms.get(roomId);
  if (entry) entry.session.isSolving = value;
}

export function addParticipantToRoom(roomId: string, participant: Participant): PlanningRoomSession {
  const room = getOrCreateRoom(roomId);
  if (!room.participants.find(p => p.id === participant.id)) {
    room.participants.push(participant);
    room.constraintsMatrix[participant.id] = {
      participantId: participant.id,
      encryptedMaxBudget: '',
      availabilityGrid: []
    };
    schedulePersist(activeRooms.get(roomId)!);
  }
  return room;
}

export function removeParticipantFromRoom(roomId: string, participantId: string): PlanningRoomSession | null {
  const entry = activeRooms.get(roomId);
  if (!entry) return null;
  entry.session.participants = entry.session.participants.map(p =>
    p.id === participantId ? { ...p, isOnline: false } : p
  );
  schedulePersist(entry);
  return entry.session;
}

export function applyAvailabilityDelta(roomId: string, delta: AvailabilityDelta): PlanningRoomSession | null {
  const entry = activeRooms.get(roomId);
  if (!entry) return null;

  // Fix: validate dateString format before writing
  if (!isValidDateString(delta.dateString)) {
    console.warn(`[RoomManager] Invalid dateString rejected: "${delta.dateString}"`);
    return entry.session;
  }

  const userConstraints = entry.session.constraintsMatrix[delta.participantId];
  if (userConstraints) {
    const idx = userConstraints.availabilityGrid.findIndex(d => d.dateString === delta.dateString);
    if (idx >= 0) {
      userConstraints.availabilityGrid[idx]!.isAvailable = delta.isAvailable;
    } else {
      userConstraints.availabilityGrid.push({ dateString: delta.dateString, isAvailable: delta.isAvailable });
    }
    schedulePersist(entry);
  }
  return entry.session;
}

export function applyBudgetDelta(roomId: string, delta: BudgetDelta): PlanningRoomSession | null {
  const entry = activeRooms.get(roomId);
  if (!entry) return null;

  const userConstraints = entry.session.constraintsMatrix[delta.participantId];
  if (userConstraints) {
    userConstraints.encryptedMaxBudget = delta.encryptedMaxBudget;
    schedulePersist(entry);
  }
  return entry.session;
}
