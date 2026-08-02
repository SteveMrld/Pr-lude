// ============================================================
// VALUATION ENGINE - Calcul de fourchette pre-money
// ------------------------------------------------------------
// Produit une fourchette de valorisation pre-money plausible pour
// le dossier instruit, en croisant trois methodes :
//
//   1. Multiples sectoriels (si revenue/ARR/GMV disponibles)
//   2. Methode VC inverse (si IRR cible et exit attendu)
//   3. Berkus / Scorecard (si pre-revenue, seed)
//
// Le moteur retourne :
//   - Une fourchette consolidee min/central/max
//   - Le detail de chaque methode applicable avec son rationale
//   - L analyse de dilution sur le ticket propose
//   - Les warnings methodologiques
//
// CALCUL DETERMINISTE : pas d appel LLM. Le code lit les outputs
// Bloc 1 (extraction, market, financial coherence, team) et
// produit le resultat. Auditabilite totale, pas de variabilite
// stochastique.
//
// PRINCIPE EDITORIAL : le moteur ne pretend pas predire la
// valorisation que la startup negociera. Il donne au partner une
// fourchette basee sur ce que le marche fait dans des dossiers
// comparables, et le partner ajuste a la marge en fonction de
// signaux qualitatifs non chiffrables. Comme le score, c est un
// ancrage, pas une oracle.
// ============================================================

import {
  getSectorMultiples,
  normalizeAssetClass,
  normalizeStage,
  type ValuationStage,
  type SectorMultipleRange,
} from '@/lib/data/sector-benchmarks';
import { computeBenchmarkFreshnessMonths } from '@/lib/data/indicator-benchmarks';
import type { ExtractionOutput, FinancialCoherenceOutput, FinancialDataExtraction, TeamAnalysisOutput, MarketAnalysisOutput } from '@/lib/engines/types';
import type { RelevanceMatrix } from '@/lib/engines/relevance-matrix';
import {
  deriveDossierReferenceYearWithReason,
  normalizeYear,
} from '@/lib/analysis/reference-year';

// ============================================================
// MILLESIME DE REFERENCE DES MULTIPLES
// ------------------------------------------------------------
// Un multiple sectoriel s applique sur un chiffre d affaires
// realise. Le moteur lisait la projection de l annee d horloge, ce
// qui appliquait des multiples de marche sur un chiffre que
// l entreprise n a pas encore fait : sur In Haircare, base 6,552 M
// projetee 2026 contre 2,113 M realises en 2024, soit une
// valorisation gonflee d un facteur trois.
//
// La regle qui remplace l horloge est ordonnee et exclusive. Elle
// ne cherche pas a etre maligne, elle cherche a etre auditable :
// chaque sortie declare laquelle des trois branches a tranche et
// quel millesime elle a retenu.
//
//   1. explicit-actual : la derniere annee que le deck qualifie
//      explicitement de realise, via la primitive partagee
//      lib/analysis/reference-year. Celle-ci exige lastActualYear
//      ET une citation textuelle du document, plus deux gardes de
//      vraisemblance contre les projections du dossier.
//
//   2. as-of-anterior : a defaut de mention explicite, la derniere
//      annee de la serie strictement anterieure a la date de
//      reception du deck. asOf est une donnee saisie et persistee,
//      pas une lecture d horloge : deux rejeux du meme dossier
//      retiennent le meme millesime, six mois plus tard aussi.
//
//   3. refused : sans asOf exploitable, ou sans annee anterieure
//      dans la serie, le moteur refuse. Les multiples sortent non
//      applicables avec motif ecrit. Une valorisation absente est
//      un resultat, une valorisation ancree sur une projection n en
//      est pas un.
//
// La branche positionnelle qu on avait envisagee (avant-derniere
// annee documentee) a ete ecartee : sur une serie qui court
// jusqu en 2028 elle designe 2027, une projection pure. Elle
// reproduisait le defaut avec un cran de decalage.
//
// new Date().getFullYear() ne figure plus dans ce moteur, sans
// exception.
// ============================================================

export type ValuationBasisBranch = 'explicit-actual' | 'as-of-anterior' | 'refused';

export interface ValuationBasis {
  /** Branche de la regle qui a tranche. */
  branch: ValuationBasisBranch;
  /** Millesime retenu pour lire les series financieres, null si refus. */
  year: number | null;
  /** Phrase editoriale prete pour la note et le dashboard. */
  declaration: string;
  /** Motif du refus, null quand une base a ete retenue. */
  refusalReason: string | null;
}

// ============================================================
// NATURE DE LA VALEUR PRODUITE
// ------------------------------------------------------------
// Les quatre methodes du moteur ne produisent pas la meme grandeur,
// et le moteur les additionnait comme si elles le faisaient.
//
// Un multiple sectoriel s applique a un agregat d exploitation,
// chiffre d affaires ou EBITDA. Les plages du catalogue sont des
// multiples EV, calibres sur Argos, Carta et Atomico. Leur produit
// est donc une valeur d entreprise : ce que vaut l actif economique,
// avant de savoir qui le finance.
//
// Berkus, Scorecard et la VC inverse produisent une valeur des
// capitaux propres avant tour. Berkus plafonne une somme de facteurs
// qualitatifs, Scorecard part d une mediane de pre-money observee, la
// VC inverse soustrait explicitement le ticket d une post-money
// implicite. Aucune ne passe par un agregat d exploitation, aucune
// n a de dette a retrancher.
//
// L ecart entre les deux natures est la dette nette du dossier. Le
// pipeline ne l extrait pas : le contrat d extraction financiere ne
// porte aucun poste de bilan, ni dette financiere, ni tresorerie, ni
// besoin en fonds de roulement.
//
// Doctrine retenue : on ne consolide jamais deux natures. Extraire la
// dette nette pour convertir les multiples en pre-money ajouterait une
// inconnue que les decks fournissent rarement, et l ajouterait sur le
// chiffre le plus visible du produit. On separe, on nomme, et le
// partner fait le rapprochement avec les elements de bilan qu il a et
// que le deck n a pas.
//
// La nature est portee par chaque methode et persistee dans le
// resultat, elle n est jamais deduite a la lecture. Un consommateur
// qui redeviendrait la nature depuis le nom de la methode
// reintroduirait la connaissance implicite que ce champ supprime.
// ============================================================

export type ValuationNature = 'enterprise_value' | 'pre_money';

/** Libelles editoriaux, ecrits tels quels dans la note. */
export const VALUATION_NATURE_LABELS: Record<ValuationNature, string> = {
  enterprise_value: "valeur d'entreprise",
  pre_money: 'pre-money',
};

/**
 * Resultat d une methode de valorisation individuelle. Plusieurs
 * methodes peuvent s appliquer simultanement (ex : multiples ET
 * VC method), mais seules celles de meme nature sont consolidees
 * ensemble.
 */
export interface ValuationMethodResult {
  method: 'sector-multiples' | 'vc-method' | 'berkus' | 'scorecard';
  /**
   * Grandeur que cette methode produit. Declaree meme quand la
   * methode est non applicable : la nature est une propriete de la
   * methode, pas de son resultat, et la note doit pouvoir dire ce qui
   * aurait ete produit.
   */
  nature: ValuationNature;
  /** Nom lisible pour la note. */
  label: string;
  /** True si la methode a pu produire un resultat exploitable. */
  applicable: boolean;
  /** Si non applicable, pourquoi. */
  notApplicableReason?: string;
  /** La fourchette pre-money en euros, si applicable. */
  range?: { min: number; central: number; max: number };
  /** Inputs utilises par la methode (pour transparence). */
  inputs?: Record<string, string | number | null>;
  /** Note metier sur le resultat (assumptions, limites). */
  rationale?: string;
}

/**
 * Resultat global du moteur de valorisation. C est ce qu on stocke
 * dans result.valuation et qu on affiche dans la note PDF.
 */
