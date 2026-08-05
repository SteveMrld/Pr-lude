// ============================================================
// BULLETIN DE FIABILITE
// ------------------------------------------------------------
// Ce que la note ne sait pas, ecrit par la note elle-meme, en tete.
//
// POURQUOI IL EXISTE
//
// Le detecteur de defauts est aujourd hui la lecture humaine. Tout le
// reste en depend : un defaut se trouve en lisant une note, se confirme
// en produisant une autre note, et le cycle ne converge pas parce que
// chaque note est un tirage neuf dans une distribution qu on ne corrige
// pas echantillon par echantillon. Deplacer la detection dans le produit
// est le seul geste qui change le rendement de l attention.
//
// Les materiaux existaient et etaient disperses : l audit des
// assertions, le journal de recolte, le registre d appels, les causes de
// non-production, le verrou de comparabilite, et depuis le 5 aout la
// capture des sources. Aucun n etait agrege, et le partner ne voyait
// rien. Le bulletin les rassemble et n invente aucune mesure.
//
// CE QU IL EST, ET CE QU IL N EST PAS
//
// Il n est pas une note de confiance. Un chiffre unique cacherait ce
// qu il resume, et une note qui se decerne une bonne note ne vaut rien
// devant un fonds. Il enumere des reserves nommees, chacune avec ce
// qu elle empeche d affirmer.
//
// C est l argument commercial autant que l instrument : un fonds
// n achete pas un outil qui a toujours raison, il achete un instrument
// qui dit ce qu il ne sait pas. La rigueur se vend quand elle est
// visible, et elle n est visible que si elle est ecrite a l endroit ou
// le partner lit.
//
// IL PARTAGE SON CATALOGUE AVEC LE CONTROLEUR DE CORPUS
//
// Les memes proprietes servent aux deux, et ce n est pas une economie de
// code, c est une garantie. Une propriete ajoutee pour un defaut trouve
// dans une note ancienne devient, le jour meme, une reserve que toute
// note neuve porte si elle la viole. Sans ce partage, les deux
// dispositifs divergeraient, et celui que le client lit serait le moins
// tenu des deux.
// ============================================================

import { PROPRIETES, type Propriete } from './proprietes';
import { GAP_STATUSES } from '../orchestrator/engine-status-recorder';

export interface Reserve {
  /** Ce qui manque, nomme. */
  titre: string;
  /** Ce que cette lacune empeche d affirmer. */
  portee: string;
  gravite: 'majeure' | 'notable' | 'mineure';
}

export interface Bulletin {
  /** Ce que la note ne sait pas, du plus lourd au plus leger. */
  reserves: Reserve[];
  couverture: {
    dimensionsEvaluees: number;
    dimensionsTotal: number;
    verdictComparable: boolean | null;
    mentionDeComparabilite: string | null;
  };
  ancrage: {
    pagesAtteintes: number;
    sourcesCitees: number;
    revendicationsSansCapture: number;
    alertesDuValidateur: number;
    alertesCritiques: number;
  };
  production: {
    moteursAboutis: number;
    moteursSansObjet: number;
    moteursEnIncident: number;
    sourcesExternesEnIncident: string[];
  };
  /** Proprietes du catalogue que cette note viole. */
  proprietesEnDefaut: Array<{ id: string; enonce: string; constats: number }>;
  etabliLe: string;
}

