// ============================================================
// Tests deterministes de la garde d absence
// ------------------------------------------------------------
// Ce que ces tests prouvent : une chaine vide vaut absence, zero ne
// vaut pas absence, et la coalescence nulle ne revient pas en face
// d un champ dont le contrat dit qu il vaudra la chaine vide.
//
// Le defaut d origine : le prompt d extraction impose « retourne une
// chaine vide "" » quand une information manque, et les moteurs en
// aval se gardaient contre null. `${extraction.fundraise?.amount ??
// '?'}` ne se declenche jamais sur une chaine vide, donc le modele
// recevait « Montant annonce : » suivi de rien. Une ligne tronquee
// n est pas un champ vide pour un modele, c est une phrase interrompue,
// et il la comble.
//
// Une garde inerte est plus dangereuse qu une garde absente parce
// qu elle a la forme d une garde. Elle nomme le bon champ, elle pose le
// bon defaut, et il ne lui manque que d etre vraie : rien ne manque,
// donc rien ne se cherche. Une garde oubliee, elle, laisse un trou
// qu un releve finit par trouver. C est la meme dissymetrie que le
// battement present et le battement absent.
//
// La seconde suite est le verrou. Le point de passage seul ne suffit
// pas, puisque rien n empeche d ecrire une coalescence nulle a un
// nouveau site : c est la troisieme forme de portage, le test qui
// compare le declare au reel et rougit le jour ou les deux divergent.
//
// Execution : npx tsx lib/engines/champ-absent.test.ts
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { champ, CHAMP_NON_RENSEIGNE } from './champ-absent';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

console.log('\n[Suite 1] ce que la coalescence nulle laissait passer');
{
  check(champ('') === CHAMP_NON_RENSEIGNE, 'la chaine vide vaut absence');
  check(champ('   ') === CHAMP_NON_RENSEIGNE, 'les blancs aussi');
  check(champ('\n\t') === CHAMP_NON_RENSEIGNE, 'les blancs typographiques aussi');
  check(champ(null) === CHAMP_NON_RENSEIGNE, 'null vaut absence');
  check(champ(undefined) === CHAMP_NON_RENSEIGNE, 'undefined aussi');
  check(champ('', '?') === '?', 'le libelle du site est respecte');
}

console.log('\n[Suite 2] ce qui n est pas une absence');
{
  // La faute symetrique, celle que `|| ` commet la ou `??` echouait.
  check(champ(0) === '0', 'zero est une valeur, pas un manque');
  check(champ(false) === 'false', 'et false aussi');
  check(champ('4 M€') === '4 M€', 'une valeur passe telle quelle');
  check(champ('  4 M€  ') === '4 M€', 'debarrassee de ses blancs de bord');
}

console.log('\n[Suite 3] aucune coalescence nulle ne subsiste en face d un champ du contrat');
{
  // Les champs de ExtractionOutput dont le contrat dit qu ils valent la
  // chaine vide quand le document ne les porte pas. La liste s allonge
  // avec le contrat ; ce qu elle ne couvre pas n est pas verrouille, et
  // c est dit ici plutot que tu.
  const CHAMPS = [
    'companyName', 'sector', 'subSector', 'geographicHub', 'country',
    'marketPitch', 'productDescription', 'businessModel', 'rawSummary',
    'stage', 'amount', 'valuation', 'leadInvestor', 'seller',
    'stakeForSale', 'sellSideAdvisor', 'revenue', 'growth', 'customers',
  ];
  // Un fallback vide n est pas une garde qui promet un libelle : c est
  // une normalisation pour un test de chaine, et elle est juste.
  const motif = new RegExp(
    String.raw`(?:[A-Za-z_$][\w$]*)(?:\??\.[A-Za-z_$][\w$]*)*\??\.(?:${CHAMPS.join('|')})\s*\?\?\s*(?:'[^']+'|"[^"]+")`,
  );

  const racine = path.resolve(__dirname, '..', '..');
  const violations: string[] = [];

  const parcourir = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (['node_modules', '.git', '.next', 'dist'].includes(e.name)) continue;
        parcourir(p);
        continue;
      }
      if (!/\.tsx?$/.test(e.name)) continue;
      if (/\.test\.tsx?$/.test(e.name)) continue;
      const lignes = fs.readFileSync(p, 'utf8').split('\n');
      lignes.forEach((l, i) => {
        // Une ligne de commentaire qui cite la forme fautive la
        // documente, elle ne l execute pas. C est le cas de l en-tete de
        // champ-absent.ts, qui doit pouvoir la nommer pour l expliquer.
        const t = l.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
        if (motif.test(l)) violations.push(`${path.relative(racine, p)}:${i + 1}`);
      });
    }
  };
  for (const sous of ['lib', 'app', 'scripts']) {
    const d = path.join(racine, sous);
    if (fs.existsSync(d)) parcourir(d);
  }

  if (violations.length > 0) {
    console.error('  Sites fautifs :\n    ' + violations.join('\n    '));
  }
  check(violations.length === 0, `aucune garde inerte dans lib, app et scripts (${violations.length} trouvee(s))`);
}

console.log('\n[Suite 4] le verrou rougit quand la faute revient');
{
  // Sans ce controle, la suite precedente pourrait etre verte parce
  // qu elle ne cherche rien. On lui donne une ligne fautive fabriquee
  // et on verifie qu elle la voit.
  const CHAMPS = ['amount', 'stage', 'companyName'];
  const motif = new RegExp(
    String.raw`(?:[A-Za-z_$][\w$]*)(?:\??\.[A-Za-z_$][\w$]*)*\??\.(?:${CHAMPS.join('|')})\s*\?\?\s*(?:'[^']+'|"[^"]+")`,
  );
  check(motif.test("`${extraction.fundraise?.amount ?? '?'}`"), 'la forme d origine est reconnue');
  check(motif.test('`${e.companyName ?? "inconnu"}`'), 'y compris avec des guillemets doubles');
  check(!motif.test("`${champ(extraction.fundraise?.amount, '?')}`"), 'et la forme corrigee ne l est pas');
  check(!motif.test("`${extraction.marketPitch ?? ''}`"), 'une normalisation vers la chaine vide reste permise');
}

console.log(`\n${pass} OK, ${fail} KO\n`);
process.exit(fail > 0 ? 1 : 0);