export interface ValuationOutput {
  /** Fourchette consolidee pre-money en euros. */
  recommendedRange: {
    min: number;
    central: number;
    max: number;
  } | null;
  /** Niveau de fiabilite global de la fourchette. */
  confidence: 'high' | 'medium' | 'low';
  /** Resultat detaille de chacune des methodes. */
  methods: ValuationMethodResult[];
  /** Si un ticket est mentionne dans le pitch, analyse de dilution. */
  dilutionAnalysis?: {
    proposedTicket: number;
    dilutionAtMin: number; // %
    dilutionAtCentral: number;
    dilutionAtMax: number;
    /** Note explicative en clair pour la note. */
    rationale: string;
  } | null;
  /** Asset class normalisee (saas-b2b, fintech, deeptech, etc.) ou
   *  'unclassified' si la matrice n a pas tranche : dans ce cas la
   *  fourchette n est pas calculee, les methodes sont marquees non
   *  applicables et la note doit afficher 'classification a confirmer'. */
  assetClass: string;
  /** Stade normalise (seed, series-a, series-b, series-c-plus). 'unknown'
   *  signale que le pitch n a pas livre un libelle reconnu (bridge,
   *  tour intermediaire, pre-B, extension). Dans ce cas la valorisation
   *  est explicitement marquee non calculable plutot que cale sur les
   *  benchmarks seed par defaut. */
  stage: ValuationStage | 'unknown';
  /** Millesime de reference retenu pour lire les series financieres,
   *  et branche de la regle qui l a tranche. Declare dans la sortie
   *  parce que le classement basis actual/budget de l extraction reste
   *  instable d un run a l autre : la regle ne stabilise pas ce
   *  classement, elle rend le choix explicite et auditable. */
  basis: ValuationBasis;
  /** Phrase de synthese editoriale pour le partner. */
  synthesis: string;
  /** Avertissements methodologiques a remonter. */
  warnings: string[];
  /** Sources des benchmarks utilises. */
  benchmarkSources: string[];
}

interface ValuationInput {
  extraction: ExtractionOutput | null | undefined;
  /** Output du moteur cohérence financière (tests T1-T7). */
  financial: FinancialCoherenceOutput | null | undefined;
  /** Output du moteur d'extraction financière : c'est ICI que vivent les
   * projections revenue/EBITDA/marge brute en millions d'euros, dérivées
   * du BP. Le moteur valuation lit prioritairement ces données pour
   * peupler les multiples sectoriels. */
  financialData?: FinancialDataExtraction | null | undefined;
  team: TeamAnalysisOutput | null | undefined;
  market: MarketAnalysisOutput | null | undefined;
  /** Score equipe mecanique (0-100) calcule par score-calculator. */
  teamScore?: number;
  /** Score marche mecanique (0-100). */
  marketScore?: number;
  /** Matrice de pertinence : source de verite pour l asset class
   * (arbitree avec le productionChain detecte sur le texte complet).
   * Si fournie, le moteur lit matrix.assetClass plutot que de
   * re-classifier sur extraction.sector seul. Voir bug Platypus
   * Craft, mai 2026 : trois classificateurs independants tous biaises
   * vers saas-b2b en silence, on consolide. */
  relevanceMatrix?: RelevanceMatrix | null | undefined;
  /** Date de reception du deck au format YYYY-MM-DD, saisie par le
   * partner en page d entree et persistee en colonne as_of. Sert
   * d ancrage temporel a la branche 2 de la regle de millesime. Une
   * donnee du dossier, pas une lecture d horloge : c est ce qui
   * permet a un rejeu de retenir le meme millesime que le run
   * d origine. Absente, la branche 2 ne peut pas trancher et le
   * moteur refuse plutot que de deviner. */
  asOf?: string | null | undefined;
}

/**
 * Point d entree principal. Calcule la fourchette de valorisation a
 * partir des outputs Bloc 1 et des scores mecaniques.
 */
export function computeValuation(input: ValuationInput): ValuationOutput {
  // Asset class : on lit en priorite matrix.assetClass, source de
  // verite unique arbitree par computeRelevanceMatrix (croisement
  // indice sectoriel + productionChain detecte sur texte complet).
  // Fallback sur la classification locale uniquement si la matrice
  // est absente (legacy / tests unitaires).
  const ext: any = input.extraction;
  const matrixAssetClass = input.relevanceMatrix?.assetClass;
  const stageRaw = ext?.fundraise?.stage || null;
  let assetClass: string;
  if (matrixAssetClass) {
    assetClass = matrixAssetClass;
  } else {
    const assetClassRaw = ext
      ? `${ext.sector || ''} ${ext.subSector || ''}`.trim() || ext.sector
      : null;
    assetClass = normalizeAssetClass(assetClassRaw);
  }
  const stage = normalizeStage(stageRaw);

  // Millesime de reference. Resolu avant toute autre decision parce
  // qu il conditionne la detection profitable-mature, la base des
  // multiples et le facteur rollout de Berkus. Resolu aussi sur le
  // chemin non applicable pour que la sortie declare toujours sur quoi
  // le moteur aurait travaille.
  const basis = resolveValuationBasis(input);

  // Doctrine : si l asset class est non classifiee ou le stade non
  // identifie, on ne calcule pas une fourchette ancree sur des
  // benchmarks decales. On retourne un output ou toutes les methodes
  // sont non applicables, avec un warning explicite, plutot que de
  // simuler une valorisation seed (cas Platypus Craft : dossier
  // industrial-hardware retombait en saas-b2b silencieux et appliquait
  // des multiples ARR sur du hardware unitaire).
  if (assetClass === 'unclassified' || stage === 'unknown') {
    return buildNonApplicableValuation(assetClass, stage, basis);
  }

  // Detection automatique du cas 'profitable-mature' : si on est en
  // Series B+ et qu un EBITDA positif est extrait dans le pitch ou le
  // BP, c est la categorie pertinente. Les multiples EBITDA donnent
  // une fourchette plus precise que les multiples revenue sur ces
  // dossiers. La detection ne s active pas pour les cas SaaS pur ou
  // l EBITDA peut etre negatif tout en ayant des multiples ARR eleves.
  // L EBITDA lu ici est celui du millesime de reference, pas celui de
  // l horloge. La bascule vers profitable-mature exigeait un EBITDA
  // "extrait du pitch ou du BP" et lisait en fait une projection : sur
  // In Haircare, 0,785 M projete 2026 contre 0,138 M en 2024. Une
  // societe deficitaire en realise et beneficiaire en projection
  // changeait donc de classe d actif, donc de plage de multiples et de
  // scenarios d exit, sur la foi d une promesse.
  const ebitda = pickProjectionValueAtYear(input.financialData?.ebitdaProjection, basis.year);
  const isLateStage = stage === 'series-b' || stage === 'series-c-plus';
  const isNonPureSaas = assetClass !== 'saas-b2b'
    && assetClass !== 'cybersecurity'
    && assetClass !== 'ai-generative';
  if (ebitda && ebitda > 0 && isLateStage && isNonPureSaas) {
    assetClass = 'profitable-mature';
  }

  // ---------- Methode 1 : multiples sectoriels
  const multiplesResult = computeBySectorMultiples(input, assetClass, stage, basis);

  // ---------- Methode 2 : VC method inverse
  // Au seed pre-revenue, la VC inverse n est de toutes facons exclue
  // de la consolidation (poids 0). On la marque applicable=false des
  // l entree pour ne pas imprimer un rationnel saas-b2b decalibre
  // alors que la methode ne pese rien dans la fourchette finale.
  const isSeedPreRevenue = stage === 'seed' && !multiplesResult.applicable;
  const vcMethodResult = isSeedPreRevenue
    ? {
        method: 'vc-method' as const,
        nature: 'pre_money' as const,
        label: 'Methode VC inverse',
        applicable: false,
        notApplicableReason: 'Methode reservee aux dossiers avec revenue exploitable. Au seed pre-revenue, la fourchette est ancree sur Berkus et Scorecard, qui valorisent l equipe et l opportunite avant traction commerciale, plutot que sur des exits sectoriels que la jeune entreprise n a pas encore les moyens de viser.',
      }
    : computeByVcMethod(input, assetClass, stage);

  // ---------- Methode 3 : Berkus / Scorecard (seed only)
  const berkusResult = stage === 'seed' ? computeByBerkus(input, basis) : nonApplicableBerkus();
  const scorecardResult = stage === 'seed' ? computeByScorecard(input) : nonApplicableScorecard();

  const methods: ValuationMethodResult[] = [
    multiplesResult,
    vcMethodResult,
    berkusResult,
    scorecardResult,
  ];

  // ---------- Consolidation : moyenne ponderee des methodes applicables
  const applicableMethods = methods.filter((m) => m.applicable && m.range);
  const recommendedRange = consolidateRanges(applicableMethods, stage);

  // ---------- Confiance globale
  const confidence = determineConfidence(applicableMethods, assetClass, stage);

  // ---------- Analyse de dilution si ticket mentionne
  const ticket = parseTicketEur(input.extraction);
  const dilutionAnalysis = (recommendedRange && ticket)
    ? buildDilutionAnalysis(recommendedRange, ticket)
    : null;

  // ---------- Synthese editoriale
  const synthesis = buildSynthesis({
    recommendedRange,
    confidence,
    assetClass,
    stage,
    applicableMethods,
    dilutionAnalysis,
  });

  // ---------- Warnings
  const warnings = collectWarnings(applicableMethods, recommendedRange, basis);

  return {
    recommendedRange,
    confidence,
    methods,
    dilutionAnalysis,
    assetClass,
    stage,
    basis,
    synthesis,
    warnings,
    benchmarkSources: getBenchmarkSources(assetClass),
  };
}

