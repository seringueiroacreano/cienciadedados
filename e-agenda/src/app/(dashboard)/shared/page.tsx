'use client';

import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { SharedCalendar } from '@/types';
import Card, { CardBody } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import toast from 'react-hot-toast';
import { Plus, Copy, Link2, Globe, Lock } from 'lucide-react';

export default function SharedCalendarsPage() {
  const { isAdmin } = useCurrentUser();
  const [sharedCalendars, setSharedCalendars] = useState<SharedCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    share_type: 'PUBLIC' as 'PUBLIC' | 'RESTRICTED',
    shared_with: '',
    expires_at: '',
  });

  const fetchSharedCalendars = async () => {
    try {
      const res = await fetch('/api/shared');
      const data = await res.json();
      setSharedCalendars(data.sharedCalendars || []);
    } catch {
      // Failed
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSharedCalendars();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const payload = {
        ...form,
        shared_with: form.shared_with
          ? form.shared_with.split(',').map((e) => e.trim())
          : [],
        expires_at: form.expires_at || null,
      };

      const res = await fetch('/api/shared', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      toast.success('Link de compartilhamento criado!');
      await navigator.clipboard.writeText(data.shareUrl);
      toast.success('Link copiado para a área de transferência!');
      setShowCreateModal(false);
      setForm({
        name: '',
        description: '',
        share_type: 'PUBLIC',
        shared_with: '',
        expires_at: '',
      });
      fetchSharedCalendars();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Erro ao criar compartilhamento'
      );
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Calendários Compartilhados
        </h1>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} className="mr-1" />
            Novo Link
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-blue-800 border-t-transparent rounded-full" />
        </div>
      ) : sharedCalendars.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Link2 size={40} className="mx-auto mb-3 opacity-50" />
              <p>Nenhum calendário compartilhado ainda.</p>
              {isAdmin && (
                <p className="text-sm mt-1">
                  Crie um link para compartilhar a agenda.
                </p>
              )}
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {sharedCalendars.map((sc) => (
            <Card key={sc.id}>
              <CardBody>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {sc.share_type === 'PUBLIC' ? (
                      <Globe size={18} className="text-green-500 mt-0.5" />
                    ) : (
                      <Lock size={18} className="text-yellow-500 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {sc.name || 'Agenda Compartilhada'}
                      </p>
                      {sc.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {sc.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant={
                            sc.share_type === 'PUBLIC' ? 'success' : 'warning'
                          }
                        >
                          {sc.share_type === 'PUBLIC'
                            ? 'Público'
                            : 'Restrito'}
                        </Badge>
                        {sc.expires_at && (
                          <span className="text-xs text-gray-400">
                            Expira:{' '}
                            {new Date(sc.expires_at).toLocaleDateString(
                              'pt-BR'
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyLink(sc.share_token)}
                  >
                    <Copy size={14} className="mr-1" />
                    Copiar Link
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Criar Link Compartilhável"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Agenda da Presidência"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descrição
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Descrição opcional..."
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo de Acesso
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="PUBLIC"
                  checked={form.share_type === 'PUBLIC'}
                  onChange={() =>
                    setForm({ ...form, share_type: 'PUBLIC' })
                  }
                  className="text-blue-800"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Público
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="RESTRICTED"
                  checked={form.share_type === 'RESTRICTED'}
                  onChange={() =>
                    setForm({ ...form, share_type: 'RESTRICTED' })
                  }
                  className="text-blue-800"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Restrito
                </span>
              </label>
            </div>
          </div>

          {form.share_type === 'RESTRICTED' && (
            <Input
              label="Emails permitidos (separados por vírgula)"
              value={form.shared_with}
              onChange={(e) =>
                setForm({ ...form, shared_with: e.target.value })
              }
              placeholder="email1@tjac.jus.br, email2@tjac.jus.br"
            />
          )}

          <Input
            label="Data de Expiração (opcional)"
            type="date"
            value={form.expires_at}
            onChange={(e) =>
              setForm({ ...form, expires_at: e.target.value })
            }
          />

          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={creating}>
              Criar Link
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
