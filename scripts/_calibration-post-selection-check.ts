// Phase 5. Lecture seule. Relance la calibration sous la regle et
// affiche l etat post bascule : totalResolved, compte discriminant
// par segment, distribution, audit complet renderAuditPlain.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import {
  applyCorpusSelectionRule,
  renderAuditPlain,
  type SelectionCandidate,
} from '../lib/calibration/corpus-selection';
import {
  computeCalibrationFromMixed,
  type CalibrationInputMaybeResolved,
} from '../lib/calibration/calibration-metrics';
import {
  type MarketOutcome,
  marketOutcomeToBinary,
} from '../lib/analysis-outcomes-taxonomy';

const env = readFileSync('/home/steve/Pr-lude/.env.local', 'utf-8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const ILLUSTRATIVE_SOURCE =
  'ILLUSTRATIF — données synthétiques de démonstration, non issues de résolutions marché réelles';
const LEGACY_COMMIT_SHA = 'legacy-pre-a259c0d';

function fp(r: any): string {
  return [
    r.stamp_commit_sha ?? 'NULL',
    r.stamp_configs_hash ?? 'NULL',
    r.stamp_engines_hash ?? 'NULL',
    r.stamp_models_hash ?? 'NULL',
  ].join('|');
}

async function main() {
  const [{ data: predsAll }, { data: outcomesAll }, { data: analysesAll }] = await Promise.all([
    supabase.from('prediction_records').select('*').order('captured_at', { ascending: false }),
    supabase.from('analysis_outcomes').select('*'),
    supabase.from('analyses').select('id, company_name'),
  ]);
  const nameById = new Map<string, string>();
  for (const a of analysesAll || []) nameById.set(a.id, a.company_name);

  const latestPerAnalysis = new Map<string, any>();
  for (const r of predsAll || []) {
    if (!latestPerAnalysis.has(r.analysis_id)) latestPerAnalysis.set(r.analysis_id, r);
  }
  const outcomeByAnalysis = new Map<string, any>();
  for (const o of outcomesAll || []) outcomeByAnalysis.set(o.analysis_id, o);

  // Construit les candidats (outcomes reels ayant un prediction_record)
  const candidates: SelectionCandidate[] = [];
  for (const rec of Array.from(latestPerAnalysis.values())) {
    const o = outcomeByAnalysis.get(rec.analysis_id);
    if (!o) continue;
    if (o.source === ILLUSTRATIVE_SOURCE) continue;
    candidates.push({
      analysisId: rec.analysis_id,
      companyName: nameById.get(rec.analysis_id) || null,
      marketOutcome: o.market_outcome as MarketOutcome,
      reliability: o.reliability ?? null,
    });
  }
  const audit = applyCorpusSelectionRule(candidates);
  const included = new Set(audit.decisions.filter(d => d.included).map(d => d.analysisId));

  // Construit les inputs de calibration en respectant la regle
  const inputs: CalibrationInputMaybeResolved[] = [];
  for (const rec of Array.from(latestPerAnalysis.values())) {
    if (rec.success_probability === null || rec.success_probability === undefined) continue;
    const o = outcomeByAnalysis.get(rec.analysis_id);
    let observed: 0 | 1 | null = null;
    if (o) {
      if (o.source === ILLUSTRATIVE_SOURCE) {
        observed = marketOutcomeToBinary(o.market_outcome as MarketOutcome);
      } else if (included.has(rec.analysis_id)) {
        observed = marketOutcomeToBinary(o.market_outcome as MarketOutcome);
      }
    }
    inputs.push({
      predicted: Math.max(0, Math.min(1, rec.success_probability / 100)),
      observed,
      stampFingerprint: {
        commitSha: rec.stamp_commit_sha ?? null,
        configsHash: rec.stamp_configs_hash ?? null,
        enginesHash: rec.stamp_engines_hash ?? null,
        modelsHash: rec.stamp_models_hash ?? null,
      },
    });
  }
  const report = computeCalibrationFromMixed(inputs);

  console.log('='.repeat(160));
  console.log('CALIBRATION POST BASCULE - regle de selection deterministe appliquee');
  console.log('='.repeat(160));
  console.log(`totalResolved       : ${report.totalResolved}`);
  console.log(`totalUnresolved     : ${report.totalUnresolved}`);
  console.log(`minResolvedPerSeg   : ${report.minResolvedPerSegment}`);
  console.log(`anyCalibrable       : ${report.anyCalibrable}`);
  console.log(`segments detectes   : ${report.segments.length}`);
  for (const s of report.segments) {
    const label = s.segmentKey.commitSha === LEGACY_COMMIT_SHA
      ? 'legacy-pre-a259c0d'
      : (s.segmentKey.commitSha?.slice(0, 12) ?? 'NULL');
    if (s.calibrable === true) {
      console.log(`  segment ${label.padEnd(24)} : calibrable=OUI count=${s.resolvedCount} brier=${s.brier.toFixed(4)}`);
    } else {
      const gap = s.requiredCount - s.resolvedCount;
      console.log(`  segment ${label.padEnd(24)} : calibrable=NON count=${s.resolvedCount}/${s.requiredCount} (ecart=${gap})`);
    }
  }

  // Compte discriminant par segment apres regle
  console.log('');
  console.log('COMPTE DISCRIMINANT PAR SEGMENT (post regle)');
  console.log('-'.repeat(160));
  const segCounts = new Map<string, { pos: number; neg: number; excluded: number; label: string }>();
  for (const rec of Array.from(latestPerAnalysis.values())) {
    const o = outcomeByAnalysis.get(rec.analysis_id);
    if (!o || o.source === ILLUSTRATIVE_SOURCE) continue;
    const key = fp(rec);
    const label = rec.stamp_commit_sha === LEGACY_COMMIT_SHA
      ? 'legacy-pre-a259c0d'
      : (rec.stamp_commit_sha?.slice(0, 12) ?? 'NULL');
    let b = segCounts.get(key);
    if (!b) { b = { pos: 0, neg: 0, excluded: 0, label }; segCounts.set(key, b); }
    if (!included.has(rec.analysis_id)) {
      b.excluded++;
    } else {
      const bin = marketOutcomeToBinary(o.market_outcome as MarketOutcome);
      if (bin === 1) b.pos++;
      else if (bin === 0) b.neg++;
    }
  }
  for (const b of Array.from(segCounts.values())) {
    const disc = b.pos + b.neg;
    const gap = Math.max(0, 10 - disc);
    console.log(`  segment ${b.label.padEnd(24)} : positifs=${b.pos} negatifs=${b.neg} discriminants=${disc} excluspars regle=${b.excluded} ecart au seuil=${gap}`);
  }

  console.log('');
  console.log(`Aucune metrique produite tant que anyCalibrable=${report.anyCalibrable}. Comportement honnete sous seuil.`);

  console.log('');
  console.log('='.repeat(160));
  console.log('AUDIT DE SELECTION (renderAuditPlain sur corpus reel)');
  console.log('='.repeat(160));
  console.log(renderAuditPlain(audit));
}
main().catch(e => { console.error(e); process.exit(1); });
