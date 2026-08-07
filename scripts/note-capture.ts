// ============================================================
// NOTE-CAPTURE : images de reference de la note d instruction
// ------------------------------------------------------------
// Ecrit le 7 aout 2026 pour le chantier design. Les deux gardes
// existantes ne repondent pas de l apparence : `note-snapshot` compare
// des balises styles retires, `style-conservation` compare des regles
// dans du texte source. Ni l une ni l autre ne dit a quoi la note
// ressemble.
//
// POURQUOI L APPLICATION REELLE ET NON UN RENDU HORS NEXT
//
// Un rendu par `renderToStaticMarkup` produirait des blocs `<style>`
// sans les classes de portee que styled-jsx pose a la compilation.
// Toutes les regles s appliqueraient alors globalement, y compris
// celles qui, en production, n atteignent pas les elements rendus par
// un composant voisin. La capture montrerait la note telle qu elle
// devrait etre et non telle qu elle est, ce qui est le pire des deux
// mondes pour juger une hierarchie.
//
// La capture passe donc par le serveur de developpement et un
// navigateur reel, seul chemin ou la portee est celle de production.
//
// CE QU ELLE NE COUVRE PAS. Le rendu depend de la machine : polices
// systeme, facteur d echelle, version du navigateur. Deux captures ne
// se comparent que si elles viennent du meme poste, ce qui en fait un
// instrument de jugement humain et non une garde automatique. Elle ne
// remplace ni l une ni l autre des deux gardes, elle repond a une
// question qu aucune des deux ne pose.
//
// LES DEUX GARDES DE L INSTRUMENT, 7 aout 2026
//
// Une passe apres a rendu vingt-cinq images identiques octet pour
// octet a leur reference, et l a annonce comme un succes : vingt-cinq
// capturees, zero en echec. L instrument avait reproduit sa propre
// reference et rien dans sa sortie ne le disait. Deux gardes ferment
// cela, et elles ne ferment pas la meme chose.
//
// La premiere porte sur ce qui est servi, avant toute capture. Les
// jetons de la note sont lus dans app/globals.css et compares a ce que
// le navigateur calcule sur la page. S ils divergent, le serveur
// interroge ne sert pas l etat courant du depot et la passe s arrete
// sans rien ecrire. La liste des jetons compares se derive du fichier
// et non d une enumeration ecrite a la main, si bien qu un jeton ajoute
// demain entre dans la comparaison sans qu on y pense.
//
// La seconde porte sur ce qui est produit, apres coup. Quand la passe
// est declaree comme un apres, par --reference, chaque image est
// comparee par empreinte a celle de la reference. Une image identique
// est un incident et non un resultat : les jetons de la note sont
// globaux et toute note rend un titre de section, puisque l attente de
// cette capture porte precisement sur `.note-section-title`. Une seule
// identite fait donc echouer la passe.
//
// Les deux sont necessaires parce qu elles echouent par des chemins
// differents. La premiere se prononce sur la cause et ne peut rien
// dire d un changement qui ne passe pas par un jeton ; la seconde se
// prononce sur l effet et ne dit pas pourquoi. La premiere seule
// laisserait passer un changement de structure servi par un cache de
// page ; la seconde seule dirait qu il ne s est rien passe sans dire
// que le serveur etait en cause.
//
// Usage :
//   npx tsx scripts/note-capture.ts <url-base> <dossier-sortie> [limite]
//                                   [--reference <dossier>]
// ============================================================

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import {
  classerVersusReference,
  divergencesJetons,
  empreinte,
  jetonsDeclares,
  verdictIdentite,
  type VersusReference,
} from '../lib/controle/capture-garde';

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

