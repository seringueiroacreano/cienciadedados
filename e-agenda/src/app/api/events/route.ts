import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit';
import { checkEventConflicts } from '@/lib/conflicts';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const setor = searchParams.get('setor');
  const priority = searchParams.get('priority');
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  let query = supabaseAdmin
    .from('events')
    .select('*, creator:users!created_by(*)', { count: 'exact' });

  if (start) query = query.gte('start_time', start);
  if (end) query = query.lte('end_time', end);
  if (setor) query = query.contains('setores_envolvidos', [setor]);
  if (priority) query = query.eq('priority', priority);
  if (category) query = query.eq('category', category);
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

  query = query
    .order('start_time', { ascending: true })
    .range((page - 1) * limit, page * limit - 1);

  const { data: events, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    events: events || [],
    total: count || 0,
    page,
    limit,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const role = (session.user as Record<string, unknown>).role as string;

  if (role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Apenas administradores podem criar eventos' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const {
    title,
    description,
    start_time,
    end_time,
    location,
    priority,
    category,
    setores_envolvidos,
  } = body;

  if (!title || !start_time || !end_time) {
    return NextResponse.json(
      { error: 'Título, data de início e data de fim são obrigatórios' },
      { status: 400 }
    );
  }

  if (new Date(start_time) >= new Date(end_time)) {
    return NextResponse.json(
      { error: 'A data de início deve ser anterior à data de fim' },
      { status: 400 }
    );
  }

  // Check conflicts
  const conflicts = await checkEventConflicts(start_time, end_time);

  const { data: event, error } = await supabaseAdmin
    .from('events')
    .insert({
      title,
      description: description || '',
      start_time,
      end_time,
      location: location || '',
      priority: priority || 'MEDIUM',
      category: category || 'OUTRO',
      created_by: userId,
      setores_envolvidos: setores_envolvidos || [],
    })
    .select('*, creator:users!created_by(*)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createAuditLog(userId, 'CREATE', 'EVENT', event.id, {
    title,
    start_time,
    end_time,
  });

  return NextResponse.json({
    event,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
  }, { status: 201 });
}
