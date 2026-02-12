'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import {
  EventFormData,
  Setor,
  EventPriority,
  EventCategory,
  SETOR_LABELS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
  Event,
  ConflictInfo,
} from '@/types';
import { toLocalDatetimeInput } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface EventFormProps {
  event?: Event;
  mode: 'create' | 'edit';
}

const setorOptions: Setor[] = ['PRESIDENCIA', 'SEREP', 'ASMIL'];

export default function EventForm({ event, mode }: EventFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [form, setForm] = useState<EventFormData>({
    title: event?.title || '',
    description: event?.description || '',
    start_time: event?.start_time
      ? toLocalDatetimeInput(event.start_time)
      : '',
    end_time: event?.end_time ? toLocalDatetimeInput(event.end_time) : '',
    location: event?.location || '',
    priority: event?.priority || 'MEDIUM',
    category: event?.category || 'REUNIAO',
    setores_envolvidos: event?.setores_envolvidos || [],
    sync_google_calendar: false,
  });

  const toggleSetor = (setor: Setor) => {
    setForm((prev) => ({
      ...prev,
      setores_envolvidos: prev.setores_envolvidos.includes(setor)
        ? prev.setores_envolvidos.filter((s) => s !== setor)
        : [...prev.setores_envolvidos, setor],
    }));
  };

  // Check for conflicts when dates change
  useEffect(() => {
    if (!form.start_time || !form.end_time) return;

    const checkConflicts = async () => {
      try {
        const params = new URLSearchParams({
          start_time: new Date(form.start_time).toISOString(),
          end_time: new Date(form.end_time).toISOString(),
        });
        if (event?.id) params.set('exclude_id', event.id);

        const res = await fetch(`/api/events/conflicts?${params}`);
        const data = await res.json();
        setConflicts(data.conflicts || []);
      } catch {
        // Silently fail conflict check
      }
    };

    const timeout = setTimeout(checkConflicts, 500);
    return () => clearTimeout(timeout);
  }, [form.start_time, form.end_time, event?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...form,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
      };

      const url =
        mode === 'create' ? '/api/events' : `/api/events/${event?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar evento');
      }

      if (data.conflicts?.length) {
        toast(
          `Evento salvo, mas existem ${data.conflicts.length} conflito(s) de horário`,
          { icon: '⚠️' }
        );
      } else {
        toast.success(
          mode === 'create'
            ? 'Evento criado com sucesso!'
            : 'Evento atualizado com sucesso!'
        );
      }

      router.push('/calendar');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao salvar evento'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {conflicts.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 mb-2">
            <AlertTriangle size={18} />
            <span className="font-medium">Conflitos detectados</span>
          </div>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
            {conflicts.map((c, i) => (
              <li key={i}>
                &quot;{c.event.title}&quot; - sobreposição de horário
              </li>
            ))}
          </ul>
        </div>
      )}

      <Input
        label="Título do Evento *"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="Ex: Reunião com Desembargadores"
        required
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Data e Hora de Início *"
          type="datetime-local"
          value={form.start_time}
          onChange={(e) => setForm({ ...form, start_time: e.target.value })}
          required
        />
        <Input
          label="Data e Hora de Fim *"
          type="datetime-local"
          value={form.end_time}
          onChange={(e) => setForm({ ...form, end_time: e.target.value })}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Descrição / Observações
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Detalhes sobre o evento..."
          rows={3}
          className="w-full px-3 py-2 border rounded-lg text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <Input
        label="Local / Localização"
        value={form.location}
        onChange={(e) => setForm({ ...form, location: e.target.value })}
        placeholder="Ex: Sala de Reuniões 3 - Sede TJAC"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Prioridade"
          value={form.priority}
          onChange={(e) =>
            setForm({ ...form, priority: e.target.value as EventPriority })
          }
          options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <Select
          label="Categoria"
          value={form.category}
          onChange={(e) =>
            setForm({ ...form, category: e.target.value as EventCategory })
          }
          options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Setores Envolvidos
        </label>
        <div className="flex flex-wrap gap-2">
          {setorOptions.map((setor) => (
            <button
              key={setor}
              type="button"
              onClick={() => toggleSetor(setor)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                form.setores_envolvidos.includes(setor)
                  ? 'bg-blue-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {SETOR_LABELS[setor]}
            </button>
          ))}
        </div>
        {form.setores_envolvidos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {form.setores_envolvidos.map((s) => (
              <Badge key={s} variant="info">
                {SETOR_LABELS[s]}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="syncGoogle"
          checked={form.sync_google_calendar}
          onChange={(e) =>
            setForm({ ...form, sync_google_calendar: e.target.checked })
          }
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label
          htmlFor="syncGoogle"
          className="text-sm text-gray-700 dark:text-gray-300"
        >
          Sincronizar com Google Calendar
        </label>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button type="submit" loading={loading}>
          {mode === 'create' ? 'Criar Evento' : 'Salvar Alterações'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
