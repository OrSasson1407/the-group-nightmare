import { supabase } from './supabase.js';
import type { PlanningRoomSession } from '@tgn/shared';

// Persist the room state to Supabase in the background
export async function persistRoomState(room: PlanningRoomSession) {
  try {
    const { error } = await supabase.from('rooms').upsert({
      id: room.roomId,
      session_json: room,
      updated_at: new Date().toISOString()
    });
    if (error) {
      console.warn('[DB] Supabase persistence warning (ignoring in dev):', error.message);
    }
  } catch (err) {
    console.error('[DB] Unexpected error writing to Supabase:', err);
  }
}

// Fetch a room upon initialization
export async function fetchRoomState(roomId: string): Promise<PlanningRoomSession | null> {
  try {
    const { data, error } = await supabase.from('rooms').select('session_json').eq('id', roomId).single();
    if (error || !data) return null;
    return data.session_json as PlanningRoomSession;
  } catch (err) {
    return null;
  }
}
