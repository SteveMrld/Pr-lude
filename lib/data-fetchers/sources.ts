// Couche de récupération de données réelles depuis APIs publiques gratuites.
// Utilisé par les moteurs pour enrichir l'analyse avec des faits vérifiables
// avant de passer à Claude pour synthèse.

export interface OpenAlexAuthor {
  id: string;
  display_name: string;
  works_count: number;
  cited_by_count: number;
  h_index: number;
  i10_index: number;
  institutions: string[];
  top_concepts: string[];
  orcid: string | null;
}

export interface OpenAlexWork {
  title: string;
  year: number;
  cited_by: number;
  venue: string;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  company: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  profile_url: string;
}

export interface GitHubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  updated_at: string;
}

export interface WikipediaSummary {
  lang: string;
  title: string;
  extract: string;
  url: string;
}

export interface ArxivPaper {
  title: string;
  published: string;
  url: string;
}

const HEADERS = { 'User-Agent': 'Prelude/1.0 (+https://pr-lude.vercel.app)' };

// ============================================================
// INFRASTRUCTURE FETCHERS (cache, flag, budget, tracking)
// ============================================================

export type FetcherEvent =
  | 'fetcher:start'
  | 'fetcher:hit'
  | 'fetcher:miss'
  | 'fetcher:timeout'
  | 'fetcher:skipped'
  | 'fetcher:budget_exceeded';

export interface FetcherOpts {
  emit?: (event: FetcherEvent, data: Record<string, unknown>) => void;
  budgetMs?: number;
}

// Sources connues (whitelist pour le flag)
export type SourceName =
  | 'wikipedia'
  | 'github'
  | 'hackernews'
  | 'openalex'
  | 'arxiv'
  | 'worldbank'
  | 'imf'        // Fonds Monetaire International WEO Database
  | 'epo'        // Espacenet OPS : brevets europeens (OAuth2)
  | 'pappers';   // Pappers : registre RCS francais (api-key)

const DEFAULT_ENABLED_SOURCES: SourceName[] = ['wikipedia'];

function readEnabledSources(): SourceName[] | 'all' | 'none' {
  const raw = process.env.PRELUDE_ENABLED_SOURCES?.trim();
  if (!raw) return DEFAULT_ENABLED_SOURCES;
  const lower = raw.toLowerCase();
  if (lower === 'all') return 'all';
  if (lower === 'none') return 'none';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) as SourceName[];
}

export function isSourceEnabled(source: SourceName): boolean {
  const cfg = readEnabledSources();
  if (cfg === 'all') return true;
  if (cfg === 'none') return false;
  return cfg.includes(source);
}

// Cache mémoire process-local. Sur Vercel serverless, vit le temps d'une
// invocation. C'est exactement ce qu'on veut : déduplication intra-pipeline,
// pas de partage inter-pipeline (qui poserait des problèmes de fraîcheur).
const fetchCache = new Map<string, Promise<unknown>>();

export function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = fetchCache.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().catch((e) => {
    fetchCache.delete(key);
    throw e;
  });
  fetchCache.set(key, p);
  return p as Promise<T>;
}

// Budget global par moteur. Si la promesse passée dépasse `ms`, on logue
// un warning, on émet l'event SSE, et on retourne `fallback` sans annuler
// les fetches sous-jacents (qui ont déjà leur propre AbortController).
export async function withBudget<T>(
  engineLabel: string,
  ms: number,
  promise: Promise<T>,
  fallback: T,
  opts?: FetcherOpts,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(
        `[Prelude] Fetchers ${engineLabel} budget dépassé après ${ms}ms, on continue avec sources partielles`,
      );
      opts?.emit?.('fetcher:budget_exceeded', { engine: engineLabel, budgetMs: ms });
      resolve(fallback);
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Wrapper qui émet start/hit/miss/timeout autour d'un fetch source.
// `isEmpty` permet de distinguer une réponse vide d'une réponse utile.
export async function trackedSource<T>(
  engine: string,
  source: SourceName,
  fn: () => Promise<T>,
  isEmpty: (result: T) => boolean,
  emptyValue: T,
  opts?: FetcherOpts,
  sourceTimeoutMs: number = 5000,
): Promise<T> {
  if (!isSourceEnabled(source)) {
    opts?.emit?.('fetcher:skipped', { engine, source });
    return emptyValue;
  }
  const t0 = Date.now();
  opts?.emit?.('fetcher:start', { engine, source });
  try {
    const result = await fn();
    const elapsedMs = Date.now() - t0;
    // Heuristique : si on est très près du timeout source, c'est probablement un timeout
    if (isEmpty(result) && elapsedMs >= sourceTimeoutMs - 200) {
      opts?.emit?.('fetcher:timeout', { engine, source, elapsedMs });
    } else if (isEmpty(result)) {
      opts?.emit?.('fetcher:miss', { engine, source, elapsedMs });
    } else {
      opts?.emit?.('fetcher:hit', { engine, source, elapsedMs });
    }
    return result;
  } catch (e) {
    const elapsedMs = Date.now() - t0;
    opts?.emit?.('fetcher:timeout', { engine, source, elapsedMs });
    return emptyValue;
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 5000): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (e) {
    return null;
  }
}

// ============================================================
// OPENALEX (publications académiques mondiales, gratuit)
// ============================================================

export async function searchOpenAlexAuthor(name: string, affiliationHint?: string): Promise<OpenAlexAuthor | null> {
  const url = `https://api.openalex.org/authors?search=${encodeURIComponent(name)}&per_page=5`;
  const r = await fetchWithTimeout(url, { headers: HEADERS });
  if (!r || !r.ok) return null;

  const data = await r.json();
  const results = data?.results || [];
  if (results.length === 0) return null;

  let best = results[0];
  if (affiliationHint) {
    for (const r2 of results) {
      const affs = r2.last_known_institutions || [];
      const affNames = affs.map((a: any) => a.display_name || '');
      if (affNames.some((a: string) => a.toLowerCase().includes(affiliationHint.toLowerCase()))) {
        best = r2;
        break;
      }
    }
  }

  return {
    id: best.id,
    display_name: best.display_name,
    works_count: best.works_count || 0,
    cited_by_count: best.cited_by_count || 0,
    h_index: best.summary_stats?.h_index || 0,
    i10_index: best.summary_stats?.i10_index || 0,
    institutions: (best.last_known_institutions || []).map((a: any) => a.display_name).filter(Boolean),
    top_concepts: (best.x_concepts || []).slice(0, 5).map((c: any) => c.display_name).filter(Boolean),
    orcid: best.orcid || null,
  };
}

export async function getOpenAlexRecentWorks(authorId: string, n: number = 5): Promise<OpenAlexWork[]> {
  const authorShort = authorId?.split('/').pop();
  if (!authorShort) return [];
  const url = `https://api.openalex.org/works?filter=author.id:${authorShort}&sort=publication_year:desc&per_page=${n}`;
  const r = await fetchWithTimeout(url, { headers: HEADERS });
  if (!r || !r.ok) return [];
  const data = await r.json();
  const works = data?.results || [];
  return works.map((w: any) => ({
    title: w.title || '',
    year: w.publication_year || 0,
    cited_by: w.cited_by_count || 0,
    venue: w.primary_location?.source?.display_name || '',
  }));
}

// ============================================================
// GITHUB (présence technique, gratuit avec rate limit 60/h sans auth)
// ============================================================

export async function searchGitHubUser(name: string): Promise<GitHubUser | null> {
  const url = `https://api.github.com/search/users?q=${encodeURIComponent(name)}+in:fullname&per_page=3`;
  const r = await fetchWithTimeout(url, {
    headers: { ...HEADERS, 'Accept': 'application/vnd.github+json' }
  });
  if (!r || !r.ok) return null;

  const data = await r.json();
  const items = data?.items || [];
  if (items.length === 0) return null;

  const login = items[0].login;
  if (!login) return null;

  const detailUrl = `https://api.github.com/users/${login}`;
  const rd = await fetchWithTimeout(detailUrl, {
    headers: { ...HEADERS, 'Accept': 'application/vnd.github+json' }
  });
  if (!rd || !rd.ok) return null;
  const detail = await rd.json();

  return {
    login: detail.login,
    name: detail.name,
    company: detail.company,
    bio: detail.bio,
    public_repos: detail.public_repos || 0,
    followers: detail.followers || 0,
    following: detail.following || 0,
    created_at: detail.created_at,
    profile_url: detail.html_url,
  };
}

export async function getGitHubTopRepos(login: string, n: number = 5): Promise<GitHubRepo[]> {
  const url = `https://api.github.com/users/${login}/repos?sort=updated&per_page=30`;
  const r = await fetchWithTimeout(url, {
    headers: { ...HEADERS, 'Accept': 'application/vnd.github+json' }
  });
  if (!r || !r.ok) return [];
  const repos = await r.json();
  if (!Array.isArray(repos)) return [];
  const sorted = [...repos].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));
  return sorted.slice(0, n).map((r: any) => ({
    name: r.name,
    description: r.description,
    language: r.language,
    stars: r.stargazers_count || 0,
    forks: r.forks_count || 0,
    updated_at: r.updated_at,
  }));
}

