// ============================================================
// FRAGILITE STRUCTURELLE - ORCHESTRATEUR
// ------------------------------------------------------------
// Coordonne l execution des sept patterns Phase 4 selon la
// matrice de pertinence. Patterns lances en parallele via
// Promise.all pour minimiser la duree totale, agregation des
// scores et detection des combinaisons diagnostiques cross-
// patterns documentees dans les fiches.
//
// L orchestrateur ne s appelle que si la matrice declare au
// moins un pattern Phase 4 applicable (full ou partial). Si
// tous les patterns sont en not-applicable, l orchestrateur
// retourne un output minimal sans appeler de LLM.
// ============================================================

import type { RelevanceMatrix } from '../relevance-matrix';
import type { ExecutionFrictionOutput } from '../types';
import {
  PATTERN_IDS,
  type PatternId,
  type PatternInput,
  type PatternAnalysisOutput,
  type FragiliteStructurelleAnalysisOutput,
  type PatternVerdict,
  type NonApplicabilityCause,
} from './types';
import { type PatternModule, buildNotApplicableOutput } from './pattern-interface';
import { logException } from '../../error-logger';

// ============================================================
// REGISTRY DES PATTERNS
// ------------------------------------------------------------
// Au fur et a mesure qu un pattern est implemente, il est
// enregistre ici. L orchestrateur ne tourne que sur les patterns
// presents dans le registry. Les patterns absents sont traites
// comme not-applicable avec un rationale neutre.
//
// Au commit initial, seul growth-subsidized-model est implemente
// en skeleton. Les six autres patterns auront leur propre commit.
// ============================================================

const PATTERN_REGISTRY: Partial<Record<PatternId, PatternModule>> = {
  // Les patterns sont inseres ici via leur module au fur et a mesure
  // de l implementation. Voir lib/engines/fragility-structurelle/
  // <pattern>-pattern.ts pour chaque module.
};

/**
 * Inscription dynamique d un pattern dans le registry. Permet
 * aux modules patterns de s auto-enregistrer via un side-effect
 * au moment de leur import. Pattern recommande : chaque module
 * pattern appelle registerPattern(patternModule) en bas de fichier.
 */
export function registerPattern(module: PatternModule): void {
  PATTERN_REGISTRY[module.patternId] = module;
}

// ============================================================
// COMBINAISONS DIAGNOSTIQUES
// ------------------------------------------------------------
// Documentees dans les fiches patterns. Une combinaison declenchee
// quand au moins deux patterns specifies remontent a verdict alerte
// ou plus produit un signal de couverture renforce.
// ============================================================

/**
 * Contexte remis a chaque combinaison. Il porte les sorties des sept
 * patterns et celle du moteur Friction d Execution.
 *
 * La friction y figure parce qu une combinaison l exigeait dans sa
 * prose sans que rien ne l evalue. Le champ est requis et non
 * optionnel : un champ optionnel jamais passe est precisement le
 * defaut que cette correction ferme, et il s en trouve deja assez dans
 * ce depot pour ne pas en ajouter un.
 */
export interface ContexteCombinaisons {
  patterns: Record<PatternId, PatternAnalysisOutput | null>;
  /** Null quand le moteur est tombe, n a pas tourne, ou n est pas
   *  disponible sur ce chemin d appel. Une combinaison qui en depend
   *  ne se declenche alors pas : on ne suppose pas une simultaneite
   *  qu on n a pas pu constater. */
  executionFriction: ExecutionFrictionOutput | null;
}

