// ============================================================
// PRELUDE - Sectoral Intelligence, couche d injection au pipeline
// ------------------------------------------------------------
// Sous-chantier 4 du chantier Sectoral Intelligence Layer.
// Branche la fiche sectorielle persistee en Supabase
// (sectoral_briefs) sur les six moteurs sectoriels du pipeline :
//
//   - macro-engine                    (Macro et Geopolitique)
//   - blindspot-engine                (Vigilance critique)
//   - contrarian-engine               (Singularites contrariennes)
//   - market-engine                   (Marche)
//   - fragility-structurelle          (Sept patterns Phase 4)
//   - narrative-drift-engine          (Lecture du langage)
//
// Le mapping doctrinal est defini decision 6 de la fiche
// conceptuelle (docs/patterns/sectoral-intelligence.md). Chaque
// moteur recoit en tete le resume editorial commun, puis les
// dimensions sectorielles qui lui sont doctrinalement attribuees.
// L injection est strictement hybride : pas d injection brute,
// pas d injection generique. Chaque moteur lit ce qui lui sert.
//
// Cas limites doctrinaux pris en charge :
//   (a) dossier multi-sectoriel : primaire integral plus encarts
//       courts pour les secondaires
//   (b) secteur emergent non couvert : injection desactivee,
//       methodologyNote pour la note d instruction
//   (c) fiche obsolete (>9 mois) : warning sobre conserve dans
//       le bloc inject pour que les moteurs en aient connaissance
//   (d) fiche perimee (>12 mois) : injection desactivee, retour
//       au fonctionnement sans contexte sectoriel
//
// Architecture client/server :
//   - Ce fichier est SERVER-ONLY : il importe getLatestBriefForSector
//     qui remonte jusqu a lib/supabase/server (et next/headers).
//   - Les helpers purs (computeFreshness, detectSectorSlugs,
//     buildSectoralPromptBlock, ENGINE_DIMENSION_MAP, types) vivent
//     dans sectoral-injection-pure.ts pour rester importables cote
//     client sans casser le build webpack.
//   - Ce fichier re-exporte la surface pure pour preserver la
//     compatibilite des imports existants cote serveur.
// ============================================================

import type { ExtractionOutput } from './types';
import type { SectoralBrief } from './sectoral-intelligence/types';
import { SECTORS } from './sectoral-intelligence/types';
import { getLatestBriefForSector } from './sectoral-intelligence';
import {
  STALE_THRESHOLD_DAYS,
  EXPIRED_THRESHOLD_DAYS,
  computeFreshness,
  detectSectorSlugs,
  scanSectorSlugs,
  sectorSlugForAssetClass,
  ASSET_CLASS_TO_SECTOR_SLUG,
  formatDate,
  ENGINE_DIMENSION_MAP,
  FRAGILITY_PATTERN_ACTIVATION_HINTS,
  buildSectoralPromptBlock,
  type SectoralFreshness,
  type SectoralContext,
  type SectoralContextMode,
  type SectoralPrimary,
  type SectoralSecondary,
  type SectoralEngineKey,
} from './sectoral-injection-pure';

// Re-export de la surface pure pour preserver la compatibilite
// des imports existants cote serveur (tests, moteurs du pipeline,
// runner cron). Le code historique qui faisait
// `import { computeFreshness } from '@/lib/engines/sectoral-injection'`
// continue de fonctionner sans modification.
export {
  STALE_THRESHOLD_DAYS,
  EXPIRED_THRESHOLD_DAYS,
  computeFreshness,
  detectSectorSlugs,
  scanSectorSlugs,
  sectorSlugForAssetClass,
  ASSET_CLASS_TO_SECTOR_SLUG,
  formatDate,
  ENGINE_DIMENSION_MAP,
  FRAGILITY_PATTERN_ACTIVATION_HINTS,
  buildSectoralPromptBlock,
};
export type {
  SectoralFreshness,
  SectoralContext,
  SectoralContextMode,
  SectoralPrimary,
  SectoralSecondary,
  SectoralEngineKey,
};

// ============================================================
// RESOLUTION DU CONTEXTE SECTORIEL (SERVER-ONLY)
// ------------------------------------------------------------
// Charge la fiche primaire en Supabase via getLatestBriefForSector
// et les fiches secondaires (au plus deux). Determine le mode
// d injection selon la fraicheur et le succes des lookups. Aucun
// throw : toute erreur Supabase ramene un contexte 'no_brief' avec
// methodologyNote explicite, le pipeline doit pouvoir continuer.
// ============================================================

export interface ResolveOptions {
  /** Injection de dependance pour les tests deterministes. Si absent,
   *  utilise getLatestBriefForSector(slug) sur Supabase. */
  fetchBrief?: (slug: string) => Promise<SectoralBrief | null>;
  /** Date courante mockable pour les tests de fraicheur. */
  now?: Date;
  /**
   * Asset class arbitree par la matrice de pertinence. Quand elle
   * designe un secteur du catalogue, elle impose le secteur primaire
   * et le balayage par mots-cle ne fournit plus que les secondaires.
   * Sans elle, comportement historique : le premier matcher qui touche
   * dans l ordre de declaration de la table devient primaire, ce qui
   * sortait la fiche sante sur un dossier de soins capillaires vendus
   * en direct au consommateur.
   */
  assetClass?: string | null;
}

