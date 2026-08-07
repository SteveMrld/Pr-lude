// ============================================================
// NOTE-COUPE : vues de lecture prises au milieu de la note
//
// La passe de captures rend des images de quarante-cinq mille pixels
// de haut. Elles servent a comparer deux etats par empreinte ; elles
// ne s ouvrent pas et ne se lisent pas. La question posee au chantier
// de hierarchie n est pourtant pas « qu est-ce qui a change » mais
// « un lecteur qui tombe au milieu de la note sait-il ou il est »,
// et cette question-la se tranche a l oeil, sur une fenetre de la
// taille d un ecran, prise loin de la couverture.
//
// L instrument est donc distinct de la passe de corpus par son objet
// et non par sa mecanique : il ouvre la note par la meme porte, celle
// de `lib/controle/capture-note.ts`, precisement pour ne pas pouvoir
// photographier le tableau de bord le jour ou le libelle du bouton
// change.
//
// GARDE. Une vue de milieu de document n a de sens que si le
// defilement a eu lieu. Une page dont le conteneur scrollable n est
// pas la fenetre rendrait une image parfaitement nette du haut de la
// note, plausible, et sans rapport avec ce qu on a demande : c est
// l incident des vingt-cinq captures repris sous une autre forme,
// l instrument rendant un resultat coherent sur le mauvais objet.
// La position atteinte est donc relue apres coup et comparee a la
// position visee, et l ecart au-dela d une marge est un incident.
//
// Usage :
//   npx tsx scripts/note-coupe.ts <url-base> <dossier-sortie>
//                                 [nombre-de-notes] [--fractions 0.4,0.6]
//                                 [--ids id1,id2]
// ============================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { ouvrirLaNote } from '../lib/controle/capture-note';

// Tolerance de defilement, en pixels. Le navigateur cale la position
// sur des bornes entieres et une note peut se terminer avant la
// position visee, auquel cas il s arrete au bas du document : les deux
// cas sont legitimes et bornes. Au-dela, c est que le defilement n a
// pas porte sur ce qu on croyait.
const TOLERANCE_PX = 4;

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

// Des societes distinctes plutot que les N premieres lignes : le
// corpus porte le meme memorandum rejoue plusieurs fois, et trois vues
// du meme dossier ne repondent pas a la question posee. C est le piege
// de denominateur pris a l endroit ou il coute le moins cher a eviter.
async function notesDistinctes(e: Record<string, string>, combien: number) {
  const url = e.NEXT_PUBLIC_SUPABASE_URL || e.SUPABASE_URL;
  const key = e.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(
    `${url}/rest/v1/analyses?select=id,company_name&pipeline_engines_status=not.is.null`
    + `&order=created_at.desc&limit=60`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!r.ok) throw new Error(`corpus: ${r.status}`);
  const lignes = (await r.json()) as Array<{ id: string; company_name: string }>;
  const vues = new Set<string>();
  const out: Array<{ id: string; company_name: string }> = [];
  for (const l of lignes) {
    if (vues.has(l.company_name)) continue;
    vues.add(l.company_name);
    out.push(l);
    if (out.length === combien) break;
  }
  return out;
}

