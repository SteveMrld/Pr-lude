// ============================================================
// Tests deterministes du canal de cause du pre-scan
// ------------------------------------------------------------
// Ce que ces tests prouvent : la cause declaree par le modele n est
// plus ecrasee, elle est contrainte aux trois valeurs du vocabulaire
// avec repli sur incident, et `doctrine` ne s accorde jamais sur
// declaration.
//
// LE DEFAUT FERME
//
// `assemblerPreScan` posait `nonProductionCause: null` sur tous les
// tests venus du modele. Le canal etait cloue : un test rendu
// `not_produced` perdait sa cause avant que quiconque puisse la lire, et
// le repli de sortie la rattrapait en `absence`. Une panne sortait donc
// en donnee manquante, du cote qui ne demande aucune reparation, ce qui
// est le patron exact que le vocabulaire de non-production a ete ecrit
// pour fermer.
//
// POURQUOI DOCTRINE SE REFUSE
//
// `incident` et `absence` declarent un manque et coutent quelque chose a
// qui les declare : le fait remonte, le test reste du. `doctrine`
// declare que la question ne se posait pas et retire le test du
// denominateur, donc il dispense de repondre sans rien couter. Un etat
// gratuit qui libere d une obligation est atteint par le chemin le moins
// couteux, et le chemin le moins couteux est de le declarer. Rien dans
// la sortie ne distinguerait la dispense legitime de la dispense de
// confort, donc la doctrine se derive cote code, et aucune regle du
// pre-scan n en derive aujourd hui.
//
// CE QUE CES TESTS NE PROUVENT PAS
//
// Aucun prompt du pre-scan n offre le champ de cause au modele : le
// format de reponse ne le mentionne pas. Ces tests etablissent donc que
// le code traite correctement une declaration, pas que le modele en
// produise. `causeDeclaree` existe pour que la question se mesure au
// premier run plutot que de se supposer ici.
//
// Execution : npx tsx lib/engines/prescan-cause-declaree.test.ts
// ============================================================

import { assemblerPreScan, type PreScanRawResponse } from './prescan-engine';
import type { DossierFacts } from './prescan-fit';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const cite = <T,>(value: T) => ({ value, evidence: 'page 4 : citation' });
const FAITS: DossierFacts = {
  companyName: cite('Acme SAS'),
  sector: cite('Fintech'), geography: cite('France'),
  stage: cite('seed'), ticketEur: cite(2_000_000),
} as DossierFacts;

const JUGEMENTS = ['narrative', 'founder', 'financial', 'market', 'thesis_fit'];

/**
 * Les cinq tests de jugement, tous `pass`, sauf celui dont on veut
 * eprouver la cause. Entree par la porte de production : c est
 * `assemblerPreScan` que le moteur appelle, non une copie de sa logique.
 */
function reponse(id: string, surcharge: Record<string, unknown>): PreScanRawResponse {
  return {
    summary: 'Synthese de test.',
    tests: JUGEMENTS.map(t => (t === id
      ? { id: t, name: t, status: 'not_produced', rationale: 'r', evidence: 'e', ...surcharge }
      : { id: t, name: t, status: 'pass', rationale: 'r', evidence: 'e' })),
    dossierFacts: FAITS,
  } as PreScanRawResponse;
}

function testDe(r: ReturnType<typeof assemblerPreScan>, id: string) {
  return r.tests.find(t => t.id === id)!;
}

