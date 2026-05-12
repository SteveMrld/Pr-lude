// ============================================================
// PRELUDE - Sectoral Intelligence Layer, fetchers de sources
// ------------------------------------------------------------
// Wrappers fins autour des sources structurees prescrites par la
// fiche conceptuelle. Chaque wrapper expose une signature
// uniforme qui retourne un payload typage minimal, sans tentative
// d agregation prematuree. Le LLM consomme ces payloads quand le
// regenerateur choisit de les pre-fetcher pour enrichir le
// contexte d une dimension, sinon il s appuie sur Anthropic web
// search natif.
//
// Tous les fetchers sont injectables : le regenerator peut
// recevoir une implementation alternative pour les tests
// deterministes (mocks renvoyant des payloads fixes) sans
// toucher au code de production.
// ============================================================

// ------------------------------------------------------------
// TYPES PAYLOAD UNIFORMES
// ------------------------------------------------------------

export interface FetchResult<T = unknown> {
  source: string;
  url: string;
  fetched_at: string;
  ok: boolean;
  payload: T | null;
  error?: string;
}

// ------------------------------------------------------------
// IMF DATAMAPPER API
// API publique, pas de cle. Retourne des series macro par pays
// ou par groupe de pays. Utilise pour cyclicite_macroeconomique.
// ------------------------------------------------------------

const IMF_BASE = 'https://www.imf.org/external/datamapper/api/v1';

export async function fetchIMF(
  indicator: string,
  countries?: string[],
): Promise<FetchResult> {
  const countriesPath = countries && countries.length > 0 ? `/${countries.join('/')}` : '';
  const url = `${IMF_BASE}/${encodeURIComponent(indicator)}${countriesPath}`;
  return performFetch('imf', url);
}

// ------------------------------------------------------------
// WORLD BANK API
// API publique, pas de cle. Retourne des indicateurs structurels
// par pays. Utilise pour intensite_capitalistique et concentration.
// ------------------------------------------------------------

const WORLD_BANK_BASE = 'https://api.worldbank.org/v2';

export async function fetchWorldBank(
  indicator: string,
  country = 'EUU',
): Promise<FetchResult> {
  const url = `${WORLD_BANK_BASE}/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(
    indicator,
  )}?format=json&per_page=20`;
  return performFetch('worldbank', url);
}

// ------------------------------------------------------------
// EUR-LEX
// Pas d API JSON publique stable, on utilise la search HTML qui
// peut etre parsee. Le wrapper retourne le HTML brut, charge au
// LLM ou au regenerator de le traiter. Sert pression_reglementaire.
// ------------------------------------------------------------

const EURLEX_SEARCH_BASE = 'https://eur-lex.europa.eu/search.html';

export async function fetchEURLex(query: string): Promise<FetchResult> {
  const url = `${EURLEX_SEARCH_BASE}?qid=&text=${encodeURIComponent(query)}&scope=EURLEX&type=quick&lang=fr`;
  return performFetch('eurlex', url, { accept: 'text/html' });
}

// ------------------------------------------------------------
// OPENALEX
// API publique, retour JSON. Tres riche pour la mobilite
// academique et le rythme de publication. Sert velocite_technologique
// et tension_capital_talent.
// ------------------------------------------------------------

const OPENALEX_BASE = 'https://api.openalex.org';

export async function fetchOpenAlex(
  query: string,
  filter?: string,
): Promise<FetchResult> {
  const filterPart = filter ? `&filter=${encodeURIComponent(filter)}` : '';
  const url = `${OPENALEX_BASE}/works?search=${encodeURIComponent(query)}${filterPart}&per-page=25`;
  return performFetch('openalex', url);
}

// ------------------------------------------------------------
// ARXIV
// API publique, retour Atom XML. Sert velocite_technologique sur
// les domaines techniques (CS, EE, q-bio).
// ------------------------------------------------------------

const ARXIV_BASE = 'http://export.arxiv.org/api/query';

