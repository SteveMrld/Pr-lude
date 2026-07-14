// Batch 5. Cible unique : Odalys (9ad9e7be) en proxy positif.
// Phase 1 lecture seule stricte, phase 2 ecriture si verte, phase 3
// controle calibration, phase 4 report consolide.
// Meme contrat que _seed-batch4-outcomes.ts.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
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
const OBSERVED_AT = new Date().toISOString().slice(0, 10);
const APPLY = process.argv.includes('--apply');

const TARGETS: {
  idPrefix: string;
  label: string;
  outcome: MarketOutcome;
  source: string;
  sourceNotes: string;
}[] = [
  {
    idPrefix: '9ad9e7be',
    label: 'Odalys',
    outcome: 'alive_thriving',
    source: 'registres-publics-presse',
    sourceNotes:
      'PROXY d etat de sante public. Societe vivante et active, acteur majeur des residences de tourisme, capital de 106 M€, comptes deposes 2024 et 2025, aucun signe de difficulte. Aucune issue de deal Weinberg confirmee a ce jour. Fiabilite MOYENNE, PROXY a remplacer par l issue reelle du deal des communication par Weinberg. Verdict Prelude gele "approfondir" (score 57). LIGNE PRIORITAIRE A REVISER quand la vraie donnee arrivera.',
  },
];

function fingerprintKey(r: any): string {
  return [
    r.stamp_commit_sha ?? 'NULL',
    r.stamp_configs_hash ?? 'NULL',
    r.stamp_engines_hash ?? 'NULL',
    r.stamp_models_hash ?? 'NULL',
  ].join('|');
}

