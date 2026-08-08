// ============================================================
// NOTE-FAMILLES-IMPRIMEES : les jetons de famille se resolvent-ils dans
// le document qui s imprime, et quelles fontes le PDF porte-t-il
// ------------------------------------------------------------
// Ecrit le 8 aout 2026, apres que `--sans` a ete trouve invalide dans le
// document d export : il descend de `--font-sans`, que next/font pose sur
// une classe de `<html>` que ce document ne porte pas, si bien que le
// jeton entier devenait invalide et que chaque `font-family: var(--sans)`
// de la note etait ignore a l impression. Le repere de section sortait en
// Times la ou l ecran le rend en Inter.
//
// `--serif` porte la meme construction et le meme risque, et il n avait
// jamais ete verifie a l impression. Il ne pouvait pas l etre par une
// lecture de famille : le corps du document d export declare la meme
// chaine de fontes que celle vers laquelle `--serif` se resout, donc un
// jeton invalide et un jeton valide rendent le meme resultat sur tout
// element qui herite. C est la regle des jeux d essai prise sur le
// produit : un repli qui rend la meme valeur que sa source rend la source
// invisible a toute mesure de dependance. La sonde doit donc faire
// diverger la source de son repli, et c est ce que fait son premier
// etage.
//
// DEUX ETAGES, PARCE QU ILS ECHOUENT PAR DES CHEMINS DIFFERENTS.
//
// Le premier porte sur la cause. Il place, dans le document assemble par
// le module de production, un element sous un ancetre qui impose une
// famille hostile, et lui demande la famille par le jeton. Un jeton qui
// se resout donne sa propre chaine ; un jeton invalide laisse l element
// heriter de l hostile. La discrimination se prouve dans les deux sens :
// un temoin qui reclame un jeton inexistant DOIT rendre l hostile, faute
// de quoi la sonde serait verte pour tout le monde.
//
// Le second porte sur l effet, et il lit le PDF plutot que la page qui
// l envoie. Une famille calculee est une valeur declaree ; ce que
// Chromium a reellement dessine se lit dans les fontes que le document
// embarque, descripteur par descripteur. Les deux ne coincident pas
// toujours : une chaine qui nomme « Source Serif 4 » sort en Georgia si
// la fonte n a pas ete chargee, et rien dans le style calcule ne le dit.
//
// CE QU IL NE COUVRE PAS. Il ne dit rien des tailles, des graisses, des
// couleurs ni des marges : ce sont d autres axes, et un axe ajoute apres
// coup en cache d autres. Il ne dit rien non plus de la mise en page. Et
// son second etage mesure les fontes du Chromium qui a produit CE PDF :
// un run en serverless, sans acces a Google Fonts, rendrait un autre
// resultat, et c est une mesure a refaire la-bas plutot qu une conclusion
// a transporter.
//
// Usage :
//   npx tsx scripts/note-familles-imprimees.ts <url-base> <id-note> [sortie.pdf]
// ============================================================

import { existsSync, readFileSync, writeFileSync } from 'fs';

import { ouvrirLaNote } from '../lib/controle/capture-note';
import { assemblerDocumentExport, LIEN_FONTES_EXPORT } from '../lib/note/document-export';

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

/**
 * Les jetons a eprouver se derivent de la feuille et ne s enumerent pas.
 *
 * Le critere est la propriete qui les rend fragiles : un jeton dont la
 * valeur passe par `var(--font-...)` descend d une variable que next/font
 * pose sur `<html>` et que le document d export ne porte pas. Un troisieme
 * jeton de fonte ajoute demain entre dans la mesure sans qu on y pense, et
 * `--mono`, qui ne depend d aucune variable, en reste dehors sans qu on
 * l exclue.
 */
export function jetonsDeFamille(css: string): Array<{ nom: string; source: string }> {
  const out: Array<{ nom: string; source: string }> = [];
  const re = /^\s*(--[a-z0-9-]+)\s*:\s*([^;]*var\(\s*(--font-[a-z0-9-]+)[^;]*);/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) out.push({ nom: m[1], source: m[3] });
  return out;
}