export async function fetchArxiv(
  query: string,
  maxResults = 25,
): Promise<FetchResult<string>> {
  const url = `${ARXIV_BASE}?search_query=${encodeURIComponent(query)}&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;
  const res = await performFetch<string>('arxiv', url, { accept: 'application/atom+xml', parseAsText: true });
  return res;
}

// ------------------------------------------------------------
// GITHUB SEARCH
// API publique, retour JSON. Sert velocite_technologique
// (activite open source). Optionnellement avec token si
// GITHUB_TOKEN est defini pour rate limit confortable.
// ------------------------------------------------------------

const GITHUB_BASE = 'https://api.github.com';

export async function fetchGitHub(
  query: string,
  endpoint: 'repositories' | 'code' = 'repositories',
): Promise<FetchResult> {
  const url = `${GITHUB_BASE}/search/${endpoint}?q=${encodeURIComponent(query)}&per_page=25`;
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return performFetch('github', url, { headers });
}

// ------------------------------------------------------------
// WEB SEARCH WRAPPER
// Anthropic expose un tool natif web_search active via
// callClaude(...,{ enableWebSearch: true }). Ce wrapper sert de
// faisable point d entree typage si on veut declencher une
// recherche en dehors d un appel LLM dimension (par exemple pour
// du pre-fetching contextuel). En usage standard, le regenerator
// active web_search directement dans l appel LLM et n appelle
// pas ce wrapper.
// ------------------------------------------------------------

export interface WebSearchResult {
  query: string;
  used_native: boolean;
  // Place-holder, l API native d Anthropic injecte les resultats
  // dans la reponse LLM elle-meme. Si on veut un cache externe,
  // c est ici qu il se place.
  raw: unknown;
}

export async function webSearch(query: string): Promise<FetchResult<WebSearchResult>> {
  // Pas d appel API directement ici : la recherche se fait via le
  // tool natif Anthropic, declenche par l appel LLM. Le wrapper
  // retourne un payload synthetique qui signale que la recherche
  // doit etre delegue au LLM avec enableWebSearch=true.
  return {
    source: 'web_search',
    url: `anthropic:web_search?q=${encodeURIComponent(query)}`,
    fetched_at: new Date().toISOString(),
    ok: true,
    payload: {
      query,
      used_native: true,
      raw: null,
    },
  };
}

// ------------------------------------------------------------
// INTERFACE D INJECTION
// L objet SectoralFetchers regroupe l ensemble des fetchers et
// peut etre passe au regenerator pour override en test.
// ------------------------------------------------------------

export interface SectoralFetchers {
  imf: typeof fetchIMF;
  worldBank: typeof fetchWorldBank;
  eurLex: typeof fetchEURLex;
  openAlex: typeof fetchOpenAlex;
  arxiv: typeof fetchArxiv;
  github: typeof fetchGitHub;
  webSearch: typeof webSearch;
}

export const defaultFetchers: SectoralFetchers = {
  imf: fetchIMF,
  worldBank: fetchWorldBank,
  eurLex: fetchEURLex,
  openAlex: fetchOpenAlex,
  arxiv: fetchArxiv,
  github: fetchGitHub,
  webSearch,
};

// ------------------------------------------------------------
// HELPER INTERNE
// performFetch encapsule fetch() avec timeout et gestion d erreur
// uniforme. Pas de retry agressif : un fetcher qui echoue est
// signale a l appelant, qui decide de la suite. Le LLM peut
// degrader proprement sur data_missing si une source critique
// reste injoignable.
// ------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 15_000;

interface PerformFetchOptions {
  timeoutMs?: number;
  accept?: string;
  headers?: Record<string, string>;
  parseAsText?: boolean;
}

async function performFetch<T = unknown>(
  source: string,
  url: string,
  options: PerformFetchOptions = {},
): Promise<FetchResult<T>> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetched_at = new Date().toISOString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      Accept: options.accept ?? 'application/json',
      'User-Agent': 'Prelude-Sectoral-Intelligence/1.0 (research)',
      ...(options.headers ?? {}),
    };

    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) {
      return {
        source,
        url,
        fetched_at,
        ok: false,
        payload: null,
        error: `HTTP ${res.status} ${res.statusText}`,
      };
    }

    let payload: T;
    if (options.parseAsText) {
      payload = (await res.text()) as T;
    } else {
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        payload = (await res.json()) as T;
      } else {
        payload = (await res.text()) as T;
      }
    }

    return { source, url, fetched_at, ok: true, payload };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { source, url, fetched_at, ok: false, payload: null, error };
  } finally {
    clearTimeout(timer);
  }
}
