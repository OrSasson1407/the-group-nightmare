import type { PlanningRoomSession, AvailabilityDelta, BudgetDelta, Participant } from '@tgn/shared';
import { persistRoomState } from '../db/rooms.js';

const activeRooms = new Map<string, PlanningRoomSession>();

export function getOrCreateRoom(roomId: string): PlanningRoomSession {
  if (!activeRooms.has(roomId)) {
    activeRooms.set(roomId, {
      roomId,
      createdAt: new Date().toISOString(),
      participants: [],
      constraintsMatrix: {},
      latestSolverResult: null,
      isSolving: false
    });
  }
  return activeRooms.get(roomId)!;
}

export function addParticipantToRoom(roomId: string, participant: Participant): PlanningRoomSession {
  const room = getOrCreateRoom(roomId);
  
  if (!room.participants.find(p => p.id === participant.id)) {
    room.participants.push(participant);
    // הוספת המשתמש בצורה בטוחה
    room.constraintsMatrix[participant.id] = {
      participantId: participant.id,
      encryptedMaxBudget: '',
      availabilityGrid: []
    };
    persistRoomState(room);
  }
  return room;
}

export function applyAvailabilityDelta(roomId: string, delta: AvailabilityDelta): PlanningRoomSession {
  const room = getOrCreateRoom(roomId);
  
  // גישה בטוחה למשתמש
  const userConstraints = room.constraintsMatrix[delta.participantId];
  
  if (userConstraints !== undefined) {
    const existingDateIndex = userConstraints.availabilityGrid.findIndex(d => d.dateString === delta.dateString);
    if (existingDateIndex >= 0) {
userConstraints.availabilityGrid[existingDateIndex]!.isAvailable = delta.isAvailable;
    } else {
      userConstraints.availabilityGrid.push({ dateString: delta.dateString, isAvailable: delta.isAvailable });
    }
    persistRoomState(room);
  }
  return room;
}

export function applyBudgetDelta(roomId: string, delta: BudgetDelta): PlanningRoomSession {
  const room = getOrCreateRoom(roomId);
  
  // שימוש בגישה זהה כדי לספק את ה-Compiler
  const userConstraints = room.constraintsMatrix[delta.participantId];
  
  if (userConstraints !== undefined) {
    userConstraints.encryptedMaxBudget = delta.encryptedMaxBudget;
    persistRoomState(room);
  }
  return room;
}