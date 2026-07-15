// ============================================================
// SAAS METRICS ENGINE - Extraction LLM dediee NDR, Magic Number,
// et unit economics (CAC, CVR, ACV, marge brute)
// ------------------------------------------------------------
// Le moteur indicators-engine produit sept KPI canoniques mais
// trois d entre eux (Net Dollar Retention, Magic Number, Payback
// CAC) restent quasi systematiquement non-applicables ou peu
// fiables sur les dossiers reels :
//   - NDR / Magic Number : le moteur financial-extraction-engine
//     n extrait pas les cohortes ni la depense Sales & Marketing
//     par periode.
//   - Payback CAC : le CAC declare par le fondateur est souvent
//     un CPL (cost per lead) deguise en CAC, ce qui sous-estime
//     le payback reel sur les dossiers a conversion basse. Sans
//     extraction du taux de conversion lead-to-customer (CVR),
//     le verdict est trompeur.
//
// Ce moteur dedie corrige les trois problemes. Il fait un appel
// LLM cible (Sonnet 4.5) sur le pitch deck plus le contenu textuel
// du BP, avec un prompt structure qui demande explicitement :
//   - NDR / NRR declare (regex liste, valeurs entre 60 et 200%)
//   - Cohort retention si tableau de cohortes present
//   - Logo churn et expansion si declares separement (reconstruction)
//   - Magic Number declare
//   - Sales spend annuel/trimestriel + new ARR pour calcul backup
//   - CAC declare et sa base reelle (per-customer / per-lead / per-mql)
//   - CVR (funnel de conversion) pour corriger le CAC si necessaire
//   - ACV et marge brute si declares dans le pitch
//
// Le LLM ne calcule pas, il extrait et qualifie. Le calcul derive
// (NDR a partir de GRR + expansion, Magic Number a partir de S&M,
// CAC effectif a partir de CAC declare et CVR) reste dans ce module
// en TypeScript deterministe pour auditabilite.
//
// COUT : un appel Sonnet supplementaire par dossier, 2000-3000
// tokens output. Justifie par le gain de signal sur les indicateurs
// les plus structurants pour qualifier un SaaS B2B.
//
// FALLBACK : si le moteur echoue (timeout, parse error, sans pitch),
// l output est un objet vide qui laisse indicators-engine retomber
// sur son comportement actuel (regex sur rawNotes, financial-data
// brut). Aucune regression possible.
// ============================================================

import { callClaudeWithPDF, parseJSON, MODEL } from './anthropic-client';
import { normalizeFrText } from '../data/text-normalize';
import type { ExtractionOutput } from './types';

// ============================================================
// TYPES
// ============================================================

/**
 * Source de la metrique : declaree explicitement dans le pitch ou
 * le BP, calculee a partir d autres champs (GRR + expansion pour NDR,
 * S&M + new ARR pour Magic Number), ou absente. Permet d afficher
 * une confiance differenciee dans la note.
 */
export type MetricProvenance =
  | 'declared'
  | 'computed-from-cohorts'
  | 'computed-from-grr-and-expansion'
  | 'computed-from-quarterly-sm'
  | 'computed-from-annual-sm'
  | 'absent';

/**
 * Base sur laquelle le CAC declare est calcule. Determine si une
 * correction par CVR est necessaire pour obtenir le CAC effectif
 * par customer signe.
 *
 *   per-customer : CAC = depense d acquisition / customers signes.
 *                  Pas de correction necessaire.
 *   per-lead     : CAC = depense / leads generes. Le CAC effectif
 *                  par customer signe = CAC declare / CVR.
 *   per-mql      : CAC = depense / marketing qualified leads.
 *                  Correction par MQL-to-customer rate.
 *   per-trial    : CAC = depense / trials lances. Correction par
 *                  trial-to-paid rate.
 *   unclear      : la base n a pas pu etre identifiee. On ne corrige
 *                  pas, mais on flag dataConfidence en medium.
 *   absent       : pas de CAC declare.
 */
export type CacBasis =
  | 'per-customer'
  | 'per-lead'
  | 'per-mql'
  | 'per-trial'
  | 'unclear'
  | 'absent';

