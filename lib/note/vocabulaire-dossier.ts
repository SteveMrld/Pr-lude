// ============================================================
// LE VOCABULAIRE D UN DOSSIER DANS UNE LISTE
// ------------------------------------------------------------
// Ce que l accueil et l historique donnent a lire d un dossier tient en
// deux grandeurs, l etat de son instruction et son verdict. Les deux
// etaient transcrits a la main dans quatre tables distinctes, et les
// quatre divergeaient du producteur.
//
// LE RELEVE DU 8 AOUT 2026, sur les trente-neuf dossiers qu un partner
// voit. La table de couleurs de l historique connaissait quatre clefs
// dont `investir-conditions`, orthographe qui n existe nulle part en
// production : le type `Verdict` du calculateur de score ecrit `investir
// avec conditions`, avec des espaces, depuis toujours. Vingt-trois
// lignes sur trente-neuf tombaient donc dans le gris des inconnus, dont
// les douze qui portent un oui conditionnel.
//
// Sur l accueil c etait pire, parce que la classe CSS se fabriquait en
// interpolant le verdict brut. Une valeur qui porte des espaces se
// decoupe en plusieurs classes : `investir avec conditions` devenait
// `verdict-investir`, `avec`, `conditions`, et `.verdict-investir`
// existe. Releve du style calcule sur la page vivante : `investir avec
// conditions` et `investir` rendaient la meme encre et le meme fond, au
// pixel. Un oui conditionnel se peignait comme un oui franc, ce qui est
// la seule direction ou l erreur coute quelque chose.
//
// L ETAT, ET POURQUOI LE TYPE NE SUFFISAIT PAS. `AnalysisStatus`
// declarait quatre valeurs quand le code en ecrit six. Deux manquaient,
// `completed_with_gaps` et `knockout`, et la fonction qui rend la
// pastille de l historique enumerait quatre cas et retournait null sur
// le reste. Un dossier ecarte au pre-scan ne recevait donc aucune
// pastille, et tombait dans le meme silence que les dossiers anterieurs
// a la brique 3 pour lesquels le silence est voulu : huit lignes sur
// trente-neuf ne portaient rien, six disant « on n a pas mesure » et
// deux disant « ce dossier a ete ecarte », qui est la position la plus
// forte que le produit sache prendre.
//
// LA FORME QUI FERME CELA. Les deux tables sont des `Record` indexes par
// une union, donc le compilateur exige un traitement pour chaque membre
// et refuse un membre ajoute sans le sien. C est ce qui manquait : la
// liste ecrite a la main ne rougissait pas quand le producteur bougeait.
//
// CE QU IL NE FAUT PAS EN ATTENDRE. Il ne requalifie pas les valeurs
// anciennes. Un verdict qu aucun producteur d aujourd hui n ecrit se
// rend tel quel, en neutre, et se declare inconnu : le champ existait
// sous un autre contrat et le silence de ce contrat n est pas une
// reponse.
// ============================================================

import type { Verdict } from '../engines/score-calculator';

// ------------------------------------------------------------
// L ETAT D UN DOSSIER
// ------------------------------------------------------------

/**
 * Les statuts que le code ecrit reellement dans `analyses.status`.
 *
 * `completed_with_gaps` est pose par le pipeline quand des moteurs ont
 * rendu une lacune, `knockout` par le refus du pre-scan. Les deux
 * manquaient au type, ce qui est la raison pour laquelle l interface a
 * pu en oublier un sans que rien ne le dise.
 */
export const STATUTS_DOSSIER = [
  'pending',
  'running',
  'completed',
  'completed_with_gaps',
  'knockout',
  'failed',
] as const;

export type StatutDossier = typeof STATUTS_DOSSIER[number];

/**
 * Les quatre etats qu un partner doit distinguer sans effort, plus
 * l ignorance, qui n en est pas un cinquieme mais son absence.
 *
 * `inconnu` existe parce qu un statut absent ou etranger ne doit pas
 * emprunter le vocabulaire d un etat mesure. Un repli qui tomberait sur
 * `abouti` mentirait dans le sens qui rassure, et sur `tombe` dans celui
 * qui accuse ; aucun des deux ne dit qu on ne sait pas.
 */
export type EtatDossier =
  | 'en-instruction'
  | 'abouti'
  | 'abouti-degrade'
  | 'ecarte-prescan'
  | 'tombe'
  | 'inconnu';

const ETAT_PAR_STATUT: Record<StatutDossier, EtatDossier> = {
  pending: 'en-instruction',
  running: 'en-instruction',
  completed: 'abouti',
  completed_with_gaps: 'abouti-degrade',
  knockout: 'ecarte-prescan',
  failed: 'tombe',
};

