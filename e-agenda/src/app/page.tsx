'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    } else if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-2xl">TJ</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          E-Agenda TJAC
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Carregando...
        </p>
        <div className="mt-4">
          <div className="animate-spin w-6 h-6 border-2 border-blue-800 border-t-transparent rounded-full mx-auto" />
        </div>
      </div>
    </div>
  );
}
