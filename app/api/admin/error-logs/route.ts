// ============================================================
// GET /api/admin/error-logs
// ------------------------------------------------------------
// Endpoint super-admin pour consulter les erreurs serveur captu-
// rees dans la table error_logs. Retourne les N dernieres entrees
// avec filtres optionnels par severite et source.
//
// Auth : super-admin Prelude uniquement. Sinon 403.
//
// Query params :
//   ?severity=error|warning|info  (filtre)
//   ?source=pipeline.team         (filtre par prefixe source)
//   ?limit=100                    (defaut 100, max 500)
//   ?since=2026-05-01             (filtre temporel optionnel)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = await isSuperAdmin(user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const severity = searchParams.get('severity');
  const source = searchParams.get('source');
  const since = searchParams.get('since');
  const limitRaw = searchParams.get('limit');
  const limit = Math.min(500, Math.max(1, parseInt(limitRaw || '100', 10) || 100));

  const admin = getSupabaseAdminClient();
  let query = admin
    .from('error_logs')
    .select('id, occurred_at, severity, source, message, context, organization_id, user_id, analysis_id')
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (severity && ['error', 'warning', 'info'].includes(severity)) {
    query = query.eq('severity', severity);
  }
  if (source) {
    query = query.like('source', `${source}%`);
  }
  if (since) {
    query = query.gte('occurred_at', since);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Stats agregees pour le dashboard : compte par severite et par
  // source sur la fenetre filtree.
  const bySeverity: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  for (const row of (data || [])) {
    bySeverity[row.severity] = (bySeverity[row.severity] || 0) + 1;
    bySource[row.source] = (bySource[row.source] || 0) + 1;
  }

  return NextResponse.json({
    logs: data || [],
    stats: {
      total: (data || []).length,
      bySeverity,
      bySource,
    },
  });
}
