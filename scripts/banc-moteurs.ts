// ============================================================
// BANC DE MOTEURS
// ------------------------------------------------------------
// Exerce UN moteur isolement sur une entree tiree d un run persiste, et
// verifie une relation entre deux sorties plutot qu une sortie.
//
// POURQUOI UNE RELATION ET NON UNE SORTIE
//
// On ne peut pas asserter ce qu un modele doit dire. Une sortie attendue
// ecrite a la main est une fixture qui pourrit au premier changement de
// prompt, et qui mesure surtout l accord entre ce que j imaginais et ce
// que le moteur rend. Ce qu on peut asserter est une relation : si l on
// divise le chiffre d affaires par deux, le score ne doit pas monter ;
// si l on vide les fondateurs, la dimension equipe doit se declarer non
// evaluee et non pas retomber au milieu de la bande. Aucune de ces
// assertions ne demande de connaitre la bonne reponse, seulement le bon
// sens de variation, et c est ce qui les rend durables.
//
// L ECONOMIE DU DISPOSITIF
//
// La sortie de reference n est pas recalculee : elle est deja dans le
// run persiste. Une epreuve coute donc UN appel, celui de l entree
// perturbee, soit entre deux et quinze centimes selon le moteur, mediane
// six. Une passe de trente epreuves coute environ deux dollars et trois
// minutes a la concurrence du pipeline.
//
// Il vient en troisieme, apres le controleur de corpus et le bulletin,
// et l ordre tient a un rapport d echelle. Le controleur lit les
// cinquante-deux notes deja produites en cinq cents millisecondes et ne
// coute rien. Le banc coute deux dollars et trois minutes. Un run
// complet coute trois a quatre dollars et demi et dix minutes. On
// commence par ce qui est gratuit et retroactif.
//
// CE QUE LE BANC NE VERRA JAMAIS
//
// Si l analyse est juste. Les contradictions entre moteurs, puisqu il
// les exerce isolement. La voix editoriale. Ce qui se joue aux pages 80
// a 122 d un memorandum que l extraction survole. Les defaillances de
// regime, puisqu il lance un moteur a la fois quand la production en
// lance seize : le registre releve deux appels en echec par run
// Woodpecker, soit neuf pour cent, que ce banc ne rencontrera pas. Et
// aucune classe de defaut que personne n a encore nommee.
//
// USAGE
//   npx tsx scripts/banc-moteurs.ts --liste
//   npx tsx scripts/banc-moteurs.ts --epreuve=market-tam-divise
//   npx tsx scripts/banc-moteurs.ts --analyse=Woodpecker
// ============================================================

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { withLlmLedger, readLlmLedger } from '../lib/instrumentation/llm-ledger';
import { withSourceCapture } from '../lib/instrumentation/source-capture';

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
  if (!r.ok) throw new Error(`HTTP ${r.status} ${t.slice(0, 300)}`);
  return JSON.parse(t);
}

/** Copie profonde, pour qu une perturbation ne touche jamais la note source. */
function copie<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }

// ------------------------------------------------------------
// Les epreuves
// ------------------------------------------------------------

/**
 * Trois issues et non deux.
 *
 * Une epreuve qui ne parvient pas a lire ce dont elle a besoin n a rien
 * etabli sur le moteur : le defaut est dans l epreuve. Les confondre
 * avec une relation rompue ferait crier au loup, et un banc qui crie au
 * loup cesse d etre lu, ce qui est la seule facon de perdre ce qu il
 * apporte. Le cas s est produit au premier essai, le 5 aout 2026 : la
 * premiere ecriture lisait `tests` comme un tableau quand la sortie le
 * rend comme un objet, et le banc a rendu ROMPUE pour un centime la ou
 * il fallait lire ILLISIBLE.
 */
export type Issue = 'tenue' | 'rompue' | 'illisible';

export interface Verdict {
  issue: Issue;
  dit: string;
}

export interface Epreuve {
  id: string;
  /** Le moteur exerce, et lui seul. */
  moteur: string;
  /** La relation asserte, en une phrase. */
  relation: string;
  /** Ce que la perturbation change dans la note source. */
  perturber(note: any): any;
  /** Rejoue le moteur sur la note perturbee. */
  jouer(note: any): Promise<any>;
  /** Confronte la sortie perturbee a celle du run persiste. */
  juger(reference: any, perturbee: any): Verdict;
}

