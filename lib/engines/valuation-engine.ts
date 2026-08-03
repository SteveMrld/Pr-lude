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
  explainMissingMultiples,
  getSectorMultiples,
  normalizeAssetClass,
  normalizeStage,
  type ValuationStage,
  type SectorMultipleRange,
} from '@/lib/data/sector-benchmarks';
import { computeBenchmarkFreshnessMonths } from '@/lib/data/indicator-benchmarks';
import type { ExtractionOutput, FinancialCoherenceOutput, FinancialDataExtraction, TeamAnalysisOutput, MarketAnalysisOutput } from '@/lib/engines/types';
import type { AssetClassArbitration, RelevanceMatrix } from '@/lib/engines/relevance-matrix';
import type { OperationType } from '@/lib/engines/types';
import {
  deriveDossierReferenceYearWithReason,
  normalizeYear,
} from '@/lib/analysis/reference-year';
import type { NonProductionCause, NonProductionCauseOrNull } from '@/lib/engines/non-production';

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

/**
 * Seuil de peremption entre l ancre temporelle du dossier et le
 * millesime retenu, en annees.
 *
 * Un ecart de un an est le cas nominal : un deck recu en 2026 dont le
 * dernier exercice clos est 2025. Deux ans reste courant sur un dossier
 * instruit tard ou dont la cloture n est pas encore auditee. Au-dela de
 * trois, le document ne decrit plus l entreprise qu on instruit.
 *
 * La doctrine ne refuse pas pour autant : un dossier ancien n est pas
 * invalide, il est ancien. La base est retenue, l ecart est declare, et
 * la mention de peremption remonte jusqu a la note. Refuser priverait
 * le partner d un ancrage qu il sait relativiser lui-meme ; taire
 * l ecart le laisserait lire un multiple de marche recent applique a un
 * chiffre d affaires qui ne l est pas.
 */
export const BASIS_STALENESS_THRESHOLD_YEARS = 3;

export interface ValuationBasis {
  /** Branche de la regle qui a tranche. */
  branch: ValuationBasisBranch;
  /** Millesime retenu pour lire les series financieres, null si refus. */
  year: number | null;
  /**
   * Ecart en annees entre l ancre temporelle du dossier et le
   * millesime retenu. Toujours renseigne quand une ancre existe, y
   * compris sous le seuil : un chiffre dont on ne peut pas lire l age
   * n est pas auditable. Null quand aucune ancre n est disponible,
   * c est-a-dire sur la branche 1 sans asOf et sur le refus.
   */
  anchorGapYears: number | null;
  /** Annee de l ancre ayant servi a mesurer l ecart, null si aucune. */
  anchorYear: number | null;
  /** True quand l ecart depasse le seuil doctrinal de peremption. */
  stale: boolean;
  /**
   * True quand un millesime a ete retenu mais que son anciennete n a
   * pas pu etre mesuree, faute d ancre temporelle exploitable.
   *
   * Ce n est pas une peremption, et confondre les deux serait une
   * faute : une peremption affirme que le chiffre est vieux, celle-ci
   * dit qu on ne sait pas s il l est. Un dossier depose sans date de
   * reception dont le deck qualifie 2017 de realise tranche par la
   * branche 1, produit une fourchette, et rien ne signalait que
   * personne n avait regarde l age de ce 2017.
   */
  ageUnknown: boolean;
  /** Phrase editoriale prete pour la note et le dashboard. */
  declaration: string;
  /** Mention de peremption, null quand l ecart reste sous le seuil. */
  stalenessNote: string | null;
  /** Mention d anciennete non evaluee, null quand l age est mesurable
   *  ou quand aucune base n a ete retenue. */
  ageUnknownNote: string | null;
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
  /** Si non applicable, pourquoi, en prose. Explique, ne tranche pas. */
  notApplicableReason?: string;
  /**
   * Cause structuree de la non-production. Obligatoire et non
   * optionnelle : le type force chaque site a se prononcer, y compris
   * quand la methode aboutit, auquel cas la valeur est null. Les
   * consommateurs lisent ce champ et jamais notApplicableReason.
   */
  notApplicableCause: NonProductionCauseOrNull;
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
/**
 * Fourchette consolidee pour une nature de valeur donnee. Les methodes
 * qui la composent partagent toutes cette nature : rien n est melange
 * ici, et les poids sont renormalises sur les seules methodes
 * retenues, de sorte qu une fourchette a une seule methode ne soit pas
 * amputee du poids des methodes de l autre nature.
 */
/**
 * Ce qui separe les bornes brutes des methodes des bornes affichees.
 * Deux regles s appliquaient sans etre dites, sur le chiffre le plus
 * visible du produit : un lecteur qui multipliait la base par le
 * multiple bas ne retrouvait pas le plancher affiche.
 */
export interface RangeDerivation {
  /** Bornes telles que les methodes les produisent, avant enveloppe. */
  brut: { min: number; max: number };
  /** Facteurs de l enveloppe de plausibilite appliquee au central. */
  enveloppe: { planchier: number; plafond: number; minimum: number; maximumResserre: number };
  /** True si l enveloppe a effectivement deplace une borne. */
  enveloppeAppliquee: boolean;
  /** Phrase destinee au lecteur, refaisable a la main. */
  explication: string;
}

export interface ConsolidatedRange {
  nature: ValuationNature;
  min: number;
  central: number;
  max: number;
  /** Methodes retenues et poids effectifs, sommant a 1. */
  /** Null quand les bornes affichees sont celles des methodes. */
  derivation?: RangeDerivation | null;
  contributions: Array<{ method: string; label: string; weight: number }>;
}

export interface ValuationOutput {
  /**
   * Fourchettes consolidees, une par nature disponible, au plus deux.
   * C est la sortie de reference : un dossier peut porter une valeur
   * d entreprise issue des multiples et une valeur des capitaux
   * propres avant tour issue de la VC inverse, et les deux sont
   * vraies sans etre comparables.
   */
  ranges: ConsolidatedRange[];
  /**
   * Fourchette unique, renseignee seulement quand une seule nature est
   * disponible. Null des que deux natures coexistent, parce qu il n y
   * a alors pas de chiffre unique a recommander : l ecart entre les
   * deux est la dette nette, que le pipeline n extrait pas.
   *
   * Le champ portait auparavant une moyenne ponderee des deux natures,
   * documentee comme pre-money. Sur un dossier series-a, c etait 65
   * pour cent de valeur d entreprise et 35 pour cent de pre-money
   * additionnes sous une etiquette qui n en decrivait qu une.
   */
  recommendedRange: {
    min: number;
    central: number;
    max: number;
  } | null;
  /** Niveau de fiabilite global de la fourchette. */
  confidence: 'high' | 'medium' | 'low';
  /** Resultat detaille de chacune des methodes. */
  methods: ValuationMethodResult[];
  /** Motif ecrit quand la dilution ne peut pas etre calculee faute de
   *  repartition capital / autre instrument dans le tour annonce.
   *  Null quand la dilution est calculee ou quand aucun ticket n est
   *  annonce. Porte separement de dilutionAnalysis pour qu une absence
   *  de dilution motivee ne se confonde pas avec un dossier sans
   *  ticket. */
  dilutionNotComputableReason: string | null;
  /** Cause structuree du non-calcul de la dilution. Null quand elle est
   *  calculee ou quand aucun ticket n est annonce. */
  dilutionNotComputableCause: NonProductionCauseOrNull;
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
  /**
   * Provenance de l ancre temporelle. Une date de reception saisie par
   * le partner et une date d ingestion de corpus sont deux choses
   * differentes, et seule la premiere designe le moment ou le dossier
   * a ete recu.
   *
   * Les vingt-six lignes du corpus portent toutes le meme as_of,
   * 2026-06-08, qui est le jour de l ingestion : le script passe une
   * constante a tous les dossiers de la campagne. Ancrer la branche 2
   * dessus attribue a un memorandum de 2017 une reception en juin 2026
   * et produit mecaniquement neuf ans d ecart.
   *
   * La branche 2 n ancre que sur 'deck-receipt'. Une provenance
   * d ingestion, ou une provenance non etablie, conduit au refus
   * motive : le comportement devient explicite au lieu d etre
   * silencieusement faux.
   */
  asOfSource?: 'deck-receipt' | 'corpus-ingestion' | null | undefined;
  /**
   * Nature de l operation instruite, lue depuis
   * extraction.fundraise.operationType. Sert a neutraliser les
   * methodes hors de leur domaine, et a elles seules : les multiples
   * sectoriels restent applicables sur les quatre types, ce sont des
   * multiples de transaction autant que de tour.
   *
   * Quand le type vaut 'non-etabli', aucune neutralisation n a lieu.
   * Le pipeline ne sait pas, donc il ne decide pas : transformer une
   * ignorance en decision serait exactement le patron que la grappe 3
   * a ferme.
   */
  operationType?: OperationType | null | undefined;
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
        notApplicableCause: 'doctrine' as const,
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

