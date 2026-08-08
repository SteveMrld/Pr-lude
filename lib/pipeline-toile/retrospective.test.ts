// Verrou de la toile retrospective.
//
// La liste des cas se derive des axes que le module decide : quel etat
// porte un statut, quelle duree se retient, d ou vient une extinction,
// et pourquoi la toile est vide quand elle l est. Chaque axe dans les
// deux sens, parce qu une toile qui peint tout du meme gris et une
// toile qui invente des causes rendent le meme service.

import {
  construireToileRetrospective,
  releveParNoeud,
  libelleDuree,
  type NoeudTopologie,
} from './retrospective';
import { ENGINE_TO_RESULT_KEY } from './result-mapping';

let pass = 0, fail = 0;
function check(cond: boolean, label: string): void {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.log(`  KO  ${label}`); }
}

const TOPO: NoeudTopologie[] = [
  { id: 'extraction', deps: [] },
  { id: 'team', deps: ['extraction'] },
  { id: 'market', deps: ['extraction'] },
  { id: 'benchmarks', deps: ['team', 'market'] },
  { id: 'pattern', deps: ['benchmarks'] },
];
const etat = (t: ReturnType<typeof construireToileRetrospective>, id: string) =>
  t.noeuds.find(n => n.id === id)!;

console.log('\n[Suite 1] les clefs du recorder ne sont pas celles de la topologie');
{
  // LE PIEGE QUI RENDRAIT UNE TOILE ENTIEREMENT VIDE SANS RIEN DIRE. Le
  // recorder ecrit `financialData`, la topologie dit
  // `financial-extraction`.
  const r = releveParNoeud({ financialData: { status: 'ok', durationMs: 50037 } });
  check(!!r['financial-extraction'], 'la clef du recorder se traduit vers l id de topologie');
  check(r['financial-extraction']?.statut === 'ok', 'et le statut suit');
  check(ENGINE_TO_RESULT_KEY['financial-extraction'] === 'financialData',
    'le pont existe dans une seule table, lue a l envers');
  // `preScan` figure dans la table de pont, sous l id `prescan`, alors
  // qu il n est pas un noeud de la toile : il se traduit donc, et c est
  // la construction de la toile qui l ignore faute de noeud. La premiere
  // ecriture de ce cas le prenait pour une clef inconnue, et le rouge
  // portait sur le jeu d essai.
  const pont = releveParNoeud({ preScan: { status: 'empty_output' } });
  check(!!pont.prescan, 'une clef de la table se traduit meme sans noeud correspondant');
  // Le second sens : une clef que la table ne connait pas ne doit pas
  // disparaitre ni en ecraser une autre. `valuation` et `indicators`
  // existent en production et ne sont dans aucune des deux listes.
  const hors = releveParNoeud({ valuation: { status: 'ok' }, indicators: { status: 'ok' } });
  check(!!hors.valuation && !!hors.indicators, 'une clef inconnue se conserve sous son nom');
  check(Object.keys(hors).length === 2, 'et n en ecrase aucune autre');
}

console.log('\n[Suite 2] les quatre etats de non-production ne se confondent pas');
{
  const t = construireToileRetrospective(TOPO, {
    extraction: { status: 'ok', durationMs: 1200 },
    team: { status: 'skipped_not_applicable', durationMs: 0 },
    market: { status: 'failed', durationMs: 212229 },
    benchmarks: { status: 'empty_output', durationMs: 0 },
    pattern: { status: 'failed-upstream', durationMs: 0 },
  }, 'completed_with_gaps');
  check(etat(t, 'extraction').etat === 'abouti', 'ok rend abouti');
  check(etat(t, 'team').etat === 'ecarte-doctrine', 'skipped_not_applicable rend ecarte par doctrine');
  check(etat(t, 'market').etat === 'incident', 'failed rend un incident');
  check(etat(t, 'benchmarks').etat === 'non-conclusif', 'empty_output rend non conclusif');
  check(etat(t, 'pattern').etat === 'eteint-cascade', 'failed-upstream rend une extinction');
  // Le second sens de l axe : les cinq doivent etre distincts, sinon la
  // toile serait exacte et ne distinguerait rien.
  const distincts = new Set(t.noeuds.map(n => n.etat));
  check(distincts.size === 5, 'les cinq etats rendus sont distincts');
  // Un timeout est un incident et non autre chose : le recorder les
  // range tous deux dans les lacunes, et un partner n a pas a distinguer
  // un plantage d un depassement de fenetre sur la toile.
  const tt = construireToileRetrospective(TOPO, { market: { status: 'timeout' } }, 'completed_with_gaps');
  check(etat(tt, 'market').etat === 'incident', 'timeout rend aussi un incident');
  // Ce qui n a pas ete depose n est pas une panne.
  check(etat(tt, 'team').etat === 'non-instrumente', 'un moteur sans releve est non instrumente');
  check(etat(tt, 'team').statutBrut === null, 'et il ne porte aucun statut brut');
}

