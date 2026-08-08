// Quelles regles le navigateur applique reellement a un element, dans le
// document d export et en media impression. La question ne se lit pas
// dans la feuille : elle se demande au moteur.
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
async function main() {
  const [base, id, selecteur, propriete] = process.argv.slice(2);
  const e = env();
  const puppeteer = await import('puppeteer-core');
  const nav = await puppeteer.default.launch({ executablePath: e.PUPPETEER_EXECUTABLE_PATH,
    headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await nav.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await ouvrirLaNote(page, base, id);
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

  const cdp = await p2.createCDPSession();
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const doc: any = await cdp.send('DOM.getDocument', { depth: -1 });
  const n: any = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: selecteur });
  if (!n.nodeId) { console.error('element introuvable'); process.exit(1); }
  const st: any = await cdp.send('CSS.getMatchedStylesForNode', { nodeId: n.nodeId });
  for (const m of st.matchedCSSRules || []) {
    const props = (m.rule.style.cssProperties || []).filter((p: any) =>
      p.name.includes(propriete));
    if (!props.length) continue;
    const sel = m.rule.selectorList.text;
    const media = (m.rule.media || []).map((x: any) => x.text).join(' & ');
    console.log(`${media ? '@media ' + media + '  ' : ''}${sel.slice(0, 90)}`);
    for (const p of props) console.log(`      ${p.name}: ${p.value}${p.important ? ' !important' : ''}`);
  }
  await nav.close();
}
main().catch(e => { console.error(e); process.exit(1); });