// ============================================================
// WIKIPEDIA (présence publique structurée, gratuit illimité)
// ============================================================

export async function searchWikipedia(name: string): Promise<WikipediaSummary | null> {
  for (const lang of ['en', 'fr']) {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
    const r = await fetchWithTimeout(url, { headers: HEADERS });
    if (r && r.ok) {
      const data = await r.json();
      if (data?.type === 'standard') {
        return {
          lang,
          title: data.title,
          extract: data.extract,
          url: data.content_urls?.desktop?.page || '',
        };
      }
    }
  }
  return null;
}

// ============================================================
// ARXIV (preprints scientifiques récents, gratuit)
// ============================================================

export async function searchArxiv(name: string, n: number = 3): Promise<ArxivPaper[]> {
  const query = `au:${name.replace(/\s+/g, '+')}`;
  const url = `http://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=${n}&sortBy=submittedDate&sortOrder=descending`;
  const r = await fetchWithTimeout(url, { headers: HEADERS });
  if (!r || !r.ok) return [];
  const text = await r.text();

  const entries = text.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
  return entries.slice(0, n).map(entry => {
    const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
    const publishedMatch = entry.match(/<published>(.*?)<\/published>/);
    const idMatch = entry.match(/<id>(.*?)<\/id>/);
    return {
      title: titleMatch ? titleMatch[1].trim().replace(/\n/g, ' ') : '',
      published: publishedMatch ? publishedMatch[1].slice(0, 10) : '',
      url: idMatch ? idMatch[1] : '',
    };
  });
}

// ============================================================
// HACKER NEWS ALGOLIA (mentions tech, gratuit illimité)
// ============================================================

