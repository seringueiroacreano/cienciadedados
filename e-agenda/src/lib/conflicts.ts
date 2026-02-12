import { supabaseAdmin } from './supabase';
import { Event, ConflictInfo } from '@/types';

export async function checkEventConflicts(
  startTime: string,
  endTime: string,
  excludeEventId?: string
): Promise<ConflictInfo[]> {
  let query = supabaseAdmin
    .from('events')
    .select('*')
    .lt('start_time', endTime)
    .gt('end_time', startTime);

  if (excludeEventId) {
    query = query.neq('id', excludeEventId);
  }

  const { data: conflictingEvents, error } = await query;

  if (error || !conflictingEvents) {
    return [];
  }

  return conflictingEvents.map((event: Event) => {
    const overlapStart =
      new Date(event.start_time) > new Date(startTime)
        ? event.start_time
        : startTime;
    const overlapEnd =
      new Date(event.end_time) < new Date(endTime)
        ? event.end_time
        : endTime;

    return {
      event,
      overlap_start: overlapStart,
      overlap_end: overlapEnd,
    };
  });
}
