// ============================================================
// TESTS DE NON-REGRESSION CLASSIFICATEURS FR PAR SECTEUR
// ------------------------------------------------------------
// Batterie de cas a risque figes apres l audit fragilite e2e du
// 25 mai 2026. Verifie que les classificateurs deterministes du
// pipeline ne retombent pas en saas-b2b silencieux quand le pitch
// est ecrit en francais sur un secteur non-logiciel (maritime,
// biotech, defense, climate, agritech). Verifie aussi que les
// fallbacks structurels (stage non reconnu, asset class non
// reconnue) remontent explicitement comme 'unknown' / 'unclassified'
// plutot que comme 'seed' / 'saas-b2b' par defaut.
//
// Doctrine. La presence de chaque cas dans cette suite est une
// promesse de stabilite : toute modification ulterieure des
// classificateurs qui re-introduit un fallback silencieux ou retire
// du vocabulaire FR cassera ces tests. C est volontaire.
//
// Execution : npx tsx lib/engines/classifier-fr-regression.test.ts
// ============================================================

import { computeRelevanceMatrix } from './relevance-matrix';
import { detectSectorSlugs } from './sectoral-injection-pure';
import {
  normalizeStage,
  normalizeAssetClass,
  getSectorMultiples,
} from '../data/sector-benchmarks';
import { getIndicatorBenchmarks } from '../data/indicator-benchmarks';
import type { ExtractionOutput } from './types';

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  PASS  ${label}`);
    pass++;
  } else {
    console.log(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    fail++;
  }
}

function checkTrue(label: string, cond: boolean) {
  if (cond) { console.log(`  PASS  ${label}`); pass++; }
  else { console.log(`  FAIL  ${label}`); fail++; }
}

// Helper pour construire une extraction minimale lisible.
function ext(partial: Partial<ExtractionOutput> & { sector: string }): ExtractionOutput {
  return {
    companyName: partial.companyName ?? 'TestCo',
    sector: partial.sector,
    subSector: partial.subSector ?? '',
    country: partial.country ?? 'France',
    geographicHub: partial.geographicHub ?? 'Paris',
    yearFounded: partial.yearFounded ?? 2022,
    founders: partial.founders ?? [],
    marketPitch: partial.marketPitch ?? '',
    productDescription: partial.productDescription ?? '',
    businessModel: partial.businessModel ?? '',
    traction: partial.traction ?? { metrics: [] },
    fundraise: partial.fundraise ?? { stage: 'seed', amount: '1M EUR' },
    competitorsCited: partial.competitorsCited ?? [],
    rawSummary: partial.rawSummary ?? '',
  } as ExtractionOutput;
}

// ============================================================
// SECTION 1. FALLBACKS STRUCTURELS EXPLICITES
// ------------------------------------------------------------
// normalizeStage et normalizeAssetClass NE DOIVENT PLUS retomber
// silencieusement sur 'seed' / 'saas-b2b'. Un libelle vide ou non
// reconnu remonte 'unknown' / 'unclassified'.
// ============================================================

console.log('\n=== Section 1. Fallbacks structurels explicites ===');

check('normalizeStage("") === unknown', normalizeStage(''), 'unknown');
check('normalizeStage(null) === unknown', normalizeStage(null), 'unknown');
check('normalizeStage("bridge") === unknown', normalizeStage('bridge'), 'unknown');
check('normalizeStage("tour intermediaire") === unknown', normalizeStage('tour intermediaire'), 'unknown');
check('normalizeStage("extension") === unknown', normalizeStage('extension'), 'unknown');
// Mais les libelles reconnus, FR comme EN, restent corrects.
check('normalizeStage("seed") === seed', normalizeStage('seed'), 'seed');
check('normalizeStage("Pre-Seed") === seed', normalizeStage('Pre-Seed'), 'seed');
check('normalizeStage("amorçage") === seed', normalizeStage('amorçage'), 'seed');
check('normalizeStage("Serie A") === series-a', normalizeStage('Serie A'), 'series-a');
check('normalizeStage("série B") === series-b', normalizeStage('série B'), 'series-b');
check('normalizeStage("Series A late") === series-a', normalizeStage('Series A late'), 'series-a');
check('normalizeStage("pre-B") === series-a', normalizeStage('pre-B'), 'series-a');
check('normalizeStage("Growth") === series-c-plus', normalizeStage('Growth'), 'series-c-plus');
check('normalizeStage("Capital de croissance") === series-c-plus', normalizeStage('Capital de croissance'), 'series-c-plus');

check('normalizeAssetClass("") === unclassified', normalizeAssetClass(''), 'unclassified');
check('normalizeAssetClass(null) === unclassified', normalizeAssetClass(null), 'unclassified');
check('normalizeAssetClass("inconnu zorglub") === unclassified', normalizeAssetClass('inconnu zorglub'), 'unclassified');

// getSectorMultiples et getIndicatorBenchmarks doivent retourner null
// sur unclassified / unknown, plus de fallback saas-b2b.
check('getSectorMultiples(unclassified, seed) === null', getSectorMultiples('inconnu', 'seed'), null);
check('getSectorMultiples(saas-b2b, bridge) === null', getSectorMultiples('saas-b2b', 'bridge'), null);
check('getIndicatorBenchmarks(unclassified, seed) === null', getIndicatorBenchmarks('unclassified', 'seed'), null);
check('getIndicatorBenchmarks(saas-b2b, unknown) === null', getIndicatorBenchmarks('saas-b2b', 'unknown'), null);
// Et un couple valide retourne bien un set non null.
checkTrue('getIndicatorBenchmarks(saas-b2b, seed) !== null', getIndicatorBenchmarks('saas-b2b', 'seed') !== null);

// ============================================================
// SECTION 2. VOCABULAIRE FR PAR SECTEUR
// ------------------------------------------------------------
// normalizeAssetClass et detectSectorSlugs reconnaissent les
// libelles FR sectoriels frequents.
// ============================================================

console.log('\n=== Section 2. Vocabulaire FR par secteur ===');

// Maritime / naval / nautique => industrial-hardware (Platypus)
check('normalizeAssetClass("Nautique") === industrial-hardware', normalizeAssetClass('Nautique'), 'industrial-hardware');
check('normalizeAssetClass("Construction navale") === industrial-hardware', normalizeAssetClass('Construction navale'), 'industrial-hardware');
check('normalizeAssetClass("Chantier naval") === industrial-hardware', normalizeAssetClass('Chantier naval'), 'industrial-hardware');
check('normalizeAssetClass("Maritime") === industrial-hardware', normalizeAssetClass('Maritime'), 'industrial-hardware');
check('normalizeAssetClass("Bateaux electriques") === industrial-hardware', normalizeAssetClass('Bateaux electriques'), 'industrial-hardware');

// Aerospatial / spatial / ferroviaire FR
check('normalizeAssetClass("Aéronautique") === industrial-hardware', normalizeAssetClass('Aéronautique'), 'industrial-hardware');
check('normalizeAssetClass("Aerospatial") === industrial-hardware', normalizeAssetClass('Aerospatial'), 'industrial-hardware');
check('normalizeAssetClass("Spatial") === industrial-hardware', normalizeAssetClass('Spatial'), 'industrial-hardware');
check('normalizeAssetClass("Ferroviaire") === logistics', normalizeAssetClass('Ferroviaire'), 'logistics');
check('normalizeAssetClass("Aviation civile") === logistics', normalizeAssetClass('Aviation civile'), 'logistics');

// Sante FR : sante / médecine / hôpital / clinique => healthtech
check('normalizeAssetClass("Santé") === healthtech', normalizeAssetClass('Santé'), 'healthtech');
check('normalizeAssetClass("Médecine") === healthtech', normalizeAssetClass('Médecine'), 'healthtech');
check('normalizeAssetClass("Hôpital") === healthtech', normalizeAssetClass('Hôpital'), 'healthtech');
check('normalizeAssetClass("Clinique") === healthtech', normalizeAssetClass('Clinique'), 'healthtech');
check('normalizeAssetClass("Transport sanitaire") === healthtech', normalizeAssetClass('Transport sanitaire'), 'healthtech');

// Defense FR
check('normalizeAssetClass("Défense") === defense', normalizeAssetClass('Défense'), 'defense');
check('normalizeAssetClass("Militaire") === defense', normalizeAssetClass('Militaire'), 'defense');

// Climate / énergie FR (incluant EMR)
check('normalizeAssetClass("Énergie") === climate-tech', normalizeAssetClass('Énergie'), 'climate-tech');
check('normalizeAssetClass("Énergies renouvelables") === climate-tech', normalizeAssetClass('Énergies renouvelables'), 'climate-tech');
check('normalizeAssetClass("Énergies marines") === industrial-hardware', normalizeAssetClass('Énergies marines'), 'industrial-hardware');
check('normalizeAssetClass("EMR") === industrial-hardware', normalizeAssetClass('EMR'), 'industrial-hardware');
check('normalizeAssetClass("Transition énergétique") === climate-tech', normalizeAssetClass('Transition énergétique'), 'climate-tech');

// Agritech / foodtech FR
check('normalizeAssetClass("Agriculture") === foodtech', normalizeAssetClass('Agriculture'), 'foodtech');
check('normalizeAssetClass("Agroalimentaire") === foodtech', normalizeAssetClass('Agroalimentaire'), 'foodtech');
check('normalizeAssetClass("Aquaculture") === foodtech', normalizeAssetClass('Aquaculture'), 'foodtech');
check('normalizeAssetClass("Pisciculture") === foodtech', normalizeAssetClass('Pisciculture'), 'foodtech');
check('normalizeAssetClass("Viticulture") === foodtech', normalizeAssetClass('Viticulture'), 'foodtech');

// Fintech FR
check('normalizeAssetClass("Banque") === fintech', normalizeAssetClass('Banque'), 'fintech');
check('normalizeAssetClass("Paiement") === fintech', normalizeAssetClass('Paiement'), 'fintech');
check('normalizeAssetClass("Assurance") === fintech', normalizeAssetClass('Assurance'), 'fintech');

// ============================================================
// SECTION 3. ROUTAGE SECTORIEL detectSectorSlugs
// ------------------------------------------------------------
// Construction navale FR DOIT ressortir en industrie-hardware en
// premier, plus en mobilite-logistique (cas Platypus). 'maritime'
// a ete retire de mobilite-logistique et place dans
// industrie-hardware.
// ============================================================

console.log('\n=== Section 3. Routage sectoriel slugs ===');

const platypusSlugs = detectSectorSlugs(ext({
  sector: 'Nautique',
  subSector: 'Construction navale',
  productDescription: 'Navires submersibles innovants pour exploration maritime cotiere. Chantier naval France.',
}));
check('detectSectorSlugs(Construction navale) primary === industrie-hardware', platypusSlugs[0], 'industrie-hardware');

const aquacultureSlugs = detectSectorSlugs(ext({
  sector: 'Agritech',
  subSector: 'Aquaculture',
  productDescription: 'Plateforme de pisciculture en circuit ferme.',
}));
check('detectSectorSlugs(Aquaculture) primary === agritech-foodtech', aquacultureSlugs[0], 'agritech-foodtech');

const ehpadSlugs = detectSectorSlugs(ext({
  sector: 'Santé',
  subSector: 'EHPAD',
  productDescription: 'Etablissement medico-social pour personnes agees dependantes. Agrement ARS.',
}));
check('detectSectorSlugs(EHPAD) primary === sante-biotech', ehpadSlugs[0], 'sante-biotech');

const emrSlugs = detectSectorSlugs(ext({
  sector: 'Énergies marines',
  subSector: 'EMR',
  productDescription: 'Production d energie hydrolienne en zone cotiere atlantique.',
}));
check('detectSectorSlugs(EMR/hydrolien) primary === climat-energie', emrSlugs[0], 'climat-energie');

const armementSlugs = detectSectorSlugs(ext({
  sector: 'Armement',
  subSector: 'Defense',
  productDescription: 'Equipement pour les forces armees francaises, partenariat MBDA et Naval Group.',
}));
check('detectSectorSlugs(Armement) primary === cybersecurite-defense', armementSlugs[0], 'cybersecurite-defense');

// ============================================================
// SECTION 4. MATRICE DE PERTINENCE PAR SECTEUR FR
// ------------------------------------------------------------
// Six cas types figes : hardware maritime, biotech, defense,
// climate/EMR, agritech, fintech. Chacun verifie que
// computeRelevanceMatrix sort la bonne asset class et la bonne
// productionChain. Si quelqu un re-introduit un fallback silencieux,
// au moins un de ces cas casse.
// ============================================================

console.log('\n=== Section 4. Matrice de pertinence par secteur FR ===');

// ----- Hardware maritime FR (Platypus-like) -----
const platypusMatrix = computeRelevanceMatrix(ext({
  companyName: 'Platypus Craft',
  sector: 'Nautique',
  subSector: 'Construction navale innovante',
  marketPitch: 'Nous concevons et fabriquons des navires submersibles legers pour l exploration sous-marine cotiere et le foilboard motorise.',
  productDescription: 'Navire semi-submersible bi-place avec propulsion electrique marine. Fabrication serie limitee dans notre chantier naval France. Composants electroniques embarques pour la navigation et le suivi en temps reel.',
  businessModel: 'Vente unitaire de bateaux. Marge par navire structurelle.',
  rawSummary: 'Le projet industriel Platypus Craft conjugue ingenierie hydrodynamique, propulsion electrique et electronique embarquee. La production s appuie sur un chantier naval francais avec une ligne d assemblage dediee aux semi-submersibles. La chaine de production est entierement physique : coque composite, propulsion marine, capteurs embarques. L objectif est de produire trois cents unites annuelles dans les cinq ans avec un capex outillage limite.',
}), 'Nautique Construction navale innovante');
check('Platypus assetClass === industrial-hardware', platypusMatrix.assetClass, 'industrial-hardware');
check('Platypus productionChain === hardware-physical', platypusMatrix.productionChain, 'hardware-physical');
checkTrue('Platypus businessModel != recurrent-saas', platypusMatrix.businessModel !== 'recurrent-saas');

// ----- Biotech FR -----
const biotechMatrix = computeRelevanceMatrix(ext({
  companyName: 'NovaTher',
  sector: 'Biotechnologie',
  subSector: 'Therapeutique cellulaire',
  marketPitch: 'Developpement de molecules therapeutiques pour le traitement des cancers rares.',
  productDescription: 'Programme de drug discovery sur cibles validees. Essais cliniques phase I en cours. Laboratoire wet lab a Paris.',
  businessModel: 'Out-licensing aux laboratoires pharmaceutiques. Royalties sur ventes finales.',
  rawSummary: 'NovaTher est une biotechnologie francaise specialisee dans le developpement de therapies innovantes pour les cancers rares. Le programme principal repose sur une molecule originale en phase I d essai clinique multicentrique. Le laboratoire dispose de salles wet lab equipees, d une plateforme de criblage et d une bioteque proprietaire. Les fondateurs viennent de l Inserm et de l Institut Curie. La strategie commerciale repose sur un partenariat avec un grand laboratoire pharmaceutique a partir de la phase II, avec un schema classique de royalties sur les ventes futures du medicament autorise.',
  fundraise: { stage: 'series-a', amount: '15M EUR' },
}), 'Biotechnologie Therapeutique cellulaire');
check('Biotech productionChain === wet-biotech', biotechMatrix.productionChain, 'wet-biotech');
checkTrue('Biotech assetClass in [healthtech, deeptech]', ['healthtech', 'deeptech'].includes(biotechMatrix.assetClass));

// ----- Defense FR -----
const defenseMatrix = computeRelevanceMatrix(ext({
  companyName: 'EuroShield',
  sector: 'Défense',
  subSector: 'Systeme de contre-drone',
  marketPitch: 'Systeme integre de detection et neutralisation des drones hostiles pour les forces armees et la gendarmerie.',
  productDescription: 'Hardware radar plus logiciel de fusion de donnees. Production en serie en partenariat avec MBDA et Thales. Soumission aux export controls dual-use.',
  businessModel: 'Vente sur appels d offres publics DGA et armees alliees. Contrats pluriannuels.',
  rawSummary: 'EuroShield developpe une technologie radar coherente couplee a un logiciel de fusion de donnees pour identifier et neutraliser les drones hostiles. Les premiers contrats sont avec la DGA francaise et trois ministeres alliees europeens. La fabrication des composants radar se fait en France sur un site industriel proprietaire avec une chaine d assemblage et un banc de calibration. Le systeme est soumis aux export controls dual-use europeens. Le carnet de commandes signe a fin 2025 represente cinquante millions d euros sur trois ans, avec quatre tranches de livraison reparties par exercice budgetaire.',
  fundraise: { stage: 'series-b', amount: '40M EUR' },
  country: 'France',
}), 'Défense Systeme de contre-drone');
check('Defense assetClass === defense', defenseMatrix.assetClass, 'defense');
check('Defense productionChain === hardware-physical', defenseMatrix.productionChain, 'hardware-physical');
checkTrue('Defense geopolitical exposure full', defenseMatrix.verdicts.macroGeopolitical.applicable === 'full');

// ----- Climate / énergie FR (EMR / hydrolien) -----
const emrMatrix = computeRelevanceMatrix(ext({
  companyName: 'OceanFlow',
  sector: 'Énergies marines',
  subSector: 'Hydrolien',
  marketPitch: 'Production d energie hydrolienne par turbines installees en zone cotiere atlantique.',
  productDescription: 'Conception et exploitation de fermes hydroliennes offshore. Genie maritime, infrastructure physique sur fond marin.',
  businessModel: 'Vente d electricite aux operateurs reseau via contrats long terme. Modele projet par projet.',
  rawSummary: 'OceanFlow exploite une technologie hydrolienne mature avec deux fermes pilotes installees en Bretagne et une troisieme en construction sur le littoral atlantique. Les infrastructures sont posees sur fond marin avec un genie maritime sous-marin specialise. Les contrats sont negocies projet par projet avec les operateurs de reseau et les collectivites cotieres. La filiere energies marines renouvelables francaise beneficie d un cadre reglementaire stabilise mais d un cycle de developpement long, typique des infrastructures lourdes. Capex moyen par projet quatre-vingts millions d euros, avec un retour sur investissement attendu a quinze ans.',
  fundraise: { stage: 'series-b', amount: '50M EUR' },
}), 'Énergies marines Hydrolien');
checkTrue('EMR assetClass in [industrial-hardware, climate-tech]', ['industrial-hardware', 'climate-tech'].includes(emrMatrix.assetClass));
check('EMR productionChain === infrastructure-physical', emrMatrix.productionChain, 'infrastructure-physical');

// ----- Agritech FR (aquaculture) -----
const aquacultureMatrix = computeRelevanceMatrix(ext({
  companyName: 'AquaBleu',
  sector: 'Aquaculture',
  subSector: 'Pisciculture en circuit ferme',
  marketPitch: 'Production de poissons d eau douce en circuit ferme avec recirculation. Reduction de l empreinte environnementale par rapport a l elevage traditionnel.',
  productDescription: 'Fermes aquacoles avec bassins industriels en circuit ferme. Equipement de filtration et de recirculation. Production en serie de saumons et truites.',
  businessModel: 'Vente B2B aux distributeurs et grandes surfaces. Modele vente unitaire de poissons par tonnage.',
  rawSummary: 'AquaBleu deploie en France une filiere aquacole moderne en circuit ferme avec recirculation de l eau, dans des installations industrielles dimensionnees pour quinze mille tonnes annuelles. Le procede d elevage est entierement traceable et certifie. Les commandes des grandes surfaces et grossistes francais constituent la principale source de revenu, avec une diversification europeenne en cours. Les CAPEX par site industriel sont substantiels, avec un payback usine estime a sept ans en regime de croisiere. Le secteur de l aquaculture francaise est en pleine recomposition reglementaire et industrielle.',
  fundraise: { stage: 'series-a', amount: '12M EUR' },
}), 'Aquaculture Pisciculture');
check('Aquaculture assetClass === foodtech', aquacultureMatrix.assetClass, 'foodtech');

// ----- Fintech FR -----
const fintechMatrix = computeRelevanceMatrix(ext({
  companyName: 'NeoPaiement',
  sector: 'Fintech',
  subSector: 'Paiement B2B',
  marketPitch: 'Solution de paiement instantane pour les PME francaises avec agrement ACPR.',
  productDescription: 'Plateforme SaaS B2B avec API de paiement, gestion des flux, reporting comptable. Agrement etablissement de paiement.',
  businessModel: 'Abonnement B2B mensuel HT par utilisateur, plus commission sur volume traite. ARR cible 20M EUR a 3 ans.',
  rawSummary: 'NeoPaiement opere comme etablissement de paiement agree ACPR et fournit aux PME francaises une plateforme SaaS B2B de paiement instantane avec API ouverte. Le modele combine un abonnement par utilisateur, facture en HT par mois, et une commission sur le volume de paiement traite. La base installee depasse deux mille PME francaises avec un ARR consolide de douze millions d euros et une croissance organique trimestrielle de quinze pourcent. Le pricing est cale sur les pratiques B2B standards : engagement annuel avec discount progressif, multi-utilisateurs par siege.',
  fundraise: { stage: 'series-b', amount: '30M EUR' },
}), 'Fintech Paiement B2B');
check('Fintech assetClass === fintech', fintechMatrix.assetClass, 'fintech');
check('Fintech productionChain === pure-software', fintechMatrix.productionChain, 'pure-software');
check('Fintech businessModel === recurrent-saas', fintechMatrix.businessModel, 'recurrent-saas');

// ============================================================
// SECTION 5. DURCISSEMENT detectProductionChain
// ------------------------------------------------------------
// Le mot 'application' seul ne suffit plus a basculer en
// pure-software. Il doit etre qualifie (mobile, web, saas) ou
// accompagne d un signal SaaS canonique.
// ============================================================

console.log('\n=== Section 5. Durcissement detectProductionChain ===');

const appIndustrielleMatrix = computeRelevanceMatrix(ext({
  companyName: 'IndustrieTest',
  sector: 'Industrie',
  subSector: 'Equipement',
  marketPitch: 'Application industrielle pour les usines manufacturieres.',
  productDescription: 'Machine industrielle dediee aux applications industrielles lourdes. Fabrication serie limitee.',
  businessModel: 'Vente unitaire machine.',
  rawSummary: 'Application industrielle dediee aux operations de manufacturing. La gamme est dediee aux applications industrielles dans les usines manufacturieres francaises et europeennes. Fabrication serie limitee dans notre usine francaise avec une ligne de production dediee. Les composants electroniques et mecaniques sont sources en Europe pour reduire les delais. La gamme produit cible les usines manufacturieres de taille moyenne avec un capex industriel maitrise et un parcours de mise en service rapide.',
}), 'Industrie Equipement');
checkTrue(
  'application industrielle seule ne bascule plus en pure-software',
  appIndustrielleMatrix.productionChain !== 'pure-software',
);

// ============================================================
// SECTION 6. VERIFICATION PIPELINE INDICATEURS / VALUATION
// ------------------------------------------------------------
// Verifie qu un dossier industrial-hardware FR ressort des
// indicateurs SaaS neutralises, pas note contre les seuils
// burn multiple par defaut. Et qu un dossier sans stage reconnu
// ressort sans valorisation calculee.
// ============================================================

console.log('\n=== Section 6. Indicateurs et valuation respectent unclassified / unknown ===');

// Cas industrial-hardware : benchmarks specifiques industriels existent
// pour tous les stages (calibres TPL_HARDWARE_SERIES_A). Le point clef
// est qu un dossier industrial-hardware ne tombe PAS sur les seuils
// saas-b2b (ce qui etait le bug Platypus). On verifie que les seuils
// retournes ne sont pas ceux de saas-b2b.
const hardwareSeed = getIndicatorBenchmarks('industrial-hardware', 'seed');
const saasSeed = getIndicatorBenchmarks('saas-b2b', 'seed');
checkTrue(
  'getIndicatorBenchmarks(industrial-hardware, seed) !== null',
  hardwareSeed !== null,
);
checkTrue(
  'industrial-hardware seed seuils != saas-b2b seed seuils (pas de fallback silencieux)',
  hardwareSeed !== null && saasSeed !== null
    && JSON.stringify(hardwareSeed) !== JSON.stringify(saasSeed),
);
// Sur deeptech series-a, benchmarks specifiques existent.
checkTrue(
  'getIndicatorBenchmarks(deeptech, series-a) !== null',
  getIndicatorBenchmarks('deeptech', 'series-a') !== null,
);
// Et un asset class jamais defini dans INDICATOR_BENCHMARKS retourne
// bien null plutot que de fallback sur saas-b2b. Cas Platypus archetypal
// avant le fix : un assetClass non couvert sortait avec les seuils SaaS.
checkTrue(
  'getIndicatorBenchmarks("inexistant-asset-class", series-a) === null',
  getIndicatorBenchmarks('inexistant-asset-class', 'series-a') === null,
);

// ============================================================
// FIN
// ============================================================

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
