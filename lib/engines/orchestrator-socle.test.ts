// ============================================================
// Tests deterministes de l ajustement dialectique de l orchestrateur
// ------------------------------------------------------------
// Ce que ces tests prouvent : le score n est plus corrige par une
// dialectique dont un des deux moteurs n a pas tourne, et la lecture
// des scores ne leve plus sur une racine absente.
//
// Le cas rejoue est celui du run b8d0e9ac du 5 aout 2026. Marche est
// tombe sur son contrat de sortie, les quatre moteurs de la porte aval
// sont partis en failed-upstream, et Aveuglement est arrive nul dans
// l orchestrateur. La ligne `blindspotAnalysis.globalBlindspotScore` a
// leve, la synthese a bascule en repli degrade, et la note est sortie
// sans facteurs decisifs.
//
// CE QU ILS NE PROUVENT PAS
//
// Ils ne prouvent rien de l appel au modele qui precede. La fonction a
// ete extraite du corps de l orchestrateur precisement pour etre
// atteignable sans lui : elle y vivait derriere un appel LLM, donc le
// seul moyen de la verifier aurait ete d en recopier la logique ici,
// c est-a-dire de mesurer l accord de deux ecritures de la meme
// hypothese.
//
// Execution : npx tsx lib/engines/orchestrator-socle.test.ts
// ============================================================

import { ajustementBlindspotsContrarien } from './orchestrator';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// Valeurs discriminantes : 70 et 40 ne sont ni des defauts ni des
// valeurs que le repli pourrait fournir, donc une assertion qui les
// retrouve prouve que la lecture est passee par l entree.
const AVEUGLEMENT = { globalBlindspotScore: 70 };
const CONTRARIEN = { globalContrarianScore: 40 };

console.log('\n[Suite 1] le socle complet calcule comme avant');
{
  const a = ajustementBlindspotsContrarien('blindspots-dominate', AVEUGLEMENT, CONTRARIEN);
  check(a.ajustement === -22, `blindspots-dominate a 70 rend -22 (obtenu ${a.ajustement})`);
  check(a.socleAbsent === false, 'et le socle est declare present');

  const b = ajustementBlindspotsContrarien('contrarian-justifies', AVEUGLEMENT, CONTRARIEN);
  check(b.ajustement === 9, `contrarian-justifies a 40 rend +9 (obtenu ${b.ajustement})`);

  const c = ajustementBlindspotsContrarien('balanced-investigate', AVEUGLEMENT, CONTRARIEN);
  check(c.ajustement === 0, 'balanced-investigate ne bouge pas');
  check(c.socleAbsent === false, 'et ce zero-la n est pas une absence de socle');
}

console.log('\n[Suite 2] un moteur absent ne fonde aucun ajustement');
{
  // Le cas du run : Aveuglement nul, tension pourtant resolue par le
  // modele en blindspots-dominate. L ancien code levait ici.
  const a = ajustementBlindspotsContrarien('blindspots-dominate', null, CONTRARIEN);
  check(a.ajustement === 0, 'Aveuglement absent : aucun ajustement');
  check(a.socleAbsent === true, 'et l absence est declaree, pas confondue avec un equilibre');

  const b = ajustementBlindspotsContrarien('contrarian-justifies', AVEUGLEMENT, null);
  check(b.ajustement === 0, 'Contrarien absent : aucun ajustement');
  check(b.socleAbsent === true, 'et l absence est declaree');

  const c = ajustementBlindspotsContrarien('blindspots-dominate', undefined, undefined);
  check(c.ajustement === 0 && c.socleAbsent === true, 'les deux absents : idem, sans lever');
}

console.log('\n[Suite 3] proteger la racine ne suffisait pas');
{
  // C est l assertion qui porte la doctrine. Une racine remplacee par
  // un objet vide ne leve plus, et rend un score de zero ; zero traverse
  // l arithmetique comme une mesure et vaut exactement -15 de penalite.
  // Un correctif qui se serait arrete a la protection aurait donc rendu
  // -15 ici, sur un moteur qui n a jamais tourne.
  const protege = ajustementBlindspotsContrarien('blindspots-dominate', {}, CONTRARIEN);
  check(protege.ajustement === -15,
    `une racine vide mais presente rend bien -15, la valeur qu un correctif partiel aurait laissee passer (obtenu ${protege.ajustement})`);
  check(protege.socleAbsent === false,
    'un objet vide est une sortie presente et sans score, pas une absence de moteur');

  const absent = ajustementBlindspotsContrarien('blindspots-dominate', null, CONTRARIEN);
  check(absent.ajustement === 0 && absent.ajustement !== protege.ajustement,
    'la ou le moteur est absent, l ecart avec la protection seule vaut 15 points de score');
}

console.log('\n[Suite 4] aucune entree ne fait lever');
{
  let leves = 0;
  const degenerees: any[] = [null, undefined, {}, { globalBlindspotScore: null }, 0, '', []];
  for (const x of degenerees) {
    for (const y of degenerees) {
      for (const t of ['blindspots-dominate', 'contrarian-justifies', 'balanced-investigate', undefined]) {
        try { ajustementBlindspotsContrarien(t, x, y); } catch { leves++; }
      }
    }
  }
  check(leves === 0, `aucune levee sur ${degenerees.length * degenerees.length * 4} combinaisons`);
}

console.log(`\n${pass} passes, ${fail} echecs`);
if (fail > 0) process.exit(1);
