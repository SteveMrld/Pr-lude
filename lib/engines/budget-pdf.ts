// ============================================================
// ADMISSIBILITE D UN DOCUMENT SUR LE CHEMIN PDF
// ------------------------------------------------------------
// Decide si un PDF peut traverser le pipeline, et rend la raison quand il
// ne le peut pas. Aucun seuil de ce module n est pose au jugement : chacun
// descend soit d une limite publiee de l API, soit d une valeur lue dans le
// code, soit d une mesure.
//
// LES QUATRE TERMES, ET D OU CHACUN VIENT
//
//   fenetre d entree   lue en direct sur GET /v1/models/<id>, champ
//                      max_input_tokens. Elle ne se recopie pas depuis une
//                      table : une constante qui ne se derive pas de ce
//                      qu elle decrit cesse d etre vraie sans le dire.
//   reserve de sortie  le max_tokens que le site d appel demande. Declaree
//                      ici et verrouillee par un test qui relit les sites
//                      reels, faute de quoi la copie divergerait.
//   enveloppe de prompt  mesuree par count_tokens sur le fichier source
//                      entier du moteur, ce qui majore strictement ses
//                      prompts.
//   plafond de pages   100 pour un modele a fenetre de 200k, 600 au-dela.
//                      C est une limite de l API, et elle est appliquee par
//                      l API : inutile de compter les pages nous-memes.
//
// CE QUE LA MESURE DU 6 AOUT 2026 A ETABLI, ET CE QU ELLE NE BORNE PAS
//
// Le memorandum Woodpecker, 12 943 232 octets, rend 236 457 tokens sur
// claude-sonnet-4-6 et se fait refuser par claude-haiku-4-5 avec le message
// « A maximum of 100 PDF pages may be provided ». Le facteur base64 mesure
// vaut 1,3333, conforme a la definition.
//
// Ce point etablit deux choses et une seule autre. Il etablit que le
// plafond de pages du modele rapide est atteint par un dossier reel, et il
// etablit que 236 457 tokens passent sur le modele principal. Il ne borne
// pas le plafond du modele principal : savoir qu un tirage passe ne dit
// rien de l endroit ou l on tombe. Ce plafond-la se calcule, il ne se
// mesure pas.
//
// LA CONSEQUENCE QUI COMPTE POUR UNE DEMONSTRATION
//
// Le pre-scan envoie le PDF a FAST_MODEL, dont la fenetre est de 200 000
// tokens, donc dont le plafond est de 100 pages. Tout document de plus de
// cent pages est refuse par lui, quel que soit son poids en tokens. Un
// prospectus d introduction en compte plusieurs centaines. Ce refus ne tue
// pas le run, le moteur se declare hors d etat plutot que de lever, mais il
// se sait avant de depenser plutot qu apres.
// ============================================================

import { MODEL, FAST_MODEL } from './anthropic-client';

/**
 * Taille maximale d une requete a l API, en octets. Limite publiee.
 * Le PDF voyage en base64 dans le corps, donc c est bien cette limite qui
 * s applique et non la taille du fichier.
 */
export const PLAFOND_REQUETE_OCTETS = 32 * 1024 * 1024;

/**
 * Facteur d inflation du base64, exact par definition : quatre caracteres
 * pour trois octets. Mesure a 1,3333 sur le PDF Woodpecker, ce qui le
 * confirme plutot que de l etablir.
 */
export const FACTEUR_BASE64 = 4 / 3;

/**
 * Plafond de pages d un PDF, selon la fenetre du modele qui le recoit.
 * Limite publiee de l API, appliquee par l API.
 */
export const PLAFOND_PAGES_FENETRE_COURTE = 100;
export const PLAFOND_PAGES_FENETRE_LONGUE = 600;
/** Au-dessous de ce seuil de fenetre, le plafond court s applique. */
export const SEUIL_FENETRE_LONGUE = 200_001;

export function plafondDePages(fenetreEntree: number): number {
  return fenetreEntree >= SEUIL_FENETRE_LONGUE
    ? PLAFOND_PAGES_FENETRE_LONGUE
    : PLAFOND_PAGES_FENETRE_COURTE;
}

/**
 * Un appel du pipeline qui porte le PDF.
 *
 * `reserveSortie` est le max_tokens que le site demande, et `enveloppe` le
 * majorant mesure de ses prompts. Les deux sont declares ici et non lus
 * dans le code, parce que les sites les passent en litteral positionnel.
 * `budget-pdf.test.ts` relit les sites reels et rougit le jour ou l un
 * depasse ce qui est declare : c est la garde qui empeche cette liste de
 * devenir une copie qui vieillit.
 */
