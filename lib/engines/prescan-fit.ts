// ============================================================
// COMPARAISONS DETERMINISTES DU PRE-SCAN
// ------------------------------------------------------------
// Cinq des dix tests du pre-scan ne demandaient aucun jugement. Leur
// enonce dans le prompt etait deja une regle : « si le secteur figure
// dans sectors_excluded : fail systematique », « si stages_focus est
// vide : pass automatique », « si ticket demande < 50% du min : fail ».
// On demandait donc au modele d executer une comparaison d ensembles et
// deux inegalites, puis on lisait sa reponse comme un verdict.
//
// Le corpus dit ce que cela a coute. Sur dix-neuf pre-scans a profil,
// stage_ticket echoue treize fois, stage_fit dix fois sur les quinze ou
// il est present, ticket_fit sept fois sur dix-huit. Les trois tests les
// plus defaillants du dispositif sont exactement ceux qu une
// comparaison aurait tranches. Le cas qui a ouvert la grappe est de la
// meme famille et plus net encore : le 2 aout, sector_fit a declare In
// Haircare hors these au motif que le consumer beauty serait absent de
// la these du fonds, alors que le profil remis dans le meme prompt
// porte `Consumer` et `E-commerce` parmi vingt-six secteurs cibles et
// n exclut rien. Ce n est pas de la variance, c est un calcul confie a
// un juge.
//
// La doctrine qui en sort : ce qui est comparable se compare, ce qui se
// juge se juge. Le modele lit le deck et en extrait des faits, secteur,
// zone, stade, ticket, chacun avec sa citation. Le code compare ces
// faits au profil du fonds. Le profil ne descend plus dans le prompt,
// donc le modele ne peut plus redecider la these : il ne la connait
// pas.
//
// Corollaire, applique ici et pose au brief : une comparaison sur une
// valeur incertaine ne vaut pas mieux qu un jugement. Un fait sans
// citation n est pas un fait, et un fait hors vocabulaire n est pas
// comparable. Dans les deux cas le test n est pas produit, il le
// declare, et il ne conclut ni au succes ni a l echec. C est la regle
// anti-divination de la grappe 4, appliquee a l entree du pipeline.
// ============================================================

import type { NonProductionCauseOrNull } from './non-production';
import {
  SECTOR_VOCABULARY,
  GEOGRAPHY_VOCABULARY,
  STAGES,
  FOURCHETTES_PAR_STADE,
  zoneCouvertePar,
  secteursVoisins,
  stadesVoisins,
} from '../fund-profile/vocabulary';

/**
 * Statut d un test de pre-scan. `not_produced` est nouveau : il dit que
 * le test n a pas rendu de verdict, ce qui n est ni un succes ni un
 * echec, et qui doit se lire comme tel dans la note comme dans le
 * calcul du score.
 */
export type PreScanStatus = 'pass' | 'warn' | 'fail' | 'not_produced';

/** Fait extrait du dossier par le modele, avec sa citation. */
export interface DossierFact<T> {
  value: T | null;
  evidence: string | null;
}

/**
 * Les quatre faits que le modele extrait pour alimenter les
 * comparaisons. Aucun d eux ne suppose de connaitre la these du fonds.
 */
export interface DossierFacts {
  /**
   * Nom de la societe. N entre dans aucune comparaison : il sert a
   * nommer la ligne. Une analyse ecartee au pre-scan restait libellee
   * « analyse en cours » alors que le resume nommait la societe, donc
   * un dossier ecarte etait identifiable par son empreinte de deck et
   * pas par son nom, ce qui est l inverse de ce qu un partner attend en
   * rouvrant sa liste.
   */
  companyName: DossierFact<string>;
  sector: DossierFact<string>;
  geography: DossierFact<string>;
  stage: DossierFact<string>;
  ticketEur: DossierFact<number>;
}

/** Le sous-ensemble du profil que les comparaisons consultent. */
export interface FitProfile {
  sectorsFocus: string[];
  sectorsExcluded: string[];
  geographiesFocus: string[];
  geographiesExcluded: string[];
  ticketMinEur: number | null;
  ticketMaxEur: number | null;
  stagesFocus: string[];
}