// ============================================================
// METHODE 1 : MULTIPLES SECTORIELS
// ------------------------------------------------------------
// Si on a un revenue / ARR / GMV exploitable, on applique la plage
// de multiples du couple (asset-class, stade). On ajuste a la
// marge selon la qualite mesuree (team score eleve = plus pres du
// max, score faible = plus pres du min).
// ============================================================

function computeBySectorMultiples(
  input: ValuationInput,
  assetClass: string,
  stage: ValuationStage,
  basis: ValuationBasis,
): ValuationMethodResult {
  const sector = getSectorMultiples(assetClass, stage);
  if (!sector) {
    return {
      method: 'sector-multiples',
      nature: 'enterprise_value',
      label: 'Multiples sectoriels',
      applicable: false,
      notApplicableReason: `Pas de plage de multiples definie pour ${assetClass} au stade ${stage}.`,
    };
  }

  // Branche 3 de la regle de millesime. Le refus se prononce avant
  // toute lecture de serie, y compris avant le repli sur la traction
  // declaree du deck : un chiffre dont on ne sait pas dater l exercice
  // ne peut pas porter un multiple de marche. Le motif remonte tel
  // quel dans la note.
  if (basis.branch === 'refused') {
    return {
      method: 'sector-multiples',
      nature: 'enterprise_value',
      label: 'Multiples sectoriels',
      applicable: false,
      notApplicableReason: `${basis.declaration} ${basis.refusalReason ?? ''}`.trim(),
      inputs: {
        baseYear: null,
        baseBranch: basis.branch,
        multipleType: sector.range.multipleType,
        assetClass,
        stage,
      },
    };
  }

  const range = sector.range;
  const baseMetric = extractBaseMetric(input, range.multipleType, basis);
  if (baseMetric === null) {
    return {
      method: 'sector-multiples',
      nature: 'enterprise_value',
      label: 'Multiples sectoriels',
      applicable: false,
      notApplicableReason: `Aucun ${range.multipleType.toUpperCase()} exploitable au millesime ${basis.year} ni dans la traction declaree du pitch. La methode des multiples requiert une metrique de revenu mesurable a la base retenue, et ne se replie pas sur une annee voisine.`,
      inputs: {
        baseYear: basis.year,
        baseBranch: basis.branch,
        multipleType: range.multipleType,
        assetClass,
        stage,
      },
    };
  }

  // Ajustement qualite : un score equipe + marche eleve pousse vers
  // le max de la plage, un score faible vers le min. L ajustement
  // est borne pour eviter de sortir de la plage benchmark.
  const qualitySignal = computeQualitySignal(input);
  // qualitySignal in [0, 1]. 0.5 = neutre.
  const min = baseMetric * range.min;
  const central = baseMetric * range.central;
  const max = baseMetric * range.max;
  const adjustedCentral = central + (max - central) * (qualitySignal - 0.5) * 0.6;

  // Signal G2 : fraicheur du benchmark. Si la plage sectorielle a ete
  // calibree il y a plus de 12 mois, on ajoute une mention sobre au
  // rationale pour que la note d instruction garde tracable l ancrage
  // temporel du multiple. Le partner doit savoir qu il regarde une
  // photo de marche 2024 quand il instruit un dossier 2026.
  const freshnessMonths = computeBenchmarkFreshnessMonths(range.asOf);
  const freshnessNote = freshnessMonths !== null && freshnessMonths > 12
    ? ` Benchmark sectoriel calibre il y a ${freshnessMonths} mois (asOf ${range.asOf}), a recroiser.`
    : '';

  const baseRationale = `Multiple ${range.multipleType.toUpperCase()} ${range.min}x-${range.max}x applique sur ${formatEur(baseMetric)}, ${range.multipleType.toUpperCase()} du millesime ${basis.year}. ${basis.declaration}`;
  const rationale = range.notes
    ? `${baseRationale} ${range.notes}${freshnessNote}`
    : `${baseRationale}${freshnessNote}`;

  return {
    method: 'sector-multiples',
      nature: 'enterprise_value',
    label: 'Multiples sectoriels',
    applicable: true,
    range: {
      min: Math.round(min),
      central: Math.round(adjustedCentral),
      max: Math.round(max),
    },
    inputs: {
      baseMetric,
      // Le dashboard affichait un baseMetric nu, impossible a dater.
      // Les deux champs suivants rendent la fourchette auditable sans
      // aller relire le code : quel exercice porte le chiffre, et
      // quelle branche de la regle l a designe.
      baseYear: basis.year,
      baseBranch: basis.branch,
      multipleType: range.multipleType,
      multipleRange: `${range.min}x - ${range.max}x`,
      assetClass,
      stage,
      qualitySignal: Math.round(qualitySignal * 100) / 100,
    },
    rationale,
  };
}

/**
 * Lit une serie financiere au millesime exact retenu par la regle de
 * base, et retourne la valeur en EUR bruts.
 *
 * Les projections financialData.{revenue,ebitda,grossMargin,fcf}
 * Projection viennent du moteur financial-extraction-engine, qui
 * stocke les valeurs en MILLIONS d EUR. On reconvertit en EUR pour
 * que le moteur valuation puisse appliquer les multiples sectoriels
 * (qui s appliquent sur des montants en EUR bruts).
 *
 * Lecture stricte, sans repli sur une annee voisine. Une serie qui ne
 * porte pas le millesime retenu rend null, et la methode qui en depend
 * ressort non applicable. C est le cas reel du run 9201a046 ou revenue
 * compte huit entrees depuis 2019 quand ebitda en compte sept depuis
 * 2020 : un repli silencieux sur l annee la plus proche ferait lire
 * deux grandeurs a deux millesimes differents sous une meme base
 * declaree, ce qui est precisement ce que la declaration doit rendre
 * impossible.
 */