export async function searchHackerNews(query: string, n: number = 5): Promise<{ title: string; points: number; url: string; date: string }[]> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=${n}&tags=story`;
  const r = await fetchWithTimeout(url, { headers: HEADERS });
  if (!r || !r.ok) return [];
  const data = await r.json();
  const hits = data?.hits || [];
  return hits.map((h: any) => ({
    title: h.title || '',
    points: h.points || 0,
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    date: h.created_at?.slice(0, 10) || '',
  }));
}

// ============================================================
// PROFIL CONSOLIDÉ D'UN FONDATEUR
// ============================================================

export interface FounderRealData {
  name: string;
  affiliationHint?: string;
  sourcesQueried: string[];
  sourcesFound: string[];
  openalex?: OpenAlexAuthor;
  recentPublications?: OpenAlexWork[];
  github?: GitHubUser;
  topRepos?: GitHubRepo[];
  wikipedia?: WikipediaSummary;
  arxivRecent?: ArxivPaper[];
  // Niveau 2.B : sources sectorielles dedicacees aux profils business /
  // industriel / hardware. Renseignes uniquement si EPO_OAUTH_CLIENT_ID
  // / PAPPERS_API_KEY sont configures et si le profileType le justifie.
  // Voir lib/data-fetchers/sources-sectorial.ts.
  epo?: {
    inventorName: string;
    totalFound: number;
    patents: Array<{
      publicationNumber: string;
      title: string;
      applicationDate: string;
      publicationDate: string;
      inventors: string[];
      applicants: string[];
      ipcClassifications: string[];
    }>;
    errorMessage?: string;
  };
  pappers?: {
    searchedName: string;
    totalFound: number;
    results: Array<{
      nom: string;
      prenom: string;
      qualite: string;
      dateDebutMandat?: string;
      dateFinMandat?: string;
      entreprise: {
        siren: string;
        nomEntreprise: string;
        formeJuridique?: string;
        dateCreation?: string;
        statutRcs?: 'Inscrit' | 'Radié';
      };
    }>;
    errorMessage?: string;
  };
  sectorialScores?: {
    patents_signature: number;
    registry_depth: number;
    rationale: string;
  };
  // Faits vérifiables consolidés
  verifiableFacts: {
    openalex_pubs: number;
    openalex_h_index: number;
    openalex_citations: number;
    openalex_institutions: string[];
    github_login: string | null;
    github_followers: number;
    github_repos: number;
    top_github_repo_stars: number;
    top_github_repo_name: string | null;
    wikipedia_present: boolean;
    recent_arxiv_count: number;
  };
  // Scores objectifs basés sur les faits
  objectiveScores: {
    scientific_signature: number;
    technical_signature: number;
    public_presence: number;
    recent_activity: number;
  };
  // Type de profil estime a partir du background. Sert a calibrer
  // l interpretation des scores objectifs : un profil business/industriel
  // avec scores academiques 0/100 n est PAS un red flag, c est attendu.
  // Valeurs : 'academic' | 'tech_open_source' | 'business_industrial' | 'mixed' | 'unknown'
  profileType?: 'academic' | 'tech_open_source' | 'business_industrial' | 'mixed' | 'unknown';
  // Indique si les scores objectifs sont applicables au profil. Pour un
  // profil business/industriel pur, scientific_signature et technical_signature
  // (au sens GitHub OSS) ne sont PAS des metriques pertinentes.
  scoresApplicability?: {
    scientific_applicable: boolean;
    technical_applicable: boolean;
    public_applicable: boolean;
    recent_applicable: boolean;
    rationale: string;
  };
  profileSignals: string[];
}

export async function gatherFounderRealData(
  name: string,
  affiliationHint?: string,
  opts?: FetcherOpts,
): Promise<FounderRealData> {
  const queriedSources: string[] = [];
  if (isSourceEnabled('openalex')) queriedSources.push('openalex');
  if (isSourceEnabled('github')) queriedSources.push('github');
  if (isSourceEnabled('wikipedia')) queriedSources.push('wikipedia');
  if (isSourceEnabled('arxiv')) queriedSources.push('arxiv');

  // Classification du profil a partir du hint d affiliation. Heuristique
  // simple mais ciblee : evite de penaliser des profils business / hardware
  // pour lesquels OpenAlex / GitHub / Wikipedia ne sont pas des sources
  // pertinentes. Le team-engine recoit ce profileType et calibre son
  // interpretation des scores 0/100.
  const bg = (affiliationHint || '').toLowerCase();
  const academicMarkers = ['inria', 'inserm', 'cnrs', 'mit', 'stanford', 'harvard', 'berkeley', 'cambridge', 'oxford', 'eth', 'epfl', 'phd', 'professor', 'researcher', 'postdoc', 'phd student'];
  const techOSSMarkers = ['google', 'meta', 'facebook', 'deepmind', 'openai', 'anthropic', 'mistral', 'apple', 'microsoft', 'github', 'gitlab', 'open source', 'kernel', 'linux foundation'];
  const businessMarkers = ['accenture', 'mckinsey', 'bcg', 'bain', 'deloitte', 'kpmg', 'pwc', 'ey', 'consulting', 'consultant', 'sales', 'marketing', 'business', 'manager', 'director', 'ceo', 'coo', 'cfo', 'partner'];
  const industrialMarkers = ['valeo', 'bosch', 'siemens', 'continental', 'renault', 'peugeot', 'stellantis', 'airbus', 'safran', 'thales', 'industriel', 'industrial', 'manufacturing', 'usine', 'factory', 'chassis', 'mechanical', 'electronique', 'electrotechnique', 'electrical', 'engineer', 'ingenieur'];

  const isAcademic = academicMarkers.some(m => bg.includes(m));
  const isTechOSS = techOSSMarkers.some(m => bg.includes(m));
  const isBusiness = businessMarkers.some(m => bg.includes(m));
  const isIndustrial = industrialMarkers.some(m => bg.includes(m));

  let profileType: FounderRealData['profileType'] = 'unknown';
  let scoresApplicability: FounderRealData['scoresApplicability'];

  if (isAcademic && !isBusiness && !isIndustrial) {
    profileType = 'academic';
    scoresApplicability = {
      scientific_applicable: true,
      technical_applicable: false,
      public_applicable: true,
      recent_applicable: true,
      rationale: 'Profil academique : OpenAlex pertinent, GitHub OSS optionnel.',
    };
  } else if (isTechOSS && !isBusiness && !isIndustrial) {
    profileType = 'tech_open_source';
    scoresApplicability = {
      scientific_applicable: false,
      technical_applicable: true,
      public_applicable: true,
      recent_applicable: true,
      rationale: 'Profil tech open-source : GitHub pertinent, OpenAlex optionnel.',
    };
  } else if (isBusiness || isIndustrial) {
    profileType = 'business_industrial';
    scoresApplicability = {
      scientific_applicable: false,
      technical_applicable: false,
      public_applicable: false,
      recent_applicable: false,
      rationale: 'Profil business / industriel : OpenAlex, GitHub OSS et Wikipedia ne sont PAS des sources pertinentes pour ce type de fondateur. L absence de signal sur ces sources est ATTENDUE et ne constitue pas un red flag. Verifier plutot LinkedIn, registres entreprises (Pappers, Sirene), brevets EPO, presse sectorielle.',
    };
  } else if (isAcademic && (isBusiness || isIndustrial)) {
    profileType = 'mixed';
    scoresApplicability = {
      scientific_applicable: true,
      technical_applicable: false,
      public_applicable: true,
      recent_applicable: true,
      rationale: 'Profil mixte academique + business / industriel : signal academique pertinent mais pas exhaustif.',
    };
  } else {
    profileType = 'unknown';
    scoresApplicability = {
      scientific_applicable: true,
      technical_applicable: true,
      public_applicable: true,
      recent_applicable: true,
      rationale: 'Profil non classifie : appliquer scores avec prudence, considerer comme indicatif et non determinant.',
    };
  }

  const result: any = {
    name,
    affiliationHint,
    sourcesQueried: queriedSources,
    sourcesFound: [],
    profileType,
    scoresApplicability,
  };

  // Aucune source active : retour structuré minimal (compat consommateurs)
  if (queriedSources.length === 0) {
    result.verifiableFacts = {
      openalex_pubs: 0, openalex_h_index: 0, openalex_citations: 0, openalex_institutions: [],
      github_login: null, github_followers: 0, github_repos: 0,
      top_github_repo_stars: 0, top_github_repo_name: null,
      wikipedia_present: false, recent_arxiv_count: 0,
    };
    result.objectiveScores = { scientific_signature: 0, technical_signature: 0, public_presence: 0, recent_activity: 0 };
    result.profileSignals = [];
    return result as FounderRealData;
  }

  const budgetMs = opts?.budgetMs ?? 8000;

  // Phase parallèle. Chaque source est bornée par son propre AbortController 5s
  // côté fetchWithTimeout, et par le budget global ici.
  const mainCollection = Promise.all([
    trackedSource<OpenAlexAuthor | null>(
      'team', 'openalex',
      () => cached(`openalex:author:${name}|${affiliationHint || ''}`,
        () => searchOpenAlexAuthor(name, affiliationHint).catch(() => null)),
      (r) => r === null,
      null,
      opts,
    ),
    trackedSource<GitHubUser | null>(
      'team', 'github',
      () => cached(`github:user:${name}`,
        () => searchGitHubUser(name).catch(() => null)),
      (r) => r === null,
      null,
      opts,
    ),
    trackedSource<WikipediaSummary | null>(
      'team', 'wikipedia',
      () => cached(`wikipedia:${name}`,
        () => searchWikipedia(name).catch(() => null)),
      (r) => r === null,
      null,
      opts,
    ),
    trackedSource<ArxivPaper[]>(
      'team', 'arxiv',
      () => cached(`arxiv:${name}:3`,
        () => searchArxiv(name, 3).catch(() => [] as ArxivPaper[])),
      (r) => r.length === 0,
      [],
      opts,
    ),
  ]).then(([openalex, github, wikipedia, arxiv]) => ({ openalex, github, wikipedia, arxiv }));

  const fallback = { openalex: null as OpenAlexAuthor | null, github: null as GitHubUser | null, wikipedia: null as WikipediaSummary | null, arxiv: [] as ArxivPaper[] };
  const { openalex, github, wikipedia, arxiv } = await withBudget(
    'team', budgetMs, mainCollection, fallback, opts,
  );

  if (openalex && openalex.works_count > 0) {
    result.openalex = openalex;
    result.sourcesFound.push('openalex');
    if (openalex.id) {
      result.recentPublications = await trackedSource<OpenAlexWork[]>(
        'team', 'openalex',
        () => cached(`openalex:works:${openalex.id}:3`,
          () => getOpenAlexRecentWorks(openalex.id, 3).catch(() => [])),
        (r) => r.length === 0,
        [],
        opts,
      );
    }
  }

  if (github) {
    result.github = github;
    result.sourcesFound.push('github');
    if (github.login) {
      result.topRepos = await trackedSource<GitHubRepo[]>(
        'team', 'github',
        () => cached(`github:repos:${github.login}:3`,
          () => getGitHubTopRepos(github.login, 3).catch(() => [])),
        (r) => r.length === 0,
        [],
        opts,
      );
    }
  }

  if (wikipedia) {
    result.wikipedia = wikipedia;
    result.sourcesFound.push('wikipedia');
  }

  if (arxiv && arxiv.length > 0) {
    result.arxivRecent = arxiv;
    result.sourcesFound.push('arxiv');
  }

  // Faits vérifiables consolidés
  const topRepoStars = Math.max(0, ...(result.topRepos || []).map((r: GitHubRepo) => r.stars));
  const topRepoName = (result.topRepos && result.topRepos.length > 0) ? result.topRepos[0].name : null;

  result.verifiableFacts = {
    openalex_pubs: result.openalex?.works_count || 0,
    openalex_h_index: result.openalex?.h_index || 0,
    openalex_citations: result.openalex?.cited_by_count || 0,
    openalex_institutions: result.openalex?.institutions || [],
    github_login: result.github?.login || null,
    github_followers: result.github?.followers || 0,
    github_repos: result.github?.public_repos || 0,
    top_github_repo_stars: topRepoStars,
    top_github_repo_name: topRepoName,
    wikipedia_present: result.sourcesFound.includes('wikipedia'),
    recent_arxiv_count: (result.arxivRecent || []).length,
  };

  // Scores objectifs basés sur les chiffres
  const v = result.verifiableFacts;
  let scientific = 0;
  if (v.openalex_h_index >= 25 || v.openalex_citations >= 5000) scientific = 95;
  else if (v.openalex_h_index >= 15 || v.openalex_citations >= 1500) scientific = 80;
  else if (v.openalex_h_index >= 8 || v.openalex_citations >= 500) scientific = 65;
  else if (v.openalex_h_index >= 3 || v.openalex_citations >= 100) scientific = 45;
  else if (v.openalex_h_index > 0) scientific = 25;

  let technical = 0;
  if (v.github_followers >= 5000 || v.top_github_repo_stars >= 10000) technical = 95;
  else if (v.github_followers >= 1000 || v.top_github_repo_stars >= 2000) technical = 80;
  else if (v.github_followers >= 200 || v.top_github_repo_stars >= 300) technical = 60;
  else if (v.github_followers >= 30 || v.top_github_repo_stars >= 30) technical = 35;
  else if (v.github_followers > 0 || v.github_repos > 0) technical = 15;

  let publicPresence = 0;
  const sourcesCount = result.sourcesFound.length;
  if (v.wikipedia_present && sourcesCount >= 3) publicPresence = 90;
  else if (sourcesCount >= 3) publicPresence = 65;
  else if (sourcesCount === 2) publicPresence = 40;
  else if (sourcesCount === 1) publicPresence = 20;

  const recentCount = v.recent_arxiv_count + (result.recentPublications?.length || 0);
  let recentActivity = 0;
  if (recentCount >= 5) recentActivity = 95;
  else if (recentCount >= 3) recentActivity = 75;
  else if (recentCount >= 1) recentActivity = 50;

  result.objectiveScores = {
    scientific_signature: scientific,
    technical_signature: technical,
    public_presence: publicPresence,
    recent_activity: recentActivity,
  };

  // Signaux profil
  const profileSignals: string[] = [];
  if (scientific >= 60) profileSignals.push('scientifique');
  if (technical >= 60) profileSignals.push('technique');
  if (publicPresence >= 60) profileSignals.push('public');
  result.profileSignals = profileSignals;

  // ============================================================
  // NIVEAU 2.B : ENRICHISSEMENT SECTORIEL (EPO + Pappers)
  // ------------------------------------------------------------
  // Pour les profils business / industriel / hardware, OpenAlex et
  // GitHub ne sont pas pertinents (cf fix profileType, commit
  // 979aa70). On enrichit avec deux sources sectorielles :
  //   - EPO Espacenet OPS : brevets europeens (validation expertise
  //     technique pour profils ingenieurs / inventeurs)
  //   - Pappers : registre RCS francais (mandats sociaux passes /
  //     actuels, validation trajectoire entreprise)
  //
  // Les deux sources sont controlees par variables d env :
  //   EPO_OAUTH_CLIENT_ID + EPO_OAUTH_CLIENT_SECRET pour EPO
  //   PAPPERS_API_KEY pour Pappers
  // Si non configurees, retournent null sans crash. L appel n est
  // declenche que si le profil est business_industrial / mixed /
  // unknown : un academique pur n a pas de mandats RCS / brevets perso.
  // ============================================================
  const epoEnabled = isSourceEnabled('epo') && process.env.EPO_OAUTH_CLIENT_ID && process.env.EPO_OAUTH_CLIENT_SECRET;
  const pappersEnabled = isSourceEnabled('pappers') && process.env.PAPPERS_API_KEY;

  if (epoEnabled || pappersEnabled) {
    try {
      // Import dynamique pour eviter le cout de chargement quand desactive
      const { gatherSectorialDataForFounder } = await import('./sources-sectorial');
      const sectorial = await gatherSectorialDataForFounder(name, profileType);

      if (sectorial.epo) {
        result.epo = sectorial.epo;
        if (sectorial.epo.totalFound > 0) result.sourcesFound.push('epo');
        if (!result.sourcesQueried.includes('epo')) result.sourcesQueried.push('epo');
      }
      if (sectorial.pappers) {
        result.pappers = sectorial.pappers;
        if (sectorial.pappers.totalFound > 0) result.sourcesFound.push('pappers');
        if (!result.sourcesQueried.includes('pappers')) result.sourcesQueried.push('pappers');
      }

      // Ajout des scores sectoriels au bloc objectiveScores
      result.sectorialScores = sectorial.sectorialScores;

      // Pour les profils business_industrial, on remappe technical_signature
      // sur le score brevets (plus pertinent que GitHub) et public_presence
      // sur le score Pappers (plus pertinent que Wikipedia).
      if (profileType === 'business_industrial') {
        result.objectiveScores = {
          ...result.objectiveScores,
          technical_signature: Math.max(result.objectiveScores.technical_signature, sectorial.sectorialScores.patents_signature),
          public_presence: Math.max(result.objectiveScores.public_presence, sectorial.sectorialScores.registry_depth),
        };
        // Mise a jour du rationale d applicabilite : ces scores sont
        // maintenant pertinents grace a EPO + Pappers
        if (result.scoresApplicability) {
          result.scoresApplicability.technical_applicable = sectorial.epo !== null;
          result.scoresApplicability.public_applicable = sectorial.pappers !== null;
          result.scoresApplicability.rationale = `Profil business / industriel : sources OpenAlex / GitHub OSS / Wikipedia non pertinentes, REMPLACEES par EPO (brevets) ${sectorial.epo ? '✓' : '✗ non configure'} et Pappers (registre RCS) ${sectorial.pappers ? '✓' : '✗ non configure'}.`;
        }
      }
    } catch (err: any) {
      console.warn('[sectorial] enrichment failed:', err?.message);
    }
  }

  return result as FounderRealData;
}

// ============================================================
// SOURCES POUR LE MOTEUR DE MARCHÉ
// ============================================================

export interface MarketSignal {
  source: string;
  signal: string;
  value: number | string;
  date?: string;
  url?: string;
}

// Hacker News : recherche par mots-clés produit / société / segment
export async function searchHackerNewsAdvanced(query: string, n: number = 10): Promise<{ hits: any[]; nbHits: number; topPoints: number; recentDate: string }> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=${n}&tags=story`;
  const r = await fetchWithTimeout(url, { headers: HEADERS });
  if (!r || !r.ok) return { hits: [], nbHits: 0, topPoints: 0, recentDate: '' };
  const data = await r.json();
  const hits = (data.hits || []).map((h: any) => ({
    title: h.title || '',
    points: h.points || 0,
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    date: h.created_at?.slice(0, 10) || '',
    num_comments: h.num_comments || 0,
  }));
  return {
    hits,
    nbHits: data.nbHits || 0,
    topPoints: Math.max(0, ...hits.map((h: any) => h.points)),
    recentDate: hits[0]?.date || '',
  };
}

