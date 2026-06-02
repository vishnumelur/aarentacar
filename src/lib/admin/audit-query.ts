import { and, desc, eq, gte, lte, ilike, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';

export interface AuditFilter {
  actorEmail?: string;
  action?: string;
  targetType?: string;
  from?: string; // ISO date (yyyy-mm-dd)
  to?: string;
  limit?: number;
}

export interface AuditRow {
  id: string;
  createdAt: Date;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  payload: unknown;
}

function buildWhere(filter: AuditFilter): SQL | undefined {
  const clauses: SQL[] = [];
  if (filter.actorEmail) clauses.push(ilike(users.email, `%${filter.actorEmail}%`));
  if (filter.action) clauses.push(ilike(auditLogs.action, `%${filter.action}%`));
  if (filter.targetType) clauses.push(eq(auditLogs.targetType, filter.targetType));
  if (filter.from) clauses.push(gte(auditLogs.createdAt, new Date(`${filter.from}T00:00:00Z`)));
  if (filter.to) clauses.push(lte(auditLogs.createdAt, new Date(`${filter.to}T23:59:59Z`)));
  return clauses.length ? and(...clauses) : undefined;
}

/** Filterable audit-log query, joined to the actor's email. Read-only. */
export async function queryAuditLogs(filter: AuditFilter): Promise<AuditRow[]> {
  const where = buildWhere(filter);
  return db
    .select({
      id: auditLogs.id,
      createdAt: auditLogs.createdAt,
      actorEmail: users.email,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      payload: auditLogs.payload,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(Math.min(filter.limit ?? 200, 5000));
}

export function toCsv(rows: AuditRow[]): string {
  const header = ['id', 'created_at', 'actor_email', 'action', 'target_type', 'target_id', 'payload'];
  const escape = (v: string): string =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = rows.map((r) =>
    [
      r.id,
      r.createdAt.toISOString(),
      r.actorEmail ?? '',
      r.action,
      r.targetType ?? '',
      r.targetId ?? '',
      r.payload === null || r.payload === undefined ? '' : JSON.stringify(r.payload),
    ]
      .map((c) => escape(String(c)))
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}
