// ============================================================
// Tests deterministes du rang de fondation et du regroupement
// ------------------------------------------------------------
// Ce que ces tests prouvent : trois formulations d un meme fait font
// une entree a trois sources, la mention cite le mieux fonde et jamais
// le premier venu, et un jugement de moteur n est jamais cite du tout.
//
// Le cas est celui du run de gel du 3 aout 2026. Quatre evenements
// declares posterieurs, dont trois etaient la meme levee de 83 millions
// d euros de novembre 2023, et un quatrieme qui n etait pas un
// evenement : « Anti-fragilite collective 68/100 (niveau 60-75). Les
// deux fondateurs actifs ont quitte des postes salaries stables dans
// des groupes industriels de premier rang (Johnson Controls, S ». La
// mention servie au partner citait le quatrieme. La reserve etait
// fondee, sa justification etait irrecevable.
//
// Les fixtures reprennent les intitules exacts du run persiste et non
// des phrases reconstruites : une fixture ecrite dans l hypothese qu on
// se fait de la forme des donnees mesure cette hypothese, pas les
// donnees.
//
// Execution : npx tsx lib/engines/operation-validity-faits.test.ts
// ============================================================

import {
  evaluerValiditeOperation,
  regrouperFaits,
  rangDe,
  citable,
  clefDeFait,
  type EvenementDate,
} from './operation-validity';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ------------------------------------------------------------
// Les quatre entrees du run b299ab62, copiees telles quelles.
// ------------------------------------------------------------
const ARTEFACT: EvenementDate = {
  intitule: 'Anti-fragilité collective 68/100 (niveau 60-75). Les deux fondateurs actifs ont quitté des postes salariés stables dans des groupes industriels de premier rang (Johnson Controls, S',
  annee: 2023, mois: 11, nature: 'financement', source: 'web : Crunchbase', luDansLaProse: true,
};
const LEVEE_A: EvenementDate = {
  intitule: "Levée de 83 millions d'euros annoncée en novembre 2023",
  annee: 2023, mois: 11, nature: 'financement', source: 'web : Usine Nouvelle', luDansLaProse: true,
};
const LEVEE_B: EvenementDate = {
  intitule: "Levée de 83 millions d'euros annoncée en novembre 2023 : signal de traction financière significatif pour un acteur industriel français",
  annee: 2023, mois: 11, nature: 'financement', source: 'web : Usine Nouvelle', luDansLaProse: true,
};
const LEVEE_C: EvenementDate = {
  intitule: "La levée de 83 millions d'euros réalisée en novembre 2023 aurait pu financer une diversification cloud, même si cette opération est postérieure au stade d'analyse et donc exclue de",
  annee: 2023, mois: 11, nature: 'financement', source: 'web : Le Monde Informatique', luDansLaProse: true,
};
const DU_RUN = [ARTEFACT, LEVEE_A, LEVEE_B, LEVEE_C];

const COMPOSANTES = [{ kind: 'cession' }, { kind: 'cash-in' }, { kind: 'dette' }];

function evaluer(evenements: EvenementDate[]) {
  return evaluerValiditeOperation({
    operationType: 'lbo',
    operationComponents: COMPOSANTES as any,
    documentDate: null,
    millesimeReference: 2021,
    evenements,
  } as any);
}

console.log('\n[Suite 1] un jugement de moteur n est pas un evenement');
{
  check(rangDe(ARTEFACT) === 'jugement-de-moteur', 'le score sur cent disqualifie l intitule');
  check(!citable({ ...ARTEFACT, sources: [], rang: 'jugement-de-moteur' } as any), 'et le rend non citable');
  check(rangDe(LEVEE_A) === 'prose-datee', 'la levee porte sa date dans son intitule');
  check(rangDe({ ...LEVEE_A, luDansLaProse: false }) === 'donnee-structuree', 'une donnee structuree prime tout');
  check(
    rangDe({ ...LEVEE_A, intitule: "Levée de 83 millions d'euros" }) === 'prose-indatee',
    'la meme sans sa date descend d un rang',
  );
  // Le marqueur porte sur la forme et non sur le vocabulaire : il ne
  // derive pas quand le modele change de tournure.
  check(
    rangDe({ ...LEVEE_A, intitule: 'Traction commerciale 72/100 sur le dernier exercice' }) === 'jugement-de-moteur',
    'un score sur cent suffit, quel que soit le libelle qui le porte',
  );
}

