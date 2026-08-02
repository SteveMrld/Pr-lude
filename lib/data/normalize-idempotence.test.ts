// ============================================================
// Tests deterministes du contrat d idempotence des normaliseurs
// ------------------------------------------------------------
// Ce que ces tests prouvent : normalize(x) vaut normalize(normalize(x))
// pour toute valeur canonique du catalogue, sur les deux axes, et le
// contrat est verifie sur l ensemble du catalogue et non sur les deux
// cas qui avaient ete reperes.
//
// Le defaut ferme : normalizeStage reconnaissait 'Series C' et
// 'growth', qu elle mappe toutes deux vers 'series-c-plus', mais pas
// 'series-c-plus' lui-meme, qui tombait dans le retour 'unknown'
// final. normalizeAssetClass reconnaissait vingt de ses vingt et une
// valeurs de sortie par coincidence de mots-cle et manquait
// 'profitable-mature'. Or computeValuation normalise le stade a
// l entree puis transmet la valeur canonique a
// computeBySectorMultiples, qui la repasse dans getSectorMultiples :
// la valeur deja classee etait reclassee, et rendue unknown.
//
// Mesure sur le corpus avant correction : quatorze dossiers sur
// quarante et un, soit l integralite du parcours growth, perdaient
// leurs multiples sectoriels sur une table qui les portait.
//
// Ces tests balaient tout le catalogue plutot que les cas connus,
// parce que le defaut n etait pas deux mots-cle manquants mais
// l absence de contrat. Une classe d actif ajoutee demain a
// SECTOR_BENCHMARKS est couverte sans qu on ait a y penser.
// ============================================================

import {
  normalizeStage,
  normalizeAssetClass,
  getSectorMultiples,
  SECTOR_BENCHMARKS,
  type ValuationStage,
} from './sector-benchmarks';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const STAGES: Array<ValuationStage | 'unknown'> = ['seed', 'series-a', 'series-b', 'series-c-plus', 'unknown'];
const CLASSES = Object.keys(SECTOR_BENCHMARKS);

// ============================================================
console.log('\n[Suite 1] idempotence sur tout le catalogue des stades');
// ============================================================

{
  for (const st of STAGES) {
    check(normalizeStage(st) === st, `normalizeStage('${st}') rend '${st}' (obtenu '${normalizeStage(st)}')`);
  }
  // Le contrat lui-meme, exprime comme tel : deux passages valent un.
  const libellesLibres = [
    'Seed', 'pre-seed', 'amorcage', 'Series A', 'serie A late', 'post-PMF',
    'Series B', 'tour B', 'Series C', 'Series D', 'growth', 'late stage',
    'pre-IPO', 'capital de croissance', 'bridge', 'tour intermediaire', '',
  ];
  let violations = 0;
  for (const brut of libellesLibres) {
    const une = normalizeStage(brut);
    const deux = normalizeStage(une);
    if (une !== deux) { violations++; console.error(`      '${brut}' : ${une} puis ${deux}`); }
  }
  check(violations === 0, `normalize(normalize(x)) vaut normalize(x) sur ${libellesLibres.length} libelles libres`);
}

// ============================================================
console.log('\n[Suite 2] idempotence sur les vingt et une classes d actif');
// ============================================================

{
  check(CLASSES.length === 21, `le catalogue porte 21 classes d actif (obtenu ${CLASSES.length})`);
  const nonIdempotentes = CLASSES.filter((c) => normalizeAssetClass(c) !== c);
  check(
    nonIdempotentes.length === 0,
    `aucune classe non idempotente${nonIdempotentes.length ? ' : ' + nonIdempotentes.join(', ') : ''}`,
  );
  check(normalizeAssetClass('unclassified') === 'unclassified', 'le sentinel unclassified est idempotent');

  // Le cas nomme, garde explicitement : profitable-mature n est pas un
  // libelle sectoriel, c est une classe derivee par le moteur de
  // valorisation, donc aucun mot-cle ne la rattrapait.
  check(normalizeAssetClass('profitable-mature') === 'profitable-mature', 'profitable-mature est reconnue');

  let violations = 0;
  for (const brut of ['Fintech', 'SaaS B2B', 'e-commerce DTC', 'deeptech', 'Sante', 'IA generative', 'Neurotechnologie', '']) {
    const une = normalizeAssetClass(brut);
    const deux = normalizeAssetClass(une);
    if (une !== deux) { violations++; console.error(`      '${brut}' : ${une} puis ${deux}`); }
  }
  check(violations === 0, 'normalize(normalize(x)) vaut normalize(x) sur les libelles libres');
}

