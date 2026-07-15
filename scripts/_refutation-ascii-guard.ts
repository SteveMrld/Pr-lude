// Garde-fou toAsciiEquiv : verifie que les chaines editorialisees
// n ont subi que des ajouts d accents et d apostrophes d elision.
import { aggregateRefutations } from '../lib/refutation/aggregator';

function toAscii(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Paires attendues (ancien ASCII vs nouveau accentue). Chaque paire
// doit avoir toAscii identique.
const PAIRS: Array<[string, string]> = [
  // aggregator.ts numeric
  ['Meme grandeur : 100k€ d apres src', 'Même grandeur : 100k€ d\'après src'],
  ['Deux valeurs divergentes pour la meme grandeur sur la meme periode, ecart 5k€.', 'Deux valeurs divergentes pour la même grandeur sur la même période, écart 5k€.'],
  // aggregator.ts verdict-signal
  ['retention pluri annuelle documentee (x)', 'rétention pluri annuelle documentée (x)'],
  ['base grands comptes installee (x)', 'base grands comptes installée (x)'],
  ['anciennete significative (x)', 'ancienneté significative (x)'],
  ['adherence longue des clients (x)', 'adhérence longue des clients (x)'],
  ['Verdict de reproductibilite high (src) : le produit serait facile a repliquer.', 'Verdict de reproductibilité high (src) : le produit serait facile à répliquer.'],
  ['Le code est peut etre reproductible, mais la duree d installation commerciale et la base de grands comptes constituent une barriere non code que le verdict ignore.', 'Le code est peut être reproductible, mais la durée d\'installation commerciale et la base de grands comptes constituent une barrière non code que le verdict ignore.'],
  // aggregator.ts label-calc
  ['Rule of 40 presente sans qualification temporelle.', 'Rule of 40 présenté sans qualification temporelle.'],
  ['Le calcul repose sur 2026, soit 2 ans apres l annee de reference 2024 du dossier.', 'Le calcul repose sur 2026, soit 2 ans après l\'année de référence 2024 du dossier.'],
  ['Un chiffre projete presente sans etiquette forward peut etre lu comme un resultat realise, ce qui fausse la lecture de la sante economique.', 'Un chiffre projeté présenté sans étiquette forward peut être lu comme un résultat réalisé, ce qui fausse la lecture de la santé économique.'],
  // detector observed strings
  ['retention 88% sur 3 ans (churn 12%)', 'rétention 88% sur 3 ans (churn 12%)'],
  ['40 grands comptes documentes', '40 grands comptes documentés'],
  ['fondee en 2011, 15 ans d anciennete', 'fondée en 2011, 15 ans d\'ancienneté'],
  ['clients presents depuis 2018, 8 ans d adherence', 'clients présents depuis 2018, 8 ans d\'adhérence'],
  // messages detecteurs
  ['Verdict de reproductibilite high (digitalReproducibility) contredit par 4 marqueurs de moat non technique : long-term-retention, enterprise-base. Le produit peut etre techniquement reproduit, mais la duree d installation commerciale et la base de grands comptes constituent une barriere non code.', 'Verdict de reproductibilité high (digitalReproducibility) contredit par 4 marqueurs de moat non technique : long-term-retention, enterprise-base. Le produit peut être techniquement reproduit, mais la durée d\'installation commerciale et la base de grands comptes constituent une barrière non code.'],
  ['Rule of 40 calcule sur 2026 (2 ans apres l annee de reference 2024 du dossier), sans qualification forward dans le libelle ni le rationale.', 'Rule of 40 calculé sur 2026 (2 ans après l\'année de référence 2024 du dossier), sans qualification forward dans le libellé ni le rationale.'],
  // cartouche
  ['Points de vigilance internes · 3 contradictions detectees', 'Points de vigilance internes · 3 contradictions détectées'],
  ['Le pipeline signale ici des tensions entre plusieurs elements du dossier, releves automatiquement. Ce ne sont pas des verdicts, ce sont des points a interroger en lecture.', 'Le pipeline signale ici des tensions entre plusieurs éléments du dossier, relevés automatiquement. Ce ne sont pas des verdicts, ce sont des points à interroger en lecture.'],
  ['Ce qui est affirme :', 'Ce qui est affirmé :'],
  ['Libelle contre base de calcul', 'Libellé contre base de calcul'],
];

let pass = 0, fail = 0;
for (const [before, after] of PAIRS) {
  const a = toAscii(before);
  const b = toAscii(after);
  if (a === b) {
    pass++;
    console.log(`  OK  toAscii identique : ${before.slice(0, 60)}...`);
  } else {
    fail++;
    console.error(`  KO  DIVERGENCE`);
    console.error(`    before ascii : ${a}`);
    console.error(`    after  ascii : ${b}`);
  }
}
console.log(`\n${pass} pass, ${fail} fail sur ${PAIRS.length} paires`);
process.exit(fail === 0 ? 0 : 1);
