// ============================================================
// LECTURE DES DONNEES FINANCIERES POUR LES PATTERNS DE FRAGILITE
// ------------------------------------------------------------
// Point de passage unique entre `FinancialDataExtraction` et les sept
// patterns. Il existe parce que deux patterns lisaient ce contrat a
// travers un `const f: any`, sur des clefs qui n y figurent pas.
//
// Fixed Cost Trap declarait un `FinancialBurnSnapshot` de neuf champs
// et les alimentait par treize lectures : `f?.monthlyBurn`,
// `f?.burnRate`, `f?.runwayMonths`, `f?.runway`, `f?.totalCommitments`,
// `f?.capex`, `f?.payroll`, `f?.rentAnnual`, `f?.contractualMinimums`
// et leurs jumelles. Aucune n existe. Le moteur d extraction produit
// `monthlyBurn` et `runwayMonths` imbriques dans `currentRound`, et
// sous forme de chaines. Le snapshot rendait donc `{}` sur tous les
// dossiers, y compris ceux qui arrivent avec un business plan complet,
// et le pattern dont le cas canonique est WeWork jugeait la rigidite
// contractuelle sur le seul pitch. Growth Subsidized Model portait la
// meme faute sur dix-huit clefs.
//
// Le cast `any` est la cause et pas la consequence : sans lui, `tsc`
// aurait refuse les trente et une lectures le jour ou elles ont ete
// ecrites. Ce module n en porte aucun, et c est sa seule raison
// d exister sous forme de module plutot que de fonction locale : une
// lecture morte ne peut plus etre ecrite ici sans que la compilation
// tombe.
//
// Second principe : les valeurs sont rendues dans la forme que le
// document leur donne. `monthlyBurn` vaut « 200K€/mois » et non
// 200000. La discipline de precision interdit d inventer une unite que
// la donnee ne porte pas, et le destinataire de cette lecture est un
// prompt, qui lit « 200K€/mois » aussi bien qu un nombre. Aucune
// conversion, aucune normalisation, aucun arrondi.
//
// Troisieme principe : l absence se distingue de l absence. Un dossier
// sans bloc financier, un bloc financier vide et un bloc financier
// renseigne mais muet sur l axe interroge sont trois etats differents,
// et les confondre en une seule phrase de repli est ce qui a permis a
// la panne de durer. `renderFinancialReadout` les nomme separement.
// ============================================================

import type { FinancialDataExtraction, ProjectionEntry } from '../types';

/**
 * Marqueurs d absence que le prompt de `financial-extraction-engine`
 * demande explicitement au modele de produire quand il ne trouve pas
 * la donnee. La liste est fermee et lue chez le producteur, non
 * devinee : le squelette JSON du prompt dit « ex: 24 ou 'non
 * précisé' » sur `currentRound` et « ou 'non communiqué' » sur
 * `unitEconomics` et `marketAssumptions`, et sa derniere regle impose
 * « non communiqué » sur tout doute.
 *
 * Traiter ces chaines comme des absences n est pas une interpretation :
 * c est lire ce que le producteur a ecrit. Toute autre chaine est une
 * valeur et passe telle quelle.
 */
const MARQUEURS_ABSENCE: ReadonlySet<string> = new Set([
  'non précisé',
  'non precise',
  'non communiqué',
  'non communique',
]);

/**
 * Rend la chaine si elle porte une valeur, null si elle est vide ou
 * si elle porte un marqueur d absence declare par le producteur.
 */
function valeurOuNull(brut: string | null | undefined): string | null {
  if (typeof brut !== 'string') return null;
  const t = brut.trim();
  if (t.length === 0) return null;
  if (MARQUEURS_ABSENCE.has(t.toLowerCase())) return null;
  return t;
}

/** Une serie annuelle reduite a ce qu un prompt peut lire. */
export interface SerieAnnuelle {
  /** Unite telle que le contrat la documente, pour que le modele ne
   *  la devine pas. Millions d euros pour les montants, points de
   *  pourcentage pour les marges, effectifs pour le headcount. */
  unite: string;
  points: Array<{ annee: string; valeur: number }>;
}

function lireSerie(
  serie: ProjectionEntry[] | null | undefined,
  unite: string,
): SerieAnnuelle | null {
  if (!Array.isArray(serie) || serie.length === 0) return null;
  const points = serie
    .filter((p) => p && typeof p.value === 'number' && Number.isFinite(p.value))
    .map((p) => ({ annee: String(p.year), valeur: p.value }));
  if (points.length === 0) return null;
  return { unite, points };
}

