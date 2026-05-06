// ============================================================
// GITHUB FETCHER (Module 3 DD technique - etape 1)
// ------------------------------------------------------------
// Module deterministe qui interroge l API GitHub REST v3 pour
// rassembler les metriques d audit d un depot. Aucun appel LLM.
// Le token d authentification est facultatif. En l absence de
// token, l API GitHub limite les requetes a 60 par heure et
// rend les depots prives inaccessibles. Avec un token PAT
// lecture seule (scope public_repo ou repo), la limite passe a
// 5000 par heure et les endpoints security sont accessibles.
//
// La fonction principale fetchGitHubAuditData orchestre une
// vingtaine d appels en parallele, gere les erreurs partielles,
// et retourne une structure typee GitHubAuditData consommee par
// le moteur DD technique (etape 2).
//
// Aucun appel ne fait tomber le pipeline : si un endpoint echoue
// ou est indisponible (depot prive sans token, endpoint avance
// sans permission, rate limit atteint), le champ correspondant
// est mis a null et un message est inscrit dans fetchErrors.
// ============================================================

// ============================================================
// Types
// ============================================================

export interface GitHubRepoIdentifier {
  owner: string;
  repo: string;
}

export interface GitHubRepoMetadata {
  fullName: string;
  description: string | null;
  defaultBranch: string;
  visibility: 'public' | 'private' | 'internal';
  primaryLanguage: string | null;
  license: string | null;
  stars: number;
  forks: number;
  watchers: number;
  openIssuesCount: number;
  sizeKb: number;
  archived: boolean;
  disabled: boolean;
  isFork: boolean;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  homepage: string | null;
  topics: string[];
}

export interface GitHubLanguagesBreakdown {
  // bytes par langage
  byLanguage: Record<string, number>;
  totalBytes: number;
}

export interface GitHubCommitActivity {
  // 52 semaines de commits, plus recente en derniere position
  weekly: Array<{ weekStart: string; total: number }>;
  // Calcules par le fetcher : commits sur 4, 12, 26, 52 dernieres semaines
  last4Weeks: number;
  last12Weeks: number;
  last26Weeks: number;
  last52Weeks: number;
}

export interface GitHubContributor {
  login: string;
  contributions: number;
}

export interface GitHubContributorsBreakdown {
  total: number;
  top: GitHubContributor[]; // top 30 max
  // Pourcentage des commits du contributeur principal sur le total
  // des contributions (bus factor descriptif)
  topShareOfCommits: number;
  // Nombre de contributeurs ayant au moins 1 commit dans les 12
  // dernieres semaines (computed via stats/contributors par semaine
  // si disponible, sinon estime)
  activeContributorsRecent: number | null;
}

export interface GitHubIssuesSnapshot {
  openCount: number;
  closedCount: number;
  // Age moyen en jours des issues ouvertes (echantillon des 100
  // plus recentes pour limiter les requetes)
  avgOpenAgeDays: number | null;
  // Issue ouverte la plus ancienne
  oldestOpenAgeDays: number | null;
}

export interface GitHubPullRequestsSnapshot {
  openCount: number;
  // PRs mergees sur les 90 derniers jours
  mergedLast90Days: number;
  // Time to merge median sur les PRs mergees recemment, en jours
  medianTimeToMergeDays: number | null;
  // Plus ancienne PR ouverte en jours
  oldestOpenAgeDays: number | null;
}

export interface GitHubReleaseSnapshot {
  total: number;
  latestTag: string | null;
  latestPublishedAt: string | null;
  // Cadence en jours entre les releases recentes (mediane sur les 10
  // derniers intervalles si disponibles)
  medianIntervalDays: number | null;
  // Releases publiees sur les 365 derniers jours
  releasesLast365Days: number;
}

