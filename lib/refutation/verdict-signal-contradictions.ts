// ============================================================
// REFUTATION LAYER, BRIQUE 2 : contradictions verdict contre signal
// ------------------------------------------------------------
// Module pur, aucune I/O, aucun branchement au rendu. Detecte
// deterministiquement les cas ou un verdict de moteur affirme une
// chose sur le dossier, alors qu un signal extrait ailleurs dans
// le meme dossier contredit ce verdict.
//
// V1 couvre un axe unique et defendable : le verdict de
// reproductibilite numerique. Ce verdict est produit soit par la
// matrice de pertinence (relevanceMatrix.digitalReproducibility)
// soit par le moteur marche (market.defensibility.aiReplicability).
// Il conclut parfois qu un produit software est facile a repliquer
// par un solo founder assiste d IA en quelques mois. Ce verdict est
// juste dans l abstrait d une couche technique isolee, mais il
// devient faux quand le dossier presente en parallele des marqueurs
// forts de moats non techniques : retention nette elevee sur
// plusieurs annees, base installee de grands comptes, anciennete
// commerciale significative, adherence de longue duree.
//
// Design conservateur, meme discipline que numeric-contradictions :
// on prefere manquer une contradiction que d en inventer une. La
// regle exige au minimum DEUX marqueurs de moat non technique
// concurrents avant de signaler. Un seul marqueur peut etre un
// artefact editorial ; deux marqueurs cumules sur un dossier dont
// le verdict conclut a la commoditisation triviale rendent le
// contraste net et defendable en salle de due diligence.
//
// Cas volontairement NON couverts en V1 :
//   - Contradiction verdict marche contre signal financier
//     (ex: verdict "marche fragmente" + signal "40% part de marche").
//     A traiter dans une V2 dediee avec seuils propres.
//   - Contradiction verdict equipe contre signal traction.
//   - Contradiction verdict fragilite structurelle contre signal
//     de robustesse (ex: pattern fixed cost trap + marge > 60% stable).
//   - Contradiction verdict pattern matching contre signal singulier.
//   - Parsing des chiffres en langue naturelle au dela des motifs
//     documentes ci dessous. Un chiffre ecrit en toutes lettres
//     ("quarante grands comptes") est ignore.
//   - Rentabilite : pas un critere de moat non technique, un modele
//     rentable est reproductible dans l abstrait.
//   - Sous seuils : churn 16% avec 15 clients ne declenche rien,
//     par construction.
// ============================================================

// ============================================================
// Types
// ============================================================

export interface VerdictSignalContradiction {
  /** Identifiant stable de la regle qui a declenche. */
  ruleId: 'ai-replicability-vs-durability-signals';
  /** Verdict qui semble faux au vu des signaux. */
  verdict: {
    source: 'relevanceMatrix.digitalReproducibility' | 'market.defensibility.aiReplicability';
    value: string;
    excerpt: string;
  };
  /** Liste des signaux qui contredisent le verdict. */
  signals: DurabilitySignal[];
  /** Message editorial court pour rendu UI ou log analyste. */
  message: string;
}

export interface DurabilitySignal {
  kind: 'long-term-retention' | 'enterprise-base' | 'company-age' | 'long-tenure-clients';
  observed: string;
  source: 'extraction.traction.customers' | 'extraction.traction.metrics' | 'extraction.yearFounded';
}

// ============================================================
// Seuils - explicites et documentes pour l audit doctrinal
// ============================================================

/**
 * Retention nette minimale sur plusieurs annees pour compter comme
 * marqueur. Choix : 85%. Sous ce seuil, la retention n est plus
 * distinctive d un moat, elle rentre dans la fourchette SaaS normale.
 * La periode doit etre pluri annuelle (>= 2 ans) pour ecarter les
 * chiffres anecdotiques du dernier trimestre.
 */
export const THRESHOLDS = {
  minRetentionRatePercent: 85,
  minRetentionPeriodYears: 2,
  minEnterpriseCustomers: 20,
  minCompanyAgeYears: 10,
  minClientTenureYears: 5,
  /** Nombre minimum de marqueurs concurrents pour declencher. Cette
   *  garde est le coeur de la prudence : un seul signal peut etre
   *  editorial, deux signaux cumules rendent le contraste net. */
  minConcurrentSignals: 2,
} as const;

// ============================================================
// Helpers de parsing - deterministes, regex bornees
// ============================================================