/**
 * Vue plate de ce que `FinancialDataExtraction` porte reellement, aux
 * seuls champs qui interessent un raisonnement de fragilite. Ce qui ne
 * figure pas ici ne figure pas dans le contrat : les engagements hors
 * bilan, les minima contractuels, la masse salariale en euros et le
 * capex cumule ne sont produits par aucun moteur d extraction a ce
 * jour. Ils ne sont pas declares vides, ils sont absents, et le jour
 * ou l extraction apprendra a les chercher ils entreront ici.
 */
export interface FinancialReadout {
  /** Faux quand aucun bloc financier n a ete extrait du dossier. A ne
   *  pas confondre avec un bloc present et sans valeur exploitable. */
  present: boolean;
  hasBP: boolean;
  fileSource: FinancialDataExtraction['fileSource'] | null;
  tour: {
    montant: string | null;
    runwayMois: string | null;
    burnMensuel: string | null;
  };
  unitEconomics: {
    cac: string | null;
    ltv: string | null;
    ratioLtvCac: string | null;
    contratMoyen: string | null;
    margeUnitaire: string | null;
  };
  series: {
    revenu: SerieAnnuelle | null;
    margeBrute: SerieAnnuelle | null;
    ebitda: SerieAnnuelle | null;
    fcf: SerieAnnuelle | null;
    opex: SerieAnnuelle | null;
    effectifs: SerieAnnuelle | null;
  };
  notes: string | null;
}

const READOUT_ABSENT: FinancialReadout = {
  present: false,
  hasBP: false,
  fileSource: null,
  tour: { montant: null, runwayMois: null, burnMensuel: null },
  unitEconomics: { cac: null, ltv: null, ratioLtvCac: null, contratMoyen: null, margeUnitaire: null },
  series: { revenu: null, margeBrute: null, ebitda: null, fcf: null, opex: null, effectifs: null },
  notes: null,
};

/**
 * Lit `FinancialDataExtraction` a travers son type. Aucun cast, aucune
 * clef qui ne soit pas au contrat : c est la propriete qui fait tenir
 * ce module, et la retirer ferait revenir la panne qu il corrige.
 */
export function buildFinancialReadout(
  financialData: FinancialDataExtraction | null | undefined,
): FinancialReadout {
  if (!financialData) return READOUT_ABSENT;

  const cr = financialData.currentRound;
  const ue = financialData.unitEconomics;

  return {
    present: true,
    hasBP: financialData.hasBP === true,
    fileSource: financialData.fileSource ?? null,
    tour: {
      montant: valeurOuNull(cr?.amount),
      runwayMois: valeurOuNull(cr?.runwayMonths),
      burnMensuel: valeurOuNull(cr?.monthlyBurn),
    },
    unitEconomics: {
      cac: valeurOuNull(ue?.estimatedCAC),
      ltv: valeurOuNull(ue?.estimatedLTV),
      ratioLtvCac: valeurOuNull(ue?.estimatedLtvCacRatio),
      contratMoyen: valeurOuNull(ue?.averageContractValue),
      margeUnitaire: valeurOuNull(ue?.grossMarginPerUnit),
    },
    series: {
      revenu: lireSerie(financialData.revenueProjection, 'M€'),
      margeBrute: lireSerie(financialData.grossMarginProjection, '% de marge brute'),
      ebitda: lireSerie(financialData.ebitdaProjection, 'M€'),
      fcf: lireSerie(financialData.fcfProjection, 'M€'),
      opex: lireSerie(financialData.opexProjection, 'M€ de charges operationnelles'),
      effectifs: lireSerie(financialData.headcount, 'effectifs'),
    },
    notes: valeurOuNull(financialData.rawNotes),
  };
}

/**
 * Vrai quand le bloc financier existe mais ne porte aucune valeur.
 * Sert a distinguer, dans le prompt comme dans le verdict, le dossier
 * qui n a pas fourni de donnees du dossier dont les donnees n ont pas
 * ete lues.
 */
export function readoutEstVide(r: FinancialReadout): boolean {
  if (!r.present) return true;
  const chaines = [
    r.tour.montant, r.tour.runwayMois, r.tour.burnMensuel,
    r.unitEconomics.cac, r.unitEconomics.ltv, r.unitEconomics.ratioLtvCac,
    r.unitEconomics.contratMoyen, r.unitEconomics.margeUnitaire,
    r.notes,
  ];
  if (chaines.some((v) => v !== null)) return false;
  return Object.values(r.series).every((s) => s === null);
}

