import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateShareToken } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { data: sharedCalendars, error } = await supabaseAdmin
    .from('shared_calendars')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sharedCalendars: sharedCalendars || [] });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const role = (session.user as Record<string, unknown>).role as string;
  const userId = (session.user as Record<string, unknown>).id as string;

  if (role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Apenas administradores podem compartilhar agendas' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { name, description, share_type, shared_with, expires_at } = body;

  const shareToken = generateShareToken();

  const { data: shared, error } = await supabaseAdmin
    .from('shared_calendars')
    .insert({
      name: name || 'Agenda Compartilhada',
      description: description || '',
      share_type: share_type || 'PUBLIC',
      share_token: shareToken,
      shared_with: shared_with || [],
      expires_at: expires_at || null,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/shared/${shareToken}`;

  return NextResponse.json({ shared, shareUrl }, { status: 201 });
}
