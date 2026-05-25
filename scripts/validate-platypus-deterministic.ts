// ============================================================
// VALIDATION DETERMINISTE PLATYPUS CRAFT
// ------------------------------------------------------------
// Verifie sans appel API que computeRelevanceMatrix sort la bonne
// asset class (industrial-hardware) et la bonne chaine de production
// (hardware-physical) pour un texte representatif du dossier
// Platypus Craft, apres le durcissement des classificateurs
// (commit chore(matrice): audit et durcissement).
//
// Pas de deck PDF en local. On reconstruit le texte a partir de ce
// qu on sait du dossier : construction navale FR, navires
// submersibles bi-place, propulsion electrique marine, foilboard,
// exploration sous-marine cotiere.
//
// Execution : npx tsx scripts/validate-platypus-deterministic.ts
// ============================================================

import { computeRelevanceMatrix } from '../lib/engines/relevance-matrix';
import { normalizeAssetClass } from '../lib/data/sector-benchmarks';
import { detectAssetClass } from '../lib/data/verified-comparables';
import { detectSectorSlugs } from '../lib/engines/sectoral-injection-pure';
import type { ExtractionOutput } from '../lib/engines/types';

// Note : comparables-engine.ts importe 'server-only', non chargeable
// par tsx en script CLI. On valide quand meme le routage hardware
// industriel via detectAssetClass de verified-comparables (qui couvre
// le meme perimetre doctrinal pour le filtrage des comparables prompt).

const platypusExtraction: ExtractionOutput = {
  companyName: 'Platypus Craft',
  sector: 'Nautique',
  subSector: 'Construction navale innovante',
  country: 'France',
  geographicHub: 'Cote d Azur',
  yearFounded: 2022,
  founders: [
    {
      name: 'Test Fondateur',
      role: 'CEO et fondateur',
      background: 'Ingenieur mecanique, ancien architecte naval, dix ans dans les chantiers de plaisance',
    },
  ],
  marketPitch: `Platypus Craft conçoit et fabrique en France des navires submersibles legers
    pour l exploration sous-marine cotiere et la decouverte du littoral mediterraneen et atlantique.
    Notre gamme combine semi-submersible bi-place a vision panoramique et foilboard motorise
    pour la mobilite douce de loisir. Nous adressons un marche du tourisme nautique experientiel
    encore peu structure mais en croissance reguliere.`,
  productDescription: `Navires semi-submersibles bi-place avec propulsion electrique marine.
    Coque composite, batterie lithium-ion, cockpit etanche transparent. Foilboard motorise pour
    la pratique recreative. Fabrication serie limitee dans notre chantier naval de Mediterranee
    avec une ligne d assemblage dediee aux semi-submersibles. Les composants electroniques
    embarques assurent la navigation, la gestion energetique et le suivi en temps reel via une
    application mobile companion. R&D hardware en interne, propulsion marine electrique
    proprietaire. Fournisseurs francais pour la coque, batteries cellule sourcees en Europe.
    Soumis a certification Bureau Veritas et homologation pavillon francais.`,
  businessModel: `Vente unitaire des navires aux operateurs touristiques (clubs nautiques,
    bases de loisirs, hotels littoraux) et aux particuliers premium. Prix unitaire 80 a 150
    keur par navire selon configuration. Marge par bateau structurelle visee 30 pourcent
    apres industrialisation serie. Pas d abonnement, pas de SaaS dans le modele core.
    L application mobile est livree gratuite avec chaque navire vendu.`,
  traction: {
    metrics: ['12 unites vendues 2024', 'Carnet de commandes 25 unites pour 2025'],
    revenue: '1.5M EUR 2024',
    growth: 'Croissance 200 pourcent annuelle sur les 24 derniers mois',
    customers: 'Mix BtoB operateurs touristiques et BtoC particuliers premium',
  },
  fundraise: {
    stage: 'series-a',
    amount: '6M EUR',
    valuation: '20M EUR pre-money',
  },
  competitorsCited: ['Seabreacher', 'U-Boat Worx', 'Triton Submarines'],
  rawSummary: `Le projet industriel Platypus Craft conjugue ingenierie hydrodynamique,
    propulsion electrique marine et electronique embarquee. La production s appuie sur un
    chantier naval francais avec une ligne d assemblage dediee aux semi-submersibles bi-place
    et aux foilboards motorises. La chaine de production est entierement physique : coque
    composite moulee sur place, propulsion marine electrique developpee en interne, capteurs
    embarques pour la navigation. L objectif industriel est de produire trois cents unites
    annuelles a horizon cinq ans avec un capex outillage limite par site de production.
    Le carnet de commandes est solide sur l annee qui vient, avec une diversification
    geographique mediterraneenne et atlantique. Le marche cible est le tourisme nautique
    experientiel, encore peu structure mais en croissance reguliere portee par la
    decarbonation de la mobilite maritime de loisir. La concurrence directe est tres limitee
    sur le segment des semi-submersibles legers, avec quelques acteurs americains historiques
    sur les submersibles lourds. Le positionnement prix vise un cran sous les submersibles
    de luxe, avec un focus sur l usage operateur touristique professionnel. L equipe
    technique reunit cinq ingenieurs mecaniciens, deux ingenieurs electroniciens et trois
    profils chantier. La feuille de route industrielle prevoit une homologation Bureau
    Veritas en 2025 et une certification CE marine deuxieme semestre 2025.`,
};