interface CombinaisonDiagnostique {
  nom: string;
  /** Patterns cites, pour l affichage et la tracabilite de la
   *  combinaison. Ne decide plus du declenchement. */
  patterns: PatternId[];
  /**
   * Condition de declenchement, en code.
   *
   * Elle etait auparavant deduite de `patterns` et `seuilMin`, ce qui
   * couvrait six combinaisons sur sept. La septieme, « Exposition
   * reglementaire convergente », enoncait sa condition reelle dans son
   * champ `rationale` : un declenchement conditionne a ce que Friction
   * d Execution detecte simultanement une friction reglementaire
   * actuelle. Cette condition n etait evaluee nulle part, et ne
   * pouvait pas l etre puisque l orchestrateur ne recevait pas la
   * sortie de ce moteur. Elle a survecu parce qu elle vivait dans une
   * chaine de caracteres, que le compilateur ne lit pas.
   *
   * Le cout etait editorial avant d etre technique : `rationale` est
   * rendu tel quel au partner sous « Convergences detectees », en
   * severite alerte. Le partner lisait donc une simultaneite constatee
   * la ou rien n avait ete verifie. Un score mal calibre se discute ;
   * une affirmation de fait produite par une absence de verification
   * se paie au comite.
   *
   * En predicat, la condition est du code : le compilateur exige son
   * contexte, et l ecart entre ce qu une combinaison affirme et ce
   * qu elle verifie ne peut plus s ouvrir en silence.
   */
  declenche: (ctx: ContexteCombinaisons) => boolean;
  rationale: string;
  severite: 'attention' | 'alerte' | 'drapeau-rouge';
}

/** Seuil de declenchement par defaut, inchange. */
const SEUIL_COMBINAISON_DEFAUT = 60;

/**
 * Score d un pattern, ou null s il n a pas abouti ou n est pas
 * applicable. Meme lecture que l agregation : un pattern sans score ne
 * compte pas, il ne compte pas pour zero.
 */
function scorePattern(ctx: ContexteCombinaisons, id: PatternId): number | null {
  const p = ctx.patterns[id];
  if (!p) return null;
  if (p.applicabilite === 'not-applicable') return null;
  if (typeof p.globalScore !== 'number') return null;
  return p.globalScore;
}

/** Tous les patterns cites atteignent le seuil. */
function tousAuSeuil(ctx: ContexteCombinaisons, ids: PatternId[], seuil = SEUIL_COMBINAISON_DEFAUT): boolean {
  return ids.every((id) => {
    const s = scorePattern(ctx, id);
    return s !== null && s >= seuil;
  });
}

/**
 * Friction reglementaire actuelle constatee par le moteur Friction
 * d Execution.
 *
 * Deux conditions, et la seconde porte le mot « actuelle ». Le moteur
 * doit s etre declenche, sinon ses axes sont vides et son silence
 * n est pas un constat. Et son axe `product_regulation` doit atteindre
 * le seuil que le moteur lui-meme place a l entree de friction_high,
 * cinquante-cinq, decrit dans son prompt comme « plusieurs frictions
 * concomitantes ». En deca, il y a une revendication de certification
 * dans le pitch, pas une friction observee.
 *
 * Le drapeau `regulated_certification` ne suffit pas seul : il dit que
 * le dossier evolue en terrain reglemente, ce qui est une
 * caracteristique et non un evenement.
 */
const SEUIL_FRICTION_REGLEMENTAIRE_ACTUELLE = 55;

function frictionReglementaireActuelle(ctx: ContexteCombinaisons): boolean {
  const ef = ctx.executionFriction;
  if (!ef || ef.triggered !== true) return false;
  const axe = (ef.axes ?? []).find((a) => a.axis === 'product_regulation');
  if (!axe || typeof axe.score !== 'number') return false;
  return axe.score >= SEUIL_FRICTION_REGLEMENTAIRE_ACTUELLE;
}

