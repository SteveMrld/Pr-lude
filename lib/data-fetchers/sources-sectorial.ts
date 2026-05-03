// Niveau 2.B : enrichissement par sources sectorielles dedicacees aux profils
// business / industriel / hardware.
//
// Probleme adresse : OpenAlex / GitHub / Wikipedia ne sont pas pertinents pour
// la majorite des fondateurs d entreprises (CEO, CTO hardware, COO industriel,
// dirigeant historique). Pour ces profils, les sources qui valident vraiment
// les claims sont :
//   - Pappers (registre RCS francais) : mandats sociaux passes / actuels,
//     creation entreprise, dirigeant, beneficiaire effectif
//   - EPO Espacenet OPS : brevets europeens deposes (validation expertise
//     technique reelle pour profils ingenieurs / inventeurs)
//
// Sur le rapport UP&CHARGE, Guy Flaquiere etait scoree 22/100 par OpenAlex et
// flagge 'non-evaluable' alors qu il aurait du etre evalue via EPO (claim
// inventeur trottinettes verifiable) et Pappers (mandats anciens sur sa
// trajectoire). Le fix profileType (commit 979aa70) a empeche le faux red
// flag mais n a pas remplace les sources non pertinentes par les bonnes.
// Ce module comble le manque.

import { cached } from './sources';

// ============================================================================
// EPO ESPACENET OPS - BREVETS
// ============================================================================
// Doc : https://developers.epo.org/ops-v3-2/apis
// Auth : OAuth2 client credentials (app_id + app_secret)
// Quotas : 4 GB de download par semaine en gratuit, etendable

interface EPOTokenCache {
  accessToken: string;
  expiresAt: number;
}

let epoTokenCache: EPOTokenCache | null = null;

async function getEPOToken(): Promise<string | null> {
  const clientId = process.env.EPO_OAUTH_CLIENT_ID;
  const clientSecret = process.env.EPO_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  // Reuse token si encore valable (marge 30s)
  if (epoTokenCache && epoTokenCache.expiresAt > Date.now() + 30_000) {
    return epoTokenCache.accessToken;
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch('https://ops.epo.org/3.2/auth/accesstoken', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[epo] auth failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    const accessToken = data.access_token as string;
    const expiresInSec = parseInt(data.expires_in || '1200', 10);
    epoTokenCache = {
      accessToken,
      expiresAt: Date.now() + expiresInSec * 1000,
    };
    return accessToken;
  } catch (err: any) {
    console.warn('[epo] auth error:', err?.message);
    return null;
  }
}

export interface EPOPatent {
  publicationNumber: string; // ex EP1234567A1
  title: string;
  applicationDate: string; // YYYY-MM-DD
  publicationDate: string;
  inventors: string[];
  applicants: string[]; // entreprises deposantes
  ipcClassifications: string[]; // codes CIB (ex H02J50/00 pour wireless power)
  abstractText?: string;
}

export interface EPOSearchResult {
  inventorName: string;
  totalFound: number;
  patents: EPOPatent[];
  errorMessage?: string;
}

// Recherche les brevets EPO ou la personne apparait comme inventeur.
// Retourne null si EPO non configure (variable d env manquante) ou si la
// recherche echoue.
export async function searchEPOPatentsByInventor(
  inventorName: string,
  limit: number = 10,
): Promise<EPOSearchResult | null> {
  const token = await getEPOToken();
  if (!token) return null;

  return cached(`epo:inventor:${inventorName}:${limit}`, async () => {
    try {
      // Query CQL : recherche par champ 'in' (inventor)
      // Ref : https://link.epo.org/web/ops_v3.2_documentation_-_version_1.3.18_en.pdf
      const cql = `in="${inventorName}"`;
      const url = `https://ops.epo.org/3.2/rest-services/published-data/search/biblio?q=${encodeURIComponent(cql)}&Range=1-${Math.min(limit, 25)}`;

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        return {
          inventorName,
          totalFound: 0,
          patents: [],
          errorMessage: `EPO HTTP ${res.status}`,
        };
      }

      const data = await res.json();
      // La structure de OPS est tres imbriquee. On parse defensivement.
      const searchResult = data?.['ops:world-patent-data']?.['ops:biblio-search']?.['ops:search-result'];
      const totalFound = parseInt(
        data?.['ops:world-patent-data']?.['ops:biblio-search']?.['@total-result-count'] || '0',
        10,
      );
      const items = searchResult?.['exchange-documents'];
      const docArray = Array.isArray(items) ? items : items ? [items] : [];

      const patents: EPOPatent[] = docArray.slice(0, limit).map((wrapper: any) => {
        const doc = wrapper?.['exchange-document'];
        const docInfo = doc?.['bibliographic-data'];
        const docNum = doc?.['@country'] && doc?.['@doc-number']
          ? `${doc['@country']}${doc['@doc-number']}${doc['@kind'] || ''}`
          : '?';

        const titleNode = docInfo?.['invention-title'];
        const titles = Array.isArray(titleNode) ? titleNode : titleNode ? [titleNode] : [];
        const titleEn = titles.find((t: any) => t['@lang'] === 'en') || titles[0];
        const title = titleEn?.$ || titleEn?.['#text'] || '';

        const inventorList = docInfo?.parties?.inventors?.inventor;
        const invArray = Array.isArray(inventorList) ? inventorList : inventorList ? [inventorList] : [];
        const inventors = invArray
          .filter((i: any) => i['@data-format'] === 'epodoc' || !i['@data-format'])
          .map((i: any) => i['inventor-name']?.name?.$ || i['inventor-name']?.name?.['#text'] || '')
          .filter(Boolean);

        const applicantList = docInfo?.parties?.applicants?.applicant;
        const appArray = Array.isArray(applicantList) ? applicantList : applicantList ? [applicantList] : [];
        const applicants = appArray
          .filter((a: any) => a['@data-format'] === 'epodoc' || !a['@data-format'])
          .map((a: any) => a['applicant-name']?.name?.$ || a['applicant-name']?.name?.['#text'] || '')
          .filter(Boolean);

        const ipcRef = docInfo?.['classifications-ipcr']?.['classification-ipcr'];
        const ipcArr = Array.isArray(ipcRef) ? ipcRef : ipcRef ? [ipcRef] : [];
        const ipcClassifications = ipcArr.map((c: any) => (c.text?.$ || c.text?.['#text'] || '').trim()).filter(Boolean);

        const dateNode = docInfo?.['publication-reference']?.['document-id']?.[0]?.date?.$
          || docInfo?.['publication-reference']?.['document-id']?.date?.$
          || '';
        const publicationDate = formatEPODate(dateNode);

        return {
          publicationNumber: docNum,
          title: title.slice(0, 200),
          applicationDate: publicationDate,
          publicationDate,
          inventors,
          applicants,
          ipcClassifications,
        };
      });

      return {
        inventorName,
        totalFound,
        patents,
      };
    } catch (err: any) {
      return {
        inventorName,
        totalFound: 0,
        patents: [],
        errorMessage: err?.message || 'EPO error',
      };
    }
  });
}

