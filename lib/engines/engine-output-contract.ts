// ============================================================
// CONTRAT DE SORTIE D UN MOTEUR - evalue au moment de l appel
// ------------------------------------------------------------
// Doctrine du brief 21 : un moteur n a abouti que s il a produit ce
// que son contrat exige. Un parse syntaxiquement valide ne prouve
// rien. Une reparation silencieuse qui rend un objet vide est une
// fabrication, pas une degradation.
//
// Le contrat minimal existait deja, mais il n etait consulte qu en
// audit, a la finalisation de la route, une fois le run termine et
// tous les moteurs aval servis. Il constatait le vide sans jamais
// pouvoir l empecher. Le run 4e30c644 en donne le cas de reference :
// team rend 7763 tokens sous un plafond de 8000, donc sans troncature
// de fenetre, mais le JSON casse sur une apostrophe et la voie de
// recuperation rend { "0": "web : Elle Cote d", "1": "Ivoire",
// realData: [...] }. Trois cles au lieu de quinze, aucune des trois
// exigees par le contrat, et pourtant un statut ok jusqu a la
// finalisation. Cinq moteurs aval ont consomme cette enveloppe comme
// une analyse d equipe aboutie.
//
// Ce module deplace le contrat de l audit vers le site d appel. Un
// objet qui echoue son contrat leve, le moteur declare son echec par
// le canal normal, et la cascade de dependances joue comme pour
// n importe quel autre echec.
//
// Il vit a part de anthropic-client parce que le contrat est une
// notion d orchestration, pas de transport : le client parle a
// Anthropic, il n a pas a savoir ce qu un moteur doit produire.
// ============================================================

import { parseJSON } from './anthropic-client';
import type { ParseMode } from './engine-budget';
import {
  passesMinimalContract,
  isSkippedByRelevanceMatrix,
} from '../orchestrator/engine-status-recorder';

/**
 * Modes de parse qui rendent fidelement ce que le modele a ecrit.
 *
 * direct : JSON.parse sur le texte nu. extracted : le JSON etait
 * enrobe de prose, on l a isole sans le modifier. Ces deux voies ne
 * touchent pas a la structure.
 *
 * recovered et repaired sont des reconstructions : fermetures
 * synthetiques, jsonrepair. Elles rendent un objet valide qui n est
 * pas celui que le modele a ecrit. Le mode est trace pour que le
 * releve le porte, mais il ne decide rien a lui seul : c est le
 * contrat qui juge, pas la voie de parse. Une reconstruction complete
 * reste recevable, un parse direct sur une enveloppe vide ne l est
 * pas.
 */
export const PARSE_MODES_FIDELES: readonly ParseMode[] = ['direct', 'extracted'];

export function isParseFidele(mode: ParseMode | undefined): boolean {
  return mode !== undefined && PARSE_MODES_FIDELES.includes(mode);
}

/** Sortie de parse rendue a l appelant : la valeur et la voie qui l a
 *  produite. Le mode cesse d etre un effet de bord depose dans un
 *  puits de mesure optionnel, il fait partie du resultat. */
export interface ParsedOutput<T> {
  value: T;
  parseMode: ParseMode;
}

/**
 * Parse et rend le mode a l appelant. Enveloppe parseJSON, qui
 * continue de deposer le mode dans le puits de mesure quand il y en a
 * un : les deux canaux disent la meme chose, celui-ci est celui qu on
 * peut lire sans instrumentation.
 */
export function parseJSONWithMode<T = any>(
  rawText: string,
  trace?: { parseMode?: ParseMode },
): ParsedOutput<T> {
  const sink: { parseMode?: ParseMode } = trace ?? {};
  const value = parseJSON<T>(rawText, sink);
  // parseJSON pose toujours le mode sur la voie qui rend une valeur.
  // Le defaut couvre un appelant qui aurait passe un puits gele.
  return { value, parseMode: sink.parseMode ?? 'direct' };
}

/**
 * Echec de contrat : le moteur a repondu, le JSON a ete lu, et le
 * sortant ne porte pas ce que son contrat exige.
 *
 * Porte le mode de parse et les cles reellement rendues parce que la
 * difference entre les deux diagnostics tient a ces deux champs. Un
 * echec en parse recovered avec trois cles est une sortie cassee au
 * transport. Un echec en parse direct avec quinze cles est un prompt
 * qui ne demande pas les bons champs. Le message doit permettre de
 * trancher sans rejouer le run.
 */
export class EngineContractError extends Error {
  readonly engine: string;
  readonly parseMode: ParseMode;
  readonly keys: string[];
  readonly attempts: number;

  constructor(engine: string, parseMode: ParseMode, value: any, attempts: number) {
    const keys = value && typeof value === 'object' && !Array.isArray(value)
      ? Object.keys(value)
      : [];
    super(
      `[${engine}] contrat minimal non satisfait apres ${attempts} tentative(s). `
      + `Mode de parse ${parseMode}, ${keys.length} cle(s) rendue(s)`
      + (keys.length > 0 ? ` : ${keys.slice(0, 12).join(', ')}` : '')
      + '.',
    );
    this.name = 'EngineContractError';
    this.engine = engine;
    this.parseMode = parseMode;
    this.keys = keys;
    this.attempts = attempts;
  }
}