const COMBINAISONS_CONFIG: CombinaisonDiagnostique[] = [
  {
    nom: 'Trajectoire WeWork',
    patterns: ['growth-subsidized-model', 'fixed-cost-trap'],
    declenche: (ctx) => tousAuSeuil(ctx, ['growth-subsidized-model', 'fixed-cost-trap']),
    rationale: 'Combinaison historique : croissance subventionnee non viable plus base de couts incompressibles. La marge unitaire negative ne peut pas etre absorbee par scale, et les couts fixes ne peuvent pas etre reduits par layoff. Trajectoire mecanique vers la restructuration sauf intervention strategique majeure.',
    severite: 'drapeau-rouge',
  },
  {
    nom: 'Fin de cycle quasi-mecanique',
    patterns: ['growth-subsidized-model', 'commoditization-drift'],
    declenche: (ctx) => tousAuSeuil(ctx, ['growth-subsidized-model', 'commoditization-drift']),
    rationale: 'Marge unitaire deja negative ET pricing power en erosion par les outils IA. La hausse de pricing necessaire pour restaurer l unit economics est rendue impossible par la commoditisation simultanee. La trajectoire converge vers la faillite ou le pivot complet.',
    severite: 'drapeau-rouge',
  },
  {
    nom: 'Wrapper sans differenciation',
    patterns: ['infrastructure-hostage', 'commoditization-drift'],
    declenche: (ctx) => tousAuSeuil(ctx, ['infrastructure-hostage', 'commoditization-drift']),
    rationale: 'Captivite totale : depend d un fournisseur dominant ET le fournisseur peut cannibaliser directement la value proposition. Pattern Jasper et Copy.ai face a OpenAI. Sortie strategique tres etroite.',
    severite: 'drapeau-rouge',
  },
  {
    nom: 'Pattern Britishvolt',
    patterns: ['scale-mirage-risk', 'fixed-cost-trap'],
    declenche: (ctx) => tousAuSeuil(ctx, ['scale-mirage-risk', 'fixed-cost-trap'], 55),
    rationale: 'Industrialisation prematuree plus engagements operationnels long terme. Le capex industriel est deja perdu si la demande ne suit pas, et les couts d operation ne peuvent pas etre reduits a hauteur de la sous-utilisation.',
    severite: 'alerte',
  },
  {
    nom: 'Pattern Northvolt',
    patterns: ['scale-mirage-risk', 'capital-structure-fragility'],
    declenche: (ctx) => tousAuSeuil(ctx, ['scale-mirage-risk', 'capital-structure-fragility']),
    rationale: 'Industrialisation prematuree plus cap table fragile. Le retard d industrialisation rend mecaniquement necessaire un down round, mais la cap table fragile ne supportera pas la dilution sans declencher des protections defavorables aux fondateurs et common.',
    severite: 'drapeau-rouge',
  },
  {
    nom: 'Exposition triple WeWork',
    patterns: ['capital-structure-fragility', 'growth-subsidized-model', 'fixed-cost-trap'],
    declenche: (ctx) => tousAuSeuil(ctx, ['capital-structure-fragility', 'growth-subsidized-model', 'fixed-cost-trap'], 55),
    rationale: 'Cap table fragile plus fragilite economique double : la cap table ne supportera pas la periode de stress economique, et le stress est probable du fait de Growth Subsidized et Fixed Cost Trap. Trajectoire WeWork integrale.',
    severite: 'drapeau-rouge',
  },
  {
    nom: 'Exposition reglementaire convergente',
    patterns: ['regulatory-time-bomb'],
    // La condition que le rationale enonce, enfin evaluee. Les deux
    // termes sont exiges : le pattern au seuil, et une friction
    // reglementaire actuelle constatee par l autre moteur.
    declenche: (ctx) =>
      tousAuSeuil(ctx, ['regulatory-time-bomb'])
      && frictionReglementaireActuelle(ctx),
    rationale: 'Le pattern Risque reglementaire date depasse le seuil d alerte, et le moteur Friction d Execution constate simultanement une friction reglementaire actuelle sur l axe regulation produit. Le management subit deja un frottement et n est pas prepare pour le suivant.',
    severite: 'alerte',
  },
];

// ============================================================
// POINT D ENTREE
// ============================================================

/**
 * Lance l analyse Fragilite Structurelle complete. Filtre les
 * patterns applicables selon la matrice et le registry, lance
 * les patterns retenus en parallele, agrege les scores, detecte
 * les combinaisons diagnostiques.
 *
 * Non-bloquant : echec d un pattern individuel logge en warning,
 * pattern marque non-applicable, l agregation continue. La
 * resilience est cle parce que sept appels LLM en parallele
 * augmentent la probabilite qu au moins un echoue.
 */