export interface FitTest {
  id: string;
  name: string;
  status: PreScanStatus;
  rationale: string;
  evidence: string;
  /** Null quand le test a rendu un verdict. Renseigne sinon. */
  nonProductionCause: NonProductionCauseOrNull;
}

const FACT_VIDE: DossierFact<any> = { value: null, evidence: null };

/**
 * Un fait n est utilisable que s il porte une valeur du vocabulaire ET
 * une citation. Sans citation, la valeur est une invention plausible ;
 * hors vocabulaire, elle n est comparable a rien.
 */
function factUtilisable<T>(
  fact: DossierFact<T> | undefined | null,
  vocabulaire?: readonly string[],
): { ok: boolean; motif: string } {
  const f = fact ?? FACT_VIDE;
  if (f.value === null || f.value === undefined || f.value === '') {
    return { ok: false, motif: 'le deck ne le dit pas' };
  }
  if (typeof f.evidence !== 'string' || f.evidence.trim().length === 0) {
    return { ok: false, motif: 'valeur avancee sans citation du deck' };
  }
  if (vocabulaire && !vocabulaire.includes(String(f.value))) {
    return { ok: false, motif: `valeur « ${String(f.value)} » hors du vocabulaire de la plateforme` };
  }
  return { ok: true, motif: '' };
}

function nonProduit(id: string, name: string, motif: string): FitTest {
  return {
    id,
    name,
    status: 'not_produced',
    rationale: `Comparaison impossible : ${motif}. Le test ne conclut ni au succes ni a l echec.`,
    evidence: '',
    // La donnee manque au dossier, personne n a echoue : absence.
    nonProductionCause: 'absence',
  };
}

function produit(
  id: string, name: string, status: 'pass' | 'warn' | 'fail',
  rationale: string, evidence: string,
): FitTest {
  return { id, name, status, rationale, evidence, nonProductionCause: null };
}

// ------------------------------------------------------------

export function evaluerSectorFit(facts: DossierFacts, profil: FitProfile): FitTest {
  const NOM = 'Thèse sectorielle';
  // Les branches de succes automatique se traitent avant le fait :
  // quand le fonds ne contraint rien, le secteur du dossier est sans
  // effet, et exiger de le connaitre transformerait une these ouverte
  // en test non produit.
  if (profil.sectorsFocus.length === 0 && profil.sectorsExcluded.length === 0) {
    return produit('sector_fit', NOM, 'pass',
      'Le fonds ne declare ni secteur cible ni secteur exclu, donc aucun secteur ne peut etre hors these.', '');
  }
  const u = factUtilisable(facts.sector, SECTOR_VOCABULARY);
  if (!u.ok) return nonProduit('sector_fit', NOM, u.motif);

  const secteur = String(facts.sector.value);
  const cite = String(facts.sector.evidence);

  if (profil.sectorsExcluded.includes(secteur)) {
    return produit('sector_fit', NOM, 'fail',
      `Le dossier releve de ${secteur}, secteur explicitement exclu par le fonds.`, cite);
  }
  if (profil.sectorsFocus.length === 0) {
    return produit('sector_fit', NOM, 'pass',
      'Le fonds ne declare aucun secteur cible, et le secteur du dossier n est pas exclu.', cite);
  }
  if (profil.sectorsFocus.includes(secteur)) {
    return produit('sector_fit', NOM, 'pass',
      `${secteur} figure parmi les secteurs cibles du fonds.`, cite);
  }
  const voisins = profil.sectorsFocus.filter((s) => secteursVoisins(secteur, s));
  if (voisins.length > 0) {
    return produit('sector_fit', NOM, 'warn',
      `${secteur} ne figure pas parmi les secteurs cibles, mais touche ${voisins.join(', ')}.`, cite);
  }
  return produit('sector_fit', NOM, 'fail',
    `${secteur} ne figure ni parmi les ${profil.sectorsFocus.length} secteurs cibles ni dans leur voisinage.`, cite);
}

