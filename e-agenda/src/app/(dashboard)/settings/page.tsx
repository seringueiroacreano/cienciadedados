'use client';

import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeProvider';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import Card, { CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import toast from 'react-hot-toast';
import {
  Sun,
  Moon,
  Bell,
  Globe,
  Calendar,
  ExternalLink,
} from 'lucide-react';

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useCurrentUser();
  const [googleConnected, setGoogleConnected] = useState(!!user?.accessToken);
  const [notifications, setNotifications] = useState({
    newEvent: true,
    eventChanged: true,
    reminder15min: true,
    reminder1hour: true,
    reminder1day: false,
  });

  const handleGoogleConnect = () => {
    toast.success(
      googleConnected
        ? 'Google Calendar desconectado'
        : 'Google Calendar conectado'
    );
    setGoogleConnected(!googleConnected);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Configurações
      </h1>

      {/* Theme */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Aparência
            </h2>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Tema
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Escolha entre modo claro e escuro
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                theme === 'dark' ? 'bg-blue-800' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  theme === 'dark' ? 'translate-x-7' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </CardBody>
      </Card>

      {/* Google Calendar Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar size={18} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Integração Google Calendar
            </h2>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {googleConnected ? 'Conectado' : 'Desconectado'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {googleConnected
                  ? 'Seus eventos são sincronizados com o Google Calendar'
                  : 'Conecte para sincronizar eventos automaticamente'}
              </p>
            </div>
            <Button
              size="sm"
              variant={googleConnected ? 'danger' : 'primary'}
              onClick={handleGoogleConnect}
            >
              <ExternalLink size={14} className="mr-1" />
              {googleConnected ? 'Desconectar' : 'Conectar'}
            </Button>
          </div>

          {googleConnected && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm text-green-700 dark:text-green-300">
              Sincronização ativa com {user?.email}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell size={18} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Notificações
            </h2>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {[
              {
                key: 'newEvent',
                label: 'Novo evento criado',
                desc: 'Receba notificação quando um novo evento for criado',
              },
              {
                key: 'eventChanged',
                label: 'Evento alterado',
                desc: 'Receba notificação quando um evento for modificado',
              },
              {
                key: 'reminder15min',
                label: 'Lembrete 15 minutos',
                desc: 'Receba lembrete 15 minutos antes do evento',
              },
              {
                key: 'reminder1hour',
                label: 'Lembrete 1 hora',
                desc: 'Receba lembrete 1 hora antes do evento',
              },
              {
                key: 'reminder1day',
                label: 'Lembrete 1 dia',
                desc: 'Receba lembrete 1 dia antes do evento',
              },
            ].map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {item.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {item.desc}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setNotifications({
                      ...notifications,
                      [item.key]:
                        !notifications[
                          item.key as keyof typeof notifications
                        ],
                    })
                  }
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    notifications[item.key as keyof typeof notifications]
                      ? 'bg-blue-800'
                      : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                      notifications[item.key as keyof typeof notifications]
                        ? 'translate-x-7'
                        : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Timezone */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe size={18} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Fuso Horário
            </h2>
          </div>
        </CardHeader>
        <CardBody>
          <select className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="America/Rio_Branco">
              America/Rio_Branco (UTC-5) - Acre
            </option>
            <option value="America/Manaus">
              America/Manaus (UTC-4) - Amazonas
            </option>
            <option value="America/Sao_Paulo">
              America/São_Paulo (UTC-3) - Brasília
            </option>
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Fuso horário utilizado para exibição dos eventos
          </p>
        </CardBody>
      </Card>

      {/* About */}
      <Card>
        <CardBody>
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 space-y-1">
            <p className="font-medium">E-Agenda TJAC v1.0</p>
            <p>
              Tribunal de Justiça do Estado do Acre
            </p>
            <p>
              Gabinete da Presidência | SEREP | ASMIL
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
