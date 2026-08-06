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

/**
 * Lecture de la table des analyses.
 *
 * Elle passait par l API de gestion Supabase et son jeton personnel, qui
 * repond 401 depuis le 3 aout 2026. Le telechargement du deck, lui,
 * passait deja par la cle de service et fonctionnait : l outil dependait
 * donc de deux identifiants pour un seul besoin, et tombait entierement
 * quand le moins utilise des deux expirait. Les deux lectures passent
 * maintenant par la meme porte que le Storage.
 */
async function lireAnalyses(params: string): Promise<any[]> {
  const url = E.NEXT_PUBLIC_SUPABASE_URL || E.SUPABASE_URL;
  const key = E.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${url}/rest/v1/analyses?${params}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${t.slice(0, 200)}`);
  return JSON.parse(t);
}

async function chargerDeck(motif: string): Promise<{ nom: string; b64: string }> {
  const lignes = await lireAnalyses(
    `select=source_filename,uploaded_files&source_filename=ilike.*${encodeURIComponent(motif)}*`
    + '&order=created_at.desc&limit=40',
  );
  const d = lignes.find((l) => Array.isArray(l.uploaded_files) && l.uploaded_files.length > 0);
  if (!d) throw new Error(`aucun deck ne correspond a « ${motif} »`);
  const chemin = d.uploaded_files[0]?.storagePath;
  if (!chemin) throw new Error(`le dossier « ${d.source_filename} » ne porte pas de chemin de Storage`);
  const url = E.NEXT_PUBLIC_SUPABASE_URL || E.SUPABASE_URL;
  const key = E.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${url}/storage/v1/object/dossier-uploads/${chemin}`, {
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
    // Les composantes sont depuis le 3 aout la source citee du type
    // d operation, et leur stabilite n avait jamais ete mesuree. Elles
    // sont suivies par trois lectures separees et non par la
    // comparaison de leur JSON, parce que le JSON melange ce qui agit
    // et ce qui se lit : un changement de mot dans une citation y
    // compterait comme un changement de composante.
    'composantes/natures',
    'composantes/nombre',
    'composantes/citations',
  ],
  market: [
    'marketSizing.tam.value', 'marketSizing.sam.value', 'marketSizing.som.value',
    'scores.needIntensity', 'scores.defensibility', 'scores.organicSignals',
    'globalScore',
  ],
  macro: ['globalScore', 'timingVerdict', 'countercyclicalOpportunity'],
  team: [
    'foundersCount', 'founderMarketFit', 'systemicCoverage',
    'globalScore', 'verdict',
  ],
};

// ============================================================
// LE PERIMETRE DE L INSTRUMENT SE DERIVE, ET SON TROU SE DECLARE
// ------------------------------------------------------------
// La liste des moteurs rejouables etait ecrite a la main, et le 6 aout
// 2026 elle a coute quatre passes. Team etait tombe sur son contrat la
// veille, la mesure de son taux de chute etait le geste evident, et
// l instrument a rendu « Moteur inconnu ». Il ne le connaissait pas
// parce qu il ne connaissait que trois moteurs, ecrits un jour ou team
// n etait pas la question.
//
// Ce qui rend la faute tenace est la forme du refus. « Moteur inconnu »
// se lit comme une faute de frappe, donc on corrige son invocation et on
// recommence, au lieu de comprendre que l instrument a un perimetre.
// Rien ne distinguait un moteur qui n existe pas d un moteur que
// l instrument ne sait pas rejouer, et ce sont deux situations
// opposees : la premiere est une erreur de l appelant, la seconde est
// une lacune de l outil.
//
// Le perimetre de reference se derive donc du pipeline, comme le graphe
// de dependances derive le sien. La table de budget d appel nomme les
// moteurs que le pipeline pilote ; l instrument compare sa propre
// couverture a cette liste et dit laquelle des deux situations il
// rencontre. Un moteur ajoute demain au pipeline apparait dans le
// message sans que personne y pense, comme non rejouable et non comme
// inexistant.
//
// Ce que cette derivation ne fait pas, et il faut le dire : elle ne rend
// pas les moteurs rejouables. Chacun a ses entrees propres et son
// cablage, qui s ecrit a la main dans `passe`. Elle rend la lacune
// visible, elle ne la comble pas. C est deja la difference entre un trou
// qu on trouve et un trou qu on cherche.
// ============================================================

