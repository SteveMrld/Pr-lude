// ============================================================
// STABILITE D UN MOTEUR ISOLE
// ------------------------------------------------------------
// Rejoue UN moteur N fois sur un deck du Storage et rend la
// dispersion de ses sorties, champ par champ.
//
// Pourquoi un outil de plus alors que reproducibility-harness existe :
// celui-la extrait une fois puis reutilise la meme extraction sur les
// N passes, donc il ne peut pas mesurer la stabilite de l extraction,
// qui est precisement la question posee. Il rejoue aussi huit moteurs
// par passe pour ne rendre que six scores de dimension, ce qui coute
// environ un dollar par passe et melange la variance du moteur mesure
// a celle de tous les autres. Les deux outils ne repondent pas a la
// meme question : le sien mesure la variance d un verdict, celui-ci
// mesure la variance d un moteur.
//
// Regle de la discipline de verification : la stabilite se mesure
// moteur par moteur, hors ligne, jamais par le pipeline complet.
//
// USAGE
//   npx tsx scripts/engine-stability.ts --deck=<motif> --engine=<nom> [--passes=3]
//   npx tsx scripts/engine-stability.ts --deck=Woodpecker --engine=extraction --passes=3
//
// Le motif de deck est cherche dans les noms de fichiers des analyses
// persistees ; le PDF est telecharge depuis le Storage.
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
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
process.env.ANTHROPIC_API_KEY = E.ANTHROPIC_API_KEY;

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

async function chargerDeck(motif: string): Promise<{ nom: string; b64: string }> {
  const [d] = await sql(`
    select source_filename, (uploaded_files -> 0 ->> 'storagePath') as chemin
    from public.analyses
    where source_filename ilike '%${motif.replace(/'/g, "''")}%'
      and jsonb_array_length(coalesce(uploaded_files, '[]'::jsonb)) > 0
    order by created_at desc limit 1;
  `);
  if (!d) throw new Error(`aucun deck ne correspond a « ${motif} »`);
  const url = E.NEXT_PUBLIC_SUPABASE_URL || E.SUPABASE_URL;
  const key = E.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${url}/storage/v1/object/dossier-uploads/${d.chemin}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error(`Storage HTTP ${r.status}`);
  return { nom: d.source_filename, b64: Buffer.from(await r.arrayBuffer()).toString('base64') };
}

/**
 * Chemins observes par moteur. On ne compare pas la sortie entiere :
 * une prose ne se compare pas, et sa variance noierait celle des
 * champs qui commandent le pipeline. Ce sont ces champs qu on suit.
 */
const CHAMPS: Record<string, string[]> = {
  extraction: [
    'sector', 'subSector', 'country', 'documentDate',
    'fundraise.operationType', 'fundraise.stage', 'fundraise.amount',
    'fundraise.seller', 'fundraise.stakeForSale',
    'traction.revenue',
  ],
  market: [
    'marketSizing.tam.value', 'marketSizing.sam.value', 'marketSizing.som.value',
    'scores.needIntensity', 'scores.defensibility', 'scores.organicSignals',
    'globalScore',
  ],
  macro: ['globalScore', 'timingVerdict', 'countercyclicalOpportunity'],
};

function lire(o: any, chemin: string): any {
  return chemin.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
}

async function passe(moteur: string, b64: string, extraction: any): Promise<any> {
  if (moteur === 'extraction') {
    const { extractFromDeck } = await import('../lib/engines/extraction-engine');
    return extractFromDeck(b64);
  }
  const { computeRelevanceMatrix } = await import('../lib/engines/relevance-matrix');
  const { normalizeAssetClass } = await import('../lib/data/sector-benchmarks');
  const matrix = computeRelevanceMatrix(
    extraction,
    normalizeAssetClass(`${extraction.sector || ''} ${extraction.subSector || ''}`.trim()),
  );
  if (moteur === 'market') {
    const { analyzeMarket } = await import('../lib/engines/market-engine');
    return analyzeMarket(extraction, null, matrix, null);
  }
  if (moteur === 'macro') {
    const { analyzeMacro } = await import('../lib/engines/macro-engine');
    return analyzeMacro(extraction, null, matrix, null);
  }
  throw new Error(`moteur inconnu : ${moteur}`);
}

