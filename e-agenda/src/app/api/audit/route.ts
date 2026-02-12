import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const role = (session.user as Record<string, unknown>).role as string;
  if (role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Apenas administradores podem acessar logs de auditoria' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const entityType = searchParams.get('entity_type');

  let query = supabaseAdmin
    .from('audit_logs')
    .select('*, user:users!user_id(*)', { count: 'exact' })
    .order('timestamp', { ascending: false });

  if (entityType) query = query.eq('entity_type', entityType);

  query = query.range((page - 1) * limit, page * limit - 1);

  const { data: logs, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    logs: logs || [],
    total: count || 0,
    page,
    limit,
  });
}
