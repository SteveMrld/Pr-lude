// Validateur post-LLM d assertions sensibles.
//
// Probleme adresse : sur le rapport UP&CHARGE, le LLM a ajoute dans les
// red flags des noms de cofondateurs absents du pitch ('Emmanuel
// Champenois', 'Neret'), invente des dates ('rejoint en 2021', 'aout
// 2024', 'novembre 2024'), et converti la devise en USD ('1.65M$')
// alors que le pitch est en EUR. Le tagging des sources (fix 4)
// demande au LLM d etre discipline mais ne le force pas.
//
// Ce module verifie mecaniquement, apres parsing du JSON LLM, que
// les noms propres / devises / annees citees dans les textes
// critiques (red flags, drivers, evidence) sont coherents avec les
// faits extraits du pitch. Les violations sont remontees comme des
// warnings structures, pas comme des erreurs bloquantes : on prefere
// un output partiellement valide avec audit qu un crash.

import type { ExtractionOutput } from './types';
import { aucunePageAtteinte } from '../instrumentation/source-capture';
// Deplacee dans son propre module : le moteur de valorisation en a
// besoin et passe par le bundle client, ou ce fichier ne peut pas
// entrer. Reexportee pour ne pas casser ses appelants.
import { detectPitchCurrency } from './devise-dossier';
export { detectPitchCurrency };

// =============================================================================
// LISTES DE NOMS AUTORISES
// =============================================================================

// Construit une liste de noms propres qui peuvent legitimement apparaitre
// dans les textes du rapport, en se basant sur ce que l extraction a
// reellement trouve dans le pitch. Inclut les fondateurs, board, clients,
// concurrents cites + une whitelist de noms generiques (institutions,
// pays, fonds connus) qui passent toujours.
//
// LA LISTE DE CHAMPS A ETE RETIREE, MESURE DU 5 AOUT 2026
//
// Cette fonction enumerait neuf endroits de l extraction : fondateurs,
// board, clients, concurrents, investisseurs, hub, pays, secteur,
// sous-secteur, nom de societe. C etait une liste ecrite a la main, donc
// une declaration sur ce que son auteur avait en tete un jour donne, et
// elle ne couvrait ni `rawSummary`, ni `productDescription`, ni
// `marketPitch`, ni `traction.metrics`, ni les revendications
// techniques. Tout nom documente par le dossier mais lu ailleurs que
// dans ces neuf champs ressortait donc signale comme non source.
//
// La mesure, par `scripts/mesure-faux-positifs-assertions.ts`, sur les
// cinquante-deux notes persistees : quatorze mille six cent trente-six
// alertes `unknown_name`, dont deux mille cinq cent quatre-vingt-quatre,
// soit dix-sept et demi pour cent, portent un nom que la liste corrigee
// reconnait, une fois les sigles deja retires en amont. Ce n est pas une
// appreciation : le dossier documentait le nom et le validateur
// l ignorait parce qu il regardait ailleurs.
//
// La propriete observable remplace la liste : est documente par le
// dossier tout ce que l extraction porte, ou qu il se trouve. Un champ
// ajoute demain a l extraction entre sans qu on y pense.
export function buildAllowedNames(extraction: ExtractionOutput): Set<string> {
  const allowed = new Set<string>();

  const add = (s: string) => {
    const t = s.trim();
    if (t.length === 0) return;
    // Le nom entier, pour les bigrammes, puis ses mots.
    allowed.add(t.toLowerCase());
    // Deux decoupages et non un. Sans le tiret, « series-A-early » ne
    // documente pas « series ». Avec le tiret seul, « Etats-Unis » lu
    // dans une phrase ne se reconstitue plus, puisque la coupe detruit
    // le compose. Les deux passes couvrent les deux cas, et la barre de
    // trois caracteres empeche les fragments.
    for (const p of t.split(/[\s,;()\/]+/)) {
      if (p.length >= 3) allowed.add(p.toLowerCase());
    }
    for (const p of t.split(/[\s,;()\/\-]+/)) {
      if (p.length >= 3) allowed.add(p.toLowerCase());
    }
  };

  const parcourir = (noeud: unknown): void => {
    if (typeof noeud === 'string') { add(noeud); return; }
    if (Array.isArray(noeud)) { for (const n of noeud) parcourir(n); return; }
    if (noeud && typeof noeud === 'object') {
      for (const v of Object.values(noeud as Record<string, unknown>)) parcourir(v);
    }
  };
  parcourir(extraction);

  return allowed;
}

