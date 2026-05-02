// Adapter EPO Espacenet (OPS API).
// Office europeen des brevets, base mondiale unifiee. Utilise pour :
//   - Verifier qu un fondateur ou une entreprise a vraiment depose des brevets
//   - Extraire les classifications IPC/CPC pour evaluer la cible technique
//   - Identifier les co-inventeurs (signaux d equipe technique reelle)
//
// Auth : OAuth2 client_credentials. Free tier : 4Go/semaine, largement
// suffisant pour de l instruction VC. Cle a creer sur developers.epo.org.
//
// Documentation : https://developers.epo.org/ops-v3-2/apis
//
// Note : si EPO_OPS_KEY et EPO_OPS_SECRET sont absents, l adapter retourne
// null systematiquement. Le moteur appelant doit le detecter et flagger
// la source comme indisponible (sans casser l analyse).

import type { AdapterContext, AdapterCitation } from './types';
import { safeJsonFetch } from './types';

interface EpoTokenResponse {
  access_token: string;
  expires_in: number;
}

interface EpoAccessToken {
  token: string;
  expiresAt: number;
}

let cachedToken: EpoAccessToken | null = null;

async function getEpoAccessToken(): Promise<string | null> {
  // Cache memoire : reutilise le token tant qu il est valide.
  // Sur un serverless, le cache est par-instance — c est OK, le
  // surcout est minimal (un refresh par cold start).
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }

  const key = process.env.EPO_OPS_KEY;
  const secret = process.env.EPO_OPS_SECRET;
  if (!key || !secret) return null;

  const basic = Buffer.from(`${key}:${secret}`).toString('base64');
  try {
    const res = await fetch('https://ops.epo.org/3.2/auth/accesstoken', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as EpoTokenResponse;
    cachedToken = {
      token: json.access_token,
      expiresAt: Date.now() + (json.expires_in * 1000),
    };
    return cachedToken.token;
  } catch {
    return null;
  }
}

export interface EpoPatentRecord {
  publicationNumber: string;
  title: string;
  applicants: string[];
  inventors: string[];
  publicationDate: string;
  ipcClasses: string[];
  url: string;
}

/**
 * Recherche les brevets dont le demandeur (applicant) ou l inventeur
 * matche le nom passe. Utile pour verifier la trace IP d un fondateur
 * ou d une entreprise.
 *
 * Retourne au plus n resultats (defaut 10), tries par date de publication
 * descendante. Retourne tableau vide si pas de resultats ou si la source
 * n est pas configuree.
 */
export async function searchEpoPatents(
  query: string,
  opts: AdapterContext & { maxResults?: number } = {},
): Promise<EpoPatentRecord[]> {
  const token = await getEpoAccessToken();
  if (!token) {
    opts.emit?.('adapter:skipped', { source: 'epo-espacenet', reason: 'no_credentials' });
    return [];
  }

  const max = Math.min(opts.maxResults ?? 10, 25);
  // Espacenet CQL : 'pa' (applicant) OR 'in' (inventor)
  const cql = `pa="${query}" OR in="${query}"`;
  const url = `https://ops.epo.org/3.2/rest-services/published-data/search/biblio?q=${encodeURIComponent(cql)}&Range=1-${max}`;

  opts.emit?.('adapter:start', { source: 'epo-espacenet', query });

  const json = await safeJsonFetch<any>(url, {
    budgetMs: opts.budgetMs ?? 10_000,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!json) {
    opts.emit?.('adapter:miss', { source: 'epo-espacenet', query });
    return [];
  }

  // Schema EPO OPS : json["ops:world-patent-data"]["ops:biblio-search"]["ops:search-result"]["exchange-documents"]
  // En cas de 0 hit, ces chemins sont absents. On parse defensivement.
  const docs = json?.['ops:world-patent-data']?.['ops:biblio-search']?.['ops:search-result']?.['exchange-documents'] || [];
  const docsArray = Array.isArray(docs) ? docs : [docs];

  const out: EpoPatentRecord[] = [];
  for (const doc of docsArray) {
    const ed = doc?.['exchange-document'];
    if (!ed) continue;
    try {
      const country = ed['@country'] || '';
      const docNumber = ed['@doc-number'] || '';
      const kind = ed['@kind'] || '';
      const publicationNumber = `${country}${docNumber}${kind}`;

      const biblio = ed['bibliographic-data'];
      const titleNode = biblio?.['invention-title'];
      const titles = Array.isArray(titleNode) ? titleNode : [titleNode];
      const enTitle = titles.find((t: any) => t?.['@lang'] === 'en') || titles[0];
      const title = enTitle?.['$'] || enTitle?.['#text'] || '(titre non disponible)';

      const partiesRoot = biblio?.parties;
      const applicants = extractParties(partiesRoot?.applicants?.applicant);
      const inventors = extractParties(partiesRoot?.inventors?.inventor);

      const pubRefs = biblio?.['publication-reference']?.['document-id'];
      const pubRefsArr = Array.isArray(pubRefs) ? pubRefs : [pubRefs];
      const docDb = pubRefsArr.find((r: any) => r?.['@document-id-type'] === 'docdb') || pubRefsArr[0];
      const pubDate = docDb?.date?.['$'] || docDb?.date?.['#text'] || '';

      const ipcNodes = biblio?.['classifications-ipcr']?.['classification-ipcr'];
      const ipcArr = Array.isArray(ipcNodes) ? ipcNodes : ipcNodes ? [ipcNodes] : [];
      const ipcClasses = ipcArr.map((c: any) => (c?.text?.['$'] || c?.text?.['#text'] || '').trim()).filter(Boolean);

      out.push({
        publicationNumber,
        title,
        applicants,
        inventors,
        publicationDate: formatPubDate(pubDate),
        ipcClasses,
        url: `https://worldwide.espacenet.com/patent/search/publication/${encodeURIComponent(publicationNumber)}`,
      });
    } catch {
      // Document mal formé, on saute.
    }
  }

  opts.emit?.('adapter:hit', { source: 'epo-espacenet', count: out.length });
  return out;
}

function extractParties(node: any): string[] {
  if (!node) return [];
  const arr = Array.isArray(node) ? node : [node];
  const names = new Set<string>();
  for (const p of arr) {
    const ref = p?.['applicant-name']?.name?.['$'] ||
                p?.['applicant-name']?.name?.['#text'] ||
                p?.['inventor-name']?.name?.['$'] ||
                p?.['inventor-name']?.name?.['#text'];
    if (ref) names.add(String(ref).trim());
  }
  return Array.from(names);
}

function formatPubDate(raw: string): string {
  // EPO retourne YYYYMMDD. On reformate en ISO YYYY-MM-DD pour lisibilite.
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

/**
 * Convertit un EpoPatentRecord en AdapterCitation pour usage par les
 * moteurs (uniformite des citations dans la note d investissement).
 */
export function epoPatentToCitation(rec: EpoPatentRecord): AdapterCitation {
  return {
    sourceId: 'epo-espacenet',
    url: rec.url,
    title: `${rec.publicationNumber} — ${rec.title}`,
    date: rec.publicationDate,
    tier: 1,
  };
}
