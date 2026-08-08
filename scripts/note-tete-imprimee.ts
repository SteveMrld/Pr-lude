// ============================================================
// NOTE-TETE-IMPRIMEE : le titre courant survit-il a la pagination
// ------------------------------------------------------------
// Ecrit le 7 aout 2026. La note porte six titres de section pour
// quarante-huit mille pixels ; le repere qui repond a cela est un
// bandeau collant a l ecran, et une enveloppe en tableau a
// l impression. Les deux mecanismes different parce qu une sonde a
// mesure qu un element `position: sticky` ne se dessine que sur la
// premiere page d un PDF Chromium, et qu un `<thead>` se redessine
// sur toutes.
//
// CE QUE CET INSTRUMENT MESURE. Il produit un PDF par le chemin reel,
// celui du bouton d export : meme transformation du clone, meme feuille
// de style collectee, meme route serveur. Puis il compte, page par page,
// quel en-tete de section s y trouve. Le verdict porte sur la couverture
// et sur la repetition : combien de pages portent un repere, et combien
// d en-tetes se sont redessines sur plus d une page.
//
// COMMENT IL LIT LE PDF, ET POURQUOI PAS LE TEXTE. Chaque en-tete recoit
// un aplat de couleur unique, pose par une regle injectee dans la feuille
// envoyee au serveur, et l instrument cherche l operateur de remplissage
// correspondant dans le flux de chaque page. Une couleur se lit sans
// police, sans encodage et sans sous-ensemble de glyphes ; une extraction
// de texte, elle, aurait echoue exactement la ou Chromium sous-ensemble
// ses polices, c est-a-dire partout. La couleur est un marqueur de
// mesure et non une propriete du produit : elle vit dans cette feuille
// injectee, jamais dans le depot.
//
// CE QU IL NE COUVRE PAS. Il ne dit rien de la lisibilite du PDF ni de
// la mise en page, seulement de la presence du repere. Et il mesure une
// note, celle qu on lui nomme : le nombre de pages sans repere se lit
// avec son denominateur ou il ne se lit pas.
//
// Usage :
//   npx tsx scripts/note-tete-imprimee.ts <url-base> <id-note> <sortie.pdf>
// ============================================================

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { inflateSync } from 'zlib';

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

const MARQUEUR_FIN = Buffer.from('endstream');

/**
 * Les flux du fichier, decompresses, indexes par numero d objet.
 *
 * LE MOT `stream` EST CONTENU DANS `endstream`, et c est le premier des
 * deux defauts que cette lecture a portes. La version d origine reprenait
 * sa recherche a l index du marqueur de fin, si bien que la passe
 * suivante retrouvait `stream` a l interieur de ce meme `endstream` et
 * ouvrait une tranche qui chevauchait deux objets : l en-tete du suivant,
 * son dictionnaire et son flux dans un seul bloc, que rien ne
 * decompresse. Sur un document de trente et une pages portant deux mille
 * sept cent quarante-huit flux deflates, elle en rendait un. Elle ne se
 * trompait pas de methode, elle n avancait pas assez loin, et le verdict
 * qui en descendait accusait le produit pour un defaut qui vivait dans
 * l instrument.
 *
 * Les flux qui ne se decompressent pas sont ecartes en silence : ce sont
 * les polices et les images, qui ne portent aucun operateur de dessin.
 */
function fluxParObjet(pdf: Buffer): Map<number, Buffer> {
  const parObjet = new Map<number, Buffer>();
  const marqueur = Buffer.from('stream');
  let i = 0;
  while (true) {
    const d = pdf.indexOf(marqueur, i);
    if (d < 0) break;
    // Un `stream` qui ferme le mot `endstream` n ouvre rien : on le
    // saute plutot que d ouvrir une tranche a partir de lui.
    if (d >= 3 && pdf.subarray(d - 3, d).toString('latin1') === 'end') {
      i = d + marqueur.length;
      continue;
    }
    let debut = d + marqueur.length;
    if (pdf[debut] === 0x0d) debut += 1;
    if (pdf[debut] === 0x0a) debut += 1;
    const fin = pdf.indexOf(MARQUEUR_FIN, debut);
    if (fin < 0) break;
    i = fin + MARQUEUR_FIN.length;

    // Le numero d objet se lit en remontant du `stream` vers le `N 0 obj`
    // qui l ouvre. Sans lui le flux n est rattachable a aucune page, et
    // c est ce rattachement qui separe un compte de flux d un compte de
    // pages.
    //
    // C EST LA DERNIERE ENTETE DE LA FENETRE ET NON LA PREMIERE. Une
    // recherche simple rend le match le plus a gauche, donc l objet
    // precedent quand deux entetes tiennent dans la fenetre, et le flux
    // part alors sous un numero qui appartient a un autre. Le defaut ne
    // casse rien : il range huit flux au mauvais endroit, huit pages
    // ressortent sans contenu lisible, et la couverture baisse sans que
    // rien n en donne la raison.
    const avant = pdf.subarray(Math.max(0, d - 400), d).toString('latin1');
    const entetes = avant.match(/(\d+)\s+\d+\s+obj/g);
    if (!entetes || entetes.length === 0) continue;
    const num = parseInt(/^(\d+)/.exec(entetes[entetes.length - 1])![1], 10);
    try {
      parObjet.set(num, inflateSync(pdf.subarray(debut, fin)));
    } catch {
      // Flux non deflate : police, image, ou objet sans interet ici.
    }
  }
  return parObjet;
}

