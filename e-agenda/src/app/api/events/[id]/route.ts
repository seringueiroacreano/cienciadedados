import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit';
import { checkEventConflicts } from '@/lib/conflicts';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { data: event, error } = await supabaseAdmin
    .from('events')
    .select('*, creator:users!created_by(*)')
    .eq('id', params.id)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
  }

  return NextResponse.json({ event });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const role = (session.user as Record<string, unknown>).role as string;
  const userId = (session.user as Record<string, unknown>).id as string;

  if (role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Apenas administradores podem editar eventos' },
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

  if (start_time && end_time && new Date(start_time) >= new Date(end_time)) {
    return NextResponse.json(
      { error: 'A data de início deve ser anterior à data de fim' },
      { status: 400 }
    );
  }

  let conflicts: Awaited<ReturnType<typeof checkEventConflicts>> = [];
  if (start_time && end_time) {
    conflicts = await checkEventConflicts(start_time, end_time, params.id);
  }

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (start_time !== undefined) updateData.start_time = start_time;
  if (end_time !== undefined) updateData.end_time = end_time;
  if (location !== undefined) updateData.location = location;
  if (priority !== undefined) updateData.priority = priority;
  if (category !== undefined) updateData.category = category;
  if (setores_envolvidos !== undefined)
    updateData.setores_envolvidos = setores_envolvidos;

  const { data: event, error } = await supabaseAdmin
    .from('events')
    .update(updateData)
    .eq('id', params.id)
    .select('*, creator:users!created_by(*)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createAuditLog(userId, 'UPDATE', 'EVENT', params.id, updateData);

  return NextResponse.json({
    event,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const role = (session.user as Record<string, unknown>).role as string;
  const userId = (session.user as Record<string, unknown>).id as string;

  if (role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Apenas administradores podem excluir eventos' },
      { status: 403 }
    );
  }

  const { error } = await supabaseAdmin
    .from('events')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createAuditLog(userId, 'DELETE', 'EVENT', params.id, {});

  return NextResponse.json({ success: true });
}
