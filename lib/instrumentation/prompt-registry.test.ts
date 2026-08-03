// ============================================================
// Tests deterministes du registre des prompts systeme
// ------------------------------------------------------------
// Ce que ces tests prouvent : le registre couvre tous les modules du
// depot qui portent un prompt systeme, l empreinte agregee est stable
// entre deux lectures du meme code, et elle change des qu un prompt
// change.
//
// Le defaut ferme : le stamp hashait les prompts en lisant les .ts sur
// le disque, fichiers qui n existent plus apres le build. Mesure sur
// les cinq derniers runs de production : vingt-neuf moteurs, vingt-neuf
// systemPromptHashes vides. Le enginesHash n aurait pas bouge si tous
// les prompts du depot avaient change.
// ============================================================

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { DIMENSION_KEYS } from '../engines/sectoral-intelligence/types';
import {
  collectPromptFingerprints,
  promptsDoctrineHash,
  registeredModules,
} from './prompt-registry';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

/** Parcourt lib/engines et releve les modules declarant un prompt systeme. */
function modulesDuDepot(): string[] {
  const racine = join(__dirname, '..', 'engines');
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const nom of readdirSync(dir)) {
      const chemin = join(dir, nom);
      if (statSync(chemin).isDirectory()) { walk(chemin, prefix ? `${prefix}/${nom}` : nom); continue; }
      if (!nom.endsWith('.ts') || nom.includes('.test.')) continue;
      const src = readFileSync(chemin, 'utf8');
      if (/^export const \w*SYSTEM_PROMPT\w*\s*=/m.test(src)) {
        out.push((prefix ? `${prefix}/` : '') + nom.replace(/\.ts$/, ''));
      }
    }
  };
  walk(racine, '');
  return out.sort();
}

// ============================================================
console.log('\n[Suite 1] exhaustivite du registre');
// ============================================================

{
  // Le registre importe les modules en entier et collecte toute
  // exportation nommee SYSTEM_PROMPT : ajouter un prompt a un module
  // deja reference est donc couvert sans intervention. Ajouter un
  // module entier ne l est pas, et c est ce que ce test attrape. Sans
  // lui, une chose n existerait dans la mesure que si quelqu un avait
  // pense a l y mettre, ce qui est le defaut ferme au bloc 1.
  const depot = modulesDuDepot();
  const registre = registeredModules();
  const manquants = depot.filter((m) => !registre.includes(m));
  const enTrop = registre.filter((m) => !depot.includes(m));

  check(depot.length > 0, `le depot declare des prompts systeme (${depot.length} modules)`);
  check(
    manquants.length === 0,
    `aucun module du depot absent du registre${manquants.length ? ' : ' + manquants.join(', ') : ''}`,
  );
  check(
    enTrop.length === 0,
    `aucun module du registre absent du depot${enTrop.length ? ' : ' + enTrop.join(', ') : ''}`,
  );

  // Le registre porte deux familles d empreintes et il faut les
  // compter separement, sans quoi l une masque l autre. Les prompts
  // declares en constante se comptent dans le depot ; les prompts
  // construits par fonction n y ont aucune declaration a compter, et
  // les additionner a l attendu ferait passer le test pour un ecart
  // qu il ne mesure plus.
  const fps = collectPromptFingerprints();
  const construits = fps.filter((f) => f.module.startsWith('sectoral-intelligence/'));
  const constantes = fps.filter((f) => !f.module.startsWith('sectoral-intelligence/'));

  const declarations = depot.reduce((n, m) => {
    const src = readFileSync(join(__dirname, '..', 'engines', `${m}.ts`), 'utf8');
    return n + (src.match(/^export const \w*SYSTEM_PROMPT\w*\s*=/gm) || []).length;
  }, 0);
  check(
    constantes.length === declarations,
    `autant d empreintes que de declarations (${constantes.length} contre ${declarations})`,
  );

  // Les prompts construits : un par dimension sectorielle, plus le
  // resume editorial de fiche, plus l agregation inter-sectorielle. Le
  // compte est derive de DIMENSION_KEYS et non ecrit en dur, pour
  // qu ajouter une dimension ne fasse pas passer ce test a cote d elle.
  check(
    construits.length === DIMENSION_KEYS.length + 2,
    `les prompts sectoriels construits sont couverts (${construits.length} contre ${DIMENSION_KEYS.length + 2})`,
  );

  // Ils portent une empreinte reelle, pas une chaine vide qui
  // passerait le compte sans rien mesurer.
  check(
    construits.every((f) => f.chars > 200 && /^[0-9a-f]{16}$/.test(f.hash)),
    'chaque prompt construit porte une empreinte substantielle',
  );
}