export interface ParseEngineOutputOptions {
  /**
   * Nombre de reprises accordees a un echec de contrat, hors premiere
   * tentative. Zero par defaut, et le defaut n est pas un oubli : une
   * reprise coute une seconde fenetre LLM complete, que la deadline
   * externe du moteur ne peut pas toujours heberger. Le site d appel
   * tranche, comme pour le budget de recherche web.
   *
   * La reprise ne vaut que contre un echec de contrat. Une erreur
   * reseau ou un timeout SDK remonte sans etre rejouee ici : ces
   * reprises-la appartiennent au client et a sa fenetre.
   */
  contractRetries?: number;
  /**
   * True quand le contrat du moteur decrit sa sortie ASSEMBLEE et non
   * la sortie brute du modele. Le contrat n est alors pas verifie ici :
   * le moteur appelle verifierContrat sur son resultat final.
   *
   * Ce n est pas un affaiblissement du contrat mais un deplacement de
   * son point d evaluation. Un predicat qui accepterait les deux formes
   * serait un contournement : il rendrait le contrat vrai en le rendant
   * plus faible, et cesserait de refuser ce qu il doit refuser.
   */
  contratApresRecombinaison?: boolean;
  /**
   * Puits de tracabilite du parse, typiquement le LlmMeasure du
   * moteur. Le mode de la derniere tentative y est depose comme
   * avant, pour que pipeline_engines_status continue de porter
   * parseMode sans que le site d appel ait a s en occuper.
   */
  trace?: { parseMode?: ParseMode };
  /** Notifie une reprise, pour journalisation cote moteur. */
  onRetry?: (attempt: number, err: EngineContractError) => void;
}

/**
 * Point de passage unique : produit le texte, le parse, evalue le
 * contrat du moteur, et leve si le contrat tombe.
 *
 * `produce` porte l appel LLM et sa mesure. Le passer en thunk plutot
 * qu en texte deja obtenu est ce qui rend la reprise possible au bon
 * niveau : on rejoue l appel, pas le parse d une reponse qu on sait
 * deja mauvaise.
 *
 * `engine` est la cle du releve, celle de MINIMAL_CONTRACTS et de
 * pipeline_engines_status, pas le libelle affiche. Un moteur absent de
 * la table tombe sur le contrat generique, non-null et non-vide.
 */
/**
 * Verifie le contrat minimal d un moteur sur une sortie donnee et leve
 * si elle ne le satisfait pas. Destine aux moteurs qui recombinent et
 * verifient donc leur sortie assemblee, apres l appel.
 */
export function verifierContrat<T>(engine: string, value: T): T {
  if (passesMinimalContract(engine, value)) return value;
  throw new EngineContractError(engine, 'direct', value, 1);
}

export async function parseEngineOutput<T = any>(
  engine: string,
  produce: (attempt: number) => Promise<string>,
  options: ParseEngineOutputOptions = {},
): Promise<T> {
  const retries = Math.max(0, options.contractRetries ?? 0);
  let last: EngineContractError | null = null;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const raw = await produce(attempt);
    const { value, parseMode } = parseJSONWithMode<T>(raw, options.trace);

    // Certains moteurs recombinent : leur contrat decrit la sortie
    // assemblee et non la sortie brute du modele. Le vérifier ici
    // reviendrait a exiger du modele des champs que le code produit
    // apres lui. Ces moteurs declarent `contratApresRecombinaison` et
    // appellent verifierContrat eux-memes sur leur sortie finale.
    //
    // Le defaut ferme : financialCoherence exigeait `archetype` et
    // `globalCoherenceScore`, tous deux calcules par le code apres
    // l appel, et `tests` sous forme de tableau la ou le type declare
    // un Record. Le contrat echouait donc a chaque run depuis qu il
    // existait, sur six dossiers du corpus, et le releve le comptait
    // comme un echec de moteur.
    if (options.contratApresRecombinaison) return value;

    if (passesMinimalContract(engine, value)) return value;

    last = new EngineContractError(engine, parseMode, value, attempt);
    // Trace serveur systematique : un contrat qui tombe est un
    // evenement de production, pas un detail de parse. Il doit se voir
    // dans les logs Vercel meme quand une reprise le rattrape.
    console.warn(`[engine-contract] ${last.message}`);
    if (attempt <= retries) options.onRetry?.(attempt, last);
  }

  throw last;
}

// ============================================================
// GARDE COTE CONSOMMATEUR
// ------------------------------------------------------------
// Aucun moteur en aval ne doit consommer une sortie qui n a pas
// satisfait son contrat minimal. Le point precedent fait declarer son
// echec au producteur ; celui-ci fait refuser l entree au
// consommateur. Les deux ne font pas double emploi.
//
// Un producteur peut etre declare non conclusif par le releve sans que
// sa promesse propre ait rejete : le wrapper deadline resout null pour
// ses appelants quand la fenetre tombe, mais la promesse du moteur,
// elle, reste pendante et peut aboutir plus tard sur une sortie que
// personne n a plus le droit d utiliser. Un moteur non converti au
// point de passage peut aussi rendre une enveloppe vide sans lever. La
// garde de consommation ferme ces deux portes par la meme regle, au
// lieu de les traiter cas par cas.
//
// Une sortie ecartee par la matrice de pertinence passe : le moteur
// n a pas echoue, il n avait pas lieu de tourner, et ses consommateurs
// savent lire cette convention.
// ============================================================

/**
 * Rend la sortie du moteur amont si elle satisfait son contrat, rejette
 * sinon. L erreur porte la cle du moteur fautif, ce qui permet au
 * releve de nommer la dependance dans le statut du consommateur plutot
 * que de constater un echec sans source.
 */
export async function requireConformingOutput<T>(
  engine: string,
  source: Promise<T>,
): Promise<T> {
  const value = await source;
  if (isSkippedByRelevanceMatrix(value)) return value;
  if (passesMinimalContract(engine, value)) return value;
  const err = new EngineContractError(engine, 'direct', value, 1);
  console.warn(`[engine-contract] sortie amont refusee a ses consommateurs : ${err.message}`);
  throw err;
}
