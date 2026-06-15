import type { IndividualConstraints, SolverOutput } from './constraints'

export interface Participant { id: string; displayName: string; isOnline: boolean; joinedAt: string; cursorColor: string }

export interface PlanningRoomSession {
  roomId: string;
  createdAt: string;
  participants: Participant[];
  constraintsMatrix: Record<string, IndividualConstraints>;
  latestSolverResult: SolverOutput | null;
  isSolving: boolean;
}

// Safe public view - strips budget data and internal flags before sending to clients
export interface PublicRoomView {
  roomId: string;
  createdAt: string;
  participants: Participant[];
  latestSolverResult: SolverOutput | null;
}

export const WS_EVENTS = {
  ROOM_STATE: 'room:state',
  PARTICIPANT_JOIN: 'room:participant_join',
  PARTICIPANT_LEAVE: 'room:participant_leave',
  DELTA_BROADCAST: 'room:delta',
  SOLVE_STARTED: 'solver:started',
  SOLVE_RESULT: 'solver:result',
  SOLVE_ERROR: 'solver:error',
  JOIN_ROOM: 'client:join',
  AVAILABILITY_CHANGE: 'client:availability',
  BUDGET_CHANGE: 'client:budget',
  TRIGGER_SOLVE: 'client:solve'
} as const

export type WsEventName = typeof WS_EVENTS[keyof typeof WS_EVENTS]
export interface RoomRow { id: string; created_at: string; session_json: PlanningRoomSession; expires_at: string }
