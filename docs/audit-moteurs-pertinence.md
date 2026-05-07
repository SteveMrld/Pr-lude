# Audit des moteurs et matrice de pertinence

Document d'audit produit en amont du chantier de polymorphisme des moteurs Prélude. Recense le périmètre actuel, identifie les moteurs qui produisent un signal décalibré faute de conditionnement, et propose une architecture cible centralisée.

## Doctrine

Un moteur d'instruction n'est pas neutre. Quand il tourne aveuglément sur un dossier dont le modèle économique ou la structure de production n'appellent pas son cadre d'analyse, il produit un résultat parasite qui décrédibilise la note auprès du partner et brouille la lecture du verdict. La règle qu'on applique à partir de maintenant est simple : chaque moteur doit pouvoir se déclarer applicable, partiellement applicable, ou non applicable, à partir de critères structurels du dossier, et non d'une liste fermée d'exemples.

Critères structurels : asset class, modèle business (récurrent, unitaire, contrat, projet, service à l'acte), chaîne de production (logiciel pur, hardware lourd, infrastructure, biotech humide, services réglementés, contenu), exposition supply chain (composants critiques, dépendances géographiques, soumission export controls), exposition macroéconomique (sensibilité au pouvoir d'achat, à la conjoncture, aux taux), exposition géopolitique (présence opérationnelle, marchés export, routes commerciales, matières stratégiques), reproductibilité numérique (nature physique du produit, protections réglementaires, données propriétaires).

Pas de pattern matching sur libellés. Le moteur cherche les briques structurelles qui justifient son activation. Tesla et la voiture connectée sont une instance d'un schéma plus large d'exposition aux semi-conducteurs, pas le périmètre du détecteur.

## Inventaire des moteurs Bloc 1

Les moteurs ci-dessous sont appelés depuis `app/api/analyze/route.ts` dans le pipeline d'instruction. Sont exclus de cet audit les moteurs DD (Bloc 2) et les moteurs auxiliaires (validation, source-tagging, editorial-voice).

| Moteur | Mission | Mode d'activation actuel | Statut |
|---|---|---|---|
| extraction-engine | Lecture initiale du pitch | Always-on, mission centrale | Sain |
| prescan-engine | Pré-screening rapide | Always-on optionnel | Sain |
| team-engine | Analyse équipe | Always-on | Sain |
| market-engine | Analyse marché et concurrence | Always-on | Problématique sur le sous-bloc IA-replicability |
| macro-engine | Analyse macro et géopolitique | Always-on | Problématique sur géopolitique non conditionnée |
| financial-extraction-engine | Extraction données financières | Always-on | Sain |
| financial-coherence-engine | Cohérence financière | Always-on | Sain |
| tech-claim-coherence-engine | Cohérence technique | Always-on | Sain |
| saas-metrics-engine | NDR, Magic Number, unit economics | Conditionnel (court-circuit hardware/manufactur/media) | Sain mais détecteur perfectible |
| indicators-engine | Sept KPI deal type | Conditionnel via benchmarks par asset class | Partiellement sain : Payback CAC reste actif sur dossiers non SaaS |
| valuation-engine | Fourchette de valorisation | Always-on | Sain depuis fix asset class français |
| comparables-engine | Comparables sectoriels | Always-on | Sain |
| pattern-engine | Cas du corpus, proximité structurelle | Always-on, présélection top-8 | Sain |
| blindspot-engine | Dix patterns d'erreur d'instruction | Always-on | Sain par construction (les patterns sont universels) |
| contrarian-engine | Signaux contrariens | Always-on | Sain |
| execution-friction-engine | Friction exécution commerciale et industrielle | Conditionnel via détection de huit flags | Modèle de référence pour le polymorphisme |
| benchmark-engine | Récupération benchmarks externes | Always-on | Sain |
| assertion-validator | Validation des assertions | Always-on | Sain |

## Diagnostics par moteur problématique

### macro-engine, sous-bloc géopolitique