console.log('\n[Suite 2] le regroupement porte sur le fait, pas sur la formulation');
{
  const faits = regrouperFaits(DU_RUN);
  check(faits.length === 2, `quatre mentions font deux faits (obtenu ${faits.length})`);
  const levee = faits.find((f) => f.rang !== 'jugement-de-moteur');
  check(!!levee, 'un fait citable existe');
  check(levee!.sources.length === 2, `les sources s additionnent et se dedupliquent (obtenu ${levee!.sources.length})`);
  check(
    levee!.sources.includes('web : Usine Nouvelle') && levee!.sources.includes('web : Le Monde Informatique'),
    'les deux titres sont conserves',
  );
  check(
    levee!.intitule === LEVEE_A.intitule,
    'a rang egal, l intitule retenu est le plus court, celui qui dit le fait sans le commenter',
  );
  check(clefDeFait(LEVEE_A) === clefDeFait(LEVEE_C), 'deux formulations d une meme levee ont la meme clef');
  check(clefDeFait(LEVEE_A) !== clefDeFait(ARTEFACT), 'l artefact ne se confond pas avec elle');
}

console.log('\n[Suite 3] le classement met le mieux fonde en tete');
{
  // L artefact arrive premier dans la liste d entree, comme dans le run
  // reel. C est precisement ce que le classement doit annuler.
  const faits = regrouperFaits(DU_RUN);
  check(faits[0].rang === 'prose-datee', 'le fait date passe devant le jugement, malgre l ordre d entree');
  check(faits[faits.length - 1].rang === 'jugement-de-moteur', 'le jugement ferme la marche');
}

console.log('\n[Suite 4] la mention cite la levee et jamais l artefact');
{
  const r = evaluer(DU_RUN);
  const m = r.mention ?? '';
  check(r.verdict === 'a-verifier', 'la reserve est maintenue : elle etait fondee');
  check(m.includes('83 millions'), 'la mention cite la levee');
  check(!/68\s*\/\s*100/.test(m), 'et ne cite pas le score du moteur Equipe');
  check(!/Johnson Controls/.test(m), 'ni la phrase tronquee qui le suivait');
  check(!/anti-fragilit/i.test(m), 'ni le nom de la dimension');
  check(/2 sources publiques/.test(m), 'la provenance enumere les deux sources');
  check(/2 fait\(s\)/.test(r.motif) && /4 mentions regroupees/.test(r.motif),
    `le decompte porte sur les faits et dit ce qui a ete regroupe : ${r.motif.slice(0, 60)}`);
}

console.log('\n[Suite 5] quand rien n est citable, la mention le dit');
{
  const r = evaluer([ARTEFACT]);
  const m = r.mention ?? '';
  check(r.verdict === 'a-verifier', 'la reserve subsiste, le doute reste');
  check(!/68\s*\/\s*100/.test(m), 'l artefact n est pas cite');
  check(!/Johnson Controls/.test(m), 'ni sa phrase tronquee');
  check(/ne vaut pas preuve/.test(m), 'la mention dit pourquoi elle ne cite rien');
  check(/doute a lever/.test(m), 'et qualifie la reserve comme un doute et non un fait etabli');
  check(/Aucun fait datable/.test(m), 'la provenance le redit en clair');
}

console.log('\n[Suite 6] le cas nominal n est pas abime');
{
  // Un seul fait, une seule source : la mention garde sa forme
  // d origine, singulier compris.
  const r = evaluer([LEVEE_A]);
  const m = r.mention ?? '';
  check(m.includes('83 millions'), 'le fait est cite');
  check(/les sources publiques consultees \[web : Usine Nouvelle\]/.test(m), 'la source unique se dit au singulier');
  check(!/ 2 sources /.test(m), 'sans enumeration inutile');
  check(/1 fait\(s\)/.test(r.motif) && !/regroupees/.test(r.motif), 'et le motif ne parle pas de regroupement');
}

console.log(`\n${pass} pass, ${fail} fail\n`);
process.exit(fail > 0 ? 1 : 0);
