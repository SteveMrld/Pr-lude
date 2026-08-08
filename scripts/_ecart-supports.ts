// Sonde : sur quels axes le PDF peut-il diverger de l ecran sans que
// rien ne le signale.
//
// La sonde de pagination porte depuis aujourd hui un axe de famille, pose
// apres coup parce qu un defaut l avait rendu visible. Un axe ajoute
// apres coup en cache d autres : la question n est pas de savoir si la
// famille tient, elle est de savoir combien d axes n ont jamais ete
// regardes.
//
// L APPARIEMENT SE FAIT ELEMENT PAR ELEMENT, ET C EST TOUT LE SUJET. Une
// premiere version comparait, pour chaque classe, le premier element qui
// la porte dans chaque document. Les deux DOM ne sont pas les memes : la
// page vivante porte l entete, la nav et le sommaire, le document
// d export ne porte que le clone, et le clone y recoit des enveloppes en
// tableau. « Le premier element de classe X » ne designe donc pas la meme
// chose des deux cotes, et la sonde rendait des ecarts qui n etaient que
// des appariements faux. Chaque element du sous-arbre source recoit donc
// un numero avant le clonage, le clone l emporte, et la comparaison porte
// sur ce numero.
//
// LE PERIMETRE SE DERIVE ET NE S ENUMERE PAS : tous les elements du
// sous-arbre exporte, quels qu ils soient.

import { existsSync, readFileSync, writeFileSync } from 'fs';

import { ouvrirLaNote } from '../lib/controle/capture-note';
import { assemblerDocumentExport } from '../lib/note/document-export';

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

// LES AXES SE DERIVENT DU MOTEUR ET NE S ENUMERENT PAS. La premiere
// version en portait vingt-quatre, ecrits a la main : ceux qu on avait en
// tete le jour ou l on cherchait une famille de fonte. Une telle liste a
// la propriete de toutes les listes ecrites une fois, elle ne vieillit
// pas, elle n a simplement jamais couvert ce qu on n avait pas en tete, et
// un axe ajoute apres coup en cache d autres. La liste juste est celle que
// `getComputedStyle` expose, et elle se demande a la page.
const NOMS_DES_AXES = `(function () {
  var cs = getComputedStyle(document.body);
  var out = [];
  for (var i = 0; i < cs.length; i++) out.push(cs.item(i));
  return out;
})()`;

// La lecture se fait par tranches d axes plutot qu en un bloc : la
// totalite des proprietes calculees sur seize cents elements ne passe pas
// en une seule serialisation, et une lecture qui echoue rendrait un
// denominateur muet.
const LECTURE = (axes: string[]) => `(function () {
  var axes = ${JSON.stringify(axes)};
  var out = {};
  var tous = document.querySelectorAll('[data-sonde-idx]');
  for (var i = 0; i < tous.length; i++) {
    var el = tous[i];
    var cs = getComputedStyle(el);
    var o = [];
    for (var k = 0; k < axes.length; k++) o.push(cs.getPropertyValue(axes[k]));
    out[el.getAttribute('data-sonde-idx')] = o;
  }
  return out;
})()`;

const IDENTITE = `(function () {
  var out = {};
  var tous = document.querySelectorAll('[data-sonde-idx]');
  for (var i = 0; i < tous.length; i++) {
    var el = tous[i];
    out[el.getAttribute('data-sonde-idx')] = {
      tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute('class') || '').split(/\\s+/)
             .filter(function (c) { return c && c.indexOf('jsx-') !== 0 && c.indexOf('x-') !== 0; })
             .join(' ').slice(0, 60),
      txt: (el.textContent || '').trim().slice(0, 40),
    };
  }
  return out;
})()`;

