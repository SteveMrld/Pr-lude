// ============================================================
// LISTE-CAPTURE : l accueil et l historique, en image et en releve
// ------------------------------------------------------------
// Le harnais de note ne couvrait que la note : il ouvre un dossier,
// clique la bascule et photographie le document. Les deux surfaces de
// liste, l accueil et l historique, n avaient aucun avant-apres, et le
// chantier du 8 aout 2026 en demandait un.
//
// IL ENREGISTRE LE SUPPORT, ET C EST LA LECON DU 8 AOUT. Les trois index
// du harnais de note portent le nom, les octets, la hauteur et
// l empreinte, et aucun ne porte la base interrogee ni le sha qu elle
// servait. Une serie de reference qui ne dit pas de quel support elle
// est la reference ne peut pas signaler qu on la compare a une autre.
// Cet index porte donc la base, le sha de l arbre et l heure, a cote de
// chaque mesure.
//
// IL RELEVE AUTANT QU IL PHOTOGRAPHIE. Une image dit qu il s est passe
// quelque chose, elle ne dit pas quoi : le releve compte les lignes, les
// etats nommes et les verdicts rendus, ce qui se compare d une passe a
// l autre sans ouvrir les images. Les deux repondent a des questions
// differentes et aucune ne remplace l autre.
//
// CE QU IL NE COUVRE PAS. Il mesure le support qu on lui donne. Pointe
// sur localhost il ne dit rien de ce que Vercel sert, et l index le dit
// plutot que de laisser le lecteur le supposer.
//
// Usage :
//   npx tsx scripts/liste-capture.ts <url-base> <repertoire> [--etiquette <nom>]
// ============================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