// Whitelist de noms qu on accepte toujours sans matcher l extraction.
// Inclut institutions financieres et fonds VC standards, pays / regions,
// noms de comparables historiques courants utilises par le moteur
// pattern-matching, et figures publiques de reference.
const ALWAYS_ALLOWED_LOWER = new Set<string>([
  // Pays / regions
  'france', 'europe', 'allemagne', 'italie', 'espagne', 'royaume-uni',
  'angleterre', 'canada', 'usa', 'etats-unis', 'chine', 'japon', 'inde',
  'paris', 'lyon', 'marseille', 'londres', 'berlin', 'munich',
  'amsterdam', 'bruxelles', 'tel aviv', 'silicon valley', 'new york',
  'san francisco', 'boston', 'san diego',
  // UE et institutions
  'ue', 'eu', 'union europeenne', 'commission europeenne', 'parlement',
  'bce', 'ecb', 'fed', 'world bank', 'imf', 'fmi', 'oecd', 'ocde',
  // Fonds VC standards (exemples qui peuvent legitimement apparaitre
  // comme reference de marche meme s ils ne sont pas dans le pitch)
  'sequoia', 'a16z', 'andreessen horowitz', 'index ventures', 'partech',
  'eurazeo', 'idinvest', 'creandum', 'atomico', 'balderton',
  'accel partners', 'kleiner perkins', 'first round capital',
  'y combinator', 'techstars', 'founders fund', 'thrive capital',
  'menlo ventures', 'battery ventures', 'lightspeed', 'general catalyst',
  // Bpifrance et institutions FR
  'bpifrance', 'bpi france', 'bpi', 'caisse des depots', 'cdc',
  // Comparables historiques courants
  'doctolib', 'theranos', 'wework', 'stripe', 'airbnb', 'uber', 'tesla',
  'spacex', 'figma', 'notion', 'linear', 'shopify', 'snowflake',
  'datadog', 'mongodb', 'twilio', 'mistral', 'mistral ai', 'huggingface',
  'hugging face', 'openai', 'anthropic', 'deepseek', 'cohere',
  'backmarket', 'back market', 'blablacar', 'leboncoin', 'vinted',
  'venteprivee', 'vente-privee', 'alan', 'qonto', 'spendesk', 'payfit',
  'sendinblue', 'brevo', 'datadog', 'ovhcloud', 'klarna', 'spotify',
  'ynsect', 'cazoo', 'northvolt', 'volocopter', 'lilium',
  'quantum systems', 'pasqal', 'mirakl',
  // Tech generaux
  'github', 'openalex', 'wikipedia', 'arxiv', 'pubmed', 'pitchbook',
  'crunchbase', 'linkedin', 'google scholar',
  // Cadres / etudes
  'eisenmann', 'menlo', 'atomico soet', 'state of european tech',
  'pitchbook-nvca', 'bain', 'mckinsey', 'bcg', 'gartner', 'forrester',
  'idc', 'pwc', 'deloitte', 'kpmg', 'ey',
  // Reglementations / standards
  'rgpd', 'gdpr', 'csrd', 'ai act', 'mifid', 'basel', 'solvency',
  // Mots organisationnels neutres
  'series a', 'series b', 'series c', 'seed', 'pre-seed', 'arr', 'mrr',
  'capex', 'opex', 'tco', 'roi', 'ebitda', 'cac', 'ltv',
]);

// =============================================================================
// EXTRACTION DES NOMS PROPRES D UN TEXTE
// =============================================================================

// Heuristique simple : on cherche les sequences de 2-4 mots dont chaque
// mot commence par majuscule (sauf prepositions / determinants courts).
// Filtre les debuts de phrase (premier mot d une phrase capitalise mais
// pas un nom propre).
const STOPWORDS = new Set([
  'la', 'le', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux', 'et',
  'ou', 'mais', 'donc', 'or', 'ni', 'car', 'que', 'qui', 'quoi', 'dont',
  'a', 'à', 'en', 'pour', 'par', 'sur', 'sous', 'dans', 'avec', 'sans',
  'vers', 'chez', 'entre', 'pendant', 'avant', 'apres', 'depuis',
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'to',
  'from', 'as', 'if', 'and', 'or', 'but',
]);

export interface ProperNoun {
  text: string;
  textLower: string;
}

/**
 * True quand le mot est un sigle et non un nom propre.
 *
 * Deux a six caracteres, aucune minuscule, au moins une lettre. B2B,
 * LLM, TAM, SAM, CTO, CFO, PME, BFR, FCF, CRM, DTC, GDP, S1-S10. Le
 * releve du 5 aout 2026 sur le corpus persiste, par
 * `scripts/mesure-faux-positifs-assertions.ts`, en compte cinq mille
 * cent quatre-vingt-dix-sept signales comme noms propres non sources,
 * soit trente-cinq et demi pour cent des alertes de cette famille.
 *
 * Un sigle n est pas une affirmation sur le monde, c est du vocabulaire.
 * Reprocher a une note d ecrire « B2B » sans citer sa source est le
 * genre de bruit qui fait cesser de lire un controle, et un controle
 * qu on ne lit plus vaut moins qu un controle absent.
 *
 * La regle est de forme et non de vocabulaire, deliberement : une liste
 * de sigles autorises serait a rallonger a chaque secteur nouveau, et
 * elle vieillirait sans le dire. Les deux classes de lettres sont pour
 * la meme raison des categories Unicode et non des intervalles ASCII
 * etendus : « ŒUVRE » et « ÑANDÚ » ne sont pas des sigles, et un
 * intervalle ecrit a la main les y ferait entrer un jour.
 */
const UNE_MAJUSCULE = new RegExp('\\p{Lu}', 'u');
const UNE_MINUSCULE = new RegExp('\\p{Ll}', 'u');

export function estUnSigle(mot: string): boolean {
  const t = mot.trim();
  if (t.length < 2 || t.length > 6) return false;
  if (!UNE_MAJUSCULE.test(t)) return false;
  return !UNE_MINUSCULE.test(t);
}