function rendreSerie(nom: string, s: SerieAnnuelle | null): string | null {
  if (!s) return null;
  const points = s.points.map((p) => `${p.annee}: ${p.valeur}`).join(' · ');
  return `- ${nom} (${s.unite}) : ${points}`;
}

/**
 * Rend le bloc financier du prompt utilisateur, commun aux patterns.
 *
 * Les trois etats d absence sont nommes separement. C est le point de
 * la correction autant que la lecture elle-meme : la phrase unique qui
 * disait « aucune donnee structurelle disponible » etait vraie quand
 * le snapshot etait vide, et elle l etait pour la mauvaise raison. Un
 * lecteur du prompt genere concluait a un dossier pauvre la ou il
 * fallait conclure a un lecteur qui regardait au mauvais endroit, et
 * rien dans la sortie ne permettait de trancher.
 */
export function renderFinancialReadout(r: FinancialReadout): string {
  if (!r.present) {
    return '(aucun bloc de donnees financieres n a ete extrait de ce dossier : '
      + 'ni business plan, ni tableau chiffre dans le deck)';
  }
  if (readoutEstVide(r)) {
    return '(le bloc de donnees financieres existe mais ne porte aucune valeur : '
      + 'le dossier a ete instruit sans chiffres exploitables)';
  }

  const lignes: Array<string | null> = [
    r.tour.montant !== null ? `- Tour en cours : ${r.tour.montant}` : null,
    r.tour.runwayMois !== null ? `- Runway declare : ${r.tour.runwayMois} mois` : null,
    r.tour.burnMensuel !== null ? `- Burn mensuel declare : ${r.tour.burnMensuel}` : null,
    rendreSerie('Revenu', r.series.revenu),
    rendreSerie('Marge brute', r.series.margeBrute),
    rendreSerie('EBITDA', r.series.ebitda),
    rendreSerie('Free cash flow', r.series.fcf),
    rendreSerie('Charges operationnelles', r.series.opex),
    rendreSerie('Effectifs', r.series.effectifs),
    r.unitEconomics.cac !== null ? `- CAC estime : ${r.unitEconomics.cac}` : null,
    r.unitEconomics.ltv !== null ? `- LTV estimee : ${r.unitEconomics.ltv}` : null,
    r.unitEconomics.ratioLtvCac !== null ? `- Ratio LTV/CAC : ${r.unitEconomics.ratioLtvCac}` : null,
    r.unitEconomics.contratMoyen !== null ? `- Contrat moyen : ${r.unitEconomics.contratMoyen}` : null,
    r.unitEconomics.margeUnitaire !== null ? `- Marge unitaire : ${r.unitEconomics.margeUnitaire}` : null,
    r.notes !== null ? `- Notes d extraction : ${r.notes}` : null,
  ];

  const corps = lignes.filter((l): l is string => l !== null).join('\n');
  const provenance = `(source : ${r.fileSource ?? 'non declaree'}, business plan ${r.hasBP ? 'fourni' : 'absent'})`;

  // La provenance suit ce qu elle fonde et ne le precede pas. Elle
  // etablit d ou viennent les chiffres, elle ne les limite pas.
  return `${corps}\n${provenance}`;
}

/**
 * Ce que les engagements hors bilan exigeraient et que l extraction ne
 * produit pas. Expose pour que le prompt puisse le declarer au modele
 * plutot que de le laisser deviner qu il n a rien recu sur cet axe.
 *
 * L axe identitaire de Fixed Cost Trap porte sur les engagements
 * contractuels long terme non resiliables. Aucun champ du contrat ne
 * les porte : ni les baux, ni les minima fournisseurs, ni le capex
 * engage. Le modele doit donc savoir qu il lit un dossier sur cet axe
 * par la prose seule, et non conclure de leur absence qu ils n existent
 * pas.
 */
export const AVERTISSEMENT_ENGAGEMENTS_NON_EXTRAITS =
  'Aucun champ structure du dossier ne porte les engagements contractuels '
  + 'long terme (baux, minima fournisseurs, capex engage, engagements hors '
  + 'bilan) : le moteur d extraction financiere ne les cherche pas encore. '
  + 'Leur absence dans les donnees ci-dessus n est donc pas une information '
  + 'sur le dossier. Si tu raisonnes sur cet axe, fonde-le sur la prose du '
  + 'pitch, du produit et du modele economique, et dis-le.';
