// ============================================================
// VERROU DU BUDGET DU CHEMIN PDF
// ------------------------------------------------------------
// `APPELS_PORTEURS_DE_PDF` declare, pour chaque site qui envoie un PDF au
// modele, quel modele il vise et combien de tokens il reserve en sortie.
// Ces valeurs sont passees en litteral positionnel sur les sites, donc la
// liste est une copie, et une copie diverge le jour ou la source bouge.
//
// Ce fichier est la troisieme forme de portage de la discipline des regles
// ecrites : le test qui compare le declare au reel et echoue le jour ou les
// deux divergent. Il relit les sites d appel dans les sources et verifie
// trois choses.
//
//   1. Aucun site n est absent de la liste, et la liste ne nomme aucun site
//      qui n existe plus. Un site ajoute demain sans etre declare ferait
//      calculer un plafond sur un perimetre incomplet, ce qui laisserait
//      passer un document que ce site refusera.
//   2. La reserve de sortie declaree est au moins celle que le site demande
//      reellement. Declarer moins rendrait un plafond trop genereux, donc
//      un document admis a tort.
//   3. Le modele declare est celui que le site passe. C est ce qui decide
//      du plafond de pages, cent ou six cents, et la difference a ete
//      constatee en production.
//
// Ce que ce fichier NE verifie pas, et qui doit se lire ici plutot que se
// deduire d un silence : l enveloppe de prompt. Elle est mesuree par
// count_tokens, donc par un appel reseau, donc hors de la suite
// deterministe. Elle majore le fichier source entier, ce qui la rend
// robuste a une reecriture des prompts mais pas a un fichier qui double de
// taille. La date de sa mesure est le 6 aout 2026.
//
// Lance : npx tsx lib/engines/budget-pdf.test.ts
// ============================================================

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  APPELS_PORTEURS_DE_PDF,
  plafondDePages,
  plafondTokensDeLAppel,
  octetsEnBase64,
  plafondFichierOctets,
  requeteTientDansLePlafond,
  estBloquant,
  PLAFOND_PAGES_FENETRE_COURTE,
  PLAFOND_PAGES_FENETRE_LONGUE,
  PLAFOND_REQUETE_OCTETS,
  FACTEUR_BASE64,
} from './budget-pdf';
import { MODEL, FAST_MODEL } from './anthropic-client';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  PASS  ${message}`);
  } else {
    failed++;
    console.log(`  FAIL  ${message}`);
  }
}

// ------------------------------------------------------------
// Releve des sites reels dans les sources
// ------------------------------------------------------------

interface SiteReel {
  fichier: string;
  ligne: number;
  reserveSortie: number;
  model: string;
}

/**
 * Parcourt les sources et rend chaque appel a callClaudeWithPDF avec ses
 * quatrieme et cinquieme arguments. Le decoupage se fait sur la structure
 * de l appel et non sur une expression reguliere appliquee au fichier
 * entier : on isole le texte entre la parenthese ouvrante et la fermante
 * correspondante, puis on separe au premier niveau de virgules.
 */
function releverSites(): SiteReel[] {
  const dir = 'lib/engines';
  const sites: SiteReel[] = [];
  for (const nom of readdirSync(dir)) {
    if (!nom.endsWith('.ts') || nom.endsWith('.test.ts')) continue;
    if (nom === 'anthropic-client.ts') continue; // la definition, pas un site
    const chemin = join(dir, nom);
    const src = readFileSync(chemin, 'utf-8');
    let idx = 0;
    while (true) {
      const trouve = src.indexOf('callClaudeWithPDF(', idx);
      if (trouve === -1) break;
      idx = trouve + 1;
      const debut = trouve + 'callClaudeWithPDF('.length;
      // Fermeture correspondante, en comptant les parentheses imbriquees.
      let profondeur = 1;
      let i = debut;
      for (; i < src.length && profondeur > 0; i++) {
        if (src[i] === '(') profondeur++;
        else if (src[i] === ')') profondeur--;
      }
      const args = src.slice(debut, i - 1);
      // Separation au premier niveau, hors parentheses et hors chaines.
      const parts: string[] = [];
      let courant = '';
      let prof = 0;
      let chaine: string | null = null;
      for (const c of args) {
        if (chaine) {
          courant += c;
          if (c === chaine) chaine = null;
          continue;
        }
        if (c === "'" || c === '"' || c === '`') { chaine = c; courant += c; continue; }
        if (c === '(' || c === '[' || c === '{') prof++;
        if (c === ')' || c === ']' || c === '}') prof--;
        if (c === ',' && prof === 0) { parts.push(courant.trim()); courant = ''; continue; }
        courant += c;
      }
      if (courant.trim()) parts.push(courant.trim());

      const ligne = src.slice(0, trouve).split('\n').length;
      const quatrieme = parts[3] ?? '';
      const cinquieme = parts[4] ?? 'MODEL';

      // Le quatrieme argument peut etre une ternaire : on retient le pire
      // cas, c est-a-dire le plus grand nombre qui y figure. Retenir le
      // premier laisserait passer une branche plus large.
      const nombres = Array.from(quatrieme.matchAll(/\b(\d{3,6})\b/g)).map((m) => Number(m[1]));
      const reserveSortie = nombres.length ? Math.max(...nombres) : NaN;

      const model = /FAST_MODEL/.test(cinquieme) ? FAST_MODEL : MODEL;
      sites.push({ fichier: chemin, ligne, reserveSortie, model });
    }
  }
  return sites;
}