const sectorString = `${platypusExtraction.sector} ${platypusExtraction.subSector}`;

console.log('=== VALIDATION DETERMINISTE PLATYPUS CRAFT ===\n');

// Stage 1 : test direct des classificateurs unitaires.
const rawAsset = sectorString;
const normalizedAsset = normalizeAssetClass(rawAsset);
console.log(`normalizeAssetClass("${rawAsset}") = ${normalizedAsset}`);

const comparablesAsset = detectAssetClass(platypusExtraction);
console.log(`verified-comparables.detectAssetClass = ${comparablesAsset}`);

const slugs = detectSectorSlugs(platypusExtraction);
console.log(`detectSectorSlugs = [${slugs.join(', ')}]`);

// Stage 2 : matrice complete.
console.log('\n=== Matrice de pertinence ===');
const matrix = computeRelevanceMatrix(platypusExtraction, sectorString);

console.log(`assetClass: ${matrix.assetClass}`);
console.log(`businessModel: ${matrix.businessModel}`);
console.log(`productionChain: ${matrix.productionChain}`);
console.log(`acquisitionFunnel: ${matrix.acquisitionFunnel}`);
console.log(`supplyChainExposure: ${matrix.supplyChainExposure} [${matrix.supplyChainExposureFactors.join(', ')}]`);
console.log(`geopoliticalExposure: ${matrix.geopoliticalExposure} [${matrix.geopoliticalExposureFactors.join(', ')}]`);
console.log(`macroSensitivity: ${matrix.macroSensitivity} [${matrix.macroSensitivityFactors.join(', ')}]`);
console.log(`digitalReproducibility: ${matrix.digitalReproducibility} [${matrix.digitalReproducibilityFactors.join(', ')}]`);

// Stage 3 : verdicts cles.
console.log('\n=== Verdicts cles ===');
console.log(`indicatorsSaas: ${matrix.verdicts.indicatorsSaas.applicable}`);
console.log(`indicatorsIndustrial: ${matrix.verdicts.indicatorsIndustrial.applicable}`);
console.log(`saasMetricsRetention: ${matrix.verdicts.saasMetricsRetention.applicable}`);
console.log(`saasMetricsUnitEconomics: ${matrix.verdicts.saasMetricsUnitEconomics.applicable}`);
console.log(`marketAiReplicability: ${matrix.verdicts.marketAiReplicability.applicable}`);
console.log(`executionFriction: ${matrix.verdicts.executionFriction.applicable}`);
console.log(`macroGeopolitical: ${matrix.verdicts.macroGeopolitical.applicable}`);

// Stage 4 : assertions de non-regression.
console.log('\n=== Assertions ===');
let pass = 0;
let fail = 0;

function assert(label: string, cond: boolean) {
  if (cond) { console.log(`PASS  ${label}`); pass++; }
  else { console.log(`FAIL  ${label}`); fail++; }
}

assert('matrix.assetClass === industrial-hardware', matrix.assetClass === 'industrial-hardware');
assert('matrix.productionChain === hardware-physical', matrix.productionChain === 'hardware-physical');
assert('matrix.businessModel !== recurrent-saas', matrix.businessModel !== 'recurrent-saas');
assert('matrix.businessModel in [unitary-sale, hybrid]', ['unitary-sale', 'hybrid'].includes(matrix.businessModel));
assert('indicatorsSaas.applicable === none', matrix.verdicts.indicatorsSaas.applicable === 'none');
assert('indicatorsIndustrial.applicable === full', matrix.verdicts.indicatorsIndustrial.applicable === 'full');
assert('saasMetricsRetention.applicable === none', matrix.verdicts.saasMetricsRetention.applicable === 'none');
assert('marketAiReplicability.applicable === none', matrix.verdicts.marketAiReplicability.applicable === 'none');
assert('executionFriction.applicable === full', matrix.verdicts.executionFriction.applicable === 'full');
assert('digitalReproducibility === low', matrix.digitalReproducibility === 'low');
assert('verified-comparables.detectAssetClass === deeptech_hardware', comparablesAsset === 'deeptech_hardware');
assert('detectSectorSlugs primary === industrie-hardware', slugs[0] === 'industrie-hardware');

console.log(`\n${pass}/${pass + fail} assertions passes`);
process.exit(fail > 0 ? 1 : 0);
