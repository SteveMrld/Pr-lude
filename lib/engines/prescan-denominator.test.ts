// ============================================================
// Tests deterministes du denominateur du pre-scan
// ------------------------------------------------------------
// Ce que ces tests prouvent : le total est le nombre de tests demandes
// et non rendus, un test omis par le modele pese contre le dossier au
// lieu de le favoriser, et une defaillance du dispositif ne se convertit
// jamais en elimination.
//
// Le defaut ferme : `totalTests = validatedTests.length || (fundProfile
// ? 10 : 6)`. Un test omis ne pouvait pas echouer et retirait en meme
// temps une unite au denominateur, donc l omission remontait le ratio.
// Quatre pre-scans du corpus ont ete juges sur neuf tests et un sur
// huit sans que rien ne le signale.
// ============================================================

import { assemblerPreScan, type PreScanRawResponse, type FundProfile } from './prescan-engine';
import type { DossierFacts } from './prescan-fit';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const PROFIL: FundProfile = {
  sectorsFocus: ['Fintech'], sectorsExcluded: [],
  geographiesFocus: ['France'], geographiesExcluded: [],
  ticketMinEur: 1_000_000, ticketMaxEur: 5_000_000,
  stagesFocus: ['seed'], notes: null,
};

const cite = <T,>(value: T) => ({ value, evidence: 'page 4 : citation' });
const FAITS_COMPLETS: DossierFacts = {
  sector: cite('Fintech'), geography: cite('France'),
  stage: cite('seed'), ticketEur: cite(2_000_000),
} as DossierFacts;

const JUGEMENTS = ['narrative', 'founder', 'financial', 'market', 'thesis_fit'];

function reponse(
  statuts: Record<string, 'pass' | 'warn' | 'fail'>,
  facts: DossierFacts = FAITS_COMPLETS,
): PreScanRawResponse {
  return {
    summary: 'Synthese de test.',
    tests: Object.entries(statuts).map(([id, status]) => ({
      id, name: id, status, rationale: 'rationale', evidence: 'evidence',
    })) as any,
    dossierFacts: facts,
  };
}

const TOUS_PASS = Object.fromEntries(JUGEMENTS.map(id => [id, 'pass' as const]));