export interface GitHubCiSnapshot {
  workflowsCount: number;
  workflowNames: string[];
  // Statut des derniers runs (sur les 30 plus recents)
  recentRunsTotal: number;
  recentRunsSuccess: number;
  recentRunsFailure: number;
  // Pourcentage de success sur les runs recents
  successRate: number | null;
}

export interface GitHubSecuritySnapshot {
  // Branch protection sur la branche par defaut. Null si non
  // accessible (token sans permission ou depot public sans
  // protection configuree)
  defaultBranchProtected: boolean | null;
  // Vulnerability alerts activees. Null si non accessible
  vulnerabilityAlertsEnabled: boolean | null;
  // Dependabot security updates. Null si non accessible
  dependabotSecurityUpdatesEnabled: boolean | null;
  // Compteur d alertes Dependabot par severity. Null si non
  // accessible (depot prive sans permission security_events ou
  // depot public sans alertes activees)
  dependabotAlerts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  } | null;
  // Code scanning et secret scanning
  codeScanningEnabled: boolean | null;
  secretScanningEnabled: boolean | null;
}

export interface GitHubDocumentationSnapshot {
  hasReadme: boolean;
  readmeSizeBytes: number | null;
  hasLicense: boolean;
  hasContributing: boolean;
  hasSecurityPolicy: boolean;
  hasCodeOfConduct: boolean;
  hasIssueTemplate: boolean;
  hasPullRequestTemplate: boolean;
}

export interface GitHubDependenciesSnapshot {
  // Fichiers de dependances detectes a la racine
  manifestFiles: string[];
  // Lock files presents
  lockFiles: string[];
  // Inferer l ecosysteme principal
  primaryEcosystem: string | null;
  // Indicateur grossier : un depot avec dependances mais sans lock
  // file est un signal mineur de maintenance
  hasLockFile: boolean;
}

export interface GitHubAuditData {
  identifier: GitHubRepoIdentifier;
  fetchedAt: string;
  // Tous les champs ci-dessous peuvent etre null en cas d echec
  // partiel sur l endpoint correspondant
  metadata: GitHubRepoMetadata | null;
  languages: GitHubLanguagesBreakdown | null;
  commitActivity: GitHubCommitActivity | null;
  contributors: GitHubContributorsBreakdown | null;
  issues: GitHubIssuesSnapshot | null;
  pullRequests: GitHubPullRequestsSnapshot | null;
  releases: GitHubReleaseSnapshot | null;
  ci: GitHubCiSnapshot | null;
  security: GitHubSecuritySnapshot | null;
  documentation: GitHubDocumentationSnapshot | null;
  dependencies: GitHubDependenciesSnapshot | null;
  // Erreurs rencontrees lors du fetch, exposees pour transparence
  // dans l audit final
  fetchErrors: Array<{ endpoint: string; message: string }>;
  // Indique si un token a ete fourni (utile cote moteur pour
  // contextualiser les null security)
  authenticated: boolean;
}

// ============================================================
// Parser URL
// ============================================================

/**
 * Extrait owner et repo depuis une URL ou un identifiant raccourci.
 * Accepte :
 *   - https://github.com/owner/repo
 *   - https://github.com/owner/repo.git
 *   - github.com/owner/repo
 *   - owner/repo
 */