/**
 * Le motif d un nom propre : une a quatre sequences commencant par une
 * majuscule.
 *
 * LA CLASSE DE LETTRES A ETE RETIREE, MESURE DU 5 AOUT 2026
 *
 * Elle valait `[A-ZÉÈÀÂÊÎÔÛÄËÏÖÜÇ]` puis `[\wÉèàâêîôûäëïöüç'-]`, deux
 * enumerations ecrites a la main. Elles omettaient « é », la lettre
 * accentuee la plus frequente du francais : « Nestlé » etait coupe a
 * « Nestl », et le validateur signalait comme nom propre non source une
 * chaine tronquee que la recherche dans le dossier ne pouvait plus
 * retrouver, puisque le dossier porte le nom entier. Le releve sur le
 * corpus persiste en compte trois cent quatre-vingts.
 *
 * Ajouter « é » aurait reconduit la nature de la liste. Les memes
 * enumerations ignorent « ñ », « ã », « í », « ø », « å » et « ł », donc
 * Muñoz, São Paulo, García, Ørsted, Åkerlund et Kowalczyk se coupent
 * exactement de la meme facon, et rien ne l aurait signale. Ce qui se
 * lit ici est desormais une categorie Unicode : lettre majuscule, puis
 * lettres, chiffres, tiret et apostrophe. Un alphabet rencontre demain
 * entre sans qu on y pense.
 *
 * Le motif s assemble au lancement plutot que de s ecrire en litteral
 * parce que le projet compile en cible es5, ou le drapeau `u` est
 * refuse sur un litteral. La contrainte est celle du compilateur et non
 * du moteur : Node et tout navigateur courant lisent ces classes.
 */
const MAJUSCULE = '\\p{Lu}';
const CORPS_DE_MOT = "[\\p{L}\\p{N}_'\\-]";

/**
 * Ce que l ancienne classe acceptait a l interieur d un mot, conservee
 * telle quelle et non redecrite.
 *
 * Elle ne sert plus a detecter, elle sert a reconnaitre le defaut
 * qu elle a produit : une alerte portant sur un nom coupe ici est une
 * troncature et non un homonyme. Le controle de corpus et le releve de
 * faux positifs lui posent tous deux la question, et ils la posent au
 * meme endroit pour qu aucune des deux copies ne vieillisse seule.
 * Elle se supprime le jour ou plus aucune note produite sous elle n est
 * lue.
 */
const ANCIENNE_CLASSE = /[\wÉèàâêîôûäëïöüç'-]/;
const UNE_LETTRE = new RegExp('\\p{L}', 'u');

/** True quand cette lettre coupait un mot en deux avant le correctif. */
export function lettreIgnoreeParLAncienneClasse(c: string): boolean {
  if (!c) return false;
  return UNE_LETTRE.test(c) && !ANCIENNE_CLASSE.test(c);
}
const RE_NOM_PROPRE = new RegExp(
  `(?:^|[\\s\\(])((?:${MAJUSCULE}${CORPS_DE_MOT}{1,}\\s?){1,4})`,
  'gu',
);

export function extractProperNouns(text: string): ProperNoun[] {
  if (!text) return [];
  const found: ProperNoun[] = [];
  const re = new RegExp(RE_NOM_PROPRE.source, RE_NOM_PROPRE.flags);
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1].trim().replace(/[.,;:!?]+$/, '');
    if (raw.length < 3) continue;
    // Filtre debut de phrase : si le caractere precedent est . ou debut de
    // chaine, on accepte uniquement si c est un nom multi-mot ou bien
    // present dans la whitelist
    const startIdx = m.index === 0 ? 0 : m.index;
    const before = startIdx > 0 ? text.slice(Math.max(0, startIdx - 2), startIdx) : '';
    const isStartOfSentence = startIdx === 0 || /[.!?]\s*$/.test(before);
    const words = raw.split(/\s+/);
    // Si debut de phrase et mot unique, on skip (probablement debut de
    // phrase capitalise sans etre un nom propre)
    if (isStartOfSentence && words.length === 1 && !ALWAYS_ALLOWED_LOWER.has(raw.toLowerCase())) {
      continue;
    }
    // Skip les mots qui sont uniquement des stopwords
    if (words.every(w => STOPWORDS.has(w.toLowerCase()))) continue;
    // Un sigle n est pas un nom propre : c est du vocabulaire metier, et
    // le signaler comme non source noie les vraies alertes.
    if (words.every(estUnSigle)) continue;
    found.push({ text: raw, textLower: raw.toLowerCase() });
  }
  return found;
}

// =============================================================================
// PORTEE D UN TAG DE SOURCE
// =============================================================================
// Les trois validations qui suivent posent toutes la meme question : ce
// que je viens de lire est-il couvert par un tag de source. Elles y
// repondaient chacune par un comptage de caracteres, quatre-vingts pour
// les noms propres et les devises, soixante pour les annees, et ces
// trois nombres etaient trois ecritures de la meme regle.
//
// Le defaut mesure sur le run du 4 aout 2026, dossier gele. La prose du
// moteur de coherence financiere ecrit : « la mediane de croissance des
// SaaS publics a scale ($100M+ ARR) etait de 12% en 2023 et projetee a
// 29% pour 2024 [web : benchmarkit.ai, 2024 SaaS Performance Metrics] ».
// Le montant est tagge, le tag ouvre soixante caracteres apres lui et
// ferme cent treize apres lui. La fenetre de quatre-vingts coupait donc
// le tag en deux, le motif exigeait le crochet fermant, et un montant
// correctement source ressortait signale comme non source, en premiere
// page de la note.
//
// Allonger la fenetre aurait reconduit sa nature : elle serait redevenue
// trop courte au premier tag un peu long, sans que rien ne le signale.
// Ce qui se lit ici n est donc plus une distance mais une portee. Un tag
// gouverne ce qui le precede dans le meme segment, le segment se termine
// a la ponctuation forte, et un point pris dans un crochet, dans une
// parenthese ou entre deux chiffres ne termine rien : « benchmarkit.ai »
// et « 12.5% » ne sont pas des fins de phrase.

