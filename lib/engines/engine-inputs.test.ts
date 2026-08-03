// ============================================================
// Tests de la declaration d entrees des moteurs
// ------------------------------------------------------------
// Ce que ces tests prouvent : chaque entree declaree en est une,
// verifiee par mutation, et un echec de contrat se qualifie en absence
// ou en incident selon que l entree etait la.
//
// Le defaut ferme : un contrat minimal non satisfait sortait en
// `failed`, ce qui annonce au lecteur que le dispositif est tombe,
// qu il s agisse d un moteur qui a failli ou d un dossier qui ne
// portait rien a instruire. Chez un fonds le cas courant est le deck
// pauvre, et un produit qui se declare en panne sur un dossier
// simplement incomplet perd sa credibilite sur les dossiers ou il a
// raison.
// ============================================================

import { ENTREES_MOTEURS, qualifierEchecContrat, moteursDeclares } from './engine-inputs';

let pass = 0, fail = 0;
const nonExercees: string[] = [];
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

/** Contexte riche : toutes les entrees declarees sont presentes. */
function contexteComplet(): Record<string, any> {
  return {
    financialData: { hasBP: true, revenueProjection: [{ year: 2021, value: 13.5 }] },
    extraction: {
      traction: { revenue: '13,5 m€', metrics: ['ARR 17m'] },
      team: [{ name: 'Fondatrice' }],
    },
    capTableDoc: { name: 'captable.xlsx' },
    team: { foundersCount: 2 }, market: { perceivedSize: 'large' }, macro: { cyclePosition: 'expansion' },
    contrarianAnalysis: { globalScore: 60 }, blindspotAnalysis: { globalScore: 60 },
    clientContracts: [{ name: 'contrat.pdf' }],
    statutes: { name: 'statuts.pdf' },
    shareholdersAgreement: { name: 'pacte.pdf' },
  };
}

function retirer(ctx: Record<string, any>, chemin: string): Record<string, any> {
  const c = JSON.parse(JSON.stringify(ctx));
  const parts = chemin.split('.');
  let o: any = c;
  for (let i = 0; i < parts.length - 1; i++) { if (!o) return c; o = o[parts[i]]; }
  if (o) delete o[parts[parts.length - 1]];
  return c;
}

console.log('\n[Suite 1] toutes les entrees declarees sont disponibles sur un dossier complet');
{
  const ctx = contexteComplet();
  for (const m of moteursDeclares()) {
    check(ENTREES_MOTEURS[m].disponible(ctx), `${m} : entrees disponibles`);
    check(qualifierEchecContrat(m, ctx).cause === 'incident',
      `${m} : un echec est alors un incident, il y a a reparer`);
  }
}

console.log('\n[Suite 2] chaque entree declaree en est une, verifiee par mutation');
{
  // Retirer une entree declaree doit rendre le moteur incapable de
  // produire. Si rien ne change, l entree n est pas une entree.
  for (const m of moteursDeclares()) {
    const decl = ENTREES_MOTEURS[m];
    // Une declaration a plusieurs entrees alternatives ne bascule que
    // si toutes tombent : on les retire donc ensemble, sinon on
    // mesurerait une conjonction qui n existe pas.
    let ctx = contexteComplet();
    for (const chemin of decl.lit) ctx = retirer(ctx, chemin);
    check(!decl.disponible(ctx),
      `${m} : retirer ${decl.lit.join(' et ')} rend le moteur sans objet`);
  }
}

console.log('\n[Suite 3] un dossier pauvre produit une absence et non un echec');
{
  const vide: Record<string, any> = {};
  for (const m of moteursDeclares()) {
    const q = qualifierEchecContrat(m, vide);
    check(q.cause === 'absence', `${m} : cause absence sur un dossier vide`);
    check(q.entreeManquante === true, `${m} : le manque est declare`);
    check(q.motif.startsWith('Non instruit'), `${m} : le motif s adresse au lecteur`);
  }
}

console.log('\n[Suite 4] un moteur non declare garde le comportement anterieur');
{
  const q = qualifierEchecContrat('moteurInconnu', {});
  check(q.cause === 'incident', 'un moteur sans declaration reste un incident');
  check(q.entreeManquante === false, 'et ne pretend pas qu une entree manquait');
  check(q.motif.includes('ne sont pas declarees'), 'le motif dit pourquoi il n est pas qualifie plus finement');
}

console.log('\n[Suite 5] le modele du court-circuit');
{
  // La declaration de financialCoherence recopie la condition du
  // court-circuit de son moteur : sans BP ni projection, rien a
  // instruire.
  const sansRien = { financialData: { hasBP: false, revenueProjection: [] } };
  check(qualifierEchecContrat('financialCoherence', sansRien).cause === 'absence',
    'sans BP ni projection : absence, comme le court-circuit du moteur');
  const avecProjection = { financialData: { hasBP: false, revenueProjection: [{ year: 2021, value: 1 }] } };
  check(qualifierEchecContrat('financialCoherence', avecProjection).cause === 'incident',
    'avec une projection seule : le moteur avait de quoi travailler');
}

// Ce que ce test n exerce pas, imprime et non tu.
nonExercees.push('la degradation reelle des moteurs LLM prives de leur entree, non testable hors ligne');
nonExercees.push('les moteurs non declares, dont les entrees restent a etablir par lecture');
console.log(`\n[Limite] ${nonExercees.length} point(s) que ce test n exerce pas :`);
for (const n of nonExercees) console.log(`   ${n}`);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