export function etatDuDossier(statut: string | null | undefined): EtatDossier {
  if (!statut) return 'inconnu';
  const e = ETAT_PAR_STATUT[statut as StatutDossier];
  return e || 'inconnu';
}

/**
 * Le ton porte le sens plutot que la couleur, parce que la palette vit
 * dans la feuille et que deux surfaces ne l appliquent pas pareil.
 */
export type TonDossier = 'neutre' | 'attente' | 'acquis' | 'reserve' | 'ecarte' | 'panne';

/**
 * La palette d un ton, en jetons de la feuille et non en valeurs.
 *
 * Elle vit ici parce que deux surfaces la lisent, l historique en styles
 * en ligne et l accueil en classes, et que deux transcriptions de la
 * meme intention divergent. Ce sont des jetons : la feuille garde la
 * decision de ce que vaut chaque couleur, le module ne decide que
 * lequel repond a quel sens.
 */
export type PaletteTon = { fond: string; encre: string; bordure: string };

/**
 * DEUX COULEURS, L ENCRE ET L OCRE, ET LA DISTINCTION SE FAIT PAR LE
 * REMPLISSAGE PLUTOT QUE PAR LA TEINTE.
 *
 * La premiere version employait quatre teintes, dont le rouge anglais du
 * refus et un `--positif` que la feuille definit a #2b2721, c est-a-dire
 * un gris chaud tres fonce qui n a de positif que son nom. Quatre teintes
 * dans une liste de trente lignes fabriquent un vitrail ou l oeil ne
 * hierarchise plus rien.
 *
 * L ocre est reserve a ce qui demande quelque chose au partner, et son
 * intensite dit combien : un aplat pour la position la plus engageante,
 * un lavis pour celle qui pose des conditions, un simple filet pour celle
 * qui demande du travail. Ce qui ne demande rien reste a l encre, et
 * c est le cas du refus, qui est une decision close et non une alarme.
 * Un refus peint en rouge reclame l attention qu il ne merite plus.
 */
export const PALETTE_TON: Record<TonDossier, PaletteTon> = {
  neutre: { fond: 'transparent', encre: 'var(--muted-soft)', bordure: 'var(--hairline)' },
  attente: { fond: 'transparent', encre: 'var(--accent)', bordure: 'var(--accent-mid)' },
  acquis: { fond: 'var(--accent)', encre: 'var(--paper)', bordure: 'var(--accent)' },
  reserve: { fond: 'var(--accent-soft)', encre: 'var(--accent)', bordure: 'var(--accent)' },
  // L ecartement est une decision et non une panne : il ne reclame rien,
  // donc il reste a l encre pale comme tout ce qui est clos.
  ecarte: { fond: 'transparent', encre: 'var(--muted-soft)', bordure: 'var(--hairline)' },
  panne: { fond: 'transparent', encre: 'var(--ink-soft)', bordure: 'var(--hairline)' },
};

/**
 * LA PALETTE DES ETATS N EMPLOIE QUE DEUX COULEURS, L ENCRE ET L OCRE.
 *
 * Elle est distincte de celle des verdicts, et cette separation est
 * l arbitrage plutot qu un detail d organisation. Un verdict est une
 * position d instruction et il a droit au rouge anglais que la palette
 * de l identite lui donne depuis l origine ; un etat de run n est pas
 * une position, c est un fait technique, et lui donner une teinte propre
 * ferait rentrer par la porte des etats la variete chromatique qu on
 * vient de retirer ailleurs.
 *
 * Les cinq etats se distinguent donc par deux canaux et non par cinq
 * teintes : un filet vertical en bord de ligne, dont la presence et la
 * densite portent l urgence, et un libelle dont seule l encre change.
 * L ocre est reserve a ce qui demande quelque chose au partner, un run
 * tombe ou une note en lacune ; ce qui est clos ou acquis reste a
 * l encre. Un dossier ecarte au pre-scan ne porte aucun filet, parce
 * qu il ne demande rien : son absence de filet est elle-meme le signal.
 */
export type PaletteEtat = { filet: string; encre: string; fond: string };

export const PALETTE_ETAT: Record<EtatDossier, PaletteEtat> = {
  'en-instruction': { filet: 'var(--muted-soft)', encre: 'var(--muted)', fond: 'transparent' },
  abouti: { filet: 'var(--hairline)', encre: 'var(--muted-soft)', fond: 'transparent' },
  'abouti-degrade': { filet: 'var(--accent-mid)', encre: 'var(--accent)', fond: 'transparent' },
  'ecarte-prescan': { filet: 'transparent', encre: 'var(--muted-soft)', fond: 'transparent' },
  tombe: { filet: 'var(--accent)', encre: 'var(--accent)', fond: 'transparent' },
  inconnu: { filet: 'transparent', encre: 'var(--muted-soft)', fond: 'transparent' },
};

