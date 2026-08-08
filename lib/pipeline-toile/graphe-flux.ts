// ============================================================
// LE GRAPHE DE FLUX : QUELLE SORTIE CHAQUE MOTEUR CONSOMME
// ------------------------------------------------------------
// DEUX RELATIONS DISTINCTES ENTRE LES MEMES MOTEURS, ET LE DEPOT EN
// PORTAIT DEJA UNE SANS DIRE QU IL EN EXISTAIT DEUX.
//
// Le FLUX dit ce qu un moteur consomme : `causal` recoit la sortie de
// `pattern`, donc il raisonne sur ce que `pattern` a etabli. C est une
// relation de donnees, et c est celle que ce module declare.
//
// L ORDONNANCEMENT dit ce qu un moteur attend avant de demarrer.
// `WAVE_BASED_TOPOLOGY` le modelise avec ses barrieres de vague : chaque
// moteur d une vague attend toute la vague precedente, meme sans en
// consommer la sortie. C est une relation de temps, elle a servi a
// calculer un chemin critique, et elle ne dit rien de ce qui se passe
// entre deux moteurs.
//
// LA CASCADE, elle, n est declaree nulle part et ne doit pas l etre :
// elle se derive des faits d un run, en croisant l etat de chaque moteur
// avec ce graphe. Voir `retrospective.ts`. Un moteur eteint faute
// d entree l est parce que sa dependance de flux n a rien produit, et ce
// fait se lit dans le releve du recorder, jamais dans une declaration.
//
// Les trois se confondent facilement parce qu elles relient les memes
// noeuds. Quiconque voudra dessiner l ordonnancement doit savoir que ce
// module ne le porte pas, et quiconque voudra dessiner la cascade doit
// savoir qu elle ne se declare pas.
//
// POURQUOI CE MODULE EXISTE ALORS QUE `DEP_DRIVEN_TOPOLOGY` EXISTAIT.
// Celle-ci se presentait comme les dependances reelles et son en-tete
// disait qu elle « documente » ce que la route exprime en JavaScript.
// Documenter n est pas verifier, et personne n avait compare les deux :
// le releve du 8 aout 2026 a trouve `extraction` passee a treize moteurs
// sur quatorze et declaree sur sept. Le graphe etait faux d une facon
// systematique et il avait l air vrai, ce qui est le pire des trois
// etats. Ce module-ci porte son verrou : une arete declaree qui
// n apparait pas dans l appel fait echouer, et un argument de l appel
// qui n est pas declare fait echouer aussi.
//
// CE QUI N EST PAS UN MOTEUR N A PAS DE FIL. Quatre entrees alimentent
// des moteurs sans etre produites par la chaine : le contexte sectoriel,
// la matrice de pertinence, le texte brut du document et la note
// dimensionnelle du fonds. Les dessiner en noeuds ferait un graphe plus
// joli et moins vrai. Elles sont enumerees pour que le verrou sache
// qu elles sont dehors par decision et non par oubli.
// ============================================================

export type NoeudFlux = {
  id: string;
  /** Les moteurs dont ce moteur consomme la sortie. */
  consomme: string[];
  /**
   * Le nom de la fonction appelee dans la route. Le verrou s en sert
   * pour retrouver le site d appel : sans lui, il faudrait deviner la
   * correspondance entre un id de noeud et un identifiant JavaScript.
   */
  appel: string;
  /**
   * Vrai quand les entrees de ce moteur ne sont pas lisibles dans la
   * route. Son noeud se dessine alors sans fil entrant et la toile dit
   * pourquoi, plutot que de lui en inventer un.
   */
  entreesNonEtablies?: boolean;
};

/**
 * Les identifiants qui circulent dans la route sans etre des sorties de
 * moteurs. Le verrou les ignore explicitement : sans cette liste il
 * ferait echouer sur `measure` ou `analysisId`, et on prendrait
 * l habitude de le desarmer.
 */
export const ENTREES_HORS_CHAINE: readonly string[] = [
  'sectoralContext', 'relevanceMatrix', 'rawSummary', 'rawPitchText',
  'pitchText', 'narrativeDriftPitchText', 'fundNote', 'fundDimensionalNotes',
  'measure', 'analysisId', 'runOptions', 'mechanicalScore', 'conflictOfInterest',
  'assetClass', 'orchestrateMeasure', 'marketAnalysis', 'financialData',
  'patternMatching', 'causalReversal', 'blindspotAnalysis', 'contrarianAnalysis',
  'narrativeDrift', 'fragiliteStructurelle', 'benchmarks',
  // Ni des moteurs ni des sorties de moteurs : une reserve de validite,
  // un score mecanique agrege, une ancre temporelle et son origine.
  'operationValidity', 'mechanicalScore', 'asOf', 'asOfSource',
  'referenceYear', 'refYearResolution', 'operationType', 'operationComponents',
  'teamScore', 'marketScore',
] as const;