(() => {
  // ============================================================
  console.log('\n[Suite 1] le denominateur ne bouge pas');
  // ============================================================
  {
    const complet = assemblerPreScan(reponse(TOUS_PASS), PROFIL);
    check(complet.totalTests === 10, 'dix tests demandes avec profil');
    check(complet.tests.length === 10, 'dix tests rendus dans la liste');

    const sansProfil = assemblerPreScan(reponse(TOUS_PASS));
    check(sansProfil.totalTests === 6, 'six tests demandes sans profil');
    check(sansProfil.tests.every(t => !['sector_fit', 'geography_fit', 'ticket_fit', 'stage_fit'].includes(t.id)),
      'les quatre tests de these ne sont pas demandes sans profil');
  }
  {
    // Le coeur du bloc : le modele omet un test, le total ne bouge pas.
    const partiel = { ...TOUS_PASS };
    delete (partiel as any).market;
    const r = assemblerPreScan(reponse(partiel), PROFIL);
    check(r.totalTests === 10, 'un test omis ne retire rien au denominateur');
    check(r.tests.length === 10, 'le test omis figure quand meme dans la liste');
    const omis = r.tests.find(t => t.id === 'market')!;
    check(omis.status === 'not_produced', 'il est declare non produit');
    check(omis.nonProductionCause === 'incident', 'de cause incident : le modele devait le rendre');
  }
  {
    // La demonstration du defaut ferme : sous l ancienne forme, omettre
    // un test remontait le score. Sous la nouvelle, il le baisse.
    const complet = assemblerPreScan(reponse(TOUS_PASS), PROFIL);
    const ampute = { ...TOUS_PASS };
    delete (ampute as any).founder;
    const r = assemblerPreScan(reponse(ampute), PROFIL);
    check(r.score < complet.score, 'omettre un test baisse le score au lieu de le remonter');
    check(r.totalTests === complet.totalTests, 'a denominateur egal');
  }
  {
    const aucun = assemblerPreScan(reponse({}), PROFIL);
    check(aucun.totalTests === 10, 'aucun test de jugement rendu : le total reste dix');
    check(aucun.notProducedTests.length === 5, 'les cinq jugements sont declares non produits');
    check(aucun.notProducedTests.every(t => t.cause === 'incident'), 'tous de cause incident');
  }

  // ============================================================
  console.log('\n[Suite 2] un incident n elimine pas');
  // ============================================================
  {
    // Cinq jugements omis sur dix tests : le ratio tombe a 0,5 au mieux,
    // et sous l ancienne regle un ratio sous 0,5 eliminait. Un incident
    // du dispositif ne doit pas produire une decision doctrinale.
    const r = assemblerPreScan(reponse({}), PROFIL);
    check(r.hasProductionIncident === true, 'l incident est signale');
    check(r.recommendation !== 'not_recommended',
      'aucune elimination alors que la moitie des tests manque');
  }
  {
    // Mais le couperet critique reste, sur un echec reel.
    const r = assemblerPreScan(reponse({ ...TOUS_PASS, founder: 'fail' }), PROFIL);
    check(r.recommendation === 'not_recommended',
      'un echec reel sur un test critique elimine toujours');
  }
  {
    // Et un echec critique elimine meme en presence d un incident : la
    // regle protege des defaillances, elle n absout pas les echecs.
    const avecIncident = { founder: 'fail' as const };
    const r = assemblerPreScan(reponse(avecIncident), PROFIL);
    check(r.hasProductionIncident === true, 'incident present');
    check(r.recommendation === 'not_recommended', 'l echec critique prime sur l incident');
  }
  {
    // Une non-production de cause absence ne peut pas davantage
    // eliminer : le deck qui ne dit rien n est pas un deck qui echoue.
    const sansFaits = assemblerPreScan(
      reponse(TOUS_PASS, { sector: { value: null, evidence: null }, geography: { value: null, evidence: null }, stage: { value: null, evidence: null }, ticketEur: { value: null, evidence: null } } as DossierFacts),
      PROFIL,
    );
    const causes = new Set(sansFaits.notProducedTests.map(t => t.cause));
    check(causes.has('absence') && !causes.has('incident'),
      'faits absents : cause absence, aucun incident');
    check(sansFaits.recommendation !== 'not_recommended',
      'un deck muet sur ses faits n est pas elimine par le score');
  }

  // ============================================================
  console.log('\n[Suite 3] le verdict favorable exige que tout ait conclu');
  // ============================================================
  {
    const parfait = assemblerPreScan(reponse(TOUS_PASS), PROFIL);
    check(parfait.recommendation === 'ready_for_pipeline', 'dix tests concluants : verdict favorable');
    const troue = { ...TOUS_PASS };
    delete (troue as any).financial;
    const r = assemblerPreScan(reponse(troue), PROFIL);
    check(r.recommendation !== 'ready_for_pipeline',
      'un test non produit interdit le verdict favorable, meme a bon score');
  }

  // ============================================================
  console.log('\n[Suite 4] la sortie reste lisible sur pieces');
  // ============================================================
  {
    const r = assemblerPreScan(reponse(TOUS_PASS), PROFIL);
    check(r.dossierFacts.sector.value === 'Fintech', 'les faits extraits sont conserves');
    check(r.dossierFacts.sector.evidence === 'page 4 : citation', 'avec leur citation');
    check(r.failedTests.length === 0, 'aucun echec sur ce dossier');
    const ordre = r.tests.map(t => t.id).join(',');
    check(ordre.startsWith('narrative,founder,financial,stage_ticket,market,thesis_fit'),
      'l ordre d affichage ne depend plus de la discipline du modele');
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})();