/**
 * Resultat de l extraction NDR / NRR. NDR = (revenue cohorte a T+12)
 * / (revenue cohorte a T0), exprime en %. Inclut churn (negatif),
 * downsell (negatif), upsell (positif), expansion (positif).
 *
 * Si le pitch declare GRR (Gross Retention Rate, sans expansion) et
 * un taux d expansion separes, on reconstruit NDR ~ GRR + expansion.
 * Approximatif mais utile en l absence de donnee directe.
 */
export interface RetentionMetricsExtraction {
  /** NDR / NRR si declare ou calculable (en %). */
  ndr: number | null;
  /** Source de la valeur NDR. */
  ndrProvenance: MetricProvenance;
  /** Gross Retention Rate si declare (en %). */
  grr: number | null;
  /** Logo churn annuel si declare (en %). */
  logoChurnAnnual: number | null;
  /** Net expansion rate si declare (upsell - downsell, en %). */
  netExpansionRate: number | null;
  /** Note explicative en clair pour la note d investissement. */
  notes: string;
}

/**
 * Resultat de l extraction Magic Number. Magic Number = Net New ARR
 * (Q) / Sales & Marketing Spend (Q-1), parfois annualise (x4). Sain
 * au-dessus de 0,75. Excellent au-dessus de 1,5.
 *
 * Si on n a que les chiffres annuels (cas frequent au seed), on
 * calcule Magic Number annuel = New ARR (annee N) / S&M (annee N-1).
 * Moins precis mais directionnel.
 */
export interface SalesEfficiencyExtraction {
  /** Magic Number declare ou calcule. */
  magicNumber: number | null;
  /** Source de la valeur. */
  magicNumberProvenance: MetricProvenance;
  /** Sales & Marketing spend annuel le plus recent (millions EUR). */
  annualSmSpend: number | null;
  /** Annee correspondante. */
  annualSmYear: string | null;
  /** New ARR annuel correspondant (millions EUR). */
  annualNewArr: number | null;
  /** Annee correspondante. */
  annualNewArrYear: string | null;
  /** Note explicative en clair pour la note d investissement. */
  notes: string;
}

/**
 * Resultat de l extraction des unit economics (CAC, CVR, ACV, marge).
 * L objectif est de fiabiliser le calcul de Payback CAC en distinguant
 * un CAC declare honnetement (par customer signe) d un CAC apparent
 * (par lead, par MQL) qui sous-estime le cout d acquisition reel sur
 * les dossiers a conversion basse.
 *
 * Le CAC effectif par customer signe est calcule par le moteur :
 *   - basis = per-customer : effectiveCac = declaredCac
 *   - basis = per-lead avec CVR connu : effectiveCac = declaredCac / (CVR / 100)
 *   - basis = per-mql avec mqlToCustomerRate : effectiveCac = declaredCac / (rate / 100)
 *   - basis = unclear ou CVR absent : effectiveCac = declaredCac (pas de correction)
 *     mais dataConfidence sera flagge medium dans indicators-engine.
 */
export interface UnitEconomicsExtraction {
  /** CAC tel que declare dans le pitch ou le BP (EUR par unite de basis). */
  declaredCac: number | null;
  /** Base du CAC declare (per-customer / per-lead / per-mql / per-trial / unclear). */
  declaredCacBasis: CacBasis;
  /** Taux de conversion lead-to-customer si extractible (en %). */
  leadToCustomerRate: number | null;
  /** Taux de conversion MQL-to-customer si extractible (en %). */
  mqlToCustomerRate: number | null;
  /** Description du funnel si visible (ex : '1000 visites, 50 leads, 5 customers'). */
  funnelDescription: string | null;
  /** CAC effectif par customer signe, calcule par le moteur (EUR). */
  effectiveCacPerCustomer: number | null;
  /** ACV (Annual Contract Value) si declare dans le pitch (EUR). */
  declaredAcv: number | null;
  /** Marge brute en % si declaree dans le pitch ou le BP. */
  declaredGrossMarginPct: number | null;
  /** Note explicative pour la note d investissement. */
  notes: string;
}