async function notes(e: Record<string, string>, limite: number) {
  const url = e.NEXT_PUBLIC_SUPABASE_URL || e.SUPABASE_URL;
  const key = e.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(
    `${url}/rest/v1/analyses?select=id,company_name&pipeline_engines_status=not.is.null`
    + `&order=created_at.desc&limit=${limite}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!r.ok) throw new Error(`corpus: ${r.status}`);
  return (await r.json()) as Array<{ id: string; company_name: string }>;
}

async function controlerLeServi(page: any): Promise<void> {
  const { compares, ecartes } = jetonsDeclares(readFileSync('app/globals.css', 'utf-8'));
  const noms = Object.keys(compares);
  const servi: Record<string, string> = await page.evaluate((ns: string[]) => {
    const s = getComputedStyle(document.documentElement);
    const out: Record<string, string> = {};
    for (const n of ns) out[n] = s.getPropertyValue(n).trim();
    return out;
  }, noms);

  const divergents = divergencesJetons(compares, servi);
  console.log(
    `Empreinte du servi : ${noms.length - divergents.length}/${noms.length} jetons conformes`
    + `, ${ecartes.length} ecartes car indirects.`,
  );
  if (divergents.length > 0) {
    for (const d of divergents.slice(0, 12)) {
      console.log(`  DIVERGE  ${d.jeton.padEnd(26)} depot=${d.depot}  servi=${d.servi || '(vide)'}`);
    }
    throw new Error(
      `Le serveur ne sert pas l etat courant du depot : ${divergents.length} jetons divergent. `
      + `Aucune capture ecrite. Relancer le serveur sur le code du depot avant de recommencer.`,
    );
  }
}

// ------------------------------------------------------------
// GARDE D IDENTITE. N a de sens que sur une passe declaree comme un
// apres. Sur une reference il n y a rien a comparer, et sur un rejeu
// a code constant l identite est le resultat attendu : c est la
// declaration --reference qui fait de l identite un incident.
// ------------------------------------------------------------
function empreintesReference(dossier: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of readdirSync(dossier)) {
    if (!f.endsWith('.png')) continue;
    out[f.slice(0, -4)] = empreinte(readFileSync(join(dossier, f)));
  }
  return out;
}

(async () => {
  const argv = process.argv.slice(2);
  let reference: string | null = null;
  const iRef = argv.indexOf('--reference');
  if (iRef >= 0) {
    reference = argv[iRef + 1] ?? null;
    if (!reference) { console.log('--reference attend un dossier'); process.exit(2); }
    argv.splice(iRef, 2);
  }
  const [base, sortie, limiteArg] = argv;
  if (!base || !sortie) {
    console.log('usage: note-capture.ts <url-base> <dossier-sortie> [limite] [--reference <dossier>]');
    process.exit(2);
  }
  if (reference && !existsSync(reference)) throw new Error(`reference introuvable : ${reference}`);

  const e = env();
  const executablePath = e.PUPPETEER_EXECUTABLE_PATH;
  if (!executablePath) throw new Error('PUPPETEER_EXECUTABLE_PATH absente de .env.local');

  const refs = reference ? empreintesReference(reference) : {};
  if (reference) console.log(`Passe declaree APRES, comparee a ${Object.keys(refs).length} images de ${reference}.\n`);

  mkdirSync(sortie, { recursive: true });
  const puppeteer = await import('puppeteer-core');
  const browser = await puppeteer.default.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

  const liste = await notes(e, parseInt(limiteArg || '25', 10));
  const index: Record<string, {
    nom: string; octets: number; hauteur: number; erreur: string | null;
    empreinte?: string; versusReference?: 'differe' | 'identique' | 'sans-reference';
  }> = {};
  let ok = 0, ko = 0;
  const identiques: string[] = [];
  const etats: VersusReference[] = [];
  let serviControle = false;

  for (const n of liste) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 2 });
    try {
      await page.goto(`${base}/dossiers/${n.id}`, { waitUntil: 'networkidle0', timeout: 90_000 });

      // BASCULER EN VUE NOTE. La page ouvre sur le tableau de bord ; la
      // note vit derriere un bouton, `viewMode === 'note'`. La premiere
      // version de ce harnais l ignorait et capturait le tableau de
      // bord des vingt-cinq notes : les series avant et apres etaient
      // identiques au pixel, et pour cause, elles montraient la meme
      // page. C etait un defaut de l instrument et non du changement.
      //
      // Le clic se fait dans la page plutot que par un handle : le
      // handle rendu par evaluateHandle porte un Node et non un
      // Element, ce que le typage de puppeteer refuse a bon droit,
      // puisque rien ne garantit qu un Node soit cliquable.
      const bascule: boolean = await page.evaluate(() => {
        const boutons = Array.from(document.querySelectorAll('button'));
        const b = boutons.find(x => (x.textContent || '').trim().startsWith("Note d'investissement"));
        if (!b) return false;
        b.click();
        return true;
      });
      if (!bascule) throw new Error('bouton de bascule vers la note introuvable');

      // Attendre un element PROPRE a la note. Le repli sur
      // `.dashboard-content` de la premiere version matchait toujours,
      // donc l attente reussissait sur la mauvaise chose : un selecteur
      // de repli qui ne peut pas echouer est une garde inerte.
      await page.waitForSelector('.note-section-title', { timeout: 45_000 });
      await new Promise(r => setTimeout(r, 1800));

      // L empreinte du servi se controle une fois, sur la premiere note
      // atteinte, et avant qu aucune image ne soit ecrite. La faire a
      // chaque note couterait sans rien apprendre : les jetons sont
      // globaux et le serveur ne change pas en cours de passe.
      if (!serviControle) {
        await controlerLeServi(page);
        serviControle = true;
      }

      const hauteur = await page.evaluate(() => document.body.scrollHeight);
      const buf = Buffer.from(await page.screenshot({ fullPage: true, type: 'png' }));
      writeFileSync(join(sortie, `${n.id}.png`), buf);

      const emp = empreinte(buf);
      const versus: VersusReference = reference
        ? classerVersusReference(emp, refs[n.id])
        : 'sans-reference';
      if (reference) {
        etats.push(versus);
        if (versus === 'identique') identiques.push(`${n.company_name} (${n.id})`);
      }
      index[n.id] = { nom: n.company_name, octets: buf.length, hauteur, erreur: null, empreinte: emp, versusReference: versus };
      ok++;
      const marque = reference ? `  [${versus}]` : '';
      console.log(`  OK     ${n.company_name.slice(0, 30).padEnd(32)} ${Math.round(buf.length / 1024)} Ko, ${hauteur} px${marque}`);
    } catch (err: any) {
      index[n.id] = { nom: n.company_name, octets: 0, hauteur: 0, erreur: String(err?.message ?? err).slice(0, 200) };
      ko++;
      console.log(`  ECHEC  ${n.company_name.slice(0, 30).padEnd(32)} ${String(err?.message ?? err).slice(0, 70)}`);
      // Une divergence de jetons condamne toute la passe et non cette
      // note : continuer produirait vingt-quatre images d un etat qui
      // n est pas celui du depot.
      if (String(err?.message ?? err).includes('ne sert pas l etat courant')) {
        await page.close();
        await browser.close();
        writeFileSync(join(sortie, 'index.json'), JSON.stringify(index, null, 1));
        console.error(`\nARRET : ${String(err?.message ?? err)}`);
        process.exit(1);
      }
    }
    await page.close();
  }
  await browser.close();
  writeFileSync(join(sortie, 'index.json'), JSON.stringify(index, null, 1));

  // DENOMINATEUR. Un instrument rend ce qu il a mesure et ce qu il n a
  // pas pu mesurer, sans quoi « zero identique » se lit comme une
  // couverture alors qu il peut ne rien avoir compare.
  console.log(`\n${ok} capturees, ${ko} en echec. Index dans ${sortie}/index.json`);
  if (reference) {
    const v = verdictIdentite(etats);
    console.log(
      `Versus reference : ${v.differentes} differentes, ${v.identiques} identiques, `
      + `${v.sansReference} sans contrepartie dans la reference.`,
    );
    if (!v.conforme) {
      console.error(
        `\nINCIDENT : ${identiques.length} image(s) identique(s) octet pour octet a leur reference.`,
      );
      for (const s of identiques.slice(0, 25)) console.error(`  ${s}`);
      console.error(
        `\nUne passe apres qui reproduit sa reference n a rien mesure. Les jetons de la note\n`
        + `sont globaux et toute note rend un titre de section, donc toute note doit bouger.\n`
        + `Chercher du cote de l instrument avant de conclure au produit.`,
      );
      process.exit(1);
    }
  }
  if (ko > 0) process.exit(1);
})();