export function evaluerGeographyFit(facts: DossierFacts, profil: FitProfile): FitTest {
  const NOM = 'Thèse géographique';
  if (profil.geographiesFocus.length === 0 && profil.geographiesExcluded.length === 0) {
    return produit('geography_fit', NOM, 'pass',
      'Le fonds ne declare ni zone cible ni zone exclue, donc aucune zone ne peut etre hors these.', '');
  }
  const u = factUtilisable(facts.geography, GEOGRAPHY_VOCABULARY);
  if (!u.ok) return nonProduit('geography_fit', NOM, u.motif);

  const zone = String(facts.geography.value);
  const cite = String(facts.geography.evidence);

  const exclusion = profil.geographiesExcluded.find((z) => zoneCouvertePar(zone, z));
  if (exclusion) {
    return produit('geography_fit', NOM, 'fail',
      `Le dossier opere en ${zone}, couvert par l exclusion ${exclusion}.`, cite);
  }
  if (profil.geographiesFocus.length === 0) {
    return produit('geography_fit', NOM, 'pass',
      'Le fonds ne declare aucune zone cible, donc aucune zone ne peut etre hors these.', cite);
  }
  const couverture = profil.geographiesFocus.find((z) => zoneCouvertePar(zone, z));
  if (couverture) {
    return produit('geography_fit', NOM, 'pass',
      couverture === zone
        ? `${zone} figure parmi les zones cibles du fonds.`
        : `${zone} est couverte par la zone cible ${couverture}.`, cite);
  }
  return produit('geography_fit', NOM, 'fail',
    `${zone} n est couverte par aucune des ${profil.geographiesFocus.length} zones cibles.`, cite);
}

export function evaluerTicketFit(facts: DossierFacts, profil: FitProfile): FitTest {
  const NOM = 'Gamme de tickets';
  if (profil.ticketMinEur === null && profil.ticketMaxEur === null) {
    return produit('ticket_fit', NOM, 'pass',
      'Le fonds ne borne pas sa gamme de tickets.', '');
  }
  const u = factUtilisable(facts.ticketEur);
  if (!u.ok) return nonProduit('ticket_fit', NOM, u.motif);

  const t = Number(facts.ticketEur.value);
  const cite = String(facts.ticketEur.evidence);
  if (!Number.isFinite(t) || t <= 0) {
    return nonProduit('ticket_fit', NOM, 'montant non exploitable');
  }
  const { ticketMinEur: min, ticketMaxEur: max } = profil;
  if (min !== null && t < min * 0.5) {
    return produit('ticket_fit', NOM, 'fail',
      `Ticket de ${euros(t)}, sous la moitie du minimum du fonds (${euros(min)}).`, cite);
  }
  if (max !== null && t > max * 2) {
    return produit('ticket_fit', NOM, 'fail',
      `Ticket de ${euros(t)}, plus du double du maximum du fonds (${euros(max)}).`, cite);
  }
  const dansPlage = (min === null || t >= min) && (max === null || t <= max);
  if (dansPlage) {
    return produit('ticket_fit', NOM, 'pass',
      `Ticket de ${euros(t)}, dans la gamme du fonds.`, cite);
  }
  return produit('ticket_fit', NOM, 'warn',
    `Ticket de ${euros(t)}, hors de la gamme stricte du fonds mais dans son voisinage.`, cite);
}