const sites = releverSites();

// ------------------------------------------------------------
console.log('\n# Test 1 : le releve trouve quelque chose');
{
  // Un verrou qui ne cherche rien est vert pour la mauvaise raison. Si le
  // parcours ne trouve aucun site, tous les tests suivants passeraient a
  // vide, et c est exactement ce qu il faut refuser.
  assert(sites.length > 0, `le parcours trouve des sites (${sites.length})`);
  assert(
    sites.every((s) => Number.isFinite(s.reserveSortie)),
    'chaque site rend une reserve de sortie numerique',
  );
  assert(
    sites.some((s) => s.model === FAST_MODEL),
    'au moins un site vise le modele rapide (sinon le plafond de pages court ne serait jamais atteint)',
  );
}

// ------------------------------------------------------------
console.log('\n# Test 2 : le perimetre declare est celui qui existe');
{
  const fichiersReels = new Set(sites.map((s) => s.fichier));
  const fichiersDeclares = new Set(APPELS_PORTEURS_DE_PDF.map((a) => a.fichier));

  for (const f of Array.from(fichiersReels)) {
    assert(fichiersDeclares.has(f), `site reel declare : ${f}`);
  }
  for (const f of Array.from(fichiersDeclares)) {
    assert(fichiersReels.has(f), `declaration adossee a un site reel : ${f}`);
  }
}

// ------------------------------------------------------------
console.log('\n# Test 3 : la reserve declaree majore la reserve demandee');
{
  for (const appel of APPELS_PORTEURS_DE_PDF) {
    const sitesDuFichier = sites.filter((s) => s.fichier === appel.fichier);
    if (sitesDuFichier.length === 0) continue;
    const pire = Math.max(...sitesDuFichier.map((s) => s.reserveSortie));
    assert(
      appel.reserveSortie >= pire,
      `${appel.moteur} : declare ${appel.reserveSortie} >= demande ${pire}`,
    );
  }
}

// ------------------------------------------------------------
console.log('\n# Test 4 : le modele declare est celui que le site passe');
{
  for (const appel of APPELS_PORTEURS_DE_PDF) {
    const sitesDuFichier = sites.filter((s) => s.fichier === appel.fichier);
    if (sitesDuFichier.length === 0) continue;
    const modeles = new Set(sitesDuFichier.map((s) => s.model));
    assert(
      modeles.size === 1 && modeles.has(appel.model),
      `${appel.moteur} : modele declare ${appel.model} conforme aux sites`,
    );
  }
}