console.log('\n[Suite 3] la cascade se derive du graphe et non du dessin');
{
  const t = construireToileRetrospective(TOPO, {
    extraction: { status: 'ok' },
    team: { status: 'failed' },
    market: { status: 'ok' },
    benchmarks: { status: 'failed-upstream' },
    pattern: { status: 'failed-upstream' },
  }, 'completed_with_gaps');
  // LE MOTEUR ETEINT NOMME CELUI QUI L A ETEINT, et ce nom n est ecrit
  // nulle part : le recorder ne pose que `failed-upstream`.
  check(etat(t, 'benchmarks').causeAmont.join(',') === 'team',
    'un moteur eteint nomme la dependance qui a casse');
  check(!etat(t, 'benchmarks').causeAmont.includes('market'),
    'et ne nomme pas celle qui a abouti');
  // On remonte d un cran seulement : nommer l origine lointaine ferait
  // porter la meme faute par quinze noeuds et noierait le coupable.
  check(etat(t, 'pattern').causeAmont.join(',') === 'benchmarks',
    'le suivant nomme son voisin immediat et non l origine lointaine');
  // Le second sens : un moteur qui n est pas eteint ne porte aucune
  // cause, faute de quoi la toile accuserait des amonts sains.
  check(etat(t, 'market').causeAmont.length === 0, 'un moteur abouti ne nomme aucune cause');
  check(etat(t, 'team').causeAmont.length === 0, 'un moteur tombe non plus : il est la cause');
}

console.log('\n[Suite 4] le vide se qualifie, il ne se constate pas');
{
  const rien = { extraction: undefined } as any;
  check(construireToileRetrospective(TOPO, null, 'completed').vide === 'instrumentation-absente',
    'sans releve sur un run abouti, la lacune est celle du dispositif');
  check(construireToileRetrospective(TOPO, rien, 'failed').vide === 'run-tombe-avant-instruction',
    'sur un run tombe, le vide dit que rien n a instruit');
  check(construireToileRetrospective(TOPO, null, 'knockout').vide === 'ecarte-au-prescan',
    'sur un dossier ecarte, le vide dit la decision du pre-scan');
  // LE QUATRIEME CAS N EST PAS UN VIDE, et c est la norme : quarante et
  // une notes sur soixante-six portent un releve partiel.
  const partiel = construireToileRetrospective(TOPO, { extraction: { status: 'ok' } }, 'completed');
  check(partiel.vide === null, 'un releve partiel n est pas un vide');
  check(partiel.instrumentes === 1 && partiel.total === 5,
    'et la toile porte son denominateur plutot que de laisser croire a une couverture');
}

console.log('\n[Suite 5] la duree se retient quand elle a ete mesuree');
{
  const t = construireToileRetrospective(TOPO, {
    extraction: { status: 'ok', durationMs: 1200 },
    team: { status: 'ok', durationMs: 0 },
  }, 'completed');
  check(etat(t, 'extraction').dureeMs === 1200, 'une duree mesuree se conserve');
  // Zero milliseconde n est pas une duree : le recorder l ecrit pour les
  // moteurs deterministes qui ne passent pas par le modele, et
  // l afficher ferait lire « 0 s » comme une performance.
  check(etat(t, 'team').dureeMs === null, 'une duree nulle ne se lit pas comme une mesure');
  check(t.dureeTotaleMs === 1200, 'et le total ne compte que ce qui a ete mesure');
  check(libelleDuree(null) === '' && libelleDuree(0) === '', 'aucun libelle sans mesure');
  check(libelleDuree(850) === '850 ms', 'les millisecondes se disent');
  check(libelleDuree(44164).endsWith(' s'), 'les secondes aussi');
  check(libelleDuree(289170) === '4 min 49', 'et les minutes se lisent en clair');
}

console.log(`\n${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
