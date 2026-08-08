import { existsSync, readFileSync } from 'fs';
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
const LIRE = `(function () {
  var el = document.querySelector('.note-cover-verdict');
  if (!el) return { absent: true };
  var cs = getComputedStyle(el);
  return { style: cs.borderTopStyle, largeur: cs.borderTopWidth, couleur: cs.borderTopColor,
           gauche: cs.borderLeftWidth + ' ' + cs.borderLeftStyle + ' ' + cs.borderLeftColor,
           hairlineLocal: cs.getPropertyValue('--hairline').trim(),
           hairlineRacine: getComputedStyle(document.documentElement).getPropertyValue('--hairline').trim(),
           classes: el.getAttribute('class') };
})()`;
async function main() {
  const [base, id] = process.argv.slice(2);
  const e = env();
  const puppeteer = await import('puppeteer-core');
  const nav = await puppeteer.default.launch({ executablePath: e.PUPPETEER_EXECUTABLE_PATH,
    headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await nav.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await ouvrirLaNote(page, base, id);
  console.log('ECRAN  ', JSON.stringify(await page.evaluate(LIRE)));
  const ts = await import('typescript');
  const src = ts.transpileModule(readFileSync('lib/note/titre-courant.ts','utf-8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const paquet = await page.evaluate(`(function (s) {
    var mod = {}; new Function('exports', s)(mod);
    var m = document.querySelector('.dashboard-content') || document.querySelector('main');
    var c = m.cloneNode(true); mod.poserLesTetesCourantes(c, document);
    var r = [];
    for (var i = 0; i < document.styleSheets.length; i++) {
      try { var rs = document.styleSheets[i].cssRules;
        for (var j = 0; j < rs.length; j++) r.push(rs[j].cssText); } catch (e) {}
    }
    return { html: c.outerHTML, css: r.join('\\n') };
  })(${JSON.stringify(src)})`) as any;
  const p2 = await nav.newPage();
  await p2.setViewport({ width: 1240, height: 1754 });
  await p2.setContent(assemblerDocumentExport({ html: paquet.html, css: paquet.css, title: 't' }),
    { waitUntil: 'domcontentloaded' });
  await p2.emulateMediaType('print');
  await new Promise(r => setTimeout(r, 700));
  console.log('IMPRIME', JSON.stringify(await p2.evaluate(LIRE)));
  await nav.close();
}
main().catch(e => { console.error(e); process.exit(1); });
