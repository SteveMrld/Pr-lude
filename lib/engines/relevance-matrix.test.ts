// ============================================================
// Tests unitaires de relevance-matrix
// ------------------------------------------------------------
// Couvre dix dossiers types representant la diversite d asset
// classes / modeles business / chaines de production. Pour chaque
// cas, on verifie les verdicts cles : indicatorsSaas applicable
// uniquement sur recurrent, aiReplicability conditionne par
// productionChain, geopolitique conditionnee par exposition
// concrete, etc.
//
// Execution : `node lib/engines/relevance-matrix.test.mjs`
// ============================================================

import { computeRelevanceMatrix } from './relevance-matrix';

const cases = [
  // ====================================================
  // 1. SaaS B2B classique : tout SaaS s applique
  // ====================================================
  {
    name: 'SaaS B2B legaltech FR',
    extraction: {
      companyName: 'LexCorp',
      sector: 'LegalTech',
      subSector: 'SaaS B2B',
      country: 'France',
      geographicHub: 'Paris',
      yearFounded: 2022,
      founders: [],
      marketPitch: 'SaaS B2B pour avocats. Abonnement mensuel. Notre ARR a triple en 12 mois.',
      productDescription: 'Plateforme cloud avec API. Gestion de dossiers, facturation, signature electronique. Integration avec les outils des cabinets.',
      businessModel: 'Subscription B2B SaaS, ACV 6000 EUR par avocat par an',
      traction: { metrics: [], revenue: '500K ARR' },
      fundraise: { stage: 'seed', amount: '2M EUR' },
      competitorsCited: [],
      rawSummary: 'Levee seed 2M EUR pour conquete commerciale. Acquisition par leadgen et inbound marketing. CAC 800 EUR par customer signe, taux de conversion mql 25%. La societe travaille sur le marche des cabinets d avocats independants en France, avec une promesse claire de gain de temps sur les taches recurrentes administratives et facturables. Les fondateurs viennent du droit, ont exerce comme avocats avant de pivoter vers la tech, et la roadmap produit reflete les frustrations identifiees pendant leurs annees en cabinet. Le pipeline commercial documente trente clients en discussion avancee. Marge brute logicielle structurelle proche de quatre-vingts pourcent. Concurrence directe limitee a deux acteurs francais, dont un seul avec une vraie traction commerciale recente. La proposition de valeur tient en trois points : reduction du temps administratif, conformite reglementaire automatisee, traçabilite client integree. Le marche adressable francais represente trente mille cabinets independants, avec une montee europeenne envisagee a horizon dix-huit mois. Le plan d embauche prevoit cinq commerciaux et trois ingenieurs sur l annee, structure autour d un sales-led classique adapte aux cycles courts du droit.',
    },
    expects: {
      businessModel: 'recurrent-saas',
      productionChain: 'pure-software',
      'verdicts.indicatorsSaas.applicable': 'full',
      'verdicts.indicatorsIndustrial.applicable': 'none',
      'verdicts.saasMetricsRetention.applicable': 'full',
      'verdicts.saasMetricsUnitEconomics.applicable': 'full',
      'verdicts.marketAiReplicability.applicable': 'full', // pure software sans gros moat = high reproducibility = applicable full
      'verdicts.macroGeopolitical.applicable': 'none',
      'verdicts.macroCyclical.applicable': 'none',
      'verdicts.narrativeDrift.applicable': 'partial', // stade seed = lecture instantanee uniquement
    },
    expectedReproducibility: 'high',
    expectedFunnel: 'present',
  },

  // ====================================================
  // 2. DTC consumer marque mode mixte (vente + abonnement)
  // ====================================================
  {
    name: 'DTC consumer marque mode FR',
    extraction: {
      companyName: 'GreenWear',
      sector: 'Mode',
      subSector: 'DTC consumer marque pret-a-porter durable',
      country: 'France',
      geographicHub: 'Paris',
      yearFounded: 2021,
      founders: [],
      marketPitch: 'Marque DTC consumer mode durable. Sourcing coton bio Inde et Pakistan, fabrication Portugal. Logistique maritime international vers nos entrepots Europe.',
      productDescription: 'Vetements pret-a-porter, abonnement box mensuelle option, vente unitaire principale. Cible 25-40 ans urbains.',
      businessModel: 'DTC consumer, vente unitaire et abonnement consumer optionnel. ACV moyen 180 EUR par client par an.',
      traction: { metrics: [], revenue: '2M' },
      fundraise: { stage: 'series-a', amount: '8M EUR' },
      competitorsCited: [],
      rawSummary: 'Acquisition payante via Meta ads et Google ads. CAC 45 EUR, taux de conversion 3%. Marge brute 55%. Strong dependance pouvoir d achat consumer. La marque a etabli sa promesse autour du sourcing responsable et de la traceabilite complete de la chaine de production, du coton bio recolte en Inde a la confection finale au Portugal. Les operations logistiques empruntent la voie maritime classique avec un partenaire armateur europeen, ce qui expose le compte d exploitation aux variations du fret international. Le retour client est mesure via NPS trimestriel et taux de retour produit. Le portefeuille produits compte cinquante references actives, renouvelees deux fois par an, avec des collections capsules pour les fetes. La cible commerciale est l urbain de vingt-cinq a quarante ans avec un pouvoir d achat moyen-superieur, sensible aux questions environnementales et a l origine ethique des materiaux. Les canaux d acquisition combinent paid social, contenu editorial et partenariats avec des micro-influenceurs lifestyle. La distribution est multicanal avec un site direct, deux pop-up stores parisiens et trois distributeurs select. Strategie de marque cohesive sur le ton et l esthetique.',
    },
    expects: {
      // Retail DTC vente unitaire dominante avec abonnement option
      // mineur. Le detecteur doit privilegier unitary-sale.
      businessModel: 'unitary-sale',
      'verdicts.macroCyclical.applicable': 'full', // exposition consumer + DTC
      'verdicts.macroGeopolitical.applicable': 'full', // 2 facteurs (logistique + Pakistan) = high → full
      'verdicts.saasMetricsUnitEconomics.applicable': 'full', // CAC funnel marketing
      'verdicts.narrativeDrift.applicable': 'full', // series-a = matiere narrative suffisante
    },
    expectedFunnel: 'present',
  },

  // ====================================================
  // 3. Deeptech infrastructure energie marine (AIRARO)
  // ====================================================
  {
    name: 'AIRARO deeptech energie marine',
    extraction: {
      companyName: 'AIRARO',
      sector: 'Energie',
      subSector: 'Energies Marines Renouvelables (SWAC et ETM)',
      country: 'France',
      geographicHub: 'Brest',
      yearFounded: 2020,
      founders: [],
      marketPitch: 'Leader mondial du SWAC et de l ETM. Infrastructure marine renouvelable, conduites PEHD a 900m profondeur. Marche public et semi-public.',
      productDescription: 'Genie maritime, conduites grandes profondeurs, echangeurs thermiques. Capex 8 a 55M EUR par projet. SPV par projet.',
      businessModel: 'Project-based via SPV. Appels d offres publics. Partenariats avec collectivites et EDF.',
      traction: { metrics: [] },
      fundraise: { stage: 'seed', amount: '3M EUR' },
      competitorsCited: [],
      rawSummary: 'Cycle commercial 24 mois. Marche public AMO MOE. Pas d acquisition marketing. Etudes amont vendues separement.',
    },
    expects: {
      // contract-b2g attendu (collectivites + EDF + appels d offres publics + ministere style)
      businessModel: 'contract-b2g',
      productionChain: 'infrastructure-physical',
      'verdicts.indicatorsSaas.applicable': 'none',
      'verdicts.indicatorsIndustrial.applicable': 'full',
      'verdicts.saasMetricsRetention.applicable': 'none',
      'verdicts.saasMetricsUnitEconomics.applicable': 'none',
      'verdicts.marketAiReplicability.applicable': 'none',
      'verdicts.macroGeopolitical.applicable': 'none',
      'verdicts.executionFriction.applicable': 'full',
    },
    expectedReproducibility: 'low',
    expectedFunnel: 'absent',
  },

  // ====================================================
  // 4. Hardware unitaire (Platypus type)
  // ====================================================
  {
    name: 'Platypus hardware semi-submersible',
    extraction: {
      companyName: 'Platypus',
      sector: 'Hardware maritime',
      subSector: 'Fabrication navires submersibles',
      country: 'France',
      geographicHub: 'Cherbourg',
      yearFounded: 2019,
      founders: [],
      marketPitch: 'Fabrication de semi-submersibles. Vente unitaire B2B et clients institutionnels. Cycle de fabrication 18 mois par bateau.',
      productDescription: 'Navires semi-submersibles pour exploration scientifique et commerciale. Hardware physique, prototype puis serie. Marge par bateau visee 35%.',
      businessModel: 'Fabrication-vente, vente unitaire, prix unitaire 8M EUR par bateau',
      traction: { metrics: [], customers: '3 commandes signees' },
      fundraise: { stage: 'series-a', amount: '15M EUR' },
      competitorsCited: [],
      rawSummary: 'Capacite industrielle 4 bateaux par an. Capex outillage 6M EUR. Carnet de commandes 3 unites. Prospects defense europeens.',
    },
    expects: {
      businessModel: 'unitary-sale',
      productionChain: 'hardware-physical',
      'verdicts.indicatorsSaas.applicable': 'none',
      'verdicts.indicatorsIndustrial.applicable': 'full',
      'verdicts.marketAiReplicability.applicable': 'none',
      'verdicts.executionFriction.applicable': 'full',
    },
    expectedReproducibility: 'low',
    expectedFunnel: 'b2b-sales-led',
  },

  // ====================================================
  // 5. Services réglementés (cabinet d avocats tech)
  // ====================================================
  {
    name: 'Cabinet d avocats tech reglemente',
    extraction: {
      companyName: 'JurisTech',
      sector: 'Services juridiques',
      subSector: 'Cabinet d avocats specialise tech',
      country: 'France',
      geographicHub: 'Paris',
      yearFounded: 2022,
      founders: [],
      marketPitch: 'Cabinet d avocats inscrit au barreau de Paris. Services de conseil juridique aux startups tech.',
      productDescription: 'Mission de conseil au temps passe et au forfait. Avocats salaries inscrits au barreau. Conformite reglementaire stricte.',
      businessModel: 'Service-on-demand, prestation sur mesure. Honoraires au temps passe.',
      traction: { metrics: [] },
      fundraise: { stage: 'seed', amount: '1M EUR' },
      competitorsCited: [],
      rawSummary: 'Acquisition par bouche a oreille et reseau. Pas de marketing digital. Cycle de vente court via networking.',
    },
    expects: {
      productionChain: 'regulated-service',
      businessModel: 'service-on-demand',
      'verdicts.marketAiReplicability.applicable': 'none',
      'verdicts.indicatorsSaas.applicable': 'none',
    },
    expectedReproducibility: 'low',
  },

  // ====================================================
  // 6. IA pure / wrapper LLM
  // ====================================================
  {
    name: 'AI productivity B2B wrapper Claude',
    extraction: {
      companyName: 'AIWrap',
      sector: 'AI productivity',
      subSector: 'AI generative B2B SaaS',
      country: 'France',
      geographicHub: 'Paris',
      yearFounded: 2023,
      founders: [],
      marketPitch: 'SaaS B2B AI native. Notre produit utilise OpenAI et Anthropic comme infrastructure LLM. Generative AI au coeur du produit.',
      productDescription: 'Plateforme cloud avec API. Foundation models en backend. Pas de fine-tuning custom. RAG simple.',
      businessModel: 'Subscription B2B SaaS, ACV 5K par client',
      traction: { metrics: [], revenue: '300K ARR' },
      fundraise: { stage: 'seed', amount: '2M EUR' },
      competitorsCited: [],
      rawSummary: 'Acquisition par leadgen et content marketing. CAC 600 EUR, taux conversion mql 20%. La proposition de valeur s appuie integralement sur les foundation models tiers, principalement OpenAI et Anthropic, branches via API standard. Le produit est un wrapper documente sur le marche generative AI, avec une couche metier minimale orientee productivite quotidienne en entreprise. Les fondateurs viennent du conseil en transformation digitale, ont monte la societe apres une experience commune chez un grand cabinet international. La cible commerciale est claire : ETI francaises, scale-ups, en deploiement de leur stack IA. Le pipeline contient cinquante prospects engages. La differenciation revendiquee porte sur la qualite des prompts metier integres, la securisation des donnees entreprise et l accompagnement humain du deploiement. La roadmap technique prevoit le branchement sur les modeles europeens souverains des qu ils seront commercialement disponibles avec un niveau de performance comparable. Le plan financier vise un break-even mois trente-six avec un million d ARR a ce moment. Les concurrents identifies sont europeens et americains, sans dominance encore etablie.',
    },
    expects: {
      productionChain: 'pure-software',
      businessModel: 'recurrent-saas',
      'verdicts.marketAiBusinessModel.applicable': 'full',
      'verdicts.marketAiReplicability.applicable': 'full', // high reproducibility = full applicabilite
      'verdicts.indicatorsSaas.applicable': 'full',
    },
    expectedReproducibility: 'high',
  },

  // ====================================================
  // 7. Biotech humide (medicament en developpement)
  // ====================================================
  {
    name: 'Biotech wet lab medicament',
    extraction: {
      companyName: 'CellLine',
      sector: 'Biotech',
      subSector: 'Drug discovery wet lab',
      country: 'France',
      geographicHub: 'Toulouse',
      yearFounded: 2020,
      founders: [],
      marketPitch: 'Biotech wet lab. Decouverte de molecules pour traiter les maladies orphelines. Phase II clinique en cours.',
      productDescription: 'Bioreacteur, culture cellulaire, essais cliniques phase II. Dispositif medical classe IIb en developpement parallele.',
      businessModel: 'Project-based, contrats de developpement avec pharma majors',
      traction: { metrics: [] },
      fundraise: { stage: 'series-b', amount: '40M EUR' },
      competitorsCited: [],
      rawSummary: 'Cycle developpement 5-7 ans. Validation FDA EMA requise. Aucun marketing direct.',
    },
    expects: {
      productionChain: 'wet-biotech',
      businessModel: 'project-based',
      'verdicts.marketAiReplicability.applicable': 'none',
      'verdicts.indicatorsSaas.applicable': 'none',
    },
    expectedReproducibility: 'low',
  },

  // ====================================================
  // 8. Marketplace B2C
  // ====================================================
  {
    name: 'Marketplace B2C achat seconde main',
    extraction: {
      companyName: 'ReUse',
      sector: 'Marketplace B2C',
      subSector: 'Place de marche objets seconde main',
      country: 'France',
      geographicHub: 'Paris',
      yearFounded: 2021,
      founders: [],
      marketPitch: 'Marketplace consumer pour objets seconde main. Take rate 12% sur GMV. Croissance forte 2024.',
      productDescription: 'Plateforme transactionnelle web et mobile. Network effect entre vendeurs et acheteurs. Modere activement les listings.',
      businessModel: 'Marketplace avec commission sur transaction. GMV 2024 50M EUR.',
      traction: { metrics: [] },
      fundraise: { stage: 'series-a', amount: '12M EUR' },
      competitorsCited: ['Vinted', 'Leboncoin'],
      rawSummary: 'Acquisition payante via Meta ads, Google ads, partenariats influenceurs. CAC 18 EUR par customer, conversion 8%.',
    },
    expects: {
      businessModel: 'marketplace',
      'verdicts.indicatorsSaas.applicable': 'partial',
      'verdicts.saasMetricsRetention.applicable': 'none',
      'verdicts.saasMetricsUnitEconomics.applicable': 'full',
      'verdicts.macroCyclical.applicable': 'full', // dependance consumer + marketplace
    },
  },

  // ====================================================
  // 9. Fintech lending B2B
  // ====================================================
  {
    name: 'Fintech lending B2B',
    extraction: {
      companyName: 'LendTech',
      sector: 'Fintech',
      subSector: 'Lending B2B',
      country: 'France',
      geographicHub: 'Paris',
      yearFounded: 2020,
      founders: [],
      marketPitch: 'Plateforme de lending B2B pour PME. Agrement ACPR. License banque cible 2026.',
      productDescription: 'API de credit scoring + plateforme de souscription. Donnees proprietaires sur les PME francaises.',
      businessModel: 'Marge sur interets + commissions. Subscription B2B optionnelle pour la plateforme.',
      traction: { metrics: [], revenue: '8M' },
      fundraise: { stage: 'series-b', amount: '30M EUR' },
      competitorsCited: ['October', 'Younited'],
      rawSummary: 'Sensibilite aux taux d interet directeurs. Acquisition par partenariats experts-comptables et leadgen B2B. La societe operationne depuis quatre ans avec une montee progressive du carnet de financements distribues aux entreprises, atteignant cent millions d euros cumules a fin 2025. Le coeur produit est un algorithme proprietaire de credit scoring entraine sur les donnees de paiement publiques et privees des PME francaises, avec un risque de defaut historique mesure trois pourcent en dessous de la moyenne sectorielle de reference. Les fondateurs viennent du capital-investissement et de la fintech britannique, et ont structure une equipe de douze personnes entre Paris et Londres. La license bancaire est en cours d instruction aupres de l ACPR, avec un calendrier prevu pour 2026 qui transformera l economie unitaire en captant la marge nette d interet plutot que seulement la commission d intermediation. Le pipeline contient deux cents PME en demande active de financement, avec une demande structurellement portee par les besoins de fonds de roulement et par la transition energetique des outils industriels detenus par les entreprises clientes.',
    },
    expects: {
      'verdicts.macroCyclical.applicable': 'partial', // sensibilite taux only
      'verdicts.indicatorsSaas.applicable': 'full', // detecte recurrent-saas
      'verdicts.marketAiReplicability.applicable': 'partial', // protections data + reglementation
      'verdicts.narrativeDrift.applicable': 'full', // series-b = derive narrative maximale
    },
    expectedReproducibility: 'medium',
  },

  // ====================================================
  // 10bis. SaaS vertical mobilite (Ambulife type) :
  // plateforme qui adresse le marche transport sanitaire sans en
  // exercer l activite. Doit sortir recurrent-saas + pure-software.
  // ====================================================
  {
    name: 'SaaS vertical mobilite sante FR (Ambulife type)',
    extraction: {
      companyName: 'MobiCare',
      sector: 'Sante',
      subSector: 'Transport medical / Mobilite medicale',
      country: 'France',
      geographicHub: 'Paris',
      yearFounded: 2024,
      founders: [],
      marketPitch: 'Plateforme numerique transversale qui facilite l acces aux services de transport medical. Reservation 24/7 de vehicules adaptes par patients et professionnels de sante.',
      productDescription: 'Plateforme de reservation BtoB et BtoBtoC pour transport sanitaire. Geolocalisation temps reel des vehicules. Systeme de gestion des flottes pour societes d ambulances et taxis conventionnes.',
      businessModel: 'Abonnement mensuel avec engagement sur 2 ans. 450 EUR HT/mois pour 1 a 5 vehicules, 1800 EUR HT/mois au-dela. Business recurrent et croissant.',
      traction: { metrics: ['ARPU 450 EUR HT/mois', 'engagement contractuel 24 mois'] },
      fundraise: { stage: 'seed', amount: '500K EUR' },
      competitorsCited: [],
      rawSummary: 'Plateforme transversale et nationale. BtoB principal, BtoBtoC pour les patients finaux.',
    },
    expects: {
      businessModel: 'recurrent-saas',
      productionChain: 'pure-software',
      'verdicts.indicatorsSaas.applicable': 'full',
    },
  },

  // ====================================================
  // 10ter. SaaS vertical hardware (gestion de flottes drones) :
  // adresse drones sans en fabriquer. Doit rester software.
  // ====================================================
  {
    name: 'SaaS gestion de flottes drones',
    extraction: {
      companyName: 'DroneOps',
      sector: 'Software B2B',
      subSector: 'SaaS gestion de flottes drones',
      country: 'France',
      geographicHub: 'Toulouse',
      yearFounded: 2022,
      founders: [],
      marketPitch: 'Plateforme SaaS pour operateurs de flottes de drones professionnels. Pilotage, planification, maintenance preventive.',
      productDescription: 'Application web et mobile, cloud, API. Geolocalisation drones, dashboard temps reel.',
      businessModel: 'SaaS B2B, abonnement HT/mois par drone connecte. ARPU 80 EUR HT/mois.',
      traction: { metrics: [] },
      fundraise: { stage: 'seed', amount: '2M EUR' },
      competitorsCited: [],
      rawSummary: 'Cible operateurs de drones professionnels (BTP, agriculture, securite). Modele asset-light, aucune operation matiere propre.',
    },
    expects: {
      businessModel: 'recurrent-saas',
      productionChain: 'pure-software',
    },
  },

  // ====================================================
  // 10. Voiture connectee (semi-conducteurs critique)
  // ====================================================
  {
    name: 'Voiture connectee electrique B2B',
    extraction: {
      companyName: 'AutoTech',
      sector: 'Mobilite electrique',
      subSector: 'Voiture connectee fleet B2B',
      country: 'France',
      geographicHub: 'Lyon',
      yearFounded: 2018,
      founders: [],
      marketPitch: 'Voitures connectees electriques pour flottes B2B. Sourcing semi-conducteurs Asie. Composants critiques chip puce SoC.',
      productDescription: 'Hardware vehicule + software embarque + dashboard cloud. Fabrication usine France, assemblage avec composants Taiwan.',
      businessModel: 'Vente unitaire des vehicules + abonnement B2B au dashboard.',
      traction: { metrics: [] },
      fundraise: { stage: 'series-c-plus', amount: '80M EUR' },
      competitorsCited: [],
      rawSummary: 'Exposition supply chain semi-conducteurs Taiwan critique. Sensibilite prix energie. Lithium-ion batterie. Logistique maritime depuis Asie. La gamme cible les flottes B2B operees par des gestionnaires de mobilite professionnelle, en location longue duree comme en propriete directe. Trois modeles industriels sont alignes sur la roadmap : compact urbain, utilitaire intermediaire, plateforme logistique. La fabrication se fait en France sur le site historique, avec un sous-assemblage realise dans une usine partenaire en Espagne pour les volumes de pre-serie. Le dashboard cloud associe propose telemetrie temps reel, maintenance predictive et reporting reglementaire pour les responsables flottes. Trois millions d euros de carnet de commandes signe. Le marche europeen represente quinze millions de vehicules en flottes professionnelles, en transition forcee vers l electrique sous l effet des reglementations zones a faibles emissions. La concurrence directe inclut deux constructeurs francais et un acteur allemand recent, ainsi qu une serie de startups americaines pre-commerciales. Le positionnement prix vise un cran sous les volumes europeens classiques avec un focus sur l adaptation aux usages reels. Les financements publics francais et europeens couvrent quarante pourcent du capex industriel cumule.',
    },
    expects: {
      productionChain: 'hardware-physical',
      businessModel: 'hybrid', // vente unitaire + abonnement
      'verdicts.macroGeopolitical.applicable': 'full',
      'verdicts.marketAiReplicability.applicable': 'none',
      'verdicts.executionFriction.applicable': 'full',
      'verdicts.narrativeDrift.applicable': 'full', // series-c-plus = derive narrative pleinement exploitable
    },
  },
];

