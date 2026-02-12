import { supabaseAdmin } from './supabase';
import { AuditAction, EntityType } from '@/types';

export async function createAuditLog(
  userId: string,
  action: AuditAction,
  entityType: EntityType,
  entityId: string,
  changedFields: Record<string, unknown> = {}
) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      changed_fields: changedFields,
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}
