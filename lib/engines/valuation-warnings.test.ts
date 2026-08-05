// ============================================================
// Tests deterministes des warnings du moteur Valorisation
// ------------------------------------------------------------
// Ce que ces tests prouvent : le bloc de warnings decrit ce qui a
// reellement ete calcule, et rien d autre.
//
// Le defaut ferme : le warning d inapplicabilite des multiples se
// lisait sur input.financialData.hasBP, la presence d un fichier BP,
// alors que l application des multiples ne passe pas par ce predicat.
// extractBaseMetric ne regarde que le contenu de revenueProjection et
// de la traction extraite. Un dossier sans BP mais avec une projection
// exploitable imprimait donc "les multiples sectoriels n ont pas pu
// etre appliques" sous une fourchette de multiples effective. Deux
// criteres pour une meme question, et le lecteur de la note tranchait
// entre le warning et le tableau.
//
// Deux faussetes voisines tombent avec : la fourchette n est pas
// "basee uniquement sur les methodes qualitatives" quand la VC inverse
// a produit un resultat, et Berkus / Scorecard ne portent rien au-dela
// du seed ou ils sont non applicables par construction.
// ============================================================

import { computeValuation } from './valuation-engine';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// Millesime fige. Le fixture calculait son annee sur
// new Date().getFullYear() pour tomber sur la branche d horloge du
// moteur, branche qui n existe plus : la base des multiples se lit
// desormais sur le dernier exercice qualifie de realise, a defaut sur
// la derniere annee anterieure a la reception du dossier. Un test qui
// derive son fixture de l horloge ne peut pas exercer une regle qui
// l a bannie, et surtout il change de sens au passage de chaque annee
// civile.
const BASE_YEAR = 2024;

function buildInput(opts: {
  stage: string;
  ticket?: string;
  hasBP?: boolean;
  revenueProjection?: Array<{ year: string; value: number; source: string }>;
  tractionRevenue?: string;
  /** Millesime declare realise par le deck, avec sa citation. Absent,
   *  le moteur bascule sur asOf puis sur le refus. */
  lastActualYear?: number;
  asOf?: string;
}): any {
  return {
    extraction: {
      sector: 'saas b2b',
      fundraise: { stage: opts.stage, amount: opts.ticket ?? '3M EUR' },
      traction: opts.tractionRevenue ? { revenue: opts.tractionRevenue, metrics: [] } : { metrics: [] },
    },
    financial: null,
    financialData: {
      hasBP: opts.hasBP ?? false,
      fileSource: opts.hasBP ? 'bp' : 'deck',
      revenueProjection: opts.revenueProjection ?? [],
      grossMarginProjection: [],
      ebitdaProjection: [],
      fcfProjection: [],
      headcount: [],
      opexProjection: [],
      lastActualYear: opts.lastActualYear ?? null,
      lastActualYearEvidence: opts.lastActualYear
        ? `Tableau P&L slide 9 : colonne ${opts.lastActualYear} qualifiee realise.`
        : null,
    },
    team: null,
    market: null,
    teamScore: 60,
    marketScore: 55,
    relevanceMatrix: { assetClass: 'saas-b2b' },
    asOf: opts.asOf ?? null,
  };
}

const INAPPLICABILITE = /multiples sectoriels n ont pas pu/i;
const QUALITATIF_SEUL = /Aucune méthode quantitative n a abouti/i;

console.log('\n[Suite 1] dossier sans fichier BP mais avec projection exploitable');

{
  // Le cas reel : hasBP false, revenueProjection peuplee par le moteur
  // financial-extraction-engine depuis le deck. Les multiples
  // s appliquent, donc le warning d inapplicabilite ment.
  const out = computeValuation(buildInput({
    stage: 'series-a',
    hasBP: false,
    revenueProjection: [{ year: String(BASE_YEAR), value: 2, source: 'deck' }],
    lastActualYear: BASE_YEAR,
  }));

  const multiples = out.methods.find((m) => m.method === 'sector-multiples');
  check(multiples?.applicable === true, 'les multiples sectoriels ont produit une fourchette');
  // Deux methodes applicables de natures differentes, multiples en
  // valeur d entreprise et VC inverse en pre-money : deux fourchettes
  // consolidees, et aucune fourchette unique. recommendedRange portait
  // auparavant leur moyenne ponderee sous une seule etiquette.
  check(out.ranges.length === 2, `deux fourchettes consolidees, une par nature (obtenu ${out.ranges.length})`);
  check(out.recommendedRange === null, 'aucune fourchette unique quand deux natures coexistent');
  check(
    !out.warnings.some((w) => INAPPLICABILITE.test(w)),
    'aucun warning d inapplicabilite des multiples sous un resultat de multiples',
  );
  check(
    !out.warnings.some((w) => /Aucun BP/i.test(w)),
    'le warning ne se prononce plus sur la presence d un fichier BP',
  );
}

console.log('\n[Suite 2] la VC inverse a produit un resultat, la fourchette n est pas qualitative');