/**
 * Extrait un taux de churn documente sur une periode plurianelle
 * dans une phrase. Retourne { churnPct, periodYears } si pattern
 * reconnu, null sinon. Reconnu :
 *   "Taux de churn de ~12 % sur 3 ans"
 *   "churn 8% sur 5 ans"
 *   "churn annuel de 5% mesure sur 3 ans"
 * Non reconnu : chiffres ecrits en lettres, periode absente, unite
 * absente.
 */
function parseChurnPeriod(text: string): { churnPct: number; periodYears: number } | null {
  if (!text) return null;
  const rx = /churn[^0-9%]{0,40}(\d{1,2}(?:[.,]\d+)?)\s*%[^.]*?sur\s+(\d{1,2})\s+ans?/i;
  const m = text.match(rx);
  if (!m) return null;
  const churnPct = parseFloat(m[1].replace(',', '.'));
  const periodYears = parseInt(m[2], 10);
  if (!Number.isFinite(churnPct) || !Number.isFinite(periodYears)) return null;
  return { churnPct, periodYears };
}

/**
 * Extrait un nombre de grands comptes dans une phrase. Reconnu :
 *   "40 entreprises clientes"
 *   "50 grands comptes"
 *   "36 clients CAC40"
 *   "28 clients SBF120"
 * Le seuil applique en aval verifiera que N >= minEnterpriseCustomers.
 * Retourne le premier nombre extrait ou null.
 */