/**
 * Output complet du moteur. Tous les champs peuvent etre null si la
 * donnee n est pas presente. Le moteur ne renvoie jamais d erreur :
 * en cas de parse failure, il renvoie un objet vide.
 */
export interface SaasMetricsExtraction {
  retention: RetentionMetricsExtraction;
  salesEfficiency: SalesEfficiencyExtraction;
  unitEconomics: UnitEconomicsExtraction;
  /** Indique si le moteur a tourne avec succes (false = fallback). */
  extractionSucceeded: boolean;
}

// ============================================================
// PROMPT
// ============================================================

const SYSTEM_PROMPT = `Tu es le Moteur d'Extraction des Métriques SaaS de Prélude. Ton rôle est unique : extraire trois familles de métriques que les autres moteurs ratent systématiquement, parce qu'elles sont enfouies dans le pitch ou le BP sans format standard.

Le francais produit doit etre correctement accentue. Tous les caracteres accentues (e accent aigu, e accent grave, a accent grave, u accent grave, e accent circonflexe, c cedille, etc.) doivent figurer. L omission systematique d accents est interdite et invalide la reponse.

# CE QUE TU CHERCHES

## 1. Retention (NDR / NRR / cohortes)

Le Net Dollar Retention (NDR), aussi appelé Net Revenue Retention (NRR), mesure ce que devient une cohorte de clients sur 12 mois. Formule : revenue de la cohorte à T+12 / revenue de la cohorte à T0. Au-dessus de 100% = expansion nette. En dessous = érosion.

Tu extrais en priorité :
- Une mention explicite "NDR XX%", "NRR XX%", "Net Dollar Retention XX%", "Net Revenue Retention XX%". Valeurs typiques entre 60% et 180%. Si tu vois 200% c'est suspect, vérifie le contexte.
- Un tableau de cohortes (souvent en page traction du deck) qui montre l'évolution du revenue par millésime. Si tu peux déduire une retention de cohorte à 12 mois, fais-le.
- Si NDR n'est pas déclaré mais Gross Retention Rate (GRR, sans expansion) ET un taux d'expansion sont déclarés séparément, calcule NDR = GRR + expansion. Marque alors la provenance "computed-from-grr-and-expansion".
- Logo churn annuel et expansion rate si déclarés séparément (utiles même si NDR n'est pas calculable).

## 2. Sales Efficiency (Magic Number)

Le Magic Number est l'efficacité go-to-market. Formule canonique : New ARR (trimestre Q) / Sales & Marketing Spend (Q-1), annualisé. Au-dessus de 0,75 = sain. Au-dessus de 1,5 = excellent.

Tu extrais en priorité :
- Une mention explicite "Magic Number X.YY". Valeurs typiques entre 0,1 et 3,0.
- Sales & Marketing spend par trimestre ET New ARR par trimestre. Si tu trouves les deux, calcule.
- Sales & Marketing spend annuel ET New ARR annuel (calculé sur la croissance ARR YoY). Calcule un Magic Number annuel approximatif. Marque "computed-from-annual-sm".

## 3. Unit Economics (CAC, CVR, ACV, marge)

Le Payback CAC mesure le temps nécessaire pour amortir le coût d'acquisition d'un client. Formule : CAC / (ARPU mensuel * marge brute). MAIS : la fiabilité du verdict dépend entièrement de ce que le fondateur appelle "CAC". Beaucoup de pitchs annoncent un CAC qui est en réalité un Cost Per Lead (CPL) ou un Cost Per MQL, ce qui sous-estime drastiquement le coût réel d'acquisition d'un customer signé sur les dossiers à conversion basse.

Ta mission est d'extraire :

a) Le CAC tel qu'il est déclaré (declaredCac, en EUR), et SURTOUT sa base réelle (declaredCacBasis) :
   - "per-customer" : le CAC est calculé en divisant la dépense d'acquisition par le nombre de customers signés (le seul calcul honnête)
   - "per-lead" : le CAC est en réalité un CPL (dépense / leads générés). Indices : le pitch parle de "leads" plutôt que "customers", ou affiche un funnel où les leads sont 10-100 fois plus nombreux que les customers
   - "per-mql" : Marketing Qualified Leads. Indice : présence d'un funnel MQL -> SQL -> customer
   - "per-trial" : par essai gratuit lancé. Indice : modèle freemium / trial-led growth
   - "unclear" : impossible de trancher
   - "absent" : pas de CAC déclaré du tout

b) Le taux de conversion lead-to-customer (leadToCustomerRate, en %) si extractible. Souvent visible dans une slide funnel : "1000 visites, 50 leads, 5 customers" donne un lead-to-customer de 10%. Sur les dossiers B2C, ce taux est souvent inférieur à 5%, ce qui change radicalement le payback réel.

c) Le taux MQL-to-customer (mqlToCustomerRate, en %) si le pitch utilise un funnel B2B classique.

d) Une description textuelle du funnel observé (funnelDescription) pour permettre la vérification humaine en DD.

e) L'ACV (Annual Contract Value) si déclaré séparément dans le pitch (parfois différent du revenue moyen extrait du BP).

f) La marge brute en % si déclarée.

## RÈGLES STRICTES

1. Tu n'inventes rien. Si la donnée n'est pas présente, retourne null.
2. Tu reportes la valeur exacte déclarée, sans recalculer ni arrondir.
3. Tu ne fais des calculs dérivés QUE si tous les inputs nécessaires sont présents et clairement identifiés.
4. Toutes les valeurs monétaires en millions EUR pour les revenus annuels, en EUR bruts pour le CAC et l'ACV par client.
5. Toutes les valeurs de retention et de conversion en %, sans le signe.
6. Si le dossier ne porte pas de modèle récurrent (e-commerce DTC, marketplace one-shot, mediatech sans abonnement), NDR et Magic Number sont non pertinents (retourne null avec note explicative). Le CAC reste pertinent si l'acquisition est payante.
7. Pour declaredCacBasis : sois agressif sur la détection de "per-lead" déguisé. Si le pitch parle abondamment de leads, MQL, conversion funnel, sans donner explicitement un coût par customer signé, c'est presque toujours un CAC apparent et non réel.

# FORMAT JSON OBLIGATOIRE

{
  "retention": {
    "ndr": null ou nombre (en %),
    "ndrProvenance": "declared" | "computed-from-cohorts" | "computed-from-grr-and-expansion" | "absent",
    "grr": null ou nombre,
    "logoChurnAnnual": null ou nombre,
    "netExpansionRate": null ou nombre,
    "notes": "phrase explicative ou citation textuelle de la source"
  },
  "salesEfficiency": {
    "magicNumber": null ou nombre,
    "magicNumberProvenance": "declared" | "computed-from-quarterly-sm" | "computed-from-annual-sm" | "absent",
    "annualSmSpend": null ou nombre (millions EUR),
    "annualSmYear": null ou "2024" / "2025" etc,
    "annualNewArr": null ou nombre (millions EUR),
    "annualNewArrYear": null ou "2024" / "2025" etc,
    "notes": "phrase explicative ou citation textuelle de la source"
  },
  "unitEconomics": {
    "declaredCac": null ou nombre (EUR par unité de basis),
    "declaredCacBasis": "per-customer" | "per-lead" | "per-mql" | "per-trial" | "unclear" | "absent",
    "leadToCustomerRate": null ou nombre (en %),
    "mqlToCustomerRate": null ou nombre (en %),
    "funnelDescription": null ou phrase courte décrivant le funnel observé,
    "declaredAcv": null ou nombre (EUR par client par an),
    "declaredGrossMarginPct": null ou nombre (en %),
    "notes": "phrase explicative qui justifie la basis et signale les ambiguïtés"
  }
}

Tu retournes uniquement le JSON, sans préambule ni explication. Si le dossier n'a aucune trace de ces métriques, tu retournes le JSON avec tous les champs à null et une note brève indiquant pourquoi.`;