// Les familles de tags ne sont pas les memes partout, et cette
// difference est un arbitrage et non un oubli. Un nom propre ou un
// montant tagge `[pitch]` reste a verifier, puisque ce que la validation
// lui reproche est justement d etre absent du pitch : le tag serait
// alors l affirmation qu on controle. Une annee tagguee `[pitch]` est en
// revanche declaree lue dans le document, ce qui est la reponse
// attendue. Cet arbitrage-la tranche, donc il se garde.
//
// Ce qui ne se garde pas est l inventaire des mots qui nomment une
// provenance. Il valait `web`, `inference` et `corpus`, ecrits en
// regardant la prose d un run ; le releve des crochets sur trente-huit
// analyses persistees en rend deux cent vingt-neuf en-tetes distincts et
// quinze mille six cents occurrences, dont pres de mille que ces trois
// mots ne couvrent pas : `[FMI WEO]`, `[Atomico SoET 2025]`, `[base
// verifiee]`, `[benchmark externe]`, `[PitchBook Q1 2026]`, `[worldbank-
// gdp]`. Un montant correctement source par l un d eux ressortait
// signale. Allonger la liste aurait reconduit sa nature, puisqu elle
// enumere ce que son auteur avait vu un jour donne.
//
// La propriete observable qui les distingue ne porte pas sur le mot mais
// sur la structure : un tag est une declaration de provenance, et la
// seule provenance que la note puisse nommer sans citer quoi que ce soit
// est le document lui-meme. Un tag nomme donc une source exterieure des
// lors qu une de ses clauses ne commence pas par `pitch`. Un moteur qui
// citerait demain `[Eurostat]` entre sans qu on y pense, et `[pitch
// contexte]` reste dehors sans qu on l exclue.

/** Ce que les connecteurs separent a l interieur d un tag. */
const CONNECTEURS = /\s*(?:\+|\/|;|&|\bvs\b|\bet\b)\s*/i;

/**
 * Les groupes de crochets d un texte, contenu compris, a toutes les
 * profondeurs.
 *
 * La prose imbrique, et le releve sur le corpus en donne l exemple :
 * « [pitch comparable au 30% Udemy instructeurs [inference]] ». Une
 * lecture par expression reguliere plate coupe au premier crochet
 * fermant et ne voit que le groupe exterieur, donc elle manque la
 * declaration qui compte. La pile rend les deux, et il suffit qu un seul
 * nomme une source.
 */
function tagsDe(text: string): string[] {
  const groupes: string[] = [];
  const pile: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '[') { pile.push(i); continue; }
    if (text[i] === ']' && pile.length > 0) groupes.push(text.slice(pile.pop()!, i + 1));
  }
  return groupes;
}

/**
 * True quand le tag nomme une source autre que le document instruit.
 *
 * La lecture est structurelle : on decoupe le contenu sur les
 * connecteurs et on regarde le premier mot de chaque clause. Une seule
 * clause hors pitch suffit, parce que `[pitch + web : Viadeo]` declare
 * bien une lecture externe en plus de la lecture du deck.
 */
export function tagNommeUneSourceExterne(tag: string): boolean {
  const contenu = tag.replace(/^\[|\]$/g, '').trim();
  if (!contenu) return false;
  return contenu
    .split(CONNECTEURS)
    .some((clause) => {
      const premier = clause.trim().split(/[\s:,]+/)[0] ?? '';
      return premier.length > 0 && premier.toLowerCase() !== 'pitch';
    });
}

/**
 * Fin du segment qui commence a `from` : premiere ponctuation forte hors
 * crochet, hors parenthese et hors decimale. A defaut, la fin du texte.
 */
export function finDeSegment(text: string, from: number): number {
  let crochets = 0;
  let parentheses = 0;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (c === '[') { crochets++; continue; }
    if (c === ']') { if (crochets > 0) crochets--; continue; }
    if (c === '(') { parentheses++; continue; }
    if (c === ')') { if (parentheses > 0) parentheses--; continue; }
    if (crochets > 0 || parentheses > 0) continue;
    if (c === '\n' || c === '\r' || c === ';') return i;
    if (c === '.' || c === '!' || c === '?') {
      // Un point entre deux chiffres est une decimale, pas une fin de
      // phrase. Le point d un sigle ou d un domaine vit dans un tag ou
      // une parenthese, deja couverts par la profondeur.
      if (c === '.' && /\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? '')) continue;
      return i;
    }
  }
  return text.length;
}