(() => {
  // ============================================================
  console.log('\n[Suite 1] la cause declaree n est plus ecrasee');
  // ============================================================
  {
    const r = assemblerPreScan(reponse('market', { nonProductionCause: 'absence' }));
    const t = testDe(r, 'market');
    check(t.nonProductionCause === 'absence',
      'une declaration d absence survit a l assemblage');
    check(t.causeDeclaree === 'absence',
      'la declaration brute est conservee a cote de la decision');
    check(r.notProducedTests.find(x => x.id === 'market')?.cause === 'absence',
      'la sortie porte la meme cause que le test');
    check(r.hasProductionIncident === false,
      'une absence declaree ne leve pas de drapeau d incident');
  }
  {
    const r = assemblerPreScan(reponse('financial', { nonProductionCause: 'incident' }));
    const t = testDe(r, 'financial');
    check(t.nonProductionCause === 'incident', 'une declaration d incident survit');
    check(r.hasProductionIncident === true, 'et elle leve le drapeau d incident');
  }

  // ============================================================
  console.log('\n[Suite 2] doctrine ne s accorde pas sur declaration');
  // ============================================================
  {
    const r = assemblerPreScan(reponse('narrative', { nonProductionCause: 'doctrine' }));
    const t = testDe(r, 'narrative');
    check(t.nonProductionCause === 'incident',
      'une declaration de doctrine est refusee et retombe sur incident');
    check(t.causeDeclaree === 'doctrine',
      'le refus laisse une trace, sans quoi il ne se compterait pas');
    check(r.hasProductionIncident === true,
      'le test reste du a quelqu un, donc le fait remonte');
    check(r.totalTests === 6,
      'et il reste au denominateur : la dispense n est pas accordee');
  }

  // ============================================================
  console.log('\n[Suite 3] le repli tombe du cote qui coute');
  // ============================================================
  {
    // Aucune cause declaree, ce qui est le cas de tous les runs
    // actuels puisque le prompt n offre pas le champ.
    const r = assemblerPreScan(reponse('founder', {}));
    const t = testDe(r, 'founder');
    check(t.nonProductionCause === 'incident',
      'sans declaration, le repli est incident et non absence');
    check(t.causeDeclaree === null,
      'et la trace dit qu il n y avait rien a lire');
  }
  {
    const r = assemblerPreScan(reponse('market', { nonProductionCause: 'peu importe' }));
    check(testDe(r, 'market').nonProductionCause === 'incident',
      'une valeur hors vocabulaire retombe sur incident');
    check(testDe(r, 'market').causeDeclaree === 'peu importe',
      'la valeur refusee reste lisible telle quelle');
  }
  {
    const r = assemblerPreScan(reponse('market', { nonProductionCause: 42 }));
    check(testDe(r, 'market').nonProductionCause === 'incident',
      'une cause qui n est pas une chaine retombe sur incident');
    check(testDe(r, 'market').causeDeclaree === null,
      'et ne se conserve pas, faute d etre une declaration lisible');
  }

  // ============================================================
  console.log('\n[Suite 4] un test qui a rendu n a pas de cause');
  // ============================================================
  {
    // Le modele rend un verdict ET une cause. La cause repond a la
    // question de savoir pourquoi rien n a ete produit, et il a
    // produit : elle n a pas d objet.
    const brut = reponse('market', {});
    brut.tests = brut.tests.map(t => (t.id === 'narrative'
      ? { ...t, status: 'fail' as const, nonProductionCause: 'doctrine' as any }
      : t));
    const r = assemblerPreScan(brut);
    const rendu = testDe(r, 'narrative');
    check(rendu.status === 'fail', 'le verdict rendu est conserve');
    check(rendu.nonProductionCause === null,
      'un test qui a rendu porte une cause nulle, quoi qu il declare');
    check(rendu.causeDeclaree === 'doctrine',
      'sa declaration reste lisible, sans avoir d effet');
    check(r.failedTests.includes('narrative'),
      'et le fail continue de compter comme un fail');
  }

  // ============================================================
  console.log('\n[Suite 5] les comparaisons calculees ne passent pas par la');
  // ============================================================
  {
    // Les tests de fit sont produits par le code et non par le modele.
    // Une declaration du modele sur leur identifiant ne doit pas les
    // atteindre, sans quoi il pourrait se dispenser d un test qu il ne
    // produit meme pas.
    const r = assemblerPreScan(reponse('market', {}));
    const calcules = r.tests.filter(t => !JUGEMENTS.includes(t.id));
    check(calcules.length > 0, 'des tests calcules figurent bien dans la sortie');
    check(calcules.every(t => t.causeDeclaree === undefined),
      'aucun ne porte de declaration, le canal ne les traverse pas');
  }
})();

console.log(`\n${pass} OK, ${fail} KO`);
process.exit(fail > 0 ? 1 : 0);
