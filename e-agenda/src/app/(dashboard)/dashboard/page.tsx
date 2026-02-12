'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Event,
  SETOR_LABELS,
  Setor,
  SETOR_COLORS,
} from '@/types';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import Card, { CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EventCard from '@/components/events/EventCard';
import EventDetail from '@/components/events/EventDetail';
import {
  CalendarDays,
  AlertTriangle,
  TrendingUp,
  Clock,
  Plus,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAdmin } = useCurrentUser();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const fetchEvents = async () => {
    try {
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const params = new URLSearchParams({
        start: now.toISOString(),
        end: nextWeek.toISOString(),
        limit: '20',
      });

      const res = await fetch(`/api/events?${params}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch {
      // Failed to load events
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const todayEvents = events.filter((e) => {
    const eventDate = new Date(e.start_time).toDateString();
    return eventDate === new Date().toDateString();
  });

  const upcomingEvents = events.filter((e) => {
    const eventDate = new Date(e.start_time);
    return eventDate > new Date();
  });

  // Count events per setor
  const setorCounts: Partial<Record<Setor, number>> = {};
  events.forEach((e) => {
    e.setores_envolvidos?.forEach((s) => {
      setorCounts[s] = (setorCounts[s] || 0) + 1;
    });
  });

  // Detect conflicts (overlapping events)
  const conflictPairs: [Event, Event][] = [];
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      if (
        new Date(a.start_time) < new Date(b.end_time) &&
        new Date(a.end_time) > new Date(b.start_time)
      ) {
        conflictPairs.push([a, b]);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Bem-vindo(a), {user?.name?.split(' ')[0] || 'Usuário'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => router.push('/events/new')}>
            <Plus size={16} className="mr-1" />
            Novo Evento
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <CalendarDays size={20} className="text-blue-800 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {todayEvents.length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Eventos hoje
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Clock size={20} className="text-green-800 dark:text-green-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {upcomingEvents.length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Próximos 7 dias
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
                <AlertTriangle
                  size={20}
                  className="text-yellow-800 dark:text-yellow-300"
                />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {conflictPairs.length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Conflitos
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <TrendingUp
                  size={20}
                  className="text-purple-800 dark:text-purple-300"
                />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {events.length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Total na semana
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Events */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Próximos Eventos
              </h2>
            </CardHeader>
            <CardBody className="p-2">
              {loading ? (
                <div className="p-6 text-center text-gray-500">
                  Carregando eventos...
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  Nenhum evento próximo
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {upcomingEvents.slice(0, 8).map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      compact
                      onClick={() => setSelectedEvent(event)}
                    />
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          {/* Setor Activity */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Eventos por Setor
              </h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                {Object.entries(SETOR_LABELS)
                  .filter(([key]) => key !== 'OUTRO')
                  .map(([key, label]) => {
                    const count = setorCounts[key as Setor] || 0;
                    const maxCount = Math.max(...Object.values(setorCounts), 1);
                    const percentage = (count / maxCount) * 100;

                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-700 dark:text-gray-300">
                            {label}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {count}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: SETOR_COLORS[key as Setor],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardBody>
          </Card>

          {/* Conflicts */}
          {conflictPairs.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-yellow-500" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Conflitos
                  </h2>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-2">
                  {conflictPairs.slice(0, 5).map(([a, b], i) => (
                    <div
                      key={i}
                      className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm"
                    >
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">
                        {a.title}
                      </p>
                      <p className="text-yellow-600 dark:text-yellow-400 text-xs">
                        conflita com &quot;{b.title}&quot;
                      </p>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          isOpen={!!selectedEvent}
          onClose={() => {
            setSelectedEvent(null);
            fetchEvents();
          }}
        />
      )}
    </div>
  );
}
