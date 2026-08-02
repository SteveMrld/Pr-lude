// ============================================================
// Tests deterministes des comparaisons du pre-scan
// ------------------------------------------------------------
// Ce que ces tests prouvent : les cinq tests sortis du jugement rendent
// desormais le meme verdict a chaque appel, une donnee absente ou non
// citee ne produit pas de verdict au lieu d en produire un faux, et le
// cas qui a ouvert la grappe ne se reproduit pas.
//
// Le cas fondateur est celui du 2 aout 2026. Le profil du fonds porte
// Consumer et E-commerce parmi vingt-six secteurs cibles, n exclut
// aucun secteur, ne filtre aucun stade et couvre les tickets de 500
// euros a 15 millions. Le pre-scan a pourtant elimine In Haircare au
// motif que le consumer beauty serait absent de la these. La suite 5
// rejoue ce dossier contre le profil reel.
// ============================================================

import {
  evaluerSectorFit, evaluerGeographyFit, evaluerTicketFit,
  evaluerStageFit, evaluerStageTicket, evaluerComparaisons,
  type DossierFacts, type FitProfile,
} from './prescan-fit';
import { zoneCouvertePar, secteursVoisins, stadesVoisins, SECTORS } from '../fund-profile/vocabulary';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

function faits(p: Partial<DossierFacts> = {}): DossierFacts {
  const vide = { value: null, evidence: null };
  return {
    companyName: vide, sector: vide, geography: vide, stage: vide, ticketEur: vide, ...p,
  } as DossierFacts;
}
const cite = <T,>(value: T) => ({ value, evidence: 'page 3 : citation du deck' });

const PROFIL_GENERALISTE: FitProfile = {
  sectorsFocus: [], sectorsExcluded: [], geographiesFocus: [],
  geographiesExcluded: [], ticketMinEur: null, ticketMaxEur: null, stagesFocus: [],
};

// Le profil reel de l organisation, lu en base le 2 aout 2026.
const PROFIL_REEL: FitProfile = {
  sectorsFocus: [...SECTORS],
  sectorsExcluded: [],
  geographiesFocus: ['France', 'Europe (UE)', 'Monde'],
  geographiesExcluded: [],
  ticketMinEur: 500,
  ticketMaxEur: 15_000_000,
  stagesFocus: [],
};

