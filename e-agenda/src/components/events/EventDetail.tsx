'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Event,
  SETOR_LABELS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
  SETOR_COLORS,
} from '@/types';
import { formatDateTime } from '@/lib/utils';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import {
  Clock,
  MapPin,
  Tag,
  Users,
  Edit,
  Trash2,
  ExternalLink,
} from 'lucide-react';

interface EventDetailProps {
  event: Event;
  isOpen: boolean;
  onClose: () => void;
}

export default function EventDetail({
  event,
  isOpen,
  onClose,
}: EventDetailProps) {
  const router = useRouter();
  const { isAdmin } = useCurrentUser();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success('Evento excluído com sucesso');
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao excluir evento'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleSyncGoogle = async () => {
    try {
      const res = await fetch('/api/google-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          event_id: event.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success('Evento sincronizado com Google Calendar');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Erro ao sincronizar com Google Calendar'
      );
    }
  };

  const priorityVariant = {
    LOW: 'success' as const,
    MEDIUM: 'warning' as const,
    HIGH: 'danger' as const,
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={event.title} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant={priorityVariant[event.priority]}>
            {PRIORITY_LABELS[event.priority]}
          </Badge>
          <Badge variant="info">{CATEGORY_LABELS[event.category]}</Badge>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <Clock size={16} className="mt-0.5 text-gray-400" />
            <div>
              <p className="text-gray-900 dark:text-white">
                {formatDateTime(event.start_time)}
              </p>
              <p className="text-gray-500 dark:text-gray-400">
                até {formatDateTime(event.end_time)}
              </p>
            </div>
          </div>

          {event.location && (
            <div className="flex items-center gap-3">
              <MapPin size={16} className="text-gray-400" />
              <span className="text-gray-900 dark:text-white">
                {event.location}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Tag size={16} className="text-gray-400" />
            <span className="text-gray-900 dark:text-white">
              {CATEGORY_LABELS[event.category]}
            </span>
          </div>

          {event.setores_envolvidos?.length > 0 && (
            <div className="flex items-start gap-3">
              <Users size={16} className="mt-0.5 text-gray-400" />
              <div className="flex flex-wrap gap-1">
                {event.setores_envolvidos.map((setor) => (
                  <span
                    key={setor}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: SETOR_COLORS[setor] }}
                  >
                    {SETOR_LABELS[setor]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {event.description && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descrição
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {event.description}
            </p>
          </div>
        )}

        {event.creator && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Criado por {event.creator.name} ({event.creator.email})
            </p>
          </div>
        )}

        {isAdmin && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onClose();
                router.push(`/events/${event.id}/edit`);
              }}
            >
              <Edit size={14} className="mr-1" />
              Editar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSyncGoogle}
            >
              <ExternalLink size={14} className="mr-1" />
              Sincronizar Google
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
            >
              <Trash2 size={14} className="mr-1" />
              Excluir
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
