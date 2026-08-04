// ============================================================
// Tests deterministes du montant et du cedant au tableau d operation
// ------------------------------------------------------------
// Ce que ces tests prouvent : le tableau lit un montant que le champ
// d operation ne porte pas mais qu une composante porte, en declarant
// d ou il vient ; et il n imprime pas un cedant que rien ne cite.
//
// Les deux defauts sont du run early stage du 4 aout 2026, sur le
// dossier que l on gele. Le memorandum ecrit « Inject €10-15m in
// cash-in to support the next growth phase », l extraction a rendu
// `amount` vide avec la cause `non-rendu`, et le tableau affichait une
// ligne vide en premiere page alors que la composante cash-in portait
// « €10-15m » avec sa citation. Le meme run a rendu « Iris Capital,
// Next47, Hélène Olphe-Galliard, équipe fondatrice » en cedant, la ou
// le run de la veille rendait « Iris Capital, Next47, équipe fondatrice
// (dont Hélène Olphe-Galliard) » : une personne physique nommee comme
// cedante a part entiere selon le tirage.
//
// Execution : npx tsx lib/note/operation-montant-cedant.test.ts
// ============================================================

import {
  perimetreEstMontant,
  montantAffiche,
  cedantAffiche,
} from './operation-vocabulary';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// Les composantes du run persiste, copiees telles quelles.
const COMPOSANTES_DU_RUN = [
  { kind: 'cession', evidence: 'Provide liquidity to Iris Capital and Next47 (with an option for a limited roll-over) ; Provide partial liquidity to the founding team', perimetre: null },
  { kind: 'cash-in', evidence: 'Inject €10-15m in cash-in to support the next growth phase', perimetre: '€10-15m' },
  { kind: 'dette', evidence: 'Structure the transaction with a limited debt component', perimetre: null },
];

console.log('\n[Suite 1] un perimetre n est pas toujours un montant');
{
  check(perimetreEstMontant('€10-15m'), 'une somme en euros est un montant');
  check(perimetreEstMontant('10-15 M EUR'), 'la meme en code devise aussi');
  check(perimetreEstMontant('45 m$'), 'une somme en dollars aussi');
  check(!perimetreEstMontant('totalite des parts'), 'une part de capital n en est pas un');
  check(!perimetreEstMontant('100%'), 'un pourcentage non plus');
  check(!perimetreEstMontant("Totalité des parts d'Iris Capital et Next47"), 'ni la formulation longue du run');
  check(!perimetreEstMontant(null) && !perimetreEstMontant('') && !perimetreEstMontant(undefined),
    'ni une absence');
}

console.log('\n[Suite 2] le montant se lit un cran plus bas, et le declare');
{
  // Le cas du run : amount vide, composante cash-in porteuse.
  const m = montantAffiche({ amount: '', amountCause: 'non-rendu', operationComponents: COMPOSANTES_DU_RUN });
  check(m.provenance === 'perimetre-de-composante', `la provenance est declaree (${m.provenance})`);
  check(m.valeur === '€10-15m', `la valeur est celle du perimetre (${m.valeur})`);
  check(m.composante === 'cash-in', 'et la composante lue est nommee');
  check(/Inject/.test(String(m.citation)), 'la citation est celle de la composante');
}
{
  // Le champ d operation prime quand il est rempli : on ne descend pas
  // d un cran sans necessite.
  const m = montantAffiche({ amount: '€10-15m en cash-in', amountEvidence: 'citation du champ', operationComponents: COMPOSANTES_DU_RUN });
  check(m.provenance === 'champ-operation', 'un amount rempli reste la source');
  check(m.valeur === '€10-15m en cash-in' && m.citation === 'citation du champ', 'avec sa propre citation');
}
{
  // Aucun montant nulle part : la ligne reste vide plutot que meublee.
  const m = montantAffiche({ amount: '', operationComponents: [{ kind: 'cession', evidence: 'a', perimetre: '100%' }] });
  check(m.provenance === 'absent' && m.valeur === null, 'un perimetre en pourcentage ne meuble pas la ligne');
}
{
  // La valeur n est jamais recopiee dans le champ d operation : la
  // provenance change, donc la portee change.
  const fundraise: any = { amount: '', operationComponents: COMPOSANTES_DU_RUN };
  montantAffiche(fundraise);
  check(fundraise.amount === '', 'la lecture ne reecrit pas amount');
}

console.log('\n[Suite 3] le cedant ne s imprime que cite');
{
  // Le cas du run : seller redige, aucune citation propre.
  const c = cedantAffiche({
    seller: 'Iris Capital, Next47, Hélène Olphe-Galliard, équipe fondatrice',
    operationComponents: COMPOSANTES_DU_RUN,
  });
  check(c.provenance === 'citation-de-composante', `le champ redige n est pas imprime (${c.provenance})`);
  check(c.valeur === null, 'aucune valeur redigee n est rendue');
  check(/Iris Capital and Next47/.test(String(c.citation)), 'la citation de la composante de cession la remplace');
  check(!/Olphe-Galliard/.test(String(c.citation ?? '')),
    'et la personne physique nommee par la synthese ne passe pas');
}
{
  // Deux formulations du meme run, deux tirages : la sortie ne bouge
  // pas, puisqu elle ne depend plus du champ qui derive.
  const a = cedantAffiche({ seller: 'Iris Capital, Next47, équipe fondatrice (dont Hélène Olphe-Galliard)', operationComponents: COMPOSANTES_DU_RUN });
  const b = cedantAffiche({ seller: 'Iris Capital, Next47, Hélène Olphe-Galliard, équipe fondatrice', operationComponents: COMPOSANTES_DU_RUN });
  check(a.citation === b.citation && a.valeur === b.valeur && a.provenance === b.provenance,
    'deux tirages du champ redige donnent la meme ligne de cedant');
}
{
  // Un seller cite est legitime et reste imprime : la regle refuse le
  // non-cite, pas le champ.
  const c = cedantAffiche({
    seller: 'Iris Capital et Next47',
    sellerEvidence: 'Iris Capital and Next47 are selling their entire stake',
    operationComponents: COMPOSANTES_DU_RUN,
  });
  check(c.provenance === 'champ-cite' && c.valeur === 'Iris Capital et Next47', 'un cedant cite est rendu tel quel');
  check(/entire stake/.test(String(c.citation)), 'avec sa citation');
}
{
  const c = cedantAffiche({ seller: 'X', operationComponents: [{ kind: 'cash-in', evidence: 'a', perimetre: null }] });
  check(c.provenance === 'absent', 'sans composante de cession, aucun cedant n est rendu');
}

console.log(`\n${pass} pass, ${fail} fail\n`);
process.exit(fail > 0 ? 1 : 0);
