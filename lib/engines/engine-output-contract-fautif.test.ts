// ============================================================
// Tests deterministes de la conservation du texte fautif
// ------------------------------------------------------------
// Ce que ces tests prouvent : quand un contrat tombe, la forme du texte
// qui l a fait tomber survit a l exception, bornee et declaree.
//
// Le defaut ferme est du 6 aout 2026. Deux moteurs de porte sont tombes
// en trois runs, tous deux en parse `recovered` avec zero clef rendue,
// et la question qui suivait, quelle etait la forme du JSON et ou
// cassait-il, n avait aucune reponse : l erreur conservait le mode de
// parse, les clefs et le nombre de tentatives, jamais le texte. Le seul
// moment ou l objet a diagnostiquer existe etait celui ou on le jetait.
//
// Execution : npx tsx lib/engines/engine-output-contract-fautif.test.ts
// ============================================================

import { parseEngineOutput, EngineContractError, verifierContrat } from './engine-output-contract';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

/** Une sortie qui casse comme les deux vraies : longue, non tronquee, JSON invalide. */
const FAUTIF = '```json\n{ "perceivedSize": "grand", "needIntensity": '
  + 'x'.repeat(4000)
  + '\n[web: sourcename] "defensibility": 7 }\n```';

async function main() {
console.log('\n[Suite 1] la forme du texte fautif survit a l exception');
{
  let capturee: EngineContractError | null = null;
  await parseEngineOutput('market', async () => FAUTIF, { contractRetries: 0 })
    .catch((e) => { capturee = e; });

  const e = capturee as unknown as EngineContractError;
  check(e instanceof EngineContractError, 'une erreur de contrat est levee');
  check(e.rawLength === FAUTIF.length, `la longueur totale est conservee (${e.rawLength})`);
  check(e.rawDebut.startsWith('```json'), 'le debut montre la cloture de code, ce que le mode de parse seul ne disait pas');
  check(e.rawFin.includes('[web: sourcename]'), 'la fin montre ce qui s est intercale');
  check(e.rawDebut.length === 600 && e.rawFin.length === 600, 'les deux extremites sont bornees a six cents');
  // Le milieu ne diagnostique rien et ne doit pas peser.
  check(e.rawDebut.length + e.rawFin.length < e.rawLength,
    'et le milieu n est pas conserve : il ne diagnostique rien et il pese');
}

console.log('\n[Suite 2] une sortie courte tient entiere dans le debut');
{
  // Un JSON valide dont les clefs ne satisfont pas le contrat : c est le
  // seul chemin qui atteint EngineContractError. Un texte illisible leve
  // au parse, avant le contrat, et ne passe donc pas par ici. La premiere
  // version de ce test l ignorait et mesurait un chemin qu elle croyait
  // exercer.
  const court = '{"autre":1}';
  let e: any = null;
  await parseEngineOutput('market', async () => court, { contractRetries: 0 }).catch((x) => { e = x; });
  check(e instanceof EngineContractError, 'un JSON valide hors contrat tombe bien sur le contrat');
  check(e.rawLength === court.length, `la longueur est celle du texte (${e?.rawLength})`);
  check(e.rawDebut === court, 'le debut le porte entier');
  check(e.rawFin === '', 'et la fin reste vide plutot que de le repeter');
}

console.log('\n[Suite 3] ce qui n a pas de texte n en invente pas');
{
  // verifierContrat s applique a une sortie deja assemblee : il n y a
  // pas de texte brut, et lui en fabriquer un serait pire que rien.
  let e: any = null;
  try { verifierContrat('market', { rien: true }); } catch (x) { e = x; }
  check(e instanceof EngineContractError, 'le contrat tombe');
  check(e.rawLength === 0 && e.rawDebut === '' && e.rawFin === '',
    'et le texte fautif reste vide, sans etre fabrique');
}

console.log('\n[Suite 4] la reprise conserve le texte de la derniere tentative');
{
  let n = 0;
  let e: any = null;
  await parseEngineOutput('market', async () => { n++; return n === 1 ? '{"premier":1}' : '{"second":2}'; },
    { contractRetries: 1 }).catch((x) => { e = x; });
  check(n === 2, `deux tentatives ont eu lieu (${n})`);
  check(e.attempts === 2, `et l erreur le declare (${e?.attempts})`);
  check(e.rawDebut === '{"second":2}',
    'le texte conserve est celui de la derniere tentative, pas de la premiere');
}

console.log(`\n${pass} passes, ${fail} echecs`);
if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
