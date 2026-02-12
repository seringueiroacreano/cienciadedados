'use client';

import { Event, SETOR_LABELS, PRIORITY_LABELS, CATEGORY_LABELS, PRIORITY_COLORS, SETOR_COLORS } from '@/types';
import { formatDate, formatTime, getRelativeTime } from '@/lib/utils';
import { Clock, MapPin, Tag } from 'lucide-react';
import Badge from '@/components/ui/Badge';

interface EventCardProps {
  event: Event;
  onClick?: () => void;
  compact?: boolean;
}

export default function EventCard({ event, onClick, compact }: EventCardProps) {
  const priorityVariant = {
    LOW: 'success' as const,
    MEDIUM: 'warning' as const,
    HIGH: 'danger' as const,
  };

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
        onClick={onClick}
      >
        <div
          className="w-1 h-10 rounded-full flex-shrink-0"
          style={{ backgroundColor: PRIORITY_COLORS[event.priority] }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {event.title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatTime(event.start_time)} - {formatTime(event.end_time)}
          </p>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
          {getRelativeTime(event.start_time)}
        </span>
      </div>
    );
  }

  return (
    <div
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {event.title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {formatDate(event.start_time)}
          </p>
        </div>
        <Badge variant={priorityVariant[event.priority]}>
          {PRIORITY_LABELS[event.priority]}
        </Badge>
      </div>

      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <Clock size={14} />
          <span>
            {formatTime(event.start_time)} - {formatTime(event.end_time)}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2">
            <MapPin size={14} />
            <span className="truncate">{event.location}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Tag size={14} />
          <span>{CATEGORY_LABELS[event.category]}</span>
        </div>
      </div>

      {event.setores_envolvidos?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
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
      )}
    </div>
  );
}