// ============================================================
// FALLBACK
// ============================================================

/**
 * Output vide retourne quand l extraction echoue ou que le pitch
 * n est pas exploitable. Permet a indicators-engine de retomber
 * gracieusement sur son comportement actuel (regex rawNotes).
 */
function emptyOutput(): SaasMetricsExtraction {
  return {
    retention: {
      ndr: null,
      ndrProvenance: 'absent',
      grr: null,
      logoChurnAnnual: null,
      netExpansionRate: null,
      notes: '',
    },
    salesEfficiency: {
      magicNumber: null,
      magicNumberProvenance: 'absent',
      annualSmSpend: null,
      annualSmYear: null,
      annualNewArr: null,
      annualNewArrYear: null,
      notes: '',
    },
    unitEconomics: {
      declaredCac: null,
      declaredCacBasis: 'absent',
      leadToCustomerRate: null,
      mqlToCustomerRate: null,
      funnelDescription: null,
      effectiveCacPerCustomer: null,
      declaredAcv: null,
      declaredGrossMarginPct: null,
      notes: '',
    },
    extractionSucceeded: false,
  };
}

// ============================================================
// POINT D ENTREE
// ============================================================

/**
 * Extrait les metriques NDR et Magic Number du pitch et du BP.
 *
 * @param deckBase64 PDF du pitch deck en base64
 * @param bpContent contenu textuel du BP (Excel, CSV, Word converti),
 *                  ou null si pas de BP
 * @param extraction extraction Bloc 1 deja faite, sert de contexte
 *                   au prompt (secteur, stage, montant)
 * @returns extraction structuree, ou objet vide en cas d echec
 */
