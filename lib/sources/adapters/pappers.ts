// Adapter Pappers (registre des entreprises francaises).
// Tier 1 free-byok : utilisable sans cle (50 requetes/jour quota gratuit),
// quotas eleves avec cle utilisateur. URL API : api.pappers.fr.
//
// Utilise pour :
//   - Verifier l existence legale d une SAS/SASU/SARL francaise
//   - Recuperer SIREN, dirigeants, capital social, adresse
//   - Detecter beneficiaires effectifs declares
//   - Acceder aux comptes annuels deposes (chiffre d affaires, marges)
//   - Identifier les modifications recentes (changement de dirigeant,
//     transfert de siege, augmentation de capital)
//
// Documentation : https://www.pappers.fr/api/documentation
//
// Note BYOK : la cle peut venir soit de l env (PAPPERS_API_KEY) pour le
// dev, soit de getDecryptedOrgApiKey() pour les fonds clients.

import type { AdapterContext, AdapterCitation } from './types';
import { safeJsonFetch } from './types';

const PAPPERS_BASE = 'https://api.pappers.fr/v2';

export interface PappersCompanySearchHit {
  siren: string;
  name: string;
  status: string;
  legalForm: string;
  creationDate: string;
  address: string;
  url: string;
}

export interface PappersCompanyDetails {
  siren: string;
  name: string;
  legalForm: string;
  status: string;
  creationDate: string;
  capital: number | null;
  capitalCurrency: string | null;
  address: string;
  industryCode: string;
  industryLabel: string;
  ceo: string | null;
  beneficialOwners: { name: string; pctShares: number | null; nationality: string | null }[];
  recentChanges: { date: string; description: string }[];
  financials: {
    year: number;
    revenue: number | null;
    netIncome: number | null;
    employees: number | null;
  }[];
  url: string;
}

function pickKey(opts: AdapterContext): string | undefined {
  return opts.apiKey || process.env.PAPPERS_API_KEY;
}

/**
 * Recherche une entreprise par nom ou SIREN.
 * Sans cle, quota tres limite (~50 req/jour partages par tous).
 * Avec cle utilisateur, jusqu a 30 000 req/mois selon abonnement.
 */
export async function searchPappersCompany(
  query: string,
  opts: AdapterContext & { maxResults?: number } = {},
): Promise<PappersCompanySearchHit[]> {
  const apiKey = pickKey(opts);
  const max = Math.min(opts.maxResults ?? 10, 20);

  const params = new URLSearchParams({
    q: query,
    par_page: String(max),
    precision: 'standard',
  });
  if (apiKey) params.set('api_token', apiKey);

  opts.emit?.('adapter:start', { source: 'pappers', query });

  const json = await safeJsonFetch<any>(
    `${PAPPERS_BASE}/recherche?${params.toString()}`,
    { budgetMs: opts.budgetMs ?? 8000 },
  );

  if (!json || !Array.isArray(json.resultats)) {
    opts.emit?.('adapter:miss', { source: 'pappers', query });
    return [];
  }

  const hits: PappersCompanySearchHit[] = json.resultats.map((r: any) => ({
    siren: r.siren || '',
    name: r.nom_entreprise || r.denomination || '',
    status: r.statut_rcs || '',
    legalForm: r.forme_juridique || '',
    creationDate: r.date_creation || '',
    address: r.siege?.adresse_ligne_1 || '',
    url: `https://www.pappers.fr/entreprise/${r.siren}`,
  }));

  opts.emit?.('adapter:hit', { source: 'pappers', count: hits.length });
  return hits;
}

/**
 * Details complets d une entreprise par SIREN. Necessite une cle API
 * (free tier offre 30 calls par jour).
 */
export async function getPappersCompanyDetails(
  siren: string,
  opts: AdapterContext = {},
): Promise<PappersCompanyDetails | null> {
  const apiKey = pickKey(opts);
  const cleanSiren = siren.replace(/\s+/g, '');
  if (!/^\d{9}$/.test(cleanSiren)) return null;

  const params = new URLSearchParams({ siren: cleanSiren });
  if (apiKey) params.set('api_token', apiKey);

  opts.emit?.('adapter:start', { source: 'pappers', siren: cleanSiren });

  const json = await safeJsonFetch<any>(
    `${PAPPERS_BASE}/entreprise?${params.toString()}`,
    { budgetMs: opts.budgetMs ?? 8000 },
  );

  if (!json || !json.siren) {
    opts.emit?.('adapter:miss', { source: 'pappers', siren: cleanSiren });
    return null;
  }

  // Dirigeant principal (premier representant actif)
  const reps = Array.isArray(json.representants) ? json.representants : [];
  const activeRep = reps.find((r: any) => !r.date_fin) || reps[0];
  const ceo = activeRep
    ? [activeRep.prenom, activeRep.nom].filter(Boolean).join(' ').trim() || activeRep.denomination || null
    : null;

  // Beneficiaires effectifs
  const beneficials = Array.isArray(json.beneficiaires_effectifs) ? json.beneficiaires_effectifs : [];
  const beneficialOwners = beneficials.map((b: any) => ({
    name: [b.prenom, b.nom].filter(Boolean).join(' ').trim() || b.denomination || 'Inconnu',
    pctShares: typeof b.pourcentage_parts === 'number' ? b.pourcentage_parts : null,
    nationality: b.nationalite || null,
  }));

  // Financials (comptes annuels)
  const finStmts = Array.isArray(json.finances) ? json.finances : [];
  const financials = finStmts.slice(0, 5).map((f: any) => ({
    year: f.annee || 0,
    revenue: typeof f.chiffre_affaires === 'number' ? f.chiffre_affaires : null,
    netIncome: typeof f.resultat === 'number' ? f.resultat : null,
    employees: typeof f.effectif === 'number' ? f.effectif : null,
  }));

  // Modifications recentes (depots BODACC indirect)
  const depots = Array.isArray(json.depots_actes) ? json.depots_actes.slice(0, 5) : [];
  const recentChanges = depots.map((d: any) => ({
    date: d.date_depot || '',
    description: d.type || d.description || '',
  }));

  const out: PappersCompanyDetails = {
    siren: json.siren,
    name: json.nom_entreprise || json.denomination || '',
    legalForm: json.forme_juridique || '',
    status: json.statut_rcs || '',
    creationDate: json.date_creation || '',
    capital: typeof json.capital === 'number' ? json.capital : null,
    capitalCurrency: json.capital_devise || null,
    address: json.siege?.adresse_ligne_1 || '',
    industryCode: json.code_naf || '',
    industryLabel: json.libelle_code_naf || '',
    ceo,
    beneficialOwners,
    recentChanges,
    financials,
    url: `https://www.pappers.fr/entreprise/${json.siren}`,
  };

  opts.emit?.('adapter:hit', { source: 'pappers', siren: cleanSiren });
  return out;
}

export function pappersToCitation(rec: { name: string; url: string; siren?: string }): AdapterCitation {
  return {
    sourceId: 'pappers',
    url: rec.url,
    title: rec.siren ? `${rec.name} (SIREN ${rec.siren})` : rec.name,
    tier: 1,
  };
}
