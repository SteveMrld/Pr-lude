// ============================================================
// PRELUDE - Utils pures du runner detection milestones
// ------------------------------------------------------------
// Helpers purs sans dependance Supabase ni Anthropic. Extraits du
// runner pour permettre des tests deterministes (le runner lui-meme
// importe reconciliation-store qui declare 'server-only', ce qui
// casse tsx en standalone).
// ============================================================

import type { MilestoneType, MilestoneImpact, ThesisAlignment } from '@/lib/reconciliation-store';

const VALID_TYPES: MilestoneType[] = [
  'fundraise', 'pivot', 'team_change', 'revenue_update', 'metric_update',
  'churn', 'partnership', 'product_launch', 'regulatory', 'legal',
  'macro_shock', 'exit', 'fail', 'other',
];

const VALID_ALIGNMENTS: ThesisAlignment[] = [
  'confirms_driver', 'confirms_risk',
  'contradicts_driver', 'contradicts_risk',
  'unforeseen_positive', 'unforeseen_negative',
];

const VALID_IMPACTS: MilestoneImpact[] = ['positive', 'negative', 'neutral', 'mixed'];

export interface DetectedEvent {
  date: string;
  type: MilestoneType;
  title: string;
  description: string;
  impact: MilestoneImpact | null;
  thesisAlignment: ThesisAlignment | null;
  sourceUrl: string | null;
}

export function parseDetectedEvents(raw: string): DetectedEvent[] {
  // Tolerance : on extrait le premier [...] si le LLM emet du bruit
  // autour. Pas de regex permissive sur le contenu lui-meme, on laisse
  // JSON.parse trancher.
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  let parsed: any;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: DetectedEvent[] = [];
  for (const ev of parsed) {
    if (!ev || typeof ev !== 'object') continue;
    if (typeof ev.title !== 'string' || ev.title.trim().length === 0) continue;
    if (typeof ev.date !== 'string' || Number.isNaN(Date.parse(ev.date))) continue;
    const type = VALID_TYPES.includes(ev.type) ? ev.type : 'other';
    const impact = VALID_IMPACTS.includes(ev.impact) ? ev.impact : null;
    const align = VALID_ALIGNMENTS.includes(ev.thesisAlignment) ? ev.thesisAlignment : null;
    const sourceUrl = typeof ev.sourceUrl === 'string' && ev.sourceUrl.startsWith('http')
      ? ev.sourceUrl : null;
    out.push({
      date: ev.date.slice(0, 10),
      type,
      title: ev.title.trim().slice(0, 200),
      description: typeof ev.description === 'string' ? ev.description.trim().slice(0, 2000) : '',
      impact,
      thesisAlignment: align,
      sourceUrl,
    });
  }
  return out;
}

/**
 * Normalise un titre pour la deduplication. Minuscule, sans accents,
 * sans ponctuation, espaces collapses. Permet de reperer les
 * paraphrases proches.
 */
export function normalizeForDedup(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Filtre la liste detectee contre les milestones deja en base
 * (confirmed ou proposed). Une candidate est rejetee si :
 *   - source_url match exactement un existant
 *   - OU titre normalise identique a un existant ET dates a moins
 *     de 14 jours d ecart
 */
export function dedupAgainstExisting(
  detected: DetectedEvent[],
  existing: { milestoneDate: string; title: string; sourceUrl: string | null }[],
): DetectedEvent[] {
  const existingNorm = existing.map((e) => ({
    title: normalizeForDedup(e.title),
    date: Date.parse(e.milestoneDate),
    url: e.sourceUrl,
  }));
  const out: DetectedEvent[] = [];
  for (const ev of detected) {
    const evDateMs = Date.parse(ev.date);
    const evTitleNorm = normalizeForDedup(ev.title);
    const dup = existingNorm.some((e) => {
      if (ev.sourceUrl && e.url && ev.sourceUrl === e.url) return true;
      if (e.title === evTitleNorm) {
        if (!Number.isNaN(e.date) && !Number.isNaN(evDateMs)) {
          const diffDays = Math.abs(e.date - evDateMs) / (1000 * 60 * 60 * 24);
          if (diffDays < 14) return true;
        } else {
          return true;
        }
      }
      return false;
    });
    if (!dup) out.push(ev);
  }
  return out;
}