/**
 * Les fontes que le PDF embarque, avec le nombre de sous-ensembles par
 * famille.
 *
 * LA CLEF SE LIT SUR LES DEUX NOMS, ET LA PREMIERE VERSION N EN LISAIT
 * QU UN. Elle cherchait `/BaseFont`, qui est la clef du dictionnaire de
 * fonte, et rendait neuf fontes toutes de repli systeme, donc un verdict
 * de non-conformite sur un document parfaitement sain. Les fontes de la
 * note y sont embarquees en Type 3, forme qui ne porte pas de `/BaseFont`
 * par construction : leur nom ne vit que dans le descripteur, sous
 * `/FontName`, ou le meme document en porte quatre-vingt-huit. La mesure
 * etait irreprochable et sa clef designait une part de son objet, ce
 * qu aucune relecture de sa methode ne pouvait dire.
 *
 * Le prefixe de sous-ensemble, six majuscules et un plus, change a chaque
 * production et ne nomme rien : il se retire, mais le compte des
 * sous-ensembles se garde, parce qu une famille presente une fois et une
 * famille presente quarante fois ne disent pas la meme chose de son
 * usage.
 */
export function fontesDuPdf(pdf: Buffer): Array<{ famille: string; sousEnsembles: number }> {
  const texte = pdf.toString('latin1');
  const re = /\/(?:BaseFont|FontName)\s*\/([A-Za-z0-9+\-_.,]+)/g;
  const comptes = new Map<string, number>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(texte)) !== null) {
    const nom = m[1].replace(/^[A-Z]{6}\+/, '');
    comptes.set(nom, (comptes.get(nom) || 0) + 1);
  }
  return Array.from(comptes.entries())
    .map(([famille, sousEnsembles]) => ({ famille, sousEnsembles }))
    .sort((a, b) => b.sousEnsembles - a.sousEnsembles);
}

const HOSTILE = "'AucuneFonteQuiExiste', monospace";
const TEMOIN = '--jeton-de-controle-qui-n-existe-pas';