async function main() {
  const [base, id, sortie] = process.argv.slice(2);
  const e = env();
  const puppeteer = await import('puppeteer-core');
  const nav = await puppeteer.default.launch({
    executablePath: e.PUPPETEER_EXECUTABLE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await nav.newPage();
  // La bascule vers la note s ouvre a la largeur de lecture, puis la
  // fenetre revient a celle que la route donne a Chromium : la largeur ne
  // doit pas compter comme un ecart entre supports.
  await page.setViewport({ width: 1440, height: 900 });
  await ouvrirLaNote(page, base, id);
  await page.setViewport({ width: 1240, height: 1754 });
  await new Promise(r => setTimeout(r, 800));

  // La collecte de la feuille est celle de la production, transpilee, et
  // non une troisieme ecriture : la version recopiee serialisait les
  // regles et amputait les raccourcis a `var()`, donc la sonde comparait
  // l ecran a un document que la production n envoie pas.
  const ts = await import('typescript');
  const t = (c: string) => ts.transpileModule(
    readFileSync(c, 'utf-8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
  ).outputText;
  const sourceJs = t('lib/note/titre-courant.ts') + '\n' + t('lib/note/document-export.ts');

  const paquet = await page.evaluate(`(function (src) {
    var mod = {};
    new Function('exports', src)(mod);
    var mainEl = document.querySelector('.dashboard-content') || document.querySelector('main');
    var tous = mainEl.querySelectorAll('*');
    mainEl.setAttribute('data-sonde-idx', '0');
    for (var i = 0; i < tous.length; i++) tous[i].setAttribute('data-sonde-idx', String(i + 1));
    var clone = mainEl.cloneNode(true);
    mod.poserLesTetesCourantes(clone, document);
    return { html: clone.outerHTML, css: mod.collecterFeuillesDeStyle(document), nombre: tous.length + 1 };
  })(${JSON.stringify(sourceJs)})`) as { html: string; css: string; nombre: number };

  const AXES = await page.evaluate(NOMS_DES_AXES) as string[];
  const identite = await page.evaluate(IDENTITE) as Record<string, Record<string, string>>;

  const p2 = await nav.newPage();
  await p2.setViewport({ width: 1240, height: 1754 });
  await p2.setContent(
    assemblerDocumentExport({ html: paquet.html, css: paquet.css, title: 'Ecart supports' }),
    { waitUntil: 'domcontentloaded', timeout: 60_000 },
  );
  await p2.emulateMediaType('print');
  await new Promise(r => setTimeout(r, 900));

  const parAxe = new Map<string, Array<Record<string, string>>>();
  let apparies = 0;
  const TAILLE = 24;
  for (let d = 0; d < AXES.length; d += TAILLE) {
    const tranche = AXES.slice(d, d + TAILLE);
    const ecran = await page.evaluate(LECTURE(tranche)) as Record<string, string[]>;
    const imprime = await p2.evaluate(LECTURE(tranche)) as Record<string, string[]>;
    const clefs = Object.keys(ecran).filter(k => imprime[k]);
    apparies = clefs.length;
    for (const k of clefs) {
      for (let i = 0; i < tranche.length; i++) {
        if (ecran[k][i] === imprime[k][i]) continue;
        const a = tranche[i];
        if (!parAxe.has(a)) parAxe.set(a, []);
        parAxe.get(a)!.push({
          idx: k, tag: identite[k]?.tag, cls: identite[k]?.cls, txt: identite[k]?.txt,
          ecran: ecran[k][i], imprime: imprime[k][i],
        });
      }
    }
  }
  await nav.close();

  console.log(
    `Elements numerotes : ${paquet.nombre}, apparies entre les deux supports : ${apparies}.`,
  );
  console.log(`Axes lus, derives du moteur : ${AXES.length}. Axes qui divergent : ${parAxe.size}.\n`);
  for (const [a, xs] of Array.from(parAxe.entries()).sort((x, y) => y[1].length - x[1].length)) {
    console.log(`  ${a.padEnd(20)} ${String(xs.length).padStart(4)} elements`);
  }
  if (sortie) writeFileSync(sortie, JSON.stringify({ parAxe: Object.fromEntries(parAxe) }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