/** Les moteurs que le pipeline pilote, lus et non recopies. */
function moteursDuPipeline(): string[] {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ENGINE_LLM_BUDGET } = require('../lib/engines/engine-budget');
  return Object.keys(ENGINE_LLM_BUDGET);
}

/** Ce que l instrument sait rejouer, et pourquoi il refuse le reste. */
function verdictDePerimetre(moteur: string): { ok: boolean; message: string } {
  if (CHAMPS[moteur]) return { ok: true, message: '' };
  const rejouables = Object.keys(CHAMPS).sort();
  const duPipeline = moteursDuPipeline();
  if (duPipeline.includes(moteur)) {
    return {
      ok: false,
      message: `« ${moteur} » est un moteur du pipeline mais cet instrument ne sait pas le rejouer.\n`
        + `  Ce n est pas une erreur d invocation, c est une lacune de l outil : son cablage d entrees\n`
        + `  reste a ecrire dans la fonction « passe ».\n`
        + `  Rejouables aujourd hui : ${rejouables.join(', ')}.\n`
        + `  Pilotes par le pipeline : ${duPipeline.sort().join(', ')}.`,
    };
  }
  return {
    ok: false,
    message: `« ${moteur} » n est ni rejouable par cet instrument ni pilote par le pipeline.\n`
      + `  Rejouables : ${rejouables.join(', ')}.`,
  };
}

/**
 * Lectures derivees, pour les champs dont la grandeur qui agit n est
 * pas le champ lui-meme.
 *
 * Les composantes d operation en sont le cas type. Leur tableau porte
 * deux choses de nature differente : les natures, qui derivent le type
 * d operation et decident donc du domaine de la dilution, et les
 * citations, qui ne commandent rien et se lisent dans la note. Comparer
 * le JSON entier ferait compter un synonyme dans une citation comme une
 * instabilite de la nature, c est-a-dire mesurer le canal visible en
 * croyant mesurer le canal muet.
 */
const DERIVES: Record<string, (o: any) => any> = {
  'composantes/natures': (o) => {
    const c = o?.fundraise?.operationComponents;
    if (!Array.isArray(c) || c.length === 0) return '(aucune)';
    return c.map((x: any) => x?.kind).sort().join(' + ');
  },
  'composantes/nombre': (o) => {
    const c = o?.fundraise?.operationComponents;
    return Array.isArray(c) ? c.length : 0;
  },
  'composantes/citations': (o) => {
    const c = o?.fundraise?.operationComponents;
    if (!Array.isArray(c) || c.length === 0) return '(aucune)';
    return c
      .map((x: any) => `${x?.kind}: ${String(x?.evidence ?? '').replace(/\s+/g, ' ').trim()}`)
      .sort()
      .join(' | ');
  },
};