export async function resolveSectoralContext(
  extraction: ExtractionOutput,
  options: ResolveOptions = {},
): Promise<SectoralContext> {
  const now = options.now ?? new Date();
  const fetchBrief = options.fetchBrief ?? getLatestBriefForSector;

  const slugs = detectSectorSlugs(extraction, options.assetClass ?? null);
  if (slugs.length === 0) {
    return {
      mode: 'unknown_sector',
      cause: 'absence',
      detectedSlugs: [],
      primary: null,
      secondaries: [],
      methodologyNote:
        'Ce dossier opere dans un secteur emergent qui ne fait pas encore l objet d une fiche sectorielle Prelude active. La lecture s appuie donc sur le seul contenu du dossier et sur la doctrine generale des moteurs.',
    };
  }

  const primarySlug = slugs[0];
  const secondarySlugs = slugs.slice(1, 3);

  let primaryBrief: SectoralBrief | null = null;
  // L echec d acces et l absence de fiche menaient au meme etat. On
  // les separe a la source : le pipeline ne casse toujours pas, mais
  // la sortie ne pretend plus qu une panne est une lacune de corpus.
  let primaryFetchFailed = false;
  try {
    primaryBrief = await fetchBrief(primarySlug);
  } catch (err: any) {
    console.warn(`[sectoral-injection] fetch primary brief failed for ${primarySlug}:`, err?.message);
    primaryBrief = null;
    primaryFetchFailed = true;
  }

  if (!primaryBrief) {
    const label = SECTORS.find((s) => s.slug === primarySlug)?.label ?? primarySlug;
    return {
      mode: 'no_brief',
      cause: primaryFetchFailed ? 'incident' : 'absence',
      detectedSlugs: slugs,
      primary: null,
      secondaries: [],
      methodologyNote: primaryFetchFailed
        ? `Le secteur primaire detecte est ${label}, mais le chargement de sa fiche sectorielle a echoue. Ce n est pas une absence de fiche : la lecture sectorielle manque a cette analyse pour une raison technique, et le dossier merite d etre rejoue.`
        : `Le secteur primaire detecte est ${label} mais aucune fiche sectorielle Prelude n est encore persistee pour ce secteur. La lecture s appuie sur le seul contenu du dossier en attendant la prochaine regeneration trimestrielle.`,
    };
  }

  const primaryFreshness = computeFreshness(primaryBrief.generated_at, now);

  if (primaryFreshness.freshness === 'expired') {
    const label = SECTORS.find((s) => s.slug === primarySlug)?.label ?? primarySlug;
    return {
      mode: 'expired',
      cause: 'doctrine',
      detectedSlugs: slugs,
      primary: null,
      secondaries: [],
      methodologyNote: `La fiche sectorielle ${label} disponible date du ${formatDate(primaryBrief.generated_at)} et depasse le seuil de douze mois sans regeneration. L injection sectorielle est desactivee pour ne pas contaminer l analyse avec une lecture perimee.`,
    };
  }

  // Mode applied : on tente de recuperer les secondaires, sans bloquer
  // sur leurs eventuelles absences ou peremptions.
  const secondaries: SectoralSecondary[] = [];
  for (const slug of secondarySlugs) {
    let brief: SectoralBrief | null = null;
    try {
      brief = await fetchBrief(slug);
    } catch (err: any) {
      console.warn(`[sectoral-injection] fetch secondary brief failed for ${slug}:`, err?.message);
      continue;
    }
    if (!brief) continue;
    const sFreshness = computeFreshness(brief.generated_at, now);
    if (sFreshness.freshness === 'expired') continue;
    secondaries.push({
      slug: brief.sector_slug,
      brief,
      freshness: sFreshness.freshness,
      ageDays: sFreshness.ageDays,
    });
  }

  const primaryLabel = SECTORS.find((s) => s.slug === primaryBrief!.sector_slug)?.label
    ?? primaryBrief!.sector_slug;
  const secondaryLabels = secondaries
    .map((s) => SECTORS.find((sd) => sd.slug === s.brief.sector_slug)?.label ?? s.brief.sector_slug)
    .filter(Boolean);

  let methodologyNote = `Secteur primaire ${primaryLabel}, fiche du ${formatDate(primaryBrief.generated_at)}`;
  if (secondaryLabels.length > 0) {
    methodologyNote += `, secteurs secondaires ${secondaryLabels.join(' et ')}`;
  }
  methodologyNote += '.';
  if (primaryFreshness.freshness === 'stale') {
    methodologyNote += ` La fiche depasse neuf mois (age ${Math.floor(primaryFreshness.ageDays / 30)} mois), une regeneration est attendue au prochain cycle trimestriel.`;
  }

  return {
    mode: 'applied',
    cause: null,
    detectedSlugs: slugs,
    primary: {
      slug: primaryBrief.sector_slug,
      brief: primaryBrief,
      freshness: primaryFreshness.freshness,
      ageDays: primaryFreshness.ageDays,
    },
    secondaries,
    methodologyNote,
  };
}