function nombre(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * Construit le bulletin d une note. Pure : ne lit ni la base, ni le
 * reseau, ni la portee de run. Elle s applique donc indifferemment a la
 * note qu on vient de produire et a une note persitee depuis des mois,
 * ce qui est la condition pour que le controleur de corpus mesure la
 * meme chose que le partner lit.
 */
export function construireBulletin(note: any, catalogue: Propriete[] = PROPRIETES): Bulletin {
  const reserves: Reserve[] = [];

  // ---------- Couverture du score ----------
  const basis = note?.mechanicalScore?.basis;
  const dimensionsEvaluees = Array.isArray(basis?.evaluated) ? basis.evaluated.length : 0;
  const dimensionsTotal = nombre(basis?.totalCount);
  const comparabilite = note?.mechanicalScore?.verdictComparability ?? null;
  const verdictComparable = comparabilite ? comparabilite.comparable === true : null;

  // Les dimensions non evaluees portent leur cause, et la cause change
  // ce que la reserve veut dire. Le premier jet les concatenait sans la
  // lire et rendait « [object Object] » ; c est le corpus qui l a dit,
  // en douze notes, ce qu aucune fixture ecrite ici n aurait montre.
  //
  // Une dimension perdue parce qu un moteur est tombe est une lacune du
  // dispositif. Une dimension perdue parce que le dossier ne portait
  // rien est une lacune du dossier. Les melanger dans une seule phrase
  // ferait lire au partner un incident la ou il y a une absence, ce que
  // la doctrine interdit depuis la grappe 3.
  const nonEvaluees: any[] = Array.isArray(basis?.notEvaluated) ? basis.notEvaluated : [];
  const parIncident = nonEvaluees.filter((d) => String(d?.cause ?? '').includes('failed') || String(d?.engineStatus ?? '') === 'failed');
  const parAbsence = nonEvaluees.filter((d) => !parIncident.includes(d));
  const nommer = (l: any[]) => l.map((d) => String(d?.label ?? d?.dimension ?? '?')).join(', ');

  if (basis && basis.sufficient === false) {
    reserves.push({
      titre: `socle insuffisant : ${dimensionsEvaluees} dimension(s) evaluee(s) sur ${dimensionsTotal}, poids cumule ${Math.round(nombre(basis.evaluatedWeight) * 100)} % pour un minimum de ${Math.round(nombre(basis.minimumWeight) * 100)} %`,
      portee: 'aucun score global n est produit, et le verdict rendu ne repose pas sur le calcul habituel',
      gravite: 'majeure',
    });
  }
  if (parIncident.length > 0) {
    reserves.push({
      titre: `${parIncident.length} dimension(s) perdue(s) par incident : ${nommer(parIncident)}`,
      portee: 'la lacune est celle du dispositif et non du dossier : ces dimensions ne disent rien de la societe, elles n ont pas ete instruites',
      gravite: 'majeure',
    });
  }
  if (parAbsence.length > 0) {
    reserves.push({
      titre: `${parAbsence.length} dimension(s) non evaluee(s) faute de matiere : ${nommer(parAbsence)}`,
      portee: 'le dossier ne portait pas de quoi les instruire, et le score est renormalise sur l assiette restante',
      gravite: verdictComparable === false ? 'majeure' : 'notable',
    });
  }
  if (verdictComparable === false) {
    reserves.push({
      titre: 'le verdict n est pas comparable a celui d un autre dossier',
      portee: 'le score est proche d un seuil sur une assiette partielle : un dossier complet aurait pu basculer de verdict',
      gravite: 'majeure',
    });
  }

  // ---------- Ancrage des affirmations ----------
  const capture = note?.meta?.sourceCapture ?? null;
  const pagesAtteintes = nombre(capture?.pages);
  const sourcesCitees = nombre(capture?.citees);
  const audit = note?.assertionAudit ?? null;
  const alertesDuValidateur = nombre(audit?.totalWarnings);
  const alertesCritiques = nombre(audit?.bySeverity?.critical);
  const revendicationsSansCapture = nombre(audit?.byCategory?.source_non_capturee);

  if (revendicationsSansCapture > 0) {
    reserves.push({
      titre: `${revendicationsSansCapture} affirmation(s) renvoient a une source exterieure qu aucune page atteinte ne porte`,
      portee: 'ces affirmations reposent sur une reconstitution du modele et non sur une lecture : elles ne sont pas opposables',
      gravite: 'majeure',
    });
  }
  if (capture === null) {
    reserves.push({
      titre: 'aucune capture de sources n accompagne cette note',
      portee: 'la provenance des faits exterieurs au dossier n est pas verifiable, quelle que soit la mention qui les accompagne',
      gravite: 'majeure',
    });
  } else if (pagesAtteintes === 0) {
    reserves.push({
      titre: 'aucune page exterieure n a ete consultee pendant ce run',
      portee: 'tout ce que la note avance au-dela du dossier vient de la memoire du modele, non d une lecture datee',
      gravite: 'notable',
    });
  }
  if (alertesCritiques > 0) {
    reserves.push({
      titre: `${alertesCritiques} alerte(s) critique(s) du validateur d assertions`,
      portee: 'des noms, montants ou dates de la prose ne se retrouvent ni dans le dossier ni dans une source captee',
      gravite: 'majeure',
    });
  }
  // Le compte total d alertes est rendu dans le pied du bulletin et ne
  // devient pas une reserve, deliberement. Quarante-sept notes sur
  // cinquante en portent plus de cinquante, ce qui est le regime normal
  // et non l exception : en faire une reserve la mettrait sur toutes les
  // notes, ou elle cesserait d etre lue. Le taux de faux positifs du
  // validateur n a jamais ete mesure, et tant qu il ne l est pas, ce
  // compte informe sans conclure. C est une dette nommee, pas un oubli.

  // ---------- Production des moteurs ----------
  // La qualification des statuts n est pas refaite ici. GAP_STATUSES
  // porte deja l arbitrage, date et motive, entre ce qui est une lacune
  // du dispositif et ce qui n en est pas une : skipped_not_applicable en
  // est explicitement exclu parce que c est une decision doctrinale et
  // non un defaut. Recopier cette liste l aurait fait diverger le jour
  // ou l une des deux change.
  const statuts: Record<string, any> = note?.meta?.engineStatuses ?? {};
  const incidents = new Set<string>(GAP_STATUSES as readonly string[]);
  let moteursAboutis = 0, moteursSansObjet = 0, moteursEnIncident = 0;
  for (const s of Object.values(statuts)) {
    const st = String((s as any)?.status ?? '');
    if (incidents.has(st)) moteursEnIncident++;
    else if (st === 'skipped_not_applicable') moteursSansObjet++;
    else if (st === 'ok') moteursAboutis++;
  }
  const sourcesExternesEnIncident: string[] = Array.isArray(note?.meta?.sourceHarvest?.failedSources)
    ? note.meta.sourceHarvest.failedSources
    : [];

  if (moteursEnIncident > 0) {
    reserves.push({
      titre: `${moteursEnIncident} moteur(s) en incident`,
      portee: 'la lacune est celle du dispositif et non du dossier : ce qui manque ici ne dit rien de la societe',
      gravite: 'majeure',
    });
  }
  if (moteursSansObjet > 0) {
    reserves.push({
      titre: `${moteursSansObjet} moteur(s) sans objet sur ce dossier`,
      portee: 'le dossier ne portait pas de quoi les instruire : c est une absence constatee, pas une defaillance',
      gravite: 'mineure',
    });
  }
  if (sourcesExternesEnIncident.length > 0) {
    reserves.push({
      titre: `${sourcesExternesEnIncident.length} source(s) externe(s) en echec : ${sourcesExternesEnIncident.join(', ')}`,
      portee: 'un vide de recherche et un echec de source se ressemblent dans la note : ici c est un echec',
      gravite: 'notable',
    });
  }
  if (Object.keys(statuts).length === 0) {
    reserves.push({
      titre: 'le releve par moteur n accompagne pas cette note',
      portee: 'un moteur tombe et un moteur sans objet y sont indiscernables',
      gravite: 'notable',
    });
  }

  // ---------- Le catalogue, evalue sur cette note ----------
  const proprietesEnDefaut: Array<{ id: string; enonce: string; constats: number }> = [];
  for (const p of catalogue) {
    let applicable = false;
    try { applicable = !!p.porte(note); } catch { applicable = false; }
    if (!applicable) continue;
    let n = 0;
    try { n = (p.constats(note) ?? []).length; } catch { n = 0; }
    if (n > 0) proprietesEnDefaut.push({ id: p.id, enonce: p.enonce, constats: n });
  }

  const ordre = { majeure: 0, notable: 1, mineure: 2 } as const;
  reserves.sort((a, b) => ordre[a.gravite] - ordre[b.gravite]);

  return {
    reserves,
    couverture: {
      dimensionsEvaluees,
      dimensionsTotal,
      verdictComparable,
      mentionDeComparabilite: comparabilite?.mention ?? null,
    },
    ancrage: {
      pagesAtteintes,
      sourcesCitees,
      revendicationsSansCapture,
      alertesDuValidateur,
      alertesCritiques,
    },
    production: {
      moteursAboutis,
      moteursSansObjet,
      moteursEnIncident,
      sourcesExternesEnIncident,
    },
    proprietesEnDefaut,
    etabliLe: new Date().toISOString(),
  };
}

/**
 * Une phrase pour la tete de la note.
 *
 * Elle dit ce que la note ne sait pas et jamais ce qu elle vaut. Une
 * note qui se decerne une note serait le contraire de ce que le
 * dispositif vend.
 */
export function enTeteDuBulletin(b: Bulletin): string {
  const majeures = b.reserves.filter((r) => r.gravite === 'majeure').length;
  if (b.reserves.length === 0) {
    return 'Cette note ne porte aucune reserve : toutes ses dimensions sont evaluees, ses moteurs ont abouti, '
      + 'et ses affirmations exterieures au dossier sont adossees a des pages consultees.';
  }
  const parts: string[] = [];
  if (majeures > 0) parts.push(`${majeures} reserve(s) majeure(s)`);
  const autres = b.reserves.length - majeures;
  if (autres > 0) parts.push(`${autres} reserve(s) de moindre portee`);
  return `Cette note porte ${parts.join(' et ')}. Elles sont enumerees ci-dessous avec ce qu elles empechent d affirmer.`;
}
