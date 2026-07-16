// ============================================================
// Tests deterministes financial-table-alignment.ts
// ------------------------------------------------------------
// Suite doctrinale : les assertions portent sur QUELLE valeur tombe
// sous QUELLE annee, pas sur la longueur des lignes. Une suite qui
// verifierait seulement les longueurs repasserait au vert sans que
// le decalage historique soit repare. La fixture reproduit le cas
// reel 9201a046 InHairCare avec revenue 8 entrees et grossMargin /
// ebitda 7 entrees, ou l ancien code positionnel decalait EBITDA
// 2024 a 0.402 alors que la vraie valeur est 0.138.
// ============================================================

import { unionYears, alignSeriesToYears, type YearValueEntry } from './financial-table-alignment';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

// ============================================================
// Fixture 9201a046 : revenue 8 [2019..2026], gross et ebitda 7 [2020..2026]
// ============================================================
console.log('\n[Suite 1] Fixture 9201a046, alignement value-sous-annee');

const revenue: YearValueEntry[] = [
  { year: '2019', value: 0.2 },
  { year: '2020', value: 0.48 },
  { year: '2021', value: 1.56 },
  { year: '2022', value: 1.752 },
  { year: '2023', value: 1.483 },
  { year: '2024', value: 2.113 },
  { year: '2025', value: 3.697 },
  { year: '2026', value: 6.552 },
];
const grossMargin: YearValueEntry[] = [
  { year: '2020', value: 85 },
  { year: '2021', value: 84 },
  { year: '2022', value: 76 },
  { year: '2023', value: 76 },
  { year: '2024', value: 77 },
  { year: '2025', value: 73 },
  { year: '2026', value: 69 },
];
const ebitda: YearValueEntry[] = [
  { year: '2020', value: 0.157 },
  { year: '2021', value: 0.136 },
  { year: '2022', value: -0.53 },
  { year: '2023', value: -0.422 },
  { year: '2024', value: 0.138 },
  { year: '2025', value: 0.402 },
  { year: '2026', value: 0.785 },
];

const years = unionYears(revenue, grossMargin, ebitda);
check(years.length === 8, `union produit 8 annees (obtenu ${years.length})`);
check(years[0] === '2019', `premiere annee = 2019 (obtenu ${years[0]})`);
check(years[7] === '2026', `derniere annee = 2026 (obtenu ${years[7]})`);
check(
  years.join(',') === '2019,2020,2021,2022,2023,2024,2025,2026',
  `tri strict ascendant (obtenu ${years.join(',')})`,
);

const alignedRevenue = alignSeriesToYears(revenue, years);
const alignedGross = alignSeriesToYears(grossMargin, years);
const alignedEbitda = alignSeriesToYears(ebitda, years);

// CA 2019 = 0.2 : la seule serie qui contient 2019
check(alignedRevenue[years.indexOf('2019')] === 0.2, `CA 2019 = 0.2`);

// Marge brute et EBITDA n ont pas 2019 : cellule vide (null)
check(alignedGross[years.indexOf('2019')] === null, `Marge brute 2019 = null (serie sans 2019)`);
check(alignedEbitda[years.indexOf('2019')] === null, `EBITDA 2019 = null (serie sans 2019)`);

// Le bug historique corrige : EBITDA 2024 doit valoir 0.138, pas 0.402.
// Ancien code positionnel : alignedEbitda[4] avec years[4]=2024 mais
// ebitda[4]=0.138 semble aligne, sauf que years commence a 2019 et ebitda
// a 2020 : ebitda[4] = 2024 en cle, mais rendu sous years[4]=2023 avec
// l ancien code. Le decalage exact affichait EBITDA 2025 (0.402) sous
// years 2024. Le nouveau code garantit l alignement par cle annee.
check(alignedEbitda[years.indexOf('2024')] === 0.138, `EBITDA 2024 = 0.138 (correction du bug)`);
check(alignedEbitda[years.indexOf('2025')] === 0.402, `EBITDA 2025 = 0.402`);
check(alignedEbitda[years.indexOf('2024')] !== 0.402, `EBITDA 2024 different de 0.402 (garde anti-regression)`);
check(alignedEbitda[years.indexOf('2026')] === 0.785, `EBITDA 2026 = 0.785`);