export function parseRepoIdentifier(input: string): GitHubRepoIdentifier | null {
  if (!input) return null;
  const trimmed = input.trim();
  // Retire eventuel protocole et host
  let path = trimmed
    .replace(/^https?:\/\//, '')
    .replace(/^github\.com\//, '')
    .replace(/^git@github\.com:/, '')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');
  // Retire query string ou fragment
  path = path.split('?')[0].split('#')[0];
  const parts = path.split('/');
  if (parts.length < 2) return null;
  const owner = parts[0].trim();
  const repo = parts[1].trim();
  if (!owner || !repo) return null;
  // Validation basique : caracteres autorises
  if (!/^[A-Za-z0-9._-]+$/.test(owner) || !/^[A-Za-z0-9._-]+$/.test(repo)) return null;
  return { owner, repo };
}

// ============================================================
// HTTP helper
// ============================================================

const GITHUB_API = 'https://api.github.com';
const FETCH_TIMEOUT_MS = 15_000;

async function ghFetch(
  path: string,
  token: string | null,
  errors: Array<{ endpoint: string; message: string }>,
  expectedStatuses: number[] = [200],
): Promise<any | null> {
  const url = path.startsWith('http') ? path : `${GITHUB_API}${path}`;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'prelude-dd-technical-audit',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, { headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (!expectedStatuses.includes(response.status)) {
      // 404, 403, 401 : on log mais on ne plante pas. Le moteur DD
      // technique sait gerer les champs null.
      const body = await response.text().catch(() => '');
      const truncated = body.length > 200 ? `${body.slice(0, 200)}...` : body;
      errors.push({
        endpoint: path,
        message: `HTTP ${response.status}${truncated ? ` ${truncated}` : ''}`,
      });
      return null;
    }

    if (response.status === 204) return null;
    return await response.json();
  } catch (err: any) {
    errors.push({
      endpoint: path,
      message: err?.message || 'fetch error',
    });
    return null;
  }
}

// ============================================================
// Parsers individuels par endpoint
// ============================================================

function parseMetadata(raw: any): GitHubRepoMetadata | null {
  if (!raw) return null;
  return {
    fullName: String(raw.full_name || ''),
    description: raw.description || null,
    defaultBranch: String(raw.default_branch || 'main'),
    visibility: raw.visibility || (raw.private ? 'private' : 'public'),
    primaryLanguage: raw.language || null,
    license: raw.license?.spdx_id || raw.license?.name || null,
    stars: Number(raw.stargazers_count || 0),
    forks: Number(raw.forks_count || 0),
    watchers: Number(raw.subscribers_count || raw.watchers_count || 0),
    openIssuesCount: Number(raw.open_issues_count || 0),
    sizeKb: Number(raw.size || 0),
    archived: !!raw.archived,
    disabled: !!raw.disabled,
    isFork: !!raw.fork,
    createdAt: String(raw.created_at || ''),
    updatedAt: String(raw.updated_at || ''),
    pushedAt: String(raw.pushed_at || ''),
    homepage: raw.homepage || null,
    topics: Array.isArray(raw.topics) ? raw.topics.slice(0, 20) : [],
  };
}

function parseLanguages(raw: any): GitHubLanguagesBreakdown | null {
  if (!raw || typeof raw !== 'object') return null;
  const byLanguage: Record<string, number> = {};
  let totalBytes = 0;
  for (const [lang, bytes] of Object.entries(raw)) {
    const n = Number(bytes || 0);
    byLanguage[lang] = n;
    totalBytes += n;
  }
  return { byLanguage, totalBytes };
}

function parseCommitActivity(raw: any): GitHubCommitActivity | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const weekly = raw.map((w: any) => ({
    weekStart: w?.week ? new Date(Number(w.week) * 1000).toISOString().slice(0, 10) : '',
    total: Number(w?.total || 0),
  }));
  const sumLast = (n: number) =>
    weekly.slice(-n).reduce((s, w) => s + w.total, 0);
  return {
    weekly,
    last4Weeks: sumLast(4),
    last12Weeks: sumLast(12),
    last26Weeks: sumLast(26),
    last52Weeks: sumLast(52),
  };
}

function parseContributors(raw: any): GitHubContributorsBreakdown | null {
  if (!Array.isArray(raw)) return null;
  // L API stats/contributors retourne { author: {login}, total, weeks: [...]}.
  // L API simple /contributors retourne { login, contributions }.
  const detailed = raw.length > 0 && raw[0] && typeof raw[0] === 'object' && 'author' in raw[0];

  let entries: GitHubContributor[] = [];
  let activeRecent: number | null = null;

  if (detailed) {
    // Statistique avancee : on peut calculer les contributeurs actifs
    // sur les 12 dernieres semaines.
    let active = 0;
    entries = raw.map((c: any) => {
      const weeks: any[] = Array.isArray(c?.weeks) ? c.weeks : [];
      const recent = weeks.slice(-12).reduce((s: number, w: any) => s + Number(w?.c || 0), 0);
      if (recent > 0) active += 1;
      return {
        login: String(c?.author?.login || 'unknown'),
        contributions: Number(c?.total || 0),
      };
    });
    activeRecent = active;
  } else {
    entries = raw.map((c: any) => ({
      login: String(c?.login || 'unknown'),
      contributions: Number(c?.contributions || 0),
    }));
  }

  // Tri descendant par contributions
  entries.sort((a, b) => b.contributions - a.contributions);
  const total = entries.length;
  const top = entries.slice(0, 30);
  const totalContribs = entries.reduce((s, e) => s + e.contributions, 0);
  const topShareOfCommits = totalContribs > 0
    ? (entries[0]?.contributions || 0) / totalContribs
    : 0;
  return {
    total,
    top,
    topShareOfCommits,
    activeContributorsRecent: activeRecent,
  };
}

function ageDaysFrom(iso: string | null | undefined, refTime: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((refTime - t) / (1000 * 60 * 60 * 24));
}

function parseIssues(
  rawOpen: any,
  rawClosed: any,
  rawSearchOpen: any,
  rawSearchClosed: any,
): GitHubIssuesSnapshot | null {
  // Compte fiable via search/issues qui retourne total_count.
  // Fallback : compter la liste si search indisponible.
  const openCount = typeof rawSearchOpen?.total_count === 'number'
    ? rawSearchOpen.total_count
    : Array.isArray(rawOpen) ? rawOpen.length : 0;
  const closedCount = typeof rawSearchClosed?.total_count === 'number'
    ? rawSearchClosed.total_count
    : Array.isArray(rawClosed) ? rawClosed.length : 0;

  if (openCount === 0 && closedCount === 0 && !Array.isArray(rawOpen)) {
    return null;
  }

  const now = Date.now();
  const openIssues: any[] = Array.isArray(rawOpen) ? rawOpen.filter(i => !i.pull_request) : [];
  let avgAge: number | null = null;
  let oldestAge: number | null = null;
  if (openIssues.length > 0) {
    const ages = openIssues
      .map(i => ageDaysFrom(i.created_at, now))
      .filter((x): x is number => x !== null);
    if (ages.length > 0) {
      avgAge = Math.round(ages.reduce((s, a) => s + a, 0) / ages.length);
      oldestAge = ages.reduce((m, a) => Math.max(m, a), 0);
    }
  }

  return {
    openCount,
    closedCount,
    avgOpenAgeDays: avgAge,
    oldestOpenAgeDays: oldestAge,
  };
}

function parsePullRequests(
  rawOpen: any,
  rawClosed: any,
): GitHubPullRequestsSnapshot | null {
  if (!Array.isArray(rawOpen) && !Array.isArray(rawClosed)) return null;
  const now = Date.now();
  const openPRs: any[] = Array.isArray(rawOpen) ? rawOpen : [];
  const closedPRs: any[] = Array.isArray(rawClosed) ? rawClosed : [];

  // Mergees sur les 90 derniers jours
  const cutoff = now - 90 * 24 * 60 * 60 * 1000;
  const mergedRecent = closedPRs.filter(pr => {
    if (!pr.merged_at) return false;
    const t = Date.parse(pr.merged_at);
    return Number.isFinite(t) && t >= cutoff;
  });
  // Time to merge median en jours
  const ttmDays = mergedRecent
    .map(pr => {
      const created = Date.parse(pr.created_at);
      const merged = Date.parse(pr.merged_at);
      if (!Number.isFinite(created) || !Number.isFinite(merged)) return null;
      return (merged - created) / (1000 * 60 * 60 * 24);
    })
    .filter((x): x is number => x !== null)
    .sort((a, b) => a - b);
  let median: number | null = null;
  if (ttmDays.length > 0) {
    const mid = Math.floor(ttmDays.length / 2);
    median = ttmDays.length % 2 === 0
      ? (ttmDays[mid - 1] + ttmDays[mid]) / 2
      : ttmDays[mid];
    median = Math.round(median * 10) / 10;
  }

  let oldestOpen: number | null = null;
  if (openPRs.length > 0) {
    const ages = openPRs
      .map(pr => ageDaysFrom(pr.created_at, now))
      .filter((x): x is number => x !== null);
    if (ages.length > 0) oldestOpen = ages.reduce((m, a) => Math.max(m, a), 0);
  }

  return {
    openCount: openPRs.length,
    mergedLast90Days: mergedRecent.length,
    medianTimeToMergeDays: median,
    oldestOpenAgeDays: oldestOpen,
  };
}

function parseReleases(raw: any): GitHubReleaseSnapshot | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0) {
    return {
      total: 0,
      latestTag: null,
      latestPublishedAt: null,
      medianIntervalDays: null,
      releasesLast365Days: 0,
    };
  }
  // Tri par published_at descendant
  const sorted = [...raw].filter(r => r.published_at).sort(
    (a, b) => Date.parse(b.published_at) - Date.parse(a.published_at),
  );
  const latest = sorted[0];

  // Intervalles entre releases consecutives (jours)
  const intervals: number[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const t1 = Date.parse(sorted[i].published_at);
    const t2 = Date.parse(sorted[i + 1].published_at);
    if (Number.isFinite(t1) && Number.isFinite(t2)) {
      intervals.push((t1 - t2) / (1000 * 60 * 60 * 24));
    }
  }
  intervals.sort((a, b) => a - b);
  let medianInterval: number | null = null;
  if (intervals.length > 0) {
    const mid = Math.floor(intervals.length / 2);
    medianInterval = intervals.length % 2 === 0
      ? (intervals[mid - 1] + intervals[mid]) / 2
      : intervals[mid];
    medianInterval = Math.round(medianInterval * 10) / 10;
  }

  const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const last365 = sorted.filter(r => Date.parse(r.published_at) >= cutoff).length;

  return {
    total: sorted.length,
    latestTag: latest?.tag_name || null,
    latestPublishedAt: latest?.published_at || null,
    medianIntervalDays: medianInterval,
    releasesLast365Days: last365,
  };
}

