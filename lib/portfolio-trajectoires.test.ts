// ============================================================
// Tests deterministes de portfolio-trajectoires
// ------------------------------------------------------------
// Ce fichier portait ce nom et testait le noyau pur voisin, qui a
// desormais le sien. Le module lui-meme, cent trois lignes de
// composition entre deux stores et le noyau, n etait exerce par rien.
//
// Un module de composition n a presque pas de valeurs a verifier : ce
// qu il decide, c est quelles lectures il lance, avec quelles bornes,
// et ce qu il fait de leurs absences. Trois proprietes s y jouent, et
// chacune a un cout reel si elle cede. La borne de cinq cents, parce
// qu une lecture non bornee du portefeuille grandit avec le fonds. Le
// dossier sans snapshot, qui doit rester dans le listing : le
// commentaire du module promet qu il ne disparaitra pas silencieusement,
// et une promesse en commentaire ne vaut que si un test la porte. Et le
// tri final, qui est ce que le partner lit en premier.
//
//   npx tsx lib/portfolio-trajectoires.test.ts
// ============================================================

import { neutraliserServerOnly } from './test-support/supabase-double';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

neutraliserServerOnly();

// ============================================================
// Doubles des deux stores lus. On enregistre les appels : la question
// posee au module est « que vas-tu chercher », pas « que rends-tu ».
// ============================================================

const appelsAnalyses: Array<{ limit?: number }> = [];
const appelsSnapshots: string[] = [];
let analysesRendues: any[] = [];
let snapshotsParAnalyse: Record<string, any[]> = {};

function poserDouble(chemin: string, exports: Record<string, unknown>) {
  const p = require.resolve(chemin);
  const reel = require(p);
  require.cache[p] = { id: p, filename: p, loaded: true, exports: { ...reel, ...exports } } as any;
}

poserDouble('./analysis-store', {
  listAnalyses: async (opts: { limit?: number } = {}) => { appelsAnalyses.push(opts); return analysesRendues; },
});
poserDouble('./trajectory-store', {
  listSnapshotsForAnalysis: async (id: string) => { appelsSnapshots.push(id); return snapshotsParAnalyse[id] ?? []; },
});