// ------------------------------------------------------------
console.log('\n# Test 5 : le plafond de pages suit la fenetre et non le nom du modele');
{
  assert(plafondDePages(200_000) === PLAFOND_PAGES_FENETRE_COURTE,
    'fenetre de 200k : cent pages');
  assert(plafondDePages(1_000_000) === PLAFOND_PAGES_FENETRE_LONGUE,
    'fenetre de 1M : six cents pages');
  assert(plafondDePages(200_001) === PLAFOND_PAGES_FENETRE_LONGUE,
    'le basculement se lit sur la fenetre, pas sur l identifiant du modele');
}

// ------------------------------------------------------------
console.log('\n# Test 6 : le plafond de tokens se calcule et ne se pose pas');
{
  const preScan = APPELS_PORTEURS_DE_PDF.find((a) => a.moteur === 'preScan')!;
  const financier = APPELS_PORTEURS_DE_PDF.find((a) => a.moteur === 'financialExtraction')!;

  assert(
    plafondTokensDeLAppel(preScan, 200_000) === 200_000 - preScan.reserveSortie - preScan.enveloppeTokens,
    'le plafond est la fenetre moins la sortie moins l enveloppe',
  );
  assert(
    plafondTokensDeLAppel(financier, 1_000_000) > plafondTokensDeLAppel(preScan, 200_000),
    'le modele a fenetre longue laisse plus de place que le modele rapide',
  );

  // Le point de calibrage du 6 aout 2026 : Woodpecker passe sur Sonnet.
  const WOODPECKER_TOKENS = 236_457;
  assert(
    WOODPECKER_TOKENS < plafondTokensDeLAppel(financier, 1_000_000),
    'Woodpecker tient sous le plafond du modele principal, conformement a la mesure',
  );
  // Et ce qu il ne borne pas : un tirage qui passe ne dit pas ou l on tombe.
  assert(
    plafondTokensDeLAppel(financier, 1_000_000) > 4 * WOODPECKER_TOKENS,
    'le plafond calcule est tres au-dessus du seul point mesure, donc la mesure ne le borne pas',
  );
}

// ------------------------------------------------------------
console.log('\n# Test 7 : la taille se derive du plafond de requete');
{
  assert(octetsEnBase64(3) === 4, 'trois octets rendent quatre caracteres');
  assert(octetsEnBase64(1) === 4, 'un octet rend quatre caracteres, bourrage compris');
  assert(
    Math.abs(octetsEnBase64(12_943_232) / 12_943_232 - FACTEUR_BASE64) < 0.001,
    'le facteur mesure sur Woodpecker est celui de la definition',
  );

  const plafond = plafondFichierOctets();
  assert(requeteTientDansLePlafond(plafond), 'un fichier au plafond tient');
  assert(!requeteTientDansLePlafond(plafond + 1_000_000), 'un fichier au-dela ne tient pas');
  assert(
    Math.abs(plafond - PLAFOND_REQUETE_OCTETS / FACTEUR_BASE64) < 1,
    'le plafond de fichier est le plafond de requete divise par le facteur, jamais un chiffre ecrit',
  );
  assert(requeteTientDansLePlafond(12_943_232),
    'Woodpecker tient sous le plafond de requete, conformement a la mesure');
}

// ------------------------------------------------------------
console.log('\n# Test 8 : ce qui bloque et ce qui degrade');
{
  const preScan = APPELS_PORTEURS_DE_PDF.find((a) => a.moteur === 'preScan')!;
  assert(!estBloquant(preScan),
    'le pre-scan ne bloque pas : il se declare hors d etat et le pipeline continue');
  assert(
    APPELS_PORTEURS_DE_PDF.filter((a) => a.moteur !== 'preScan').every(estBloquant),
    'les cinq autres bloquent : leur refus vide la note',
  );
}

// ------------------------------------------------------------
console.log(`\n${passed}/${passed + failed} tests passes`);
if (failed > 0) {
  process.exit(1);
}
