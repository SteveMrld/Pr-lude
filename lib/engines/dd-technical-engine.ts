// ============================================================
// MOTEUR DD TECHNIQUE (Module 3 DD technique - etape 2)
// ------------------------------------------------------------
// Consomme la sortie du github-fetcher (etape 1) et produit
// l audit technique d un depot : qualite de la discipline
// d ingenierie, dette technique observable, cadence des
// releases, securite basique. Aucun appel LLM, tout est
// deterministe avec une synthese rule-based en sortie.
//
// Dix tests structures cote a cote avec evidence chiffree,
// severity descriptive et question DD ciblee :
//
//   T1 cadence des releases (frequence sur 12 mois)
//   T2 cadence des commits (activite recente, contributeurs actifs)
//   T3 fraicheur du depot (date du dernier push, archived/disabled)
//   T4 discipline issues (ratio open/closed, age des issues ouvertes)
//   T5 discipline pull requests (time-to-merge, PRs ouvertes anciennes)
//   T6 integration continue (workflows, success rate des runs recents)
//   T7 securite basique (branch protection, dependabot, secret scanning)
//   T8 documentation (README, LICENSE, CONTRIBUTING, SECURITY)
//   T9 bus factor (concentration des commits sur un contributeur)
//   T10 dependances (manifests, lock files, ecosysteme)
//
// Verdict descriptif sur 5 niveaux :
//   - tech_strong : discipline d ingenierie elevee, infra mure
//   - tech_solid : projet correct avec quelques zones d ombre mineures
//   - tech_partial : signaux mixtes, des zones non observables
//   - tech_concerns : alertes sur la maintenabilite ou la securite
//   - tech_red_flags : red flags structurels (depot abandonne, securite
//     absente, depot archive)
//   - not_applicable : pas de URL fournie ou repo introuvable
// ============================================================

import type {
  GitHubAuditData,
  GitHubRepoIdentifier,
} from '../github-fetcher';
import { parseRepoIdentifier, fetchGitHubAuditData } from '../github-fetcher';

// ============================================================
// Types
// ============================================================

export interface DDTechnicalTest {
  testId: string;
  testName: string;
  severity: 'aligned' | 'attention' | 'alert' | 'red_flag' | 'not_assessable';
  // Observation chiffree cote depot
  observation: string;
  // Standard ou attendu pour ce type de projet
  benchmark: string;
  // Calcul detaille en clair
  evidence: string;
  // Question DD a poser au CTO ou en code review
  ddQuestion: string;
}

export interface DDTechnicalOutput {
  triggered: boolean;
  reasonNotTriggered?: string;
  // Identification du depot audite
  repo: {
    owner: string;
    name: string;
    fullName: string;
    visibility: 'public' | 'private' | 'internal' | 'unknown';
    description: string | null;
    primaryLanguage: string | null;
    license: string | null;
    homepage: string | null;
    stars: number;
    forks: number;
    isFork: boolean;
    archived: boolean;
    disabled: boolean;
    createdAt: string;
    pushedAt: string;
  } | null;
  // Indique si le fetcher etait authentifie. Si non, certains champs
  // securite sont structurellement non observables.
  authenticated: boolean;
  // Indicateurs cles consolides pour affichage rapide
  vitals: {
    last4Weeks: number | null;
    last12Weeks: number | null;
    last52Weeks: number | null;
    contributorsTotal: number | null;
    activeContributorsRecent: number | null;
    busFactorTopShare: number | null;
    releasesLast365: number | null;
    medianReleaseIntervalDays: number | null;
    issuesOpen: number | null;
    issuesClosed: number | null;
    prsOpen: number | null;
    prsMergedLast90: number | null;
    medianPRTimeToMergeDays: number | null;
    ciSuccessRate: number | null;
    daysSinceLastPush: number | null;
    primaryEcosystem: string | null;
  };
  tests: {
    releaseCadence: DDTechnicalTest;       // T1
    commitCadence: DDTechnicalTest;        // T2
    repoFreshness: DDTechnicalTest;        // T3
    issuesDiscipline: DDTechnicalTest;     // T4
    pullRequestsDiscipline: DDTechnicalTest; // T5
    continuousIntegration: DDTechnicalTest;  // T6
    basicSecurity: DDTechnicalTest;          // T7
    documentation: DDTechnicalTest;          // T8
    busFactor: DDTechnicalTest;              // T9
    dependencies: DDTechnicalTest;           // T10
  };
  globalScore: number; // 0-100
  verdict:
    | 'tech_strong'
    | 'tech_solid'
    | 'tech_partial'
    | 'tech_concerns'
    | 'tech_red_flags'
    | 'not_applicable';
  // Top 3 alertes critiques a remonter en priorite
  criticalAlerts: string[];
  // Questions DD prioritaires a poser au CTO
  questionsToInstruct: string[];
  // Synthese editoriale rule-based (5-7 phrases, sans em-dashes)
  synthesis: string;
  // Erreurs partielles eventuelles du fetcher exposees pour traçabilite
  fetchErrors: Array<{ endpoint: string; message: string }>;
  // Inputs : on garde une trace minimale pour audit, sans le token
  audit: {
    fetchedAt: string;
    repoUrl: string;
    tokenProvided: boolean;
  };
}

// ============================================================
// Helpers
// ============================================================

function daysSince(iso: string | null | undefined, now: number = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((now - t) / (1000 * 60 * 60 * 24));
}