{
  // Aucune metrique de revenu : les multiples tombent. La VC inverse,
  // qui n a besoin que du ticket et des exits sectoriels, aboutit.
  const out = computeValuation(buildInput({ stage: 'series-a', ticket: '2M EUR' }));

  const vc = out.methods.find((m) => m.method === 'vc-method');
  const multiples = out.methods.find((m) => m.method === 'sector-multiples');
  check(multiples?.applicable === false, 'les multiples sont bien non applicables sans metrique de revenu');
  check(vc?.applicable === true, 'la VC inverse a produit une fourchette');
  check(
    out.warnings.some((w) => INAPPLICABILITE.test(w)),
    'le warning d inapplicabilite des multiples s affiche quand ils ne produisent rien',
  );
  check(
    !out.warnings.some((w) => QUALITATIF_SEUL.test(w)),
    'aucun warning "uniquement qualitatif" quand une methode quantitative a abouti',
  );
  check(
    !out.warnings.some((w) => /uniquement les méthodes qualitatives|uniquement sur les méthodes qualitatives/i.test(w)),
    'la formule "uniquement les methodes qualitatives" a disparu du cas VC',
  );
}

console.log('\n[Suite 3] au stade series-a, Berkus et Scorecard ne portent rien');

{
  const out = computeValuation(buildInput({ stage: 'series-a', ticket: '2M EUR' }));

  const berkus = out.methods.find((m) => m.method === 'berkus');
  const scorecard = out.methods.find((m) => m.method === 'scorecard');
  check(berkus?.applicable === false, 'Berkus est non applicable en series-a');
  check(scorecard?.applicable === false, 'Scorecard est non applicable en series-a');
  check(
    !out.warnings.some((w) => /berkus|scorecard/i.test(w)),
    'aucun warning ne presente Berkus ou Scorecard comme portant la fourchette',
  );
}

console.log('\n[Suite 4] au seed pre-revenue, les methodes citees sont celles qui contribuent');

{
  // Symetrie du test precedent : quand Berkus et Scorecard portent
  // reellement la fourchette, le warning les nomme.
  const out = computeValuation(buildInput({ stage: 'seed', ticket: '800k EUR' }));

  const contributors = out.methods.filter((m) => m.applicable && m.range).map((m) => m.method);
  check(contributors.includes('berkus'), 'Berkus contribue au seed');
  check(contributors.includes('scorecard'), 'Scorecard contribue au seed');
  check(!contributors.includes('sector-multiples'), 'les multiples ne contribuent pas au seed pre-revenue');
  check(!contributors.includes('vc-method'), 'la VC inverse ne contribue pas au seed pre-revenue');

  const qualitatif = out.warnings.find((w) => QUALITATIF_SEUL.test(w));
  check(qualitatif !== undefined, 'le warning "aucune methode quantitative" s affiche quand c est vrai');
  check(
    !!qualitatif && /Berkus/.test(qualitatif) && /Scorecard/.test(qualitatif),
    'le warning nomme les deux methodes qui portent effectivement la fourchette',
  );
}

console.log('\n[Suite 5] le non-classement nomme une cause et non une alternative');

{
  // Le defaut ferme : le motif valait « sector libelle non couvert ou
  // productionChain indeterminee ». La lecture de deriveAssetClass
  // refute la seconde branche, toute chaine detectee rendant une classe
  // concrete, et sur les deux notes Project Chamois la chaine valait
  // unknown avant comme apres le correctif qui a resolu la classe. Un
  // lecteur suivant le motif serait parti chercher un defaut de
  // detection de chaine qui n existait pas.
  //
  // Le jeu d essai porte un libelle discriminant que rien d autre ne
  // fournit, faute de quoi il ne prouverait pas que le motif lit le
  // libelle du dossier plutot qu une constante.
  const entree = buildInput({ stage: 'series-a' });
  entree.extraction.sector = 'Sylviculture ornementale';
  entree.extraction.subSector = 'Bonsais de competition';
  entree.relevanceMatrix = { assetClass: 'unclassified' };
  const out = computeValuation(entree);

  const motif = out.methods.find((m) => m.method === 'sector-multiples')?.notApplicableReason ?? '';
  const warning = out.warnings.find((w) => /Asset class non reconnue/.test(w)) ?? '';

  check(out.recommendedRange === null, 'aucune fourchette quand la classe n est pas resolue');
  check(/Sylviculture ornementale/.test(motif), 'le motif nomme le libelle sectoriel qui a echoue');
  check(/Sylviculture ornementale/.test(warning), 'le warning nomme le meme libelle');
  check(
    !/productionChain/i.test(motif) && !/productionChain/i.test(warning),
    'ni le motif ni le warning ne renvoient vers la chaine de production',
  );
  check(
    !/couvert ou |ou .*indetermin/i.test(motif),
    'le motif n enonce pas sa cause en alternative',
  );

  // Symetrie : sans aucun libelle, la cause change et le motif le dit,
  // au lieu de citer une chaine vide entre guillemets.
  const nu = buildInput({ stage: 'series-a' });
  nu.extraction.sector = '';
  nu.extraction.subSector = '';
  nu.relevanceMatrix = { assetClass: 'unclassified' };
  const motifNu = computeValuation(nu).methods
    .find((m) => m.method === 'sector-multiples')?.notApplicableReason ?? '';
  check(/aucun libelle sectoriel/.test(motifNu), 'sans libelle, le motif nomme l absence plutot qu une chaine vide');
  check(!/« »/.test(motifNu), 'le motif ne cite pas une chaine vide entre guillemets');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