// HN trends : compter les mentions sur 12 derniers mois pour estimer la tendance
export async function getHackerNewsTrend(query: string): Promise<{ recent: number; older: number; trend: 'up' | 'down' | 'stable' }> {
  // Recherche dernière année
  const now = Math.floor(Date.now() / 1000);
  const oneYearAgo = now - 365 * 24 * 3600;
  const twoYearsAgo = now - 2 * 365 * 24 * 3600;

  const recentUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>${oneYearAgo}&hitsPerPage=0`;
  const olderUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&numericFilters=created_at_i>${twoYearsAgo},created_at_i<${oneYearAgo}&hitsPerPage=0`;

  const [r1, r2] = await Promise.all([
    fetchWithTimeout(recentUrl, { headers: HEADERS }),
    fetchWithTimeout(olderUrl, { headers: HEADERS }),
  ]);

  const recent = r1 && r1.ok ? (await r1.json()).nbHits || 0 : 0;
  const older = r2 && r2.ok ? (await r2.json()).nbHits || 0 : 0;

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (older === 0 && recent > 0) trend = 'up';
  else if (older > 0) {
    const ratio = recent / older;
    if (ratio > 1.3) trend = 'up';
    else if (ratio < 0.7) trend = 'down';
  }

  return { recent, older, trend };
}

