/**
 * Sources de référence pour les benchmarks Prélude.
 * Chaque benchmark utilise un identifiant de source défini ici.
 * Mise a jour trimestrielle quand de nouveaux rapports sortent.
 */

export type BenchmarkSource = {
  id: string;
  name: string;
  publisher: string;
  asOf: string; // ISO date du dernier point de données
  url?: string;
  geography: 'US' | 'Europe' | 'Global';
  notes?: string;
};

export const SOURCES: Record<string, BenchmarkSource> = {
  PITCHBOOK_NVCA_Q4_2025: {
    id: 'PITCHBOOK_NVCA_Q4_2025',
    name: 'PitchBook-NVCA Venture Monitor Q4 2025',
    publisher: 'PitchBook Data, Inc. & National Venture Capital Association',
    asOf: '2025-12-31',
    geography: 'US',
    notes: "Rapport trimestriel de reference sur le marche VC americain.",
  },
  PITCHBOOK_NVCA_Q1_2026: {
    id: 'PITCHBOOK_NVCA_Q1_2026',
    name: 'PitchBook-NVCA Venture Monitor Q1 2026',
    publisher: 'PitchBook Data, Inc. & National Venture Capital Association',
    asOf: '2026-03-31',
    geography: 'US',
    notes: "Donnees IA versus non-IA par stade, concentration extreme top 5.",
  },
  ATOMICO_SOET_2025: {
    id: 'ATOMICO_SOET_2025',
    name: 'State of European Tech 2025',
    publisher: 'Atomico',
    asOf: '2025-09-30',
    url: 'https://stateofeuropeantech.com',
    geography: 'Europe',
    notes: "Reference annuelle pour l ecosysteme tech europeen.",
  },
  BAIN_PE_2025: {
    id: 'BAIN_PE_2025',
    name: 'Global Private Equity Report 2025',
    publisher: 'Bain & Company',
    asOf: '2024-12-31',
    geography: 'Global',
    notes: "Donnees PE/buyout globales. A ne pas confondre avec donnees VC pures.",
  },
  BAIN_PE_2024_EURAZEO: {
    id: 'BAIN_PE_2024_EURAZEO',
    name: '15eme Rapport annuel mondial sur le Private Equity (synthese Eurazeo)',
    publisher: 'Bain & Company / Eurazeo',
    asOf: '2023-12-31',
    geography: 'Global',
    notes: "Synthese 3 pages du rapport Bain 2024. Donnees 2023, conserve pour les mecanismes structurels (secondaires, add-ons).",
  },
  CORRELATION_VENTURES_POWER_LAW: {
    id: 'CORRELATION_VENTURES_POWER_LAW',
    name: 'Correlation Ventures Power Law Distribution',
    publisher: 'Correlation Ventures',
    asOf: '2024-01-01',
    geography: 'Global',
    notes: "Loi de puissance des retours VC sur ~10 ans d historique. Reference structurelle, faible variation interannuelle.",
  },
  CAMBRIDGE_ASSOCIATES_QUARTILES: {
    id: 'CAMBRIDGE_ASSOCIATES_QUARTILES',
    name: 'Cambridge Associates VC Fund Performance Quartiles',
    publisher: 'Cambridge Associates',
    asOf: '2024-01-01',
    geography: 'Global',
    notes: "Benchmarks de TRI et TVPI par quartile de fond. Reference structurelle.",
  },
  MENLO_VENTURES_AI_BENCHMARK: {
    id: 'MENLO_VENTURES_AI_BENCHMARK',
    name: 'Menlo Ventures Series A AI ARR Trajectory Benchmark',
    publisher: 'Menlo Ventures (via Dentons interview, PitchBook Q1 2026)',
    asOf: '2026-03-31',
    geography: 'Global',
    notes: "Benchmark de trajectoire ARR exceptionnelle pour Series A IA en 2026.",
  },
} as const;

export type SourceId = keyof typeof SOURCES;