(() => {
  // ============================================================
  console.log('\n[Suite 1] un fait sans citation ou hors vocabulaire ne produit pas de verdict');
  // ============================================================
  {
    const t = evaluerSectorFit(faits({ sector: { value: 'Fintech', evidence: null } }), PROFIL_REEL);
    check(t.status === 'not_produced', 'secteur sans citation : aucun verdict');
    check(t.nonProductionCause === 'absence', 'la cause est absence, personne n a echoue');
  }
  {
    const t = evaluerSectorFit(faits({ sector: cite('Biotechnologies marines') }), PROFIL_REEL);
    check(t.status === 'not_produced', 'secteur hors vocabulaire : aucun verdict');
    check(t.rationale.includes('hors du vocabulaire'), 'le motif nomme la cause exacte');
  }
  {
    const t = evaluerStageFit(faits(), { ...PROFIL_REEL, stagesFocus: ['seed'] });
    check(t.status === 'not_produced', 'stade absent alors que le fonds en cible un : aucun verdict');
  }
  {
    const t = evaluerTicketFit(faits({ ticketEur: cite(-5) }), PROFIL_REEL);
    check(t.status === 'not_produced', 'montant negatif : aucun verdict plutot qu un verdict faux');
  }
  {
    // La regle la plus importante de la suite : une comparaison sur une
    // valeur incertaine ne vaut pas mieux qu un jugement. Aucun test non
    // produit ne doit pouvoir eliminer.
    const contraint: FitProfile = {
      ...PROFIL_REEL, sectorsExcluded: ['Tabac'], geographiesExcluded: ['Russie'],
      stagesFocus: ['seed'],
    };
    const tous = evaluerComparaisons(faits(), contraint);
    check(tous.length === 5, 'cinq comparaisons produites meme sans aucun fait');
    check(tous.every(t => t.status === 'not_produced'), 'aucune ne rend de verdict quand le fonds contraint');
    check(tous.every(t => t.status !== 'fail'), 'aucune n elimine sur une donnee absente');
    // Symetrie : quand le fonds ne contraint rien, l absence de fait est
    // sans effet et le test conclut, parce que le verdict ne depend pas
    // du dossier.
    const ouvert = evaluerComparaisons(faits(), PROFIL_GENERALISTE);
    const sansStadeTicket = ouvert.filter(t => t.id !== 'stage_ticket');
    check(sansStadeTicket.every(t => t.status === 'pass'),
      'these sans contrainte : les quatre fits concluent sans avoir besoin du dossier');
  }

  // ============================================================
  console.log('\n[Suite 2] le secteur, exclusion, cible, voisinage');
  // ============================================================
  {
    const p = { ...PROFIL_REEL, sectorsExcluded: ['Tabac'] };
    check(evaluerSectorFit(faits({ sector: cite('Tabac') }), p).status === 'fail',
      'secteur explicitement exclu : echec');
  }
  {
    check(evaluerSectorFit(faits({ sector: cite('Tabac') }), PROFIL_GENERALISTE).status === 'pass',
      'aucun secteur cible declare : rien ne peut etre hors these');
  }
  {
    check(evaluerSectorFit(faits({ sector: cite('Fintech') }), PROFIL_REEL).status === 'pass',
      'secteur present dans la cible : succes');
  }
  {
    const p = { ...PROFIL_REEL, sectorsFocus: ['Consumer'] };
    const t = evaluerSectorFit(faits({ sector: cite('E-commerce') }), p);
    check(t.status === 'warn', 'secteur voisin de la cible : alerte et non elimination');
    check(t.rationale.includes('Consumer'), 'l alerte nomme le secteur cible touche');
  }
  {
    const p = { ...PROFIL_REEL, sectorsFocus: ['Biotech'] };
    check(evaluerSectorFit(faits({ sector: cite('Tabac') }), p).status === 'fail',
      'secteur ni cible ni voisin : echec');
  }

  // ============================================================
  console.log('\n[Suite 3] la geographie raisonne par inclusion, pas par egalite');
  // ============================================================
  {
    check(zoneCouvertePar('France', 'Europe (UE)') === true, 'la France est dans l Union');
    check(zoneCouvertePar('Europe (UE)', 'France') === false, 'l Union n est pas dans la France');
    check(zoneCouvertePar('France', 'France') === true, 'egalite comprise');
  }
  {
    const p = { ...PROFIL_REEL, geographiesFocus: ['Europe (UE)'] };
    const t = evaluerGeographyFit(faits({ geography: cite('France') }), p);
    check(t.status === 'pass', 'un dossier francais entre dans une these europeenne');
    check(t.rationale.includes('couverte par'), 'la couverture est nommee et non supposee');
  }
  {
    const p = { ...PROFIL_REEL, geographiesFocus: ['France'] };
    check(evaluerGeographyFit(faits({ geography: cite('Europe (UE)') }), p).status === 'fail',
      'une these francaise ne couvre pas un dossier europeen indistinct');
  }
  {
    const p = { ...PROFIL_REEL, geographiesFocus: ['Monde'], geographiesExcluded: ['Asie'] };
    check(evaluerGeographyFit(faits({ geography: cite('Chine') }), p).status === 'fail',
      'l exclusion se propage aux zones qu elle contient');
    check(evaluerGeographyFit(faits({ geography: cite('France') }), p).status === 'pass',
      'et ne deborde pas sur les autres');
  }

  // ============================================================
  console.log('\n[Suite 4] ticket et stade, bornes et adjacence');
  // ============================================================
  {
    const p = { ...PROFIL_REEL, ticketMinEur: 1_000_000, ticketMaxEur: 5_000_000 };
    check(evaluerTicketFit(faits({ ticketEur: cite(400_000) }), p).status === 'fail', 'sous la moitie du minimum : echec');
    check(evaluerTicketFit(faits({ ticketEur: cite(700_000) }), p).status === 'warn', 'entre la moitie et le minimum : alerte');
    check(evaluerTicketFit(faits({ ticketEur: cite(3_000_000) }), p).status === 'pass', 'dans la plage : succes');
    check(evaluerTicketFit(faits({ ticketEur: cite(8_000_000) }), p).status === 'warn', 'entre le maximum et son double : alerte');
    check(evaluerTicketFit(faits({ ticketEur: cite(12_000_000) }), p).status === 'fail', 'plus du double du maximum : echec');
  }
  {
    check(evaluerTicketFit(faits({ ticketEur: cite(50_000_000) }), PROFIL_GENERALISTE).status === 'pass',
      'aucune borne declaree : aucun ticket hors gamme');
  }
  {
    check(stadesVoisins('seed', 'series-a') === true, 'seed et series-a se touchent');
    check(stadesVoisins('seed', 'series-b') === false, 'seed et series-b non');
    const p = { ...PROFIL_REEL, stagesFocus: ['series-a', 'series-b'] };
    check(evaluerStageFit(faits({ stage: cite('series-a') }), p).status === 'pass', 'stade investi : succes');
    check(evaluerStageFit(faits({ stage: cite('seed') }), p).status === 'warn', 'stade adjacent : alerte');
    check(evaluerStageFit(faits({ stage: cite('pre-IPO') }), p).status === 'fail', 'stade eloigne : echec');
    check(evaluerStageFit(faits({ stage: cite('pre-IPO') }), PROFIL_GENERALISTE).status === 'pass',
      'aucun stade declare : aucun stade hors these');
  }
  {
    // Les deux exemples que le prompt donnait, desormais calcules.
    check(evaluerStageTicket(faits({ stage: cite('seed'), ticketEur: cite(20_000_000) })).status === 'fail',
      'un seed qui demande vingt millions : echec');
    check(evaluerStageTicket(faits({ stage: cite('series-a'), ticketEur: cite(500_000) })).status === 'fail',
      'une series-a qui demande cinq cent mille : echec');
    check(evaluerStageTicket(faits({ stage: cite('seed'), ticketEur: cite(2_000_000) })).status === 'pass',
      'un seed a deux millions : coherent');
    check(evaluerStageTicket(faits({ stage: cite('seed'), ticketEur: cite(6_000_000) })).status === 'warn',
      'un seed a six millions : decalage sans absurdite');
    check(evaluerStageTicket(faits({ stage: cite('seed') })).status === 'not_produced',
      'stade connu mais ticket absent : aucun verdict');
  }

  // ============================================================
  console.log('\n[Suite 5] le dossier qui a ouvert la grappe');
  // ============================================================
  {
    // In Haircare, tel que le deck le donne : marque de soins
    // capillaires francaise, 800k euros de besoin, stade non revendique.
    const inHaircare = faits({
      sector: cite('Consumer'),
      geography: cite('France'),
      ticketEur: cite(800_000),
    });
    const tests = evaluerComparaisons(inHaircare, PROFIL_REEL);
    const parId = new Map(tests.map(t => [t.id, t]));

    check(parId.get('sector_fit')!.status === 'pass',
      'sector_fit : Consumer figure parmi les secteurs cibles, donc succes');
    check(parId.get('geography_fit')!.status === 'pass',
      'geography_fit : la France est ciblee');
    check(parId.get('ticket_fit')!.status === 'pass',
      'ticket_fit : 800k est dans la gamme 500 a 15M');
    check(parId.get('stage_fit')!.status === 'pass',
      'stage_fit : le fonds ne restreint aucun stade');
    check(parId.get('stage_ticket')!.status === 'not_produced',
      'stage_ticket : le stade n est pas revendique, donc aucun verdict');
    check(tests.every(t => t.status !== 'fail'),
      'aucune comparaison n elimine ce dossier, contre quatre echecs le 2 aout');
  }
  {
    // Et la propriete qui manquait : deux evaluations du meme dossier
    // rendent le meme resultat, sans appel au modele.
    const d = faits({ sector: cite('Consumer'), geography: cite('France'), ticketEur: cite(800_000) });
    const a = JSON.stringify(evaluerComparaisons(d, PROFIL_REEL));
    const b = JSON.stringify(evaluerComparaisons(d, PROFIL_REEL));
    check(a === b, 'deux evaluations identiques rendent exactement la meme sortie');
  }

  // ============================================================
  console.log('\n[Suite 6] perimetre et symetrie');
  // ============================================================
  {
    check(evaluerComparaisons(faits(), null).length === 1,
      'sans profil, seule la coherence stade contre ticket s applique');
    check(evaluerComparaisons(faits(), PROFIL_REEL).length === 5,
      'avec profil, cinq comparaisons');
    check(secteursVoisins('E-commerce', 'Consumer') === secteursVoisins('Consumer', 'E-commerce'),
      'le voisinage sectoriel est symetrique');
    check(secteursVoisins('Consumer', 'Consumer') === false,
      'un secteur n est pas son propre voisin, l egalite se traite avant');
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})();
