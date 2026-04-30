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

const HEADERS = { 'User-Agent': 'PréludeVC/1.0 (research)' };

async function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 10000): Promise<Response | null> {
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
  profileSignals: string[];
}

export async function gatherFounderRealData(name: string, affiliationHint?: string): Promise<FounderRealData> {
  const result: any = {
    name,
    affiliationHint,
    sourcesQueried: ['openalex', 'github', 'wikipedia', 'arxiv'],
    sourcesFound: [],
  };

  // Lance les requêtes en parallèle pour gagner du temps
  const [openalex, github, wikipedia, arxiv] = await Promise.all([
    searchOpenAlexAuthor(name, affiliationHint).catch(() => null),
    searchGitHubUser(name).catch(() => null),
    searchWikipedia(name).catch(() => null),
    searchArxiv(name, 3).catch(() => []),
  ]);

  if (openalex && openalex.works_count > 0) {
    result.openalex = openalex;
    result.sourcesFound.push('openalex');
    if (openalex.id) {
      result.recentPublications = await getOpenAlexRecentWorks(openalex.id, 3).catch(() => []);
    }
  }

  if (github) {
    result.github = github;
    result.sourcesFound.push('github');
    if (github.login) {
      result.topRepos = await getGitHubTopRepos(github.login, 3).catch(() => []);
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
  productKeyword?: string
): Promise<MarketRealData> {
  const result: any = {
    query: `${companyName} | ${sectorKeyword}${productKeyword ? ' | ' + productKeyword : ''}`,
    sourcesQueried: ['hackernews', 'hackernews-trend', 'openalex-concept', 'wikipedia-sector', 'wikipedia-related', 'github-topic'],
    sourcesFound: [],
  };

  // Lance toutes les requêtes en parallèle
  const [hn, hnTrend, openalex, wiki, wikiRel, gh] = await Promise.all([
    searchHackerNewsAdvanced(companyName, 10).catch(() => ({ hits: [], nbHits: 0, topPoints: 0, recentDate: '' })),
    getHackerNewsTrend(productKeyword || sectorKeyword).catch(() => ({ recent: 0, older: 0, trend: 'stable' as const })),
    getOpenAlexConceptTrend(sectorKeyword).catch(() => ({ totalWorks: 0, recentWorks: 0, topConcepts: [], trend: 'stable' as const })),
    getWikipediaSector(sectorKeyword).catch(() => null),
    getWikipediaRelated(sectorKeyword, 8).catch(() => [] as string[]),
    searchGitHubByTopic(sectorKeyword.toLowerCase().replace(/\s+/g, '-'), 5).catch(() => [] as any[]),
  ]);

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
  // Bonus si trend up
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

  // Visibilité publique : présence Wikipedia secteur + société + nombre de concurrents identifiés
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

export async function gatherMacroRealData(country: string): Promise<MacroSnapshot> {
  // Mapping country code (FRA, DEU, USA, GBR, etc.)
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

  const result: MacroSnapshot = {
    country: code,
    sourcesQueried: ['worldbank-gdp', 'worldbank-inflation', 'worldbank-interest', 'worldbank-rd', 'worldbank-fdi'],
    sourcesFound: [],
    indicators: {},
    derivedMetrics: {},
  };

  // Lancer les requêtes en parallèle
  const [gdpGrowth, inflation, interestRate, rdSpending, fdiInflows] = await Promise.all([
    getWorldBankIndicator(code, 'NY.GDP.MKTP.KD.ZG', 5).catch(() => []),
    getWorldBankIndicator(code, 'FP.CPI.TOTL.ZG', 5).catch(() => []),
    getWorldBankIndicator(code, 'FR.INR.RINR', 5).catch(() => []),
    getWorldBankIndicator(code, 'GB.XPD.RSDV.GD.ZS', 5).catch(() => []),
    getWorldBankIndicator(code, 'BX.KLT.DINV.WD.GD.ZS', 5).catch(() => []),
  ]);

  if (gdpGrowth.length > 0) {
    result.indicators.gdpGrowth = gdpGrowth;
    result.sourcesFound.push('worldbank-gdp');
    // Tendance simple : moyenne 2 dernières années vs 2 précédentes
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
