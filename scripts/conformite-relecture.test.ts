// Verrou du verdict de conformite de relecture.
//
// Le jeu d essai entre par la porte de la production : il importe
// `comparerEmpreintes` telle que la commande l appelle, et ne rejoue pas
// sa logique dans ce fichier. Une copie mesurerait son accord avec
// elle-meme et resterait verte le jour ou la commande changerait d avis
// sur ce qui est decisif.
//
// Chaque champ porte une valeur qui n existe qu a cet endroit. Deux
// champs qui partageraient un hachage rendraient une confusion de champs
// invisible : la sortie serait la meme, quel que soit celui des deux que
// le code a lu.

import {
  comparerEmpreintes,
  CHAMPS_DECISIFS,
  CHAMPS_HORS_VERDICT,
} from './conformite-relecture';

let pass = 0, fail = 0;
function check(cond: boolean, label: string): void {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.log(`  KO  ${label}`); }
}

const REF = {
  commitSha: 'sha-reference-0001',
  doctrineHash: 'doctrine-ref-0002',
  configsHash: 'configs-ref-0003',
  enginesHash: 'engines-ref-0004',
  inputsHash: 'inputs-ref-0005',
  modelsHash: 'models-ref-0006',
};

console.log('\n[Suite 1] le sha ne rend pas le verdict');
{
  const v = comparerEmpreintes(REF, { ...REF, commitSha: 'sha-local-9001' });
  check(v.conforme, 'un sha different a code egal reste conforme');
  check(v.shaSeul, 'et le cas est nomme comme tel');
  const e = v.ecarts.find((x) => x.champ === 'commitSha')!;
  check(!e.identique, 'l ecart de sha est imprime');
  check(!e.decisif, 'et il est marque hors verdict');
  check(e.raison === CHAMPS_HORS_VERDICT.commitSha,
    'avec la raison qui explique pourquoi');
}
{
  const v = comparerEmpreintes(REF, REF);
  check(v.conforme, 'deux empreintes identiques sont conformes');
  check(!v.shaSeul, 'et le cas du sha seul ne se declare pas sans ecart de sha');
}

console.log('\n[Suite 2] chaque champ decisif arrete a lui seul');
{
  // La boucle prouve que les trois champs pesent, et non le premier
  // qu on aurait ecrit a la main.
  for (const champ of CHAMPS_DECISIFS) {
    const v = comparerEmpreintes(REF, { ...REF, [champ]: `local-divergent-${champ}` });
    check(!v.conforme, `${champ} divergent rend non conforme`);
    check(!v.shaSeul, `et ${champ} divergent n est pas un cas de sha seul`);
  }
}
{
  // Le verrou voit-il la faute quand on la lui donne dans l autre sens :
  // un champ hors verdict qui bouge ne doit rien arreter.
  for (const champ of Object.keys(CHAMPS_HORS_VERDICT)) {
    const v = comparerEmpreintes(REF, { ...REF, [champ]: `local-divergent-${champ}` });
    check(v.conforme, `${champ} divergent seul ne rend pas non conforme`);
  }
}
{
  const v = comparerEmpreintes(REF, {
    ...REF, commitSha: 'sha-local-9002', enginesHash: 'engines-local-9003',
  });
  check(!v.conforme, 'un sha et un moteur divergents rendent non conforme');
  check(!v.shaSeul, 'et ce n est pas un cas de sha seul, malgre le sha divergent');
}

console.log('\n[Suite 3] un champ absent d un cote se lit comme un ecart');
{
  const partiel = { ...REF };
  delete (partiel as Record<string, unknown>).doctrineHash;
  const v = comparerEmpreintes(partiel, REF);
  check(!v.conforme,
    'une doctrine absente de la reference ne se lit pas comme un accord');
  const e = v.ecarts.find((x) => x.champ === 'doctrineHash')!;
  check(e.reference === 'absent', 'et l absence est nommee plutot que tue');
}
{
  // Un champ qu aucun des deux ne porte est un accord, et il faut qu il
  // le soit : une reference ancienne peut ne pas porter tous les champs
  // du schema courant, et ce silence n est pas une divergence.
  const v = comparerEmpreintes(
    { doctrineHash: 'd-1', enginesHash: 'e-1', modelsHash: 'm-1' },
    { doctrineHash: 'd-1', enginesHash: 'e-1', modelsHash: 'm-1' },
  );
  check(v.conforme, 'deux empreintes reduites aux champs decisifs sont conformes');
  check(v.ecarts.length === 3, `et rien n est invente (${v.ecarts.length} champs)`);
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
