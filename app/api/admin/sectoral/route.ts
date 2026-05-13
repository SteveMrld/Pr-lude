// ============================================================
// GET /api/admin/sectoral
// ------------------------------------------------------------
// Endpoint super-admin pour la cartographie sectorielle. Retourne
// la liste des 13 secteurs catalogues avec, pour chacun, la
// derniere fiche generee (ou null si jamais generee), plus un log
// de regenerations recentes (les N dernieres briefs cross-secteur,
// triees par generated_at desc).
//
// Auth : super-admin Prelude uniquement. Sinon 403.
//
// Query params :
//   ?logLimit=20  (defaut 20, max 100) - taille du log recent
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isSuperAdmin } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import {
  SECTORS,
  DIMENSION_KEYS,
  type SectoralBrief,
  type DimensionKey,
} from '@/lib/engines/sectoral-intelligence';
import {
  briefToSectorRow,
  emptySectorRow,
  countSourcesInDimensions,
  type SectorRow,
} from '@/lib/engines/sectoral-intelligence/admin-flow';

export const dynamic = 'force-dynamic';

interface LogEntry {
  brief_id: string;
  sector_slug: string;
  sector_label: string;
  generated_at: string;
  regeneration_trigger: string;
  dimension_model: string | null;
  aggregator_model: string | null;
  cost_usd: number | null;
  duration_ms: number | null;
  dimensions_regenerated: DimensionKey[];
  total_sources_cited: number;
}

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
  const logLimitRaw = searchParams.get('logLimit');
  const logLimit = Math.min(100, Math.max(1, parseInt(logLimitRaw || '20', 10) || 20));

  const admin = getSupabaseAdminClient();

  // Vue sectoral_briefs_latest livree par le sous-chantier 1 :
  // une ligne par secteur, derniere generation. Permet d eviter
  // un scan complet de la table a chaque chargement de la page.
  const { data: latestRows, error: latestErr } = await admin
    .from('sectoral_briefs_latest')
    .select('*');
  if (latestErr) {
    return NextResponse.json({ error: latestErr.message }, { status: 500 });
  }

  // Index par sector_slug pour assemblage en O(1) cote applicatif.
  const latestBySlug = new Map<string, any>();
  for (const row of latestRows || []) {
    latestBySlug.set(row.sector_slug, row);
  }

  const now = new Date();
  const sectors: SectorRow[] = SECTORS.map((sector) => {
    const row = latestBySlug.get(sector.slug);
    if (!row) {
      return emptySectorRow(sector);
    }
    const brief = rowToBrief(row);
    return briefToSectorRow(sector, brief, now);
  });

  // Log recent : les N derniers briefs cross-secteur. La page
  // admin l affiche en bas comme un journal d activite.
  const { data: logRows, error: logErr } = await admin
    .from('sectoral_briefs')
    .select('id, sector_slug, generated_at, regeneration_trigger, generation_metadata, dimensions')
    .order('generated_at', { ascending: false })
    .limit(logLimit);

  if (logErr) {
    return NextResponse.json({ error: logErr.message }, { status: 500 });
  }

  const log: LogEntry[] = (logRows || []).map((row) => {
    const meta = (row.generation_metadata || {}) as Record<string, any>;
    const sector = SECTORS.find((s) => s.slug === row.sector_slug);
    const totalSources = countSourcesInDimensions(row.dimensions || {});
    return {
      brief_id: row.id,
      sector_slug: row.sector_slug,
      sector_label: sector?.label ?? row.sector_slug,
      generated_at: row.generated_at,
      regeneration_trigger: row.regeneration_trigger,
      dimension_model: typeof meta.dimension_model === 'string' ? meta.dimension_model : null,
      aggregator_model: typeof meta.aggregator_model === 'string' ? meta.aggregator_model : null,
      cost_usd: typeof meta.cost_usd === 'number' ? meta.cost_usd : null,
      duration_ms: typeof meta.duration_ms === 'number' ? meta.duration_ms : null,
      dimensions_regenerated: Array.isArray(meta.dimensions_regenerated)
        ? (meta.dimensions_regenerated as DimensionKey[])
        : ([...DIMENSION_KEYS] as DimensionKey[]),
      total_sources_cited: totalSources,
    };
  });

  return NextResponse.json({
    sectors,
    log,
    generated_at: now.toISOString(),
  });
}

// ------------------------------------------------------------
// HELPER LOCAL : sectoral_briefs row -> SectoralBrief
// ------------------------------------------------------------

function rowToBrief(row: any): SectoralBrief {
  return {
    id: row.id,
    sector_slug: row.sector_slug,
    generated_at: row.generated_at,
    dimensions: row.dimensions,
    narrative_summary: row.narrative_summary,
    regeneration_trigger: row.regeneration_trigger,
    supersedes_id: row.supersedes_id,
    generation_metadata: row.generation_metadata,
  };
}
