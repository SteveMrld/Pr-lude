/**
 * Comparables europeens crédibles pour Prelude.
 * Source: Atomico State of European Tech 2025.
 *
 * Pourquoi c est central:
 * Quand le moteur Pattern matching de Prelude cherche des comparables pour un dossier
 * europeen, il faut prioriser des companies europeennes plutot que d aller chercher
 * Anthropic ou OpenAI qui ne sont pas comparables (taille de capital deploye, profondeur
 * de marche, ecosysteme local).
 */

import { SOURCES } from './sources';

/**
 * Critères de qualification de la Mighty 50 (Atomico).
 */
export const MIGHTY_50_CRITERIA = {
  foundedSince: 2000,
  medianRevenueMillionsUsdMin: 100,
  valuationBillionsUsdMin: 2,
  employeeCountMin: 200,
  source: SOURCES.ATOMICO_SOET_2025,
} as const;

/**
 * Liste partielle de la Mighty 50 (Atomico SoET 2025).
 * A enrichir au fil de l eau quand de nouveaux noms emergent.
 */
// Les mentions ne portent plus de chiffre que si la societe figure
// dans VERIFIED_COMPARABLES sans quarantaine. Mesure du 3 aout 2026 :
// six des treize entrees portaient un chiffre, dont trois sur des
// societes en quarantaine dans la base de verification et deux sur des
// societes qui n y figurent pas. Cinq chiffres sur six imprimes dans
// une note d instruction n etaient donc adosses a rien, et celui de
// Mistral etait explicitement marque needsExternalCheck.
export const MIGHTY_50_SAMPLE = [
  { name: 'Mistral', sector: 'AI / foundation models', country: 'France', notes: 'Reference europeenne des modeles de fondation open-weights' },
  { name: 'Lovable', sector: 'AI coding', country: 'Sweden', notes: 'Croissance ARR parmi les plus rapides du logiciel europeen' },
  { name: 'Synthesia', sector: 'AI video / enterprise', country: 'UK', notes: 'Gold standard enterprise AI video' },
  { name: 'n8n', sector: 'AI workflows', country: 'Germany', notes: 'Challenger de Zapier' },
  { name: 'DeepL', sector: 'AI translation', country: 'Germany', notes: 'Concurrent direct de Google Translate sur enterprise' },
  { name: 'ElevenLabs', sector: 'AI voice', country: 'UK / US', notes: 'Leader voix synthetique' },
  { name: 'Helsing', sector: 'Defense AI', country: 'Germany', notes: 'Reference europeenne de l IA de defense' },
  { name: 'Revolut', sector: 'Fintech / banking', country: 'UK', notes: '65M clients, cible 100M' },
  { name: 'Oura', sector: 'Healthtech / wearables', country: 'Finland', notes: 'Leader europeen du wearable de sante grand public' },
  { name: 'Spotify', sector: 'Music streaming', country: 'Sweden', notes: 'Reference historique de licorne europeenne sortie' },
  { name: 'Stripe', sector: 'Fintech / payments', country: 'Ireland / US', notes: 'Reference fintech mondiale' },
  { name: 'Wise', sector: 'Fintech / cross-border', country: 'UK', notes: 'IPO Londres' },
  { name: 'Klarna', sector: 'Fintech / BNPL', country: 'Sweden', notes: 'Reference europeenne du paiement fractionne' },
] as const;

/**
 * Levees notables europeennes 2025.
 * Source: Atomico SoET 2025.
 */
export const NOTABLE_EUROPEAN_ROUNDS_2025 = [
  {
    company: 'NScale',
    sector: 'AI infrastructure',
    country: 'UK',
    round: 'Series B',
    amountMillionsUsd: 1100,
    notes: "Plus gros Series B UK historique. Partenariat strategique multi-investor (Aker ASA, NVIDIA, Dell, Nokia).",
  },
  {
    company: 'Mistral',
    sector: 'AI / foundation models',
    country: 'France',
    round: 'Series C',
    amountMillionsUsd: 2000,
    notes: "Anchor 1,5Md US par ASML.",
  },
  {
    company: 'Helsing',
    sector: 'Defense AI',
    country: 'Germany',
    round: 'Series D',
    amountMillionsUsd: 660,
  },
  {
    company: 'Isomorphic Labs',
    sector: 'AI / drug discovery',
    country: 'UK',
    round: 'Series A+',
    amountMillionsUsd: 600,
    notes: 'Spin-out de DeepMind.',
  },
  {
    company: 'Proxima Fusion',
    sector: 'Deeptech / fusion',
    country: 'Germany',
    round: 'Series A extension',
    amountMillionsEur: 200,
  },
] as const;