function parseCi(workflowsRaw: any, runsRaw: any): GitHubCiSnapshot | null {
  if (!workflowsRaw && !runsRaw) return null;
  const workflows = Array.isArray(workflowsRaw?.workflows) ? workflowsRaw.workflows : [];
  const runs = Array.isArray(runsRaw?.workflow_runs) ? runsRaw.workflow_runs : [];

  let success = 0;
  let failure = 0;
  for (const r of runs) {
    if (r.conclusion === 'success') success += 1;
    else if (r.conclusion === 'failure' || r.conclusion === 'timed_out' || r.conclusion === 'startup_failure') failure += 1;
  }
  const total = success + failure;
  const successRate = total > 0 ? success / total : null;

  return {
    workflowsCount: workflows.length,
    workflowNames: workflows.map((w: any) => String(w.name || '')).slice(0, 20),
    recentRunsTotal: runs.length,
    recentRunsSuccess: success,
    recentRunsFailure: failure,
    successRate,
  };
}

function parseSecurity(
  metadata: GitHubRepoMetadata | null,
  branchProtectionRaw: any,
  vulnerabilityAlertsRaw: { ok: boolean; status: number } | null,
  dependabotAlertsRaw: any,
  authenticated: boolean,
): GitHubSecuritySnapshot {
  // Branch protection : si raw est null ET non authentifie, on ne sait
  // pas. Si raw est un objet, protection active. Si HTTP 404 sur depot
  // public, protection non configuree.
  let branchProtected: boolean | null = null;
  if (branchProtectionRaw && typeof branchProtectionRaw === 'object') {
    branchProtected = true;
  }

  // Vulnerability alerts : endpoint retourne 204 si actif, 404 sinon.
  let vulnerabilityAlerts: boolean | null = null;
  if (vulnerabilityAlertsRaw) {
    if (vulnerabilityAlertsRaw.status === 204) vulnerabilityAlerts = true;
    else if (vulnerabilityAlertsRaw.status === 404) vulnerabilityAlerts = false;
  }

  // Code scanning et secret scanning : exposes via security_and_analysis
  // dans les metadata si autorise (depots prives avec token).
  const sa = (metadata as any)?.security_and_analysis;
  const codeScanningEnabled = sa?.advanced_security?.status === 'enabled' || null;
  const secretScanningEnabled = sa?.secret_scanning?.status === 'enabled' || null;

  // Dependabot alerts : Array si autorise, null sinon
  let dependabot: GitHubSecuritySnapshot['dependabotAlerts'] = null;
  if (Array.isArray(dependabotAlertsRaw)) {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const a of dependabotAlertsRaw) {
      if (a?.state !== 'open') continue;
      const sev = (a?.security_advisory?.severity || a?.security_vulnerability?.severity || '').toLowerCase();
      if (sev === 'critical') counts.critical += 1;
      else if (sev === 'high') counts.high += 1;
      else if (sev === 'medium' || sev === 'moderate') counts.medium += 1;
      else if (sev === 'low') counts.low += 1;
    }
    dependabot = counts;
  }

  return {
    defaultBranchProtected: branchProtected,
    vulnerabilityAlertsEnabled: vulnerabilityAlerts,
    dependabotSecurityUpdatesEnabled: null,
    dependabotAlerts: dependabot,
    codeScanningEnabled,
    secretScanningEnabled,
  };
}

