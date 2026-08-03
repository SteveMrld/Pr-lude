// ============================================================
// REJEU PARTIEL
// ------------------------------------------------------------
// Rejoue les moteurs DETERMINISTES sur le result_json deja persiste
// d une analyse, sans rappeler aucun moteur LLM, et rend une note
// complete.
//
// Ce que cela permet, pour quelques centimes et quelques secondes :
// corriger le moteur de valorisation et voir la note entiere avec la
// nouvelle fourchette ; rejouer la chaine aval deterministe d un
// moteur dont la sortie a change ; verifier un correctif sur les
// donnees reelles du dernier run persiste, ce qui est la premiere des
// regles de verification.
//
// LA FRONTIERE, ET POURQUOI L OUTIL LA REFUSE
//
// Un rejeu partiel ne peut pas dire ce qu un moteur LLM aurait rendu si
// son entree avait change. Rejouer la valorisation sur une extraction
// corrigee est exact, parce que la valorisation est une fonction. Rejouer
// la note apres avoir corrige le prompt d extraction ne l est pas : il
// faudrait rappeler le modele, et personne ne saurait qualifier le
// resultat obtenu sans le faire.
//
// L outil refuse donc explicitement de rejouer un moteur LLM plutot que
// de rendre un resultat que personne ne saurait qualifier. La frontiere
// passe entre le deterministe et le reste, et elle est declaree dans la
// sortie : un resultat reassemble porte la liste de ce qui a ete
// recalcule et de ce qui a ete repris tel quel.
//
// USAGE
//   npx tsx scripts/replay-partial.ts --analyse=<id ou motif de deck>
//   npx tsx scripts/replay-partial.ts --analyse=Woodpecker --sortie=/tmp/note.json
//   npx tsx scripts/replay-partial.ts --analyse=<id> --patch=<fichier.json>
//
// --patch remplace des sections du result_json avant recalcul. Il sert a
// verifier un correctif d extraction sans rappeler le modele : on ecrit
// a la main la sortie attendue et on regarde ce que la note en fait.
// ============================================================

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