Le moteur macro produit aujourd'hui une lecture cyclique consolidée (régime de taux, position de cycle, géopolitique, capital VC, demande) en s'appuyant sur des données World Bank fetchées en temps réel (PIB, inflation, taux d'intérêt réel, R&D, FDI). Le sous-bloc géopolitique est demandé au LLM pour tous les dossiers, qu'il y ait ou non exposition.

Conséquence sur les dossiers ultra-locaux : la note imprime un commentaire géopolitique générique (post-Ukraine, post-PSD2, tensions Moyen-Orient) qui n'a aucune valeur informative pour le partner et qui suggère une rigueur qu'il n'y a pas.

Correction proposée. Le moteur macro reçoit en entrée un verdict d'exposition géopolitique calculé par la matrice de pertinence à partir des critères structurels suivants : composants critiques détectés (semi-conducteurs avancés, batteries, terres rares, biens à double usage), dépendances géographiques concentrées (sourcing, manufacturing, marchés export), soumission aux régimes d'export controls, intensité énergétique avec dépendance aux hydrocarbures, logistique passant par les détroits stratégiques, présence opérationnelle dans des zones à risque pays. Selon le verdict, le moteur produit soit un commentaire géopolitique calibré sur les expositions identifiées, soit un commentaire court qui acte la non-exposition significative.

### market-engine, sous-bloc aiReplicability

Le sous-bloc `defensibility.aiReplicability` est demandé pour tous les dossiers. Le prompt LLM demande d'évaluer si un solo founder avec Cursor et Claude Code peut reproduire le produit, et liste les composants reproductibles. Sur un dossier hardware physique (Platypus, AIRARO, drones unitaires, biotech humide), la question n'a pas de sens : aucune IA ne va couler une conduite à 900m de profondeur ni passer une certification CE Marine.

Le moteur a déjà une notion partielle de pertinence via `aiBusinessModel.classification = not_applicable`, mais cette voie ne désactive pas `aiReplicability` qui reste un bloc obligatoire.

Correction proposée. La matrice de pertinence calcule un score de reproductibilité numérique à partir de la nature du produit. Pour les dossiers à dominante hardware, infrastructure physique, biotech humide, services réglementés à barrière humaine forte, le moteur reçoit un verdict "non applicable" sur la couche AI-replicability et le signale dans la note avec un rationnel structurel (ce qui ralentit la réplication n'est pas le code, c'est la chaîne physique). Pour les dossiers hybrides, on demande au moteur de scoper sa réponse : la couche software et la couche dashboard sont reproductibles, le coeur physique ne l'est pas, et on calibre le poids de la menace dans le score global en proportion.

### indicators-engine, Payback CAC

Le moteur indicators-engine désactive déjà NDR et Magic Number sur les dossiers hardware via les benchmarks (TPL_HARDWARE n'a ni NDR ni Magic Number dans ses thresholds). Mais Payback CAC reste actif sur tous les asset class qui ont un benchmark Payback CAC, y compris industrial-hardware. Sur AIRARO, le moteur indicators-engine est aujourd'hui silencieux faute de CAC dans le BP, mais sur un dossier hardware avec un coût marketing déclaré, le moteur sortirait un Payback CAC qui n'a pas de sens sur un modèle SPV par projet.

Correction proposée. Soit retirer Payback CAC de TPL_HARDWARE et TPL_DEEPTECH (cohérent avec NDR et Magic Number déjà absents), soit conditionner via la matrice de pertinence sur le critère "modèle d'acquisition à funnel marketing" plutôt que sur l'asset class. La deuxième solution est plus robuste parce qu'un asset class comme deeptech peut couvrir des modèles très différents (deeptech IA SaaS vs deeptech infrastructure).

### Indicateurs alternatifs pour modèles industriels

Le set des sept KPI canoniques (Burn multiple, Rule of 40, NDR, Magic Number, Payback CAC, Marge brute, Revenue par employé) est pertinent pour un SaaS B2B classique. Pour un fabricant de semi-submersibles (Platypus), un infrastructurier énergie marine (AIRARO), un fabricant de drones à vente unitaire, ces KPI sont structurellement non applicables ou pauvres en signal. Le moteur affiche aujourd'hui "0/7 calculables" et un score neutre, ce qui est honnête mais donne l'impression d'une cécité.

Correction proposée. Pour les modèles à fabrication unitaire ou à vente par projet, indicators-engine produit un set alternatif. Métriques candidates : marge brute par unité vendue, cycle commercial moyen en mois, carnet de commandes en multiple de revenue annualisé, working capital ratio, capex par projet en pourcentage du revenue projet, capacité industrielle annuelle, taux de gain sur appels d'offre soumis, intensité capitalistique. Le set est sélectionné via la matrice de pertinence à partir du modèle business détecté. Le score d'exécution opérationnelle reste calculé sur la même base (best-in-class +20, etc.) avec les nouveaux indicateurs.

### saas-metrics-engine, détecteur d'asset class non récurrent

Le moteur saas-metrics court-circuite l'extraction LLM sur les libellés `mediatech`, `media classique`, `hardware`, `manufactur`. Bonne base mais détecteur perfectible : il rate les libellés français (`fabrication`, `industrialisation`, `infrastructure marine`), il rate les modèles services à l'acte (consulting, agence, prestation), et il ne distingue pas un service récurrent d'un service à l'acte. La matrice de pertinence centralisera ce raisonnement.

## Manques structurels

### FMI World Economic Outlook et indicateurs de pouvoir d'achat

Le moteur macro consomme World Bank en temps réel mais ne consomme pas le FMI WEO ni les indicateurs spécifiques de pouvoir d'achat consommateur. Pour les dossiers sensibles à la conjoncture (DTC consumer milieu de gamme, retail, hospitality, marketplace B2C, formation grand public, services discrétionnaires), c'est un manque structurel. La trajectoire de croissance projetée et les projections d'inflation à 24-36 mois sont des signaux que la note ignore aujourd'hui.

Données à intégrer : projections de croissance PIB par pays clés du dossier, projections d'inflation, taux directeurs forward, indices de confiance consommateur OCDE, taux d'épargne des ménages, indices de pouvoir d'achat. Sources publiques : FMI WEO, Banque mondiale Global Economic Prospects, OCDE Consumer Confidence Index, Eurostat HICP.

Activation. Le nouveau moteur ou l'extension de macro-engine est conditionnée par la matrice de pertinence sur le critère "sensibilité macroéconomique du modèle business". Un B2B SaaS verticalisé en santé reçoit un verdict d'exposition faible. Une marque DTC consumer reçoit un verdict élevé et la note intègre les projections.

### Détecteur d'exposition supply chain

Le moteur géopolitique consomme aujourd'hui le LLM sans signal structuré préalable sur l'exposition supply chain. Il manque un détecteur déterministe qui identifie les composants critiques mentionnés dans le pitch et le BP (semi-conducteurs avancés, batteries lithium-ion, terres rares, métaux stratégiques, composants soumis à export controls), les pays sources concentrés, l'intensité énergétique. Ce détecteur alimente la matrice de pertinence et conditionne l'activation des moteurs géopolitique et macro.

### Service de matrice de pertinence

C'est le manque structurel le plus important. Aujourd'hui, chaque moteur traite (ou ignore) sa pertinence en interne, dans son prompt LLM ou via une heuristique locale (execution-friction est la seule exception bien architecturée). Cette dispersion produit des incohérences et rend impossible une lecture globale de la pertinence du dossier.

## Doctrine technique : la matrice de pertinence

### Principe

Un service unique `lib/engines/relevance-matrix.ts` consomme l'extraction Bloc 1 et les sorties intermédiaires (team, market) et produit un verdict de pertinence par moteur sous la forme d'un dictionnaire {moteur -> {applicable: full | partial | none, weight: 0-1, scope: string[], rationale: string}}. Tous les moteurs deviennent consommateurs de cette matrice.

### Critères structurels calculés

Le service calcule huit critères structurels à partir des données disponibles :

1. **assetClass normalisé** : déjà fait par `normalizeAssetClass`, enrichi avec les ajouts français récents.
2. **businessModel** : recurrent-saas, unitary-sale, project-based, service-on-demand, marketplace, consumer-subscription, contract-b2g, hybrid.
3. **productionChain** : pure-software, hardware-physical, infrastructure-physical, wet-biotech, content-media, regulated-service.
4. **supplyChainExposure** : niveau global low / medium / high et liste des expositions concrètes (semiconductors, rare-earths, energy-fossil, maritime-logistics, export-controls, regulated-components).
5. **macroSensitivity** : low / medium / high, basé sur la dépendance au pouvoir d'achat consommateur, à la conjoncture business cycle, aux taux d'intérêt.
6. **geopoliticalExposure** : low / medium / high, basé sur présence opérationnelle dans zones à risque, marchés export sensibles, soumission export controls, intensité énergétique avec dépendance hydrocarbures.
7. **digitalReproducibility** : low / medium / high, basé sur la nature physique du produit, les protections réglementaires, la part software dans la value proposition.
8. **acquisitionFunnel** : present (CAC mesurable, marketing digital classique), b2b-sales-led (cycle long, account based, pas de CAC marketing), absent (pas d'acquisition à mesurer).

### Application par moteur

| Moteur | Critère pivot | Logique d'application |
|---|---|---|
| macro-engine, géopolitique | geopoliticalExposure, supplyChainExposure | none si low+low, partial avec scope si medium, full si high |
| macro-engine, conjoncture | macroSensitivity | none si low, partial si medium, full si high (+ FMI WEO si full) |
| market-engine, aiReplicability | digitalReproducibility | none si low, partial avec scope sur les couches reproductibles si medium, full si high |
| market-engine, aiBusinessModel | productionChain == pure-software ET asset class IA | full si oui, none sinon |
| indicators-engine, KPI SaaS | businessModel ∈ {recurrent-saas, consumer-subscription} | full si oui, none sinon |
| indicators-engine, KPI industriel | businessModel ∈ {unitary-sale, project-based, contract-b2g} | full si oui, none sinon |
| saas-metrics-engine, NDR/Magic Number | businessModel ∈ {recurrent-saas, consumer-subscription} | full si oui, none sinon |
| saas-metrics-engine, unit economics CAC | acquisitionFunnel == present | full si oui, none sinon |
| valuation-engine, méthode VC inverse | businessModel + stage | none au seed pre-revenue (déjà appliqué) |
| execution-friction-engine | déjà conditionnel | conserver le mécanisme actuel, l'aligner sur la matrice |
| pattern-engine | always-on | conserver, les patterns sont universels |
| blindspot-engine | always-on | conserver, les biais d'instruction sont universels |
| contrarian-engine | always-on | conserver |

### Structure de retour

```typescript
export interface RelevanceVerdict {
  applicable: 'full' | 'partial' | 'none';
  weight: number; // 0-1, contribution au score global
  scope: string[]; // sous-blocs activés si partial
  rationale: string; // pourquoi cette décision, lisible par le partner
}

export interface RelevanceMatrix {
  // Critères calculés
  assetClass: string;
  businessModel: BusinessModel;
  productionChain: ProductionChain;
  supplyChainExposure: ExposureLevel;
  macroSensitivity: ExposureLevel;
  geopoliticalExposure: ExposureLevel;
  digitalReproducibility: ExposureLevel;
  acquisitionFunnel: AcquisitionFunnel;
  // Verdicts par moteur ou sous-bloc
  verdicts: {
    macroGeopolitical: RelevanceVerdict;
    macroCyclical: RelevanceVerdict;
    marketAiReplicability: RelevanceVerdict;
    marketAiBusinessModel: RelevanceVerdict;
    indicatorsSaas: RelevanceVerdict;
    indicatorsIndustrial: RelevanceVerdict;
    saasMetricsRetention: RelevanceVerdict;
    saasMetricsUnitEconomics: RelevanceVerdict;
    valuationVcMethod: RelevanceVerdict;
    executionFriction: RelevanceVerdict;
    // Les always-on restent always-on
  };
}
```

## Plan d'action

### Étape 1, fondations

Créer `lib/engines/relevance-matrix.ts` qui calcule les huit critères structurels et produit la `RelevanceMatrix`. Le calcul est déterministe, pas d'appel LLM. Il consomme l'extraction Bloc 1 et applique des règles structurelles sur les libellés sectoriels, les keywords du pitch, les données financières disponibles. Ajouter des tests unitaires sur dix dossiers types représentant la diversité (SaaS B2B classique, DTC consumer, deeptech infrastructure, hardware unitaire, services réglementés, IA pure, biotech, marketplace, fintech, services à l'acte).

### Étape 2, branchement des moteurs problématiques

Brancher dans l'ordre d'impact :

1. **macro-engine** : géopolitique conditionnée + ajout module conjoncture FMI WEO pour dossiers à macroSensitivity high.
2. **market-engine, aiReplicability** : conditionné par digitalReproducibility, scopé sur les couches reproductibles en cas de partial.
3. **indicators-engine** : Payback CAC conditionné par acquisitionFunnel, set d'indicateurs alternatifs pour les businessModel industriels.
4. **saas-metrics-engine** : court-circuit harmonisé avec la matrice de pertinence plutôt que la liste de keywords actuelle.

### Étape 3, métriques industrielles

Définir le set d'indicateurs industriels et leurs benchmarks par stade. Sources sectorielles : Argos Index pour les multiples EBITDA PME, BCG / McKinsey rapports industriels pour les ratios cycle commercial et carnet de commandes, observatoires sectoriels (CESI marine, France Industrie pour la fabrication). Ajouter dans `lib/data/indicator-benchmarks.ts` un nouveau set TPL_INDUSTRIAL_PROJECT_BASED.

### Étape 4, intégration FMI

Étendre `lib/data-fetchers/sources.ts` avec un fetcher FMI WEO. L'API publique FMI WEO Database expose les projections de croissance et d'inflation par pays et par horizon. Cache trimestriel pour ne pas dépendre du réseau à chaque appel. Brancher dans macro-engine sous la condition macroSensitivity ∈ {medium, high}.

### Étape 5, observabilité

La matrice de pertinence est imprimée dans le resultJson de l'analyse, et la note d'investissement affiche un encart "Périmètre d'analyse" qui liste les moteurs activés, partiellement activés, désactivés, avec le rationnel structurel. Le partner voit immédiatement quel cadre d'analyse a été appliqué et pourquoi.

### Livrable de chaque étape

Chaque étape produit un commit autonome qui passe les tests unitaires et le tsc. Les commits sont taggés `feat(relevance)` pour la matrice, `refactor(macro|market|indicators|saas-metrics)` pour les branchements, `feat(macro)` pour le module FMI WEO, `feat(indicators)` pour les métriques industrielles, `feat(note)` pour l'encart périmètre d'analyse.