/**
 * Les flux de contenu, une entree par page, dans l ordre du document.
 *
 * LE SECOND DEFAUT ETAIT UNE UNITE, et il ne s est vu qu une fois le
 * premier repare. Tant que la lecture rendait un flux, compter les flux
 * porteurs d un repere et les rapporter au nombre de pages passait
 * inapercu ; avec deux mille sept cent quarante-huit flux, la meme ligne
 * annoncait « 26/31 pages » en ayant compte des polices et des images, et
 * imprimait des numeros de page allant jusqu a 94 sur un document qui en
 * declare 31. La methode etait juste et l objet comptait autre chose que
 * ce que son denominateur nommait.
 *
 * Une page est donc lue par son `/Contents`, qui designe un objet ou un
 * tableau d objets, et c est cette resolution qui fait du resultat un
 * compte de pages. Les pages sans flux lisible sont conservees comme
 * entrees vides plutot que retirees : les retirer reduirait le
 * denominateur, c est-a-dire ferait monter la couverture en cessant de
 * regarder.
 */
function fluxDePage(pdf: Buffer): Buffer[] {
  const parObjet = fluxParObjet(pdf);
  const texte = pdf.toString('latin1');
  const pages: Buffer[] = [];

  const reObjet = /(\d+)\s+\d+\s+obj([^]*?)(?:endobj|stream)/g;
  let m: RegExpExecArray | null;
  while ((m = reObjet.exec(texte)) !== null) {
    const corps = m[2];
    if (!/\/Type\s*\/Page(?![s])/.test(corps)) continue;
    const refs = /\/Contents\s*\[([^\]]*)\]/.exec(corps);
    const nums: number[] = [];
    if (refs) {
      const re = /(\d+)\s+\d+\s+R/g;
      let r: RegExpExecArray | null;
      while ((r = re.exec(refs[1])) !== null) nums.push(parseInt(r[1], 10));
    } else {
      const simple = /\/Contents\s+(\d+)\s+\d+\s+R/.exec(corps);
      if (simple) nums.push(parseInt(simple[1], 10));
    }
    const morceaux = nums.map(n => parObjet.get(n)).filter(Boolean) as Buffer[];
    pages.push(morceaux.length ? Buffer.concat(morceaux) : Buffer.alloc(0));
  }
  return pages;
}

/** Dit si un flux de page porte un remplissage de la couleur donnee. */
function porteLaCouleur(flux: Buffer, rgb: [number, number, number]): boolean {
  const attendu = rgb.map(c => Math.round((c / 255) * 100) / 100);
  const re = /([\d.]+) ([\d.]+) ([\d.]+) rg/g;
  const texte = flux.toString('latin1');
  let m: RegExpExecArray | null;
  while ((m = re.exec(texte)) !== null) {
    const v = [1, 2, 3].map(k => Math.round(parseFloat(m![k]) * 100) / 100);
    if (v[0] === attendu[0] && v[1] === attendu[1] && v[2] === attendu[2]) return true;
  }
  return false;
}

/**
 * Une couleur unique par rang de section, assez espacee pour survivre a
 * l arrondi que Chromium fait des composantes.
 */
function couleurDuRang(rang: number): [number, number, number] {
  return [255, (rang * 17) % 256, (rang * 53) % 256];
}