function lire(o: any, chemin: string): any {
  const derive = DERIVES[chemin];
  if (derive) return derive(o);
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
  if (moteur === 'team') {
    // La signature ne prend pas la matrice : benchmarks, note de fonds,
    // options de run, puits de mesure. Le cablage se lit sur la
    // fonction et non par analogie avec le voisin, faute de quoi on
    // mesurerait un moteur appele autrement qu il ne l est en
    // production.
    const { analyzeTeam } = await import('../lib/engines/team-engine');
    return analyzeTeam(extraction, null, null, undefined, undefined);
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
    console.error(`Usage : --deck=<motif> --engine=${Object.keys(CHAMPS).sort().join('|')} [--passes=3]`);
    process.exit(1);
  }
  const perimetre = verdictDePerimetre(moteur);
  if (!perimetre.ok) {
    console.error(perimetre.message);
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
    const lignes = await lireAnalyses(
      `select=id,created_at,ext:result_json->extraction&source_filename=ilike.*${encodeURIComponent(motif)}*`
      + '&order=created_at.desc&limit=40',
    );
    const e = lignes.find((l) => l.ext);
    if (!e) throw new Error('aucune extraction persistee pour ce deck : lancer d abord --engine=extraction');
    extraction = e.ext;
    console.log(`Extraction lue dans le run ${String(e.id).slice(0, 8)} du ${String(e.created_at).slice(0, 19)}`);
    console.log(`  secteur=${extraction.sector} | type=${extraction.fundraise?.operationType}\n`);
  }

  /**
   * Deux regimes, et le choix n est pas une commodite d execution.
   *
   * En parallele, les N passes partent ensemble : c est le plus rapide
   * et c est ce qu il faut pour mesurer une dispersion de valeurs, ou
   * seul compte le fait que chaque passe soit un tirage independant.
   *
   * En serie, une passe attend la precedente. C est le seul regime qui
   * mesure un taux d echec, parce que la production n envoie jamais
   * deux extractions du meme dossier en meme temps : trois appels
   * concurrents de douze megaoctets se disputent une fenetre et une
   * limite de debit que l appel unique ne rencontre pas. Mesurer le
   * tirage d un timeout en parallele reviendrait a mesurer autre chose
   * que ce que le partner subit, sur un support qui n est pas le sien.
   */
  const serie = arg('serial', 'false') === 'true';
  console.log(`Regime : ${serie ? 'serie (une passe a la fois, regime de production)' : 'parallele'}\n`);

  /**
   * La duree de chaque passe est relevee, et pas seulement son issue.
   *
   * Compter les echecs d un appel qui meurt par depassement de fenetre
   * est la mauvaise mesure : l echec est un seuil pose sur une duree, et
   * le seuil est connu. Trois passes ne separent pas un tirage a un
   * tiers d un tirage a zero, alors que trois durees disent
   * immediatement quelle marge separe le pire cas de la fenetre. C est
   * la meme substitution que partout ailleurs, mesurer la grandeur qui
   * produit l evenement plutot que l evenement.
   */
  const echecs: string[] = [];
  const durees: number[] = [];
  const lancer = (i: number) => {
    const t0 = process.hrtime.bigint();
    const ms = () => Number(process.hrtime.bigint() - t0) / 1e6;
    return passe(moteur, deck.b64, extraction)
      .then((r) => { const d = ms(); durees.push(d); console.log(`  passe ${i + 1} rendue en ${Math.round(d)} ms`); return r; })
      .catch((e: any) => {
        const d = ms();
        const m = String(e?.message ?? e).slice(0, 120);
        console.error(`  passe ${i + 1} en echec apres ${Math.round(d)} ms : ${m}`);
        echecs.push(`${Math.round(d)} ms : ${m}`);
        return null;
      });
  };

  let sorties: any[];
  if (serie) {
    sorties = [];
    for (let i = 0; i < passes; i++) sorties.push(await lancer(i));
  } else {
    sorties = await Promise.all(Array.from({ length: passes }, (_, i) => lancer(i)));
  }
  const ok = sorties.filter(Boolean);
  console.log(`\n${ok.length}/${passes} passes exploitables, ${echecs.length} echec(s).`);
  for (const m of echecs) console.log(`  echec : ${m}`);
  if (durees.length) {
    const tri = [...durees].sort((a, b) => a - b);
    console.log(`  durees rendues (ms) : ${tri.map(Math.round).join(', ')}  | pire ${Math.round(tri[tri.length - 1])} ms`);
  }
  console.log();
  // Le tirage se rend meme quand la dispersion ne se mesure pas : les
  // echecs sont l information demandee quand la question porte sur eux,
  // et sortir en silence les perdrait.
  if (ok.length < 2) {
    console.error(`Pas assez de passes pour mesurer une dispersion. Tirage : ${ok.length}/${passes} rendues.`);
    const dirE = join(process.cwd(), 'scripts', 'audit-output');
    if (!existsSync(dirE)) mkdirSync(dirE, { recursive: true });
    writeFileSync(
      join(dirE, `stabilite-${moteur}-${motif.replace(/\W+/g, '')}.json`),
      JSON.stringify({ deck: deck.nom, moteur, regime: serie ? 'serie' : 'parallele', passesLancees: passes, passesRendues: ok.length, echecs, dureesMs: durees.map(Math.round), champs: {} }, null, 2),
    );
    process.exit(1);
  }

  console.log('champ'.padEnd(34) + 'valeurs distinctes  stable');
  console.log('-'.repeat(74));
  let stables = 0;
  const detail: any = {
    deck: deck.nom, moteur,
    regime: serie ? 'serie' : 'parallele',
    passesLancees: passes, passesRendues: ok.length, echecs,
    dureesMs: durees.map(Math.round),
    passes: ok.length, champs: {},
  };
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
