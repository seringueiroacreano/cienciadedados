import type { Metadata } from 'next';
import './globals.css';
import SessionProvider from '@/contexts/SessionProvider';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import ToastProvider from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'E-Agenda TJAC',
  description:
    'Sistema de Agenda Online do Tribunal de Justiça do Acre - Planejamento e acompanhamento das atividades presidenciais',
  keywords: ['TJAC', 'agenda', 'tribunal', 'acre', 'justiça'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased">
        <SessionProvider>
          <ThemeProvider>
            {children}
            <ToastProvider />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
