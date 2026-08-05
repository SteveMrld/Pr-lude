// ============================================================
// CAPTURE DES SOURCES WEB
// ------------------------------------------------------------
// La tracabilite arrivait et le pipeline la detruisait.
//
// Quand web_search est actif, l API rend deux choses a cote de la prose :
// les pages reellement atteintes, avec leur URL et leur titre, et les
// citations qui rattachent un passage du texte a une page precise, avec
// l extrait cite. `callClaude` ne gardait que les blocs `text`, les
// concatenait, puis retirait les balises `<cite>` du texte pour que la
// note ne les affiche pas litteralement. Tout le reste de la reponse
// etait jete au retour de la fonction. Aucune URL n a jamais atteint le
// depot.
//
// Ce qui tenait lieu de tracabilite a la place etait une declaration du
// modele sur sa propre source, produite sur instruction du prompt :
// « mentionne brievement la source si tu peux la reconstituer ». Un tag
// `[web : crunchbase]` n a donc jamais ete une source. C est un
// souvenir, invérifiable par construction, et il avait la forme exacte
// d une preuve.
//
// POURQUOI A COTE DE LA PROSE ET NON DEDANS
//
// Deux exigences reposaient sur les memes caracteres. La balise `<cite>`
// servait l auditabilite ; le rendu de la note exigeait qu elle
// disparaisse. Le rendu l a emportee, et personne n a rendu d arbitrage.
// C est le cas type de la collision decrite dans CLAUDE.md : le diff du
// nettoyage est irreprochable lu seul, l exigence d auditabilite est
// irreprochable lue seule, et la contradiction ne vit dans aucun
// fichier.
//
// La sortie est de monter d un cran : une structure parallele sert les
// deux. La prose reste nettoyee, la capture vit a cote, et le stripping
// ne depense plus rien puisqu il ne porte plus l unique trace.
//
// POURQUOI ICI ET NON AUX SITES D APPEL
//
// Meme forme que le registre des appels au modele et que le journal de
// recolte : portee de run par AsyncLocalStorage, alimente depuis le
// point de passage unique du client instrumente. `callClaude`,
// `callClaudeWithUsage`, `callClaudeWithPDF` et `callClaudeMultiDocs` y
// passent tous, puisque tous appellent `getClient`. Un moteur branche
// demain est capture par construction et non par discipline.
//
// CE QUE LA CAPTURE BORNE, ET CE QU ELLE NE BORNE PAS
//
// Elle etablit qu une page a ete atteinte pendant ce run, a quelle date,
// et quel extrait le modele en a cite. Elle n etablit pas qu une
// assertion donnee vient de cette page : le point de prelevement est le
// client, qui ne connait pas le moteur appelant. C est un plancher et il
// doit etre annonce comme tel. Il suffit a trancher le cas qui compte
// aujourd hui, ou la capture est vide : aucun appel du run n a atteint
// la moindre page, donc aucun tag `[web]` du run ne peut reposer sur une
// lecture. L empreinte du prompt systeme est relevee par appel pour que
// l attribution par moteur reste possible plus tard sans rien changer au
// point de prelevement.
// ============================================================

import { AsyncLocalStorage } from 'async_hooks';
import { createHash } from 'crypto';

/** Longueur au-dela de laquelle un extrait cite est coupe. */
const EXTRAIT_MAX = 400;

/**
 * Plafond de sources retenues par run. Un run complet fait une trentaine
 * d appels, dont une dizaine a trois recherches de dix resultats : le
 * plafond n est pas atteint en regime nominal. Quand il l est, le compte
 * ecarte est imprime dans la lecture plutot que tu, faute de quoi une
 * capture tronquee se lirait comme une capture complete.
 */
const SOURCES_MAX = 500;

export interface SourceCapturee {
  /** URL de la page, telle que la plateforme l a rendue. */
  url: string;
  /** Titre de la page. Chaine vide quand la plateforme n en rend pas. */
  titre: string;
  /** Date de consultation, ISO 8601, posee au retour de l appel. */
  consulteLe: string;
  /**
   * Extrait cite par le modele. Chaine vide quand la page a ete atteinte
   * sans qu aucun passage n en soit cite, ce qui est une information et
   * non un manque : la page a servi de contexte, pas de reference.
   */
  extrait: string;
  /** Anciennete declaree par la plateforme, quand elle la donne. */
  ageDePage?: string;
  /** Empreinte du prompt systeme de l appel qui a atteint cette page. */
  empreintePrompt: string;
  /** Modele qui a fait l appel. */
  modele: string;
}

export interface CaptureDeSources {
  sources: SourceCapturee[];
  /** Nombre d URL distinctes atteintes. */
  pages: number;
  /** Nombre de sources portant un extrait cite. */
  citees: number;
  /** Nombre d appels au modele ayant rendu au moins une page. */
  appelsAvecPage: number;
  /** Sources ecartees par le plafond. Imprime, jamais tu. */
  ecartees: number;
}