function pickProjectionValueAtYear(
  projection: Array<{ year: string; value: number; source: string }> | undefined,
  year: number | null,
  unitMultiplier = 1_000_000,
): number | null {
  if (!projection || projection.length === 0 || year === null) return null;
  for (const p of projection) {
    const y = parseInt(String(p.year), 10);
    const v = Number(p.value);
    if (y === year && !isNaN(v)) return v * unitMultiplier;
  }
  return null;
}

/**
 * Applique la regle de millesime aux entrees du dossier. Fonction
 * pure, aucune lecture d horloge, trois branches exclusives evaluees
 * dans l ordre doctrinal. Voir le bloc MILLESIME DE REFERENCE en tete
 * de fichier pour le raisonnement.
 */
function resolveValuationBasis(input: ValuationInput): ValuationBasis {
  const fd = input.financialData;

  // ---------- Branche 1 : mention explicite de realise
  // La primitive partagee porte deja tout le contrat : lastActualYear
  // renseigne, citation textuelle presente, appartenance aux annees des
  // projections, non-posteriorite. On ne re-implemente rien ici, et un
  // durcissement de la primitive se propage au moteur sans retouche.
  const explicit = deriveDossierReferenceYearWithReason({ financialData: fd });
  if (explicit.year !== null) {
    return {
      branch: 'explicit-actual',
      year: explicit.year,
      declaration: `Base ${explicit.year}, dernier exercice que le deck qualifie explicitement de realise avec citation a l appui.`,
      refusalReason: null,
    };
  }

  // ---------- Branche 2 : derniere annee anterieure a la date de deck
  const asOfYear = normalizeYear(input.asOf ?? null);
  const years = Array.isArray(fd?.revenueProjection)
    ? fd!.revenueProjection
        .map((p) => normalizeYear(p?.year))
        .filter((y): y is number => y !== null)
        .sort((a, b) => a - b)
    : [];

  if (asOfYear !== null) {
    const anterior = years.filter((y) => y < asOfYear);
    if (anterior.length > 0) {
      const year = anterior[anterior.length - 1];
      return {
        branch: 'as-of-anterior',
        year,
        declaration: `Base ${year}, derniere annee de la serie anterieure a la reception du dossier (${input.asOf}). Le deck ne qualifie aucun exercice de realise : ${explicit.rejectionDetail ?? 'aucune mention explicite extractible.'}`,
        refusalReason: null,
      };
    }
    return {
      branch: 'refused',
      year: null,
      declaration: `Base refusee : aucun exercice qualifie de realise, et aucune annee des projections n est anterieure a la reception du dossier (${input.asOf}).`,
      refusalReason: years.length > 0
        ? `Le dossier a ete recu en ${asOfYear} et sa serie de chiffre d affaires commence en ${years[0]}. Toutes les annees documentees sont donc projetees, aucune ne peut servir de base a un multiple de marche.`
        : `Le dossier ne documente aucune serie de chiffre d affaires exploitable.`,
    };
  }

  // ---------- Branche 3 : refus
  return {
    branch: 'refused',
    year: null,
    declaration: 'Base refusee : ni mention explicite de realise dans le deck, ni date de reception du dossier pour ancrer le millesime.',
    refusalReason: `${explicit.rejectionDetail ?? 'Aucune mention explicite de realise extractible du deck.'} Et la date de reception du dossier (asOf) n est pas renseignee, ce qui prive le moteur de son second ancrage. Les multiples ne sont pas appliques : une fourchette calculee sur une projection vaudrait moins que pas de fourchette du tout.`,
  };
}

/**
 * Extrait la base metric appropriee pour le multiple type donne. Lit
 * en priorite financialData (projections issues du BP), avec fallback
 * sur extraction.traction si le BP est absent.
 */
function extractBaseMetric(
  input: ValuationInput,
  multipleType: 'arr' | 'revenue' | 'gmv' | 'ebitda',
  basis: ValuationBasis,
): number | null {
  const ext: any = input.extraction;
  const fd = input.financialData;

  // ARR : on prend le revenue du millesime de reference comme proxy
  // d ARR pour les modeles SaaS, sauf si une mention explicite d ARR
  // est dans la traction extraite du deck.
  if (multipleType === 'arr') {
    const fromBp = pickProjectionValueAtYear(fd?.revenueProjection, basis.year);
    if (fromBp) return fromBp;
    const fromExt = ext?.traction?.revenue
      || ext?.traction?.metrics?.find?.((m: string) => /arr|recurring/i.test(m));
    return parseFinancialNumber(fromExt);
  }

  // REVENUE : serie du BP au millesime de reference en priorite, sinon
  // extraction. Le repli sur traction.revenue n est atteint que si la
  // base a ete tranchee : computeBySectorMultiples sort avant d appeler
  // cette fonction quand la branche est refused.
  if (multipleType === 'revenue') {
    const fromBp = pickProjectionValueAtYear(fd?.revenueProjection, basis.year);
    if (fromBp) return fromBp;
    const fromExt = ext?.traction?.revenue;
    return parseFinancialNumber(fromExt);
  }

  // GMV : marketplace. Cherche dans traction.metrics les strings GMV.
  // Le BP n a pas de champ dedie GMV, donc fallback sur extraction.
  if (multipleType === 'gmv') {
    const tractionMetrics: string[] = ext?.traction?.metrics || [];
    const gmvLine = tractionMetrics.find((m) => /gmv|volume.*affaires/i.test(m));
    return parseFinancialNumber(gmvLine);
  }

  // EBITDA : serie du BP au millesime de reference, sans repli
  if (multipleType === 'ebitda') {
    return pickProjectionValueAtYear(fd?.ebitdaProjection, basis.year);
  }

  return null;
}

/**
 * Parse permissif des metriques financieres : accepte string ou
 * number, normalise les formats euro / million / k. Retourne le
 * montant en euros, ou null si non parseable.
 */
function parseFinancialNumber(raw: any): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number' && raw > 0) return raw;
  if (typeof raw !== 'string') return null;

  const s = raw.toLowerCase().replace(/\s/g, '').replace(',', '.');
  // Capture des nombres avec suffixes K / M / Md
  const match = s.match(/(\d+(?:\.\d+)?)\s*(md|m|k|b)?/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (isNaN(value) || value <= 0) return null;

  const suffix = match[2];
  if (suffix === 'md' || suffix === 'b') return value * 1_000_000_000;
  if (suffix === 'm') return value * 1_000_000;
  if (suffix === 'k') return value * 1_000;
  // Heuristique : si < 1000, on suppose que c est en millions (interpretation conservatrice)
  if (value < 1000) return value * 1_000_000;
  return value;
}

/**
 * Calcule un signal qualite [0, 1] base sur les scores team et
 * market mecaniques. 0.5 = neutre, 1 = excellent (max benchmark),
 * 0 = faible (min benchmark).
 */
function computeQualitySignal(input: ValuationInput): number {
  const teamScore = input.teamScore ?? 50;
  const marketScore = input.marketScore ?? 50;
  // Moyenne ponderee : equipe compte plus que marche dans le pricing
  // de la valuation (les comparables sectoriels reflectent deja la
  // qualite de marche moyenne).
  const composite = (teamScore * 0.65 + marketScore * 0.35) / 100;
  return Math.max(0, Math.min(1, composite));
}

// ============================================================
// METHODE 2 : VC METHOD INVERSE
// ------------------------------------------------------------
// Logique : pour atteindre un IRR cible (par defaut 30%) sur un
// horizon (par defaut 6 ans), l exit doit valoir X. La valuation
// post-money plausible est donc exit / (1+IRR)^years. On en
// soustrait le ticket pour obtenir le pre-money.
//
// La valeur d exit est estimee a partir des comparables historiques
// du secteur (mediane des exits a ce stade).
// ============================================================

