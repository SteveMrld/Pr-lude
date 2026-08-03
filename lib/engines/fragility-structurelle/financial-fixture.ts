// ============================================================
// JEUX D ESSAI FINANCIERS CONFORMES AU CONTRAT
// ------------------------------------------------------------
// Les huit tests de patterns portaient chacun leur propre constante
// `MINIMAL_FIN = { revenue: 5000000, monthlyBurn: 200000 } as any`,
// six fois a l identique. Aucune de ces deux clefs n existe dans
// `FinancialDataExtraction`, et le `as any` empechait la compilation
// de le dire.
//
// C est la faute que la discipline des jeux d essai nomme : la fixture
// portait mon hypothese sur la forme des donnees au lieu de la lecture
// des donnees. Les tests passaient, ils prouvaient que le code faisait
// ce qu on lui demandait, et ils ne prouvaient pas qu on lui avait
// demande la bonne chose. En production le snapshot rendait `{}`.
//
// Les fixtures vivent donc ici, typees `FinancialDataExtraction` sans
// cast. Le controle de proprietes excedentaires de TypeScript refuse
// desormais toute clef inventee des la fixture, ce qui deplace la
// detection du run de production vers la compilation. C est le verrou,
// et il tient tant que personne ne reecrit `as any` devant.
//
// Les valeurs sont discriminantes au sens de la meme discipline :
// chacune est unique dans le depot, de sorte qu une sortie qui la
// porte ne peut la tenir que de cette entree.
// ============================================================

import type { FinancialDataExtraction } from '../types';

/**
 * Dossier minimal qui franchit la garde `hasMinimalFinancialSignal` :
 * un tour chiffre et une projection de revenu. Sert aux tests qui ont
 * seulement besoin que le pattern s execute, sans rien attendre du
 * contenu financier.
 */
export const FIXTURE_FINANCIERE_MINIMALE: FinancialDataExtraction = {
  hasBP: true,
  fileSource: 'both',
  revenueProjection: [
    { year: '2025', value: 5.11, source: 'bp', basis: 'actual' },
  ],
  grossMarginProjection: [],
  ebitdaProjection: [],
  fcfProjection: [],
  unitEconomics: {
    estimatedCAC: 'non communiqué',
    estimatedLTV: 'non communiqué',
    estimatedLtvCacRatio: 'non communiqué',
    averageContractValue: 'non communiqué',
    grossMarginPerUnit: 'non communiqué',
  },
  headcount: [],
  opexProjection: [],
  currentRound: {
    amount: '5,11M€',
    runwayMonths: '17',
    monthlyBurn: '211K€/mois',
  },
  marketAssumptions: {
    tamCited: 'non communiqué',
    samCited: 'non communiqué',
    targetMarketShare: 'non communiqué',
    targetCustomersByYearN: 'non communiqué',
  },
  rawNotes: '',
  lastActualYear: 2025,
  lastActualYearEvidence: 'P&L 2025 clos, page 11',
};

/**
 * Dossier renseigne sur tous les axes que le contrat porte. Chaque
 * valeur est unique dans le depot : un test qui la retrouve en sortie
 * ne peut la tenir que de cette entree, jamais d un repli.
 */
export const FIXTURE_FINANCIERE_COMPLETE: FinancialDataExtraction = {
  hasBP: true,
  fileSource: 'both',
  revenueProjection: [
    { year: '2024', value: 3.17, source: 'bp', basis: 'actual' },
    { year: '2025', value: 7.23, source: 'bp', basis: 'projected' },
  ],
  grossMarginProjection: [
    { year: '2024', value: 61.3, source: 'bp', basis: 'actual' },
  ],
  ebitdaProjection: [
    { year: '2024', value: -4.19, source: 'bp', basis: 'actual' },
  ],
  fcfProjection: [
    { year: '2024', value: -5.07, source: 'bp', basis: 'actual' },
  ],
  unitEconomics: {
    estimatedCAC: '12,7K€',
    estimatedLTV: '48,3K€',
    estimatedLtvCacRatio: '3,8:1',
    averageContractValue: '31,4K€/an',
    grossMarginPerUnit: '61%',
  },
  headcount: [
    { year: '2024', value: 43, source: 'bp', basis: 'actual' },
  ],
  opexProjection: [
    { year: '2024', value: 7.41, source: 'bp', basis: 'actual' },
  ],
  currentRound: {
    amount: '12,9M€',
    runwayMonths: '23',
    monthlyBurn: '218K€/mois',
  },
  marketAssumptions: {
    tamCited: '4,2Md€',
    samCited: '613M€',
    targetMarketShare: '3,4%',
    targetCustomersByYearN: '407 clients en 2027',
  },
  rawNotes: 'Baux commerciaux 9 ans fermes sur trois sites, engagement cloud 3 ans.',
  lastActualYear: 2024,
  lastActualYearEvidence: 'P&L 2024 audite par un commissaire aux comptes, page 14',
};

/**
 * Dossier dont le bloc financier existe et ne porte aucune valeur : le
 * modele a rendu la structure en remplissant chaque champ du marqueur
 * d absence qu on lui demande de produire. Sert a verifier que ce cas
 * se distingue de l absence totale de bloc.
 */
export const FIXTURE_FINANCIERE_VIDE: FinancialDataExtraction = {
  hasBP: false,
  fileSource: 'none',
  revenueProjection: [],
  grossMarginProjection: [],
  ebitdaProjection: [],
  fcfProjection: [],
  unitEconomics: {
    estimatedCAC: 'non communiqué',
    estimatedLTV: 'non communiqué',
    estimatedLtvCacRatio: 'non communiqué',
    averageContractValue: 'non communiqué',
    grossMarginPerUnit: 'non communiqué',
  },
  headcount: [],
  opexProjection: [],
  currentRound: {
    amount: 'non précisé',
    runwayMonths: 'non précisé',
    monthlyBurn: 'non précisé',
  },
  marketAssumptions: {
    tamCited: 'non communiqué',
    samCited: 'non communiqué',
    targetMarketShare: 'non communiqué',
    targetCustomersByYearN: 'non communiqué',
  },
  rawNotes: '',
  lastActualYear: null,
  lastActualYearEvidence: null,
};