/**
 * Allocation deeptech europeenne 2025.
 * Source: Atomico SoET 2025.
 */
export const EUROPEAN_DEEPTECH_2025 = {
  shareOfEuropeanVcDollarsPercent: 36,
  shareOfEuropeanVcDollarsPercent2021: 19,
  totalDeployedBillionsUsd: 16,
  comparisonUsBigAiBetsBillionsUsd: 63, // OpenAI + Anthropic seuls
  notes: "L Europe diversifie ses paris deeptech (compute, quantum, defense, mobility, climate) tandis que les US concentrent sur quelques labs IA geants. Strategie differente, pas necessairement inferieure mais avec moins de gros gagnants potentiels.",
  source: SOURCES.ATOMICO_SOET_2025,
} as const;

/**
 * Trajectoire fondateurs europeens qui s expatrient aux US.
 * Source: Atomico SoET 2025.
 */
export const EUROPEAN_FOUNDER_FLIGHT = {
  seasonedFoundersIncorporatingInUsPercent2016: 10,
  seasonedFoundersIncorporatingInUsPercent2025: 18,
  aiFoundersStayingInEuropePercent2016: 74,
  aiFoundersStayingInEuropePercent2025: 81,
  notes: "Les seasoned founders europeens incorporent de plus en plus aux US (10% -> 18% en 9 ans). Mais a contre-courant, les founders IA restent davantage en Europe (74% -> 81%). Pour Prelude: un fondateur europeen qui choisit d incorporer en Europe est un signal positif, pas neutre.",
  source: SOURCES.ATOMICO_SOET_2025,
} as const;

/**
 * Nombre de nouveaux fondateurs europeens par an.
 * Source: Atomico SoET 2025.
 */
export const EUROPEAN_FOUNDER_PIPELINE = {
  newFoundersIn2025: 27000,
  growthVs2023Percent: 60, // ~60% de plus qu en 2023
  europeShareOfGlobalFoundersPercent2025: 28,
  asiaShareOfGlobalFoundersPercent2025: 28,
  source: SOURCES.ATOMICO_SOET_2025,
} as const;

// ============================================================
// GARDE DE COHERENCE ENTRE LES DEUX CATALOGUES
// ------------------------------------------------------------
// Deux listes closes du meme produit coexistaient sans se comparer :
// celle-ci, qui alimente les comparables europeens de la note, et
// VERIFIED_COMPARABLES, qui est la base de chiffres verifies. La note
// Braincube du 3 aout imprimait donc « Series C 2 milliards US avec
// ASML » sur Mistral, chiffre que la base de verification porte
// explicitement en quarantaine avec needsExternalCheck.
//
// C est le meme patron que les deux vocabulaires sectoriels du meme
// jour, et la reparation est la meme : une garde qui relit les deux
// listes plutot qu une correction d occurrence. Un chiffre ajoute
// demain a une mention sans appui dans la base fait echouer la suite.
//
// La regle : une mention ne porte un chiffre que si la societe figure
// dans la base verifiee et n y est pas en quarantaine. Elle ne verifie
// pas le chiffre lui-meme, ce qu aucun code ne peut faire ; elle
// verifie qu il existe une source a interroger, ce qui est la
// condition minimale pour l imprimer devant un fonds.
// ============================================================

import { VERIFIED_COMPARABLES } from '../data/verified-comparables';

/** Un chiffre, au sens de ce qui engage : un nombre dans la mention. */
const PORTE_UN_CHIFFRE = /\d/;

function memeSociete(a: string, b: string): boolean {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const x = n(a), y = n(b);
  return x === y || x.includes(y) || y.includes(x);
}

export interface AnomalieComparable {
  name: string;
  notes: string;
  motif: 'absent-de-la-base-verifiee' | 'en-quarantaine';
}

/**
 * Mentions portant un chiffre sans appui dans la base verifiee.
 * Vide quand les deux catalogues concordent.
 */
export function anomaliesComparables(): AnomalieComparable[] {
  const entrees = Object.values(VERIFIED_COMPARABLES);
  const out: AnomalieComparable[] = [];
  for (const c of MIGHTY_50_SAMPLE) {
    if (!PORTE_UN_CHIFFRE.test(c.notes)) continue;
    const v = entrees.find((e) => memeSociete(e.name, c.name));
    if (!v) { out.push({ name: c.name, notes: c.notes, motif: 'absent-de-la-base-verifiee' }); continue; }
    if ((v as any).needsExternalCheck === true) {
      out.push({ name: c.name, notes: c.notes, motif: 'en-quarantaine' });
    }
  }
  return out;
}
