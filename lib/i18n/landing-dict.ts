// ============================================================
// DICTIONNAIRE I18N LANDING
// ------------------------------------------------------------
// Traductions FR/EN des sections critiques de la landing page.
// Approche minimaliste : on traduit uniquement les sections les
// plus visibles (hero, intro, sections principales, CTA) pour
// permettre aux visiteurs anglophones de comprendre rapidement
// ce qu est Prelude. Les noms des moteurs Bloc 1, des sections
// techniques tres specialisees et certains corps de texte longs
// restent en francais pour garder une ergonomie raisonnable
// avec l effort fourni.
//
// Pour ajouter une chaine : la mettre dans les deux dictionnaires
// fr et en, puis l appeler dans LandingPage via t('cle').
// Si la cle n existe qu en francais, t() retourne la version fr
// par defaut, ce qui evite de casser le rendu.
// ============================================================

export type Locale = 'fr' | 'en';

export const landingDict: Record<Locale, Record<string, string>> = {
  fr: {
    // Header / nav
    'nav.login': 'Se connecter',
    'nav.toggle-lang': 'EN',

    // Hero
    'hero.kicker': 'Capital-risque européen · Instruction rigoureuse',
    'hero.title-line1': 'Instruire un dossier',
    'hero.title-line2': "comme on instruit une affaire.",
    'hero.lede': "Prélude est un moteur d'instruction conçu pour les fonds qui considèrent qu'un dossier mérite mieux qu'un résumé en trois bullet points. Quatorze moteurs analytiques travaillent en parallèle sur chaque pitch deck, chaque modèle financier, chaque jeu de données. La synthèse produite tient en une note rédigée, un pack de comité, un verdict argumenté.",
    'hero.cta-primary': 'Lancer une instruction',
    'hero.cta-meta': 'Lien magique par email · Aucun mot de passe',

    // Stats
    'stats.engines-num': '14',
    'stats.engines-label': 'Moteurs analytiques',
    'stats.engines-detail': 'Équipe, marché, macro, financiers, pattern, blindspot, contrarien, cohérence, exécution.',
    'stats.time-label': "Temps d'instruction",
    'stats.time-detail': "Du dépôt du pitch deck à la note d'investissement consolidée.",
    'stats.trace-label': 'Traçabilité',
    'stats.trace-detail': 'Chaque verdict est argumenté, chaque source citée, chaque vote archivé.',

    // Sections
    'section.demo-kicker': 'Démonstration',
    'section.demo-title-1': 'Une instruction',
    'section.demo-title-2': 'en temps réel.',
    'section.engines-kicker': 'Architecture',
    'section.engines-title-1': 'Quatorze moteurs.',
    'section.engines-title-2': 'Une note.',
    'section.philosophy-kicker': 'Philosophie',
    'section.philosophy-title': "Ce que Prélude rend possible.",
    'section.pillar-1': "L'instruction prend le pas sur la décision rapide.",
    'section.pillar-2': 'Le comité retrouve sa fonction de jugement.',
    'section.pillar-3': 'La mémoire du fonds devient un actif.',

    // Final CTA
    'final.title-1': 'Voir Prélude',
    'final.title-2': 'sur un dossier réel.',
    'final.cta-primary': "Démarrer l'instruction",
    'final.cta-secondary': 'Demander une démonstration',
  },
  en: {
    // Header / nav
    'nav.login': 'Sign in',
    'nav.toggle-lang': 'FR',

    // Hero
    'hero.kicker': 'European venture capital · Rigorous case work',
    'hero.title-line1': 'Instruct a deal',
    'hero.title-line2': 'as one instructs a case.',
    'hero.lede': 'Prélude is an instruction engine built for funds that believe a deal deserves more than a three-bullet summary. Fourteen analytical engines work in parallel on every pitch deck, every financial model, every dataset. The output is a written investment note, a committee pack, an argued verdict.',
    'hero.cta-primary': 'Run an instruction',
    'hero.cta-meta': 'Magic link by email · No password',

    // Stats
    'stats.engines-num': '14',
    'stats.engines-label': 'Analytical engines',
    'stats.engines-detail': 'Team, market, macro, financials, pattern, blindspot, contrarian, coherence, execution.',
    'stats.time-label': 'Instruction time',
    'stats.time-detail': 'From pitch deck upload to consolidated investment note.',
    'stats.trace-label': 'Traceability',
    'stats.trace-detail': 'Every verdict argued, every source cited, every vote archived.',

    // Sections
    'section.demo-kicker': 'Demonstration',
    'section.demo-title-1': 'An instruction',
    'section.demo-title-2': 'in real time.',
    'section.engines-kicker': 'Architecture',
    'section.engines-title-1': 'Fourteen engines.',
    'section.engines-title-2': 'One note.',
    'section.philosophy-kicker': 'Philosophy',
    'section.philosophy-title': 'What Prélude makes possible.',
    'section.pillar-1': 'Instruction takes precedence over the quick decision.',
    'section.pillar-2': 'The committee recovers its function of judgment.',
    'section.pillar-3': "The fund's memory becomes an asset.",

    // Final CTA
    'final.title-1': 'See Prélude',
    'final.title-2': 'on a real deal.',
    'final.cta-primary': 'Start the instruction',
    'final.cta-secondary': 'Request a demonstration',
  },
};

/**
 * Helper qui retourne une chaine traduite. Si la cle est absente en
 * EN, fallback FR. Si absente en FR aussi, retourne la cle elle-meme
 * pour que les manques soient visibles a l ecran.
 */
export function tr(locale: Locale, key: string): string {
  const dict = landingDict[locale];
  if (dict[key]) return dict[key];
  if (landingDict.fr[key]) return landingDict.fr[key];
  return key;
}