// Marge brute 2024 = 77
check(alignedGross[years.indexOf('2024')] === 77, `Marge brute 2024 = 77`);
check(alignedGross[years.indexOf('2024')] !== 73, `Marge brute 2024 different de 73 (garde anti-regression)`);

// Toutes les valeurs revenue tombent sous la bonne annee
for (const entry of revenue) {
  const y = String(entry.year);
  check(
    alignedRevenue[years.indexOf(y)] === entry.value,
    `CA ${y} = ${entry.value}`,
  );
}
// Toutes les valeurs grossMargin tombent sous la bonne annee
for (const entry of grossMargin) {
  const y = String(entry.year);
  check(
    alignedGross[years.indexOf(y)] === entry.value,
    `Marge brute ${y} = ${entry.value}`,
  );
}
// Toutes les valeurs ebitda tombent sous la bonne annee
for (const entry of ebitda) {
  const y = String(entry.year);
  check(
    alignedEbitda[years.indexOf(y)] === entry.value,
    `EBITDA ${y} = ${entry.value}`,
  );
}

// ============================================================
console.log('\n[Suite 2] Bords : series vides, undefined, doublons');

const emptyAligned = alignSeriesToYears([], years);
check(emptyAligned.length === years.length, 'serie vide : longueur egale a years');
check(emptyAligned.every(v => v === null), 'serie vide : toutes cellules null');

const undefAligned = alignSeriesToYears(undefined, years);
check(undefAligned.every(v => v === null), 'serie undefined : toutes cellules null');

const nullAligned = alignSeriesToYears(null, years);
check(nullAligned.every(v => v === null), 'serie null : toutes cellules null');

const dup: YearValueEntry[] = [
  { year: '2020', value: 10 },
  { year: '2020', value: 20 },
];
const dupAligned = alignSeriesToYears(dup, ['2020']);
check(dupAligned[0] === 10, 'doublon : premiere occurrence retenue');

// Entree avec value non-numerique ignoree
const badValue: YearValueEntry[] = [
  { year: '2020', value: NaN as any },
  { year: '2021', value: 5 },
];
const badAligned = alignSeriesToYears(badValue, ['2020', '2021']);
check(badAligned[0] === null, 'NaN ignore, cellule = null');
check(badAligned[1] === 5, 'valeur numerique suivante preservee');

// Annee absente de la serie mais presente dans years
const partial: YearValueEntry[] = [{ year: '2023', value: 42 }];
const partialAligned = alignSeriesToYears(partial, ['2020', '2021', '2022', '2023']);
check(partialAligned[0] === null && partialAligned[1] === null && partialAligned[2] === null, 'annees absentes rendues null');
check(partialAligned[3] === 42, 'annee presente : valeur alignee');

// ============================================================
console.log('\n[Suite 3] Tri numerique versus lexical');

const mixed = unionYears([
  { year: 2010, value: 1 },
  { year: 2003, value: 1 },
  { year: 2020, value: 1 },
  { year: 1999, value: 1 },
]);
check(mixed[0] === '1999', 'tri numerique : 1999 en premier');
check(mixed[1] === '2003', 'tri numerique : 2003 en deuxieme');
check(mixed[2] === '2010', 'tri numerique : 2010 en troisieme');
check(mixed[3] === '2020', 'tri numerique : 2020 en dernier');
// Si le tri etait lexical, 2010 serait avant 2003 (2 < 3 apres 201...).
// Ce test l exclut explicitement.

// Melange number et string dans la meme serie
const stringInt = unionYears([
  { year: '2020', value: 1 },
  { year: 2021, value: 1 },
]);
check(stringInt.length === 2, 'string et number distincts fusionnes en union');
check(stringInt[0] === '2020' && stringInt[1] === '2021', 'tri correct meme avec types mixtes');

// Deux series avec le meme sous-ensemble d annees
const rev = [{ year: '2020', value: 1 }, { year: '2021', value: 2 }];
const gross = [{ year: '2020', value: 80 }, { year: '2021', value: 82 }];
const uMatch = unionYears(rev, gross);
check(uMatch.length === 2 && uMatch[0] === '2020' && uMatch[1] === '2021', 'series identiques : union = 2 annees');

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
