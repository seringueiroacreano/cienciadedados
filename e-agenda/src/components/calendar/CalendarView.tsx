'use client';

import { useState, useCallback } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Event, PRIORITY_COLORS, SETOR_COLORS } from '@/types';
import Button from '@/components/ui/Button';
import EventDetail from '@/components/events/EventDetail';

type ViewType = 'month' | 'week' | 'day';

interface CalendarViewProps {
  events: Event[];
  onRefresh?: () => void;
}

export default function CalendarView({ events, onRefresh }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('month');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const navigatePrev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const navigateNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const goToToday = () => setCurrentDate(new Date());

  const getEventsForDay = useCallback(
    (day: Date) => {
      return events.filter((event) => {
        const eventStart = new Date(event.start_time);
        return isSameDay(eventStart, day);
      });
    },
    [events]
  );

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { locale: ptBR });
    const calEnd = endOfWeek(monthEnd, { locale: ptBR });

    const days: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      days.push(day);
      day = addDays(day, 1);
    }

    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return (
      <div>
        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-t-lg overflow-hidden">
          {weekDays.map((wd) => (
            <div
              key={wd}
              className="bg-gray-50 dark:bg-gray-800 px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              {wd}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-b-lg overflow-hidden">
          {days.map((d, i) => {
            const dayEvents = getEventsForDay(d);
            const isCurrentMonth = isSameMonth(d, currentDate);
            const isCurrentDay = isToday(d);

            return (
              <div
                key={i}
                className={`min-h-[80px] md:min-h-[100px] p-1 ${
                  isCurrentMonth
                    ? 'bg-white dark:bg-gray-800'
                    : 'bg-gray-50 dark:bg-gray-900'
                }`}
              >
                <div
                  className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    isCurrentDay
                      ? 'bg-blue-800 text-white'
                      : isCurrentMonth
                        ? 'text-gray-900 dark:text-gray-200'
                        : 'text-gray-400 dark:text-gray-600'
                  }`}
                >
                  {format(d, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className="w-full text-left px-1 py-0.5 rounded text-xs truncate text-white"
                      style={{
                        backgroundColor:
                          event.setores_envolvidos?.[0]
                            ? SETOR_COLORS[event.setores_envolvidos[0]]
                            : PRIORITY_COLORS[event.priority],
                      }}
                      title={event.title}
                    >
                      {event.title}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
                      +{dayEvents.length - 3} mais
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { locale: ptBR });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 7:00 to 22:00

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-8 gap-px bg-gray-200 dark:bg-gray-700 rounded-t-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800 p-2" />
            {days.map((d, i) => (
              <div
                key={i}
                className={`bg-gray-50 dark:bg-gray-800 p-2 text-center ${
                  isToday(d) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {format(d, 'EEE', { locale: ptBR })}
                </p>
                <p
                  className={`text-sm font-medium ${
                    isToday(d)
                      ? 'text-blue-800 dark:text-blue-300'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {format(d, 'd')}
                </p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-px bg-gray-200 dark:bg-gray-700 rounded-b-lg overflow-hidden">
            {hours.map((hour) => (
              <>
                <div
                  key={`h-${hour}`}
                  className="bg-gray-50 dark:bg-gray-800 p-1 text-right"
                >
                  <span className="text-xs text-gray-400">
                    {String(hour).padStart(2, '0')}:00
                  </span>
                </div>
                {days.map((d, di) => {
                  const cellEvents = events.filter((e) => {
                    const start = new Date(e.start_time);
                    return (
                      isSameDay(start, d) && start.getHours() === hour
                    );
                  });

                  return (
                    <div
                      key={`${hour}-${di}`}
                      className="bg-white dark:bg-gray-800 min-h-[40px] p-0.5"
                    >
                      {cellEvents.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className="w-full text-left px-1 py-0.5 rounded text-xs truncate text-white mb-0.5"
                          style={{
                            backgroundColor: PRIORITY_COLORS[event.priority],
                          }}
                          title={event.title}
                        >
                          {event.title}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = getEventsForDay(currentDate);
    const hours = Array.from({ length: 16 }, (_, i) => i + 7);

    return (
      <div className="space-y-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
        {hours.map((hour) => {
          const hourEvents = dayEvents.filter(
            (e) => new Date(e.start_time).getHours() === hour
          );

          return (
            <div
              key={hour}
              className="flex bg-white dark:bg-gray-800 min-h-[48px]"
            >
              <div className="w-16 flex-shrink-0 p-2 text-right border-r border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-400">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
              <div className="flex-1 p-1 space-y-1">
                {hourEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className="w-full text-left px-2 py-1 rounded text-sm text-white"
                    style={{
                      backgroundColor: PRIORITY_COLORS[event.priority],
                    }}
                  >
                    <span className="font-medium">{event.title}</span>
                    {event.location && (
                      <span className="ml-2 opacity-80">
                        - {event.location}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const viewTitle = () => {
    if (view === 'month')
      return format(currentDate, 'MMMM yyyy', { locale: ptBR });
    if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { locale: ptBR });
      const weekEnd = endOfWeek(currentDate, { locale: ptBR });
      return `${format(weekStart, 'd MMM', { locale: ptBR })} - ${format(weekEnd, 'd MMM yyyy', { locale: ptBR })}`;
    }
    return format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", {
      locale: ptBR,
    });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={navigatePrev}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white capitalize min-w-[200px] text-center">
            {viewTitle()}
          </h2>
          <button
            onClick={navigateNext}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <Button size="sm" variant="ghost" onClick={goToToday}>
            Hoje
          </Button>
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {(['day', 'week', 'month'] as ViewType[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                view === v
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && renderMonthView()}
      {view === 'week' && renderWeekView()}
      {view === 'day' && renderDayView()}

      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          isOpen={!!selectedEvent}
          onClose={() => {
            setSelectedEvent(null);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}