export async function analyzeFragiliteStructurelle(
  input: PatternInput,
  relevanceMatrix: RelevanceMatrix | null,
  analysisId: string | null,
  /**
   * Sortie du moteur Friction d Execution, remise sous forme de
   * promesse et non de valeur.
   *
   * La forme n est pas un detail de commodite. Une combinaison en a
   * besoin, et elle n est evaluee qu apres les sept appels de
   * patterns : attendre la friction avant de lancer les patterns
   * ajouterait sa duree au chemin critique du run pour une valeur
   * consommee tout a la fin. La promesse est donc creee en parallele
   * par l appelant et attendue ici, juste avant la detection, ou elle
   * est presque toujours deja resolue.
   *
   * Le parametre est requis. Un appelant qui n a pas ce moteur passe
   * explicitement Promise.resolve(null), ce qui est une decision
   * ecrite plutot qu un oubli : un parametre optionnel jamais passe
   * est exactement le defaut que cette correction ferme.
   */
  executionFriction: Promise<ExecutionFrictionOutput | null>,
): Promise<FragiliteStructurelleAnalysisOutput> {
  // Recuperation des verdicts matrice. Si pas de matrice, on traite
  // tous les patterns comme partial par defaut, ce qui est un
  // fallback prudent.
  const matriceVerdicts = (relevanceMatrix as any)?.verdicts?.fragiliteStructurelle ?? null;

  const patternsApplicables: PatternId[] = [];
  const patternsNonApplicables: Array<{ id: PatternId; rationale: string; cause: NonApplicabilityCause }> = [];

  for (const patternId of PATTERN_IDS) {
    const verdictMatrice = matriceVerdicts?.[patternId];
    const verdictApplicable = !verdictMatrice || verdictMatrice.applicable !== 'none';
    const moduleEnregistre = PATTERN_REGISTRY[patternId];

    if (!verdictApplicable) {
      patternsNonApplicables.push({
        id: patternId,
        rationale: verdictMatrice?.rationale || 'Matrice de pertinence : non applicable sur ce dossier.',
        cause: 'matrix',
      });
      continue;
    }

    if (!moduleEnregistre) {
      // Pattern pas encore implemente en code, on le marque comme
      // non applicable avec un rationale honnete plutot que de
      // simuler un faux verdict.
      patternsNonApplicables.push({
        id: patternId,
        rationale: 'Pattern non encore implemente en code (doctrine prete dans docs/patterns/).',
        cause: 'not-implemented',
      });
      continue;
    }

    patternsApplicables.push(patternId);
  }

  // Lancement parallele des patterns applicables. Chaque appel est
  // instrumente par un timer wall-clock pose autour de moduleP.analyze
  // pour porter analyzeMs sur la sortie du pattern. Deux cas :
  //   - succes : analyzeMs = temps reel de l appel (attente LLM plus
  //              pre/post-processing).
  //   - echec  : analyzeMs = temps ecoule entre l entree et l exception.
  //              Discrimine un timeout SDK ~180s d un parse fail
  //              instantane sans avoir a croiser error_logs.
  const resultsApplicables = await Promise.all(
    patternsApplicables.map(async (patternId) => {
      const moduleP = PATTERN_REGISTRY[patternId]!;
      const startedAt = Date.now();
      try {
        const r = await moduleP.analyze(input);
        return { ...r, analyzeMs: Date.now() - startedAt };
      } catch (err) {
        const analyzeMs = Date.now() - startedAt;
        // analysisId propage depuis route.ts pour que la ligne
        // error_logs soit rattachable au run par jointure directe,
        // sans corriger la fenetre temporelle a la main. context
        // porte analyzeMs pour tracer la nature de l echec (timeout
        // long, parse instantane) sans lire meta.engineDurations.
        logException(`pipeline.fragility-structurelle.${patternId}`, err, {
          severity: 'warning',
          analysisId,
          context: { patternId, analyzeMs },
        });
        return {
          ...buildNotApplicableOutput(patternId, 'Erreur lors de l analyse, pattern marque non applicable.', 'execution-error'),
          analyzeMs,
        };
      }
    }),
  );

  // Agregation des resultats : applicables + non applicables
  const patterns: Record<PatternId, PatternAnalysisOutput | null> = {} as any;
  for (const r of resultsApplicables) {
    patterns[r.patternId] = r;
  }
  for (const na of patternsNonApplicables) {
    patterns[na.id] = buildNotApplicableOutput(na.id, na.rationale, na.cause);
  }

  // Calcul du score global pondere. Chaque pattern applicable
  // contribue selon son score et son weight matrice (defaut 0.5
  // si pas de matrice).
  let scoreSommePondere = 0;
  let weightTotal = 0;
  let contributing = 0;
  for (const patternId of PATTERN_IDS) {
    const p = patterns[patternId];
    if (!p || p.applicabilite === 'not-applicable') continue;
    if (p.globalScore === null) continue;
    const weight = matriceVerdicts?.[patternId]?.weight ?? 0.5;
    scoreSommePondere += p.globalScore * weight;
    weightTotal += weight;
    contributing += 1;
  }
  const globalFragilityScore = weightTotal > 0
    ? Math.round(scoreSommePondere / weightTotal)
    : 0;

  // Couverture du moteur : compte des detecteurs tombes en erreur
  // d execution vs total. Un pattern ecarte doctrinalement (matrice,
  // pattern-scope, central-axis-gating, not-implemented) n est pas
  // un trou, il ne compte pas dans failed.
  let failed = 0;
  for (const patternId of PATTERN_IDS) {
    const p = patterns[patternId];
    if (p?.nonApplicabilityCause === 'execution-error') failed += 1;
  }
  const coverage = {
    contributing,
    failed,
    total: PATTERN_IDS.length,
  };

  // Detection des combinaisons diagnostiques
  // La friction est attendue ici et pas plus tot : les sept patterns
  // ont deja tourne, donc la promesse lancee en parallele par
  // l appelant est resolue ou sur le point de l etre.
  //
  // Un echec du moteur ne doit pas faire tomber Fragilite, qui est
  // non-bloquant par conception. Une friction indisponible vaut null,
  // et la combinaison qui en depend ne se declenche pas : on ne
  // suppose pas une simultaneite qu on n a pas pu constater.
  let frictionResolue: ExecutionFrictionOutput | null = null;
  try {
    frictionResolue = await executionFriction;
  } catch {
    frictionResolue = null;
  }

  const combinaisons = detectCombinaisons({
    patterns,
    executionFriction: frictionResolue,
  });

  // Verdict global derive du score, des combinaisons et de la
  // couverture. Regle asymetrique : un verdict d alerte reste
  // emettable sous couverture partielle (un detecteur qui crie au
  // feu reste credible), mais un verdict sain exige une couverture
  // sans trou. Si failed > 0 et que le score mene mecaniquement a
  // sain, le verdict devient non-concluant.
  const verdict = deriveGlobalVerdict(globalFragilityScore, combinaisons, coverage);

  // Recommandations DD consolidees
  const recommandationsDD = consolidateRecommandations(patterns);

  // Resume editorial
  const resumeEditorial = buildResumeEditorial(patterns, combinaisons, globalFragilityScore, verdict, coverage);

  return {
    patterns,
    globalFragilityScore,
    verdict,
    resumeEditorial,
    combinaisons,
    recommandationsDD,
    coverage,
  };
}