function computeByVcMethod(
  input: ValuationInput,
  assetClass: string,
  stage: ValuationStage,
): ValuationMethodResult {
  const targetIRR = 0.30; // 30% IRR cible classique VC
  const horizonYears = stage === 'seed' ? 7 : stage === 'series-a' ? 6 : stage === 'series-b' ? 5 : 4;

  // Exit values plausibles par stade et asset class (en EUR).
  // Calibre sur les exits observes 2020-2025. Le bear correspond au
  // 25e percentile des exits, base au 50e, bull au 75e.
  const exitScenarios = getExitScenarios(assetClass, stage);
  if (!exitScenarios) {
    return {
      method: 'vc-method',
      nature: 'pre_money',
      label: 'Methode VC inverse',
      applicable: false,
      notApplicableReason: `Pas de scenarios d exit calibres pour ${assetClass} au stade ${stage}.`,
    };
  }

  const ticket = parseTicketEur(input.extraction) || 0;
  const targetMultiple = Math.pow(1 + targetIRR, horizonYears);

  // Pour chaque scenario d exit, on calcule la post-money implicite
  // et on en deduit le pre-money en soustrayant le ticket.
  const postMin = exitScenarios.bear / targetMultiple;
  const postCentral = exitScenarios.base / targetMultiple;
  const postMax = exitScenarios.bull / targetMultiple;

  const preCentralRaw = postCentral - ticket;
  const preCentral = Math.max(0, preCentralRaw);

  // Detection : si le ticket excede trop largement la post-money cible,
  // la VC method calibree a IRR ${targetIRR*100}% sur ${horizonYears}
  // ans ne peut pas generer de pre-money plausible. Cas typique : late
  // stage avec gros ticket sur des exits modeles trop conservateurs.
  // Plutot que de pondre un central absurde et de polluer la
  // consolidation, on marque la methode non-applicable et on laisse
  // les multiples sectoriels prendre l ancrage.
  const isAbsurd = preCentral < 500_000
    || (ticket > 0 && preCentral < ticket * 0.30);
  if (isAbsurd) {
    return {
      method: 'vc-method',
      nature: 'pre_money',
      label: 'Methode VC inverse',
      applicable: false,
      notApplicableReason: `Le ticket propose (${formatEur(ticket)}) excede la post-money implicite (${formatEur(postCentral)}) necessaire pour atteindre IRR ${Math.round(targetIRR * 100)}% sur ${horizonYears} ans avec les exits calibres ${assetClass}. Soit le ticket est trop ambitieux, soit la these sous-jacente vise des exits superieurs aux medianes du segment.`,
    };
  }

  // Plancher structurel a 40% du central : si le bear scenario donne
  // une borne inferieure negative apres soustraction du ticket, on
  // retient un plancher prudent plutot que zero, qui n est pas
  // utilisable pour pricer.
  const preFloor = preCentral * 0.40;
  const preMin = Math.max(preFloor, postMin - ticket);
  const preMax = Math.max(preFloor, postMax - ticket);

  return {
    method: 'vc-method',
      nature: 'pre_money',
    label: 'Methode VC inverse',
    applicable: true,
    range: {
      min: Math.round(preMin),
      central: Math.round(preCentral),
      max: Math.round(preMax),
    },
    inputs: {
      targetIRR,
      horizonYears,
      exitScenarioBear: exitScenarios.bear,
      exitScenarioBase: exitScenarios.base,
      exitScenarioBull: exitScenarios.bull,
      targetMultiple: Math.round(targetMultiple * 10) / 10,
      ticket,
    },
    rationale: `IRR cible ${Math.round(targetIRR * 100)}% sur ${horizonYears} ans (multiple ${Math.round(targetMultiple * 10) / 10}x). Exits cibles : bear ${formatEur(exitScenarios.bear)}, base ${formatEur(exitScenarios.base)}, bull ${formatEur(exitScenarios.bull)}, calibres sur les exits observes 2020-2025 dans ${assetClass}.`,
  };
}

/**
 * Scenarios d exit par stade et asset-class. Calibre sur les exits
 * observes 2020-2025 (M&A + IPO). En euros.
 *
 * IMPORTANT : ces scenarios sont par definition incertains. Ils
 * servent d ancrage methodologique, pas de prediction.
 */
function getExitScenarios(assetClass: string, stage: ValuationStage): { bear: number; base: number; bull: number } | null {
  // Exits typiques par asset class (medianes observees).
  // Source : Crunchbase exits 2020-2025, Atomico exits Europe.
  const baseExits: Record<string, number> = {
    'saas-b2b': 80_000_000,
    'fintech': 100_000_000,
    'marketplace-b2c': 150_000_000,
    'ecommerce-dtc': 60_000_000,
    'deeptech': 120_000_000,
    'cybersecurity': 200_000_000,
    'healthtech': 90_000_000,
    'climate-tech': 100_000_000,
    'defense': 250_000_000,
    'hospitality': 70_000_000,
    'ai-generative': 250_000_000,
    // Asset-classes ajoutees
    'adtech': 80_000_000,
    'foodtech': 70_000_000,
    'proptech': 80_000_000,
    'edtech': 60_000_000,
    'logistics': 90_000_000,
    'services-b2b': 50_000_000,
    'industrial-hardware': 70_000_000,
    'profitable-mature': 120_000_000,
    'mediatech': 80_000_000,
    'sportstech': 60_000_000,
  };
  const base = baseExits[assetClass];
  if (!base) return null;

  // Multiplicateurs par stade : plus on est tot, plus l ecart entre
  // bear et bull est grand (variance cumulee).
  const stageVariance: Record<ValuationStage, { bear: number; bull: number }> = {
    'seed': { bear: 0.2, bull: 5 },
    'series-a': { bear: 0.3, bull: 4 },
    'series-b': { bear: 0.4, bull: 3 },
    'series-c-plus': { bear: 0.5, bull: 2.5 },
  };
  const variance = stageVariance[stage];

  return {
    bear: Math.round(base * variance.bear),
    base,
    bull: Math.round(base * variance.bull),
  };
}

// ============================================================
// METHODE 3 : BERKUS (seed only, pre-revenue)
// ------------------------------------------------------------
// La methode Berkus plafonne la valuation pre-money a une somme de
// 5 facteurs qualitatifs valant chacun 0-500k$ historiquement.
// Adaptee a 2026 et au marche europeen : 0-700k EUR par facteur,
// total maximum 3.5M EUR.
//
// Les 5 facteurs sont mappes sur les outputs Bloc 1 :
//   1. Sound idea (basic value) : depend du score Vigilance critique inversé
//   2. Prototype / produit : depend du score Marche (defensibilite)
//   3. Quality team : depend du score Equipe
//   4. Strategic relationships : depend du score Macro / Contrariens
//   5. Product rollout / sales : depend de la presence d ARR / revenue
// ============================================================

function computeByBerkus(input: ValuationInput, basis: ValuationBasis): ValuationMethodResult {
  const teamScore = input.teamScore ?? 50;
  const marketScore = input.marketScore ?? 50;

  // Chaque facteur vaut 0-700k EUR selon la qualite mesuree (0-100)
  const FACTOR_MAX = 700_000;
  const factor1 = (teamScore / 100) * FACTOR_MAX * 0.6 + (marketScore / 100) * FACTOR_MAX * 0.4;
  const factor2 = (marketScore / 100) * FACTOR_MAX;
  const factor3 = (teamScore / 100) * FACTOR_MAX;
  const factor4 = ((teamScore + marketScore) / 200) * FACTOR_MAX;
  const ext: any = input.extraction;
  // Facteur 5 de Berkus, product rollout et ventes. Il mesure un
  // deploiement commercial constate, pas une ambition : le lire au
  // millesime de reference lui rend ce qu il pretend mesurer. Un seed
  // sans chiffre realise tombe a 0,2 du plafond, ce qui est le
  // comportement attendu de la methode sur un dossier pre-revenue.
  const revenueAtBasis = pickProjectionValueAtYear(input.financialData?.revenueProjection, basis.year);
  const hasRevenue = (revenueAtBasis != null && revenueAtBasis > 0)
    || !!parseFinancialNumber(ext?.traction?.revenue);
  const factor5 = hasRevenue ? FACTOR_MAX * 0.7 : FACTOR_MAX * 0.2;

  const central = factor1 + factor2 + factor3 + factor4 + factor5;
  const min = central * 0.6;
  const max = central * 1.4;

  return {
    method: 'berkus',
    nature: 'pre_money',
    label: 'Methode Berkus',
    applicable: true,
    range: {
      min: Math.round(min),
      central: Math.round(central),
      max: Math.round(max),
    },
    inputs: {
      facteurIdee: Math.round(factor1),
      facteurPrototype: Math.round(factor2),
      facteurEquipe: Math.round(factor3),
      facteurRelationsStrategiques: Math.round(factor4),
      facteurProductRollout: Math.round(factor5),
    },
    rationale: 'Methode Berkus adaptee a 2026 europeen : plafond 3,5M EUR pre-money. Chaque facteur (idee, prototype, equipe, relations, rollout) note de 0 a 700k EUR selon les scores Bloc 1. Adapte aux dossiers seed pre-revenue ou faiblement revenue.',
  };
}