function pct(n: number, total: number): number {
  if (!Number.isFinite(n) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((n / total) * 1000) / 10;
}

function escalate(
  current: DDTechnicalTest['severity'],
  candidate: DDTechnicalTest['severity'],
): DDTechnicalTest['severity'] {
  const order: DDTechnicalTest['severity'][] = ['aligned', 'attention', 'alert', 'red_flag', 'not_assessable'];
  // not_assessable n est jamais une escalade : si on a une vraie
  // observation, on garde le verdict observable
  if (candidate === 'not_assessable') return current;
  if (current === 'not_assessable') return candidate;
  const ci = order.indexOf(current);
  const cd = order.indexOf(candidate);
  return cd > ci ? candidate : current;
}

function severityScore(s: DDTechnicalTest['severity']): number {
  // Score par test, 0 a 10. Le score global est la somme normalisee.
  switch (s) {
    case 'aligned': return 10;
    case 'attention': return 6;
    case 'alert': return 3;
    case 'red_flag': return 0;
    case 'not_assessable': return 5; // neutre
  }
}

// ============================================================
// Tests deterministes
// ============================================================

function testReleaseCadence(d: GitHubAuditData): DDTechnicalTest {
  const r = d.releases;
  if (!r) {
    return {
      testId: 'T1',
      testName: 'Cadence des releases',
      severity: 'not_assessable',
      observation: 'Donnees releases non disponibles',
      benchmark: '4 a 12 releases par an pour un projet activement maintenu',
      evidence: 'L API releases n a pas repondu ou le depot n expose pas de releases.',
      ddQuestion: 'Comment versionnez-vous les livraisons ? Tags, semver, changelog automatise ?',
    };
  }

  if (r.total === 0) {
    return {
      testId: 'T1',
      testName: 'Cadence des releases',
      severity: 'attention',
      observation: '0 release publiee',
      benchmark: '4 a 12 releases par an pour un projet activement maintenu',
      evidence: 'Aucune release publiee. Pour un produit en production, l absence de tag est un signal de discipline limitee. Acceptable pour un depot interne ou en debut de cycle.',
      ddQuestion: 'Avez-vous un autre mecanisme de tracabilite des livraisons (changelog, tags Docker, versions package) ou les releases ne sont-elles pas pertinentes a ce stade ?',
    };
  }

  const last365 = r.releasesLast365Days;
  const median = r.medianIntervalDays;

  let severity: DDTechnicalTest['severity'] = 'aligned';
  if (last365 === 0) severity = 'alert';
  else if (last365 < 2) severity = 'attention';
  else if (last365 >= 12) severity = 'aligned';

  // Si la derniere release date d il y a plus de 6 mois
  const daysSinceLast = daysSince(r.latestPublishedAt);
  if (daysSinceLast !== null && daysSinceLast > 365) {
    severity = escalate(severity, 'alert');
  } else if (daysSinceLast !== null && daysSinceLast > 180) {
    severity = escalate(severity, 'attention');
  }

  const evidence = [
    `Total releases publiees : ${r.total}.`,
    `Releases sur 12 derniers mois : ${last365}.`,
    median !== null ? `Intervalle median entre releases : ${median} jours.` : '',
    r.latestTag ? `Derniere release : ${r.latestTag}${daysSinceLast !== null ? ` il y a ${daysSinceLast} jours` : ''}.` : '',
  ].filter(Boolean).join(' ');

  return {
    testId: 'T1',
    testName: 'Cadence des releases',
    severity,
    observation: `${last365} release(s) sur 365 jours${median !== null ? `, mediane ${median} j` : ''}`,
    benchmark: '4 a 12 releases par an pour un projet activement maintenu',
    evidence,
    ddQuestion: severity === 'aligned'
      ? 'Quelle est votre politique de release et de versioning ? Patch versus minor versus major ?'
      : 'Pourquoi la cadence de release est-elle ralentie ? Migration en cours, refonte, equipe reduite ?',
  };
}

function testCommitCadence(d: GitHubAuditData): DDTechnicalTest {
  const c = d.commitActivity;
  const contrib = d.contributors;
  if (!c) {
    return {
      testId: 'T2',
      testName: 'Cadence des commits',
      severity: 'not_assessable',
      observation: 'Statistiques commit non disponibles',
      benchmark: 'Au moins 10 commits par mois sur un projet actif',
      evidence: 'L endpoint /stats/commit_activity n a pas repondu, possiblement a cause d un calcul GitHub en cours ou d un depot peu actif.',
      ddQuestion: 'A combien de commits par semaine tournez-vous en regime sur ce depot ?',
    };
  }

  const w12 = c.last12Weeks;
  const w4 = c.last4Weeks;
  const active = contrib?.activeContributorsRecent ?? null;

  let severity: DDTechnicalTest['severity'] = 'aligned';
  if (w12 === 0) severity = 'red_flag';
  else if (w12 < 5) severity = 'alert';
  else if (w12 < 20) severity = 'attention';

  // Si activite recente s effondre par rapport a la moyenne 12 semaines
  if (w12 > 0 && w4 === 0) severity = escalate(severity, 'alert');

  const evidence = [
    `${w4} commit(s) sur les 4 dernieres semaines, ${w12} sur les 12 dernieres, ${c.last52Weeks} sur les 52 dernieres.`,
    active !== null ? `Contributeurs actifs sur 12 semaines : ${active}.` : '',
  ].filter(Boolean).join(' ');

  return {
    testId: 'T2',
    testName: 'Cadence des commits',
    severity,
    observation: `${w12} commits sur 12 sem.${active !== null ? `, ${active} contributeur(s) actif(s)` : ''}`,
    benchmark: 'Au moins 20 commits par 12 semaines pour un projet en developpement actif',
    evidence,
    ddQuestion: severity === 'aligned'
      ? 'Quelle est la composition de l equipe d ingenierie ? Combien d ETPs sur ce depot ?'
      : 'Le rythme de developpement est faible sur les dernieres semaines. Equipe reduite, refactoring profond non commit, ou priorite reorientee ?',
  };
}

function testRepoFreshness(d: GitHubAuditData): DDTechnicalTest {
  if (!d.metadata) {
    return {
      testId: 'T3',
      testName: 'Fraicheur du depot',
      severity: 'not_assessable',
      observation: 'Metadata depot non disponible',
      benchmark: 'Push dans les 30 derniers jours pour un projet en production',
      evidence: 'Le depot n a pas pu etre interroge ou n existe pas.',
      ddQuestion: 'L URL fournie correspond-elle au depot principal du produit en production ?',
    };
  }
  const m = d.metadata;
  const days = daysSince(m.pushedAt);

  // Cas durs en premier
  if (m.archived) {
    return {
      testId: 'T3',
      testName: 'Fraicheur du depot',
      severity: 'red_flag',
      observation: 'Depot archive',
      benchmark: 'Push dans les 30 derniers jours pour un projet en production',
      evidence: `Le depot est marque archive. Aucun developpement en cours. Dernier push il y a ${days ?? 'n.a.'} jours.`,
      ddQuestion: 'Le code de production a-t-il migre vers un autre depot ? Pourquoi celui-ci est-il archive ?',
    };
  }
  if (m.disabled) {
    return {
      testId: 'T3',
      testName: 'Fraicheur du depot',
      severity: 'red_flag',
      observation: 'Depot desactive',
      benchmark: 'Push dans les 30 derniers jours pour un projet en production',
      evidence: 'Le depot est marque disabled cote GitHub.',
      ddQuestion: 'Pourquoi le depot est-il desactive ?',
    };
  }
  if (m.isFork) {
    return {
      testId: 'T3',
      testName: 'Fraicheur du depot',
      severity: 'attention',
      observation: 'Depot fork',
      benchmark: 'Push dans les 30 derniers jours pour un projet en production',
      evidence: `Le depot est un fork. Dernier push il y a ${days ?? 'n.a.'} jours. Verifier qu il s agit bien du depot principal.`,
      ddQuestion: 'Confirmez-vous que ce fork est votre depot principal et non une copie de travail ?',
    };
  }

  let severity: DDTechnicalTest['severity'] = 'aligned';
  if (days === null) severity = 'not_assessable';
  else if (days > 365) severity = 'red_flag';
  else if (days > 180) severity = 'alert';
  else if (days > 60) severity = 'attention';

  return {
    testId: 'T3',
    testName: 'Fraicheur du depot',
    severity,
    observation: days === null ? 'date pushed_at non disponible' : `${days} jours depuis le dernier push`,
    benchmark: 'Push dans les 30 derniers jours pour un projet en production',
    evidence: `Cree le ${m.createdAt.slice(0, 10)}, dernier push ${m.pushedAt.slice(0, 10)}${days !== null ? ` (il y a ${days} jours)` : ''}. Visibilite ${m.visibility}.`,
    ddQuestion: severity === 'aligned'
      ? 'Pouvez-vous confirmer que ce depot heberge bien le code en production aujourd hui ?'
      : 'Le depot semble peu actif. La production est-elle effectivement deployee depuis ce code ?',
  };
}

function testIssuesDiscipline(d: GitHubAuditData): DDTechnicalTest {
  const i = d.issues;
  if (!i) {
    return {
      testId: 'T4',
      testName: 'Discipline issues',
      severity: 'not_assessable',
      observation: 'Issues non observables',
      benchmark: 'Ratio fermees/total >= 70 pct, age moyen issues ouvertes < 90 jours',
      evidence: 'L API issues n a pas repondu ou le depot n utilise pas ce systeme de suivi.',
      ddQuestion: 'Quel outil utilisez-vous pour le suivi des bugs et des roadmaps ? GitHub Issues, Linear, Jira ?',
    };
  }

  const total = i.openCount + i.closedCount;
  const closeRate = total > 0 ? i.closedCount / total : null;
  const oldest = i.oldestOpenAgeDays;
  const avg = i.avgOpenAgeDays;

  let severity: DDTechnicalTest['severity'] = 'aligned';
  if (total === 0) {
    severity = 'attention';
  } else {
    if (closeRate !== null && closeRate < 0.4) severity = escalate(severity, 'alert');
    else if (closeRate !== null && closeRate < 0.6) severity = escalate(severity, 'attention');
    if (oldest !== null && oldest > 365) severity = escalate(severity, 'alert');
    else if (oldest !== null && oldest > 180) severity = escalate(severity, 'attention');
    if (avg !== null && avg > 180) severity = escalate(severity, 'attention');
  }

  const evidence = [
    `${i.openCount} issue(s) ouverte(s), ${i.closedCount} fermee(s).`,
    closeRate !== null ? `Ratio fermees ${pct(i.closedCount, total)} pct.` : '',
    avg !== null ? `Age moyen issues ouvertes ${avg} jours.` : '',
    oldest !== null ? `Plus ancienne issue ouverte ${oldest} jours.` : '',
  ].filter(Boolean).join(' ');

  return {
    testId: 'T4',
    testName: 'Discipline issues',
    severity,
    observation: `${i.openCount} ouvertes / ${i.closedCount} fermees${closeRate !== null ? ` (${pct(i.closedCount, total)} pct closes)` : ''}`,
    benchmark: 'Ratio fermees >= 70 pct, age moyen issues ouvertes < 90 jours',
    evidence,
    ddQuestion: total === 0
      ? 'Le suivi des bugs se fait-il ailleurs (Linear, Jira) ou les issues sont-elles non utilisees ?'
      : (severity !== 'aligned'
          ? 'Plusieurs issues anciennes restent ouvertes. Backlog assume, manque de capacite ou triage non fait ?'
          : 'Quelle est votre cadence de triage des issues ? Hebdomadaire, quotidienne ?'),
  };
}

function testPullRequestsDiscipline(d: GitHubAuditData): DDTechnicalTest {
  const pr = d.pullRequests;
  if (!pr) {
    return {
      testId: 'T5',
      testName: 'Discipline pull requests',
      severity: 'not_assessable',
      observation: 'PRs non observables',
      benchmark: 'Time-to-merge median < 5 jours, peu de PRs ouvertes longues',
      evidence: 'L API pulls n a pas repondu ou le projet utilise un workflow direct push.',
      ddQuestion: 'Avez-vous un workflow de code review ? PR obligatoire, validation par pair ?',
    };
  }

  const median = pr.medianTimeToMergeDays;
  const oldest = pr.oldestOpenAgeDays;
  const merged = pr.mergedLast90Days;

  let severity: DDTechnicalTest['severity'] = 'aligned';
  if (merged === 0 && pr.openCount === 0) {
    severity = 'attention';
  } else {
    if (median !== null && median > 14) severity = escalate(severity, 'alert');
    else if (median !== null && median > 7) severity = escalate(severity, 'attention');
    if (oldest !== null && oldest > 90) severity = escalate(severity, 'attention');
    if (oldest !== null && oldest > 180) severity = escalate(severity, 'alert');
  }

  const evidence = [
    `${pr.openCount} PR(s) ouverte(s), ${merged} mergee(s) sur 90 jours.`,
    median !== null ? `Time-to-merge median ${median} jours.` : '',
    oldest !== null ? `Plus ancienne PR ouverte ${oldest} jours.` : '',
  ].filter(Boolean).join(' ');

  return {
    testId: 'T5',
    testName: 'Discipline pull requests',
    severity,
    observation: median !== null ? `merge median ${median}j, ${pr.openCount} ouverte(s)` : `${merged} mergee(s) sur 90j`,
    benchmark: 'Time-to-merge median < 5 jours, peu de PRs ouvertes longues',
    evidence,
    ddQuestion: severity === 'aligned'
      ? 'Avez-vous des regles de review formalisees ? Approbations multiples requises ?'
      : 'Le merge des PRs est lent ou des PRs trainent. Manque de reviewers, branches longues, ou refactor en cours ?',
  };
}

function testContinuousIntegration(d: GitHubAuditData): DDTechnicalTest {
  const ci = d.ci;
  if (!ci) {
    return {
      testId: 'T6',
      testName: 'Integration continue',
      severity: 'not_assessable',
      observation: 'Donnees CI non disponibles',
      benchmark: 'Au moins un workflow CI avec >= 90 pct success rate',
      evidence: 'L endpoint actions/workflows n a pas repondu ou un autre CI est utilise (CircleCI, GitLab CI, Jenkins).',
      ddQuestion: 'Quel pipeline CI/CD utilisez-vous ? Tests automatises, lint, build, deploy ?',
    };
  }

  if (ci.workflowsCount === 0) {
    return {
      testId: 'T6',
      testName: 'Integration continue',
      severity: 'alert',
      observation: 'Aucun workflow GitHub Actions',
      benchmark: 'Au moins un workflow CI avec >= 90 pct success rate',
      evidence: 'Aucun workflow GitHub Actions detecte. Le projet utilise peut-etre un autre CI ou n a pas de tests automatises.',
      ddQuestion: 'Sans Actions, quel est votre pipeline d integration continue ? Tests automatises, build, deploy ?',
    };
  }

  const sr = ci.successRate;
  let severity: DDTechnicalTest['severity'] = 'aligned';
  if (sr !== null) {
    if (sr < 0.5) severity = 'alert';
    else if (sr < 0.8) severity = 'attention';
  } else if (ci.recentRunsTotal === 0) {
    severity = 'attention';
  }

  const evidence = [
    `${ci.workflowsCount} workflow(s) detecte(s)${ci.workflowNames.length ? ` : ${ci.workflowNames.slice(0, 5).join(', ')}` : ''}.`,
    ci.recentRunsTotal > 0 ? `${ci.recentRunsSuccess} succes / ${ci.recentRunsFailure} echec(s) sur ${ci.recentRunsTotal} runs recents.` : 'Aucun run recent observe.',
    sr !== null ? `Success rate ${pct(ci.recentRunsSuccess, ci.recentRunsSuccess + ci.recentRunsFailure)} pct.` : '',
  ].filter(Boolean).join(' ');

  return {
    testId: 'T6',
    testName: 'Integration continue',
    severity,
    observation: `${ci.workflowsCount} workflow(s)${sr !== null ? `, ${pct(ci.recentRunsSuccess, ci.recentRunsSuccess + ci.recentRunsFailure)} pct succes` : ''}`,
    benchmark: 'Au moins un workflow CI avec >= 90 pct success rate',
    evidence,
    ddQuestion: severity === 'aligned'
      ? 'Pouvez-vous detailler la couverture des tests automatises ? Unit, integration, end-to-end ?'
      : 'Le taux d echec de la CI est eleve. Tests fragiles, infra instable, ou tests bloques en attente de fix ?',
  };
}

function testBasicSecurity(d: GitHubAuditData): DDTechnicalTest {
  const s = d.security;
  if (!s) {
    return {
      testId: 'T7',
      testName: 'Securite basique',
      severity: 'not_assessable',
      observation: 'Donnees securite non disponibles',
      benchmark: 'Branch protection active, dependabot alerts adressees, secret scanning active',
      evidence: 'Aucune donnee securite recue. Token sans permission ou repo public sans configuration security_and_analysis.',
      ddQuestion: 'Pouvez-vous nous fournir un token PAT avec scope security_events pour permettre l audit complet ?',
    };
  }

  const flags: string[] = [];
  let severity: DDTechnicalTest['severity'] = 'aligned';

  if (s.defaultBranchProtected === false) {
    flags.push('branch protection inactive');
    severity = escalate(severity, 'attention');
  } else if (s.defaultBranchProtected === null && d.authenticated) {
    flags.push('branch protection non observable');
  } else if (s.defaultBranchProtected === null && !d.authenticated) {
    flags.push('branch protection non observable sans token');
  } else if (s.defaultBranchProtected === true) {
    flags.push('branch protection active');
  }

  if (s.dependabotAlerts) {
    const c = s.dependabotAlerts.critical;
    const h = s.dependabotAlerts.high;
    const m = s.dependabotAlerts.medium;
    const l = s.dependabotAlerts.low;
    flags.push(`alertes dependabot ouvertes : ${c} critique(s), ${h} eleve(s), ${m} moyen(s), ${l} faible(s)`);
    if (c > 0) severity = escalate(severity, 'red_flag');
    else if (h >= 3) severity = escalate(severity, 'alert');
    else if (h > 0 || m >= 5) severity = escalate(severity, 'attention');
  } else if (d.authenticated) {
    flags.push('alertes dependabot non accessibles avec ce token');
  } else {
    flags.push('alertes dependabot non accessibles sans token');
  }

  if (s.secretScanningEnabled) flags.push('secret scanning active');
  if (s.codeScanningEnabled) flags.push('code scanning active');
  if (s.vulnerabilityAlertsEnabled) flags.push('vulnerability alerts activees');

  const observation = (s.dependabotAlerts && (s.dependabotAlerts.critical > 0 || s.dependabotAlerts.high > 0))
    ? `${s.dependabotAlerts.critical} critique(s), ${s.dependabotAlerts.high} eleve(s) en cours`
    : (s.defaultBranchProtected === true ? 'protection active' : 'observabilite limitee');

  return {
    testId: 'T7',
    testName: 'Securite basique',
    severity,
    observation,
    benchmark: 'Branch protection active, 0 alerte critique ouverte, secret scanning actif',
    evidence: flags.join('. ') + '.',
    ddQuestion: severity === 'aligned' || severity === 'not_assessable'
      ? 'Quel est votre processus pour les CVE critiques ? SLA de patch, rotation de secrets, audit annuel ?'
      : 'Plusieurs signaux de securite sont a faible niveau. Pouvez-vous detailler votre politique de patching et de gestion des secrets ?',
  };
}

function testDocumentation(d: GitHubAuditData): DDTechnicalTest {
  const doc = d.documentation;
  if (!doc) {
    return {
      testId: 'T8',
      testName: 'Documentation',
      severity: 'not_assessable',
      observation: 'Contenu racine non observable',
      benchmark: 'README, LICENSE, CONTRIBUTING ou docs/, SECURITY.md',
      evidence: 'L endpoint contents n a pas repondu.',
      ddQuestion: 'Ou est hebergee la documentation technique ? README, wiki, site dedie ?',
    };
  }

  const hits: string[] = [];
  if (doc.hasReadme) hits.push('README');
  if (doc.hasLicense) hits.push('LICENSE');
  if (doc.hasContributing) hits.push('CONTRIBUTING');
  if (doc.hasSecurityPolicy) hits.push('SECURITY');
  if (doc.hasCodeOfConduct) hits.push('CODE_OF_CONDUCT');

  let severity: DDTechnicalTest['severity'] = 'aligned';
  if (!doc.hasReadme) severity = 'alert';
  else if (!doc.hasLicense) severity = escalate(severity, 'attention');

  // README de moins de 500 octets : proche d un fichier vide
  if (doc.readmeSizeBytes !== null && doc.readmeSizeBytes < 500) {
    severity = escalate(severity, 'attention');
  }

  return {
    testId: 'T8',
    testName: 'Documentation',
    severity,
    observation: hits.length > 0 ? hits.join(', ') : 'documentation minimale',
    benchmark: 'README + LICENSE + CONTRIBUTING ou SECURITY pour un produit B2B',
    evidence: `Fichiers detectes a la racine : ${hits.length > 0 ? hits.join(', ') : 'aucun'}.${doc.readmeSizeBytes !== null ? ` Taille README ${doc.readmeSizeBytes} octets.` : ''}`,
    ddQuestion: severity === 'aligned'
      ? 'Avez-vous une documentation technique externe (notion, gitbook, mkdocs) en plus du README ?'
      : 'La documentation a la racine du depot est succincte. Documentez-vous l onboarding ingenieur ailleurs ?',
  };
}

function testBusFactor(d: GitHubAuditData): DDTechnicalTest {
  const c = d.contributors;
  if (!c) {
    return {
      testId: 'T9',
      testName: 'Bus factor',
      severity: 'not_assessable',
      observation: 'Donnees contributeurs non disponibles',
      benchmark: 'Top contributeur < 60 pct des commits, au moins 2 contributeurs actifs',
      evidence: 'L endpoint contributeurs n a pas repondu.',
      ddQuestion: 'Combien d ingenieurs ont des droits commit sur ce depot ? Quel est le ratio bus factor ?',
    };
  }

  const top = c.topShareOfCommits;
  const total = c.total;

  let severity: DDTechnicalTest['severity'] = 'aligned';
  if (total <= 1) {
    severity = 'alert';
  } else if (top >= 0.85) {
    severity = 'alert';
  } else if (top >= 0.7) {
    severity = 'attention';
  }

  const observation = total === 1
    ? 'un seul contributeur'
    : `${total} contributeurs, top a ${Math.round(top * 100)} pct`;

  return {
    testId: 'T9',
    testName: 'Bus factor',
    severity,
    observation,
    benchmark: 'Top contributeur < 60 pct des commits, au moins 2 contributeurs actifs',
    evidence: total === 0
      ? 'Aucun contributeur recense.'
      : `${total} contributeurs au total, ${c.top[0]?.login || 'inconnu'} concentre ${Math.round(top * 100)} pct des commits avec ${c.top[0]?.contributions || 0} contributions.${c.activeContributorsRecent !== null ? ` ${c.activeContributorsRecent} contributeur(s) actif(s) sur 12 dernieres semaines.` : ''}`,
    ddQuestion: severity === 'aligned'
      ? 'Comment gerez-vous le partage de connaissance technique au sein de l equipe ?'
      : 'Le code semble concentre sur peu de personnes. Que se passe-t-il si la personne cle quitte demain ? Risque de continuite de service ?',
  };
}

function testDependencies(d: GitHubAuditData): DDTechnicalTest {
  const dep = d.dependencies;
  if (!dep) {
    return {
      testId: 'T10',
      testName: 'Gestion des dependances',
      severity: 'not_assessable',
      observation: 'Manifests de dependances non observables',
      benchmark: 'Manifest declare + lock file present',
      evidence: 'Le contenu racine n a pas pu etre lu.',
      ddQuestion: 'Quel ecosysteme utilisez-vous principalement ? Comment gerez-vous les versions de dependances ?',
    };
  }

  let severity: DDTechnicalTest['severity'] = 'aligned';
  if (dep.manifestFiles.length === 0) {
    // Pas de manifest detectable. Possible mono-repo, projet de docs,
    // ou ecosysteme non supporte. On ne penalise pas durement.
    severity = 'not_assessable';
  } else if (!dep.hasLockFile) {
    severity = 'attention';
  }

  const evidence = [
    `Manifests : ${dep.manifestFiles.length > 0 ? dep.manifestFiles.join(', ') : 'aucun detecte'}.`,
    `Lock files : ${dep.lockFiles.length > 0 ? dep.lockFiles.join(', ') : 'aucun'}.`,
    dep.primaryEcosystem ? `Ecosysteme principal : ${dep.primaryEcosystem}.` : '',
  ].filter(Boolean).join(' ');

  return {
    testId: 'T10',
    testName: 'Gestion des dependances',
    severity,
    observation: dep.manifestFiles.length > 0
      ? `${dep.manifestFiles.length} manifest(s)${dep.hasLockFile ? ' + lock' : ' sans lock'}`
      : 'aucun manifest detecte',
    benchmark: 'Manifest declare + lock file present pour reproductibilite des builds',
    evidence,
    ddQuestion: severity === 'aligned'
      ? 'Comment auditez-vous les CVE des dependances ? Renovate, dependabot, audit manuel ?'
      : (dep.manifestFiles.length === 0
          ? 'Quel ecosysteme utilisez-vous ? La structure du depot ne montre pas de manifest standard.'
          : 'L absence de lock file rend les builds non reproductibles. Pratique deliberee ou oubli ?'),
  };
}

// ============================================================
// Synthese rule-based
// ============================================================

function computeGlobalScore(tests: DDTechnicalOutput['tests']): number {
  const arr = [
    tests.releaseCadence,
    tests.commitCadence,
    tests.repoFreshness,
    tests.issuesDiscipline,
    tests.pullRequestsDiscipline,
    tests.continuousIntegration,
    tests.basicSecurity,
    tests.documentation,
    tests.busFactor,
    tests.dependencies,
  ];
  const sum = arr.reduce((s, t) => s + severityScore(t.severity), 0);
  return Math.round((sum / (arr.length * 10)) * 100);
}

function computeVerdict(
  score: number,
  tests: DDTechnicalOutput['tests'],
): DDTechnicalOutput['verdict'] {
  // Si freshness est red_flag (depot archive ou abandonne) c est un
  // red_flag global meme si le score est moyen
  if (tests.repoFreshness.severity === 'red_flag') return 'tech_red_flags';
  if (tests.basicSecurity.severity === 'red_flag') return 'tech_red_flags';
  if (tests.commitCadence.severity === 'red_flag') return 'tech_red_flags';
  if (score >= 85) return 'tech_strong';
  if (score >= 70) return 'tech_solid';
  if (score >= 55) return 'tech_partial';
  if (score >= 35) return 'tech_concerns';
  return 'tech_red_flags';
}

function buildSynthesis(
  output: Omit<DDTechnicalOutput, 'synthesis' | 'questionsToInstruct' | 'criticalAlerts'>,
): { synthesis: string; criticalAlerts: string[]; questions: string[] } {
  const tests = output.tests;
  const v = output.vitals;
  const repo = output.repo;
  const meta: string[] = [];

  // Phrase 1 : positionnement general
  const lang = repo?.primaryLanguage ? `${repo.primaryLanguage}` : 'pile non identifiee';
  const verdictLabel: Record<DDTechnicalOutput['verdict'], string> = {
    tech_strong: 'Discipline d ingenierie elevee',
    tech_solid: 'Projet correct',
    tech_partial: 'Projet observable mais avec des zones d ombre',
    tech_concerns: 'Plusieurs alertes sur la maintenabilite',
    tech_red_flags: 'Red flags structurels',
    not_applicable: 'Audit non realisable',
  };
  meta.push(`${verdictLabel[output.verdict]} sur ce depot ${lang}, score global ${output.globalScore} sur 100.`);

  // Phrase 2 : activite
  if (v.last12Weeks !== null && v.daysSinceLastPush !== null) {
    if (v.last12Weeks === 0) {
      meta.push(`Le depot n a recu aucun commit sur les 12 dernieres semaines, dernier push il y a ${v.daysSinceLastPush} jours.`);
    } else if (v.last12Weeks < 20) {
      meta.push(`Activite recente faible : ${v.last12Weeks} commits sur 12 semaines, dernier push il y a ${v.daysSinceLastPush} jours.`);
    } else {
      meta.push(`Activite soutenue : ${v.last12Weeks} commits sur 12 semaines${v.activeContributorsRecent !== null ? ` portes par ${v.activeContributorsRecent} contributeur(s)` : ''}, dernier push il y a ${v.daysSinceLastPush} jours.`);
    }
  }

  // Phrase 3 : releases et PR
  if (v.releasesLast365 !== null) {
    if (v.releasesLast365 === 0) {
      meta.push(`Aucune release publiee sur 365 jours, ce qui complique le suivi des livraisons en l absence d un autre mecanisme de versioning.`);
    } else {
      const releasePart = `${v.releasesLast365} release(s) sur 12 mois${v.medianReleaseIntervalDays !== null ? `, intervalle median ${v.medianReleaseIntervalDays} jours` : ''}`;
      const prPart = v.medianPRTimeToMergeDays !== null ? `, time-to-merge median ${v.medianPRTimeToMergeDays} jours sur les PRs recentes` : '';
      meta.push(`Cadence : ${releasePart}${prPart}.`);
    }
  }

  // Phrase 4 : securite
  const sec = tests.basicSecurity;
  if (sec.severity === 'red_flag' || sec.severity === 'alert') {
    meta.push(`Securite : ${sec.observation}, a traiter avant un IC.`);
  } else if (sec.severity === 'attention') {
    meta.push(`Securite : ${sec.observation}, signaux a confirmer aupres du CTO.`);
  } else if (sec.severity === 'aligned') {
    meta.push(`Securite : ${sec.observation}, hygiene de base presente.`);
  } else {
    meta.push(`Securite : observabilite limitee${output.authenticated ? '' : ' faute de token avec scope security'}, jugement reserve.`);
  }

  // Phrase 5 : bus factor et dependances
  const bus = tests.busFactor;
  const dep = tests.dependencies;
  const segments: string[] = [];
  if (bus.severity === 'alert' || bus.severity === 'attention') segments.push(`concentration des commits ${bus.observation}`);
  if (dep.severity === 'attention' || dep.severity === 'alert') segments.push(`gestion dependances ${dep.observation}`);
  if (segments.length > 0) meta.push(`Points de fragilite : ${segments.join(', ')}.`);

  // Alertes critiques
  const criticalAlerts: string[] = [];
  for (const t of [tests.repoFreshness, tests.basicSecurity, tests.commitCadence, tests.busFactor, tests.continuousIntegration, tests.releaseCadence]) {
    if (t.severity === 'red_flag') criticalAlerts.push(`${t.testName} (red flag) : ${t.observation}`);
    else if (t.severity === 'alert') criticalAlerts.push(`${t.testName} (alerte) : ${t.observation}`);
    if (criticalAlerts.length >= 3) break;
  }

  // Questions DD prioritaires : on prend les questions des tests
  // alert et red_flag en priorite, puis attention, puis aligned.
  const allTests = Object.values(tests);
  const ranked = [...allTests].sort((a, b) => {
    const order: DDTechnicalTest['severity'][] = ['red_flag', 'alert', 'attention', 'not_assessable', 'aligned'];
    return order.indexOf(a.severity) - order.indexOf(b.severity);
  });
  const questions = ranked.slice(0, 6).map(t => `[${t.testId}] ${t.ddQuestion}`);

  return {
    synthesis: meta.join(' '),
    criticalAlerts,
    questions,
  };
}

// ============================================================
// Point d entree principal
// ============================================================

export async function analyzeDDTechnical(
  repoUrl: string | null,
  githubToken: string | null,
): Promise<DDTechnicalOutput> {
  const baseEmpty = {
    triggered: false,
    repo: null,
    authenticated: false,
    vitals: emptyVitals(),
    tests: emptyTests('no input'),
    globalScore: 0,
    verdict: 'not_applicable' as const,
    criticalAlerts: [],
    questionsToInstruct: [],
    synthesis: '',
    fetchErrors: [],
    audit: {
      fetchedAt: new Date().toISOString(),
      repoUrl: repoUrl || '',
      tokenProvided: !!(githubToken && githubToken.trim().length > 0),
    },
  };

  if (!repoUrl || repoUrl.trim().length === 0) {
    return {
      ...baseEmpty,
      reasonNotTriggered: 'Aucune URL de depot fournie. Renseignez le champ Repo GitHub dans la Data Room pour declencher l audit.',
    };
  }

  const ident = parseRepoIdentifier(repoUrl);
  if (!ident) {
    return {
      ...baseEmpty,
      reasonNotTriggered: `URL de depot non reconnue : ${repoUrl}. Format attendu : https://github.com/owner/repo ou owner/repo.`,
    };
  }

  let data: GitHubAuditData;
  try {
    data = await fetchGitHubAuditData(ident, githubToken);
  } catch (err: any) {
    return {
      ...baseEmpty,
      audit: { ...baseEmpty.audit, repoUrl },
      reasonNotTriggered: `Erreur reseau lors de l interrogation de l API GitHub : ${err?.message || 'unknown'}.`,
    };
  }

  // Si la metadata est null, le depot n a pas pu etre lu. On retourne
  // not_applicable avec l erreur exposee.
  if (!data.metadata) {
    return {
      ...baseEmpty,
      audit: { ...baseEmpty.audit, repoUrl },
      authenticated: data.authenticated,
      fetchErrors: data.fetchErrors,
      reasonNotTriggered: data.fetchErrors.length > 0
        ? `Depot inaccessible : ${data.fetchErrors[0].message}. Verifiez que l URL est correcte et que le token a les bons droits.`
        : 'Depot inaccessible. Verifiez que l URL est correcte et que le token a les bons droits.',
    };
  }

  const tests = {
    releaseCadence: testReleaseCadence(data),
    commitCadence: testCommitCadence(data),
    repoFreshness: testRepoFreshness(data),
    issuesDiscipline: testIssuesDiscipline(data),
    pullRequestsDiscipline: testPullRequestsDiscipline(data),
    continuousIntegration: testContinuousIntegration(data),
    basicSecurity: testBasicSecurity(data),
    documentation: testDocumentation(data),
    busFactor: testBusFactor(data),
    dependencies: testDependencies(data),
  };

  const globalScore = computeGlobalScore(tests);
  const verdict = computeVerdict(globalScore, tests);

  const repo = {
    owner: ident.owner,
    name: ident.repo,
    fullName: data.metadata.fullName,
    visibility: data.metadata.visibility,
    description: data.metadata.description,
    primaryLanguage: data.metadata.primaryLanguage,
    license: data.metadata.license,
    homepage: data.metadata.homepage,
    stars: data.metadata.stars,
    forks: data.metadata.forks,
    isFork: data.metadata.isFork,
    archived: data.metadata.archived,
    disabled: data.metadata.disabled,
    createdAt: data.metadata.createdAt,
    pushedAt: data.metadata.pushedAt,
  };

  const vitals = {
    last4Weeks: data.commitActivity?.last4Weeks ?? null,
    last12Weeks: data.commitActivity?.last12Weeks ?? null,
    last52Weeks: data.commitActivity?.last52Weeks ?? null,
    contributorsTotal: data.contributors?.total ?? null,
    activeContributorsRecent: data.contributors?.activeContributorsRecent ?? null,
    busFactorTopShare: data.contributors?.topShareOfCommits ?? null,
    releasesLast365: data.releases?.releasesLast365Days ?? null,
    medianReleaseIntervalDays: data.releases?.medianIntervalDays ?? null,
    issuesOpen: data.issues?.openCount ?? null,
    issuesClosed: data.issues?.closedCount ?? null,
    prsOpen: data.pullRequests?.openCount ?? null,
    prsMergedLast90: data.pullRequests?.mergedLast90Days ?? null,
    medianPRTimeToMergeDays: data.pullRequests?.medianTimeToMergeDays ?? null,
    ciSuccessRate: data.ci?.successRate ?? null,
    daysSinceLastPush: daysSince(data.metadata.pushedAt),
    primaryEcosystem: data.dependencies?.primaryEcosystem ?? null,
  };

  const partial: Omit<DDTechnicalOutput, 'synthesis' | 'questionsToInstruct' | 'criticalAlerts'> = {
    triggered: true,
    repo,
    authenticated: data.authenticated,
    vitals,
    tests,
    globalScore,
    verdict,
    fetchErrors: data.fetchErrors,
    audit: {
      fetchedAt: data.fetchedAt,
      repoUrl,
      tokenProvided: data.authenticated,
    },
  };

  const { synthesis, criticalAlerts, questions } = buildSynthesis(partial);

  return {
    ...partial,
    criticalAlerts,
    questionsToInstruct: questions,
    synthesis,
  };
}

// ============================================================
// Helpers de structure vide pour cas not_applicable
// ============================================================

function emptyVitals(): DDTechnicalOutput['vitals'] {
  return {
    last4Weeks: null,
    last12Weeks: null,
    last52Weeks: null,
    contributorsTotal: null,
    activeContributorsRecent: null,
    busFactorTopShare: null,
    releasesLast365: null,
    medianReleaseIntervalDays: null,
    issuesOpen: null,
    issuesClosed: null,
    prsOpen: null,
    prsMergedLast90: null,
    medianPRTimeToMergeDays: null,
    ciSuccessRate: null,
    daysSinceLastPush: null,
    primaryEcosystem: null,
  };
}

function emptyTest(testId: string, testName: string, reason: string): DDTechnicalTest {
  return {
    testId,
    testName,
    severity: 'not_assessable',
    observation: reason,
    benchmark: '',
    evidence: '',
    ddQuestion: '',
  };
}

function emptyTests(reason: string): DDTechnicalOutput['tests'] {
  return {
    releaseCadence: emptyTest('T1', 'Cadence des releases', reason),
    commitCadence: emptyTest('T2', 'Cadence des commits', reason),
    repoFreshness: emptyTest('T3', 'Fraicheur du depot', reason),
    issuesDiscipline: emptyTest('T4', 'Discipline issues', reason),
    pullRequestsDiscipline: emptyTest('T5', 'Discipline pull requests', reason),
    continuousIntegration: emptyTest('T6', 'Integration continue', reason),
    basicSecurity: emptyTest('T7', 'Securite basique', reason),
    documentation: emptyTest('T8', 'Documentation', reason),
    busFactor: emptyTest('T9', 'Bus factor', reason),
    dependencies: emptyTest('T10', 'Gestion des dependances', reason),
  };
}