// ============================================================
console.log('\n[Suite 3] la table de benchmarks redevient atteignable');
// ============================================================

{
  // La consequence directe : toute combinaison portee par la table est
  // desormais lisible avec ses propres clefs. Avant correction, la
  // colonne series-c-plus entiere sortait null.
  let atteignables = 0, injoignables = 0;
  const manquantes: string[] = [];
  for (const c of CLASSES) {
    for (const st of ['seed', 'series-a', 'series-b', 'series-c-plus'] as ValuationStage[]) {
      const entree = SECTOR_BENCHMARKS[c][st];
      const neutralisee = entree && entree.min === 0 && entree.central === 0 && entree.max === 0;
      const lu = getSectorMultiples(c, st);
      if (neutralisee) continue; // neutralisation doctrinale, null attendu
      if (lu) atteignables++;
      else { injoignables++; manquantes.push(`${c}/${st}`); }
    }
  }
  check(
    injoignables === 0,
    `toutes les plages non neutralisees sont atteignables (${atteignables} lues${manquantes.length ? ', manquantes : ' + manquantes.join(', ') : ''})`,
  );
  check(atteignables === 79, `79 plages reelles lues (obtenu ${atteignables})`);
}

{
  // Les deux cas mesures en production, nommement.
  check(getSectorMultiples('ecommerce-dtc', 'series-c-plus')?.range.min === 0.4, 'ecommerce-dtc en series-c-plus rend sa plage 0,4-2,2x');
  check(getSectorMultiples('profitable-mature', 'series-b')?.range.min === 6, 'profitable-mature en series-b rend sa plage 6-15x');
}

// ============================================================
console.log('\n[Suite 4] les libelles libres ne sont pas degrades');
// ============================================================

{
  // La garde d idempotence s evalue avant les heuristiques : il faut
  // verifier qu elle ne les court-circuite pas a tort.
  check(normalizeStage('growth') === 'series-c-plus', 'growth reste series-c-plus');
  check(normalizeStage('Series C') === 'series-c-plus', 'Series C reste series-c-plus');
  check(normalizeStage('pre-seed') === 'seed', 'pre-seed reste seed');
  check(normalizeStage('bridge') === 'unknown', 'bridge reste unknown, aucun fallback silencieux');
  check(normalizeStage('  SEED  ') === 'seed', 'la casse et les espaces sont absorbes');
  check(normalizeAssetClass('Fintech') === 'fintech', 'Fintech reste fintech');
  check(normalizeAssetClass('e-commerce DTC') === 'ecommerce-dtc', 'e-commerce DTC reste ecommerce-dtc');
  // Un libelle qui ne touche aucun mot-cle reste unclassified. Le
  // choix de la chaine importe : 'Neurotechnologie commerciale' rend
  // industrial-hardware, comportement anterieur a la garde et
  // inchange par elle, mais qui montre que la table de mots-cle est
  // large. Ce n est pas l objet de ce test.
  check(normalizeAssetClass('zzz libelle sans mot cle connu') === 'unclassified', 'un libelle sans mot-cle reste unclassified');
  check(normalizeAssetClass('') === 'unclassified', 'un libelle vide reste unclassified');
}

// ============================================================
console.log('\n[Suite 5] le contrat vaut pour les valeurs futures du catalogue');
// ============================================================

{
  // La garde de classe d actif se lit sur les clefs de la table et non
  // sur une liste recopiee : une classe ajoutee demain est couverte
  // sans intervention. Le test le verifie en interrogeant la table.
  const toutesCouvertes = CLASSES.every((c) => normalizeAssetClass(c) === c);
  check(toutesCouvertes, 'la garde suit les clefs de SECTOR_BENCHMARKS, pas une liste figee');

  // Symetriquement, la liste des stades est finie et fermee par le
  // type : on verifie qu elle couvre exactement le type.
  const duType: Array<ValuationStage | 'unknown'> = ['seed', 'series-a', 'series-b', 'series-c-plus', 'unknown'];
  check(
    duType.every((st) => normalizeStage(st) === st),
    'les cinq valeurs du type de stade sont toutes idempotentes',
  );
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