/**
 * Debut du segment qui contient `to`, symetrique de `finDeSegment`.
 *
 * Les regles qui cherchent quelque chose EN AMONT d une position, comme
 * la mention de conversion qui accompagne un montant en devise
 * etrangere, le faisaient par un comptage de caracteres. C est la meme
 * faute que la fenetre de quatre-vingts caracteres corrigee en aval, et
 * elle se trompe dans les deux sens : elle traverse la ponctuation forte
 * et va chercher un « soit » qui appartient a la phrase precedente, et
 * elle s arrete au milieu d une phrase longue ou le « environ » se
 * trouve un peu plus haut.
 */
export function debutDeSegment(text: string, to: number): number {
  let crochets = 0;
  let parentheses = 0;
  for (let i = Math.min(to, text.length) - 1; i >= 0; i--) {
    const c = text[i];
    if (c === ']') { crochets++; continue; }
    if (c === '[') { if (crochets > 0) crochets--; continue; }
    if (c === ')') { parentheses++; continue; }
    if (c === '(') { if (parentheses > 0) parentheses--; continue; }
    if (crochets > 0 || parentheses > 0) continue;
    if (c === '\n' || c === '\r' || c === ';') return i + 1;
    if (c === '.' || c === '!' || c === '?') {
      if (c === '.' && /\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? '')) continue;
      return i + 1;
    }
  }
  return 0;
}

/**
 * Le tag qui englobe la position `from`, quand elle tombe a l interieur
 * d un tag, et null sinon.
 *
 * Ce qui est ecrit dans un tag n est pas une affirmation de la note,
 * c est la designation de la source : « Viadeo » lu dans
 * `[web : Viadeo]` est le nom du site interroge, pas un nom propre avance
 * sans preuve. Le controle le comptait pourtant comme non tague, ce qui
 * lui faisait reprocher a une citation d etre une citation.
 */
export function tagEnglobant(text: string, from: number): string | null {
  let ouverture = -1;
  for (let i = Math.min(from, text.length - 1); i >= 0; i--) {
    if (text[i] === ']' && i < from) return null;
    if (text[i] === '[') { ouverture = i; break; }
  }
  if (ouverture < 0) return null;
  const fermeture = text.indexOf(']', ouverture);
  if (fermeture < 0 || fermeture < from) return null;
  return text.slice(ouverture, fermeture + 1);
}

// ============================================================
// UN TAG N EST PAS UNE SOURCE TANT QUE LA CAPTURE NE LE PORTE PAS
// ------------------------------------------------------------
// Le releve du 5 aout 2026. Un tag `[web : crunchbase]` etait accepte
// comme provenance depuis l origine, alors qu il est produit par le
// modele sur instruction du prompt : « mentionne brievement la source si
// tu peux la reconstituer ». Une chaine ecrite de memoire ne peut pas
// fonder ce qu elle accompagne, et elle avait exactement la forme d une
// preuve.
//
// La propriete observable remplace la declaration. La capture du run
// (lib/instrumentation/source-capture) porte les pages reellement
// atteintes. Quand elle est vide, aucun appel du run n a lu quoi que ce
// soit sur le reseau, donc aucune revendication de lecture externe ne
// repose sur une lecture : le tag redevient ce qu il est, un souvenir,
// et l assertion qu il accompagne est non fondee.
//
// La granularite est celle du run et non celle du moteur, parce que le
// point de prelevement est le client, qui ne connait pas l appelant.
// C est donc un plancher : une capture pleine n etablit pas que cette
// assertion-ci vient d une page atteinte, elle etablit seulement que
// des pages l ont ete. C est le cas vide qui tranche, et il couvre ce
// qui compte aujourd hui, le run gele et le moteur a zero hop.

/**
 * Les provenances que la requete elle-meme porte, et elles seules.
 *
 * Liste d arbitrage, datee du 5 aout 2026, et non inventaire : son
 * contenu ne se deduit d aucune propriete des donnees, il se decide.
 * Une requete au modele transporte trois choses dont il peut tirer une
 * assertion sans rien lire au dehors : le document instruit (`pitch`),
 * son propre raisonnement (`inference`), et le corpus doctrinal inscrit
 * dans les prompts (`corpus`). Toute autre provenance revendique une
 * lecture qui a eu lieu ailleurs, donc qui doit se constater.
 */
const PROVENANCES_PORTEES_PAR_LA_REQUETE = new Set([
  'pitch', 'inference', 'inférence', 'corpus',
]);

/**
 * True quand le tag revendique une lecture faite hors de la requete.
 *
 * Meme lecture structurelle que `tagNommeUneSourceExterne`, un cran plus
 * stricte : une seule clause suffit, et le premier mot de la clause est
 * confronte aux provenances internes.
 *
 * Une clause sans lettre ne nomme rien et ne revendique donc rien. Le
 * releve du 5 aout 2026 sur quarante analyses persistees a rendu
 * cinquante-deux mille groupes de crochets, dont environ mille sept
 * cents purement numeriques : `[0]`, `[1]`, `[2029]`, `[3]`. Ce sont des
 * crochets de prose et non des declarations de provenance, et les
 * compter aurait fait signaler une annee entre crochets comme une source
 * exterieure non capturee. La regle porte sur la presence d une lettre,
 * propriete des donnees, plutot que sur un inventaire des formes vues.
 */