function parseEnterpriseCount(text: string): number | null {
  if (!text) return null;
  const rx = /(\d{2,4})\s+(?:entreprises?\s+clientes?|grands?\s+comptes?|clients?\s+(?:cac40|sbf120|fortune\s*500|ftse|dax|nikkei))/i;
  const m = text.match(rx);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Extrait une anciennete de membre client dans une metrique.
 * Reconnu :
 *   "15 membres présents depuis 2018"
 *   "8 clients presents depuis 2019"
 * Retourne l annee mentionnee (yearJoined). Le seuil applique en
 * aval verifiera que (currentYear - yearJoined) >= minClientTenureYears.
 */
function parseClientTenureYear(text: string): number | null {
  if (!text) return null;
  const rx = /(?:membres?|clients?)\s+(?:presents?|présents?)\s+depuis\s+(20\d{2}|19\d{2})/i;
  const m = text.match(rx);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  return Number.isFinite(y) ? y : null;
}

// ============================================================
// Extraction du verdict de reproductibilite
// ============================================================

interface VerdictExtracted {
  source: 'relevanceMatrix.digitalReproducibility' | 'market.defensibility.aiReplicability';
  value: string;
  excerpt: string;
}

/**
 * Cherche un verdict qui affirme une reproductibilite elevee ou
 * facile. Deux sources acceptees, priorite au moteur marche s il
 * est present et non ambigu, sinon fallback matrice de pertinence.
 *
 * Retourne null si aucun verdict de reproductibilite facile n est
 * detecte. Un verdict "medium" ou "protected" ne declenche jamais.
 */
function extractEasyReplicabilityVerdict(rj: any): VerdictExtracted | null {
  const marketVerdict = rj?.market?.defensibility?.aiReplicability;
  if (marketVerdict && typeof marketVerdict === 'object') {
    const v = marketVerdict.verdict;
    if (v === 'high_risk') {
      const excerpt = (marketVerdict.reasoning || '').slice(0, 200);
      return {
        source: 'market.defensibility.aiReplicability',
        value: 'high_risk',
        excerpt: excerpt || 'verdict high_risk sans rationale explicite',
      };
    }
  }

  const rm = rj?.relevanceMatrix;
  if (rm && typeof rm === 'object') {
    const digital = rm.digitalReproducibility;
    if (digital === 'high') {
      const rationale = rm?.verdicts?.marketAiReplicability?.rationale
        || (Array.isArray(rm.digitalReproducibilityFactors) ? rm.digitalReproducibilityFactors.join(' ; ') : '');
      return {
        source: 'relevanceMatrix.digitalReproducibility',
        value: 'high',
        excerpt: (rationale || '').slice(0, 200) || 'digitalReproducibility=high sans rationale',
      };
    }
  }

  return null;
}

// ============================================================
// Collecte des signaux de moat non technique
// ============================================================

function collectDurabilitySignals(rj: any, nowYear: number): DurabilitySignal[] {
  const out: DurabilitySignal[] = [];
  const extraction = rj?.extraction || {};
  const traction = extraction?.traction || {};

  // Signal 1 : retention nette >= 85% sur >= 2 ans, parsee depuis
  // metriques ou clients. Cherche uniquement dans les metriques
  // structurees et le champ customers (pas dans rawSummary pour
  // reduire les faux positifs de phrasing).
  const metricsArr: string[] = Array.isArray(traction.metrics) ? traction.metrics.filter((m: any) => typeof m === 'string') : [];
  const customers: string = typeof traction.customers === 'string' ? traction.customers : '';
  const churnSources: { text: string; source: DurabilitySignal['source'] }[] = [
    ...metricsArr.map((m: string) => ({ text: m, source: 'extraction.traction.metrics' as const })),
    { text: customers, source: 'extraction.traction.customers' as const },
  ];
  for (const cs of churnSources) {
    const parsed = parseChurnPeriod(cs.text);
    if (!parsed) continue;
    const retention = 100 - parsed.churnPct;
    if (retention >= THRESHOLDS.minRetentionRatePercent && parsed.periodYears >= THRESHOLDS.minRetentionPeriodYears) {
      out.push({
        kind: 'long-term-retention',
        observed: `rétention ${retention.toFixed(0)}% sur ${parsed.periodYears} ans (churn ${parsed.churnPct}%)`,
        source: cs.source,
      });
      break; // un seul signal retention suffit, evite comptages doublons
    }
  }

  // Signal 2 : base grands comptes >= 20. Cherche dans customers et
  // metrics. Un match suffit.
  const enterpriseSources: { text: string; source: DurabilitySignal['source'] }[] = [
    { text: customers, source: 'extraction.traction.customers' },
    ...metricsArr.map((m: string) => ({ text: m, source: 'extraction.traction.metrics' as const })),
  ];
  for (const es of enterpriseSources) {
    const n = parseEnterpriseCount(es.text);
    if (n !== null && n >= THRESHOLDS.minEnterpriseCustomers) {
      out.push({
        kind: 'enterprise-base',
        observed: `${n} grands comptes documentés`,
        source: es.source,
      });
      break;
    }
  }

  // Signal 3 : anciennete >= 10 ans, calculee a partir de yearFounded.
  const yf = extraction?.yearFounded;
  if (typeof yf === 'number' && yf > 1900 && yf <= nowYear) {
    const age = nowYear - yf;
    if (age >= THRESHOLDS.minCompanyAgeYears) {
      out.push({
        kind: 'company-age',
        observed: `fondée en ${yf}, ${age} ans d’ancienneté`,
        source: 'extraction.yearFounded',
      });
    }
  }

  // Signal 4 : adherence longue duree des clients >= 5 ans, parsee
  // depuis les metriques structurees uniquement.
  for (const m of metricsArr) {
    const y = parseClientTenureYear(m);
    if (y === null) continue;
    const tenure = nowYear - y;
    if (tenure >= THRESHOLDS.minClientTenureYears) {
      out.push({
        kind: 'long-tenure-clients',
        observed: `clients présents depuis ${y}, ${tenure} ans d’adhérence`,
        source: 'extraction.traction.metrics',
      });
      break;
    }
  }

  return out;
}

// ============================================================
// API publique
// ============================================================

export interface DetectOptions {
  /** Annee de reference pour le calcul d anciennete. Par defaut,
   *  l annee courante du systeme. Injectable pour deterministe test. */
  nowYear?: number;
}

/**
 * Detecte les contradictions verdict-signal dans un result_json.
 * V1 : uniquement l axe reproductibilite vs marqueurs de moat non
 * technique. Retourne un tableau vide si aucune contradiction.
 */
export function detectVerdictSignalContradictions(
  resultJson: any,
  opts: DetectOptions = {},
): VerdictSignalContradiction[] {
  if (!resultJson || typeof resultJson !== 'object') return [];
  const nowYear = opts.nowYear ?? new Date().getFullYear();

  const verdict = extractEasyReplicabilityVerdict(resultJson);
  if (!verdict) return [];

  const signals = collectDurabilitySignals(resultJson, nowYear);
  if (signals.length < THRESHOLDS.minConcurrentSignals) return [];

  const message = `Verdict de reproductibilité ${verdict.value} (${verdict.source.split('.').pop()}) contredit par ${signals.length} marqueurs de moat non-technique : ${signals.map(s => s.kind).join(', ')}. Le produit peut être techniquement reproduit, mais la durée d’installation commerciale et la base de grands comptes constituent une barrière non-code.`;

  return [{
    ruleId: 'ai-replicability-vs-durability-signals',
    verdict,
    signals,
    message,
  }];
}
