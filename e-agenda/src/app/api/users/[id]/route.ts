import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const currentRole = (session.user as Record<string, unknown>).role as string;
  const currentUserId = (session.user as Record<string, unknown>).id as string;

  if (currentRole !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Apenas administradores podem editar usuários' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { role, setor } = body;

  const updateData: Record<string, unknown> = {};
  if (role !== undefined) updateData.role = role;
  if (setor !== undefined) updateData.setor = setor;

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .update(updateData)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createAuditLog(currentUserId, 'UPDATE', 'USER', params.id, updateData);

  return NextResponse.json({ user });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const currentRole = (session.user as Record<string, unknown>).role as string;
  const currentUserId = (session.user as Record<string, unknown>).id as string;

  if (currentRole !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Apenas administradores podem remover usuários' },
      { status: 403 }
    );
  }

  if (params.id === currentUserId) {
    return NextResponse.json(
      { error: 'Você não pode remover seu próprio acesso' },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await createAuditLog(currentUserId, 'DELETE', 'USER', params.id, {});

  return NextResponse.json({ success: true });
}
