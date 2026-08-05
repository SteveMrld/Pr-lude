// ============================================================
// Tests deterministes de la troncature d un classeur
// ------------------------------------------------------------
// Ce que ces tests prouvent : un classeur coupe ne se lit plus comme un
// classeur complet, la coupe tombe sur une frontiere de ligne, et
// l avertissement n est pas lui-meme coupe par le plafond qu il annonce.
//
// Le defaut ferme est du 5 aout 2026, run b8d0e9ac : le classeur de
// Project Hello rend 32 710 caracteres aplatis, `bpChars` valait
// exactement 30 000 dans le cachet, et ce qui disparaissait etait la fin
// du tableau de financement, dont la ligne Equity levee. Rien ne le
// disait au modele.
//
// Execution : npx tsx lib/file-processor-troncature.test.ts
// ============================================================

import * as XLSX from 'xlsx';
import { extractExcelContent } from './file-processor';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

/** Classeur synthetique dont l aplatissement depasse le plafond. */
function classeur(lignes: number): Buffer {
  const wb = XLSX.utils.book_new();
  const aoa: any[][] = [['Poste', '2025', '2026', '2027', '2028']];
  for (let i = 0; i < lignes; i++) {
    aoa.push([`Ligne de charge numero ${i} au libelle volontairement long`, 100 + i, 200 + i, 300 + i, 400 + i]);
  }
  aoa.push(['Equity levee', 275000, 0, 0, 0]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Management BP');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

console.log('\n[Suite 1] un classeur court passe entier et sans avertissement');
{
  const t = extractExcelContent(classeur(5));
  check(t.length < 30000, 'il tient sous le plafond');
  check(!t.includes('DOCUMENT TRONQUE'), 'et rien ne l annonce tronque');
  check(t.includes('Equity levee'), 'la derniere ligne y est');
}

console.log('\n[Suite 2] un classeur long se declare tronque');
{
  const t = extractExcelContent(classeur(900));
  check(t.length <= 30000, `le plafond tient (${t.length})`);
  check(t.includes('DOCUMENT TRONQUE'), 'la coupe est annoncee dans le texte que le modele lit');
  check(!t.includes('Equity levee'), 'et la fin du document a bien disparu, ce qui est le cas a couvrir');
  check(/\d+ caracteres manquent/.test(t), 'l avertissement chiffre ce qui manque');
  check(t.includes('ne conclus pas'), 'et il interdit de conclure a une absence depuis un extrait');
}

console.log('\n[Suite 3] la coupe tombe sur une frontiere de ligne');
{
  const t = extractExcelContent(classeur(900));
  const avant = t.slice(0, t.indexOf('[DOCUMENT TRONQUE'));
  const lignes = avant.trimEnd().split('\n');
  const derniere = lignes[lignes.length - 1];
  // Une ligne de ce classeur porte quatre virgules. Une ligne coupee en
  // porterait moins, et sa derniere valeur serait un nombre ampute que
  // rien ne distinguerait d une valeur vraie.
  check((derniere.match(/,/g) || []).length === 4,
    `la derniere ligne retenue est complete (${derniere.slice(0, 60)})`);
}

console.log('\n[Suite 4] l avertissement survit au plafond qu il annonce');
{
  // Sans marge reservee, l avertissement serait ajoute puis coupe, et le
  // document se relirait comme complet : la garde se serait annulee
  // elle-meme.
  for (const n of [700, 900, 1500, 3000]) {
    const t = extractExcelContent(classeur(n));
    check(t.endsWith(']') && t.includes('DOCUMENT TRONQUE'),
      `${n} lignes : l avertissement est entier et final`);
  }
}

console.log('\n[Suite 5] une entree illisible ne leve pas');
{
  let leve = false;
  try { extractExcelContent(Buffer.from('pas un classeur')); } catch { leve = true; }
  check(!leve, 'un buffer qui n est pas un classeur rend un marqueur sans lever');
}

console.log(`\n${pass} passes, ${fail} echecs`);
if (fail > 0) process.exit(1);