(async () => {
  const argv = process.argv.slice(2);

  let fractions = [0.4, 0.6];
  const iFr = argv.indexOf('--fractions');
  if (iFr >= 0) {
    const brut = argv[iFr + 1] ?? '';
    fractions = brut.split(',').map(x => parseFloat(x)).filter(x => x > 0 && x < 1);
    if (fractions.length === 0) { console.log('--fractions attend des valeurs entre 0 et 1'); process.exit(2); }
    argv.splice(iFr, 2);
  }

  let ids: string[] | null = null;
  const iIds = argv.indexOf('--ids');
  if (iIds >= 0) {
    ids = (argv[iIds + 1] ?? '').split(',').filter(Boolean);
    if (ids.length === 0) { console.log('--ids attend des identifiants'); process.exit(2); }
    argv.splice(iIds, 2);
  }

  const [base, sortie, combienArg] = argv;
  if (!base || !sortie) {
    console.log('usage: note-coupe.ts <url-base> <dossier-sortie> [nombre] [--fractions a,b] [--ids id1,id2]');
    process.exit(2);
  }

  const e = env();
  const executablePath = e.PUPPETEER_EXECUTABLE_PATH;
  if (!executablePath) throw new Error('PUPPETEER_EXECUTABLE_PATH absente de .env.local');

  mkdirSync(sortie, { recursive: true });
  const puppeteer = await import('puppeteer-core');
  const browser = await puppeteer.default.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });

  const liste = ids
    ? ids.map(id => ({ id, company_name: id.slice(0, 8) }))
    : await notesDistinctes(e, parseInt(combienArg || '3', 10));

  console.log(
    `${liste.length} note(s), ${fractions.length} vue(s) chacune `
    + `aux fractions ${fractions.join(', ')}.\n`,
  );

  const index: Record<string, {
    nom: string; hauteur: number; fraction: number;
    viseePx: number; atteintePx: number; octets: number; erreur: string | null;
  }> = {};
  let ok = 0, ko = 0;

  for (const n of liste) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 2 });
    try {
      const { hauteur } = await ouvrirLaNote(page, base, n.id);
      const fenetre = 1600;

      for (const fr of fractions) {
        // La position visee est bornee par le bas du document : viser
        // 0,6 sur une note courte demanderait un defilement impossible,
        // et l ecart qui en resulterait serait impute a l instrument.
        const maxDefilement = Math.max(0, hauteur - fenetre);
        const visee = Math.min(Math.round(hauteur * fr), maxDefilement);

        const atteinte: number = await page.evaluate((y: number) => {
          window.scrollTo(0, y);
          return Math.round(window.scrollY);
        }, visee);
        await new Promise(r => setTimeout(r, 600));

        const ecart = Math.abs(atteinte - visee);
        if (ecart > TOLERANCE_PX) {
          throw new Error(
            `defilement non atteint : vise ${visee} px, atteint ${atteinte} px sur `
            + `${hauteur} px de document. La fenetre n est pas le conteneur scrollable, `
            + `l image rendue ne serait pas celle qu on demande.`,
          );
        }

        const buf = Buffer.from(await page.screenshot({ fullPage: false, type: 'png' }));
        const nom = `${n.id}-${Math.round(fr * 100)}.png`;
        writeFileSync(join(sortie, nom), buf);
        index[nom] = {
          nom: n.company_name, hauteur, fraction: fr,
          viseePx: visee, atteintePx: atteinte, octets: buf.length, erreur: null,
        };
        ok++;
        console.log(
          `  OK     ${n.company_name.slice(0, 24).padEnd(26)} ${Math.round(fr * 100)}%  `
          + `${atteinte} / ${hauteur} px, ${Math.round(buf.length / 1024)} Ko  ${nom}`,
        );
      }
    } catch (err: any) {
      const msg = String(err?.message ?? err).slice(0, 200);
      index[`${n.id}-echec`] = {
        nom: n.company_name, hauteur: 0, fraction: 0,
        viseePx: 0, atteintePx: 0, octets: 0, erreur: msg,
      };
      ko++;
      console.log(`  ECHEC  ${n.company_name.slice(0, 24).padEnd(26)} ${msg.slice(0, 80)}`);
    }
    await page.close();
  }
  await browser.close();
  writeFileSync(join(sortie, 'index.json'), JSON.stringify(index, null, 1));

  // DENOMINATEUR. Le compte des vues rendues et des vues manquees sort
  // a cote du resultat, sans quoi trois images lisibles se lisent comme
  // une couverture de ce qu on a demande a regarder.
  console.log(`\n${ok} vue(s) rendue(s), ${ko} note(s) en echec. Index dans ${sortie}/index.json`);
  if (ko > 0) process.exit(1);
})();