// ============================================================
// EXECUTION
// ============================================================

let pass = 0, fail = 0;

function getDeep(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

for (const tc of cases) {
  console.log(`\n=== ${tc.name} ===`);
  const matrix = computeRelevanceMatrix(tc.extraction, tc.extraction.subSector || tc.extraction.sector);
  console.log(`  businessModel: ${matrix.businessModel}`);
  console.log(`  productionChain: ${matrix.productionChain}`);
  console.log(`  acquisitionFunnel: ${matrix.acquisitionFunnel}`);
  console.log(`  digitalReproducibility: ${matrix.digitalReproducibility} [${matrix.digitalReproducibilityFactors.join(', ')}]`);
  console.log(`  geopoliticalExposure: ${matrix.geopoliticalExposure} [${matrix.geopoliticalExposureFactors.join(', ')}]`);
  console.log(`  macroSensitivity: ${matrix.macroSensitivity} [${matrix.macroSensitivityFactors.join(', ')}]`);
  console.log(`  supplyChainExposure: ${matrix.supplyChainExposure} [${matrix.supplyChainExposureFactors.join(', ')}]`);

  for (const [path, expected] of Object.entries(tc.expects || {})) {
    const actual = getDeep(matrix, path);
    if (actual === expected) {
      console.log(`  PASS  ${path} = ${actual}`);
      pass++;
    } else {
      console.log(`  FAIL  ${path}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
      fail++;
    }
  }
  if (tc.expectedReproducibility) {
    if (matrix.digitalReproducibility === tc.expectedReproducibility) {
      console.log(`  PASS  digitalReproducibility = ${matrix.digitalReproducibility}`);
      pass++;
    } else {
      console.log(`  FAIL  digitalReproducibility: got ${matrix.digitalReproducibility}, expected ${tc.expectedReproducibility}`);
      fail++;
    }
  }
  if (tc.expectedFunnel) {
    if (matrix.acquisitionFunnel === tc.expectedFunnel) {
      console.log(`  PASS  acquisitionFunnel = ${matrix.acquisitionFunnel}`);
      pass++;
    } else {
      console.log(`  FAIL  acquisitionFunnel: got ${matrix.acquisitionFunnel}, expected ${tc.expectedFunnel}`);
      fail++;
    }
  }
}

console.log(`\n${pass}/${pass + fail} tests passes`);
process.exit(fail > 0 ? 1 : 0);
