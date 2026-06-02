import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { queryAuditLogs, toCsv } from '@/lib/admin/audit-query';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<NextResponse | Response> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'superadmin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const rows = await queryAuditLogs({
    actorEmail: url.searchParams.get('actorEmail') ?? undefined,
    action: url.searchParams.get('action') ?? undefined,
    targetType: url.searchParams.get('targetType') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
    limit: 5000,
  });

  const csv = toCsv(rows);
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="audit-logs-${stamp}.csv"`,
    },
  });
}