export async function extractSaasMetrics(
  deckBase64: string,
  bpContent: string | null,
  extraction: ExtractionOutput,
): Promise<SaasMetricsExtraction> {
  // Court-circuit : si l asset class ne porte ni modele recurrent ni
  // acquisition par funnel marketing classique, pas la peine de bruler
  // un appel LLM. Hardware industriel, manufactur, mediatech vendent
  // typiquement par contrats B2B negocies (peu de CAC marketing
  // mesure). E-commerce DTC et marketplace B2C sont retires de la
  // liste : meme s ils n ont pas de NDR (vente one-shot ou
  // marketplace), ils ont un CAC critique a fiabiliser via le funnel.
  const sector = normalizeFrText(extraction.sector);
  const subSector = normalizeFrText(extraction.subSector);
  const combined = `${sector} ${subSector}`;
  const nonRecurrentPatterns = [
    'mediatech', 'media classique',
    'hardware', 'manufactur',
  ];
  const isNonRecurrent = nonRecurrentPatterns.some((p) => combined.includes(p));
  if (isNonRecurrent) {
    const empty = emptyOutput();
    return {
      ...empty,
      retention: {
        ...empty.retention,
        notes: 'Modele non recurrent detecte (asset class sans abonnement). NDR et Magic Number non pertinents par construction.',
      },
      salesEfficiency: {
        ...empty.salesEfficiency,
        notes: 'Modele non recurrent detecte (asset class sans abonnement). NDR et Magic Number non pertinents par construction.',
      },
      unitEconomics: {
        ...empty.unitEconomics,
        notes: 'Asset class hardware / manufactur / media : acquisition typiquement par contrats B2B negocies, pas de CAC marketing classique. Extraction non lancee.',
      },
      extractionSucceeded: true,
    };
  }

  const userPrompt = `# CONTEXTE DOSSIER

Société : ${extraction.companyName}
Secteur : ${extraction.sector}${extraction.subSector ? ' / ' + extraction.subSector : ''}
Tour : ${extraction.fundraise.stage} ${extraction.fundraise.amount || ''}
Géographie : ${extraction.country || 'non précisée'}

Le pitch deck est joint.${bpContent ? '' : ' Aucun business plan séparé disponible : tu travailles uniquement sur le deck.'}

${bpContent ? `# BUSINESS PLAN (extrait textuel)

${bpContent.slice(0, 8000)}

` : ''}# INSTRUCTIONS

Cherche les métriques NDR / NRR / cohortes, Magic Number / Sales Efficiency, et les unit economics (CAC, sa base, CVR, ACV, marge brute) selon le format JSON spécifié. Sur les unit economics, sois rigoureux : si le pitch parle de leads sans donner clairement un coût par customer signé, c'est presque toujours un CAC apparent (per-lead déguisé). Si tu ne trouves rien, retourne le JSON avec valeurs nulles et une note brève. Tu ne devines rien : pas de donnée = null.`;

  try {
    // temperature=0 : extraction NDR / Magic Number, chiffres cites dans le deck.
    const rawResponse = await callClaudeWithPDF(SYSTEM_PROMPT, userPrompt, deckBase64, 2500, MODEL, 0);
    const parsed = parseJSON<SaasMetricsExtraction>(rawResponse);

    // Garde-fous : valider la structure et combler les champs manquants.
    // Le LLM peut occasionnellement omettre un sous-champ.
    const result: SaasMetricsExtraction = {
      retention: {
        ndr: typeof parsed?.retention?.ndr === 'number' ? parsed.retention.ndr : null,
        ndrProvenance: parsed?.retention?.ndrProvenance || 'absent',
        grr: typeof parsed?.retention?.grr === 'number' ? parsed.retention.grr : null,
        logoChurnAnnual: typeof parsed?.retention?.logoChurnAnnual === 'number' ? parsed.retention.logoChurnAnnual : null,
        netExpansionRate: typeof parsed?.retention?.netExpansionRate === 'number' ? parsed.retention.netExpansionRate : null,
        notes: parsed?.retention?.notes || '',
      },
      salesEfficiency: {
        magicNumber: typeof parsed?.salesEfficiency?.magicNumber === 'number' ? parsed.salesEfficiency.magicNumber : null,
        magicNumberProvenance: parsed?.salesEfficiency?.magicNumberProvenance || 'absent',
        annualSmSpend: typeof parsed?.salesEfficiency?.annualSmSpend === 'number' ? parsed.salesEfficiency.annualSmSpend : null,
        annualSmYear: parsed?.salesEfficiency?.annualSmYear || null,
        annualNewArr: typeof parsed?.salesEfficiency?.annualNewArr === 'number' ? parsed.salesEfficiency.annualNewArr : null,
        annualNewArrYear: parsed?.salesEfficiency?.annualNewArrYear || null,
        notes: parsed?.salesEfficiency?.notes || '',
      },
      unitEconomics: {
        declaredCac: typeof parsed?.unitEconomics?.declaredCac === 'number' ? parsed.unitEconomics.declaredCac : null,
        declaredCacBasis: validateCacBasis(parsed?.unitEconomics?.declaredCacBasis),
        leadToCustomerRate: typeof parsed?.unitEconomics?.leadToCustomerRate === 'number' ? parsed.unitEconomics.leadToCustomerRate : null,
        mqlToCustomerRate: typeof parsed?.unitEconomics?.mqlToCustomerRate === 'number' ? parsed.unitEconomics.mqlToCustomerRate : null,
        funnelDescription: typeof parsed?.unitEconomics?.funnelDescription === 'string' ? parsed.unitEconomics.funnelDescription : null,
        effectiveCacPerCustomer: null, // calcule plus bas
        declaredAcv: typeof parsed?.unitEconomics?.declaredAcv === 'number' ? parsed.unitEconomics.declaredAcv : null,
        declaredGrossMarginPct: typeof parsed?.unitEconomics?.declaredGrossMarginPct === 'number' ? parsed.unitEconomics.declaredGrossMarginPct : null,
        notes: parsed?.unitEconomics?.notes || '',
      },
      extractionSucceeded: true,
    };

    // Garde-fou metier : un NDR superieur a 250 est presque
    // certainement une mauvaise extraction (le LLM a confondu un
    // pourcentage de croissance avec NDR). On invalide.
    if (result.retention.ndr != null && (result.retention.ndr < 0 || result.retention.ndr > 250)) {
      result.retention.ndr = null;
      result.retention.ndrProvenance = 'absent';
      result.retention.notes = `Valeur NDR initialement extraite (${parsed?.retention?.ndr}%) hors plage plausible [0, 250]. Invalidee. ` + result.retention.notes;
    }
    // Garde-fou metier : un Magic Number superieur a 5 ou negatif
    // est suspect. Au-dessus de 5 c est typiquement un dossier qui
    // a sous-investi en S&M (atypique au seed).
    if (result.salesEfficiency.magicNumber != null && (result.salesEfficiency.magicNumber < 0 || result.salesEfficiency.magicNumber > 5)) {
      result.salesEfficiency.magicNumber = null;
      result.salesEfficiency.magicNumberProvenance = 'absent';
      result.salesEfficiency.notes = `Valeur Magic Number initialement extraite (${parsed?.salesEfficiency?.magicNumber}x) hors plage plausible [0, 5]. Invalidee. ` + result.salesEfficiency.notes;
    }
    // Garde-fou metier : taux de conversion en %, plages plausibles.
    // Lead-to-customer typique 0,1% (B2C cold) a 25% (B2B SaaS warm).
    // MQL-to-customer typique 5% a 40%.
    if (result.unitEconomics.leadToCustomerRate != null
      && (result.unitEconomics.leadToCustomerRate < 0 || result.unitEconomics.leadToCustomerRate > 100)) {
      result.unitEconomics.leadToCustomerRate = null;
    }
    if (result.unitEconomics.mqlToCustomerRate != null
      && (result.unitEconomics.mqlToCustomerRate < 0 || result.unitEconomics.mqlToCustomerRate > 100)) {
      result.unitEconomics.mqlToCustomerRate = null;
    }

    // Calcul de l effective CAC par customer signe a partir des
    // donnees declarees et de la base. C est le coeur du fix : si le
    // CAC est en realite un CPL (per-lead), on corrige par le CVR
    // pour obtenir le cout reel d acquisition d un client.
    result.unitEconomics.effectiveCacPerCustomer = computeEffectiveCac(result.unitEconomics);

    return result;
  } catch (err) {
    console.warn('[saas-metrics-engine] extraction failed:', err);
    return emptyOutput();
  }
}