function nonApplicableBerkus(): ValuationMethodResult {
  return {
    method: 'berkus',
    nature: 'pre_money',
    label: 'Methode Berkus',
    applicable: false,
    notApplicableReason: 'La methode Berkus s applique uniquement au stade seed pre-revenue.',
  };
}

// ============================================================
// METHODE 4 : SCORECARD (Bill Payne, seed)
// ------------------------------------------------------------
// Compare a la mediane regionale des seed deals et applique des
// facteurs de qualite ponderes :
//   - Equipe : 30%
//   - Taille opportunite : 25%
//   - Produit / techno : 15%
//   - Concurrence : 10%
//   - Marketing / ventes : 10%
//   - Need for additional investment : 5%
//   - Other : 5%
// Mediane Europe seed 2024 : ~3.5M EUR pre-money.
// ============================================================

function computeByScorecard(input: ValuationInput): ValuationMethodResult {
  const REGIONAL_MEDIAN_SEED = 3_500_000; // EUR, Europe 2024
  const teamScore = input.teamScore ?? 50;
  const marketScore = input.marketScore ?? 50;

  // Conversion score (0-100) en facteur Scorecard (0.5x - 2.0x)
  const toFactor = (s: number) => 0.5 + (s / 100) * 1.5;
  const fEquipe = toFactor(teamScore);
  const fOpportunite = toFactor(marketScore);
  const fProduit = toFactor((teamScore + marketScore) / 2);
  const fConcurrence = toFactor(marketScore);
  const fMarketing = toFactor(teamScore * 0.7 + marketScore * 0.3);
  const fNeedAddInvest = 1.0; // neutre par defaut
  const fOther = 1.0;

  const compositeFactor =
    fEquipe * 0.30
    + fOpportunite * 0.25
    + fProduit * 0.15
    + fConcurrence * 0.10
    + fMarketing * 0.10
    + fNeedAddInvest * 0.05
    + fOther * 0.05;

  const central = REGIONAL_MEDIAN_SEED * compositeFactor;
  const min = central * 0.7;
  const max = central * 1.3;

  return {
    method: 'scorecard',
    nature: 'pre_money',
    label: 'Methode Scorecard (Bill Payne)',
    applicable: true,
    range: {
      min: Math.round(min),
      central: Math.round(central),
      max: Math.round(max),
    },
    inputs: {
      medianeSeedEurope: REGIONAL_MEDIAN_SEED,
      facteurEquipe: Math.round(fEquipe * 100) / 100,
      facteurOpportunite: Math.round(fOpportunite * 100) / 100,
      facteurProduit: Math.round(fProduit * 100) / 100,
      facteurConcurrence: Math.round(fConcurrence * 100) / 100,
      facteurMarketing: Math.round(fMarketing * 100) / 100,
      compositeFactor: Math.round(compositeFactor * 100) / 100,
    },
    rationale: `Mediane seed europeenne 2024 (${formatEur(REGIONAL_MEDIAN_SEED)}) ajustee par facteurs Scorecard : equipe ${Math.round(fEquipe * 100) / 100}x, opportunite ${Math.round(fOpportunite * 100) / 100}x, produit ${Math.round(fProduit * 100) / 100}x. Coefficient composite ${Math.round(compositeFactor * 100) / 100}x.`,
  };
}

function nonApplicableScorecard(): ValuationMethodResult {
  return {
    method: 'scorecard',
    nature: 'pre_money',
    label: 'Methode Scorecard (Bill Payne)',
    applicable: false,
    notApplicableReason: 'La methode Scorecard s applique uniquement au stade seed.',
  };
}

/**
 * Construit un output valorisation explicitement non applicable quand
 * le couple (asset class, stade) ne fournit pas l ancrage benchmark
 * necessaire. Toutes les methodes ressortent applicable=false avec un
 * rationale specifique, recommendedRange=null, confidence='low'. Le
 * partner voit dans la note 'fourchette non calculable, classification
 * a confirmer' plutot qu une fourchette decalee inspiree de seuils
 * saas-b2b par defaut.
 */
function buildNonApplicableValuation(
  assetClass: string,
  stage: ValuationStage | 'unknown',
  basis: ValuationBasis,
): ValuationOutput {
  const stageMsg = stage === 'unknown'
    ? 'Stade non identifie (libelle pitch atypique : bridge, tour intermediaire, pre-B, extension de seed, etc.).'
    : `Stade ${stage}.`;
  const assetMsg = assetClass === 'unclassified'
    ? 'Asset class non reconnue par la matrice (sector libelle non couvert ou productionChain indeterminee).'
    : `Asset class ${assetClass}.`;
  const reason = `${assetMsg} ${stageMsg} Methodes de valorisation neutralisees pour eviter une fourchette cale sur des benchmarks saas-b2b par defaut.`;
  const methods: ValuationMethodResult[] = [
    { method: 'sector-multiples', nature: 'enterprise_value', label: 'Multiples sectoriels', applicable: false, notApplicableReason: reason },
    { method: 'vc-method', nature: 'pre_money', label: 'Methode VC inverse', applicable: false, notApplicableReason: reason },
    { method: 'berkus', nature: 'pre_money', label: 'Methode Berkus', applicable: false, notApplicableReason: reason },
    { method: 'scorecard', nature: 'pre_money', label: 'Methode Scorecard (Bill Payne)', applicable: false, notApplicableReason: reason },
  ];
  const warnings: string[] = [];
  if (assetClass === 'unclassified' && stage === 'unknown') {
    warnings.push('Asset class non reconnue ET stade non identifie. Valorisation non calculable : le partner doit clarifier le secteur dominant et le palier de levee avant que le moteur puisse ancrer une fourchette.');
  } else if (stage === 'unknown') {
    warnings.push(`Stade non identifie (libelle pitch atypique). Valorisation non calculable plutot que calee sur les benchmarks seed par defaut. A confirmer avec le partner : tour de seed, series-a, series-b ou growth ?`);
  } else if (assetClass === 'unclassified') {
    warnings.push(`Asset class non reconnue. Valorisation non calculable plutot que calee sur des multiples saas-b2b decales. Voir matrix.productionChain pour le routage doctrinal : un dossier hardware-physical n est pas valorise comme un SaaS B2B.`);
  }
  return {
    recommendedRange: null,
    confidence: 'low',
    methods,
    dilutionAnalysis: null,
    assetClass,
    stage,
    basis,
    synthesis: 'Valorisation non calculable : la matrice n a pas trouve d ancrage sectoriel ou de stade reconnu pour ce dossier. Plutot qu une fourchette decalee, le moteur affiche explicitement l incertitude. Le partner doit clarifier (secteur dominant, palier de levee) avant de reactiver les methodes.',
    warnings,
    benchmarkSources: [],
  };
}

