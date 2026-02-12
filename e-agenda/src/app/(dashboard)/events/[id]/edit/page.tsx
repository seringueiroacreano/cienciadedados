'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Event } from '@/types';
import EventForm from '@/components/events/EventForm';
import Card, { CardBody } from '@/components/ui/Card';
import toast from 'react-hot-toast';

export default function EditEventPage() {
  const params = useParams();
  const router = useRouter();
  const { isAdmin, isLoading: userLoading } = useCurrentUser();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userLoading && !isAdmin) {
      router.replace('/dashboard');
      return;
    }

    const fetchEvent = async () => {
      try {
        const res = await fetch(`/api/events/${params.id}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Evento não encontrado');
        }

        setEvent(data.event);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Erro ao carregar evento'
        );
        router.push('/calendar');
      } finally {
        setLoading(false);
      }
    };

    if (params.id) fetchEvent();
  }, [params.id, isAdmin, userLoading, router]);

  if (loading || userLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-800 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!event || !isAdmin) return null;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Editar Evento
      </h1>
      <Card>
        <CardBody>
          <EventForm event={event} mode="edit" />
        </CardBody>
      </Card>
    </div>
  );
}