function resumer(v: any): string {
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'string') return v.replace(/\s+/g, ' ').slice(0, 90);
  return JSON.stringify(v).slice(0, 90);
}

(async () => {
  const motif = arg('deck');
  const moteur = arg('engine');
  const passes = Number(arg('passes', '3'));
  if (!motif || !moteur) {
    console.error('Usage : --deck=<motif> --engine=extraction|market|macro [--passes=3]');
    process.exit(1);
  }
  if (!CHAMPS[moteur]) {
    console.error(`Moteur inconnu. Disponibles : ${Object.keys(CHAMPS).join(', ')}`);
    process.exit(1);
  }

  const deck = await chargerDeck(motif);
  console.log(`Deck : ${deck.nom} (${Math.round(deck.b64.length * 0.75 / 1024 / 1024)} Mo)`);
  console.log(`Moteur : ${moteur}, ${passes} passes.\n`);

  // Les moteurs autres que l extraction ont besoin d une extraction.
  // Elle est LUE dans le dernier run persiste plutot que refaite : on
  // mesure la variance du moteur demande, pas celle de son entree, et
  // c est la regle de verification, un correctif s exerce sur les
  // donnees reelles du dernier run persiste. Refaire l extraction
  // couterait un appel de plus et, sur un deck de cent pages, la
  // ferait echouer une fois sur trois pour rien.
  let extraction: any = null;
  if (moteur !== 'extraction') {
    const [e] = await sql(`
      select result_json -> 'extraction' as ext, id, (created_at at time zone 'Europe/Paris') as d
      from public.analyses
      where source_filename ilike '%${motif.replace(/'/g, "''")}%'
        and result_json -> 'extraction' is not null
      order by created_at desc limit 1;
    `);
    if (!e) throw new Error('aucune extraction persistee pour ce deck : lancer d abord --engine=extraction');
    extraction = e.ext;
    console.log(`Extraction lue dans le run ${String(e.id).slice(0, 8)} du ${String(e.d).slice(0, 19)}`);
    console.log(`  secteur=${extraction.sector} | type=${extraction.fundraise?.operationType}\n`);
  }

  const sorties = await Promise.all(
    Array.from({ length: passes }, (_, i) =>
      passe(moteur, deck.b64, extraction)
        .then((r) => { console.log(`  passe ${i + 1} rendue`); return r; })
        .catch((e: any) => { console.error(`  passe ${i + 1} en echec : ${String(e.message).slice(0, 100)}`); return null; }),
    ),
  );
  const ok = sorties.filter(Boolean);
  console.log(`\n${ok.length}/${passes} passes exploitables.\n`);
  if (ok.length < 2) { console.error('Pas assez de passes pour mesurer une dispersion.'); process.exit(1); }

  console.log('champ'.padEnd(34) + 'valeurs distinctes  stable');
  console.log('-'.repeat(74));
  let stables = 0;
  const detail: any = { deck: deck.nom, moteur, passes: ok.length, champs: {} };
  for (const c of CHAMPS[moteur]) {
    const vals = ok.map((o) => lire(o, c));
    const distinctes = Array.from(new Set(vals.map((v) => JSON.stringify(v ?? null))));
    const stable = distinctes.length === 1;
    if (stable) stables++;
    console.log(c.padEnd(34) + String(distinctes.length).padStart(6) + '            ' + (stable ? 'oui' : 'NON'));
    detail.champs[c] = { distinctes: distinctes.length, valeurs: vals.map(resumer) };
    if (!stable) for (const v of vals) console.log('      - ' + resumer(v));
  }
  console.log('-'.repeat(74));
  console.log(`${stables}/${CHAMPS[moteur].length} champs stables sur ${ok.length} passes.`);

  const dir = join(process.cwd(), 'scripts', 'audit-output');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const f = join(dir, `stabilite-${moteur}-${motif.replace(/\W+/g, '')}.json`);
  writeFileSync(f, JSON.stringify(detail, null, 2));
  console.log(`Detail : ${f}`);
})();