/**
 * La correspondance entre un identifiant de la route et le moteur qui
 * l a produit. Le nommage serveur n a pas suivi une convention unique :
 * `financialData` est la sortie de `financial-extraction`,
 * `patternMatching` celle de `pattern`.
 */
export const IDENTIFIANT_VERS_MOTEUR: Record<string, string> = {
  extraction: 'extraction',
  team: 'team',
  market: 'market',
  marketAnalysis: 'market',
  macro: 'macro',
  financialData: 'financial-extraction',
  benchmarks: 'benchmarks',
  pattern: 'pattern',
  patternMatching: 'pattern',
  blindspot: 'blindspot',
  blindspotAnalysis: 'blindspot',
  contrarian: 'contrarian',
  contrarianAnalysis: 'contrarian',
  causal: 'causal',
  causalReversal: 'causal',
  narrativeDrift: 'narrative-drift',
  fragiliteStructurelle: 'fragility-structurelle',
  financialCoherence: 'financial-coherence',
  saasMetrics: 'saas-metrics',
  industrialMetrics: 'industrial-metrics',
  valuation: 'valuation',
  indicators: 'indicators',
};

/**
 * LE GRAPHE DE FLUX, LU DANS LA ROUTE LE 8 AOUT 2026.
 *
 * `extraction` est la racine et elle alimente presque tout : c est le
 * fait que la toile doit montrer. Prelude ne pose pas vingt-deux
 * questions independantes, il lit un document puis chaque moteur
 * travaille sur ce que les precedents ont etabli.
 */
export const GRAPHE_FLUX: NoeudFlux[] = [
  { id: 'extraction', consomme: [], appel: 'extractFromDeck' },

  // Premiere couche : tout part de la lecture du document.
  { id: 'team', consomme: ['extraction'], appel: 'analyzeTeam' },
  { id: 'market', consomme: ['extraction'], appel: 'analyzeMarket' },
  { id: 'macro', consomme: ['extraction'], appel: 'analyzeMacro' },
  { id: 'financial-extraction', consomme: ['extraction'], appel: 'extractFinancialData' },

  // Les deux moteurs de metriques sont actives par la matrice de
  // pertinence et leur appel n est pas lisible depuis la route : leurs
  // entrees restent non etablies plutot que supposees.
  // LES DEUX SEULS MOTEURS SANS FIL ENTRANT, ET C EST UNE ARCHITECTURE
  // ET NON UN DEFAUT. Ils sont actives par la matrice de pertinence et
  // leur appel n est pas lisible depuis la route : ils lisent le dossier
  // plutot que les sorties des precedents. Deux moteurs dans ce cas est
  // un fait vrai du produit ; cinq etait une supposition, `valuation` et
  // `indicators` etant au contraire parmi les plus connectes.
  { id: 'saas-metrics', consomme: [], appel: '', entreesNonEtablies: true },
  { id: 'industrial-metrics', consomme: [], appel: '', entreesNonEtablies: true },

  { id: 'benchmarks', consomme: ['extraction', 'financial-extraction'], appel: 'analyzeBenchmarks' },

  // Deuxieme couche : chaque moteur raisonne sur ce que la premiere a
  // etabli, et non sur le document seul.
  { id: 'pattern', consomme: ['extraction', 'team', 'market', 'macro'], appel: 'matchPatterns' },
  { id: 'blindspot', consomme: ['extraction', 'team', 'market', 'macro'], appel: 'analyzeBlindspots' },
  { id: 'contrarian', consomme: ['extraction', 'team', 'market', 'macro'], appel: 'analyzeContrarian' },
  {
    id: 'financial-coherence',
    consomme: ['extraction', 'financial-extraction', 'market', 'benchmarks'],
    appel: 'analyzeFinancialCoherence',
  },
  { id: 'tech-claim', consomme: ['extraction', 'financial-extraction'], appel: 'analyzeTechClaimCoherence' },
  { id: 'execution-friction', consomme: ['extraction', 'financial-extraction'], appel: 'analyzeExecutionFriction' },
  { id: 'narrative-drift', consomme: ['extraction'], appel: 'analyzeNarrativeDrift' },
  {
    id: 'fragility-structurelle',
    consomme: ['extraction', 'financial-extraction', 'market'],
    appel: 'analyzeFragiliteStructurelle',
  },

  // Troisieme couche : le raisonnement se referme sur lui-meme.
  { id: 'causal', consomme: ['extraction', 'team', 'market', 'macro', 'pattern'], appel: 'performCausalReversal' },
  { id: 'reference-checks', consomme: ['extraction', 'team', 'blindspot', 'causal'], appel: 'generateReferenceChecks' },
  {
    id: 'orchestrate',
    consomme: [
      'extraction', 'team', 'market', 'macro', 'pattern', 'causal',
      'blindspot', 'contrarian', 'narrative-drift', 'fragility-structurelle',
    ],
    appel: 'orchestrateFinalRecommendation',
  },

  // ------------------------------------------------------------
  // LES DEUX MOTEURS DETERMINISTES, ET C EST UN ARGUMENT DE PRODUIT
  // ------------------------------------------------------------
  // `valuation` et `indicators` sont les moteurs les plus connectes du
  // graphe apres l orchestrateur : le premier consomme six sorties, le
  // second cinq. Et ils n appellent pas le modele, ils calculent.
  //
  // Le chiffre le plus visible de la note est donc calcule et non
  // genere, sur des sorties que la chaine a etablies. C est ce qui
  // separe Prelude d un prompt long, et cela se voit sur la toile :
  // deux noeuds a forte convergence, en fin de chaine, qui ne portent
  // aucune duree d appel puisqu il n y en a pas.
  //
  // La supposition inverse avait ete faite, qu ils lisaient le document
  // sans rien recevoir. La lecture des appels dit l exact contraire, et
  // le fait qu elle rend est meilleur que celui qu on lui pretait.
  {
    id: 'valuation',
    consomme: ['extraction', 'financial-coherence', 'financial-extraction', 'team', 'market'],
    appel: 'computeValuation',
  },
  {
    id: 'indicators',
    consomme: [
      'extraction', 'financial-coherence', 'financial-extraction',
      'saas-metrics', 'industrial-metrics',
    ],
    appel: 'computeIndicators',
  },
];