export type PresentationEtat = {
  /** Ce que la pastille dit. Vide quand elle ne doit pas s afficher. */
  libelle: string;
  ton: TonDossier;
  /**
   * Une pastille se pose meme sur l etat neutre quand cet etat est une
   * decision. Seul `inconnu` se tait, parce que lui seul n a rien a
   * dire.
   */
  visible: boolean;
};

// LE LIBELLE DE L ETAT PARLE DU RUN, JAMAIS DU STADE D INSTRUCTION.
// La premiere ecriture disait « En instruction » pour un pipeline en
// cours, mots que l editeur de stade de la meme ligne emploie deja pour
// `in_review`. Deux grandeurs sans rapport, l avancement d un calcul et
// la position d un dossier dans le processus du fonds, se lisaient dans
// les memes termes a dix centimetres l une de l autre. La famille de
// libelles se rattache donc au pipeline, qui est ce dont la pastille
// parle.
export const PRESENTATION_ETAT: Record<EtatDossier, PresentationEtat> = {
  'en-instruction': { libelle: 'Pipeline en cours', ton: 'attente', visible: true },
  abouti: { libelle: 'Abouti', ton: 'acquis', visible: true },
  'abouti-degrade': { libelle: 'Abouti, moteurs en lacune', ton: 'reserve', visible: true },
  // LE CAS QUI A MOTIVE LE MODULE. Il ne se taisait pas par arbitrage,
  // il se taisait parce qu il tombait au bout d une liste de quatre.
  'ecarte-prescan': { libelle: 'Ecarte au pre-scan', ton: 'ecarte', visible: true },
  tombe: { libelle: 'Pipeline tombe', ton: 'panne', visible: true },
  inconnu: { libelle: '', ton: 'neutre', visible: false },
};

/**
 * Le libelle d etat, avec le compte des moteurs en lacune quand il est
 * mesure et non nul.
 *
 * Le compte ne se fabrique pas quand il vaut null : un moteur en lacune
 * dont on ignore le nombre et zero moteur en lacune sont deux choses, et
 * ecrire « 0 moteur » sur le premier serait affirmer une mesure absente.
 */
export function libelleEtat(etat: EtatDossier, moteursEnLacune: number | null): string {
  const base = PRESENTATION_ETAT[etat].libelle;
  if (etat !== 'abouti-degrade') return base;
  if (moteursEnLacune === null || moteursEnLacune === undefined || moteursEnLacune <= 0) {
    return 'Abouti · lacunes';
  }
  // Court, parce qu il se lit trente fois. « Abouti, 14 moteurs en
  // lacune » faisait vingt-huit caracteres en capitales a cote du nom du
  // dossier, ou il repoussait le verdict et concurrencait le nom
  // lui-meme. Le mot « moteurs » ne discrimine rien : rien d autre n est
  // compte en lacune dans cette ligne.
  return `Abouti · ${moteursEnLacune} lacune${moteursEnLacune > 1 ? 's' : ''}`;
}

// ------------------------------------------------------------
// LE VERDICT
// ------------------------------------------------------------

/**
 * Le troisieme etat du calcul mecanique. Il vaut `INSUFFICIENT_BASIS_
 * VERDICT` dans le calculateur de score ; la valeur est repetee ici et
 * le verrou compare les deux, parce qu importer le calculateur dans un
 * composant client y ferait entrer tout le moteur de score.
 */
export const VERDICT_SOCLE_INSUFFISANT = 'socle insuffisant';

/**
 * Ce que le pre-scan ecrit dans le champ verdict quand il ecarte. Ce
 * n est pas une position d instruction mais une recommandation de
 * pre-scan, et c est la raison pour laquelle le champ porte deux
 * vocabulaires : celui du calculateur et celui du pre-scan.
 */
export const VERDICT_ECARTE_PRESCAN = 'not_recommended';

export type VerdictAffichable =
  | Verdict
  | typeof VERDICT_SOCLE_INSUFFISANT
  | typeof VERDICT_ECARTE_PRESCAN;

export type PresentationVerdict = {
  libelle: string;
  ton: TonDossier;
  /** Vrai quand le verdict est une position d instruction. */
  positionDInstruction: boolean;
};

/**
 * Indexe par l union, donc exhaustif par construction sur les quatre
 * verdicts du calculateur : en ajouter un cinquieme au type fera echouer
 * la compilation ici, ce qui est exactement ce que la table ecrite a la
 * main ne faisait pas.
 */