// OpenAlex : volume de publications académiques sur un concept (mesure d'émergence académique)
export async function getOpenAlexConceptTrend(concept: string): Promise<{ totalWorks: number; recentWorks: number; topConcepts: string[]; trend: 'up' | 'down' | 'stable' }> {
  // Cherche le concept
  const conceptUrl = `https://api.openalex.org/concepts?search=${encodeURIComponent(concept)}&per_page=1`;
  const r = await fetchWithTimeout(conceptUrl, { headers: HEADERS });
  if (!r || !r.ok) return { totalWorks: 0, recentWorks: 0, topConcepts: [], trend: 'stable' };

  const data = await r.json();
  const conceptData = (data.results || [])[0];
  if (!conceptData) return { totalWorks: 0, recentWorks: 0, topConcepts: [], trend: 'stable' };

  const conceptId = conceptData.id?.split('/').pop();
  if (!conceptId) return { totalWorks: 0, recentWorks: 0, topConcepts: [], trend: 'stable' };

  // Compter publications sur 2 dernières années vs 2 années précédentes
  const currentYear = new Date().getFullYear();
  const recentUrl = `https://api.openalex.org/works?filter=concepts.id:${conceptId},from_publication_date:${currentYear - 2}-01-01&per_page=1`;
  const olderUrl = `https://api.openalex.org/works?filter=concepts.id:${conceptId},from_publication_date:${currentYear - 4}-01-01,to_publication_date:${currentYear - 2}-12-31&per_page=1`;

  const [r1, r2] = await Promise.all([
    fetchWithTimeout(recentUrl, { headers: HEADERS }),
    fetchWithTimeout(olderUrl, { headers: HEADERS }),
  ]);

  const recentWorks = r1 && r1.ok ? (await r1.json()).meta?.count || 0 : 0;
  const olderWorks = r2 && r2.ok ? (await r2.json()).meta?.count || 0 : 0;

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (olderWorks === 0 && recentWorks > 0) trend = 'up';
  else if (olderWorks > 0) {
    const ratio = recentWorks / olderWorks;
    if (ratio > 1.3) trend = 'up';
    else if (ratio < 0.7) trend = 'down';
  }

  return {
    totalWorks: conceptData.works_count || 0,
    recentWorks,
    topConcepts: (conceptData.related_concepts || []).slice(0, 5).map((c: any) => c.display_name).filter(Boolean),
    trend,
  };
}

// Wikipedia : récupération du contexte sectoriel et des concurrents établis cités
export async function getWikipediaSector(sectorName: string): Promise<{ summary: string; relatedTopics: string[]; url: string } | null> {
  for (const lang of ['en', 'fr']) {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(sectorName)}`;
    const r = await fetchWithTimeout(url, { headers: HEADERS });
    if (r && r.ok) {
      const data = await r.json();
      if (data?.type === 'standard') {
        return {
          summary: data.extract || '',
          relatedTopics: [],
          url: data.content_urls?.desktop?.page || '',
        };
      }
    }
  }
  return null;
}

// Wikipedia : pages liées à un terme (utile pour identifier les concurrents historiques)
export async function getWikipediaRelated(term: string, n: number = 10): Promise<string[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(term)}&limit=${n}&namespace=0&format=json&origin=*`;
  const r = await fetchWithTimeout(url, { headers: HEADERS });
  if (!r || !r.ok) return [];
  const data = await r.json();
  if (!Array.isArray(data) || data.length < 2) return [];
  return data[1] || [];
}

// GitHub Topics : écosystème open source autour d'un sujet
export async function searchGitHubByTopic(topic: string, n: number = 5): Promise<{ name: string; stars: number; description: string; url: string; language: string | null }[]> {
  const url = `https://api.github.com/search/repositories?q=topic:${encodeURIComponent(topic)}&sort=stars&order=desc&per_page=${n}`;
  const r = await fetchWithTimeout(url, {
    headers: { ...HEADERS, 'Accept': 'application/vnd.github+json' }
  });
  if (!r || !r.ok) return [];
  const data = await r.json();
  return (data.items || []).map((item: any) => ({
    name: item.full_name,
    stars: item.stargazers_count || 0,
    description: item.description || '',
    url: item.html_url,
    language: item.language,
  }));
}

// ============================================================
// PROFIL CONSOLIDÉ DU MARCHÉ
// ============================================================

export interface MarketRealData {
  query: string;
  sourcesQueried: string[];
  sourcesFound: string[];
  hackerNews?: {
    totalMentions: number;
    topPoints: number;
    recentDate: string;
    sample: any[];
  };
  hackerNewsTrend?: {
    recent: number;
    older: number;
    trend: 'up' | 'down' | 'stable';
  };
  openalexConcept?: {
    totalWorks: number;
    recentWorks: number;
    relatedConcepts: string[];
    trend: 'up' | 'down' | 'stable';
  };
  wikipediaSector?: {
    summary: string;
    url: string;
  };
  wikipediaRelated?: string[];
  githubEcosystem?: {
    topRepos: any[];
    cumulativeStars: number;
  };
  // Scores objectifs basés sur faits récupérés
  objectiveScores: {
    organic_signals: number;
    academic_emergence: number;
    technical_ecosystem: number;
    public_visibility: number;
  };
}

