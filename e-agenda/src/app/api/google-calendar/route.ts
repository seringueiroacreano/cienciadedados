import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  listGoogleCalendarEvents,
} from '@/lib/google-calendar';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const accessToken = (session.user as Record<string, unknown>)
    .accessToken as string;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Google Calendar não conectado. Reconecte sua conta.' },
      { status: 400 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const timeMin = searchParams.get('timeMin') || undefined;
    const timeMax = searchParams.get('timeMax') || undefined;

    const events = await listGoogleCalendarEvents(
      accessToken,
      timeMin,
      timeMax
    );
    return NextResponse.json({ events });
  } catch (error) {
    console.error('Google Calendar API error:', error);
    return NextResponse.json(
      { error: 'Erro ao acessar Google Calendar' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const accessToken = (session.user as Record<string, unknown>)
    .accessToken as string;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Google Calendar não conectado' },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { action, event_id, google_event_id } = body;

  try {
    if (action === 'sync') {
      const { data: event } = await supabaseAdmin
        .from('events')
        .select('*')
        .eq('id', event_id)
        .single();

      if (!event) {
        return NextResponse.json(
          { error: 'Evento não encontrado' },
          { status: 404 }
        );
      }

      const googleEventId = await createGoogleCalendarEvent(
        accessToken,
        event
      );

      await supabaseAdmin
        .from('events')
        .update({ google_calendar_event_id: googleEventId })
        .eq('id', event_id);

      return NextResponse.json({ googleEventId });
    }

    if (action === 'update' && google_event_id) {
      const { data: event } = await supabaseAdmin
        .from('events')
        .select('*')
        .eq('id', event_id)
        .single();

      if (!event) {
        return NextResponse.json(
          { error: 'Evento não encontrado' },
          { status: 404 }
        );
      }

      await updateGoogleCalendarEvent(accessToken, google_event_id, event);
      return NextResponse.json({ success: true });
    }

    if (action === 'delete' && google_event_id) {
      await deleteGoogleCalendarEvent(accessToken, google_event_id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('Google Calendar sync error:', error);
    return NextResponse.json(
      { error: 'Erro ao sincronizar com Google Calendar' },
      { status: 500 }
    );
  }
}
