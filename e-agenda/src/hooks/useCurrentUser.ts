'use client';

import { useSession } from 'next-auth/react';
import { UserRole, Setor } from '@/types';

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string;
  role: UserRole;
  setor: Setor;
  googleId: string;
  accessToken: string;
}

export function useCurrentUser() {
  const { data: session, status } = useSession();

  const user: CurrentUser | null = session?.user
    ? {
        id: (session.user as Record<string, unknown>).id as string,
        name: session.user.name || '',
        email: session.user.email || '',
        image: session.user.image || '',
        role: ((session.user as Record<string, unknown>).role as UserRole) || 'VIEWER',
        setor: ((session.user as Record<string, unknown>).setor as Setor) || 'OUTRO',
        googleId: (session.user as Record<string, unknown>).googleId as string,
        accessToken: (session.user as Record<string, unknown>).accessToken as string,
      }
    : null;

  return {
    user,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    isAdmin: user?.role === 'ADMIN',
  };
}
