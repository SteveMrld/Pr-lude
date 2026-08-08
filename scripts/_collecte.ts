import { existsSync, readFileSync } from 'fs';
import { ouvrirLaNote } from '../lib/controle/capture-note';
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
  const [base, id] = process.argv.slice(2);
  const e = env();
  const puppeteer = await import('puppeteer-core');
  const nav = await puppeteer.default.launch({ executablePath: e.PUPPETEER_EXECUTABLE_PATH,
    headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await nav.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await ouvrirLaNote(page, base, id);
  const r = await page.evaluate(`(function () {
    var parRegle = [], parNoeud = [], feuilles = [];
    for (var i = 0; i < document.styleSheets.length; i++) {
      var s = document.styleSheets[i], rs = null;
      try { rs = s.cssRules; } catch (e) { feuilles.push({ i: i, distante: true }); continue; }
      if (!rs) continue;
      var t = '';
      for (var j = 0; j < rs.length; j++) t += rs[j].cssText + '\\n';
      parRegle.push(t);
      var noeud = s.ownerNode && s.ownerNode.textContent ? s.ownerNode.textContent : '';
      parNoeud.push(noeud || t);
      feuilles.push({ i: i, regles: rs.length, octetsRegles: t.length, octetsNoeud: noeud.length });
    }
    function extrait(txt) {
      var k = txt.indexOf('.note-cover-verdict');
      while (k >= 0 && txt.slice(k, k + 21) !== '.note-cover-verdict {' && txt.slice(k, k + 20) !== '.note-cover-verdict.') {
        k = txt.indexOf('.note-cover-verdict', k + 1);
      }
      return k < 0 ? '(absent)' : txt.slice(k, k + 200).replace(/\\s+/g, ' ');
    }
    var A = parRegle.join('\\n'), B = parNoeud.join('\\n');
    return { feuilles: feuilles, octetsRegles: A.length, octetsNoeud: B.length,
             regleA: extrait(A), regleB: extrait(B) };
  })()`) as any;
  console.log(JSON.stringify(r.feuilles, null, 1));
  console.log('\ncollecte par cssText  :', r.octetsRegles, 'octets');
  console.log('collecte par noeud    :', r.octetsNoeud, 'octets');
  console.log('\ncssText  ->', r.regleA);
  console.log('\nnoeud    ->', r.regleB);
  await nav.close();
}
main().catch(e => { console.error(e); process.exit(1); });