export async function gatherMarketRealData(
  companyName: string,
  sectorKeyword: string,
  productKeyword?: string,
  opts?: FetcherOpts,
): Promise<MarketRealData> {
  // Mapping fine-grained → high-level flag :
  //  hackernews + hackernews-trend → 'hackernews'
  //  openalex-concept              → 'openalex'
  //  wikipedia-sector + related    → 'wikipedia'
  //  github-topic                  → 'github'
  const queriedSources: string[] = [];
  if (isSourceEnabled('hackernews')) queriedSources.push('hackernews', 'hackernews-trend');
  if (isSourceEnabled('openalex')) queriedSources.push('openalex-concept');
  if (isSourceEnabled('wikipedia')) queriedSources.push('wikipedia-sector', 'wikipedia-related');
  if (isSourceEnabled('github')) queriedSources.push('github-topic');

  const result: any = {
    query: `${companyName} | ${sectorKeyword}${productKeyword ? ' | ' + productKeyword : ''}`,
    sourcesQueried: queriedSources,
    sourcesFound: [],
  };

  if (queriedSources.length === 0) {
    result.objectiveScores = { organic_signals: 0, academic_emergence: 0, technical_ecosystem: 0, public_visibility: 0 };
    return result as MarketRealData;
  }

  const budgetMs = opts?.budgetMs ?? 8000;
  const trendKey = productKeyword || sectorKeyword;
  const ghTopic = sectorKeyword.toLowerCase().replace(/\s+/g, '-');

  const mainCollection = Promise.all([
    trackedSource(
      'market', 'hackernews',
      () => cached(`hn:adv:${companyName}:10`,
        () => searchHackerNewsAdvanced(companyName, 10).catch(() => ({ hits: [], nbHits: 0, topPoints: 0, recentDate: '' }))),
      (r) => r.nbHits === 0,
      { hits: [] as any[], nbHits: 0, topPoints: 0, recentDate: '' },
      opts,
    ),
    trackedSource(
      'market', 'hackernews',
      () => cached(`hn:trend:${trendKey}`,
        () => getHackerNewsTrend(trendKey).catch(() => ({ recent: 0, older: 0, trend: 'stable' as const }))),
      (r) => r.recent === 0 && r.older === 0,
      { recent: 0, older: 0, trend: 'stable' as const },
      opts,
    ),
    trackedSource(
      'market', 'openalex',
      () => cached(`openalex:concept:${sectorKeyword}`,
        () => getOpenAlexConceptTrend(sectorKeyword).catch(() => ({ totalWorks: 0, recentWorks: 0, topConcepts: [] as string[], trend: 'stable' as const }))),
      (r) => r.totalWorks === 0,
      { totalWorks: 0, recentWorks: 0, topConcepts: [] as string[], trend: 'stable' as const },
      opts,
    ),
    trackedSource(
      'market', 'wikipedia',
      () => cached(`wikipedia:sector:${sectorKeyword}`,
        () => getWikipediaSector(sectorKeyword).catch(() => null)),
      (r) => r === null,
      null as { summary: string; relatedTopics: string[]; url: string } | null,
      opts,
    ),
    trackedSource<string[]>(
      'market', 'wikipedia',
      () => cached(`wikipedia:related:${sectorKeyword}:8`,
        () => getWikipediaRelated(sectorKeyword, 8).catch(() => [] as string[])),
      (r) => r.length === 0,
      [],
      opts,
    ),
    trackedSource<{ name: string; stars: number; description: string; url: string; language: string | null }[]>(
      'market', 'github',
      () => cached(`github:topic:${ghTopic}:5`,
        () => searchGitHubByTopic(ghTopic, 5).catch(() => [])),
      (r) => r.length === 0,
      [],
      opts,
    ),
  ]).then(([hn, hnTrend, openalex, wiki, wikiRel, gh]) => ({ hn, hnTrend, openalex, wiki, wikiRel, gh }));

  const fallback = {
    hn: { hits: [] as any[], nbHits: 0, topPoints: 0, recentDate: '' },
    hnTrend: { recent: 0, older: 0, trend: 'stable' as const },
    openalex: { totalWorks: 0, recentWorks: 0, topConcepts: [] as string[], trend: 'stable' as const },
    wiki: null as { summary: string; relatedTopics: string[]; url: string } | null,
    wikiRel: [] as string[],
    gh: [] as { name: string; stars: number; description: string; url: string; language: string | null }[],
  };
  const { hn, hnTrend, openalex, wiki, wikiRel, gh } = await withBudget(
    'market', budgetMs, mainCollection, fallback, opts,
  );

  if (hn.nbHits > 0) {
    result.hackerNews = {
      totalMentions: hn.nbHits,
      topPoints: hn.topPoints,
      recentDate: hn.recentDate,
      sample: hn.hits.slice(0, 5),
    };
    result.sourcesFound.push('hackernews');
  }

  if (hnTrend.recent > 0 || hnTrend.older > 0) {
    result.hackerNewsTrend = hnTrend;
    result.sourcesFound.push('hackernews-trend');
  }

  if (openalex.totalWorks > 0) {
    result.openalexConcept = {
      totalWorks: openalex.totalWorks,
      recentWorks: openalex.recentWorks,
      relatedConcepts: openalex.topConcepts,
      trend: openalex.trend,
    };
    result.sourcesFound.push('openalex-concept');
  }

  if (wiki) {
    result.wikipediaSector = wiki;
    result.sourcesFound.push('wikipedia-sector');
  }

  if (wikiRel && wikiRel.length > 0) {
    result.wikipediaRelated = wikiRel;
    result.sourcesFound.push('wikipedia-related');
  }

  if (gh && gh.length > 0) {
    result.githubEcosystem = {
      topRepos: gh,
      cumulativeStars: (gh as any[]).reduce((s: number, r: any) => s + (r.stars || 0), 0),
    };
    result.sourcesFound.push('github-topic');
  }

  // Scores objectifs

  // Signal organique : volume de mentions HN + tendance
  let organic = 0;
  const hnMentions = result.hackerNews?.totalMentions || 0;
  const hnTopPts = result.hackerNews?.topPoints || 0;
  if (hnMentions >= 50 || hnTopPts >= 500) organic = 90;
  else if (hnMentions >= 15 || hnTopPts >= 200) organic = 70;
  else if (hnMentions >= 5 || hnTopPts >= 50) organic = 50;
  else if (hnMentions >= 1) organic = 30;
  if (result.hackerNewsTrend?.trend === 'up' && organic < 90) organic += 10;

  // Émergence académique : volume publications + tendance
  let academic = 0;
  const totalAcad = result.openalexConcept?.totalWorks || 0;
  const recentAcad = result.openalexConcept?.recentWorks || 0;
  if (totalAcad >= 100000 && recentAcad >= 10000) academic = 85;
  else if (totalAcad >= 10000 || recentAcad >= 1000) academic = 70;
  else if (totalAcad >= 1000 || recentAcad >= 100) academic = 50;
  else if (totalAcad > 0) academic = 25;
  if (result.openalexConcept?.trend === 'up' && academic < 95) academic += 10;

  // Écosystème technique : cumul stars repos GitHub liés
  let technical = 0;
  const cumStars = result.githubEcosystem?.cumulativeStars || 0;
  const ghReposCount = result.githubEcosystem?.topRepos?.length || 0;
  if (cumStars >= 100000 || ghReposCount >= 5) technical = 85;
  else if (cumStars >= 10000) technical = 65;
  else if (cumStars >= 1000) technical = 45;
  else if (cumStars > 0) technical = 25;

  // Visibilité publique
  let visibility = 0;
  const hasWikiSector = !!result.wikipediaSector;
  const wikiRelatedCount = (result.wikipediaRelated || []).length;
  if (hasWikiSector && wikiRelatedCount >= 5) visibility = 80;
  else if (hasWikiSector) visibility = 55;
  else if (wikiRelatedCount >= 3) visibility = 30;

  result.objectiveScores = {
    organic_signals: Math.min(100, organic),
    academic_emergence: Math.min(100, academic),
    technical_ecosystem: Math.min(100, technical),
    public_visibility: Math.min(100, visibility),
  };

  return result as MarketRealData;
}

// ============================================================
// SOURCES POUR LE MOTEUR MACRO
// ============================================================

// FRED API (Federal Reserve Economic Data, USA) - GRATUIT mais nécessite clé API
// Note : sans clé, on peut utiliser l'endpoint public de séries via stlouisfed.org
// Pour rester gratuit sans clé, on utilise une approche alternative :
// World Bank API (libre, sans clé)

export interface MacroIndicator {
  source: string;
  indicator: string;
  value: number | string;
  date: string;
  unit?: string;
}

// World Bank API (gratuit, sans clé, riche)
// https://data.worldbank.org/
export async function getWorldBankIndicator(country: string, indicator: string, lastNYears: number = 5): Promise<MacroIndicator[]> {
  // Format: GDP per capita = NY.GDP.PCAP.CD, Inflation = FP.CPI.TOTL.ZG, Interest rate = FR.INR.RINR
  const currentYear = new Date().getFullYear();
  const url = `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?date=${currentYear - lastNYears}:${currentYear}&format=json&per_page=20`;
  const r = await fetchWithTimeout(url, { headers: HEADERS });
  if (!r || !r.ok) return [];
  const data = await r.json();
  if (!Array.isArray(data) || data.length < 2) return [];
  const series = data[1] || [];
  return series
    .filter((d: any) => d.value !== null)
    .map((d: any) => ({
      source: 'WorldBank',
      indicator: d.indicator?.value || indicator,
      value: d.value,
      date: d.date,
      unit: d.indicator?.unit || '',
    }));
}

