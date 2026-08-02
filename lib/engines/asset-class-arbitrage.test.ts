// ============================================================
// Tests deterministes de l arbitrage de classe d actif
// ------------------------------------------------------------
// Ce que ces tests prouvent : la chaine de production ne commande plus
// seule la classe d actif quand les champs declares du dossier disent
// autre chose, et toute divergence se voit, quel que soit le vainqueur.
//
// Le defaut ferme, releve sur la note Braincube du 3 aout 2026 : la
// chaine `hardware-physical`, detectee sur le vocabulaire industriel
// d un memorandum IIoT, faisait ressortir en `industrial-hardware` un
// dossier qui declarait secteur « SaaS », sous-secteur « Plateforme
// IIoT » et modele « SaaS pur avec revenus recurrents ». Un signal
// contre trois, et un facteur cinq a dix sur la fourchette.
// ============================================================

import { computeRelevanceMatrix, __testables } from './relevance-matrix';

const { arbitrerClasseActif } = __testables;
import { getSectorMultiples } from '../data/sector-benchmarks';

let pass = 0, fail = 0;
function check(cond: boolean, label: string) {
  if (cond) { pass++; console.log(`  OK  ${label}`); }
  else { fail++; console.error(`  KO  ${label}`); }
}

function dossier(p: Record<string, any>): any {
  return {
    companyName: 'Societe', sector: '', subSector: '', businessModel: '',
    problem: '', solution: '', traction: {}, team: [], fundraise: {}, ...p,
  };
}

// Le dossier reel, tel que l extraction l a rendu le 3 aout 2026.
const BRAINCUBE = dossier({
  sector: 'SaaS',
  subSector: 'Plateforme IIoT (Industrial Internet of Things) pour la fabrication intelligente',
  businessModel: "Modele SaaS pur avec revenus recurrents (ARR) factures par site industriel deploye, complements de consulting. Strategie land and expand : projet pilote sur un site, puis deploiement sur l ensemble des sites du client.",
  // Le vocabulaire industriel du memorandum reel, qui est ce qui fait
  // basculer la chaine de production vers hardware-physical.
  problem: "Les usines accumulent des donnees de production sur des systemes SCADA et MES heterogenes. Chaque ligne de production, chaque atelier et chaque site de fabrication produit des mesures que personne n exploite.",
  solution: "Plateforme cloud installee sur les lignes de production des usines. La fabrication est instrumentee site par site, atelier par atelier, et les donnees de production remontent en continu.",
});

console.log('\n[Suite 1] le dossier qui a ouvert le defaut');
{
  // La chaine est posee a hardware-physical, valeur reellement detectee
  // sur le memorandum du 3 aout. Le texte de recherche du dossier reel
  // fait cent pages ; le reproduire ici testerait le detecteur de
  // mots-cles, pas l arbitrage.
  const r = arbitrerClasseActif('hardware-physical', 'SaaS', 'usine ligne de production fabrication site industriel', BRAINCUBE);
  check(r.retenue === 'saas-b2b',
    `la classe retenue suit les champs declares (obtenu ${r.retenue})`);
  const a = r.trace;
  check(a !== null, 'la divergence est tracee');
  check((a?.champsCorroborants.length ?? 0) >= 2,
    `au moins deux champs declares corroborent (obtenu ${a?.champsCorroborants.join(', ')})`);
  check(a?.voix.dossier! > a?.voix.chaine!, 'la majorite des voix va au dossier');
  check(a?.motif.includes('l emporte') === true, 'le motif dit qui l emporte et pourquoi');
}

console.log('\n[Suite 2] ce que le choix change, en chiffres');
{
  const industriel = getSectorMultiples('industrial-hardware', 'series-a')!;
  const logiciel = getSectorMultiples('saas-b2b', 'series-a')!;
  check(logiciel.range.min > industriel.range.max,
    `les deux lectures ne se recouvrent pas : ${industriel.range.min}x-${industriel.range.max}x contre ${logiciel.range.min}x-${logiciel.range.max}x`);
  // Sur la base 2021 du dossier, l ecart mesure.
  const base = 13_488_000;
  check(Math.round(base * logiciel.range.min / 1e6) === 108 && Math.round(base * industriel.range.max / 1e6) === 67,
    'sur la base 2021, 108 M EUR plancher logiciel contre 67 M EUR plafond industriel');
}

console.log('\n[Suite 3] la chaine garde la main quand le dossier ne la contredit pas');
{
  // Un seul champ logiciel, le secteur, dans un dossier manifestement
  // industriel : cela ne suffit pas a renverser la chaine.
  const faible = dossier({
    sector: 'SaaS',
    subSector: 'Fabrication de coques et assemblage de sous-marins de loisir',
    businessModel: 'Vente unitaire d engins nautiques produits en atelier, marge sur materiel.',
  });
  const r = arbitrerClasseActif('hardware-physical', 'SaaS', 'coque atelier assemblage', faible);
  check(r.retenue !== 'saas-b2b', `la chaine garde la main (obtenu ${r.retenue})`);
  check(r.trace !== null, 'et la divergence reste tracee malgre tout');
  check(r.trace?.motif.includes('garde la main') === true,
    'le motif dit que la chaine l emporte et pourquoi');
  check(r.trace?.voix.dossier === 1, `une seule voix au dossier (obtenu ${r.trace?.voix.dossier})`);
}

console.log('\n[Suite 4] aucune trace quand il n y a rien a arbitrer');
{
  const net = dossier({
    sector: 'Cybersecurite', subSector: 'Detection d intrusion', businessModel: 'Abonnement annuel par siege.',
    problem: 'Les intrusions ne sont pas detectees.', solution: 'Un logiciel de detection.',
  });
  const m = computeRelevanceMatrix(net, 'Cybersecurite');
  check(m.assetClassArbitration === null, `pas de divergence, pas de trace (classe ${m.assetClass})`);
  // Et par le chemin complet : un dossier concordant traverse la
  // matrice sans produire de trace.
  const r = arbitrerClasseActif('pure-software', 'Cybersecurite', 'logiciel abonnement', net);
  check(r.trace === null, 'chaine logicielle et dossier logiciel : rien a arbitrer');
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