export function tagRevendiqueUneLectureExterne(tag: string): boolean {
  const contenu = tag.replace(/^\[|\]$/g, '').trim();
  if (!contenu) return false;
  return contenu
    .split(CONNECTEURS)
    .some((clause) => {
      const premier = (clause.trim().split(/[\s:,]+/)[0] ?? '').toLowerCase();
      // Classe explicite plutot que \p{L} : la cible de compilation du
      // depot est anterieure a es6 et refuse les proprietes unicode.
      if (premier.length === 0 || !/[a-zÀ-ɏ]/i.test(premier)) return false;
      return !PROVENANCES_PORTEES_PAR_LA_REQUETE.has(premier);
    });
}

/**
 * Les tags du segment qui peuvent encore fonder quelque chose.
 *
 * Sans capture ouverte, tous : hors d un run on ignore ce qui a ete lu,
 * et une precision non donnee ne doit pas produire une severite qu elle
 * ne fonde pas.
 */
function tagsFondants(tags: string[]): string[] {
  if (!aucunePageAtteinte()) return tags;
  return tags.filter((t) => !tagRevendiqueUneLectureExterne(t));
}

/**
 * True quand une source est declaree pour ce qui commence a `from`.
 *
 * Point de passage unique des trois validations : la definition de
 * « c est source » vit ici et nulle part ailleurs, faute de quoi la
 * corriger une fois ne la corrige qu une fois.
 *
 * Deux facons d etre source, et la seconde n est pas une tolerance :
 * porter un tag dans son segment, ou vivre a l interieur d un tag.
 */
export function porteUnTagDeSource(
  text: string,
  from: number,
  avecPitch = false,
): boolean {
  // La distinction de famille ne s applique pas au tag englobant, et ce
  // n est pas un relachement. Elle arbitre ce qu une declaration de
  // provenance vaut pour l affirmation qui la precede ; a l interieur du
  // tag il n y a pas d affirmation a arbitrer, seulement le nom de la
  // source. « [pitch, slide 12] » ne pretend pas que « slide » soit
  // etabli, il dit ou l on a lu.
  if (tagEnglobant(text, from) !== null) return true;
  const segment = text.slice(from, finDeSegment(text, from));
  const tags = tagsFondants(tagsDe(segment));
  if (tags.length === 0) return false;
  return avecPitch ? true : tags.some(tagNommeUneSourceExterne);
}

// =============================================================================
// VALIDATIONS SPECIFIQUES
// =============================================================================

export interface ValidationWarning {
  category:
    | 'unknown_name'
    | 'currency_mismatch'
    | 'invented_date'
    | 'unsupported_claim'
    | 'source_non_capturee';
  severity: 'critical' | 'warning' | 'info';
  field: string; // chemin dans l output, ex 'redFlags[2]'
  message: string;
  excerpt: string; // extrait du texte concerne
}

/**
 * Les tags d un texte avec la position de leur crochet ouvrant.
 *
 * Meme pile que `tagsDe`, qui ne rend que le contenu : le controle des
 * revendications de lecture a besoin de savoir ou le tag se trouve pour
 * rendre le segment qu il pretend fonder.
 */
function tagsAvecPosition(text: string): Array<{ tag: string; debut: number; fin: number }> {
  const groupes: Array<{ tag: string; debut: number; fin: number }> = [];
  const pile: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '[') { pile.push(i); continue; }
    if (text[i] === ']' && pile.length > 0) {
      const debut = pile.pop()!;
      groupes.push({ tag: text.slice(debut, i + 1), debut, fin: i });
    }
  }
  return groupes;
}

/**
 * Signale les revendications de lecture externe que la capture du run ne
 * porte pas.
 *
 * Les trois controles historiques ne se declenchent que sur un nom
 * propre, un montant en devise etrangere ou une annee. Une assertion
 * taguee `[web]` qui ne porte aucun des trois passait donc sans bruit,
 * et c est le cas majoritaire. Le signalement doit exister par lui-meme,
 * faute de quoi le retrait du tag comme preuve ne changerait rien a ce
 * que le lecteur voit.
 *
 * Inerte hors run et inerte des qu une page a ete atteinte : ce controle
 * ne cherche pas a savoir si l assertion vient de la bonne page, ce que
 * le point de prelevement ne permet pas de dire. Il tranche le seul cas
 * ou la reponse est certaine.
 */
export function findSourcesNonCapturees(text: string, field: string): ValidationWarning[] {
  if (!text || !aucunePageAtteinte()) return [];
  const warnings: ValidationWarning[] = [];
  for (const { tag, debut, fin } of tagsAvecPosition(text)) {
    if (!tagRevendiqueUneLectureExterne(tag)) continue;
    warnings.push({
      category: 'source_non_capturee',
      severity: 'critical',
      field,
      message: `Le tag ${tag} revendique une lecture exterieure au dossier, alors qu aucune page n a ete atteinte pendant ce run. La provenance n est donc pas constatee : l assertion repose sur une reconstitution du modele et non sur une source. La retirer ou la retrograder en [inference].`,
      excerpt: text.slice(debutDeSegment(text, debut), Math.min(text.length, fin + 1)).slice(-220),
    });
  }
  return warnings;
}