// ============================================================
// DETECTION DES COMBINAISONS
// ============================================================

function detectCombinaisons(
  ctx: ContexteCombinaisons,
): FragiliteStructurelleAnalysisOutput['combinaisons'] {
  const detectees: FragiliteStructurelleAnalysisOutput['combinaisons'] = [];

  for (const config of COMBINAISONS_CONFIG) {
    if (!config.declenche(ctx)) continue;
    detectees.push({
      nom: config.nom,
      patterns: config.patterns,
      rationale: config.rationale,
      severite: config.severite,
    });
  }

  return detectees;
}

// ============================================================
// VERDICT GLOBAL
// ============================================================

function deriveGlobalVerdict(
  globalScore: number,
  combinaisons: FragiliteStructurelleAnalysisOutput['combinaisons'],
  coverage: NonNullable<FragiliteStructurelleAnalysisOutput['coverage']>,
): PatternVerdict {
  // Une combinaison drapeau-rouge force le verdict drapeau-rouge,
  // meme sous couverture partielle : un signal de convergence
  // documente reste opposable independamment des autres detecteurs.
  if (combinaisons.some((c) => c.severite === 'drapeau-rouge')) {
    return 'drapeau-rouge';
  }
  // Sinon, le score global decide
  let base: PatternVerdict;
  if (globalScore >= 75) base = 'drapeau-rouge';
  else if (globalScore >= 55) base = 'alerte';
  else if (globalScore >= 35) base = 'attention';
  else base = 'sain';

  // Regle asymetrique defendable en comite : un verdict sain
  // requiert une couverture complete. L absence de signal ne prouve
  // rien quand les detecteurs sont tombes. Les verdicts attention,
  // alerte, drapeau-rouge restent emettables sous couverture
  // partielle : un detecteur qui crie au feu reste credible quand
  // les autres sont muets.
  if (coverage.failed > 0 && base === 'sain') {
    return 'non-concluant';
  }
  return base;
}