  // ---------- Consolidation : une fourchette par nature de valeur
  const applicableMethods = methods.filter((m) => m.applicable && m.range);
  const ranges = consolidateRanges(applicableMethods, stage);
  // recommendedRange ne survit que comme raccourci du cas homogene.
  // Des que deux natures coexistent il n y a pas de chiffre unique a
  // recommander, et rendre l une des deux reviendrait a trancher en
  // silence une question qui appartient au lecteur.
  const recommendedRange = ranges.length === 1
    ? { min: ranges[0].min, central: ranges[0].central, max: ranges[0].max }
    : null;

  // ---------- Confiance globale
  const confidence = determineConfidence(applicableMethods, assetClass, stage);

  // ---------- Analyse de dilution si ticket mentionne
  // La dilution se calcule sur une pre-money et sur elle seule :
  // ticket / (pre-money + ticket). L appliquer a une valeur
  // d entreprise rendrait un pourcentage qui ne veut rien dire, la
  // dette nette n etant pas diluee par une augmentation de capital.
  // Elle suit donc la fourchette pre-money quand il y en a une, et
  // reste absente sinon.
  const ticket = parseTicket(input.extraction);
  const preMoneyRange = ranges.find((r) => r.nature === 'pre_money') ?? null;
  // Sur une cession totale, la dilution disparait par construction : il
  // n y a plus d actionnaire existant a diluer, l integralite du
  // capital change de main. Le fait est declare avec sa cause plutot
  // que rendu par un champ vide, qu un lecteur confondrait avec un
  // dossier sans ticket annonce. Sur une cession partielle elle garde
  // un sens, la question du pourcentage cede restant posee.
  const dilutionHorsDomaine = input.operationType === 'cession-totale';
  const dilutionAnalysis = (!dilutionHorsDomaine && preMoneyRange && ticket.equity)
    ? buildDilutionAnalysis(preMoneyRange, ticket.equity)
    : null;

  // Dilution privee de support. Quand aucune fourchette pre-money n a
  // survecu, la dilution n a plus rien a quoi s appliquer. Le cas se
  // produit typiquement sur un LBO ou une cession partielle, ou la
  // neutralisation de la VC inverse supprime la seule methode
  // pre-money du dossier.
  //
  // Ce cas se declarait par un champ vide, ce qui est le patron ferme
  // a la grappe 3 reintroduit par un correctif de la grappe 4 : le
  // motif de non-production etait conditionne a l existence du support
  // qu il devait justement expliquer, donc il disparaissait avec lui.
  // La regle « pas un champ vide » avait ete enoncee sur le seul cas
  // de la cession totale, et s etait lue comme ne valant que pour lui.
  const methodesPreMoney = methods.filter((m) => m.nature === 'pre_money');
  const preMoneyToutesEcartees = methodesPreMoney.length > 0
    && methodesPreMoney.every((m) => !m.applicable);
  const preMoneyEcarteesParDoctrine = preMoneyToutesEcartees
    && methodesPreMoney.every((m) => m.notApplicableCause === 'doctrine');
  const dilutionSansSupport = !dilutionHorsDomaine
    && preMoneyRange === null
    && ticket.total !== null;
  // Dilution non calculable faute de repartition : le fait est porte
  // explicitement plutot que rendu par une absence, qu un lecteur
  // confondrait avec un tour sans ticket annonce.
  const dilutionNotComputable = dilutionHorsDomaine
    ? 'Dilution sans objet sur une cession totale : l integralite du capital change de main, il n y a pas d actionnaire existant dont la part serait reduite. La question pertinente est celle du prix paye, pas du pourcentage obtenu.'
    : dilutionSansSupport
    ? (preMoneyEcarteesParDoctrine
      ? `Dilution sans support : elle se calcule sur une valeur des capitaux propres avant tour, et aucune des methodes qui en produisent une n est applicable a ce dossier (${methodesPreMoney.map((m) => m.label).join(', ')}). La fourchette disponible est en valeur d entreprise, sur laquelle un pourcentage de dilution n aurait pas de sens : la dette nette n est pas diluee par une augmentation de capital.`
      : `Dilution sans support : aucune fourchette en valeur des capitaux propres avant tour n a pu etre produite pour ce dossier, faute d inputs pour les methodes qui en rendent une. La dilution ne se calcule pas sur la fourchette en valeur d entreprise disponible.`)
    : (preMoneyRange && ticket.total && !ticket.equity)
    ? `Dilution non calculable : le tour annonce ${formatEur(ticket.total)} sous la forme "${ticket.raw}", qui melange capital et un autre instrument sans donner la repartition. Une dilution calculee sur le montant total sur-estimerait la part obtenue par le fonds. A chiffrer avec la societe avant toute discussion de prix.`
    : null;
  // Trois causes distinctes, et non deux. Hors domaine sur une cession
  // totale, c est une decision. Sans support parce que les methodes
  // pre-money ont ete ecartees par doctrine, c en est une aussi. Sans
  // support faute d inputs, ou faute de repartition capital contre
  // dette, c est une donnee absente.
  const dilutionNotComputableCause: NonProductionCauseOrNull = dilutionHorsDomaine
    ? 'doctrine'
    : dilutionSansSupport
    ? (preMoneyEcarteesParDoctrine ? 'doctrine' : 'absence')
    : dilutionNotComputable ? 'absence' : null;

