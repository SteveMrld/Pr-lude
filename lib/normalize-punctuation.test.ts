// Tests deterministes pour normalize-punctuation.
//
// Couvre :
//   - Incise em-dash entouree d espaces devient virgule.
//   - En-dash traite identiquement a em-dash.
//   - Plages numeriques (60-150, 2024-2025) preservees.
//   - URL avec tirets simples preservee.
//   - Identifiants kebab-case preserves.
//   - Idempotence : deux applications donnent le meme resultat.
//   - Walker recursif : structure preservee, strings transformees,
//     primitifs autres laisses tels quels.

import { normalizeFrenchPunctuation, normalizeStringsRecursive } from './normalize-punctuation';

let pass = 0;
let fail = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`OK  ${label}`);
  } else {
    fail++;
    console.error(`FAIL ${label}`);
    console.error(`     actual   : ${JSON.stringify(actual)}`);
    console.error(`     expected : ${JSON.stringify(expected)}`);
  }
}
function checkTrue(label: string, cond: boolean): void {
  check(label, cond, true);
}

// ------------------------------------------------------------
// Incise em-dash entouree d espaces.
// ------------------------------------------------------------
check(
  'em-dash entoure d espaces devient virgule',
  normalizeFrenchPunctuation('la deeptech industrielle — hardware embarque — partage'),
  'la deeptech industrielle, hardware embarque, partage',
);

check(
  'em-dash en milieu de phrase incise unique',
  normalizeFrenchPunctuation('Chips Act 2.0 — est programmee'),
  'Chips Act 2.0, est programmee',
);

check(
  'en-dash traite comme em-dash',
  normalizeFrenchPunctuation('la triple exposition – semi-conducteurs – place ce secteur'),
  'la triple exposition, semi-conducteurs, place ce secteur',
);

// ------------------------------------------------------------
// Plages numeriques et identifiants : tiret-moins doit etre
// preserve a l identique.
// ------------------------------------------------------------
check(
  'plage numerique simple preservee',
  normalizeFrenchPunctuation('entre 60-150 employes'),
  'entre 60-150 employes',
);

check(
  'plage annees preservee',
  normalizeFrenchPunctuation('Atomico 2024-2025'),
  'Atomico 2024-2025',
);

check(
  'URL avec tirets simples preservee',
  normalizeFrenchPunctuation('voir https://example.com/foo-bar-baz'),
  'voir https://example.com/foo-bar-baz',
);

check(
  'identifiant kebab-case preserve',
  normalizeFrenchPunctuation('asset-class saas-b2b stade series-a-late'),
  'asset-class saas-b2b stade series-a-late',
);

// ------------------------------------------------------------
// Em-dash colle a un chiffre : converti en tiret simple (plage
// avec espaces parasites cote LLM).
// ------------------------------------------------------------
check(
  'em-dash entre chiffres devient tiret simple',
  normalizeFrenchPunctuation('intervalle 60—150 cibles'),
  'intervalle 60-150 cibles',
);

// ------------------------------------------------------------
// Em-dash en debut de ligne : converti en tiret simple (liste).
// ------------------------------------------------------------
check(
  'em-dash en debut de ligne devient tiret simple',
  normalizeFrenchPunctuation('— premier point\n— second point'),
  '- premier point\n- second point',
);

// ------------------------------------------------------------
// Idempotence : double application sans effet.
// ------------------------------------------------------------
const sampleA = 'la triple exposition — semi-conducteurs — place ce secteur';
const onceA = normalizeFrenchPunctuation(sampleA);
const twiceA = normalizeFrenchPunctuation(onceA);
check('idempotence incise', onceA, twiceA);

const sampleB = 'intervalle 60—150 et fourchette 2024–2025';
const onceB = normalizeFrenchPunctuation(sampleB);
const twiceB = normalizeFrenchPunctuation(onceB);
check('idempotence plages numeriques', onceB, twiceB);

// ------------------------------------------------------------
// Court-circuit : chaine sans em-dash ni en-dash retournee identique.
// ------------------------------------------------------------
check(
  'chaine sans em-dash retournee telle quelle',
  normalizeFrenchPunctuation('aucun tiret long ici, juste de la prose'),
  'aucun tiret long ici, juste de la prose',
);

check(
  'chaine vide preservee',
  normalizeFrenchPunctuation(''),
  '',
);

// ------------------------------------------------------------
// Walker recursif.
// ------------------------------------------------------------
const tree = {
  title: 'la deeptech industrielle — hardware embarque — partage',
  score: 72,
  applicable: true,
  detail: null,
  warnings: [
    'plage 60-150 ok',
    'incise — a virer — ici aussi',
  ],
  nested: {
    rationale: 'pas de tiret long ici',
    intervalle: '60—150',
    children: [{ msg: 'sous — incise' }],
  },
};

const normalized = normalizeStringsRecursive(tree);

check(
  'walker normalise les strings de premier niveau',
  normalized.title,
  'la deeptech industrielle, hardware embarque, partage',
);
check('walker preserve les number', normalized.score, 72);
check('walker preserve les boolean', normalized.applicable, true);
check('walker preserve les null', normalized.detail, null);
check(
  'walker normalise les strings dans un array',
  normalized.warnings,
  ['plage 60-150 ok', 'incise, a virer, ici aussi'],
);
check(
  'walker normalise en profondeur',
  normalized.nested.rationale,
  'pas de tiret long ici',
);
check(
  'walker normalise plages numeriques en profondeur',
  normalized.nested.intervalle,
  '60-150',
);
check(
  'walker normalise dans un array d objets',
  normalized.nested.children[0].msg,
  'sous, incise',
);

// Le walker doit etre idempotent au meme titre que la fonction.
const twice = normalizeStringsRecursive(normalized);
check('walker idempotent', JSON.stringify(twice), JSON.stringify(normalized));

// Verifie aucun em-dash ou en-dash residuel apres normalisation.
const serialized = JSON.stringify(normalized);
checkTrue('aucun em-dash residuel apres walker', serialized.indexOf('—') === -1);
checkTrue('aucun en-dash residuel apres walker', serialized.indexOf('–') === -1);

// ------------------------------------------------------------
// Cas limite : valeurs primitives ou undefined passees directement.
// ------------------------------------------------------------
check('walker sur string brute', normalizeStringsRecursive('a — b'), 'a, b');
check('walker sur number brut', normalizeStringsRecursive(42), 42);
check('walker sur null brut', normalizeStringsRecursive(null), null);
check('walker sur undefined brut', normalizeStringsRecursive(undefined), undefined);

// ------------------------------------------------------------
// Bilan
// ------------------------------------------------------------
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