// ============================================================
// CONSOLIDATION ET HELPERS
// ============================================================

/**
 * Consolide les ranges des methodes applicables en une fourchette
 * unique exploitable pour pricer. Trois principes :
 *
 * 1. Ponderation par stade ET disponibilite du revenue. Au seed pre-
 *    revenue, on exclut VC inverse (sans projection de revenue ancree
 *    dans un BP, elle pond des bornes a 40M+ sans aucune assise
 *    empirique sur un dossier sans traction). Au Series A+ avec
 *    revenue, multiples sectoriels et VC inverse dominent ; Berkus et
 *    Scorecard ne sont plus pertinents (calibres pour le seed).
 *
 * 2. Bornes consolidees sur la dispersion entre centraux des methodes,
 *    pas sur l enveloppe des bornes propres de chaque methode. L
 *    incertitude reelle est l ecart entre les ancres respectives, par
 *    exemple Berkus dit 1,4M et Scorecard dit 4M donc l incertitude
 *    est entre 1,4 et 4, et pas entre la borne basse de Berkus (0,8) et
 *    la borne haute de Scorecard (5,2). Cette logique evite que
 *    chaque methode tire la fourchette consolidee a son extreme.
 *
 * 3. Garde-fous : plage minimale de +/- 20% autour du central pour
 *    signaler l incertitude qualitative incompressible (signaux non
 *    chiffrables : founder-market fit, momentum, contexte du tour).
 *    Plafond a central x [0.55, 1.80] pour interdire les fourchettes
 *    inutilisables pour pricer.
 */
function consolidateRanges(
  methods: ValuationMethodResult[],
  stage: ValuationStage,
): { min: number; central: number; max: number } | null {
  const valid = methods.filter((m) => m.applicable && m.range);
  if (valid.length === 0) return null;

  // Disponibilite du revenue : on detecte via l applicabilite de
  // sector-multiples qui requiert un ARR ou revenue exploitable.
  const hasRevenue = valid.some((m) => m.method === 'sector-multiples');

  const weights: Record<string, number> = (() => {
    if (stage === 'seed') {
      // Seed pre-revenue : Scorecard et Berkus, VC inverse exclu.
      // Seed avec revenue : multiples sectoriels prennent l ancrage
      // empirique, Berkus et Scorecard restent en complement.
      if (hasRevenue) {
        return {
          'sector-multiples': 0.50,
          'scorecard': 0.30,
          'berkus': 0.20,
          'vc-method': 0,
        };
      }
      return {
        'scorecard': 0.60,
        'berkus': 0.40,
        'sector-multiples': 0,
        'vc-method': 0,
      };
    }
    // Series A et au-dela : multiples sectoriels dominent, VC inverse
    // complemente, Berkus et Scorecard sortent du jeu.
    if (stage === 'series-a') {
      return {
        'sector-multiples': 0.65,
        'vc-method': 0.35,
        'berkus': 0,
        'scorecard': 0,
      };
    }
    // Series B+
    return {
      'sector-multiples': 0.75,
      'vc-method': 0.25,
      'berkus': 0,
      'scorecard': 0,
    };
  })();

  const eligible = valid.filter((m) => (weights[m.method] || 0) > 0);
  if (eligible.length === 0) return null;

  let totalWeight = 0;
  let weightedCentral = 0;
  const centrals: number[] = [];

  for (const m of eligible) {
    const w = weights[m.method] || 0;
    totalWeight += w;
    weightedCentral += m.range!.central * w;
    centrals.push(m.range!.central);
  }

  const central = weightedCentral / totalWeight;

  // Garde-fous d incertitude. ENVELOPPE_MAX : les bornes ne sortent
  // jamais de central x [0.55, 1.80] meme si les methodes divergent
  // beaucoup. ENVELOPPE_MIN : les bornes garantissent au minimum +/-
  // 20% autour du central, meme si les methodes convergent tres etroit.
  const ENVELOPPE_MAX_DOWN = 0.55;
  const ENVELOPPE_MAX_UP = 1.80;
  const ENVELOPPE_MIN_DOWN = 0.80;
  const ENVELOPPE_MIN_UP = 1.20;

  let min: number, max: number;
  if (eligible.length === 1) {
    // Methode unique : on resserre ses bornes propres dans le plafond
    // de plausibilite, sinon une seule methode au range tres large
    // (typiquement VC inverse seul) sortirait une fourchette inutile.
    const m = eligible[0];
    min = Math.max(m.range!.min, central * ENVELOPPE_MAX_DOWN);
    max = Math.min(m.range!.max, central * ENVELOPPE_MAX_UP);
  } else {
    // Plusieurs methodes : la dispersion entre leurs centraux est l
    // ancrage de l incertitude.
    const minCentral = Math.min(...centrals);
    const maxCentral = Math.max(...centrals);
    min = Math.max(minCentral, central * ENVELOPPE_MAX_DOWN);
    max = Math.min(maxCentral, central * ENVELOPPE_MAX_UP);
  }

  // Plage minimale d incertitude : on garantit toujours +/- 20% autour
  // du central, sauf si les bornes plafond sont deja plus serrees.
  if (min > central * ENVELOPPE_MIN_DOWN) min = central * ENVELOPPE_MIN_DOWN;
  if (max < central * ENVELOPPE_MIN_UP) max = central * ENVELOPPE_MIN_UP;

  return {
    min: Math.round(min),
    central: Math.round(central),
    max: Math.round(max),
  };
}

function determineConfidence(
  methods: ValuationMethodResult[],
  assetClass: string,
  stage: ValuationStage,
): 'high' | 'medium' | 'low' {
  const applicableCount = methods.filter((m) => m.applicable).length;
  const sector = getSectorMultiples(assetClass, stage);
  const sectorConfidence = sector?.range.confidence;

  if (applicableCount >= 2 && sectorConfidence === 'high') return 'high';
  if (applicableCount >= 1 && sectorConfidence !== 'low') return 'medium';
  return 'low';
}

function parseTicketEur(extraction: ExtractionOutput | null | undefined): number | null {
  if (!extraction) return null;
  const ext: any = extraction;
  // Le ticket est range dans extraction.fundraise.amount sous forme
  // de string ('3M EUR', '5M$', '500k EUR'...). On parse de maniere
  // permissive.
  const candidates = [
    ext.fundraise?.amount,
    ext.roundAmount,
    ext.roundAmountEur,
  ];
  for (const c of candidates) {
    const v = parseFinancialNumber(c);
    if (v && v > 0) return v;
  }
  return null;
}

function buildDilutionAnalysis(
  range: { min: number; central: number; max: number },
  ticket: number,
): {
  proposedTicket: number;
  dilutionAtMin: number;
  dilutionAtCentral: number;
  dilutionAtMax: number;
  rationale: string;
} {
  // Dilution = ticket / (pre + ticket)
  const dMin = (ticket / (range.min + ticket)) * 100;
  const dCentral = (ticket / (range.central + ticket)) * 100;
  const dMax = (ticket / (range.max + ticket)) * 100;

  return {
    proposedTicket: ticket,
    dilutionAtMin: Math.round(dMin * 10) / 10,
    dilutionAtCentral: Math.round(dCentral * 10) / 10,
    dilutionAtMax: Math.round(dMax * 10) / 10,
    rationale: `Sur le ticket annonce ${formatEur(ticket)}, la dilution oscille entre ${Math.round(dMax * 10) / 10}% (valo haute ${formatEur(range.max)}) et ${Math.round(dMin * 10) / 10}% (valo basse ${formatEur(range.min)}). Point central : ${Math.round(dCentral * 10) / 10}% sur ${formatEur(range.central)} pre-money.`,
  };
}