/** Lecture d un score, rendue nulle plutot que zero quand elle manque. */
function score(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

async function matrice(extraction: any) {
  const { computeRelevanceMatrix } = await import('../lib/engines/relevance-matrix');
  const { normalizeAssetClass } = await import('../lib/data/sector-benchmarks');
  return computeRelevanceMatrix(
    extraction,
    normalizeAssetClass(`${extraction.sector || ''} ${extraction.subSector || ''}`.trim()),
  );
}

/** Somme des sous-scores d un objet, null quand aucun n est lisible. */
function composite(o: any): number | null {
  if (!o || typeof o !== 'object') return null;
  const s = Object.values(o)
    .map((v: any) => score(v?.score))
    .filter((v): v is number => v !== null);
  return s.length === 0 ? null : s.reduce((a, b) => a + b, 0);
}

/** Nombre de paliers de sizing que le moteur a ose remplir. */
function paliersRemplis(sizing: any): number | null {
  if (!sizing || typeof sizing !== 'object') return null;
  return ['tam', 'sam', 'som']
    .filter((k) => typeof sizing?.[k]?.value === 'string' && sizing[k].value.trim().length > 0)
    .length;
}

export const EPREUVES: Epreuve[] = [
  {
    id: 'equipe-sans-fondateurs',
    moteur: 'team',
    relation:
      'Un dossier vide de tout fondateur ne peut pas rendre le meme composite d equipe qu un dossier qui en porte quatre.',
    perturber: (n) => {
      const c = copie(n);
      if (c.extraction) { c.extraction.founders = []; c.extraction.boardMembers = []; }
      return c;
    },
    jouer: async (n) => {
      const { analyzeTeam } = await import('../lib/engines/team-engine');
      return analyzeTeam(n.extraction, n.benchmarks ?? null, null, { frozen: true });
    },
    juger: (ref, per) => {
      const a = composite(ref?.team);
      const b = composite(per);
      if (a === null) return { issue: 'illisible', dit: 'le run de reference ne porte aucun sous-score d equipe' };
      if (b === null) return { issue: 'tenue', dit: 'aucun sous-score rendu sans fondateur, ce qui est la reponse attendue' };
      // Ce qui est refuse n est pas un score bas, c est un score qui ne
      // bouge pas : un dossier vide de fondateurs qui rend le meme
      // composite qu un dossier plein n a pas lu ses fondateurs.
      return {
        issue: b < a ? 'tenue' : 'rompue',
        dit: `composite avec fondateurs ${a}, sans fondateurs ${b}${b >= a ? ' : le moteur n a pas lu ses fondateurs' : ''}`,
      };
    },
  },

  {
    id: 'coherence-sans-donnees-financieres',
    moteur: 'tech-claim',
    relation:
      'Prive de donnees financieres, le moteur de revendication technique ne peut pas produire plus de tests concluants qu avec elles.',
    perturber: (n) => { const c = copie(n); c.financialData = null; return c; },
    jouer: async (n) => {
      const { analyzeTechClaimCoherence } = await import('../lib/engines/tech-claim-coherence-engine');
      return analyzeTechClaimCoherence(n.extraction, n.financialData ?? null);
    },
    juger: (ref, per) => {
      // `tests` est un objet indexe par nom de test et non un tableau :
      // la premiere ecriture le lisait comme un tableau et rendait une
      // relation rompue qui n en etait pas une.
      const lire = (t: any) => (t && typeof t === 'object' && !Array.isArray(t))
        ? Object.values(t).filter((x: any) => x?.passed === true).length
        : null;
      const a = lire(ref?.techClaimCoherence?.tests);
      const b = lire(per?.tests);
      if (a === null || b === null) {
        return { issue: 'illisible', dit: `tests illisibles (reference ${a}, perturbee ${b})` };
      }
      return {
        issue: b <= a ? 'tenue' : 'rompue',
        dit: `avec donnees financieres ${a} test(s) concluant(s), sans elles ${b}`,
      };
    },
  },

  {
    id: 'marche-sans-revendication-de-taille',
    moteur: 'market',
    relation:
      'Prive de la revendication de taille du dossier, le moteur de marche ne peut pas remplir plus de paliers de sizing qu avec elle.',
    perturber: (n) => {
      const c = copie(n);
      if (c.extraction) {
        c.extraction.marketPitch = '';
        c.extraction.marketSize = null;
      }
      return c;
    },
    jouer: async (n) => {
      const { analyzeMarket } = await import('../lib/engines/market-engine');
      return analyzeMarket(n.extraction, null, await matrice(n.extraction), n.sectoralContext ?? null, { frozen: true });
    },
    juger: (ref, per) => {
      const a = paliersRemplis(ref?.market?.marketSizing);
      const b = paliersRemplis(per?.marketSizing);
      if (a === null || b === null) {
        return { issue: 'illisible', dit: `sizing illisible (reference ${a}, perturbee ${b})` };
      }
      return {
        issue: b <= a ? 'tenue' : 'rompue',
        dit: `avec revendication ${a} palier(s) rempli(s), sans revendication ${b}`,
      };
    },
  },
];

// ------------------------------------------------------------
// Commande
// ------------------------------------------------------------

/** Tarifs Anthropic en dollars par million de tokens, cache compris. */
const TARIF: Record<string, { in: number; out: number }> = {
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
};

function coutDuRegistre(l: ReturnType<typeof readLlmLedger>): number {
  let c = 0;
  for (const a of l.calls) {
    const t = TARIF[a.model] ?? { in: 3, out: 15 };
    c += (a.inputTokens * t.in
      + (a.cacheWriteTokens ?? 0) * t.in * 1.25
      + (a.cacheReadTokens ?? 0) * t.in * 0.1
      + a.outputTokens * t.out) / 1e6;
  }
  return c;
}

async function main(): Promise<void> {
  if (process.argv.includes('--liste')) {
    console.log('EPREUVES DU BANC\n');
    for (const e of EPREUVES) {
      console.log(`  ${e.id}  [${e.moteur}]`);
      console.log(`     ${e.relation}\n`);
    }
    return;
  }

  const cible = arg('analyse', 'Woodpecker');
  const filtre = arg('epreuve');
  const [row] = await sql(
    `select id, source_filename, result_json::text as j from public.analyses
     where source_filename ilike '%${cible.replace(/'/g, "''")}%' and result_json is not null
     order by created_at desc limit 1;`);
  if (!row) { console.error(`Aucune analyse pour « ${cible} ».`); process.exit(1); }
  const reference = JSON.parse(row.j);

  const epreuves = filtre ? EPREUVES.filter((e) => e.id === filtre) : EPREUVES;
  if (epreuves.length === 0) { console.error(`Epreuve inconnue : ${filtre}`); process.exit(1); }

  console.log(`BANC DE MOTEURS — reference ${String(row.id).slice(0, 8)}, ${row.source_filename}`);
  console.log(`${epreuves.length} epreuve(s). La sortie de reference vient du run persiste : une epreuve coute un appel.\n`);

  const resultats: any[] = [];
  let coutTotal = 0;
  for (const e of epreuves) {
    const t0 = Date.now();
    let verdict: Verdict;
    let cout = 0;
    try {
      const { v, c } = await withLlmLedger(async () => withSourceCapture(async () => {
        const sortie = await e.jouer(e.perturber(reference));
        return { v: e.juger(reference, sortie), c: coutDuRegistre(readLlmLedger()) };
      }));
      verdict = v; cout = c;
    } catch (err: any) {
      // Une levee est un defaut de l epreuve ou du moteur, jamais une
      // relation rompue : on ne sait pas ce que le moteur aurait rendu.
      verdict = { issue: 'illisible', dit: `epreuve en echec : ${String(err?.message ?? err).slice(0, 140)}` };
    }
    coutTotal += cout;
    const ms = Date.now() - t0;
    const marque = { tenue: 'TENUE    ', rompue: 'ROMPUE   ', illisible: 'ILLISIBLE' }[verdict.issue];
    console.log(`${marque} ${e.id}  [${e.moteur}]  ${(cout).toFixed(3)} USD  ${Math.round(ms / 1000)}s`);
    console.log(`   relation : ${e.relation}`);
    console.log(`   mesure   : ${verdict.dit}\n`);
    resultats.push({ id: e.id, moteur: e.moteur, relation: e.relation, ...verdict, coutUsd: cout, dureeMs: ms });
  }

  const rompues = resultats.filter((r) => r.issue === 'rompue');
  const illisibles = resultats.filter((r) => r.issue === 'illisible');
  console.log(`${resultats.length - rompues.length - illisibles.length}/${resultats.length} relations tenues, `
    + `${rompues.length} rompue(s), ${illisibles.length} illisible(s), ${coutTotal.toFixed(2)} USD au total.`);
  if (illisibles.length > 0) {
    console.log('Une epreuve illisible n etablit rien sur le moteur : le defaut est dans l epreuve, et il se corrige la.');
  }

  const dir = join(process.cwd(), 'scripts', 'audit-output');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const f = join(dir, 'banc-moteurs.json');
  writeFileSync(f, JSON.stringify({ reference: row.id, dossier: row.source_filename, coutUsd: coutTotal, resultats }, null, 2));
  console.log(`Releve : ${f}`);
  process.exit(rompues.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
}
