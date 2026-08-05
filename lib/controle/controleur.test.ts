// ============================================================
// Tests deterministes du controleur de corpus
// ------------------------------------------------------------
// Ce que ces tests prouvent : une propriete non portee ne se lit pas
// comme conforme, une propriete qui leve ne compte pas comme violation,
// le taux d une propriete de prose est segmente par empreinte de code,
// et l empreinte est calculee sur le stamp plutot que lue dans un champ
// qui n existe pas.
//
// Le dernier point est celui qui a coute. Le premier jet lisait
// `versionStamp.enginesHash`, absent du stamp persiste, et rendait des
// segments en points d interrogation sans qu aucune assertion ne
// rougisse. Une mesure irreprochable sur le mauvais support ne se
// detecte par aucune relecture de sa methode.
//
// Execution : npx tsx lib/controle/controleur.test.ts
// ============================================================

import { controler, segmentDeCode, estUnRejeu, formater } from './controleur';
import type { Propriete } from './proprietes';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const squelette = {
  id: 'x', enonce: 'e', lit: ['extraction'],
  origine: 'o'.repeat(50), eprouvee: 'e'.repeat(70),
};

const toujoursViolee: Propriete = {
  ...squelette, id: 'toujours-violee', famille: 'structure',
  porte: () => true, constats: () => [{ ou: 'a', extrait: 'b' }],
};
const jamaisPortee: Propriete = {
  ...squelette, id: 'jamais-portee', famille: 'structure',
  porte: () => false, constats: () => [{ ou: 'a', extrait: 'b' }],
};
const quiLeve: Propriete = {
  ...squelette, id: 'qui-leve', famille: 'structure',
  porte: () => true, constats: () => { throw new Error('defaut de la propriete'); },
};
const deProse: Propriete = {
  ...squelette, id: 'de-prose', famille: 'prose', lit: ['team'],
  porte: () => true,
  constats: (n) => (n.mauvais ? [{ ou: 'team', extrait: 'x' }] : []),
};

/** Stamp minimal accepte par fingerprintStamp. */
function stamp(promptHash: string, modele: string) {
  return {
    app: { commitSha: 'abc1234' },
    doctrineHash: promptHash,
    configs: {},
    engines: { team: { model: modele, temperature: 0, systemPromptHashes: [promptHash], promptVersion: 1, sourceFileHash: 'h' } },
    inputs: {},
    models: { principal: modele },
  };
}

console.log('\n[Suite 1] une propriete non portee n est pas une propriete respectee');
{
  const r = controler([{ id: 'n1', libelle: 'note', note: {} }], [jamaisPortee, toujoursViolee]);
  const np = r.releves.find((x) => x.propriete.id === 'jamais-portee')!;
  check(np.portee === 0, 'portee nulle');
  check(np.taux === null, 'le taux est nul et non zero : rien n a ete etabli');
  check(formater(r).includes('NON PORTEE'), 'le releve la nomme comme non portee et non comme conforme');
}

console.log('\n[Suite 2] une propriete qui leve est un defaut de la propriete, pas de la note');
{
  const r = controler([{ id: 'n1', libelle: 'note', note: {} }], [quiLeve]);
  const x = r.releves[0];
  check(x.portee === 1 && x.violees === 0,
    `la levee ne compte pas comme violation (${x.violees})`);
}

console.log('\n[Suite 3] l empreinte se calcule sur le stamp');
{
  const a = { meta: { versionStamp: stamp('aaaaaaaaaaaaaaaa', 'claude-sonnet-4-6') } };
  const b = { meta: { versionStamp: stamp('bbbbbbbbbbbbbbbb', 'claude-sonnet-4-6') } };
  const c = { meta: { versionStamp: stamp('aaaaaaaaaaaaaaaa', 'claude-haiku-4-5') } };
  check(segmentDeCode(a) !== segmentDeCode(b), 'un prompt different rend un segment different');
  check(segmentDeCode(a) !== segmentDeCode(c), 'un modele different rend un segment different');
  check(segmentDeCode(a) === segmentDeCode({ meta: { versionStamp: stamp('aaaaaaaaaaaaaaaa', 'claude-sonnet-4-6') } }),
    'deux runs du meme code partagent leur segment');
  check(!segmentDeCode(a).includes('?'),
    `l empreinte n est pas une suite de points d interrogation (${segmentDeCode(a)})`);
  check(segmentDeCode({ meta: {} }) === 'sans-empreinte', 'une note sans stamp le declare');
}

console.log('\n[Suite 4] une propriete de prose est segmentee par empreinte');
{
  const corpus = [
    { id: 'v1', libelle: 'ancien fautif', note: { mauvais: true, meta: { versionStamp: stamp('aaaaaaaaaaaaaaaa', 'claude-sonnet-4-6') } } },
    { id: 'v2', libelle: 'ancien fautif', note: { mauvais: true, meta: { versionStamp: stamp('aaaaaaaaaaaaaaaa', 'claude-sonnet-4-6') } } },
    { id: 'v3', libelle: 'recent sain', note: { mauvais: false, meta: { versionStamp: stamp('bbbbbbbbbbbbbbbb', 'claude-sonnet-4-6') } } },
  ];
  const r = controler(corpus, [deProse]);
  const x = r.releves[0];
  check(x.violees === 2 && x.portee === 3, `deux violations sur trois notes (${x.violees}/${x.portee})`);
  check(x.parSegment.length === 2, `deux segments distingues (${x.parSegment.length})`);
  const ancien = x.parSegment.find((s) => s.violees === 2);
  const recent = x.parSegment.find((s) => s.violees === 0);
  check(!!ancien && !!recent,
    'le taux global de 67% masque un segment ancien a 100% et un segment courant a 0%');
  check(formater(r).includes('par empreinte de code'),
    'le releve rend la segmentation plutot que le seul taux global');
}

console.log('\n[Suite 5] un rejeu se distingue de la prose d origine');
{
  const corpus = [
    { id: 'r1', libelle: 'reassemblee', note: { meta: { rejeuPartiel: { recalcules: ['valuation'] } } } },
    { id: 'r2', libelle: 'run d origine', note: { meta: {} } },
  ];
  check(estUnRejeu(corpus[0].note) === true, 'une note reassemblee se declare');
  check(estUnRejeu(corpus[1].note) === false, 'un run d origine ne se declare pas comme rejeu');
  const r = controler(corpus, [toujoursViolee]);
  check(r.rejeux === 1, `le releve compte les rejeux (${r.rejeux})`);
  check(formater(r).includes('reassemblee(s) par rejeu'),
    'le releve dit que certaines notes melangent code actuel et prose ancienne');
}

console.log(`\n${pass} OK, ${fail} KO`);
process.exit(fail > 0 ? 1 : 0);
