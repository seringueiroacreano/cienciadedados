import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { data: shared, error: sharedError } = await supabaseAdmin
    .from('shared_calendars')
    .select('*')
    .eq('share_token', params.token)
    .single();

  if (sharedError || !shared) {
    return NextResponse.json(
      { error: 'Link de compartilhamento não encontrado ou expirado' },
      { status: 404 }
    );
  }

  // Check expiration
  if (shared.expires_at && new Date(shared.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'Link de compartilhamento expirado' },
      { status: 410 }
    );
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  let query = supabaseAdmin
    .from('events')
    .select('*')
    .order('start_time', { ascending: true });

  if (start) query = query.gte('start_time', start);
  if (end) query = query.lte('end_time', end);

  const { data: events, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    shared: {
      name: shared.name,
      description: shared.description,
      share_type: shared.share_type,
    },
    events: events || [],
  });
}
