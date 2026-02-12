import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkEventConflicts } from '@/lib/conflicts';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startTime = searchParams.get('start_time');
  const endTime = searchParams.get('end_time');
  const excludeId = searchParams.get('exclude_id');

  if (!startTime || !endTime) {
    return NextResponse.json(
      { error: 'start_time e end_time são obrigatórios' },
      { status: 400 }
    );
  }

  const conflicts = await checkEventConflicts(
    startTime,
    endTime,
    excludeId || undefined
  );

  return NextResponse.json({ conflicts });
}