  // ---------- Synthese editoriale
  const synthesis = buildSynthesis({
    ranges,
    confidence,
    assetClass,
    stage,
    applicableMethods,
    dilutionAnalysis,
  });

  // ---------- Warnings
  const warnings = collectWarnings(
    applicableMethods, ranges, basis, dilutionNotComputable,
    input.relevanceMatrix?.assetClassArbitration ?? null, stage,
  );

  return {
    ranges,
    recommendedRange,
    confidence,
    methods,
    dilutionAnalysis,
    dilutionNotComputableReason: dilutionNotComputable,
    dilutionNotComputableCause,
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
    // On demande au referentiel pourquoi il n a rien rendu, plutot que
    // d ecrire une phrase unique pour deux faits opposes.
    const absence = explainMissingMultiples(assetClass, stage);
    return {
      method: 'sector-multiples',
      nature: 'enterprise_value',
      label: 'Multiples sectoriels',
      applicable: false,
      notApplicableCause: absence === 'absente' ? 'incident' : 'doctrine',
      notApplicableReason: absence === 'neutralisee'
        ? `Les multiples ne s appliquent pas a ${assetClass} au stade ${stage} : la plage est explicitement neutralisee dans le referentiel, par exemple parce qu une societe a ce stade n a pas d agregat stable a multiplier. C est une decision de calibration, pas une lacune.`
        : absence === 'classe-inconnue'
        ? `Le couple ${assetClass} et ${stage} ne designe pas une combinaison du referentiel. La classe d actif ou le stade n a pas ete tranche en amont, et le moteur refuse de caler la fourchette sur des benchmarks voisins.`
        : `Aucune plage de multiples n existe dans le referentiel pour ${assetClass} au stade ${stage}, alors que cette combinaison devrait en porter une. C est une lacune du referentiel et non une decision : la fourchette manque a ce dossier pour une raison technique.`,
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
      notApplicableCause: 'doctrine',
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
      notApplicableCause: 'absence',
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

  // Le central n est pas le milieu de la plage : il est deplace vers le
  // haut ou le bas selon un signal de qualite tire des scores equipe et
  // marche. La regle etait invisible sur le chiffre que tout le monde
  // lit en premier. Elle se dit, avec ses trois termes, pour qu un
  // lecteur puisse refaire le calcul.
  const centralBrut = central;
  const sens = qualitySignal > 0.5 ? 'vers le haut' : qualitySignal < 0.5 ? 'vers le bas' : 'nulle part';
  const noteCentral = Math.round(adjustedCentral) === Math.round(centralBrut)
    ? ''
    : ` Le point central n est pas le milieu de la plage : le milieu vaut ${formatEur(centralBrut)}, et un signal de qualite de ${Math.round(qualitySignal * 100) / 100}, tire des scores equipe et marche, le deplace ${sens} de 60 pour cent de la distance au plafond, soit ${formatEur(adjustedCentral)}.`;

  const baseRationale = `Multiple ${range.multipleType.toUpperCase()} ${range.min}x-${range.max}x applique sur ${formatEur(baseMetric)}, ${range.multipleType.toUpperCase()} du millesime ${basis.year}. ${basis.declaration}${noteCentral}`;
  const rationale = range.notes
    ? `${baseRationale} ${range.notes}${freshnessNote}`
    : `${baseRationale}${freshnessNote}`;

  return {
    method: 'sector-multiples',
    nature: 'enterprise_value',
    label: 'Multiples sectoriels',
    applicable: true,
    notApplicableCause: null,
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
/**
 * Garde de vraisemblance sur l ecart d ancre. Modelee sur les gardes de
 * lib/analysis/reference-year : structurelle, sans I/O, sans horloge,
 * et elle enrichit la base plutot que de la reecrire.
 *
 * Elle mesure l ecart entre l ancre temporelle du dossier et le
 * millesime retenu, le pose dans la sortie qu il depasse ou non le
 * seuil, et n ajoute une mention de peremption qu au-dela. Elle ne
 * refuse jamais : la doctrine est la retention avec mention, un dossier
 * ancien n etant pas invalide mais ancien.
 *
 * Sans ancre, l ecart n est pas mesurable et reste null. C est le cas
 * de la branche 1 sur un dossier depose sans date de reception : le
 * millesime est alors sur, puisque le document le qualifie lui-meme,
 * mais son age ne l est pas.
 */
function withStaleness(basis: ValuationBasis, anchorYear: number | null): ValuationBasis {
  if (basis.year === null) return basis;

  // Base retenue, ancre absente. On ne peut rien dire de l age du
  // millesime, et c est precisement ce qu il faut dire. Le silence
  // laisserait un dossier de 2017 et un dossier de 2025 se presenter
  // exactement de la meme facon.
  if (anchorYear === null) {
    return {
      ...basis,
      ageUnknown: true,
      ageUnknownNote:
        `Anciennete non evaluee : le millesime ${basis.year} a ete retenu, mais aucune date de reception du dossier n est disponible pour mesurer son age. `
        + 'Ce n est pas une peremption, c est une absence de mesure : le chiffre peut etre de l an dernier comme d il y a dix ans. '
        + 'Renseigner la date de reception en page d entree rend l ecart calculable et declenche, le cas echeant, la mention de peremption.',
    };
  }

  const gap = anchorYear - basis.year;
  const stale = gap > BASIS_STALENESS_THRESHOLD_YEARS;
  return {
    ...basis,
    anchorYear,
    anchorGapYears: gap,
    stale,
    ageUnknown: false,
    ageUnknownNote: null,
    declaration: `${basis.declaration} Ecart a l ancre du dossier : ${gap} an${Math.abs(gap) > 1 ? 's' : ''}.`,
    stalenessNote: stale
      ? `Base perimee : ${gap} ans separent le millesime retenu (${basis.year}) de la reception du dossier (${anchorYear}), au-dela du seuil doctrinal de ${BASIS_STALENESS_THRESHOLD_YEARS} ans. La fourchette reste calculee, mais elle applique des multiples de marche recents a un chiffre d affaires qui ne l est pas. A recroiser avec des comptes a jour avant toute discussion de prix.`
      : null,
  };
}

function resolveValuationBasis(input: ValuationInput): ValuationBasis {
  const fd = input.financialData;

  // ---------- Branche 1 : mention explicite de realise
  // La primitive partagee porte deja tout le contrat : lastActualYear
  // renseigne, citation textuelle presente, appartenance aux annees des
  // projections, non-posteriorite. On ne re-implemente rien ici, et un
  // durcissement de la primitive se propage au moteur sans retouche.
  const explicit = deriveDossierReferenceYearWithReason({ financialData: fd });
  const asOfYear = normalizeYear(input.asOf ?? null);

  if (explicit.year !== null) {
    return withStaleness({
      branch: 'explicit-actual',
      year: explicit.year,
      anchorGapYears: null,
      anchorYear: null,
      stale: false,
      ageUnknown: false,
      ageUnknownNote: null,
      declaration: `Base ${explicit.year}, dernier exercice que le deck qualifie explicitement de realise avec citation a l appui.`,
      stalenessNote: null,
      refusalReason: null,
    }, input.asOfSource === 'deck-receipt' ? asOfYear : null);
  }

  // ---------- Branche 2 : derniere annee anterieure a la date de deck
  // L ancre doit etre une date de reception, pas n importe quelle date
  // rangee dans le meme champ.
  const anchorUsable = asOfYear !== null && input.asOfSource === 'deck-receipt';
  const years = Array.isArray(fd?.revenueProjection)
    ? fd!.revenueProjection
        .map((p) => normalizeYear(p?.year))
        .filter((y): y is number => y !== null)
        .sort((a, b) => a - b)
    : [];

  if (anchorUsable) {
    const anterior = years.filter((y) => y < asOfYear!);
    if (anterior.length > 0) {
      const year = anterior[anterior.length - 1];
      return withStaleness({
        branch: 'as-of-anterior',
        year,
        anchorGapYears: null,
        anchorYear: null,
        stale: false,
        ageUnknown: false,
        ageUnknownNote: null,
        declaration: `Base ${year}, derniere annee de la serie anterieure a la reception du dossier (${input.asOf}). Le deck ne qualifie aucun exercice de realise : ${explicit.rejectionDetail ?? 'aucune mention explicite extractible.'}`,
        stalenessNote: null,
        refusalReason: null,
      }, asOfYear);
    }
    return {
      branch: 'refused',
      year: null,
      anchorGapYears: null,
      anchorYear: asOfYear,
      stale: false,
      ageUnknown: false,
      ageUnknownNote: null,
      stalenessNote: null,
      declaration: `Base refusee : aucun exercice qualifie de realise, et aucune annee des projections n est anterieure a la reception du dossier (${input.asOf}).`,
      refusalReason: years.length > 0
        ? `Le dossier a ete recu en ${asOfYear!} et sa serie de chiffre d affaires commence en ${years[0]}. Toutes les annees documentees sont donc projetees, aucune ne peut servir de base a un multiple de marche.`
        : `Le dossier ne documente aucune serie de chiffre d affaires exploitable.`,
    };
  }

  // ---------- Branche 3 : refus
  // Trois causes distinctes menent ici, et le motif les separe. Une
  // ancre absente n est pas la meme chose qu une ancre presente mais
  // impropre : la seconde demande une action differente du partner.
  const ancreMotif = asOfYear === null
    ? 'Et la date de reception du dossier (asOf) n est pas renseignee, ce qui prive le moteur de son second ancrage.'
    : input.asOfSource === 'corpus-ingestion'
    ? `Et la date presente (${input.asOf}) est une date d ingestion de corpus, pas une date de reception du dossier : elle vaut la meme chose pour tous les dossiers de la campagne et ne dit rien de celui-ci. Elle ne peut pas ancrer un millesime.`
    : `Et la provenance de la date presente (${input.asOf}) n est pas etablie : rien ne permet d affirmer qu il s agit de la reception du dossier plutot que d une date de traitement. Une ancre dont on ignore le sens ne vaut pas mieux qu une ancre absente.`;
  return {
    branch: 'refused',
    year: null,
    anchorGapYears: null,
    anchorYear: null,
    stale: false,
    ageUnknown: false,
    ageUnknownNote: null,
    stalenessNote: null,
    declaration: 'Base refusee : ni mention explicite de realise dans le deck, ni ancre temporelle exploitable pour designer le millesime.',
    refusalReason: `${explicit.rejectionDetail ?? 'Aucune mention explicite de realise extractible du deck.'} ${ancreMotif} Les multiples ne sont pas appliques : une fourchette calculee sur une projection vaudrait moins que pas de fourchette du tout.`,
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
 * Lecture d un montant financier, avec sa cause de non-lecture.
 *
 * Le defaut ferme : « Cession de 100% du capital » rendait 100 M EUR.
 * La forme precedente prenait le premier nombre du libelle, ignorait ce
 * qui le suivait, et convertissait par defaut tout nombre sous mille en
 * millions. Un pourcentage devenait donc un montant, et une part de
 * capital devenait un ticket.
 *
 * Mesure sur le corpus au 3 aout 2026 : sur trente-trois dossiers
 * portant un candidat de ticket, cinq annoncent une part de capital et
 * un annonce un nombre de parcs cedes. Six dossiers sur trente-trois
 * portaient donc un ticket fabrique, dont quatre cessions totales.
 *
 * Trois regles, dans cet ordre.
 *
 * Un nombre immediatement suivi d un signe pourcent n est pas un
 * montant, et la lecture passe au suivant plutot que d abandonner le
 * libelle entier : « cession de 100% du capital pour 12 M EUR » porte
 * bien un montant. C est aussi ce qui evite de perdre le ticket de
 * Crowdaa, ou un pourcentage de discount suit le montant recherche.
 *
 * L unite d une fourchette porte sur ses deux bornes. « 10-15m » lit
 * dix millions et non dix, parce que le suffixe trouve plus loin dans
 * la meme expression s applique a la borne basse.
 *
 * Sans unite ni devise, il n y a pas de montant. La conversion par
 * defaut vers les millions est supprimee : elle transformait un nombre
 * quelconque en somme d argent, ce qui est une divination au sens de la
 * grappe 4. Verifie sur le corpus, aucune valeur legitime n en
 * dependait, les quarante-huit candidats non vides portant tous soit un
 * suffixe soit une devise.
 */
interface MontantLu {
  value: number | null;
  cause: NonProductionCauseOrNull;
  motif: string | null;
}

const MONTANT_AUCUN: MontantLu = { value: null, cause: 'absence', motif: 'aucun montant annonce' };

function lireMontant(raw: any): MontantLu {
  if (raw == null || raw === '') return MONTANT_AUCUN;
  if (typeof raw === 'number') {
    return raw > 0
      ? { value: raw, cause: null, motif: null }
      : { value: null, cause: 'absence', motif: 'montant nul ou negatif' };
  }
  if (typeof raw !== 'string') return MONTANT_AUCUN;

  // Les espaces ne sont supprimes qu entre chiffres, la ou ils separent
  // les milliers. Les supprimer partout collait le suffixe au mot
  // suivant : « 15m de cash-in » devenait « 15mde », donc quinze
  // milliards. Le suffixe doit finir sur autre chose qu une lettre.
  const s = raw.toLowerCase()
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/(\d)[ ](?=\d{3}(?!\d))/g, '$1')
    .replace(/,(\d)/g, '.$1');
  const jetons = Array.from(s.matchAll(/(\d+(?:\.\d+)?)\s*((?:mds?|m|k|b)(?![a-z]))?\s*(%)?/g));
  if (jetons.length === 0) {
    return { value: null, cause: 'absence', motif: 'aucun nombre dans le libelle' };
  }

  const nonPourcent = jetons.filter((j) => j[3] !== '%');
  if (nonPourcent.length === 0) {
    return {
      value: null,
      cause: 'absence',
      motif: 'le libelle exprime une part et non un montant',
    };
  }

  const premier = nonPourcent[0];
  const value = parseFloat(premier[1]);
  if (isNaN(value) || value <= 0) {
    return { value: null, cause: 'absence', motif: 'nombre non exploitable' };
  }

  // L unite peut vivre sur la borne haute d une fourchette, mais
  // seulement si les deux bornes sont contigues. Chercher un suffixe
  // n importe ou dans le libelle ferait lire « 500 000 recherches,
  // plafond 7M » comme cinq cent mille millions.
  let suffixe = premier[2];
  if (suffixe === undefined) {
    const idx = nonPourcent.indexOf(premier);
    const suivant = nonPourcent[idx + 1];
    if (suivant && suivant[2] !== undefined) {
      const finPremier = (premier.index ?? 0) + premier[0].length;
      const entre = s.slice(finPremier, suivant.index ?? finPremier);
      if (/^\s*(?:-|–|—|a|à|to|\/)\s*$/.test(entre)) suffixe = suivant[2];
    }
  }

  if (suffixe === 'md' || suffixe === 'mds' || suffixe === 'b') {
    return { value: value * 1_000_000_000, cause: null, motif: null };
  }
  if (suffixe === 'm') return { value: value * 1_000_000, cause: null, motif: null };
  if (suffixe === 'k') return { value: value * 1_000, cause: null, motif: null };

  const devise = /€|eur|\$|usd|£|gbp/.test(s);
  if (devise && value >= 1000) return { value, cause: null, motif: null };

  return {
    value: null,
    cause: 'absence',
    motif: devise
      ? `montant de ${value} sans ordre de grandeur, non interpretable`
      : 'nombre sans unite ni devise, donc pas un montant',
  };
}

/**
 * Repli de lecture pour les metriques ou seule la valeur compte. La
 * cause reste consultable par lireMontant au site d appel qui en a
 * besoin.
 */
function parseFinancialNumber(raw: any): number | null {
  return lireMontant(raw).value;
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
  // Hors domaine sur cession et LBO. La methode modelise le rendement
  // d un investisseur qui entre au capital et calcule le pre-money
  // qu il peut payer pour atteindre son IRR cible. Sur une cession, il
  // n y a pas d entree au capital mais un transfert de propriete, et
  // sur un LBO le rendement depend d une structure de dette que le
  // pipeline n extrait pas. Ce n est ni un incident ni une absence de
  // donnee : c est une methode appliquee hors de ce qu elle sait
  // mesurer.
  const op = input.operationType;
  if (op === 'cession-partielle' || op === 'cession-totale' || op === 'lbo') {
    const libelle = op === 'lbo' ? 'un LBO' : 'une cession';
    return {
      method: 'vc-method',
      nature: 'pre_money',
      label: 'Methode VC inverse',
      applicable: false,
      notApplicableCause: 'doctrine',
      notApplicableReason: `La VC inverse ne s applique pas a ${libelle}. Elle deduit le pre-money qu un investisseur peut payer pour atteindre son IRR cible en entrant au capital, or il n y a pas d entree au capital dans cette operation. Les multiples sectoriels restent applicables, ce sont des multiples de transaction autant que de tour.`,
    };
  }

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
      // Audit du brief 24 : cette cause avait ete posee par analogie
      // avec le site voisin, sans etre choisie. La table baseExits
      // couvre les vingt et une classes du catalogue, donc un null ici
      // ne peut venir que d une classe hors catalogue, ce que la garde
      // amont de computeValuation intercepte deja. Si le cas se
      // produit malgre tout, c est une lacune de referentiel et non une
      // donnee absente du dossier.
      notApplicableCause: 'incident',
      notApplicableReason: `Aucun scenario d exit n est calibre pour ${assetClass} au stade ${stage}, alors que le referentiel devrait en porter pour les vingt et une classes du catalogue. C est une lacune du referentiel et non une decision.`,
    };
  }

  // La VC inverse soustrait le ticket de la post-money implicite pour
  // rendre un pre-money. Faute de repartition, elle retient le montant
  // total du tour : la soustraction est alors trop grande, donc le
  // pre-money rendu est un minorant, ce qui est le sens prudent de
  // l erreur. Le fait est signale dans le rationale plutot que corrige
  // par une cle de repartition inventee.
  const ticketInfo = parseTicket(input.extraction);
  const ticket = ticketInfo.equity ?? ticketInfo.total ?? 0;
  const ticketIsUpperBound = ticketInfo.equity === null && ticketInfo.total !== null;
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
      notApplicableCause: 'doctrine',
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
    notApplicableCause: null,
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
    rationale: `IRR cible ${Math.round(targetIRR * 100)}% sur ${horizonYears} ans (multiple ${Math.round(targetMultiple * 10) / 10}x). Exits cibles : bear ${formatEur(exitScenarios.bear)}, base ${formatEur(exitScenarios.base)}, bull ${formatEur(exitScenarios.bull)}, calibres sur les exits observes 2020-2025 dans ${assetClass}.${ticketIsUpperBound ? ` Le tour annonce "${ticketInfo.raw}" melange capital et un autre instrument sans repartition : le ticket soustrait ici est donc un majorant de la part en capital, et le pre-money rendu un minorant.` : ''}`,
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
    notApplicableCause: null,
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
    notApplicableCause: 'doctrine',
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
    notApplicableCause: null,
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
    notApplicableCause: 'doctrine',
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
    { method: 'sector-multiples', nature: 'enterprise_value', label: 'Multiples sectoriels', applicable: false, notApplicableCause: 'doctrine', notApplicableReason: reason },
    { method: 'vc-method', nature: 'pre_money', label: 'Methode VC inverse', applicable: false, notApplicableCause: 'doctrine', notApplicableReason: reason },
    { method: 'berkus', nature: 'pre_money', label: 'Methode Berkus', applicable: false, notApplicableCause: 'doctrine', notApplicableReason: reason },
    { method: 'scorecard', nature: 'pre_money', label: 'Methode Scorecard (Bill Payne)', applicable: false, notApplicableCause: 'doctrine', notApplicableReason: reason },
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
    ranges: [],
    recommendedRange: null,
    confidence: 'low',
    methods,
    dilutionAnalysis: null,
    dilutionNotComputableReason: null,
    dilutionNotComputableCause: null,
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
): ConsolidatedRange[] {
  const valid = methods.filter((m) => m.applicable && m.range);
  if (valid.length === 0) return [];

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
  if (eligible.length === 0) return [];

  // Groupement par nature. Le poids d une methode reste celui de la
  // table doctrinale, mais il est renormalise a l interieur de son
  // groupe : sinon une fourchette de valeur d entreprise portee par les
  // seuls multiples en series-a vaudrait 0,65 fois son central, ampute
  // du poids d une methode d une autre nature qui ne la concerne pas.
  const groups = new Map<ValuationNature, ValuationMethodResult[]>();
  for (const m of eligible) {
    const arr = groups.get(m.nature) ?? [];
    arr.push(m);
    groups.set(m.nature, arr);
  }

  // Ordre stable et editorial : la valeur d entreprise d abord quand
  // elle existe, parce qu elle vient de l ancrage empirique le plus
  // direct, le chiffre d affaires realise du dossier.
  const ORDER: ValuationNature[] = ['enterprise_value', 'pre_money'];
  const out: ConsolidatedRange[] = [];

  for (const nature of ORDER) {
    const group = groups.get(nature);
    if (!group || group.length === 0) continue;

    let totalWeight = 0;
    let weightedCentral = 0;
    const centrals: number[] = [];
    for (const m of group) {
      const w = weights[m.method] || 0;
      totalWeight += w;
      weightedCentral += m.range!.central * w;
      centrals.push(m.range!.central);
    }
    const central = weightedCentral / totalWeight;

    // Garde-fous d incertitude, appliques a l interieur du groupe.
    // ENVELOPPE_MAX : les bornes ne sortent jamais de central x
    // [0.55, 1.80] meme si les methodes divergent beaucoup.
    // ENVELOPPE_MIN : les bornes garantissent au minimum +/- 20% autour
    // du central, meme si les methodes convergent tres etroit.
    const ENVELOPPE_MAX_DOWN = 0.55;
    const ENVELOPPE_MAX_UP = 1.80;
    const ENVELOPPE_MIN_DOWN = 0.80;
    const ENVELOPPE_MIN_UP = 1.20;

    let min: number, max: number;
    if (group.length === 1) {
      // Methode unique dans sa nature : on resserre ses bornes propres
      // dans le plafond de plausibilite, sinon une seule methode au
      // range tres large, typiquement la VC inverse, sortirait une
      // fourchette inutilisable pour pricer.
      const m = group[0];
      min = Math.max(m.range!.min, central * ENVELOPPE_MAX_DOWN);
      max = Math.min(m.range!.max, central * ENVELOPPE_MAX_UP);
    } else {
      // Plusieurs methodes de meme nature : la dispersion entre leurs
      // centraux est l ancrage de l incertitude.
      const minCentral = Math.min(...centrals);
      const maxCentral = Math.max(...centrals);
      min = Math.max(minCentral, central * ENVELOPPE_MAX_DOWN);
      max = Math.min(maxCentral, central * ENVELOPPE_MAX_UP);
    }

    if (min > central * ENVELOPPE_MIN_DOWN) min = central * ENVELOPPE_MIN_DOWN;
    if (max < central * ENVELOPPE_MIN_UP) max = central * ENVELOPPE_MIN_UP;

    // Les bornes brutes, avant toute enveloppe : celles qu un lecteur
    // obtient en multipliant la base par les multiples cites.
    const brutMin = group.length === 1 ? group[0].range!.min : Math.min(...centrals);
    const brutMax = group.length === 1 ? group[0].range!.max : Math.max(...centrals);
    const deplace = Math.round(brutMin) !== Math.round(min) || Math.round(brutMax) !== Math.round(max);
    const explication = deplace
      ? `Bornes brutes des methodes : ${formatEur(brutMin)} a ${formatEur(brutMax)}. `
        + `Une enveloppe de plausibilite les resserre ensuite autour du central, entre ${ENVELOPPE_MAX_DOWN} et ${ENVELOPPE_MAX_UP} fois celui-ci, `
        + `et garantit au minimum plus ou moins 20 pour cent : la fourchette affichee est donc ${formatEur(min)} a ${formatEur(max)}. `
        + `L ecart au plancher vient de cette regle, pas des multiples.`
      : `Bornes affichees identiques aux bornes brutes des methodes, l enveloppe de plausibilite n a rien deplace.`;

    out.push({
      nature,
      min: Math.round(min),
      central: Math.round(central),
      max: Math.round(max),
      derivation: {
        brut: { min: Math.round(brutMin), max: Math.round(brutMax) },
        enveloppe: {
          planchier: ENVELOPPE_MAX_DOWN, plafond: ENVELOPPE_MAX_UP,
          minimum: ENVELOPPE_MIN_DOWN, maximumResserre: ENVELOPPE_MIN_UP,
        },
        enveloppeAppliquee: deplace,
        explication,
      },
      contributions: group.map((m) => ({
        method: m.method,
        label: m.label,
        weight: Math.round(((weights[m.method] || 0) / totalWeight) * 1000) / 1000,
      })),
    });
  }

  return out;
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

// ============================================================
// TICKET DU TOUR ET PART EN CAPITAL
// ------------------------------------------------------------
// Le ticket annonce dans un deck n est pas toujours du capital. Cas
// mesure sur le corpus : extraction.fundraise.amount vaut
// "800k€ (mix Equity/bancaire)", et le moteur en tirait 800 000 euros
// traites integralement comme une augmentation de capital. La dilution
// affichee, 5,8 pour cent, supposait donc 800 000 euros d equity la ou
// le deck annonce un mixte, et la VC inverse soustrayait la totalite du
// tour d une post-money implicite.
//
// Les deux usages n ont pas la meme tolerance a l erreur. La dilution
// est un pourcentage que le partner lit comme un fait negociable : une
// dilution calculee sur une assiette trop large est fausse dans un
// sens qui n est pas conservateur, elle sur-estime ce que le fonds
// obtient. La VC inverse, elle, soustrait le ticket pour passer de la
// post-money au pre-money : un ticket trop grand y minore le pre-money,
// ce qui est prudent.
//
// D ou la regle asymetrique. Quand le document signale un financement
// mixte sans donner la repartition, la dilution est declaree non
// calculable avec son motif, et la VC inverse continue en signalant
// que son ticket est un majorant. On ne devine aucune repartition :
// une cle 50/50 posee par defaut serait une donnee inventee sur le
// chiffre que le partner emporte en negociation.
// ============================================================

/**
 * Marqueurs de financement mixte dans le libelle du tour. Volontairement
 * etroits : ils cherchent la mention explicite d un instrument autre que
 * le capital, pas une intuition sur la structure du tour.
 */
const MIXED_FUNDING_REGEX =
  /(bancaire|banque|dette|debt|emprunt|pret\b|prêt|obligataire|oblig\b|bpi|subvention|grant|avance remboursable|mixte|mix\b|blended)/i;

export interface TicketBreakdown {
  /** Montant total du tour tel que le document l annonce, en euros. */
  total: number | null;
  /** Part en capital, quand elle est etablie sans devinette. */
  equity: number | null;
  /** True si le libelle signale un instrument autre que le capital. */
  mixed: boolean;
  /** Libelle brut, conserve pour que la note puisse citer le document. */
  raw: string | null;
  /**
   * Null quand un montant a ete lu. Renseigne sinon, au sens de la
   * grappe 3. Un libelle qui annonce une part de capital et non une
   * somme rend donc un ticket non etabli avec son motif, la ou il
   * rendait un montant fabrique.
   */
  cause: NonProductionCauseOrNull;
  /** Motif de non-lecture, cite dans la note. Null si un montant a ete lu. */
  causeMotif: string | null;
}

/**
 * Lit le ticket du tour et, quand c est possible sans inference, sa
 * part en capital. Ne repartit jamais un montant mixte.
 */
function parseTicket(extraction: ExtractionOutput | null | undefined): TicketBreakdown {
  const empty: TicketBreakdown = {
    total: null, equity: null, mixed: false, raw: null,
    cause: 'absence', causeMotif: 'aucun montant annonce',
  };
  if (!extraction) return empty;
  const ext: any = extraction;
  const candidates = [ext.fundraise?.amount, ext.roundAmount, ext.roundAmountEur];

  // Le premier candidat non vide fait foi, y compris quand il ne porte
  // pas de montant. Passer au suivant apres un libelle de cession
  // reviendrait a chercher un ticket ailleurs jusqu a en trouver un,
  // ce qui est la forme meme du defaut ferme ici.
  let premierRefus: MontantLu | null = null;
  let premierRaw: string | null = null;
  for (const c of candidates) {
    if (c === null || c === undefined || c === '') continue;
    const lu = lireMontant(c);
    const raw = typeof c === 'string' ? c : String(c);
    if (lu.value === null) {
      if (premierRefus === null) { premierRefus = lu; premierRaw = raw; }
      continue;
    }
    const mixed = MIXED_FUNDING_REGEX.test(raw);
    return {
      total: lu.value,
      // Sans mention d un autre instrument, le tour est reput. en
      // capital : c est la lecture par defaut d un montant de levee
      // dans un deck, et elle n invente rien. Avec une telle mention
      // et sans repartition chiffree, la part equity reste inconnue.
      equity: mixed ? null : lu.value,
      mixed,
      raw,
      cause: null,
      causeMotif: null,
    };
  }
  if (premierRefus) {
    return {
      total: null, equity: null, mixed: false, raw: premierRaw,
      cause: premierRefus.cause, causeMotif: premierRefus.motif,
    };
  }
  return empty;
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
  ranges: ConsolidatedRange[];
  confidence: string;
  assetClass: string;
  stage: ValuationStage;
  applicableMethods: ValuationMethodResult[];
  dilutionAnalysis: any;
}): string {
  if (args.ranges.length === 0) {
    return 'La fourchette de valorisation ne peut pas etre etablie : aucune des methodes (multiples, VC inverse, Berkus, Scorecard) ne dispose des inputs necessaires. Demander a la startup le BP, l ARR ou le revenue declare avant de relancer le calcul.';
  }
  const confidenceLabel = args.confidence === 'high' ? 'eleve'
    : args.confidence === 'medium' ? 'modere'
    : 'faible';

  // Une phrase par nature. La synthese ne peut plus annoncer un
  // chiffre unique quand le moteur en produit deux qui ne mesurent pas
  // la meme chose : elle les nomme tous les deux.
  const phrases = args.ranges.map((r) => {
    const sources = r.contributions.map((c) => c.label).join(', ');
    return `En ${VALUATION_NATURE_LABELS[r.nature]}, la fourchette plausible se situe entre ${formatEur(r.min)} et ${formatEur(r.max)}, avec un point central de ${formatEur(r.central)} (${sources}).`;
  });

  let synth = phrases.join(' ');

  // Une regle qui deplace une borne affichee doit se lire dans la
  // synthese et pas seulement dans un champ technique.
  for (const r of args.ranges) {
    if (r.derivation?.enveloppeAppliquee) synth += ` ${r.derivation.explication}`;
  }
  synth += ` Niveau de fiabilite ${confidenceLabel}, base sur ${args.applicableMethods.length} methode${args.applicableMethods.length > 1 ? 's' : ''} applicable${args.applicableMethods.length > 1 ? 's' : ''}.`;

  if (args.ranges.length > 1) {
    synth += ' Les deux fourchettes ne sont pas comparables terme a terme : ce qui les separe est la dette nette du dossier, que le pipeline n extrait pas. Le rapprochement revient au partner, sur les elements de bilan que le deck ne porte pas.';
  }

  if (args.dilutionAnalysis) {
    synth += ` Sur le ticket propose, la dilution s etablit entre ${args.dilutionAnalysis.dilutionAtMax}% (valo haute) et ${args.dilutionAnalysis.dilutionAtMin}% (valo basse).`;
  }

  return synth;
}

function collectWarnings(
  applicableMethods: ValuationMethodResult[],
  ranges: ConsolidatedRange[],
  basis: ValuationBasis,
  dilutionNotComputable: string | null,
  arbitrage?: AssetClassArbitration | null,
  stage?: ValuationStage,
): string[] {
  const warnings: string[] = [];

  if (dilutionNotComputable) warnings.push(dilutionNotComputable);

  // Deux natures en sortie : le fait doit remonter en avertissement et
  // pas seulement dans la prose de synthese, parce que c est ce qui
  // interdit de lire un seul chiffre.
  if (ranges.length > 1) {
    warnings.push(
      `Deux natures de valeur en sortie, ${ranges.map((r) => VALUATION_NATURE_LABELS[r.nature]).join(' et ')}, qui ne se comparent pas terme a terme. L ecart entre elles est la dette nette, absente du contrat d extraction financiere : le pipeline ne lit ni dette, ni tresorerie, ni BFR. Aucune fourchette unique n est recommandee.`,
    );
  }

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
  // Classe d actif contredite par les champs declares du dossier. Elle
  // commande les multiples, donc la fourchette entiere : le lecteur
  // doit voir le choix et son effet chiffre, pas seulement son
  // resultat. La mention nomme les deux plages pour qu il puisse
  // mesurer lui-meme l ecart plutot que le croire sur parole.
  if (arbitrage && stage) {
    const retenue = getSectorMultiples(arbitrage.retenue, stage);
    const ecartee = getSectorMultiples(
      arbitrage.retenue === arbitrage.indiqueeParLeDossier
        ? deriveClasseEcartee(arbitrage)
        : arbitrage.indiqueeParLeDossier,
      stage,
    );
    const plage = (m: ReturnType<typeof getSectorMultiples>) =>
      m ? `${m.range.min}x-${m.range.max}x de ${m.range.multipleType.toUpperCase()}` : 'aucune plage';
    warnings.push(
      `Choix sensible de classe d actif. ${arbitrage.motif} Ce choix commande les multiples : `
      + `${arbitrage.retenue} donne ${plage(retenue)}, l autre lecture donne ${plage(ecartee)}. `
      + `La fourchette ci-dessus repose entierement sur ce choix, a confirmer avant toute discussion de prix.`,
    );
  }

  if (basis.stalenessNote) warnings.push(basis.stalenessNote);
  if (basis.ageUnknownNote) warnings.push(basis.ageUnknownNote);

  if (basis.branch === 'refused') {
    warnings.push(`Les multiples sectoriels n ont pas pu être appliqués : ${basis.refusalReason ?? basis.declaration}`);
  } else if (basis.branch === 'as-of-anterior') {
    warnings.push(`${basis.declaration} Le deck ne qualifie explicitement aucun exercice de realise : la base a ete ancree sur la date de reception du dossier, pas sur une declaration du fondateur. A recouper avec les liasses.`);
  }

  if (ranges.length === 0) {
    warnings.push('Fourchette non calculée : inputs insuffisants. Le partner doit collecter le BP / l ARR avant de procéder à la négociation.');
    return warnings;
  }

  if (applicableMethods.length === 1) {
    warnings.push('Une seule méthode applicable. La fourchette est moins robuste qu une consolidation à 2-3 méthodes. Considérer comme indicative.');
  }

  // La largeur s evalue fourchette par fourchette. Une fourchette de
  // valeur d entreprise etroite et une fourchette pre-money large ne
  // se moyennent pas : chacune est signalee pour ce qu elle est.
  for (const r of ranges) {
    if (r.min > 0 && r.max / r.min > 4) {
      warnings.push(`La fourchette en ${VALUATION_NATURE_LABELS[r.nature]} est très large (rapport max/min ${Math.round(r.max / r.min * 10) / 10}). Le pricing dépend fortement de signaux qualitatifs non chiffrables.`);
    }
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

/**
 * Surface reservee aux tests deterministes. Ces deux fonctions sont
 * internes au moteur et le restent : les exposer une par une aurait
 * elargi l API publique pour une raison de test.
 */
export const __testables = { lireMontant, parseTicket };

/**
 * Classe ecartee par l arbitrage. Quand le dossier l a emporte, la
 * lecture ecartee est celle de la chaine de production, qu on
 * reconstitue depuis la trace plutot que de la recalculer.
 */
function deriveClasseEcartee(a: NonNullable<RelevanceMatrix['assetClassArbitration']>): string {
  // La chaine conclut a industrial-hardware sauf signal thematique
  // reconnu ; la trace ne conserve que la chaine, ce qui suffit a
  // nommer la lecture alternative dans une mention destinee a un
  // lecteur.
  return a.chaineDetectee === 'wet-biotech' ? 'deeptech' : 'industrial-hardware';
}