/**
 * LE PRE-SCAN RESTE HORS DU GRAPHE, ET CE N EST PAS UN OUBLI.
 *
 * Il tourne avant l extraction et lit le document, mais il n est pas un
 * maillon de la chaine : il est la porte qui decide si la chaine se
 * lance. Un dossier qu il ecarte ne produit aucun des noeuds ci-dessus,
 * ce qui est un etat de la toile entiere et non l etat d un noeud.
 *
 * Le dessiner en amont d `extraction` ferait croire qu il alimente le
 * raisonnement, alors qu il l autorise. Deux relations differentes, et
 * c est la meme raison qui tient la cascade hors de cette declaration.
 */
export const HORS_CHAINE_PAR_NATURE: readonly string[] = ['prescan'] as const;

/** Les aretes du flux, derivees de la declaration. */
export function aretesDuFlux(): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  for (const n of GRAPHE_FLUX) for (const d of n.consomme) out.push({ from: d, to: n.id });
  return out;
}

/**
 * Extrait le texte des arguments d un appel, parentheses equilibrees.
 * Rend null quand l appel ne figure pas dans la source, ce qui est un
 * echec du verrou et non un resultat.
 */
export function argumentsDeLAppel(source: string, nomFonction: string): string | null {
  // L APPEL SE CHERCHE AVEC ET SANS `await`. Quatre moteurs de la
  // premiere couche sont lances en promesses et resolus plus loin :
  // `analyzeMarket`, `analyzeMacro`, `extractFinancialData`,
  // `analyzeTeam`. Une recherche qui exigeait `await` les declarait
  // introuvables, ce qui aurait pousse a les sortir du verrou plutot
  // qu a elargir la recherche.
  const marqueur = `${nomFonction}(`;
  const debut = source.indexOf(marqueur);
  if (debut < 0) return null;
  let i = debut + marqueur.length;
  let profondeur = 1;
  const from = i;
  while (i < source.length && profondeur > 0) {
    const c = source[i];
    if (c === '(') profondeur += 1;
    else if (c === ')') profondeur -= 1;
    i += 1;
  }
  return profondeur === 0 ? source.slice(from, i - 1) : null;
}

/**
 * Les moteurs qu un texte d arguments consomme reellement.
 *
 * On retient les identifiants en position de valeur, ce qui couvre les
 * deux formes que la route emploie, la liste positionnelle et l objet
 * nomme. Les commentaires sont retires d abord : la route en porte
 * beaucoup, et un nom de moteur cite dans une phrase ferait croire a une
 * dependance qui n existe pas.
 */
export function moteursConsommes(texteArguments: string): string[] {
  const sansCommentaires = texteArguments
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');
  const trouves = new Set<string>();
  for (const [identifiant, moteur] of Object.entries(IDENTIFIANT_VERS_MOTEUR)) {
    // L identifiant doit apparaitre comme valeur : seul, ou apres `:`,
    // jamais comme nom de clef d un objet litteral, sans quoi
    // `financialData: financialData ?? null` compterait deux fois et
    // `marketAnalysis: market` compterait `marketAnalysis`.
    const re = new RegExp(`(^|[,({\\s])${identifiant}(\\s*[,)\\s?]|$)|:\\s*${identifiant}\\b`, 'm');
    if (re.test(sansCommentaires)) trouves.add(moteur);
  }
  return Array.from(trouves).sort();
}