function env(): Record<string, string> {
  const e: Record<string, string> = {};
  for (const f of ['.env', '.env.local']) {
    const p = join(process.cwd(), f);
    if (!existsSync(p)) continue;
    for (const l of readFileSync(p, 'utf-8').split('\n')) {
      const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && m[2]) e[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return e;
}
const E = env();

function arg(nom: string, defaut = ''): string {
  const a = process.argv.find((x) => x.startsWith(`--${nom}=`));
  return a ? a.slice(nom.length + 3) : defaut;
}

async function sql(q: string): Promise<any[]> {
  const ref = (E.SUPABASE_URL || E.NEXT_PUBLIC_SUPABASE_URL).match(/^https:\/\/([a-z0-9]+)\./)![1];
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${E.SUPABASE_PAT}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: q }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${t.slice(0, 200)}`);
  return JSON.parse(t);
}

/**
 * Moteurs appelant le modele. Les nommer sert a refuser leur rejeu, pas
 * a l organiser : la liste est la frontiere, elle n est pas une file
 * d attente.
 */
export const MOTEURS_LLM = [
  'extraction', 'financialData', 'team', 'market', 'macro', 'preScan',
  'patternMatching', 'causalReversal', 'blindspotAnalysis', 'contrarianAnalysis',
  'financialCoherence', 'narrativeDrift', 'referenceChecks', 'executionFriction',
  'techClaimCoherence', 'saasMetrics', 'industrialMetrics', 'ddFinancial',
  'ddTechnical', 'ddContractual', 'ledgerExtraction', 'capTableExtraction',
  'fragiliteStructurelle', 'finalRecommendation',
] as const;

/** Moteurs rejouables, dans leur ordre de dependance. */
export const MOTEURS_DETERMINISTES = [
  'relevanceMatrix', 'operationValidity', 'benchmarks',
  'mechanicalScore', 'valuation', 'indicators',
] as const;

export interface RejeuTrace {
  recalcules: string[];
  reprisTelQuel: string[];
  refuses: string[];
  rejoueLe: string;
}

/**
 * Reassemble un result_json en recalculant les seuls moteurs
 * deterministes. Pure : ne lit ni la base ni le reseau.
 */
export async function reassembler(
  source: any,
  demandes: string[] | null,
): Promise<{ resultat: any; trace: RejeuTrace }> {
  const r = JSON.parse(JSON.stringify(source));
  const refuses = (demandes ?? []).filter((m) => (MOTEURS_LLM as readonly string[]).includes(m));
  if (refuses.length > 0) {
    throw new Error(
      `Rejeu refuse pour ${refuses.join(', ')}. Ces moteurs appellent le modele : un rejeu partiel ne peut pas dire ce qu ils auraient rendu si leur entree avait change. `
      + `Corrigez leur sortie a la main avec --patch, ou lancez un run complet.`,
    );
  }
  const aRejouer = (demandes && demandes.length > 0)
    ? MOTEURS_DETERMINISTES.filter((m) => demandes.includes(m))
    : [...MOTEURS_DETERMINISTES];

  const { computeRelevanceMatrix } = await import('../lib/engines/relevance-matrix');
  const { normalizeAssetClass } = await import('../lib/data/sector-benchmarks');
  const { computeValuation } = await import('../lib/engines/valuation-engine');
  const { computeIndicators } = await import('../lib/engines/indicators-engine');
  const { computeMechanicalScore } = await import('../lib/engines/score-calculator');
  const { analyzeBenchmarks } = await import('../lib/engines/benchmark-engine');
  const { evaluerValiditeOperation, detecterEvenementsDansLaProse, collecterProse } =
    await import('../lib/engines/operation-validity');

  const ext = r.extraction;
  if (!ext) throw new Error('result_json sans extraction : rien a recalculer.');

  if (aRejouer.includes('relevanceMatrix')) {
    r.relevanceMatrix = computeRelevanceMatrix(
      ext,
      normalizeAssetClass(`${ext.sector || ''} ${ext.subSector || ''}`.trim()),
    );
  }
  if (aRejouer.includes('operationValidity')) {
    const evenements = detecterEvenementsDansLaProse([
      ...collecterProse(r.team),
      ...collecterProse(r.fragiliteStructurelle),
      ...collecterProse(r.narrativeDrift),
    ]);
    r.operationValidity = evaluerValiditeOperation({
      operationType: ext?.fundraise?.operationType ?? null,
      operationComponents: ext?.fundraise?.operationComponents ?? null,
      documentDate: ext?.documentDate ?? null,
      millesimeReference: r.financialData?.lastActualYear ?? null,
      evenements,
    });
  }
  if (aRejouer.includes('benchmarks')) {
    r.benchmarks = await analyzeBenchmarks(ext, r.financialData ?? null);
  }
  if (aRejouer.includes('mechanicalScore')) {
    r.mechanicalScore = computeMechanicalScore({
      team: r.team, market: r.market, macro: r.macro,
      financial: r.financialCoherence, contrarian: r.contrarianAnalysis,
      blindspot: r.blindspotAnalysis,
      engineStatuses: r.meta?.engineStatuses ?? null,
    });
  }
  if (aRejouer.includes('valuation')) {
    r.valuation = computeValuation({
      extraction: ext,
      financial: r.financialCoherence,
      financialData: r.financialData,
      team: r.team, market: r.market,
      teamScore: r.mechanicalScore?.dimensions?.team?.score ?? 50,
      marketScore: r.mechanicalScore?.dimensions?.market?.score ?? 50,
      relevanceMatrix: r.relevanceMatrix,
      operationType: ext?.fundraise?.operationType ?? null,
      operationComponents: ext?.fundraise?.operationComponents ?? null,
      operationValidity: r.operationValidity ?? null,
      asOf: r.meta?.asOf ?? null,
      asOfSource: r.meta?.asOfSource ?? null,
    } as any);
  }
  if (aRejouer.includes('indicators')) {
    r.indicators = computeIndicators({
      extraction: ext,
      financialData: r.financialData,
      saasMetrics: r.saasMetrics,
      relevanceMatrix: r.relevanceMatrix,
    } as any);
  }

  const trace: RejeuTrace = {
    recalcules: aRejouer,
    reprisTelQuel: Object.keys(r).filter((k) => k !== 'meta' && !aRejouer.includes(k as any)),
    refuses: [],
    rejoueLe: 'stamp-non-rejoue',
  };
  // La trace vit dans le resultat : une note reassemblee doit dire
  // qu elle l est, et laquelle de ses sections vient du run d origine.
  r.meta = { ...(r.meta ?? {}), rejeuPartiel: trace };
  return { resultat: r, trace };
}

(async () => {
  if (process.argv[1] && !process.argv[1].endsWith('replay-partial.ts')) return;
  const cible = arg('analyse');
  if (!cible) {
    console.error('Usage : --analyse=<id ou motif de deck> [--moteurs=a,b] [--patch=f.json] [--sortie=f.json]');
    process.exit(1);
  }
  const estId = /^[0-9a-f-]{36}$/i.test(cible);
  const [row] = await sql(estId
    ? `select id, source_filename, result_json::text as j from public.analyses where id = '${cible}';`
    : `select id, source_filename, result_json::text as j from public.analyses
       where source_filename ilike '%${cible.replace(/'/g, "''")}%' and result_json is not null
       order by created_at desc limit 1;`);
  if (!row) { console.error('Aucune analyse trouvee.'); process.exit(1); }

  let source = JSON.parse(row.j);
  const patch = arg('patch');
  if (patch) {
    const p = JSON.parse(readFileSync(patch, 'utf-8'));
    source = { ...source, ...p };
    console.log(`Patch applique sur : ${Object.keys(p).join(', ')}`);
  }

  const moteurs = arg('moteurs');
  const demandes = moteurs ? moteurs.split(',').map((x) => x.trim()).filter(Boolean) : null;

  console.log(`Analyse ${String(row.id).slice(0, 8)} — ${row.source_filename}`);
  const t0 = Date.now();
  let resultat: any, trace: RejeuTrace;
  try {
    ({ resultat, trace } = await reassembler(source, demandes));
  } catch (e: any) {
    // Le refus de franchir la frontiere n est pas une panne : il se dit
    // en clair et sort proprement.
    console.error(`\nREJEU REFUSE\n${e.message}`);
    process.exit(2);
  }
  console.log(`\nRecalcules : ${trace.recalcules.join(', ')}`);
  console.log(`Repris tel quel : ${trace.reprisTelQuel.length} sections`);
  console.log(`Duree : ${Date.now() - t0} ms, zero appel au modele.\n`);

  const v = resultat.valuation;
  if (v) {
    console.log(`valorisation : ${(v.ranges ?? []).map((x: any) => `${x.nature} ${Math.round(x.min / 1e6)}-${Math.round(x.max / 1e6)} M`).join(' | ') || 'aucune'}`);
    console.log(`  classe=${v.assetClass} stade=${v.stage} recommandee=${v.recommendedRange ? 'oui' : 'non'}${v.priceRefusedCause ? ' (prix refuse)' : ''}`);
  }
  if (resultat.operationValidity) {
    const o = resultat.operationValidity;
    console.log(`validite : ${o.verdict}${o.mention ? ' — ' + o.mention.slice(0, 110) : ''}`);
  }
  if (resultat.relevanceMatrix) {
    console.log(`matrice : classe=${resultat.relevanceMatrix.assetClass} chaine=${resultat.relevanceMatrix.productionChain} arbitrage=${resultat.relevanceMatrix.assetClassArbitration ? 'trace' : 'aucun'}`);
  }

  const sortie = arg('sortie', join(process.cwd(), 'scripts', 'audit-output', `rejeu-${String(row.id).slice(0, 8)}.json`));
  writeFileSync(sortie, JSON.stringify(resultat, null, 2));
  console.log(`\nNote reassemblee : ${sortie}`);
})();