/** Analyse minimale, avec des identifiants qui n existent qu ici. */
function analyse(id: string, companyName: string, extra: Record<string, unknown> = {}): any {
  return {
    id, companyName, sector: 'SaaS', subSector: null, country: 'France',
    geographicHub: null, yearFounded: null, roundType: null, roundAmountEur: null,
    verdict: 'reserve', verdictConfidence: null, globalScore: 50,
    blindspotScore: null, contrarianScore: null, coherenceScore: null,
    userNotes: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

function snapshot(analysisId: string, versionNum: number, globalScore: number, analyzedAt: string): any {
  return {
    id: `snap-${analysisId}-${versionNum}`, analysisId, versionId: `ver-${versionNum}`,
    versionNum, userId: 'usr-ZR1190', companyName: 'peu importe', analyzedAt,
    globalScore, verdict: 'reserve',
    dimensions: { team: null, market: null, macro: null, financial: null, contrarian: null, vigilance: null },
    fragiliteScore: null,
  };
}

(async () => {
  const mod = await import('./portfolio-trajectoires');
  const noyau = await import('./portfolio-trajectoires-core');

  // ============================================================
  console.log('\n[Suite 1] la lecture du portefeuille est bornee');
  // ============================================================
  {
    appelsAnalyses.length = 0; appelsSnapshots.length = 0;
    analysesRendues = [analyse('ana-XJ4417', 'Temoin XJ4417')];
    snapshotsParAnalyse = { 'ana-XJ4417': [snapshot('ana-XJ4417', 1, 50, '2026-01-01T00:00:00.000Z')] };

    const lignes = await mod.listPortfolioTrajectoires();
    check(appelsAnalyses.length === 1, 'une seule lecture des analyses');
    check(appelsAnalyses[0].limit === 500, 'et elle est bornee a 500, pas laissee ouverte');
    check(lignes.length === 1, 'la ligne du dossier est rendue');
  }

  // ============================================================
  console.log('\n[Suite 2] portefeuille vide : aucune lecture de snapshots');
  // ============================================================
  {
    appelsAnalyses.length = 0; appelsSnapshots.length = 0;
    analysesRendues = [];
    const lignes = await mod.listPortfolioTrajectoires();
    check(lignes.length === 0, 'la liste rendue est vide');
    check(appelsSnapshots.length === 0, 'et aucune lecture de snapshots n a ete lancee pour rien');
  }

  // ============================================================
  console.log('\n[Suite 3] un dossier sans snapshot reste dans le listing');
  // ============================================================
  {
    // C est la promesse ecrite dans le commentaire du module. Sans ce
    // test elle ne vaudrait que pour la ligne qui la porte.
    appelsAnalyses.length = 0; appelsSnapshots.length = 0;
    analysesRendues = [analyse('ana-SANS-SNAP', 'Dossier sans snapshot QN8802')];
    snapshotsParAnalyse = {};

    const lignes = await mod.listPortfolioTrajectoires();
    check(lignes.length === 1, 'le dossier sans snapshot n a pas disparu du listing');
    check(lignes[0].snapshotsCount === 0, 'son compte de snapshots est zero et il est affiche comme tel');
    check(lignes[0].direction === 'none', 'sa direction est none et non une tendance inventee');
    check(appelsSnapshots.includes('ana-SANS-SNAP'), 'ses snapshots ont bien ete cherches avant de conclure');
  }

  // ============================================================
  console.log('\n[Suite 4] chaque dossier voit ses propres snapshots');
  // ============================================================
  {
    // Les deux dossiers portent des scores qui n existent qu a un
    // endroit : une inversion des identifiants ferait tomber le test,
    // ce qu un jeu ou les deux dossiers auraient les memes snapshots ne
    // pourrait pas montrer.
    appelsAnalyses.length = 0; appelsSnapshots.length = 0;
    analysesRendues = [analyse('ana-AAA', 'Dossier AAA'), analyse('ana-BBB', 'Dossier BBB')];
    snapshotsParAnalyse = {
      'ana-AAA': [snapshot('ana-AAA', 1, 31, '2026-01-01T00:00:00.000Z'), snapshot('ana-AAA', 2, 37, '2026-02-01T00:00:00.000Z')],
      'ana-BBB': [snapshot('ana-BBB', 1, 82, '2026-01-01T00:00:00.000Z')],
    };

    const lignes = await mod.listPortfolioTrajectoires();
    const parId = Object.fromEntries(lignes.map((l: any) => [l.analysisId ?? l.id, l]));
    check(appelsSnapshots.length === 2, 'une lecture de snapshots par dossier, ni plus ni moins');
    check(new Set(appelsSnapshots).size === 2, 'et les deux identifiants sont distincts');
    const a = parId['ana-AAA'], b = parId['ana-BBB'];
    check(a?.snapshotsCount === 2 && b?.snapshotsCount === 1,
      'chaque ligne porte le compte de ses propres snapshots');
  }

  // ============================================================
  console.log('\n[Suite 5] le tri rendu est celui du noyau, pas l ordre de lecture');
  // ============================================================
  {
    // L ordre de lecture est deliberement l inverse de l ordre attendu.
    // Sans cette precaution le test ne mesurerait rien : sur un jeu deja
    // trie, retirer le tri du module laisse toutes les assertions
    // vertes, ce qui a ete constate en cassant volontairement la ligne.
    appelsAnalyses.length = 0; appelsSnapshots.length = 0;
    analysesRendues = [analyse('ana-CCC', 'Dossier CCC'), analyse('ana-BBB', 'Dossier BBB'), analyse('ana-AAA', 'Dossier AAA')];
    snapshotsParAnalyse = {
      // AAA chute de 40 a 12 : il porte un cran d alerte et doit remonter.
      'ana-AAA': [snapshot('ana-AAA', 1, 40, '2026-01-01T00:00:00.000Z'), snapshot('ana-AAA', 2, 12, '2026-05-01T00:00:00.000Z')],
      // BBB progresse : pas de cran, mais deux snapshots.
      'ana-BBB': [snapshot('ana-BBB', 1, 40, '2026-01-01T00:00:00.000Z'), snapshot('ana-BBB', 2, 44, '2026-05-01T00:00:00.000Z')],
      // CCC n a rien : sans cran, il ferme la marche.
      'ana-CCC': [],
    };

    const lignes = await mod.listPortfolioTrajectoires();
    const ordre = lignes.map((l: any) => l.analysisId ?? l.id);
    check(lignes.length === 3, 'les trois dossiers sont presents');
    check(ordre[0] === 'ana-AAA', 'le dossier qui chute remonte en tete, alors qu il etait lu en dernier');
    check(ordre[2] === 'ana-CCC', 'le dossier sans snapshot ferme la marche');
    // Le comparateur du noyau reste la reference de ce qui est juste :
    // on le lui demande plutot que de reecrire sa regle ici.
    const attendu = [...lignes].sort(noyau.compareByCran).map((l: any) => l.analysisId ?? l.id);
    check(JSON.stringify(ordre) === JSON.stringify(attendu), 'et l ordre rendu est exactement celui de compareByCran');
  }

  // ============================================================
  console.log('\n[Suite 6] le detail refuse un dossier qui n est pas au portefeuille');
  // ============================================================
  {
    appelsAnalyses.length = 0; appelsSnapshots.length = 0;
    analysesRendues = [analyse('ana-XJ4417', 'Temoin XJ4417')];
    snapshotsParAnalyse = { 'ana-XJ4417': [snapshot('ana-XJ4417', 1, 50, '2026-01-01T00:00:00.000Z')] };

    const inconnu = await mod.getPortfolioTrajectoryDetail('ana-INEXISTANT-ZZ0000');
    check(inconnu === null, 'un identifiant absent du portefeuille rend null');
    check(appelsSnapshots.length === 0, 'et aucun snapshot n est lu pour un dossier qu on ne connait pas');

    const connu = await mod.getPortfolioTrajectoryDetail('ana-XJ4417');
    check(connu !== null, 'un identifiant present rend un detail');
    check(appelsSnapshots.length === 1 && appelsSnapshots[0] === 'ana-XJ4417',
      'les snapshots lus sont ceux du dossier demande');
  }

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})();
