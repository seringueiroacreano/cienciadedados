'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Event, PRIORITY_LABELS, CATEGORY_LABELS, SETOR_LABELS, SETOR_COLORS } from '@/types';
import { formatDate, formatTime } from '@/lib/utils';
import Card, { CardBody } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { Calendar, Clock, MapPin, Tag } from 'lucide-react';

export default function SharedCalendarPage() {
  const params = useParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [calendarInfo, setCalendarInfo] = useState<{
    name: string;
    description: string;
    share_type: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSharedCalendar = async () => {
      try {
        const res = await fetch(`/api/shared/${params.token}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Erro ao carregar agenda');
        }

        setCalendarInfo(data.shared);
        setEvents(data.events || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Erro ao carregar agenda compartilhada'
        );
      } finally {
        setLoading(false);
      }
    };

    if (params.token) fetchSharedCalendar();
  }, [params.token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-800 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-gray-500">Carregando agenda...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar size={24} className="text-red-600 dark:text-red-300" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Agenda Indisponível
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-800 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">TJ</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              {calendarInfo?.name || 'Agenda Compartilhada'}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              E-Agenda TJAC - Somente Leitura
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {calendarInfo?.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            {calendarInfo.description}
          </p>
        )}

        {events.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar size={40} className="mx-auto mb-3 opacity-50" />
            <p>Nenhum evento encontrado nesta agenda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <Card key={event.id}>
                <CardBody>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      {event.title}
                    </h3>
                    <Badge
                      variant={
                        event.priority === 'HIGH'
                          ? 'danger'
                          : event.priority === 'MEDIUM'
                            ? 'warning'
                            : 'success'
                      }
                    >
                      {PRIORITY_LABELS[event.priority]}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Clock size={14} />
                      <span>
                        {formatDate(event.start_time)}{' '}
                        {formatTime(event.start_time)} -{' '}
                        {formatTime(event.end_time)}
                      </span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2">
                        <MapPin size={14} />
                        <span>{event.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Tag size={14} />
                      <span>{CATEGORY_LABELS[event.category]}</span>
                    </div>
                  </div>

                  {event.description && (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      {event.description}
                    </p>
                  )}

                  {event.setores_envolvidos?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {event.setores_envolvidos.map((setor) => (
                        <span
                          key={setor}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{
                            backgroundColor: SETOR_COLORS[setor],
                          }}
                        >
                          {SETOR_LABELS[setor]}
                        </span>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-700 mt-12 py-4 text-center">
        <p className="text-xs text-gray-400">
          E-Agenda TJAC - Tribunal de Justiça do Estado do Acre
        </p>
      </footer>
    </div>
  );
}
