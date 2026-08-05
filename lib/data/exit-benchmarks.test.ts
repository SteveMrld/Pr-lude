// ============================================================
// Tests deterministes des sorties de reference
// ------------------------------------------------------------
// Ce que ces tests prouvent : les valeurs sont sorties du moteur sans
// changer, les deux tables de reference couvrent les memes classes, et
// aucune entree ne se declare mieux fondee qu elle ne l est.
//
// Le defaut ferme est du 5 aout 2026. Vingt et un nombres vivaient dans
// un objet litteral au milieu de getExitScenarios, sans date, sans
// source et sans confiance, et ils decident seuls de la sortie de
// domaine de la VC inverse. Une donnee logee dans un moteur n apparait
// dans aucun inventaire et aucun controle ne la parcourt.
//
// Execution : npx tsx lib/data/exit-benchmarks.test.ts
// ============================================================

import { EXIT_BENCHMARKS, lireSortieDeReference, etatDesSortiesDeReference } from './exit-benchmarks';
import { SECTOR_BENCHMARKS } from './sector-benchmarks';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

console.log('\n[Suite 1] le deplacement ne change aucune valeur');
{
  // Les vingt et une valeurs telles qu elles vivaient dans le moteur,
  // recopiees du diff et non recalculees : c est la seule facon de
  // prouver qu un deplacement n a rien emporte.
  const AVANT: Record<string, number> = {
    'saas-b2b': 80_000_000, 'fintech': 100_000_000, 'marketplace-b2c': 150_000_000,
    'ecommerce-dtc': 60_000_000, 'deeptech': 120_000_000, 'cybersecurity': 200_000_000,
    'healthtech': 90_000_000, 'climate-tech': 100_000_000, 'defense': 250_000_000,
    'hospitality': 70_000_000, 'ai-generative': 250_000_000, 'adtech': 80_000_000,
    'foodtech': 70_000_000, 'proptech': 80_000_000, 'edtech': 60_000_000,
    'logistics': 90_000_000, 'services-b2b': 50_000_000, 'industrial-hardware': 70_000_000,
    'profitable-mature': 120_000_000, 'mediatech': 80_000_000, 'sportstech': 60_000_000,
  };
  const clefs = Object.keys(AVANT);
  check(Object.keys(EXIT_BENCHMARKS).length === clefs.length,
    `${clefs.length} classes, autant qu avant (${Object.keys(EXIT_BENCHMARKS).length})`);
  let ecarts = 0;
  for (const [k, v] of Object.entries(AVANT)) {
    if (lireSortieDeReference(k)?.base !== v) { ecarts++; console.error(`      ${k} a bouge`); }
  }
  check(ecarts === 0, 'aucune des vingt et une valeurs n a bouge au passage');
}

console.log('\n[Suite 2] les deux tables de reference couvrent les memes classes');
{
  // Une classe presente ici et absente des multiples rendrait une
  // sortie sans multiple ; l inverse rendrait un multiple sans sortie,
  // ce qui fait tomber la VC inverse hors domaine sans que rien ne le
  // dise au lecteur.
  const sorties = Object.keys(EXIT_BENCHMARKS);
  const multiples = Object.keys(SECTOR_BENCHMARKS);
  const sansMultiple = sorties.filter((k) => !multiples.includes(k));
  const sansSortie = multiples.filter((k) => !sorties.includes(k));
  check(sansMultiple.length === 0, `aucune sortie sans multiple (${sansMultiple.join(', ') || 'aucune'})`);
  check(sansSortie.length === 0, `aucun multiple sans sortie (${sansSortie.join(', ') || 'aucune'})`);
}

console.log('\n[Suite 3] aucune entree ne se declare mieux fondee qu elle ne l est');
{
  const e = etatDesSortiesDeReference();
  check(e.entrees === 21, `vingt et une entrees (${e.entrees})`);
  check(e.sansDate === 21, `les vingt et une sont sans date etablie (${e.sansDate})`);
  check(e.confianceBasse === 21, `et toutes en confiance basse (${e.confianceBasse})`);
  check(e.aCollecter.length === 21, 'donc les vingt et une sont a collecter');
  // La provenance est declaree et non inventee : elle nomme ce qui
  // existait, et le fait qu on ne puisse pas refaire le chemin.
  check(Object.values(EXIT_BENCHMARKS).every((x) => x.source.includes('provenance et non source verifiable')),
    'et chacune dit que sa provenance n est pas une source verifiable');
}

console.log('\n[Suite 4] une classe hors catalogue ne recoit pas de socle invente');
{
  check(lireSortieDeReference('classe-qui-n-existe-pas') === null,
    'une classe inconnue rend null, ce qui fait sortir la VC inverse du domaine');
  check(lireSortieDeReference('') === null, 'une classe vide aussi');
}

console.log(`\n${pass} passes, ${fail} echecs`);
if (fail > 0) process.exit(1);