// ECB Statistical Data Warehouse (gratuit, sans clé)
// Données euro zone : taux directeur, inflation, change
export async function getECBIndicator(seriesKey: string): Promise<MacroIndicator[]> {
  // Exemple seriesKey: "FM.D.U2.EUR.4F.KR.MRR_FR.LEV" pour le taux directeur
  const url = `https://data-api.ecb.europa.eu/service/data/${seriesKey}?format=jsondata&lastNObservations=12`;
  const r = await fetchWithTimeout(url, {
    headers: { ...HEADERS, 'Accept': 'application/json' }
  });
  if (!r || !r.ok) return [];
  try {
    const data = await r.json();
    const dataSets = data.dataSets || [];
    if (dataSets.length === 0) return [];
    const series = dataSets[0].series || {};
    const observations: MacroIndicator[] = [];
    Object.values(series).forEach((s: any) => {
      const obsRaw = s.observations || {};
      Object.entries(obsRaw).forEach(([idx, vals]: [string, any]) => {
        if (Array.isArray(vals) && vals.length > 0) {
          observations.push({
            source: 'ECB',
            indicator: seriesKey,
            value: vals[0],
            date: idx,
          });
        }
      });
    });
    return observations.slice(-12);
  } catch {
    return [];
  }
}

// IMF DataMapper WEO Database (gratuit, sans cle)
// https://www.imf.org/external/datamapper/api/v1
//
// Avantage cle sur la World Bank : le FMI publie des projections
// forward (jusqu a 5 ans) qui sont actualisees deux fois par an
// (avril et octobre, World Economic Outlook). Pertinent pour les
// dossiers a sensibilite macro elevee (DTC consumer milieu de gamme,
// retail, hospitality, marketplace B2C) ou la trajectoire de
// croissance et d inflation a 24-36 mois est un signal critique.
//
// Indicateurs cles :
//   NGDP_RPCH : Real GDP growth (%)
//   PCPIPCH   : Inflation rate average consumer prices (%)
//   LUR       : Unemployment rate (%)
//   BCA_NGDPD : Current account balance (% of GDP)
//
// Le format de l API renvoie un objet imbrique :
//   { values: { NGDP_RPCH: { FRA: { "2020": -7.6, "2025": 1.4, ... } } } }
// On extrait la serie temporelle et on la formate en MacroIndicator[].
export async function getImfWeoIndicator(
  country: string,
  indicator: string,
): Promise<MacroIndicator[]> {
  const url = `https://www.imf.org/external/datamapper/api/v1/${indicator}/${country}`;
  const r = await fetchWithTimeout(url, { headers: HEADERS });
  if (!r || !r.ok) return [];
  try {
    const data = await r.json();
    const series = data?.values?.[indicator]?.[country];
    if (!series || typeof series !== 'object') return [];
    return Object.entries(series)
      .filter(([, v]) => typeof v === 'number' || typeof v === 'string')
      .map(([year, value]) => ({
        source: 'IMF',
        indicator,
        value: value as number | string,
        date: year,
      }))
      .sort((a, b) => Number(b.date) - Number(a.date));
  } catch {
    return [];
  }
}

/**
 * Snapshot conjoncturel FMI WEO pour un pays. Retourne les indicateurs
 * cles plus la separation entre annees historiques et annees de
 * projection. Le current year sert de pivot : tout ce qui est >= year
 * courant est une projection FMI.
 */
export interface ImfWeoSnapshot {
  country: string;
  sourcesQueried: string[];
  sourcesFound: string[];
  indicators: {
    gdpGrowthHistorical?: MacroIndicator[];
    gdpGrowthProjected?: MacroIndicator[];
    inflationHistorical?: MacroIndicator[];
    inflationProjected?: MacroIndicator[];
    unemploymentHistorical?: MacroIndicator[];
    unemploymentProjected?: MacroIndicator[];
  };
  derivedMetrics: {
    /** Tendance projetee sur les 3 prochaines annees pour le PIB. */
    gdp_outlook?: 'expansion' | 'slowdown' | 'recession';
    /** Tendance projetee de l inflation : returning_to_target / sticky / accelerating. */
    inflation_outlook?: 'returning_to_target' | 'sticky' | 'accelerating';
  };
}

export async function gatherImfWeoSnapshot(
  country: string,
  opts?: FetcherOpts,
): Promise<ImfWeoSnapshot> {
  // Reutilisation du mapping ISO3 deja utilise par World Bank.
  const countryCodeMap: Record<string, string> = {
    'france': 'FRA', 'fr': 'FRA',
    'allemagne': 'DEU', 'germany': 'DEU', 'de': 'DEU',
    'royaume-uni': 'GBR', 'uk': 'GBR', 'united kingdom': 'GBR',
    'états-unis': 'USA', 'usa': 'USA', 'united states': 'USA',
    'italie': 'ITA', 'italy': 'ITA',
    'espagne': 'ESP', 'spain': 'ESP',
    'pays-bas': 'NLD', 'netherlands': 'NLD',
    'portugal': 'PRT',
    'lituanie': 'LTU', 'lithuania': 'LTU',
    'roumanie': 'ROU', 'romania': 'ROU',
    'suède': 'SWE', 'sweden': 'SWE',
    'canada': 'CAN',
    'irlande': 'IRL', 'ireland': 'IRL',
  };
  const code = countryCodeMap[country.toLowerCase()] || country.toUpperCase().slice(0, 3);

  const enabled = isSourceEnabled('imf');
  const result: ImfWeoSnapshot = {
    country: code,
    sourcesQueried: enabled ? ['imf-weo-gdp', 'imf-weo-inflation', 'imf-weo-unemployment'] : [],
    sourcesFound: [],
    indicators: {},
    derivedMetrics: {},
  };

  if (!enabled) return result;

  const currentYear = new Date().getFullYear();

  const split = (series: MacroIndicator[]): { historical: MacroIndicator[]; projected: MacroIndicator[] } => {
    const historical: MacroIndicator[] = [];
    const projected: MacroIndicator[] = [];
    for (const obs of series) {
      const y = Number(obs.date);
      if (Number.isNaN(y)) continue;
      if (y < currentYear) historical.push(obs);
      else projected.push(obs);
    }
    return {
      historical: historical.sort((a, b) => Number(b.date) - Number(a.date)).slice(0, 5),
      projected: projected.sort((a, b) => Number(a.date) - Number(b.date)).slice(0, 5),
    };
  };

  const fetched = await Promise.all([
    trackedSource<MacroIndicator[]>(
      'macro', 'imf',
      () => cached(`imf:${code}:NGDP_RPCH`,
        () => getImfWeoIndicator(code, 'NGDP_RPCH').catch(() => [])),
      (r) => r.length === 0,
      [],
      opts,
    ),
    trackedSource<MacroIndicator[]>(
      'macro', 'imf',
      () => cached(`imf:${code}:PCPIPCH`,
        () => getImfWeoIndicator(code, 'PCPIPCH').catch(() => [])),
      (r) => r.length === 0,
      [],
      opts,
    ),
    trackedSource<MacroIndicator[]>(
      'macro', 'imf',
      () => cached(`imf:${code}:LUR`,
        () => getImfWeoIndicator(code, 'LUR').catch(() => [])),
      (r) => r.length === 0,
      [],
      opts,
    ),
  ]);

  const [gdpRaw, inflationRaw, unemploymentRaw] = fetched;

  if (gdpRaw.length > 0) {
    const { historical, projected } = split(gdpRaw);
    result.indicators.gdpGrowthHistorical = historical;
    result.indicators.gdpGrowthProjected = projected;
    result.sourcesFound.push('imf-weo-gdp');

    // Outlook derive : moyenne des 3 prochaines annees projetees
    if (projected.length >= 2) {
      const avg = projected.slice(0, 3).reduce((s, p) => s + Number(p.value), 0) / Math.min(3, projected.length);
      if (avg > 2.5) result.derivedMetrics.gdp_outlook = 'expansion';
      else if (avg > 0.5) result.derivedMetrics.gdp_outlook = 'slowdown';
      else result.derivedMetrics.gdp_outlook = 'recession';
    }
  }

  if (inflationRaw.length > 0) {
    const { historical, projected } = split(inflationRaw);
    result.indicators.inflationHistorical = historical;
    result.indicators.inflationProjected = projected;
    result.sourcesFound.push('imf-weo-inflation');

    // Outlook : convergence vers 2% (cible BCE/Fed) ou non
    if (projected.length >= 2) {
      const lastProjected = Number(projected[projected.length - 1].value);
      const firstProjected = Number(projected[0].value);
      const trend = lastProjected - firstProjected;
      if (lastProjected <= 2.5) result.derivedMetrics.inflation_outlook = 'returning_to_target';
      else if (trend < -0.3) result.derivedMetrics.inflation_outlook = 'returning_to_target';
      else if (trend > 0.3) result.derivedMetrics.inflation_outlook = 'accelerating';
      else result.derivedMetrics.inflation_outlook = 'sticky';
    }
  }

  if (unemploymentRaw.length > 0) {
    const { historical, projected } = split(unemploymentRaw);
    result.indicators.unemploymentHistorical = historical;
    result.indicators.unemploymentProjected = projected;
    result.sourcesFound.push('imf-weo-unemployment');
  }

  return result;
}