async function main() {
  console.log('='.repeat(120));
  console.log('PHASE 1 - VERIFICATION LECTURE SEULE (batch 5 : Odalys proxy)');
  console.log('='.repeat(120));

  // Resolution des ids complets a partir des prefixes (uuid en base : range scan)
  const resolvedTargets: (typeof TARGETS[number] & { id: string })[] = [];
  for (const t of TARGETS) {
    // Fenetre uuid : [prefix + '0000...', prefix + 'ffff...']
    const prefix = t.idPrefix;
    if (!/^[0-9a-f]{8}$/i.test(prefix)) { console.error(`STOP : prefixe ${prefix} non conforme (attendu 8 hex)`); process.exit(1); }
    const lo = `${prefix}-0000-0000-0000-000000000000`;
    const hi = `${prefix}-ffff-ffff-ffff-ffffffffffff`;
    const { data: candidates, error } = await supabase
      .from('analyses')
      .select('id, company_name')
      .gte('id', lo)
      .lte('id', hi);
    if (error) { console.error(`STOP : requete analyses pour prefixe ${prefix} : ${error.message}`); process.exit(1); }
    if (!candidates || candidates.length === 0) { console.error(`STOP : aucune analyse trouvee pour prefixe ${prefix}`); process.exit(1); }
    if (candidates.length > 1) {
      console.error(`STOP : ${candidates.length} analyses trouvees pour prefixe ${prefix} :`);
      for (const c of candidates) console.error(`   ${c.id}  ${c.company_name}`);
      process.exit(1);
    }
    resolvedTargets.push({ ...t, id: candidates[0].id });
    console.log(`  Prefixe ${prefix} -> id complet ${candidates[0].id}  (${candidates[0].company_name})`);
  }

  // Etape 1 : canary CHECK v2
  console.log('\n--- ETAPE 1 : canary INSERT avec analysis_id fictif ---');
  const CANARY_ID = '00000000-0000-0000-0000-000000000042';
  const CANARY_USER = '00000000-0000-0000-0000-000000000042';
  const { data: canaryData, error: canaryErr } = await supabase
    .from('analysis_outcomes')
    .insert({
      analysis_id: CANARY_ID,
      user_id: CANARY_USER,
      market_outcome: 'alive_thriving',
      observed_at: OBSERVED_AT,
      source: 'canary-migration-check',
    })
    .select('id')
    .maybeSingle();

  let migrationApplied = false;
  if (canaryErr) {
    const msg = (canaryErr.message || '').toLowerCase();
    const code = (canaryErr as any).code || '';
    console.log(`  Code erreur : ${code}  Message : ${canaryErr.message}`);
    if (msg.includes('check constraint') || code === '23514') {
      console.log('  -> CHECK v1 detectee, alive_thriving REJETE. Migration NON appliquee.');
      migrationApplied = false;
    } else if (msg.includes('foreign key') || msg.includes('violates foreign key') || code === '23503') {
      console.log('  -> FK violation, CHECK v2 a laisse passer alive_thriving. Migration APPLIQUEE.');
      migrationApplied = true;
    } else {
      console.log('  -> Erreur ambigue, phase 2 stoppee.');
      process.exit(2);
    }
  } else if (canaryData) {
    console.log('  -> INSERT reussi contre toute attente. Nettoyage immediat.');
    await supabase.from('analysis_outcomes').delete().eq('id', canaryData.id);
    migrationApplied = true;
  }

  if (!migrationApplied) {
    console.error('\nSTOP : migration de taxonomie non appliquee. Phase 2 refusee.');
    process.exit(2);
  }

  // Etape 2 : provenance + prediction_record + fingerprint
  console.log('\n--- ETAPE 2 : provenance et fingerprint de chaque cible ---');
  const analyses: Record<string, any> = {};
  const preds: Record<string, any> = {};
  const fps: Record<string, string> = {};
  const existingOutcomes: Record<string, any> = {};

  for (const t of resolvedTargets) {
    const { data: aRow, error: aErr } = await supabase
      .from('analyses')
      .select('id, company_name, user_id, verdict, global_score, status, created_at, completed_at, source_filename')
      .eq('id', t.id)
      .single();
    if (aErr || !aRow) { console.error(`STOP : analyse ${t.label} introuvable`); process.exit(1); }
    analyses[t.id] = aRow;

    const { data: pRows } = await supabase
      .from('prediction_records')
      .select('id, captured_at, verdict, global_score, success_probability, stamp_commit_sha, stamp_configs_hash, stamp_engines_hash, stamp_models_hash, schema_version')
      .eq('analysis_id', t.id)
      .order('captured_at', { ascending: false });
    if (!pRows || pRows.length === 0) { console.error(`STOP : prediction_record manquant pour ${t.label}`); process.exit(1); }
    preds[t.id] = pRows[0];
    fps[t.id] = fingerprintKey(pRows[0]);

    const { data: oRow } = await supabase
      .from('analysis_outcomes')
      .select('id, market_outcome, source')
      .eq('analysis_id', t.id)
      .maybeSingle();
    existingOutcomes[t.id] = oRow;

    const isLegacy = pRows[0].stamp_commit_sha === LEGACY_COMMIT_SHA;
    console.log('');
    console.log(`  ${t.label} (id=${t.id})`);
    console.log(`    company_name         : ${aRow.company_name}`);
    console.log(`    verdict Prelude gele : ${aRow.verdict}   score=${aRow.global_score}`);
    console.log(`    source_filename      : ${aRow.source_filename}`);
    console.log(`    date d instruction   : ${aRow.created_at}`);
    console.log(`    completed_at         : ${aRow.completed_at}`);
    console.log(`    prediction_record    : id=${pRows[0].id}  captured_at=${pRows[0].captured_at}`);
    console.log(`    success_probability  : ${pRows[0].success_probability}   predicted=${(pRows[0].success_probability / 100).toFixed(4)}`);
    console.log(`    stamp                : ${isLegacy ? 'LEGACY' : 'COURANT'}  commit=${pRows[0].stamp_commit_sha?.slice(0, 12)}  schema=${pRows[0].schema_version}`);
    console.log(`    fingerprint segment  : ${fps[t.id].slice(0, 90)}`);
    console.log(`    outcome pre-existant : ${existingOutcomes[t.id] ? `[${existingOutcomes[t.id].market_outcome} source=${existingOutcomes[t.id].source}]` : 'aucun'}`);
  }

  // Verrou : phase 1 verte seulement si aucun outcome reel pre-existant
  const anyConflict = resolvedTargets.some(t => existingOutcomes[t.id] && existingOutcomes[t.id].source !== ILLUSTRATIVE_SOURCE);
  if (anyConflict) { console.error('\nSTOP : outcome reel pre-existant, phase 2 refusee.'); process.exit(2); }

  console.log('\n  [OK] Phase 1 verte : CHECK v2, provenance validee, aucun outcome reel pre-existant.');

  if (!APPLY) {
    console.log('\n  Payloads a upserter (observed_at=' + OBSERVED_AT + ') :');
    for (const t of resolvedTargets) {
      const a = analyses[t.id];
      console.log('');
      console.log(`    ${t.label}`);
      console.log(`      analysis_id    = ${t.id}`);
      console.log(`      user_id        = ${a.user_id}`);
      console.log(`      market_outcome = ${t.outcome}   observed=${marketOutcomeToBinary(t.outcome)}`);
      console.log(`      source         = ${t.source}`);
      console.log(`      source_notes   = ${t.sourceNotes}`);
    }
    console.log('\nDry-run, aucune ecriture. Relancer --apply pour phase 2.');
    return;
  }

  // PHASE 2 : upsert
  console.log('\n' + '='.repeat(120));
  console.log('PHASE 2 - SAISIE (batch 5 : Odalys proxy)');
  console.log('='.repeat(120));
  const written: any[] = [];
  for (const t of resolvedTargets) {
    const a = analyses[t.id];
    const payload = {
      analysis_id: t.id,
      user_id: a.user_id,
      market_outcome: t.outcome,
      observed_at: OBSERVED_AT,
      source: t.source,
      source_url: null,
      source_notes: t.sourceNotes,
    };
    const { data, error } = await supabase
      .from('analysis_outcomes')
      .upsert(payload, { onConflict: 'analysis_id' })
      .select('*')
      .single();
    if (error) { console.error(`  [ECHEC] ${t.label} : ${error.message}`); process.exit(1); }
    written.push({ label: t.label, target: t, row: data });
    console.log(`  [OK] ${t.label} : id=${data.id}  outcome=${data.market_outcome}  observed=${marketOutcomeToBinary(data.market_outcome as MarketOutcome)}  segment=${fps[t.id].slice(0, 20)}...`);
  }

  // Recap segments par cible
  console.log('\n--- Segment par cible ---');
  for (const w of written) {
    const p = preds[w.target.id];
    const kind = p.stamp_commit_sha === LEGACY_COMMIT_SHA ? 'LEGACY' : 'COURANT';
    console.log(`  ${w.label.padEnd(15)} : segment ${kind}  (${p.stamp_commit_sha?.slice(0, 12) ?? 'NULL'})`);
  }

  // PHASE 3 : controle post-saisie
  console.log('\n' + '='.repeat(120));
  console.log('PHASE 3 - CONTROLE POST-SAISIE (lecture seule)');
  console.log('='.repeat(120));

  const [{ data: predsAll }, { data: outcomesAll }] = await Promise.all([
    supabase.from('prediction_records').select('*').order('captured_at', { ascending: false }),
    supabase.from('analysis_outcomes').select('*'),
  ]);
  const latestPerAnalysis = new Map<string, any>();
  for (const r of predsAll || []) {
    if (!latestPerAnalysis.has(r.analysis_id)) latestPerAnalysis.set(r.analysis_id, r);
  }
  const outcomeByAnalysis = new Map<string, any>();
  for (const o of outcomesAll || []) outcomeByAnalysis.set(o.analysis_id, o);

  const inputs: CalibrationInputMaybeResolved[] = [];
  for (const rec of Array.from(latestPerAnalysis.values())) {
    if (rec.success_probability === null || rec.success_probability === undefined) continue;
    const outcomeRow = outcomeByAnalysis.get(rec.analysis_id);
    let observed: 0 | 1 | null = null;
    if (outcomeRow && outcomeRow.source !== ILLUSTRATIVE_SOURCE) {
      observed = marketOutcomeToBinary(outcomeRow.market_outcome as MarketOutcome);
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

  console.log('');
  console.log(`  totalResolved       : ${report.totalResolved}`);
  console.log(`  totalUnresolved     : ${report.totalUnresolved}`);
  console.log(`  minResolvedPerSeg   : ${report.minResolvedPerSegment}`);
  console.log(`  anyCalibrable       : ${report.anyCalibrable}`);
  console.log(`  segments detectes   : ${report.segments.length}`);
  for (const s of report.segments) {
    if (s.calibrable === true) {
      console.log(`    segment ${s.segmentKey.commitSha?.slice(0, 12) ?? 'NULL'} : calibrable=OUI count=${s.resolvedCount} brier=${s.brier.toFixed(4)}`);
    } else if (s.calibrable === false) {
      const gap = s.requiredCount - s.resolvedCount;
      console.log(`    segment ${s.segmentKey.commitSha?.slice(0, 12) ?? 'NULL'} : calibrable=NON count=${s.resolvedCount}/${s.requiredCount} (ecart=${gap})`);
    }
  }

  // Repartition par classe
  const realOutcomes = (outcomesAll || []).filter(o => o.source !== ILLUSTRATIVE_SOURCE);
  const counts: Record<string, number> = { exit: 0, alive_thriving: 0, fail: 0, alive_flat: 0, alive: 0, flat: 0 };
  for (const o of realOutcomes) counts[o.market_outcome] = (counts[o.market_outcome] || 0) + 1;
  const positifs = counts.exit + counts.alive_thriving;
  const negatifs = counts.fail;
  const neutres = counts.alive_flat + counts.alive + counts.flat;
  console.log('');
  console.log(`  Repartition sur outcomes reels (tous segments) :`);
  console.log(`    positifs observed=1 : ${positifs}   (exit=${counts.exit} + alive_thriving=${counts.alive_thriving})`);
  console.log(`    negatifs observed=0 : ${negatifs}   (fail=${counts.fail})`);
  console.log(`    neutres observed=null : ${neutres}   (alive_flat=${counts.alive_flat} + alive=${counts.alive} + flat=${counts.flat})`);

  // Repartition par segment
  console.log('');
  console.log(`  Repartition par segment (observed=0/1 sur les resolus discriminants) :`);
  const segCounts = new Map<string, { pos: number; neg: number; neu: number; label: string }>();
  for (const o of realOutcomes) {
    const rec = latestPerAnalysis.get(o.analysis_id);
    if (!rec) continue;
    const fp = fingerprintKey(rec);
    const label = rec.stamp_commit_sha === LEGACY_COMMIT_SHA ? 'legacy-pre-a259c0d' : (rec.stamp_commit_sha?.slice(0, 12) ?? 'NULL');
    let bucket = segCounts.get(fp);
    if (!bucket) { bucket = { pos: 0, neg: 0, neu: 0, label }; segCounts.set(fp, bucket); }
    const bin = marketOutcomeToBinary(o.market_outcome as MarketOutcome);
    if (bin === 1) bucket.pos++;
    else if (bin === 0) bucket.neg++;
    else bucket.neu++;
  }
  for (const [fp, b] of Array.from(segCounts.entries())) {
    const total = b.pos + b.neg + b.neu;
    const disc = b.pos + b.neg;
    const gap = Math.max(0, 10 - disc);
    console.log(`    segment ${b.label.padEnd(24)} : positifs=${b.pos}, negatifs=${b.neg}, neutres=${b.neu} (total=${total}, discriminants=${disc}, ecart au seuil=${gap})`);
  }

  console.log('');
  console.log(`  Aucune metrique produite tant que anyCalibrable=${report.anyCalibrable} et qu aucun segment ne franchit le seuil.`);
  console.log('  Comportement honnete attendu.');

  // PHASE 4 : rapport consolide
  console.log('\n' + '='.repeat(120));
  console.log('PHASE 4 - REPORT CONSOLIDE');
  console.log('='.repeat(120));
  console.log(`  Toutes les issues reelles en base apres cette saisie (${realOutcomes.length} lignes) :`);
  console.log('');
  console.log('  dossier                | state          | observed | source                        | segment');
  console.log('  ' + '-'.repeat(120));
  const enriched = realOutcomes.map(o => {
    const rec = latestPerAnalysis.get(o.analysis_id);
    const seg = rec?.stamp_commit_sha === LEGACY_COMMIT_SHA ? 'legacy' : (rec?.stamp_commit_sha?.slice(0, 12) ?? 'null');
    const aRow = analyses[o.analysis_id];
    return { o, rec, seg, aRow };
  });
  const missing = enriched.filter(e => !e.aRow).map(e => e.o.analysis_id);
  if (missing.length > 0) {
    const { data: extra } = await supabase.from('analyses').select('id, company_name').in('id', missing);
    const extraMap = new Map<string, string>();
    for (const r of extra || []) extraMap.set(r.id, r.company_name);
    for (const e of enriched) {
      if (!e.aRow) e.aRow = { company_name: extraMap.get(e.o.analysis_id) || '(?)' };
    }
  }
  enriched.sort((x, y) => {
    if (x.seg !== y.seg) return x.seg.localeCompare(y.seg);
    const bx = marketOutcomeToBinary(x.o.market_outcome as MarketOutcome);
    const by = marketOutcomeToBinary(y.o.market_outcome as MarketOutcome);
    const kx = bx === null ? 2 : bx;
    const ky = by === null ? 2 : by;
    if (kx !== ky) return kx - ky;
    return (x.aRow?.company_name || '').localeCompare(y.aRow?.company_name || '');
  });
  for (const e of enriched) {
    const bin = marketOutcomeToBinary(e.o.market_outcome as MarketOutcome);
    const obs = bin === null ? 'null' : String(bin);
    const name = (e.aRow?.company_name || '(?)').padEnd(22);
    const state = e.o.market_outcome.padEnd(14);
    const src = (e.o.source || '').padEnd(29);
    console.log(`  ${name} | ${state} | ${obs.padEnd(8)} | ${src} | ${e.seg}`);
  }

  // Compte net
  const courantSeg = Array.from(segCounts.values()).find(b => b.label !== 'legacy-pre-a259c0d');
  console.log('');
  if (courantSeg) {
    const disc = courantSeg.pos + courantSeg.neg;
    const gap = Math.max(0, 10 - disc);
    console.log(`  Compte net sur segment COURANT (${report.segments.find(s => s.segmentKey.commitSha && s.segmentKey.commitSha !== LEGACY_COMMIT_SHA)?.segmentKey.commitSha?.slice(0, 12)}) :`);
    console.log(`    resolus discriminants : ${disc} / 10`);
    console.log(`    positifs (observed=1) : ${courantSeg.pos}`);
    console.log(`    negatifs (observed=0) : ${courantSeg.neg}`);
    console.log(`    neutres (exclus)      : ${courantSeg.neu}`);
    console.log(`    ecart au seuil        : ${gap}`);
  }

  console.log('');
  console.log(`  Cloture. totalResolved=${report.totalResolved}, ${report.segments.length} segments, aucune metrique produite tant que sous seuil.`);
}
main().catch(e => { console.error(e); process.exit(1); });