function parseDocumentation(
  readmeRaw: any,
  rootContents: any,
): GitHubDocumentationSnapshot | null {
  if (!Array.isArray(rootContents) && !readmeRaw) return null;
  const contents: any[] = Array.isArray(rootContents) ? rootContents : [];
  const filenames = new Set(
    contents.filter(c => c.type === 'file').map(c => String(c.name || '').toLowerCase()),
  );
  const dirnames = new Set(
    contents.filter(c => c.type === 'dir').map(c => String(c.name || '').toLowerCase()),
  );

  const readmeSize = readmeRaw && typeof readmeRaw.size === 'number' ? readmeRaw.size : null;

  return {
    hasReadme: !!readmeRaw || filenames.has('readme.md') || filenames.has('readme'),
    readmeSizeBytes: readmeSize,
    hasLicense: filenames.has('license') || filenames.has('license.md') || filenames.has('license.txt'),
    hasContributing: filenames.has('contributing.md') || filenames.has('contributing'),
    hasSecurityPolicy: filenames.has('security.md'),
    hasCodeOfConduct: filenames.has('code_of_conduct.md') || filenames.has('codeofconduct.md'),
    hasIssueTemplate: dirnames.has('.github'), // heuristique grossiere
    hasPullRequestTemplate: filenames.has('pull_request_template.md'),
  };
}

