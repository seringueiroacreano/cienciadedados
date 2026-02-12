export type UserRole = 'ADMIN' | 'VIEWER';

export type Setor = 'PRESIDENCIA' | 'SEREP' | 'ASMIL' | 'OUTRO';

export type EventPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type EventCategory =
  | 'REUNIAO'
  | 'CERIMONIA'
  | 'EVENTO'
  | 'DESLOCAMENTO'
  | 'OUTRO';

export type ShareType = 'PUBLIC' | 'RESTRICTED';

export type NotificationType = 'NEW_EVENT' | 'EVENT_CHANGED' | 'REMINDER';

export type NotificationStatus = 'SENT' | 'FAILED' | 'PENDING';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export type EntityType = 'EVENT' | 'USER';

export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  photo_url: string;
  role: UserRole;
  setor: Setor;
  created_at: string;
  updated_at: string;
  last_login: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  location: string;
  priority: EventPriority;
  category: EventCategory;
  created_by: string;
  setores_envolvidos: Setor[];
  google_calendar_event_id?: string;
  created_at: string;
  updated_at: string;
  creator?: User;
}

export interface SharedCalendar {
  id: string;
  event_id?: string;
  share_type: ShareType;
  share_token: string;
  shared_with: string[];
  expires_at?: string;
  created_at: string;
  name?: string;
  description?: string;
  created_by: string;
}

export interface NotificationLog {
  id: string;
  user_id: string;
  event_id: string;
  type: NotificationType;
  sent_at: string;
  status: NotificationStatus;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: AuditAction;
  entity_type: EntityType;
  entity_id: string;
  changed_fields: Record<string, unknown>;
  timestamp: string;
  user?: User;
}

export interface EventFormData {
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  location: string;
  priority: EventPriority;
  category: EventCategory;
  setores_envolvidos: Setor[];
  sync_google_calendar?: boolean;
}

export interface ConflictInfo {
  event: Event;
  overlap_start: string;
  overlap_end: string;
}

export const SETOR_LABELS: Record<Setor, string> = {
  PRESIDENCIA: 'Gabinete da Presidência',
  SEREP: 'Secretaria de Cerimonial e Eventos',
  ASMIL: 'Assessoria Militar',
  OUTRO: 'Outro',
};

export const PRIORITY_LABELS: Record<EventPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
};

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  REUNIAO: 'Reunião',
  CERIMONIA: 'Cerimônia',
  EVENTO: 'Evento',
  DESLOCAMENTO: 'Deslocamento',
  OUTRO: 'Outro',
};

export const PRIORITY_COLORS: Record<EventPriority, string> = {
  LOW: '#22c55e',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
};

export const SETOR_COLORS: Record<Setor, string> = {
  PRESIDENCIA: '#1e40af',
  SEREP: '#7c3aed',
  ASMIL: '#059669',
  OUTRO: '#6b7280',
};