function buildSynthesis(args: {
  recommendedRange: { min: number; central: number; max: number } | null;
  confidence: string;
  assetClass: string;
  stage: ValuationStage;
  applicableMethods: ValuationMethodResult[];
  dilutionAnalysis: any;
}): string {
  if (!args.recommendedRange) {
    return 'La fourchette de valorisation ne peut pas etre etablie : aucune des methodes (multiples, VC inverse, Berkus, Scorecard) ne dispose des inputs necessaires. Demander a la startup le BP, l ARR ou le revenue declare avant de relancer le calcul.';
  }
  const { min, central, max } = args.recommendedRange;
  const sourcesLabel = args.applicableMethods.map((m) => m.label).join(', ');
  const confidenceLabel = args.confidence === 'high' ? 'eleve'
    : args.confidence === 'medium' ? 'modere'
    : 'faible';

  let synth = `La fourchette pre-money plausible se situe entre ${formatEur(min)} et ${formatEur(max)}, avec un point central de ${formatEur(central)}. Niveau de fiabilite ${confidenceLabel}, base sur ${args.applicableMethods.length} methode${args.applicableMethods.length > 1 ? 's' : ''} applicable${args.applicableMethods.length > 1 ? 's' : ''} (${sourcesLabel}).`;

  if (args.dilutionAnalysis) {
    synth += ` Sur le ticket propose, la dilution s etablit entre ${args.dilutionAnalysis.dilutionAtMax}% (valo haute) et ${args.dilutionAnalysis.dilutionAtMin}% (valo basse).`;
  }

  return synth;
}

function collectWarnings(
  applicableMethods: ValuationMethodResult[],
  range: any,
  basis: ValuationBasis,
): string[] {
  const warnings: string[] = [];

  // La base retenue est un avertissement de plein droit, pas une note
  // de bas de page. Un partner qui lit une fourchette doit savoir sur
  // quel exercice elle repose avant de lire le chiffre, et par quelle
  // branche de la regle cet exercice a ete designe. La branche as-of
  // signale en outre que le deck n a rien qualifie de realise, ce qui
  // est en soi un signal d instruction.
  //
  // Les deux causes de non-application des multiples partagent
  // volontairement la meme phrase d ouverture. Le fait annonce au
  // lecteur est le meme, les multiples n ont pas ete appliques ; seul
  // le motif apres le deux-points differe, base temporelle refusee
  // d un cote, metrique de revenu absente de l autre. Deux ouvertures
  // distinctes pour un fait unique obligeraient chaque consommateur en
  // aval a connaitre les deux formulations.
  if (basis.branch === 'refused') {
    warnings.push(`Les multiples sectoriels n ont pas pu être appliqués : ${basis.refusalReason ?? basis.declaration}`);
  } else if (basis.branch === 'as-of-anterior') {
    warnings.push(`${basis.declaration} Le deck ne qualifie explicitement aucun exercice de realise : la base a ete ancree sur la date de reception du dossier, pas sur une declaration du fondateur. A recouper avec les liasses.`);
  }

  if (!range) {
    warnings.push('Fourchette non calculée : inputs insuffisants. Le partner doit collecter le BP / l ARR avant de procéder à la négociation.');
    return warnings;
  }

  if (applicableMethods.length === 1) {
    warnings.push('Une seule méthode applicable. La fourchette est moins robuste qu une consolidation à 2-3 méthodes. Considérer comme indicative.');
  }

  if (range.max / range.min > 4) {
    warnings.push(`La fourchette est très large (rapport max/min ${Math.round(range.max / range.min * 10) / 10}). Le pricing dépend fortement de signaux qualitatifs non chiffrables.`);
  }

  // Le warning ne se prononce que sur ce qui a reellement ete calcule.
  // Il se lisait auparavant sur la presence d un fichier BP
  // (financialData.hasBP), critere etranger a celui qui gouverne
  // l application des multiples : extractBaseMetric ne regarde que le
  // contenu de revenueProjection et de la traction extraite. Un dossier
  // sans BP mais avec une projection exploitable imprimait donc
  // "les multiples n ont pas pu etre appliques" sous une fourchette de
  // multiples effective. On aligne le predicat sur le resultat.
  const applied = new Set(applicableMethods.map((m) => m.method));
  const quantitativeApplied = applied.has('sector-multiples') || applied.has('vc-method');
  const qualitativeLabels = applicableMethods
    .filter((m) => m.method === 'berkus' || m.method === 'scorecard')
    .map((m) => m.label);

  // Le motif de non-application des multiples est desormais a deux
  // causes distinctes qu il serait faux de confondre : soit la base
  // temporelle a ete refusee, et le warning correspondant a deja ete
  // pousse en tete, soit la base existe mais aucune metrique de revenu
  // ne la porte.
  if (!applied.has('sector-multiples') && basis.branch !== 'refused') {
    warnings.push(`Les multiples sectoriels n ont pas pu être appliqués : aucune métrique de revenu exploitable (ARR, revenue, GMV ou EBITDA) au millésime ${basis.year} dans le BP, ni dans la traction déclarée du pitch.`);
  }

  // "Uniquement qualitatif" n est vrai que si aucune methode
  // quantitative n a abouti. La VC inverse est quantitative : quand
  // elle produit une fourchette, la phrase est fausse. Et les methodes
  // citees sont celles qui ont reellement contribue, pas la liste par
  // defaut : au-dela du seed, Berkus et Scorecard sont non applicables
  // et ne portent rien.
  if (!quantitativeApplied) {
    const support = qualitativeLabels.length > 0
      ? ` La fourchette repose uniquement sur ${qualitativeLabels.join(' et ')}, qui valorisent l équipe et l opportunité avant toute traction chiffrée.`
      : '';
    warnings.push(`Aucune méthode quantitative n a abouti : ni les multiples sectoriels, ni la VC inverse ne disposent des inputs nécessaires.${support}`);
  }

  return warnings;
}

function getBenchmarkSources(assetClass: string): string[] {
  const sources: Record<string, string[]> = {
    'saas-b2b': ['Bessemer Cloud Index 2024', 'OpenView SaaS Benchmarks 2024', 'Atomico State of European Tech 2024-2025'],
    'fintech': ['Carta State of Private Markets Q4 2024', 'FT Partners 2024', 'Atomico 2025'],
    'marketplace-b2c': ['Atomico 2025', 'Crunchbase 2024'],
    'ecommerce-dtc': ['Carta 2024', 'Atomico 2024'],
    'deeptech': ['Atomico Deeptech 2024', 'KfW Capital 2024'],
    'cybersecurity': ['Momentum Cyber 2024', 'Atomico 2024'],
    'healthtech': ['Rock Health 2024', 'Atomico Healthtech 2024'],
    'climate-tech': ['Sightline Climate 2024', 'Atomico Climate 2024'],
    'defense': ['SVB Defense Tech 2024', 'NATO Innovation Fund'],
    'hospitality': ['Skift 2024', 'Atomico Travel 2024'],
    'ai-generative': ['CB Insights 2024', 'Crunchbase AI 2024'],
    // Asset-classes ajoutees
    'adtech': ['LUMA Partners 2024', 'eMarketer 2024'],
    'foodtech': ['AgFunder 2024', 'Atomico Foodtech 2024'],
    'proptech': ['RECNet 2024', 'Atomico 2024'],
    'edtech': ['HolonIQ Edtech 2024', 'Atomico 2024'],
    'logistics': ['Pitchbook Logistics 2024', 'Atomico 2024'],
    'services-b2b': ['SaaS Capital 2024', 'Equiteq 2024'],
    'industrial-hardware': ['KfW Capital 2024', 'BPI France 2024'],
    'profitable-mature': ['Argos Index Q4 2024', 'S&P Global SME 2024'],
    'mediatech': ['Atomico Content 2024', 'Drake Star Gaming 2024'],
    'sportstech': ['Drake Star Sportstech 2024'],
  };
  return sources[assetClass] || ['Sources sectorielles publiques 2024-2025'];
}

function formatEur(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace('.', ',')}Md€`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')}M€`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k€`;
  return `${value}€`;
}