async function main() {
  const [base, idNote, sortie] = process.argv.slice(2);
  if (!base || !idNote) {
    console.error('Usage : npx tsx scripts/note-familles-imprimees.ts <url-base> <id-note> [sortie.pdf]');
    process.exit(2);
  }

  const jetons = jetonsDeFamille(readFileSync('app/globals.css', 'utf-8'));
  if (jetons.length === 0) {
    console.error(
      'Aucun jeton de famille derive de la feuille. Ce zero est un incident de l instrument :'
      + ' il mesurerait zero jeton et rendrait vert.',
    );
    process.exit(1);
  }
  console.log(
    `Jetons derives de globals.css : ${jetons.map(j => `${j.nom} (de ${j.source})`).join(', ')}.\n`,
  );

  const e = env();
  const executablePath = e.PUPPETEER_EXECUTABLE_PATH;
  if (!executablePath) throw new Error('PUPPETEER_EXECUTABLE_PATH absente de .env.local');

  const puppeteer = await import('puppeteer-core');
  const browser = await puppeteer.default.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await ouvrirLaNote(page, base, idNote);

  // Le module de production entre par son source, transpile par le
  // compilateur du projet : ni copie ni reecriture. La collecte de la
  // feuille est celle que le bouton d export execute, faute de quoi la
  // sonde enverrait a Chromium un autre document que la production.
  const ts = await import('typescript');
  const transpiler = (chemin: string) => ts.transpileModule(
    readFileSync(chemin, 'utf-8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
  ).outputText;
  const sourceJs = transpiler('lib/note/titre-courant.ts')
    + '\n' + transpiler('lib/note/document-export.ts');

  const { html, css } = await page.evaluate((src: string) => {
    const mod: any = {};
    // eslint-disable-next-line no-new-func
    new Function('exports', src)(mod);
    const mainEl = document.querySelector('.dashboard-content') || document.querySelector('main');
    if (!mainEl) throw new Error('Zone de contenu non trouvee');
    const clone = mainEl.cloneNode(true) as HTMLElement;
    mod.poserLesTetesCourantes(clone, document);
    return { html: clone.outerHTML, css: mod.collecterFeuillesDeStyle(document) };
  }, sourceJs);

  // Ce que l ecran resout, pour memoire. Ce n est pas le verdict : c est
  // la valeur declaree, et elle vit la ou next/font existe.
  const surEcran = await page.evaluate((noms: string[]) => {
    const cs = getComputedStyle(document.documentElement);
    const out: Record<string, string> = {};
    for (const n of noms) out[n] = cs.getPropertyValue(n).trim();
    return out;
  }, jetons.map(j => j.nom)) as Record<string, string>;

  // ---------------------------------------------------------------
  // ETAGE 1 : LA CAUSE, DANS LE DOCUMENT ASSEMBLE PAR LA PRODUCTION.
  // ---------------------------------------------------------------
  const documentImprime = assemblerDocumentExport({ html, css, title: 'Sonde de familles' });
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 1240, height: 1754 });
  await p2.setContent(documentImprime, { waitUntil: 'networkidle0', timeout: 60_000 });
  await p2.emulateMediaType('print');
  await new Promise(r => setTimeout(r, 800));

  // La lecture s ecrit en chaine plutot qu en fonction : le transpileur
  // de tsx nomme les fonctions qu il rencontre et injecte son helper
  // `__name`, qui n existe pas dans la page.
  const releve = await p2.evaluate(`(function (noms, hostile, temoin) {
    var bac = document.createElement('div');
    bac.style.cssText = 'position:absolute; left:-9999px; top:0; font-family:' + hostile + ';';
    document.body.appendChild(bac);
    function span(famille) {
      var s = document.createElement('span');
      s.style.fontFamily = famille;
      s.textContent = 'Agence financiere 0123';
      bac.appendChild(s);
      return s;
    }
    var spans = {};
    for (var i = 0; i < noms.length; i++) spans[noms[i]] = span('var(' + noms[i] + ')');
    var ctrl = span('var(' + temoin + ')');

    var out = {
      hostile: getComputedStyle(bac).fontFamily,
      temoin: getComputedStyle(ctrl).fontFamily,
      jetons: {},
      racine: {},
      corps: getComputedStyle(document.body).fontFamily,
    };
    var csRacine = getComputedStyle(document.documentElement);
    for (var j = 0; j < noms.length; j++) {
      out.racine[noms[j]] = csRacine.getPropertyValue(noms[j]).trim();
      out.jetons[noms[j]] = {
        famille: getComputedStyle(spans[noms[j]]).fontFamily,
        largeur: spans[noms[j]].getBoundingClientRect().width,
      };
    }
    // La fonte reellement chargee, distincte de la famille declaree.
    var chargees = {};
    document.fonts.forEach(function (f) {
      if (f.status === 'loaded') chargees[f.family] = (chargees[f.family] || 0) + 1;
    });
    out.fontesChargees = chargees;
    bac.remove();

    // LE RECENSEMENT DES CHAINES REELLEMENT CALCULEES. Il ne dit pas si
    // un jeton se resout, il dit sur quelles familles les elements du
    // document tombent, ce qui est la seule facon de rattacher une fonte
    // de repli trouvee dans le PDF a ce qui l a demandee.
    var recens = {};
    var tous = document.body.querySelectorAll('*');
    for (var k = 0; k < tous.length; k++) {
      var el = tous[k];
      if (!(el.textContent || '').trim()) continue;
      var fam = getComputedStyle(el).fontFamily;
      if (!recens[fam]) recens[fam] = { n: 0, exemple: (el.getAttribute('class') || el.tagName) };
      recens[fam].n += 1;
    }
    out.recensement = recens;
    return out;
  })(${JSON.stringify(jetons.map(j => j.nom))}, ${JSON.stringify(HOSTILE)}, ${JSON.stringify(TEMOIN)})`) as any;

  console.log('ETAGE 1, la cause : les jetons se resolvent-ils dans le document d export.\n');
  console.log(`  Famille hostile posee sur l ancetre : ${releve.hostile}`);
  console.log(`  Temoin (jeton inexistant)           : ${releve.temoin}`);
  const temoinDiscrimine = releve.temoin === releve.hostile;
  if (!temoinDiscrimine) {
    console.error(
      '\n  Le temoin ne rend pas la famille hostile : la sonde ne discrimine pas, et tout verdict'
      + ' qu elle rendrait sur les jetons serait vert pour la mauvaise raison.',
    );
    await browser.close();
    process.exit(1);
  }
  console.log('  Le temoin herite bien de l hostile : la sonde discrimine.\n');

  let invalides = 0;
  for (const j of jetons) {
    const r = releve.jetons[j.nom];
    const herite = r.famille === releve.hostile;
    if (herite) invalides += 1;
    console.log(
      `  ${j.nom.padEnd(9)} ecran ${(surEcran[j.nom] || '(vide)').slice(0, 46).padEnd(48)}`,
    );
    console.log(
      `  ${''.padEnd(9)} export ${(releve.racine[j.nom] || '(vide)').slice(0, 46).padEnd(47)}`
      + `  -> ${herite ? 'INVALIDE, herite de l hostile' : 'resolu'}`,
    );
  }
  console.log(`\n  Corps du document d export : ${releve.corps}`);
  console.log(
    '  Fontes chargees dans la page : '
    + (Object.entries(releve.fontesChargees as Record<string, number>)
      .map(([f, n]) => `${f} (${n})`).join(', ') || '(aucune)'),
  );

  console.log('\n  Recensement des chaines calculees, sur les elements qui portent du texte :\n');
  const recens = Object.entries(releve.recensement as Record<string, { n: number; exemple: string }>)
    .sort((a, b) => b[1].n - a[1].n);
  for (const [fam, r] of recens) {
    console.log(`    ${String(r.n).padStart(5)}  ${fam.slice(0, 66).padEnd(68)} ex. ${r.exemple.slice(0, 30)}`);
  }

  // ---------------------------------------------------------------
  // ETAGE 2 : L EFFET, DANS LE PDF QUE LA ROUTE PRODUIT.
  // ---------------------------------------------------------------
  const res = await fetch(`${base}/api/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, css, title: 'Sonde de familles', fileName: 'familles.pdf' }),
  });
  if (!res.ok) {
    console.error(`\nLa route d export a rendu ${res.status} : ${await res.text()}`);
    await browser.close();
    process.exit(1);
  }
  const pdf = Buffer.from(await res.arrayBuffer());
  if (sortie) writeFileSync(sortie, pdf);
  await browser.close();

  const fontes = fontesDuPdf(pdf);
  console.log('\nETAGE 2, l effet : les fontes que le PDF embarque.\n');
  if (fontes.length === 0) {
    console.error(
      '  Aucune fonte lue dans le PDF. Ce zero est un incident de l instrument et non un'
      + ' resultat : un document de texte porte necessairement des fontes.',
    );
    process.exit(1);
  }
  for (const f of fontes) {
    console.log(`  ${String(f.sousEnsembles).padStart(4)} sous-ensemble(s)  ${f.famille}`);
  }

  // LES FAMILLES ATTENDUES SE DERIVENT DU LIEN QUE LA ROUTE CHARGE, et ne
  // s enumerent pas ici : une fonte ajoutee demain a l export entre dans
  // la mesure sans qu on y pense.
  const attendues = Array.from(LIEN_FONTES_EXPORT.matchAll(/family=([A-Za-z0-9+]+)[:&]/g))
    .map(m => m[1].replace(/\+/g, ''))
    .filter((v, i, a) => a.indexOf(v) === i);
  const aplati = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const manquantes = attendues.filter(
    a => !fontes.some(f => aplati(f.famille).startsWith(aplati(a))),
  );
  console.log(
    `\n  Familles attendues, derivees du lien de fontes : ${attendues.join(', ')}.`
    + ` Absentes du PDF : ${manquantes.length ? manquantes.join(', ') : 'aucune'}.`,
  );

  // Les fontes du systeme s impriment comme un fait distinct et ne font
  // pas echouer : le recensement ci-dessus dit quelles chaines les
  // demandent, et une chaine ecrite en dur plutot que par le jeton n est
  // pas le meme defaut qu un jeton qui ne se resout pas.
  const REPLIS_SYSTEME = /^(Times|Liberation|DejaVu|FreeSerif|Nimbus|Noto)/i;
  const replis = fontes.filter(f => REPLIS_SYSTEME.test(f.famille));
  if (replis.length) {
    console.log(
      `\n  Fontes du systeme presentes : ${replis.map(f => `${f.famille} (${f.sousEnsembles})`).join(', ')}.`
      + ' Elles ne font pas echouer : ce sont les chaines du recensement qui ne passent pas par'
      + ' un jeton, et le monospace, qui n en a jamais eu.',
    );
  }

  const conforme = invalides === 0 && manquantes.length === 0;
  console.log(conforme ? '\nCONFORME' : '\nNON CONFORME');
  process.exit(conforme ? 0 : 1);
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}