export interface AppelPorteurDePdf {
  moteur: string;
  fichier: string;
  model: string;
  reserveSortie: number;
  /** Majorant mesure par count_tokens sur le fichier source entier. */
  enveloppeTokens: number;
}

/**
 * Les six sites qui appellent callClaudeWithPDF, releves le 6 aout 2026.
 *
 * Perimetre declare : la liste porte le modele, la reserve de sortie et
 * l enveloppe de prompt de chaque site. Elle ne porte ni la temperature ni
 * la fenetre de reprise, qui n entrent pas dans l admissibilite d un
 * document. Une garde qui parcourt une liste declare ce qu elle verifie et
 * surtout ce qu elle ne verifie pas.
 */
export const APPELS_PORTEURS_DE_PDF: AppelPorteurDePdf[] = [
  { moteur: 'preScan', fichier: 'lib/engines/prescan-engine.ts', model: FAST_MODEL, reserveSortie: 2500, enveloppeTokens: 8397 },
  { moteur: 'extraction', fichier: 'lib/engines/extraction-engine.ts', model: MODEL, reserveSortie: 6000, enveloppeTokens: 5665 },
  { moteur: 'financialExtraction', fichier: 'lib/engines/financial-extraction-engine.ts', model: MODEL, reserveSortie: 8000, enveloppeTokens: 5311 },
  { moteur: 'saasMetrics', fichier: 'lib/engines/saas-metrics-engine.ts', model: MODEL, reserveSortie: 2500, enveloppeTokens: 8402 },
  { moteur: 'industrialMetrics', fichier: 'lib/engines/industrial-metrics-engine.ts', model: MODEL, reserveSortie: 2500, enveloppeTokens: 4890 },
  { moteur: 'ddContractual', fichier: 'lib/engines/dd-contractual-engine.ts', model: MODEL, reserveSortie: 4500, enveloppeTokens: 9695 },
];

/**
 * Plafond de tokens d un appel : ce que sa fenetre laisse au document une
 * fois retiree sa reserve de sortie et son enveloppe de prompt.
 */
export function plafondTokensDeLAppel(appel: AppelPorteurDePdf, fenetreEntree: number): number {
  return fenetreEntree - appel.reserveSortie - appel.enveloppeTokens;
}

export type MotifDeRefus =
  | 'requete-trop-grosse'
  | 'trop-de-tokens'
  | 'refuse-par-l-api'
  | 'fenetre-inconnue';

export interface VerdictDAppel {
  moteur: string;
  model: string;
  bloquant: boolean;
  admis: boolean;
  motif: MotifDeRefus | null;
  detail: string;
  plafondTokens: number | null;
  tokensDocument: number | null;
}

/**
 * Un appel est bloquant quand son echec empeche la note d exister. Le
 * pre-scan ne l est pas : il se declare hors d etat plutot que de lever, et
 * le pipeline continue sans lui. Les cinq autres portent l extraction, donc
 * leur refus vide la note.
 *
 * Cette distinction est un arbitrage et non un inventaire : elle se decide,
 * donc elle se declare et se date plutot que de se deduire d une propriete.
 */
export function estBloquant(appel: AppelPorteurDePdf): boolean {
  return appel.moteur !== 'preScan';
}

/**
 * Taille en base64 d un fichier de n octets. Exacte, pas approchee.
 */
export function octetsEnBase64(octets: number): number {
  return Math.ceil(octets / 3) * 4;
}

/**
 * La requete tient-elle sous le plafond. Le corps porte le base64 plus les
 * prompts ; ces derniers ne sont pas mesures en octets ici, donc la reponse
 * est un majorant de ce qui passe et non une certitude de passage.
 */
export function requeteTientDansLePlafond(octetsFichier: number): boolean {
  return octetsEnBase64(octetsFichier) <= PLAFOND_REQUETE_OCTETS;
}

/**
 * Taille de fichier au-dela de laquelle le base64 seul depasse le plafond.
 * Derivee, jamais ecrite : c est le plafond divise par le facteur.
 */
export function plafondFichierOctets(): number {
  return Math.floor(PLAFOND_REQUETE_OCTETS / FACTEUR_BASE64);
}