// Récupération simplifiée des principaux indicateurs macro pour une géographie
export interface MacroSnapshot {
  country: string;
  sourcesQueried: string[];
  sourcesFound: string[];
  indicators: {
    gdpGrowth?: MacroIndicator[];
    inflation?: MacroIndicator[];
    interestRate?: MacroIndicator[];
    rdSpending?: MacroIndicator[];
    fdiInflows?: MacroIndicator[];
  };
  derivedMetrics: {
    rate_regime?: 'restrictive' | 'neutral' | 'accommodative';
    inflation_status?: 'above_target' | 'at_target' | 'below_target';
    growth_trend?: 'expansion' | 'slowdown' | 'recession';
  };
}

export async function gatherMacroRealData(
  country: string,
  opts?: FetcherOpts,
): Promise<MacroSnapshot> {
  const countryCodeMap: Record<string, string> = {
    'france': 'FRA', 'fr': 'FRA',
    'allemagne': 'DEU', 'germany': 'DEU', 'de': 'DEU',
    'royaume-uni': 'GBR', 'uk': 'GBR', 'united kingdom': 'GBR',
    'états-unis': 'USA', 'usa': 'USA', 'united states': 'USA',
    'italie': 'ITA', 'italy': 'ITA',
    'espagne': 'ESP', 'spain': 'ESP',
    'pays-bas': 'NLD', 'netherlands': 'NLD',
    'portugal': 'PRT',
    'lituanie': 'LTU', 'lithuania': 'LTU',
    'roumanie': 'ROU', 'romania': 'ROU',
    'suède': 'SWE', 'sweden': 'SWE',
    'canada': 'CAN',
    'irlande': 'IRL', 'ireland': 'IRL',
  };

  const code = countryCodeMap[country.toLowerCase()] || country.toUpperCase().slice(0, 3);

  const wbEnabled = isSourceEnabled('worldbank');
  const result: MacroSnapshot = {
    country: code,
    sourcesQueried: wbEnabled
      ? ['worldbank-gdp', 'worldbank-inflation', 'worldbank-interest', 'worldbank-rd', 'worldbank-fdi']
      : [],
    sourcesFound: [],
    indicators: {},
    derivedMetrics: {},
  };

  if (!wbEnabled) {
    return result;
  }

  const budgetMs = opts?.budgetMs ?? 8000;

  const mainCollection = Promise.all([
    trackedSource<MacroIndicator[]>(
      'macro', 'worldbank',
      () => cached(`wb:${code}:NY.GDP.MKTP.KD.ZG:5`,
        () => getWorldBankIndicator(code, 'NY.GDP.MKTP.KD.ZG', 5).catch(() => [])),
      (r) => r.length === 0,
      [],
      opts,
    ),
    trackedSource<MacroIndicator[]>(
      'macro', 'worldbank',
      () => cached(`wb:${code}:FP.CPI.TOTL.ZG:5`,
        () => getWorldBankIndicator(code, 'FP.CPI.TOTL.ZG', 5).catch(() => [])),
      (r) => r.length === 0,
      [],
      opts,
    ),
    trackedSource<MacroIndicator[]>(
      'macro', 'worldbank',
      () => cached(`wb:${code}:FR.INR.RINR:5`,
        () => getWorldBankIndicator(code, 'FR.INR.RINR', 5).catch(() => [])),
      (r) => r.length === 0,
      [],
      opts,
    ),
    trackedSource<MacroIndicator[]>(
      'macro', 'worldbank',
      () => cached(`wb:${code}:GB.XPD.RSDV.GD.ZS:5`,
        () => getWorldBankIndicator(code, 'GB.XPD.RSDV.GD.ZS', 5).catch(() => [])),
      (r) => r.length === 0,
      [],
      opts,
    ),
    trackedSource<MacroIndicator[]>(
      'macro', 'worldbank',
      () => cached(`wb:${code}:BX.KLT.DINV.WD.GD.ZS:5`,
        () => getWorldBankIndicator(code, 'BX.KLT.DINV.WD.GD.ZS', 5).catch(() => [])),
      (r) => r.length === 0,
      [],
      opts,
    ),
  ]).then(([gdpGrowth, inflation, interestRate, rdSpending, fdiInflows]) =>
    ({ gdpGrowth, inflation, interestRate, rdSpending, fdiInflows }));

  const fallback = {
    gdpGrowth: [] as MacroIndicator[],
    inflation: [] as MacroIndicator[],
    interestRate: [] as MacroIndicator[],
    rdSpending: [] as MacroIndicator[],
    fdiInflows: [] as MacroIndicator[],
  };
  const { gdpGrowth, inflation, interestRate, rdSpending, fdiInflows } = await withBudget(
    'macro', budgetMs, mainCollection, fallback, opts,
  );

  if (gdpGrowth.length > 0) {
    result.indicators.gdpGrowth = gdpGrowth;
    result.sourcesFound.push('worldbank-gdp');
    const recent = gdpGrowth.slice(0, 2).map(d => Number(d.value));
    const older = gdpGrowth.slice(2, 4).map(d => Number(d.value));
    if (recent.length > 0 && older.length > 0) {
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      if (recentAvg > olderAvg + 0.5) result.derivedMetrics.growth_trend = 'expansion';
      else if (recentAvg < olderAvg - 0.5) result.derivedMetrics.growth_trend = 'slowdown';
      if (recentAvg < 0) result.derivedMetrics.growth_trend = 'recession';
    }
  }

  if (inflation.length > 0) {
    result.indicators.inflation = inflation;
    result.sourcesFound.push('worldbank-inflation');
    const lastInflation = Number(inflation[0]?.value || 0);
    if (lastInflation > 3) result.derivedMetrics.inflation_status = 'above_target';
    else if (lastInflation > 1.5) result.derivedMetrics.inflation_status = 'at_target';
    else result.derivedMetrics.inflation_status = 'below_target';
  }

  if (interestRate.length > 0) {
    result.indicators.interestRate = interestRate;
    result.sourcesFound.push('worldbank-interest');
    const lastRate = Number(interestRate[0]?.value || 0);
    if (lastRate > 3) result.derivedMetrics.rate_regime = 'restrictive';
    else if (lastRate > 1) result.derivedMetrics.rate_regime = 'neutral';
    else result.derivedMetrics.rate_regime = 'accommodative';
  }

  if (rdSpending.length > 0) {
    result.indicators.rdSpending = rdSpending;
    result.sourcesFound.push('worldbank-rd');
  }

  if (fdiInflows.length > 0) {
    result.indicators.fdiInflows = fdiInflows;
    result.sourcesFound.push('worldbank-fdi');
  }

  return result;
}