function formatEPODate(d: string): string {
  if (!d || d.length !== 8) return d || '';
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

// ============================================================================
// PAPPERS - REGISTRE RCS FRANCAIS
// ============================================================================
// Doc : https://www.pappers.fr/api/documentation
// Auth : api-key dans query string
// Quotas : essai gratuit 50 req, abonnements payants

export interface PappersDirigeant {
  nom: string;
  prenom: string;
  dateNaissance?: string;
  dateNaissanceRgpd?: string;
  qualite: string; // ex 'Président', 'Directeur Général'
  entreprise: {
    siren: string;
    nomEntreprise: string;
    formeJuridique?: string;
    dateCreation?: string;
    capital?: number;
    effectif?: string;
    statutRcs?: 'Inscrit' | 'Radié';
    domainesActivites?: string[];
  };
  dateDebutMandat?: string;
  dateFinMandat?: string;
}

export interface PappersDirigeantSearchResult {
  searchedName: string;
  totalFound: number;
  results: PappersDirigeant[];
  errorMessage?: string;
}

export async function searchPappersDirigeant(
  fullName: string,
  limit: number = 20,
): Promise<PappersDirigeantSearchResult | null> {
  const apiKey = process.env.PAPPERS_API_KEY;
  if (!apiKey) return null;

  // Pappers attend prenom et nom separes. On split au plus simple.
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) {
    return { searchedName: fullName, totalFound: 0, results: [] };
  }
  const prenom = parts[0];
  const nom = parts.slice(1).join(' ');

  return cached(`pappers:dirigeant:${fullName}:${limit}`, async () => {
    try {
      const params = new URLSearchParams({
        api_token: apiKey,
        prenom,
        nom,
        precision: 'standard',
        par_page: String(Math.min(limit, 50)),
      });
      const url = `https://api.pappers.fr/v2/recherche-dirigeants?${params}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(7000) });

      if (!res.ok) {
        return {
          searchedName: fullName,
          totalFound: 0,
          results: [],
          errorMessage: `Pappers HTTP ${res.status}`,
        };
      }

      const data = await res.json();
      const total = data?.total || 0;
      const items = data?.resultats || [];

      // Pappers retourne un dirigeant par entreprise. Regroupement et
      // formatage pour exposer simplement les mandats.
      const results: PappersDirigeant[] = items.map((d: any) => ({
        nom: d.nom || '',
        prenom: d.prenom || '',
        dateNaissance: d.date_de_naissance || undefined,
        dateNaissanceRgpd: d.date_de_naissance_rgpd || undefined,
        qualite: d.qualite || '',
        dateDebutMandat: d.date_prise_de_poste || undefined,
        dateFinMandat: d.date_fin_mandat || undefined,
        entreprise: {
          siren: d.entreprise?.siren || '',
          nomEntreprise: d.entreprise?.nom_entreprise || d.entreprise?.denomination || '',
          formeJuridique: d.entreprise?.forme_juridique || undefined,
          dateCreation: d.entreprise?.date_creation || undefined,
          capital: d.entreprise?.capital || undefined,
          effectif: d.entreprise?.tranche_effectif || undefined,
          statutRcs: d.entreprise?.statut_rcs || undefined,
          domainesActivites: d.entreprise?.domaines_activites || [],
        },
      }));

      return {
        searchedName: fullName,
        totalFound: total,
        results,
      };
    } catch (err: any) {
      return {
        searchedName: fullName,
        totalFound: 0,
        results: [],
        errorMessage: err?.message || 'Pappers error',
      };
    }
  });
}

// ============================================================================
// SCORES OBJECTIFS DERIVE DES SOURCES SECTORIELLES
// ============================================================================

export interface SectorialScores {
  patents_signature: number; // 0-100, base sur EPO
  registry_depth: number;    // 0-100, base sur Pappers (mandats actifs + historiques)
  rationale: string;         // explication breve
}

export function computeSectorialScores(
  epo: EPOSearchResult | null,
  pappers: PappersDirigeantSearchResult | null,
): SectorialScores {
  let patents = 0;
  let registry = 0;
  const reasons: string[] = [];

  if (epo) {
    if (epo.totalFound >= 20) patents = 95;
    else if (epo.totalFound >= 10) patents = 80;
    else if (epo.totalFound >= 5) patents = 65;
    else if (epo.totalFound >= 2) patents = 45;
    else if (epo.totalFound === 1) patents = 25;
    if (epo.totalFound > 0) {
      reasons.push(`${epo.totalFound} brevet(s) EPO comme inventeur`);
    } else {
      reasons.push('aucun brevet EPO trouve');
    }
  }

  if (pappers) {
    const total = pappers.totalFound;
    const inscrits = pappers.results.filter(d => d.entreprise?.statutRcs === 'Inscrit').length;
    if (total >= 5 && inscrits >= 2) registry = 85;
    else if (total >= 3) registry = 70;
    else if (total >= 1) registry = 50;
    if (total > 0) {
      reasons.push(`${total} mandat(s) Pappers (${inscrits} entreprise(s) actives)`);
    } else {
      reasons.push('aucun mandat Pappers trouve');
    }
  }

  return {
    patents_signature: patents,
    registry_depth: registry,
    rationale: reasons.join(' ; ') || 'sources sectorielles non interrogees ou desactivees',
  };
}

// Helper : enrichit un FounderRealData avec les sources EPO + Pappers si
// le profileType le justifie. Appele depuis gatherFounderRealData.
export async function gatherSectorialDataForFounder(
  fullName: string,
  profileType: string | undefined,
): Promise<{
  epo: EPOSearchResult | null;
  pappers: PappersDirigeantSearchResult | null;
  sectorialScores: SectorialScores;
}> {
  // On enrichit pour business_industrial, mixed, et unknown
  // (academique pur n a generalement pas de mandats RCS / brevets perso).
  const shouldEnrich = profileType === 'business_industrial'
    || profileType === 'mixed'
    || profileType === 'unknown'
    || profileType === undefined;

  if (!shouldEnrich) {
    return {
      epo: null,
      pappers: null,
      sectorialScores: computeSectorialScores(null, null),
    };
  }

  // Lance les deux requetes en parallele avec timeout court
  const [epo, pappers] = await Promise.all([
    Promise.race([
      searchEPOPatentsByInventor(fullName).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]),
    Promise.race([
      searchPappersDirigeant(fullName).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 7000)),
    ]),
  ]);

  return {
    epo,
    pappers,
    sectorialScores: computeSectorialScores(epo, pappers),
  };
}
