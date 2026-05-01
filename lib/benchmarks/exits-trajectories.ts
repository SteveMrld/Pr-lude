/**
 * Trajectoires post-IPO 2025 et voies de sortie disponibles en 2026.
 *
 * Pourquoi c est utile pour Prelude:
 * Quand un dossier projette une sortie via IPO, ces donnees permettent de
 * confronter les hypotheses du business plan a la realite du marche public
 * recent. La plupart des IPO 2025 ont sous-performe leur first-day close.
 */

import { SOURCES } from './sources';

/**
 * Performance post-IPO de la classe 2025.
 * Source: PitchBook-NVCA Q4 2025.
 *
 * Lecture: meme dans une annee ou les IPOs reprennent (17 unicornes US sortis),
 * la majorite des listings perdent 20 a 60% de leur prix d ouverture sur l annee.
 * CoreWeave est l exception positive (+60%).
 */
export const POST_IPO_PERFORMANCE_2025 = {
  selectedListings: [
    { name: 'CoreWeave', sector: 'AI infrastructure', performanceFromFirstClosePercent: 60 },
    { name: 'Navan', sector: 'Fintech / travel', performanceFromFirstClosePercent: -25 },
    { name: 'Circle', sector: 'Crypto / stablecoin', performanceFromFirstClosePercent: -40 },
    { name: 'StubHub', sector: 'Marketplace', performanceFromFirstClosePercent: -30 },
    { name: 'Chime', sector: 'Fintech / banking', performanceFromFirstClosePercent: -35 },
    { name: 'Netskope', sector: 'Cybersecurity', performanceFromFirstClosePercent: -30 },
    { name: 'Voyager', sector: 'Space', performanceFromFirstClosePercent: -55 },
    { name: 'Firefly Aerospace', sector: 'Space', performanceFromFirstClosePercent: -65 },
    { name: 'Gemini Space Station', sector: 'Crypto exchange', performanceFromFirstClosePercent: -65 },
    { name: 'Figma', sector: 'Design SaaS', performanceFromFirstClosePercent: -60 },
  ],
  source: SOURCES.PITCHBOOK_NVCA_Q4_2025,
  notes: "Performance mesuree en fin 2025 vs first-day close. Patterns: les listings high-multiple software et les listings opportunistes crypto ont le plus souffert. CoreWeave est porte par la demande IA infrastructure.",
} as const;

/**
 * Volume IPO US par annee.
 * Source: PitchBook-NVCA Q4 2025 et Q1 2026.
 */
export const US_IPO_VOLUMES = {
  history: {
    2021: { count: 198, valueBillionsUsd: 518.2 },
    2022: { count: 42, valueBillionsUsd: 6.7 },
    2023: { count: 43, valueBillionsUsd: 26.0 },
    2024: { count: 44, valueBillionsUsd: 41.4 },
    2025: { count: 48, valueBillionsUsd: 116.7 },
    '2026Q1': { count: 15, valueBillionsUsd: null },
  },
  expected2026Pace: 60,
  notes: "Le volume IPO 2025 marque une reprise mesuree mais reste loin du pic 2021. Pour 2026, attentes autour de 60 listings sauf si les IPO geantes (SpaceX, OpenAI, Anthropic) absorbent toute la capacite d underwriting.",
  source: SOURCES.PITCHBOOK_NVCA_Q1_2026,
} as const;

/**
 * Voies de sortie disponibles en 2026 pour un dossier VC.
 * Synthese PitchBook + Bain.
 */
export const EXIT_CHANNELS_2026 = {
  channels: [
    {
      name: 'IPO',
      status: 'partiel',
      description: "Fenetre rouverte mais selective. Reservee aux plus grandes entreprises et aux secteurs alignes avec priorites politiques (IA, defense, crypto, aerospace).",
    },
    {
      name: 'M&A par strategique',
      status: 'modere',
      description: "Volume 2025 stable autour de 261 milliards US. Federal Trade Commission limite encore les rapprochements public-public. M&A 2026 freinee par la pause sur la tech post-volatilite fevrier.",
    },
    {
      name: 'M&A par sponsor (sponsor-to-sponsor)',
      status: 'reprise',
      description: "Volume 2024 a 181 milliards US (+141% vs 2023, base basse). Reprise structurelle attendue.",
    },
    {
      name: 'Acquisitions par startups VC-backed',
      status: 'en croissance',
      description: "38,4% des acquisitions 2025 ont un acquereur VC-backed (vs ~20% historique). Ex: OpenAI achete io 6,5Md, Statsig 1,1Md. Path de sortie nouveau pour les boites mid-stage.",
    },
    {
      name: 'Secondaires (direct + GP-led + continuation funds)',
      status: 'en forte croissance',
      description: "Volume VC secondaires Q3 2025: 94,9 milliards US TTM. 28% des investisseurs ciblent le secondaire en 2023 vs 19% en 2022 (Bain). Devenu une 3eme jambe credible aux cotes IPO et M&A.",
    },
  ],
  source: SOURCES.PITCHBOOK_NVCA_Q1_2026,
  bainSource: SOURCES.BAIN_PE_2024_EURAZEO,
  note: "Pour un dossier instruit en 2026, les hypotheses de sortie doivent prevoir un plan B et un plan C en plus de l IPO. Les secondaires sont desormais a citer explicitement.",
} as const;

/**
 * Taille du marche secondaire VC.
 * Source: Bain (donnees 2023) + PitchBook Q4 2025 (donnees Q3 2025).
 */
export const SECONDARY_MARKET = {
  vcSecondariesTTMBillionsUsdQ3_2025: 94.9,
  globalSecondaryMarketBillionsUsd2023: 120,
  globalPrivateEquityAumTrillionsUsd2023: 20,
  secondaryShareOfPeAumPercent2023: 0.6,
  growthDriversNextDecade: [
    'Demande croissante de liquidite des LPs',
    'Desir des GPs de conserver les actifs performants tout en creant de la liquidite (continuation funds)',
    'Performance de la strategie (diversification, reduction de la courbe en J)',
  ],
  source: SOURCES.PITCHBOOK_NVCA_Q4_2025,
  bainSource: SOURCES.BAIN_PE_2024_EURAZEO,
} as const;