// Detecte les noms propres dans un texte qui ne sont pas dans la liste
// allowed. Les noms taggues [web] ou [inference] sont consideres comme
// declares par le LLM, donc passent : on ne flagge que les noms
// presentes comme des faits sans tag.
export function findUnknownNames(
  text: string,
  allowed: Set<string>,
  field: string
): ValidationWarning[] {
  if (!text) return [];
  const warnings: ValidationWarning[] = [];
  const nouns = extractProperNouns(text);
  const seen = new Set<string>();

  for (const n of nouns) {
    if (seen.has(n.textLower)) continue;
    seen.add(n.textLower);

    // Match exact ou partiel sur la liste allowed
    if (allowed.has(n.textLower)) continue;
    if (ALWAYS_ALLOWED_LOWER.has(n.textLower)) continue;
    // Match partiel : si un mot du nom est dans allowed, on accepte
    const words = n.textLower.split(/\s+/);
    const anyWordAllowed = words.some(w => allowed.has(w) || ALWAYS_ALLOWED_LOWER.has(w));
    if (anyWordAllowed) continue;

    // Verifier si le nom est dans un contexte tagge [web] ou [inference]
    // ou [corpus] : si oui on ne flagge pas (le LLM a explicitement
    // declare qu il ne vient pas du pitch)
    const idx = text.toLowerCase().indexOf(n.textLower);
    if (idx >= 0 && porteUnTagDeSource(text, idx)) continue;

    warnings.push({
      category: 'unknown_name',
      severity: 'warning',
      field,
      message: `Nom propre "${n.text}" cite sans tag de source et absent des donnees extraites du pitch (fondateurs, board, clients, concurrents). Soit l ajouter au pitch, soit le tagger [web] / [inference], soit le supprimer.`,
      excerpt: text.slice(Math.max(0, idx - 30), Math.min(text.length, idx + n.text.length + 30)),
    });
  }
  return warnings;
}

/**
 * Symboles de chaque devise, du plus long au plus court : l alternation
 * doit essayer « US$ » avant « $ », faute de quoi elle coupe le premier
 * en deux.
 */
const SYMBOLES: Record<'EUR' | 'USD', string> = {
  USD: 'US\\$|USD|\\$',
  EUR: '€|EUR',
};

/** Magnitudes ecrites entre le nombre et son symbole : 500 Mds$, 10 M€. */
const MAGNITUDE = '(?:mds|md|m|bn|b|k)';

/**
 * Les positions ou le texte porte un montant libelle dans `devise`.
 *
 * Un symbole se lit indifferemment avant le nombre, « $190m », ou apres,
 * « 500 Mds$ », et la seconde forme est la plus frequente en francais.
 * Ne lire que la premiere faisait deux fautes d un coup, et la seconde
 * est la plus couteuse : elle manquait le montant suffixe, et elle
 * prenait le symbole suffixe pour le prefixe de ce qui suivait. « Le TAM
 * 500 Mds$ 2025 » ressortait donc comme un montant de deux mille
 * vingt-cinq dollars, en premiere page de la note, avec un extrait qui
 * montrait une annee la ou le lecteur attendait une somme.
 *
 * D ou la seconde regle : un nombre de quatre chiffres compris entre
 * 1900 et 2100, sans magnitude derriere lui, est une annee et non un
 * montant. C est la discipline de precision prise par son bon cote,
 * l arrondi va vers ce qui retient la conclusion.
 */
export function positionsDeMontant(text: string, devise: 'EUR' | 'USD'): number[] {
  const s = SYMBOLES[devise];
  const positions = new Set<number>();
  let m: RegExpExecArray | null;

  const prefixe = new RegExp(`(?:${s})\\s?(\\d[\\d\\s.,]*)`, 'gi');
  while ((m = prefixe.exec(text)) !== null) {
    const nu = m[1].replace(/[\s.,]+$/, '');
    const finNombre = m.index + m[0].length - (m[1].length - nu.length);
    if (/^\d{4}$/.test(nu)) {
      const n = parseInt(nu, 10);
      const suite = text.slice(finNombre, finNombre + 5);
      if (n >= 1900 && n <= 2100 && !new RegExp(`^\\s?${MAGNITUDE}\\b`, 'i').test(suite)) continue;
    }
    positions.add(m.index);
  }

  const suffixe = new RegExp(`(\\d[\\d\\s.,]*)\\s?${MAGNITUDE}?\\s?(?:${s})`, 'gi');
  while ((m = suffixe.exec(text)) !== null) positions.add(m.index);

  return Array.from(positions).sort((a, b) => a - b);
}

// Detecte les conversions de devise non taggees. Si le pitch est en
// EUR (ou inversement), un montant en USD doit porter un tag qui nomme
// une source exterieure, sinon c est suspect.
export function findCurrencyMismatch(
  text: string,
  pitchCurrency: 'EUR' | 'USD' | 'unknown',
  field: string
): ValidationWarning[] {
  if (!text || pitchCurrency === 'unknown') return [];
  const warnings: ValidationWarning[] = [];

  // On cherche les montants en USD si le pitch est EUR, et inversement.
  for (const idx of positionsDeMontant(text, pitchCurrency === 'EUR' ? 'USD' : 'EUR')) {
    // Ce controle prend la famille avec pitch, et c est un arbitrage
    // rendu contre celui du 4 aout, qui avait emprunte son raisonnement
    // au controle des noms propres. Les deux ne reprochent pas la meme
    // chose. Le controle des noms reproche a un nom d etre absent des
    // donnees extraites, si bien qu un tag `[pitch]` contredit
    // l extraction et ne peut pas laver le nom. Celui-ci reproche une
    // devise etrangere sans conversion ni provenance : quand le deck
    // annonce lui-meme un TAM en dollars, `[pitch]` repond exactement a
    // la question posee, et il n y a rien a convertir.
    if (porteUnTagDeSource(text, idx, true)) continue;
    // Une mention de conversion se cherche dans le segment qui precede,
    // et non a une distance donnee.
    const before = text.slice(debutDeSegment(text, idx), idx);
    if (/(environ|soit|~|equivalent|equiv\.|approximativement)/i.test(before)) continue;

    warnings.push({
      category: 'currency_mismatch',
      severity: 'warning',
      field,
      message: `Montant cite dans une devise differente du pitch (pitch en ${pitchCurrency}) sans tag de source ni mention de conversion. Convertir explicitement ou tagguer la source du montant.`,
      excerpt: text.slice(Math.max(0, idx - 30), Math.min(text.length, idx + 40)),
    });
  }
  return warnings;
}

