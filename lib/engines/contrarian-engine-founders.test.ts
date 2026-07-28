// ============================================================
// Tests deterministes du bloc FONDATEURS de contrarian-engine
// ------------------------------------------------------------
// Ce que ces tests prouvent : une extraction sans cle founders ne
// fait plus lever analyzeContrarian a la construction de son prompt.
//
// Le defaut : le bloc FONDATEURS ecrivait
// ${extraction.founders.map(...)}. La racine extraction est sure, le
// second niveau ne l etait pas. types.ts declare founders comme
// tableau non optionnel, mais l objet vient d un parse LLM et
// tsconfig porte "strict": false, donc la declaration ne garantit
// rien a l execution.
//
// METHODE : on appelle la vraie fonction, pas une reproduction de son
// template. Le prompt se construit avant l appel LLM, donc une cle
// absente levait un TypeError avant meme que le client Anthropic soit
// sollicite. On neutralise la cle API pour que la fonction echoue de
// facon deterministe au premier appel reseau, et on lit la nature du
// rejet : un TypeError sur founders signe le defaut, l erreur de cle
// manquante signe un prompt construit jusqu au bout.
//
// Aucun appel reseau n est emis : la cle est videe avant l import.
// ============================================================

process.env.ANTHROPIC_API_KEY = '';

import { analyzeContrarian } from './contrarian-engine';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

const TEAM: any = { systemicCoverage: { score: 61 } };
const MARKET: any = { needIntensity: { score: 54 } };
const MACRO: any = { cyclePosition: 'milieu de cycle' };

/** Appelle le moteur et rend la nature du rejet. */
async function rejectionOf(extraction: any): Promise<{ name: string; message: string }> {
  try {
    await analyzeContrarian(extraction, TEAM, MARKET, MACRO, null);
    return { name: 'aucun', message: 'resolu' };
  } catch (err: any) {
    return { name: err?.constructor?.name ?? 'inconnu', message: String(err?.message ?? '') };
  }
}

function estDefautFounders(r: { name: string; message: string }): boolean {
  return r.name === 'TypeError' && /founders|reading 'map'/.test(r.message);
}

async function run() {

  console.log('\n[Suite 1] extraction sans cle founders');

  {
    const r = await rejectionOf({ companyName: 'Dossier Sans Fondateurs', sector: 'Deeptech', fundraise: {} });
    check(!estDefautFounders(r), `pas de TypeError sur founders (rejet obtenu : ${r.name})`);
    check(r.message.includes('ANTHROPIC_API_KEY'), 'le prompt est construit jusqu au bout, l echec vient de l appel LLM');
  }

  console.log('\n[Suite 2] founders null et founders non-tableau');

  {
    const rNull = await rejectionOf({ companyName: 'X', founders: null, fundraise: {} });
    check(!estDefautFounders(rNull), 'founders null ne leve pas');
    check(rNull.message.includes('ANTHROPIC_API_KEY'), 'founders null : prompt construit');

    // Un simple || laisserait passer une valeur non tableau, qui
    // leverait au .map suivant. La garde teste la forme.
    const rStr = await rejectionOf({ companyName: 'X', founders: 'A. Martin, B. Nguyen', fundraise: {} });
    check(!estDefautFounders(rStr), 'founders en chaine ne leve pas');
    check(rStr.message.includes('ANTHROPIC_API_KEY'), 'founders en chaine : prompt construit');

    const rObj = await rejectionOf({ companyName: 'X', founders: { name: 'A. Martin' }, fundraise: {} });
    check(!estDefautFounders(rObj), 'founders en objet ne leve pas');
  }

  console.log('\n[Suite 3] extraction nominale, comportement inchange');

  {
    const r = await rejectionOf({
      companyName: 'Dossier Temoin',
      sector: 'Deeptech',
      fundraise: { stage: 'Series A', amount: '8 M€' },
      founders: [
        { name: 'A. Martin', role: 'CEO', background: 'ex-Criteo' },
        { name: 'B. Nguyen', role: 'CTO', background: 'ex-INRIA' },
      ],
    });
    check(!estDefautFounders(r), 'extraction nominale : aucun TypeError');
    check(r.message.includes('ANTHROPIC_API_KEY'), 'extraction nominale : prompt construit');
  }

  console.log('\n[Suite 4] temoin du defaut ferme');

  {
    // Reproduction de l ancienne expression, pour documenter ce que la
    // garde evite. Si un jour ce temoin cesse de lever, c est que la
    // cle est garantie a la source et que la garde peut sauter.
    const extraction: any = { companyName: 'X' };
    let threw = false;
    try {
      void extraction.founders.map((f: any) => f.name).join('\n');
    } catch {
      threw = true;
    }
    check(threw, 'l ancienne expression levait bien sur une cle absente');

    // Et la nouvelle, sur la meme entree.
    let threw2 = false;
    let rendu = '';
    try {
      rendu = (Array.isArray(extraction.founders) ? extraction.founders : [])
        .map((f: any) => f.name).join('\n') || 'Aucun fondateur identifié dans le dossier.';
    } catch {
      threw2 = true;
    }
    check(!threw2, 'la nouvelle expression ne leve pas');
    check(rendu === 'Aucun fondateur identifié dans le dossier.', 'elle produit un repli lisible pour le modele');
  }

  console.log(`\n${pass} passes, ${fail} echecs`);
  if (fail > 0) process.exit(1);
}

run().catch((err) => { console.error(err); process.exit(1); });