function parseDependencies(rootContents: any): GitHubDependenciesSnapshot | null {
  if (!Array.isArray(rootContents)) return null;
  const filenames = new Set(
    rootContents.filter((c: any) => c.type === 'file').map((c: any) => String(c.name || '').toLowerCase()),
  );

  // Manifests reconnus
  const manifests: Array<{ file: string; ecosystem: string; lockFiles: string[] }> = [
    { file: 'package.json', ecosystem: 'npm', lockFiles: ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'] },
    { file: 'requirements.txt', ecosystem: 'pip', lockFiles: ['requirements.lock', 'requirements-lock.txt'] },
    { file: 'pyproject.toml', ecosystem: 'python', lockFiles: ['poetry.lock', 'pdm.lock', 'uv.lock'] },
    { file: 'cargo.toml', ecosystem: 'rust', lockFiles: ['cargo.lock'] },
    { file: 'go.mod', ecosystem: 'go', lockFiles: ['go.sum'] },
    { file: 'gemfile', ecosystem: 'ruby', lockFiles: ['gemfile.lock'] },
    { file: 'composer.json', ecosystem: 'php', lockFiles: ['composer.lock'] },
    { file: 'pom.xml', ecosystem: 'maven', lockFiles: [] },
    { file: 'build.gradle', ecosystem: 'gradle', lockFiles: ['gradle.lockfile'] },
    { file: 'gemspec', ecosystem: 'ruby', lockFiles: [] },
    { file: 'mix.exs', ecosystem: 'elixir', lockFiles: ['mix.lock'] },
  ];

  const manifestFiles: string[] = [];
  const lockFiles: string[] = [];
  let primaryEcosystem: string | null = null;

  for (const m of manifests) {
    if (filenames.has(m.file.toLowerCase())) {
      manifestFiles.push(m.file);
      if (!primaryEcosystem) primaryEcosystem = m.ecosystem;
      for (const lf of m.lockFiles) {
        if (filenames.has(lf.toLowerCase())) lockFiles.push(lf);
      }
    }
  }

  return {
    manifestFiles,
    lockFiles,
    primaryEcosystem,
    hasLockFile: lockFiles.length > 0,
  };
}

// ============================================================
// Endpoint custom : check 204/404 sur vulnerability alerts
// ============================================================

async function checkStatus(
  path: string,
  token: string | null,
): Promise<{ ok: boolean; status: number } | null> {
  const url = `${GITHUB_API}${path}`;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'prelude-dd-technical-audit',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, { method: 'GET', headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    return { ok: response.ok, status: response.status };
  } catch {
    return null;
  }
}

// ============================================================
// Orchestration
// ============================================================

export async function fetchGitHubAuditData(
  identifier: GitHubRepoIdentifier,
  token: string | null,
): Promise<GitHubAuditData> {
  const errors: Array<{ endpoint: string; message: string }> = [];
  const { owner, repo } = identifier;
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const authenticated = !!token && token.trim().length > 0;
  const cleanToken = authenticated ? token!.trim() : null;

  // Phase 1 : metadata seule, parce que defaultBranch est necessaire
  // pour les requetes branch protection et statistiques
  const metadataRaw = await ghFetch(base, cleanToken, errors);
  const metadata = parseMetadata(metadataRaw);
  const defaultBranch = metadata?.defaultBranch || 'main';

  // Phase 2 : tout le reste en parallele
  const fullName = encodeURIComponent(`${owner}/${repo}`);
  const [
    languagesRaw,
    commitActivityRaw,
    contributorsStatsRaw,
    issuesOpenRaw,
    issuesClosedRaw,
    searchOpenRaw,
    searchClosedRaw,
    pullsOpenRaw,
    pullsClosedRaw,
    releasesRaw,
    workflowsRaw,
    runsRaw,
    branchProtectionRaw,
    vulnerabilityAlertsStatus,
    dependabotAlertsRaw,
    rootContentsRaw,
    readmeRaw,
  ] = await Promise.all([
    ghFetch(`${base}/languages`, cleanToken, errors),
    // /stats/commit_activity peut renvoyer 202 lors du calcul. On retry
    // une fois, sinon null. Accepter 202 pour distinguer du 404.
    fetchCommitActivityWithRetry(base, cleanToken, errors),
    // /stats/contributors peut aussi renvoyer 202. Retry simple.
    fetchContributorStatsWithRetry(base, cleanToken, errors),
    // Issues ouvertes : top 100 plus recentes pour calculer ages
    ghFetch(`${base}/issues?state=open&per_page=100`, cleanToken, errors),
    // Issues fermees : juste un sample pour avoir un echantillon
    ghFetch(`${base}/issues?state=closed&per_page=1`, cleanToken, errors),
    // Search pour les counts fiables
    ghFetch(`/search/issues?q=repo:${fullName}+is:issue+is:open`, cleanToken, errors),
    ghFetch(`/search/issues?q=repo:${fullName}+is:issue+is:closed`, cleanToken, errors),
    // Pulls
    ghFetch(`${base}/pulls?state=open&per_page=100`, cleanToken, errors),
    ghFetch(`${base}/pulls?state=closed&per_page=100&sort=updated&direction=desc`, cleanToken, errors),
    // Releases
    ghFetch(`${base}/releases?per_page=30`, cleanToken, errors),
    // CI workflows
    ghFetch(`${base}/actions/workflows`, cleanToken, errors),
    ghFetch(`${base}/actions/runs?per_page=30`, cleanToken, errors),
    // Branch protection (necessite token avec admin:repo)
    ghFetch(`${base}/branches/${encodeURIComponent(defaultBranch)}/protection`, cleanToken, errors, [200]),
    // Vulnerability alerts : 204 ou 404
    checkStatus(`${base}/vulnerability-alerts`, cleanToken),
    // Dependabot alerts (token security_events ou repo)
    ghFetch(`${base}/dependabot/alerts?state=open&per_page=100`, cleanToken, errors),
    // Contenu racine pour docs et dependances
    ghFetch(`${base}/contents`, cleanToken, errors),
    ghFetch(`${base}/readme`, cleanToken, errors),
  ]);

  return {
    identifier,
    fetchedAt: new Date().toISOString(),
    metadata,
    languages: parseLanguages(languagesRaw),
    commitActivity: parseCommitActivity(commitActivityRaw),
    contributors: parseContributors(contributorsStatsRaw),
    issues: parseIssues(issuesOpenRaw, issuesClosedRaw, searchOpenRaw, searchClosedRaw),
    pullRequests: parsePullRequests(pullsOpenRaw, pullsClosedRaw),
    releases: parseReleases(releasesRaw),
    ci: parseCi(workflowsRaw, runsRaw),
    security: parseSecurity(metadata, branchProtectionRaw, vulnerabilityAlertsStatus, dependabotAlertsRaw, authenticated),
    documentation: parseDocumentation(readmeRaw, rootContentsRaw),
    dependencies: parseDependencies(rootContentsRaw),
    fetchErrors: errors,
    authenticated,
  };
}

// L API /stats/* peut renvoyer 202 le temps que GitHub calcule la
// stat. On retry une fois apres 1.5s. Si ca echoue toujours, on
// laisse tomber sans bloquer.
async function fetchCommitActivityWithRetry(
  base: string,
  token: string | null,
  errors: Array<{ endpoint: string; message: string }>,
): Promise<any> {
  const path = `${base}/stats/commit_activity`;
  const first = await ghFetch(path, token, errors, [200, 202]);
  if (Array.isArray(first) && first.length > 0) return first;
  // Retry une fois
  await new Promise(r => setTimeout(r, 1500));
  return await ghFetch(path, token, errors, [200, 202]);
}

async function fetchContributorStatsWithRetry(
  base: string,
  token: string | null,
  errors: Array<{ endpoint: string; message: string }>,
): Promise<any> {
  const path = `${base}/stats/contributors`;
  const first = await ghFetch(path, token, errors, [200, 202]);
  if (Array.isArray(first) && first.length > 0) return first;
  await new Promise(r => setTimeout(r, 1500));
  const second = await ghFetch(path, token, errors, [200, 202]);
  if (Array.isArray(second) && second.length > 0) return second;
  // Fallback sur la liste simple sans stats hebdo
  return await ghFetch(`${base}/contributors?per_page=30`, token, errors);
}