/**
 * Valide la basis CAC retournee par le LLM. Si la valeur est
 * inconnue ou manquante, on retombe sur 'absent' plutot que de la
 * propager telle quelle.
 */
function validateCacBasis(raw: unknown): CacBasis {
  const valid: CacBasis[] = ['per-customer', 'per-lead', 'per-mql', 'per-trial', 'unclear', 'absent'];
  if (typeof raw === 'string' && (valid as string[]).includes(raw)) {
    return raw as CacBasis;
  }
  return 'absent';
}

/**
 * Calcule le CAC effectif par customer signe a partir des donnees
 * declarees. La logique est defensive : si on ne peut pas faire
 * mieux, on renvoie le CAC tel que declare. Si la basis est
 * "per-customer" pas de correction. Si "per-lead" et CVR connu,
 * effectiveCac = declaredCac / (CVR / 100). Idem pour MQL.
 */
function computeEffectiveCac(ue: UnitEconomicsExtraction): number | null {
  const cac = ue.declaredCac;
  if (cac == null || cac <= 0) return null;

  switch (ue.declaredCacBasis) {
    case 'per-customer':
      return cac;
    case 'per-lead': {
      const rate = ue.leadToCustomerRate;
      if (rate != null && rate > 0) return Math.round(cac / (rate / 100));
      // Pas de CVR : on ne peut pas corriger, on retourne le brut.
      // Le moteur indicators-engine flagera dataConfidence en medium.
      return cac;
    }
    case 'per-mql': {
      const rate = ue.mqlToCustomerRate;
      if (rate != null && rate > 0) return Math.round(cac / (rate / 100));
      return cac;
    }
    case 'per-trial':
      // Pas de taux trial-to-paid extrait separement (on pourrait
      // l ajouter plus tard). Pour l instant on retourne le brut.
      return cac;
    case 'unclear':
    case 'absent':
    default:
      return cac;
  }
}