interface CaptureStore {
  /** Clef url + extrait, pour qu une page citee deux fois ne compte qu une. */
  sources: Map<string, SourceCapturee>;
  appelsAvecPage: number;
  ecartees: number;
}

const storage = new AsyncLocalStorage<CaptureStore>();

/**
 * Ouvre une capture pour la duree d un run. La portee EST le run : deux
 * runs concurrents ne partagent rien, et il n existe pas de remise a
 * zero separee qu on pourrait oublier.
 */
export function withSourceCapture<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run({ sources: new Map(), appelsAvecPage: 0, ecartees: 0 }, fn);
}

/**
 * Tout objet de la reponse qui porte une URL.
 *
 * La lecture est structurelle et non nominale, et c est le point. Un
 * inventaire de types de blocs (`web_search_tool_result`,
 * `web_search_result_location`, `web_fetch_result`) enumererait ce que
 * son auteur avait sous les yeux un jour donne, et vieillirait sans
 * signaler son vieillissement. La propriete qui distingue une source est
 * qu elle porte une URL, et elle s evalue sur les donnees presentes.
 *
 * On ne descend jamais dans une chaine : une URL ecrite par le modele
 * dans sa prose n est pas une page atteinte, c est une affirmation, et
 * la confondre avec une source refabriquerait exactement le souvenir
 * qu on retire.
 */
function noeudsAvecUrl(noeud: unknown, acc: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(noeud)) {
    for (const n of noeud) noeudsAvecUrl(n, acc);
    return acc;
  }
  if (noeud && typeof noeud === 'object') {
    const o = noeud as Record<string, unknown>;
    if (typeof o.url === 'string' && o.url.length > 0) acc.push(o);
    for (const v of Object.values(o)) noeudsAvecUrl(v, acc);
  }
  return acc;
}

function chaine(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Releve les pages atteintes par un appel. Appelee par le client
 * instrumente et par lui seul. Hors run, no-op silencieux, pour qu un
 * script hors pipeline n echoue pas pour cette raison.
 */
export function recordWebSources(entree: {
  content: unknown;
  systemPrompt: unknown;
  model: string;
}): void {
  const store = storage.getStore();
  if (!store) return;

  const noeuds = noeudsAvecUrl(entree.content);
  if (noeuds.length === 0) return;

  const consulteLe = new Date().toISOString();
  const empreintePrompt = createHash('sha256')
    .update(typeof entree.systemPrompt === 'string' ? entree.systemPrompt : JSON.stringify(entree.systemPrompt ?? ''))
    .digest('hex')
    .slice(0, 16);

  let ajoutee = false;
  for (const n of noeuds) {
    const url = chaine(n.url);
    const extrait = chaine(n.cited_text ?? n.citedText).slice(0, EXTRAIT_MAX);
    const clef = `${url}\n${extrait}`;
    if (store.sources.has(clef)) continue;
    if (store.sources.size >= SOURCES_MAX) { store.ecartees++; continue; }
    const ageDePage = chaine(n.page_age ?? n.pageAge);
    store.sources.set(clef, {
      url,
      titre: chaine(n.title ?? n.document_title),
      consulteLe,
      extrait,
      ...(ageDePage ? { ageDePage } : {}),
      empreintePrompt,
      modele: entree.model,
    });
    ajoutee = true;
  }
  if (ajoutee) store.appelsAvecPage++;
}

/** Lecture seule de la capture du run courant. Hors run, capture vide. */
export function readSourceCapture(): CaptureDeSources {
  const store = storage.getStore();
  const sources = Array.from(store?.sources.values() ?? []);
  const urls = new Set(sources.map((s) => s.url));
  return {
    sources,
    pages: urls.size,
    citees: sources.filter((s) => s.extrait.length > 0).length,
    appelsAvecPage: store?.appelsAvecPage ?? 0,
    ecartees: store?.ecartees ?? 0,
  };
}

/** True quand un run est ouvert. Utile aux gardes et aux tests. */
export function captureEstOuverte(): boolean {
  return storage.getStore() !== undefined;
}

/**
 * True quand un run est ouvert et qu il n a atteint aucune page.
 *
 * C est la question que pose le validateur d assertions, et sa forme
 * negative est deliberee. Hors run, la reponse est false et non true :
 * on ne sait pas ce que le run a atteint, et une precision non donnee ne
 * doit pas produire une severite qu elle ne fonde pas. Seule une capture
 * ouverte et vide etablit qu aucune lecture n a eu lieu.
 */
export function aucunePageAtteinte(): boolean {
  const store = storage.getStore();
  return store !== undefined && store.sources.size === 0;
}