// ============================================================
// RECOMMANDATIONS DD CONSOLIDEES
// ============================================================

function consolidateRecommandations(
  patterns: Record<PatternId, PatternAnalysisOutput | null>,
): string[] {
  const recos: string[] = [];
  const seen = new Set<string>();

  for (const patternId of PATTERN_IDS) {
    const p = patterns[patternId];
    if (!p || p.applicabilite === 'not-applicable') continue;
    if (!p.recommandationDD) continue;
    // Deduplication simple sur la chaine complete (les recommandations
    // sont generalement distinctes par pattern, mais la garde reste
    // utile en cas de chevauchement editorial).
    const key = p.recommandationDD.trim().toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    recos.push(p.recommandationDD);
  }

  return recos;
}

// ============================================================
// RESUME EDITORIAL
// ============================================================

function buildResumeEditorial(
  patterns: Record<PatternId, PatternAnalysisOutput | null>,
  combinaisons: FragiliteStructurelleAnalysisOutput['combinaisons'],
  globalScore: number,
  verdict: PatternVerdict,
  coverage: NonNullable<FragiliteStructurelleAnalysisOutput['coverage']>,
): string {
  const patternsActifs = PATTERN_IDS
    .map((id) => patterns[id])
    .filter((p): p is PatternAnalysisOutput => !!p && p.applicabilite !== 'not-applicable');

  // Cas trou d execution : jamais affirmer qu aucun pattern ne
  // remonte. Le silence des detecteurs tombes ne prouve rien.
  if (coverage.failed > 0) {
    const nActifs = patternsActifs.length;
    const partsActifs = nActifs > 0
      ? `${nActifs} detecteur${nActifs > 1 ? 's' : ''} a${nActifs > 1 ? 'ont' : ''} abouti`
      : 'aucun detecteur n a abouti';
    const partsFailed = `${coverage.failed} detecteur${coverage.failed > 1 ? 's' : ''} sur ${coverage.total} ${coverage.failed > 1 ? 'sont tombes' : 'est tombe'} en erreur d execution`;

    if (verdict === 'non-concluant') {
      return `Le moteur Fragilite Structurelle n a pas pu se prononcer sur ce dossier : ${partsFailed}, ${partsActifs} sans remonter de signal significatif. Le verdict est non-concluant : l absence de signal ne prouve rien quand les detecteurs sont muets. La lecture sera reprise en DD Bloc 2 avec les detecteurs manquants.`;
    }
    if (verdict === 'sain') {
      // Filet de securite : ne devrait pas survenir sous la nouvelle
      // regle de deriveGlobalVerdict, mais on garde le texte defensif
      // au cas ou un consommateur reconstruirait un verdict a la main.
      return `Le moteur Fragilite Structurelle a rendu sur couverture partielle : ${partsFailed}, ${partsActifs} sans signal a intensite d alerte. Le score global ${globalScore}/100 est calcule sur les detecteurs survivants uniquement. A recroiser en DD Bloc 2.`;
    }
    // Verdict alerte, attention ou drapeau-rouge : un signal remonte,
    // il reste opposable meme sous couverture partielle.
    const patternsRemontes = patternsActifs.filter((p) => p.globalScore !== null && p.globalScore >= 55);
    const nomsRemontes = patternsRemontes.map((p) => p.patternId).join(', ');
    let resume = `Le moteur Fragilite Structurelle remonte ${patternsRemontes.length} pattern${patternsRemontes.length > 1 ? 's' : ''} significatif${patternsRemontes.length > 1 ? 's' : ''} sur ce dossier : ${nomsRemontes}. Score global ${globalScore}/100, verdict ${verdict}. Couverture partielle : ${partsFailed}, le signal reste opposable mais la lecture complete sera reprise en DD Bloc 2.`;
    if (combinaisons.length > 0) {
      const combNoms = combinaisons.map((c) => c.nom).join(', ');
      resume += ` Combinaisons diagnostiques detectees : ${combNoms}. Ce signal cumule merite remontee sur la couverture de la note.`;
    }
    return resume;
  }

  if (patternsActifs.length === 0) {
    return 'Le moteur Fragilite Structurelle n a trouve aucun pattern applicable sur ce dossier. Les axes Phase 4 sont soit hors-scope (modele economique non concerne), soit en attente d implementation. La lecture early-stage du Bloc 1 reste l analyse principale.';
  }

  const patternsRemontes = patternsActifs.filter((p) => p.globalScore !== null && p.globalScore >= 55);
  if (patternsRemontes.length === 0) {
    const n = patternsActifs.length;
    const partActifs = n > 1
      ? `Les ${n} patterns actifs produisent`
      : 'Le pattern actif produit';
    return `Aucun pattern de fragilite structurelle ne remonte significativement sur ce dossier. ${partActifs} des scores moderes (en dessous de 55), ce qui est aligne avec un dossier sain sur l axe Phase 4. Score global Fragilite : ${globalScore}/100.`;
  }

  const noms = patternsRemontes.map((p) => p.patternId).join(', ');
  let resume = `Le moteur Fragilite Structurelle remonte ${patternsRemontes.length} pattern${patternsRemontes.length > 1 ? 's' : ''} significatif${patternsRemontes.length > 1 ? 's' : ''} sur ce dossier : ${noms}. Score global ${globalScore}/100, verdict ${verdict}.`;

  if (combinaisons.length > 0) {
    const combNoms = combinaisons.map((c) => c.nom).join(', ');
    resume += ` Combinaisons diagnostiques detectees : ${combNoms}. Ce signal cumule merite remontee sur la couverture de la note.`;
  }

  return resume;
}

// ============================================================
// EXPOSITION POUR TESTS
// ============================================================

/** Exposed pour tests : permet d injecter un registry de mock. */
export function _setRegistryForTests(registry: Partial<Record<PatternId, PatternModule>>): void {
  // Reset
  for (const id of PATTERN_IDS) delete PATTERN_REGISTRY[id];
  // Injection
  for (const [id, mod] of Object.entries(registry)) {
    if (mod) PATTERN_REGISTRY[id as PatternId] = mod;
  }
}

/** Exposed pour tests : permet de lire le registry courant. */
export function _getRegistryForTests(): Partial<Record<PatternId, PatternModule>> {
  return { ...PATTERN_REGISTRY };
}

/**
 * Expose la detection de combinaisons pour la suite deterministe.
 *
 * Elle etait purement interne, et c est une raison de plus pour
 * laquelle la condition manquante a tenu : la seule facon de
 * l atteindre passait par sept appels au modele, donc hors de la suite
 * deterministe. La detection est pure, elle ne demande qu un contexte.
 */
export const _internalCombinaisons = {
  detectCombinaisons,
  SEUIL_FRICTION_REGLEMENTAIRE_ACTUELLE,
  COMBINAISONS_CONFIG,
};