export function evaluerStageFit(facts: DossierFacts, profil: FitProfile): FitTest {
  const NOM = 'Stade investi';
  if (profil.stagesFocus.length === 0) {
    return produit('stage_fit', NOM, 'pass',
      'Le fonds ne restreint pas les stades investis.', '');
  }
  const u = factUtilisable(facts.stage, STAGES);
  if (!u.ok) return nonProduit('stage_fit', NOM, u.motif);

  const stade = String(facts.stage.value);
  const cite = String(facts.stage.evidence);

  if (profil.stagesFocus.includes(stade)) {
    return produit('stage_fit', NOM, 'pass',
      `Le stade ${stade} figure parmi les stades investis par le fonds.`, cite);
  }
  const voisins = profil.stagesFocus.filter((s) => stadesVoisins(stade, s));
  if (voisins.length > 0) {
    return produit('stage_fit', NOM, 'warn',
      `Le stade ${stade} est adjacent aux stades investis (${voisins.join(', ')}).`, cite);
  }
  return produit('stage_fit', NOM, 'fail',
    `Le stade ${stade} n est ni investi par le fonds ni adjacent a ses stades.`, cite);
}

/**
 * Coherence entre le stade revendique et le ticket demande. Ce test ne
 * consulte pas le profil du fonds : il compare le dossier a ce qu une
 * levee de ce stade pese habituellement. Il s applique donc meme sans
 * profil renseigne, ce qui est deja le cas aujourd hui.
 */
export function evaluerStageTicket(facts: DossierFacts): FitTest {
  const NOM = 'Cohérence stade vs ticket';
  const us = factUtilisable(facts.stage, STAGES);
  if (!us.ok) return nonProduit('stage_ticket', NOM, `stade non etabli, ${us.motif}`);
  const ut = factUtilisable(facts.ticketEur);
  if (!ut.ok) return nonProduit('stage_ticket', NOM, `ticket non etabli, ${ut.motif}`);

  const stade = String(facts.stage.value);
  const t = Number(facts.ticketEur.value);
  if (!Number.isFinite(t) || t <= 0) {
    return nonProduit('stage_ticket', NOM, 'montant non exploitable');
  }
  const cite = `${facts.stage.evidence} | ${facts.ticketEur.evidence}`;
  const f = FOURCHETTES_PAR_STADE[stade];
  if (!f) return nonProduit('stage_ticket', NOM, `aucune fourchette conventionnelle pour le stade ${stade}`);

  if (t <= f.bas / 4) {
    return produit('stage_ticket', NOM, 'fail',
      `Un ${stade} qui demande ${euros(t)} est tres en deca de la fourchette usuelle (${euros(f.bas)} a ${euros(f.haut)}).`, cite);
  }
  if (t >= f.haut * 4) {
    return produit('stage_ticket', NOM, 'fail',
      `Un ${stade} qui demande ${euros(t)} est tres au-dela de la fourchette usuelle (${euros(f.bas)} a ${euros(f.haut)}).`, cite);
  }
  if (t < f.bas || t > f.haut) {
    return produit('stage_ticket', NOM, 'warn',
      `Ticket de ${euros(t)} hors de la fourchette usuelle d un ${stade} (${euros(f.bas)} a ${euros(f.haut)}), sans decalage majeur.`, cite);
  }
  return produit('stage_ticket', NOM, 'pass',
    `Ticket de ${euros(t)} coherent avec la fourchette usuelle d un ${stade}.`, cite);
}

/**
 * Les tests deterministes du run. `stage_ticket` s applique toujours,
 * les quatre tests de these seulement si un profil est fourni, ce qui
 * reproduit exactement le perimetre actuel, six tests sans profil et
 * dix avec.
 */
export function evaluerComparaisons(
  facts: DossierFacts,
  profil: FitProfile | null,
): FitTest[] {
  const out: FitTest[] = [evaluerStageTicket(facts)];
  if (profil) {
    out.push(
      evaluerSectorFit(facts, profil),
      evaluerGeographyFit(facts, profil),
      evaluerTicketFit(facts, profil),
      evaluerStageFit(facts, profil),
    );
  }
  return out;
}

/** Identifiants des tests que le code calcule, et que le modele ne rend plus. */
export const TESTS_DETERMINISTES_AVEC_PROFIL = [
  'stage_ticket', 'sector_fit', 'geography_fit', 'ticket_fit', 'stage_fit',
] as const;
export const TESTS_DETERMINISTES_SANS_PROFIL = ['stage_ticket'] as const;

function euros(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M EUR`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k EUR`;
  return `${n} EUR`;
}
