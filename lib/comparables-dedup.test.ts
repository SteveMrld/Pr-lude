// ============================================================
// Test deterministe : dedup canonique des comparables
// ------------------------------------------------------------
// Bug rapporte : Pasqal apparait deux fois dans le top 5 du
// dossier Pen Group avec le meme score 13 pour cent. Ce test
// reproduit la situation avec un corpus injecte qui contient
// deux variantes "Pasqal" et "Pasqal SAS", verifie que la
// fonction de dedup ne renvoie qu une occurrence par nom
// canonique, et confirme que le top N ne peut plus contenir
// de doublon.
//
//   npx tsx lib/comparables-dedup.test.ts
// ============================================================

import {
  canonicalCompanyName,
  dedupByCanonicalName,
  type DedupableComparable,
} from './comparables-dedup';

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL : ${label}`);
  }
}

// ============================================================
// canonicalCompanyName : normalisations basiques
// ============================================================
{
  check('canonical : casse normalisee', canonicalCompanyName('Pasqal') === 'pasqal');
  check('canonical : espaces externes', canonicalCompanyName('  Pasqal  ') === 'pasqal');
  check('canonical : espaces internes collapse', canonicalCompanyName('Pen   Group') === 'pen group');
  check('canonical : accents retires', canonicalCompanyName('Société') === 'societe');
  check('canonical : ponctuation legere retiree', canonicalCompanyName('Pasqal, Inc.') === 'pasqal');
}

// ============================================================
// canonicalCompanyName : suffixes legaux
// ============================================================
{
  check('canonical : suffixe SAS', canonicalCompanyName('Pasqal SAS') === 'pasqal');
  check('canonical : suffixe S.A.S avec points', canonicalCompanyName('Pasqal S.A.S') === 'pasqal');
  check('canonical : suffixe Inc', canonicalCompanyName('Pasqal Inc') === 'pasqal');
  check('canonical : suffixe Inc. avec point', canonicalCompanyName('Pasqal Inc.') === 'pasqal');
  check('canonical : suffixe Ltd', canonicalCompanyName('Acme Ltd') === 'acme');
  check('canonical : suffixe GmbH', canonicalCompanyName('Acme GmbH') === 'acme');
  check('canonical : suffixe LLC', canonicalCompanyName('Acme LLC') === 'acme');
  check('canonical : suffixe PLC', canonicalCompanyName('Acme PLC') === 'acme');
  check('canonical : suffixe BV', canonicalCompanyName('Acme BV') === 'acme');
}

// ============================================================
// canonicalCompanyName : ne casse pas les noms multi-mots reels
// ============================================================
{
  // Pasqal vs Pasqal Computing : entites differentes a priori, on ne fusionne pas
  check('canonical : Pasqal Computing distinct de Pasqal',
    canonicalCompanyName('Pasqal Computing') !== canonicalCompanyName('Pasqal'));
  // Air France n est pas reduit a Air (FR n est pas dans la liste de suffixes)
  check('canonical : Air France preserve',
    canonicalCompanyName('Air France') === 'air france');
  // OpenAI reste OpenAI
  check('canonical : OpenAI inchange', canonicalCompanyName('OpenAI') === 'openai');
  // Nom vide
  check('canonical : nom vide retourne vide', canonicalCompanyName('') === '');
}

// ============================================================
// dedupByCanonicalName : cas reel Pen Group + Pasqal x2
// ------------------------------------------------------------
// Reproduit le bug : deux entrees Pasqal scorant la meme valeur
// dans le top 5 stage_aligned. Apres dedup, une seule survit.
// ============================================================
{
  const corpus: DedupableComparable[] = [
    { name: 'IQM Quantum Computers', similarity: 18 },
    { name: 'Pasqal', similarity: 13 },
    { name: 'Pasqal SAS', similarity: 13 },
    { name: 'Quandela', similarity: 11 },
    { name: 'Alice & Bob', similarity: 10 },
    { name: 'PsiQuantum', similarity: 9 },
  ];
  const dedup = dedupByCanonicalName(corpus);
  check('Pen Group : dedup retire la 2e occurrence Pasqal', dedup.length === 5);
  const pasqalOccurrences = dedup.filter((c) => /pasqal/i.test(c.name)).length;
  check('Pen Group : une seule occurrence Pasqal apres dedup', pasqalOccurrences === 1);
  // Top 5 apres dedup ne contient plus de doublon
  const top5 = dedup.slice(0, 5);
  const top5Names = new Set(top5.map((c) => canonicalCompanyName(c.name)));
  check('Pen Group : top 5 sans doublon de cle canonique', top5Names.size === 5);
}

// ============================================================
// dedupByCanonicalName : variantes typographiques courantes
// ============================================================
{
  const corpus: DedupableComparable[] = [
    { name: 'OpenAI', similarity: 20 },
    { name: 'openai', similarity: 19 },
    { name: 'Open AI', similarity: 18 },  // espace = entite differente, garde
    { name: 'Anthropic', similarity: 15 },
    { name: 'Anthropic, Inc.', similarity: 14 },
  ];
  const dedup = dedupByCanonicalName(corpus);
  // OpenAI et openai fusionnent. Open AI (avec espace) reste distinct.
  // Anthropic et Anthropic, Inc. fusionnent.
  check('variantes : OpenAI casse-insensible dedup', dedup.length === 3);
  check('variantes : Open AI avec espace reste distinct',
    dedup.some((c) => canonicalCompanyName(c.name) === 'open ai'));
}

// ============================================================
// dedupByCanonicalName : preserve l ordre du tri amont
// ------------------------------------------------------------
// Si l appelant a trie par similarity desc, la premiere
// occurrence rencontree (donc la version conservee) doit etre
// la plus pertinente. On verifie en injectant un corpus deja
// trie et en s assurant que la similarity de l element conserve
// est bien la plus haute.
// ============================================================
{
  const corpus: DedupableComparable[] = [
    { name: 'Pasqal', similarity: 22 },        // <- doit gagner
    { name: 'IQM', similarity: 18 },
    { name: 'Pasqal SAS', similarity: 13 },    // <- doit etre ecartee
  ];
  const dedup = dedupByCanonicalName(corpus);
  const pasqalKept = dedup.find((c) => canonicalCompanyName(c.name) === 'pasqal');
  check('tri preserve : Pasqal conservee a similarity 22 (pas 13)',
    pasqalKept !== undefined && pasqalKept.similarity === 22);
}

// ============================================================
// dedupByCanonicalName : robustesse aux noms vides
// ============================================================
{
  const corpus: DedupableComparable[] = [
    { name: 'Pasqal', similarity: 13 },
    { name: '', similarity: 12 },
    { name: 'IQM', similarity: 10 },
  ];
  const dedup = dedupByCanonicalName(corpus);
  // Le nom vide passe sans etre dedupique (pour ne pas masquer une donnee
  // anormale). Le test verifie juste qu il n y a pas de crash et que les
  // noms valides sont preserves.
  check('robustesse : nom vide ne crashe pas la dedup', dedup.length === 3);
}

// ============================================================
// dedupByCanonicalName : aucun doublon en sortie quel que soit l input
// ============================================================
{
  const corpus: DedupableComparable[] = [
    { name: 'Pasqal', similarity: 20 },
    { name: 'PASQAL', similarity: 19 },
    { name: 'pasqal', similarity: 18 },
    { name: 'Pasqal SAS', similarity: 17 },
    { name: 'Pasqal Inc', similarity: 16 },
    { name: 'Pasqal, Inc.', similarity: 15 },
  ];
  const dedup = dedupByCanonicalName(corpus);
  check('invariant : six variantes Pasqal -> une seule', dedup.length === 1);
}

// ============================================================
// dedupByCanonicalName : top N propriete generale
// ------------------------------------------------------------
// Apres dedup puis slice(0, topN), aucune cle canonique ne doit
// apparaitre plus d une fois dans la sortie, quel que soit
// l input. Reproduit la garantie demandee.
// ============================================================
{
  const noisyCorpus: DedupableComparable[] = Array.from({ length: 20 }, (_, i) => ({
    name: i % 3 === 0 ? 'Pasqal' : i % 3 === 1 ? 'IQM' : 'Quandela',
    similarity: 100 - i,
  }));
  const topN = 5;
  const top = dedupByCanonicalName(noisyCorpus).slice(0, topN);
  const uniqueKeys = new Set(top.map((c) => canonicalCompanyName(c.name)));
  check('invariant top N : aucune cle canonique en doublon dans le top 5',
    uniqueKeys.size === top.length);
}

console.log(`\n=== comparables-dedup ===`);
console.log(`pass ${pass} / fail ${fail}`);
if (fail > 0) process.exit(1);