// ============================================================
console.log('\n[Suite 2] le critere : stable sans changement, mouvant avec');
// ============================================================

{
  // Stabilite. Deux lectures du meme code rendent la meme empreinte.
  // C est la moitie du critere : sans elle, le hash bougerait a chaque
  // run et donnerait l illusion d une mesure plutot qu une mesure.
  const a = promptsDoctrineHash();
  const b = promptsDoctrineHash();
  check(a === b, 'deux lectures du meme code rendent la meme empreinte');
  check(/^[0-9a-f]{16}$/.test(a), 'empreinte de forme attendue');

  // L ordre de declaration n influe pas : les empreintes sont triees
  // avant agregation, donc deplacer un prompt dans un fichier ne
  // change pas le hash alors que le modifier le change.
  const fps = collectPromptFingerprints();
  const tries = [...fps].map((f) => `${f.module}:${f.name}:${f.hash}`);
  const melanges = [...tries].reverse().sort();
  check(tries.join('|') === melanges.join('|'), 'l agregation est invariante a l ordre');
}

{
  // Sensibilite. On rejoue l agregation sur la liste reelle dont une
  // seule empreinte a ete modifiee d un caractere : le hash agrege doit
  // changer. Ce test porte sur l agregation et non sur la collecte,
  // qu on ne peut pas eprouver sans reecrire un module sur disque : la
  // collecte est couverte par la suite 1.
  const { createHash } = require('crypto') as typeof import('crypto');
  const agrege = (l: string[]) => createHash('sha256').update(l.join('|')).digest('hex').slice(0, 16);
  const base = collectPromptFingerprints().map((f) => `${f.module}:${f.name}:${f.hash}`);
  check(agrege(base) === promptsDoctrineHash(), 'l agregation rejouee reproduit le hash du registre');

  const modifie = [...base];
  modifie[0] = modifie[0].slice(0, -1) + (modifie[0].endsWith('a') ? 'b' : 'a');
  check(agrege(modifie) !== agrege(base), 'modifier une seule empreinte change le hash agrege');

  const retire = base.slice(1);
  check(agrege(retire) !== agrege(base), 'retirer un prompt change le hash agrege');
}

// ============================================================
console.log('\n[Suite 3] les empreintes entrent dans le stamp');
// ============================================================

{
  const { buildVersionStamp, fingerprintStamp } = require('./version-stamp') as typeof import('./version-stamp');
  const stamp = buildVersionStamp({ inputs: {}, capturedAt: 'fige' });
  const moteurs = Object.values(stamp.engines);
  const sansPrompt = moteurs.filter((m: any) => !m.systemPromptHashes || m.systemPromptHashes.length === 0);

  check(moteurs.length > 0, `le stamp couvre ${moteurs.length} moteurs`);
  check(
    sansPrompt.length === 0,
    `tous portent au moins une empreinte de prompt${sansPrompt.length ? ' (manquants : ' + sansPrompt.length + ')' : ''}`,
  );
  check(typeof stamp.doctrineHash === 'string' && stamp.doctrineHash.length === 16, 'le stamp porte le hash de doctrine');
  check(fingerprintStamp(stamp).doctrineHash === stamp.doctrineHash, 'le fingerprint le reprend');
  check(
    fingerprintStamp(stamp).enginesHash === fingerprintStamp(buildVersionStamp({ inputs: {}, capturedAt: 'autre' })).enginesHash,
    'enginesHash stable entre deux stamps du meme code',
  );
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