function env(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of ['.env', '.env.local']) {
    if (!existsSync(f)) continue;
    for (const l of readFileSync(f, 'utf-8').split('\n')) {
      const m = l.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

/** Les deux surfaces de liste, et ce qu il faut attendre sur chacune. */
export const SURFACES = [
  { nom: 'accueil', chemin: '/', ancre: '.recents' },
  { nom: 'historique', chemin: '/history', ancre: 'a[href*="/dossiers/"]' },
] as const;

export type ReleveSurface = {
  nom: string;
  url: string;
  hauteur: number;
  octets: number;
  lignes: number;
  etats: Record<string, number>;
  verdicts: Record<string, number>;
  classesAEspace: number;
  erreur: string | null;
};

function shaDeLArbre(): string {
  try { return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim(); }
  catch { return 'inconnu'; }
}

function arbrePropre(): boolean {
  try { return execSync('git status --porcelain', { encoding: 'utf-8' }).trim() === ''; }
  catch { return false; }
}

async function main() {
  const args = process.argv.slice(2);
  const positionnels: string[] = [];
  let etiquette = 'sans-etiquette';
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--etiquette') { etiquette = args[i + 1] || etiquette; i += 1; continue; }
    positionnels.push(args[i]);
  }
  const [base, repertoire] = positionnels;
  if (!base || !repertoire) {
    console.error('Usage : npx tsx scripts/liste-capture.ts <url-base> <repertoire> [--etiquette <nom>]');
    process.exit(2);
  }
  mkdirSync(repertoire, { recursive: true });

  const executablePath = env().PUPPETEER_EXECUTABLE_PATH;
  if (!executablePath) throw new Error('PUPPETEER_EXECUTABLE_PATH absente de .env.local');

  const puppeteer = await import('puppeteer-core');
  const browser = await puppeteer.default.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

  const releves: ReleveSurface[] = [];

  for (const surface of SURFACES) {
    const url = `${base}${surface.chemin}`;
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 2 });
    let erreur: string | null = null;
    try {
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 120_000 });
      // Les deux surfaces peuplent leur liste par un effet, donc apres
      // le reseau inactif. L attente porte sur l ancre plutot que sur un
      // delai, et son echec se declare au lieu de rendre une page vide.
      await page.waitForSelector(surface.ancre, { timeout: 45_000 });
      await new Promise(r => setTimeout(r, 2500));
    } catch (e: any) {
      erreur = e?.message || 'ouverture impossible';
    }

    const releve = await page.evaluate(`(function () {
      function compte(sel) { return document.querySelectorAll(sel).length; }
      var lignes = document.querySelectorAll('a[href*="/dossiers/"]');
      // Les etats et les verdicts se relevent sur le texte des pastilles
      // plutot que sur une liste ecrite ici : une valeur ajoutee demain
      // entre dans le releve sans qu on y pense.
      var etats = {}, verdicts = {};
      var pastilles = document.querySelectorAll('[data-role="etat"]');
      for (var i = 0; i < pastilles.length; i++) {
        var t = (pastilles[i].textContent || '').trim();
        if (t) etats[t] = (etats[t] || 0) + 1;
      }
      var pv = document.querySelectorAll('[data-role="verdict"], .recents-card-verdict');
      for (var j = 0; j < pv.length; j++) {
        var v = (pv[j].textContent || '').trim();
        if (v) verdicts[v] = (verdicts[v] || 0) + 1;
      }
      // Une classe portant un espace se decoupe en plusieurs classes, ce
      // qui est le defaut mesure le 8 aout sur les pastilles de verdict.
      var aEspace = 0;
      var tous = document.querySelectorAll('[class]');
      for (var k = 0; k < tous.length; k++) {
        var cl = tous[k].getAttribute('class') || '';
        if (/verdict-[a-z0-9-]*\\s+[a-z]/i.test(cl)) aEspace++;
      }
      return {
        hauteur: document.body.scrollHeight,
        lignes: lignes.length,
        etats: etats,
        verdicts: verdicts,
        classesAEspace: aEspace,
      };
    })()`) as any;

    const fichier = join(repertoire, `${surface.nom}.png`);
    await page.screenshot({ path: fichier as any, fullPage: true });
    const octets = readFileSync(fichier).length;
    await page.close();

    releves.push({
      nom: surface.nom,
      url,
      hauteur: releve.hauteur,
      octets,
      lignes: releve.lignes,
      etats: releve.etats,
      verdicts: releve.verdicts,
      classesAEspace: releve.classesAEspace,
      erreur,
    });
  }

  await browser.close();

  const index = {
    // LE SUPPORT VOYAGE AVEC LA MESURE.
    base,
    etiquette,
    commitSha: shaDeLArbre(),
    arbrePropre: arbrePropre(),
    surfaces: releves,
  };
  writeFileSync(join(repertoire, 'index.json'), JSON.stringify(index, null, 2));

  console.log(`Base : ${base}`);
  console.log(`Sha de l arbre : ${index.commitSha}${index.arbrePropre ? '' : ' (arbre modifie, la capture ne correspond a aucun commit)'}`);
  console.log(`Etiquette : ${etiquette}\n`);
  let enEchec = 0;
  for (const r of releves) {
    if (r.erreur) enEchec += 1;
    console.log(`  ${r.nom.padEnd(12)} ${r.erreur ? `ECHEC : ${r.erreur}` : `${r.lignes} ligne(s), ${r.hauteur} px, ${(r.octets / 1024).toFixed(0)} Ko`}`);
    if (r.erreur) continue;
    const e = Object.entries(r.etats).map(([k, v]) => `${k} (${v})`).join(', ');
    const v = Object.entries(r.verdicts).map(([k, n]) => `${k} (${n})`).join(', ');
    console.log(`  ${''.padEnd(12)} etats    : ${e || '(aucun releve)'}`);
    console.log(`  ${''.padEnd(12)} verdicts : ${v || '(aucun releve)'}`);
    if (r.classesAEspace > 0) {
      console.log(`  ${''.padEnd(12)} ATTENTION : ${r.classesAEspace} classe(s) de verdict portant un espace`);
    }
  }
  // LE DENOMINATEUR S IMPRIME AVEC LE RESULTAT. Deux surfaces capturees
  // sur deux ne se lit pas comme une sur deux, et l index ne le dirait
  // pas de lui-meme.
  console.log(`\n${releves.length - enEchec} surface(s) capturee(s) sur ${releves.length}.`);
  if (enEchec > 0) process.exit(1);
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