async function main() {
  const [base, idNote, sortie] = process.argv.slice(2);
  if (!base || !idNote || !sortie) {
    console.error('Usage : npx tsx scripts/note-tete-imprimee.ts <url-base> <id-note> <sortie.pdf>');
    process.exit(2);
  }

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
  await page.setViewport({ width: 1280, height: 1600 });
  await ouvrirLaNote(page, base, idNote);

  // LE MODULE DE PRODUCTION ENTRE DANS LA PAGE PAR SON SOURCE, transpile
  // par le compilateur du projet. Ni copie ni reecriture : une fixture
  // ecrite dans le meme systeme de croyance que le code qu elle teste
  // mesure leur accord et non la justesse. Le detour par `transpileModule`
  // plutot que par un retrait des annotations a l expression reguliere
  // n est pas une coquetterie : une expression enumere les ecritures que
  // son auteur avait sous les yeux, et le langage en permet d autres.
  const ts = await import('typescript');
  const sourceJs = ts.transpileModule(
    readFileSync('lib/note/titre-courant.ts', 'utf-8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
  ).outputText;

  const { html, css, sections } = await page.evaluate((src: string) => {
    const mod: any = {};
    // eslint-disable-next-line no-new-func
    new Function('exports', src)(mod);
    const mainEl = document.querySelector('.dashboard-content') || document.querySelector('main');
    if (!mainEl) throw new Error('Zone de contenu non trouvee');
    const clone = mainEl.cloneNode(true) as HTMLElement;
    mod.poserLesTetesCourantes(clone, document);

    const tetes = Array.from(clone.querySelectorAll('.' + mod.CLASSE_TETE_IMPRIMEE));
    const noms: string[] = [];
    tetes.forEach((t, i) => {
      t.setAttribute('data-rang', String(i));
      noms.push((t.textContent || '').trim());
    });

    const regles: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = (sheet as CSSStyleSheet).cssRules;
        if (!rules) continue;
        for (let i = 0; i < rules.length; i++) regles.push(rules[i].cssText);
      } catch {
        // CORS sur certaines feuilles externes : on ignore, comme le fait
        // le bouton d export.
      }
    }
    return { html: clone.outerHTML, css: regles.join('\n'), sections: noms };
  }, sourceJs);

  await browser.close();

  if (sections.length === 0) {
    console.error('Aucun en-tete pose sur le clone. Rien a mesurer, et ce zero est un incident.');
    process.exit(1);
  }

  // Le marqueur de mesure. Il ne vit que dans cette feuille injectee.
  const marqueurs = sections
    .map((_, i) => {
      const [r, g, b] = couleurDuRang(i);
      return `.note-tete-imprimee-titre[data-rang="${i}"] { background: rgb(${r}, ${g}, ${b}) !important; }`;
    })
    .join('\n');

  const res = await fetch(`${base}/api/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html,
      css: `${css}\n${marqueurs}`,
      title: 'Sonde de titre courant',
      fileName: 'sonde.pdf',
    }),
  });
  if (!res.ok) {
    console.error(`La route d export a rendu ${res.status} : ${await res.text()}`);
    process.exit(1);
  }
  const pdf = Buffer.from(await res.arrayBuffer());
  writeFileSync(sortie, pdf);

  const flux = fluxDePage(pdf);
  const pagesDeclarees = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  const pagesLues = flux.filter(f => f.length > 0).length;

  // L INSTRUMENT ANNONCE SON DENOMINATEUR AVANT SON RESULTAT. Une page
  // dont le flux ne se lit pas ne porte aucun repere aux yeux de la
  // mesure, et rien ne la distinguerait d une page que le mecanisme a
  // reellement manquee. Les deux appellent des reponses opposees, donc
  // l ecart se dit ici plutot que de se fondre dans la couverture.
  if (flux.length !== pagesDeclarees || pagesLues !== flux.length) {
    console.warn(
      `\nAVERTISSEMENT : ${pagesDeclarees} pages declarees, ${flux.length} resolues par leur`
      + ` /Contents, ${pagesLues} dont le flux se lit. La couverture ci-dessous ne borne`
      + ` que ces dernieres.`,
    );
  }

  const pagesParTete: number[][] = sections.map((_, i) =>
    flux
      .map((f, p) => (f.length > 0 && porteLaCouleur(f, couleurDuRang(i)) ? p + 1 : 0))
      .filter(p => p > 0),
  );
  const pagesCouvertes = new Set<number>();
  pagesParTete.forEach(ps => ps.forEach(p => pagesCouvertes.add(p)));
  const repetes = pagesParTete.filter(ps => ps.length > 1).length;

  console.log(`\nPDF : ${pdf.length} octets, ${pagesDeclarees} pages, ${pagesLues} lues.`);
  console.log(`Sections enveloppees : ${sections.length}.\n`);
  for (let i = 0; i < sections.length; i++) {
    const ps = pagesParTete[i];
    console.log(
      `  ${String(ps.length).padStart(2)} page(s)  ${(sections[i] || '(sans nom)').padEnd(34)}`
      + `  ${ps.length ? `p. ${ps[0]}-${ps[ps.length - 1]}` : 'ABSENT'}`,
    );
  }

  // LE VERDICT PORTE SON DENOMINATEUR. Une couverture annoncee sans le
  // nombre de pages du document se lit comme une couverture totale.
  const sansRepere = pagesDeclarees - pagesCouvertes.size;
  console.log(
    `\nCouverture : ${pagesCouvertes.size}/${pagesDeclarees} pages portent un repere`
    + `, ${sansRepere} sans.`,
  );
  console.log(`Repetition : ${repetes}/${sections.length} en-tetes redessines sur plus d une page.`);

  // Deux conditions, et elles ne disent pas la meme chose. La premiere
  // etablit que le mecanisme repete, ce qu un bandeau collant ne fait
  // pas. La seconde etablit qu il repete la ou il faut : un en-tete
  // present partout mais toujours le meme serait un `position: fixed`,
  // qui repete sans nommer.
  const conforme = repetes > 0 && pagesCouvertes.size > sections.length;
  console.log(conforme ? '\nCONFORME' : '\nNON CONFORME');
  process.exit(conforme ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