// Detecte les annees citees qui ne sont ni dans le pitch ni taggees.
// Utilise la liste des annees mentionnees dans les champs extraction
// + une fenetre raisonnable autour de l annee de fondation.
export function findInventedDates(
  text: string,
  pitchYears: Set<number>,
  field: string
): ValidationWarning[] {
  if (!text) return [];
  const warnings: ValidationWarning[] = [];

  // Cherche annees 4 chiffres (1990-2050)
  const re = /\b(19[9]\d|20[0-4]\d|2050)\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const year = parseInt(m[1], 10);
    if (pitchYears.has(year)) continue;

    // Tolerance : annees +/- 5 d une annee dans le pitch (projection,
    // planning, retrospective). Au-dela, on flagge.
    const closeToPitch = Array.from(pitchYears).some(y => Math.abs(y - year) <= 5);
    if (closeToPitch) continue;

    // Tolerance pour annees actuelles +/- 2 (le LLM a connaissance de
    // l annee courante via training data)
    const currentYear = new Date().getFullYear();
    if (Math.abs(year - currentYear) <= 2) continue;

    // Verifier presence d un tag
    const idx = m.index;
    if (porteUnTagDeSource(text, idx, true)) continue;

    warnings.push({
      category: 'invented_date',
      severity: 'info',
      field,
      message: `Annee ${year} citee sans tag de source et sans correspondance dans le pitch. Verifier que l information est sourcee.`,
      excerpt: text.slice(Math.max(0, idx - 30), Math.min(text.length, idx + 30)),
    });
  }
  return warnings;
}

// Construit l ensemble des annees mentionnees dans l extraction (pitch).
export function buildPitchYears(extraction: ExtractionOutput): Set<number> {
  const years = new Set<number>();
  if (extraction.yearFounded && extraction.yearFounded > 0) years.add(extraction.yearFounded);
  // Cherche dans les textes libres
  const texts = [
    extraction.marketPitch || '',
    extraction.productDescription || '',
    extraction.businessModel || '',
    extraction.rawSummary || '',
    extraction.fundraise?.amount || '',
    extraction.fundraise?.valuation || '',
    extraction.traction?.revenue || '',
    extraction.traction?.growth || '',
    ...(extraction.traction?.metrics || []),
  ].join(' ');
  const re = /\b(19[9]\d|20[0-4]\d|2050)\b/g;
  let m;
  while ((m = re.exec(texts)) !== null) {
    years.add(parseInt(m[1], 10));
  }
  return years;
}

// Detecte la devise dominante du pitch a partir du fundraise et des
// metrics traction.
// =============================================================================
// VALIDATION GLOBALE D UN OUTPUT D ENGINE
// =============================================================================

export interface AssertionAuditReport {
  totalWarnings: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
  warnings: ValidationWarning[];
}

export function auditAssertions(
  output: unknown,
  extraction: ExtractionOutput,
  options?: {
    fields?: string[]; // chemins JSON specifiques a auditer (sinon tout)
    skipCurrencyCheck?: boolean;
  },
): AssertionAuditReport {
  const allowed = buildAllowedNames(extraction);
  const pitchYears = buildPitchYears(extraction);
  const pitchCurrency = options?.skipCurrencyCheck ? 'unknown' : detectPitchCurrency(extraction);

  const allWarnings: ValidationWarning[] = [];

  // Parcours recursif de l output : on collecte tous les champs string
  // > 40 caracteres et on les valide.
  const visit = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      if (node.length < 40) return;
      allWarnings.push(...findUnknownNames(node, allowed, path));
      if (pitchCurrency !== 'unknown') {
        allWarnings.push(...findCurrencyMismatch(node, pitchCurrency, path));
      }
      allWarnings.push(...findInventedDates(node, pitchYears, path));
      allWarnings.push(...findSourcesNonCapturees(node, path));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((v, i) => visit(v, `${path}[${i}]`));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        visit(v, path ? `${path}.${k}` : k);
      }
    }
  };
  visit(output, '');

  // Deduplication : meme message + meme excerpt = un seul warning
  const seen = new Set<string>();
  const dedup: ValidationWarning[] = [];
  for (const w of allWarnings) {
    const key = `${w.category}|${w.message.slice(0, 80)}|${w.excerpt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(w);
  }

  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const w of dedup) {
    byCategory[w.category] = (byCategory[w.category] || 0) + 1;
    bySeverity[w.severity] = (bySeverity[w.severity] || 0) + 1;
  }

  return {
    totalWarnings: dedup.length,
    byCategory,
    bySeverity,
    warnings: dedup,
  };
}