export const PRESENTATION_VERDICT: Record<VerdictAffichable, PresentationVerdict> = {
  investir: { libelle: 'Investir', ton: 'acquis', positionDInstruction: true },
  'investir avec conditions': {
    libelle: 'Investir avec conditions',
    ton: 'reserve',
    positionDInstruction: true,
  },
  approfondir: { libelle: 'Approfondir', ton: 'attente', positionDInstruction: true },
  refuser: { libelle: 'Refuser', ton: 'panne', positionDInstruction: true },
  [VERDICT_SOCLE_INSUFFISANT]: {
    libelle: 'Socle insuffisant',
    ton: 'neutre',
    positionDInstruction: false,
  },
  [VERDICT_ECARTE_PRESCAN]: {
    libelle: 'Ecarte au pre-scan',
    ton: 'ecarte',
    positionDInstruction: false,
  },
};

/**
 * La presentation d un verdict, y compris quand il n en est pas un.
 *
 * Un verdict absent ou etranger se rend tel quel, en neutre, et se
 * declare inconnu. Il ne se traduit pas et ne se rapproche pas du plus
 * ressemblant : une valeur ecrite sous un contrat ancien n a pas la
 * precision qu on lui appliquerait aujourd hui, et deviner laquelle
 * serait la meme faute que fabriquer la valeur elle-meme.
 */
export function presenterVerdict(
  verdict: string | null | undefined,
): PresentationVerdict & { connu: boolean } {
  if (!verdict || !String(verdict).trim()) {
    return { libelle: 'Verdict absent', ton: 'neutre', positionDInstruction: false, connu: false };
  }
  const p = PRESENTATION_VERDICT[verdict as VerdictAffichable];
  if (p) return { ...p, connu: true };
  return { libelle: String(verdict), ton: 'neutre', positionDInstruction: false, connu: false };
}

/**
 * Le fragment de classe CSS d un verdict.
 *
 * IL NE SE FABRIQUE PLUS PAR INTERPOLATION DU VERDICT BRUT. Une valeur
 * qui porte un espace produit plusieurs classes, et le premier fragment
 * peut en atteindre une qui existe : c est ainsi que `investir avec
 * conditions` recevait le style de `investir`. Le fragment est donc
 * reduit a des lettres, des chiffres et des tirets, ce qui rend une
 * collision impossible par construction plutot que par vigilance.
 */
export function classeVerdict(verdict: string | null | undefined): string {
  const v = String(verdict || '').trim().toLowerCase();
  if (!v) return 'verdict-absent';
  const slug = v.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `verdict-${slug || 'absent'}`;
}

/** Le fragment de classe d un etat, par le meme mecanisme. */
export function classeEtat(etat: EtatDossier): string {
  return `etat-${etat}`;
}

// ------------------------------------------------------------
// LE NOM D UN DOSSIER QUAND L EXTRACTION N A PAS EU LIEU
// ------------------------------------------------------------

/**
 * Le libelle qu une ligne porte entre sa creation et l extraction du nom
 * de societe. Il vaut `LIBELLE_AVANT_EXTRACTION` dans le magasin
 * d analyses ; la valeur est repetee ici pour ne pas faire entrer le
 * magasin, et son client Supabase, dans le bundle du navigateur. Le
 * verrou compare les deux.
 */
export const LIBELLE_SANS_NOM = '(analyse en cours)';

/**
 * Ce qu une ligne affiche a la place du nom quand l extraction n a
 * jamais rendu.
 *
 * LE PLACEHOLDER SURVIT AUX RUNS QUI N ABOUTISSENT PAS, et il ment alors
 * dans la seule direction qui compte. Releve du 8 aout 2026 : huit lignes
 * sur trente-neuf portent « (analyse en cours) », dont six marquees
 * « pipeline tombe » et deux « ecarte au pre-scan ». Le nom disait donc
 * qu un calcul est en cours a dix centimetres d une pastille disant qu il
 * s est arrete, et un partner qui balaie sa liste lit le nom avant la
 * pastille.
 *
 * Le nom du fichier source prend sa place, parce qu il est renseigne sur
 * les trente-neuf lignes et qu il identifie le dossier pour celui qui l a
 * depose. Il n est pas le nom de la societe et la ligne ne pretend pas
 * qu il l est : elle le rend a l encre du nom mais le declare provisoire,
 * a charge de l appelant d en tirer ce qu il veut.
 */
export function nommerDossier(
  companyName: string | null | undefined,
  sourceFilename: string | null | undefined,
): { nom: string; provisoire: boolean } {
  const nom = String(companyName || '').trim();
  if (nom && nom !== LIBELLE_SANS_NOM) return { nom, provisoire: false };
  const fichier = String(sourceFilename || '').trim();
  if (fichier) {
    // L extension ne nomme rien et coute de la place sur une ligne dense.
    return { nom: fichier.replace(/\.[A-Za-z0-9]{1,5}$/, ''), provisoire: true };
  }
  // Sans nom ni fichier, il reste a le dire plutot qu a laisser un vide
  // que le lecteur prendrait pour un defaut d affichage.
  return { nom: 'Dossier sans nom', provisoire: true };
}
