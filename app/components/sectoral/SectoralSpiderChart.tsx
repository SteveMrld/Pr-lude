// ============================================================
// PRELUDE - Composant SectoralSpiderChart (mode single)
// ------------------------------------------------------------
// Rend une fiche sectorielle isolee selon le langage visuel
// toile d araignee. Taille parametrable :
//
//   - 150 px : mini chart pour integration dans la section
//              methode de la note d instruction
//   - 480 px : taille pleine pour la fiche complete du dashboard
//              partner
//
// Toggle expand/collapse facultatif qui deplie sous le polygone
// la lecture editoriale des huit dimensions avec score, definition
// appliquee et sources citees. La sobriete est doctrinale, aucune
// animation, aucun hover tooltip.
//
// Cas limites gerees par le composant :
//
//   - mode 'applied' fresh    : rendu normal
//   - mode 'applied' stale    : SVG rendu avec opacite reduite (0.7)
//                               et mention "fiche du [date],
//                               regeneration recommandee"
//   - mode 'expired'          : aucun spider chart, mention textuelle
//   - mode 'unknown_sector'   : aucun spider chart, mention textuelle
//   - dimension data_missing  : delegue au module spider, branche
//                               rendue en pointille clair
// ============================================================

'use client';

import * as React from 'react';
import {
  renderSpiderChart,
  type DimensionData,
  type SpiderChartData,
  PALETTE,
} from '@/lib/visuals/spiderweb';
import type { SectoralBrief } from '@/lib/engines/sectoral-intelligence/types';
import {
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  type DimensionKey,
} from '@/lib/engines/sectoral-intelligence/types';
import { formatSectoralDate } from './editorial-helpers';

// ------------------------------------------------------------
// MODE DE RENDU
// ------------------------------------------------------------
// Le composant accepte un mode explicite qui controle le rendu
// degrade. Le caller (note d instruction, dashboard) calcule le
// mode a partir de la fraicheur de la fiche et du resultat de
// resolveSectoralContext.
export type SectoralRenderMode =
  | 'fresh'
  | 'stale'
  | 'expired'
  | 'unknown_sector';

export interface SectoralSpiderChartProps {
  /** Fiche sectorielle a afficher. Null/undefined autorise pour
   *  les modes 'expired' et 'unknown_sector' ou aucun chart n est
   *  rendu. */
  brief?: SectoralBrief | null;
  /** Libelle editorial du secteur (ex : "Fintech"). */
  sectorLabel?: string;
  /** Mode de rendu. Defaut 'fresh'. */
  mode?: SectoralRenderMode;
  /** Cote en pixels du carre englobant. Defaut 480. La doctrine
   *  prescrit 150 pour le mini chart embedded dans la note. */
  size?: number;
  /** Si true, affiche le toggle expand/collapse qui deplie la
   *  lecture editoriale des huit dimensions sous le polygone.
   *  Defaut false (note d instruction reste compacte). */
  expandable?: boolean;
  /** Etat initial du toggle. Defaut false. */
  defaultExpanded?: boolean;
  /** Si fourni, transforme le bloc titre en lien cliquable.
   *  Sert au cas note d instruction ou le mini chart ouvre la
   *  fiche complete dans un panel ou nouvelle page. */
  href?: string;
  /** Sous-titre optionnel qui ecrase le calcul automatique
   *  "fiche du [date]". Utile pour les vues qui veulent un
   *  contexte different. */
  subtitle?: string;
}

// ------------------------------------------------------------
// MAPPING SectoralBrief -> SpiderChartData
// ------------------------------------------------------------
// L ordre des dimensions du SectoralBrief est gele dans
// lib/engines/sectoral-intelligence/types.ts (DIMENSION_KEYS) :
// premier sommet au nord, sens horaire. On itere dans cet ordre
// pour preserver la coherence visuelle entre toutes les fiches.
export function briefToSpiderData(
  brief: SectoralBrief,
  options: { title?: string; subtitle?: string } = {},
): SpiderChartData {
  const dimensions: DimensionData[] = DIMENSION_KEYS.map((key: DimensionKey) => {
    const d = brief.dimensions[key];
    return {
      label: DIMENSION_LABELS[key],
      score: d?.data_missing ? null : (typeof d?.score === 'number' ? d.score : null),
      confidence: d?.confidence,
    };
  });
  return {
    dimensions,
    title: options.title,
    subtitle: options.subtitle,
  };
}

// ------------------------------------------------------------
// COMPOSANT PRINCIPAL
// ------------------------------------------------------------

export function SectoralSpiderChart(props: SectoralSpiderChartProps): React.ReactElement {
  const {
    brief,
    sectorLabel,
    mode = 'fresh',
    size = 480,
    expandable = false,
    defaultExpanded = false,
    href,
    subtitle,
  } = props;

  const [expanded, setExpanded] = React.useState(defaultExpanded);

  // Cas limites sans rendu graphique : on remplace par une
  // mention textuelle sobre, voix Le Grand Continent.
  if (mode === 'unknown_sector') {
    return (
      <div className="sectoral-empty" data-testid="sectoral-empty-unknown">
        <p>
          Secteur emergent non couvert par la matrice Prelude. La lecture
          sectorielle est suspendue pour ce dossier, l analyse s appuie sur le
          seul contenu du pitch et sur la doctrine generale des moteurs.
        </p>
        <ChartStyles />
      </div>
    );
  }

  if (mode === 'expired' || !brief) {
    return (
      <div className="sectoral-empty" data-testid="sectoral-empty-expired">
        <p>
          {sectorLabel
            ? `La fiche sectorielle ${sectorLabel} disponible depasse douze mois sans regeneration.`
            : 'La fiche sectorielle disponible depasse douze mois sans regeneration.'}{' '}
          L injection sectorielle est desactivee pour ne pas contaminer l
          analyse avec une lecture perimee.
        </p>
        <ChartStyles />
      </div>
    );
  }

  // Calcul du sous-titre par defaut : "fiche du [date], regeneration
  // recommandee" en stale, "fiche du [date]" en fresh.
  const dateLabel = formatSectoralDate(brief.generated_at);
  const resolvedSubtitle =
    subtitle ??
    (mode === 'stale'
      ? `Fiche du ${dateLabel}, regeneration recommandee`
      : `Fiche du ${dateLabel}`);

  const data = briefToSpiderData(brief, {
    title: sectorLabel,
    subtitle: resolvedSubtitle,
  });

  const svgString = renderSpiderChart(data, { size, mode: 'single' });

  // L opacite reduite en mode stale est portee par le wrapper, sans
  // changer le SVG. Une approche superieure serait de moduler la
  // peinture interne du polygone, mais le wrapper suffit pour la
  // doctrine et reste compatible avec le module visuel partage.
  const chartOpacity = mode === 'stale' ? 0.7 : 1;

  const header = (
    <div className="sectoral-spider-header">
      {sectorLabel && <div className="sectoral-spider-title">{sectorLabel}</div>}
      <div className="sectoral-spider-subtitle">{resolvedSubtitle}</div>
    </div>
  );

  const chartBlock = (
    <div
      className="sectoral-spider-svg"
      style={{ opacity: chartOpacity }}
      data-testid="sectoral-spider-svg"
      // Le SVG est genere par notre propre module, le contenu n est
      // pas issu d une source externe : usage controle de
      // dangerouslySetInnerHTML.
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );

  return (
    <div
      className={`sectoral-spider-wrap ${mode === 'stale' ? 'is-stale' : ''}`}
      data-testid="sectoral-spider"
      data-mode={mode}
      data-size={size}
    >
      {href ? (
        <a href={href} className="sectoral-spider-link" data-testid="sectoral-spider-link">
          {header}
        </a>
      ) : (
        header
      )}
      {chartBlock}

      {expandable && (
        <div className="sectoral-spider-expand">
          <button
            type="button"
            className="sectoral-spider-toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            data-testid="sectoral-spider-toggle"
          >
            {expanded ? 'Replier les definitions' : 'Deplier les definitions des huit dimensions'}
          </button>
          {expanded && <DimensionsList brief={brief} />}
        </div>
      )}

      <ChartStyles />
    </div>
  );
}

// ------------------------------------------------------------
// LISTE DES DIMENSIONS DEPLIEE (toggle expand)
// ------------------------------------------------------------

function DimensionsList({ brief }: { brief: SectoralBrief }): React.ReactElement {
  return (
    <ol className="sectoral-dimensions-list" data-testid="sectoral-dimensions-list">
      {DIMENSION_KEYS.map((key) => {
        const d = brief.dimensions[key];
        const label = DIMENSION_LABELS[key];
        const score = d?.data_missing
          ? 'donnee insuffisante'
          : typeof d?.score === 'number'
            ? `${d.score}/100`
            : 'non chiffre';
        return (
          <li key={key} className="sectoral-dimensions-item">
            <div className="sectoral-dimensions-head">
              <span className="sectoral-dimensions-label">{label}</span>
              <span className="sectoral-dimensions-score">{score}</span>
            </div>
            {d?.definition_applied && (
              <p className="sectoral-dimensions-def">{d.definition_applied}</p>
            )}
            {d?.notes && <p className="sectoral-dimensions-notes">{d.notes}</p>}
            {d?.sources_cited && d.sources_cited.length > 0 && (
              <ul className="sectoral-dimensions-sources">
                {d.sources_cited.slice(0, 4).map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------------------------------------
// STYLES INLINE - palette ocre brule sur creme
// ------------------------------------------------------------

function ChartStyles(): React.ReactElement {
  return (
    <style jsx>{`
      .sectoral-spider-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        background: ${PALETTE.cream};
        padding: 16px;
        border: 1px solid ${PALETTE.ocreEteint};
        border-radius: 2px;
      }
      .sectoral-spider-wrap.is-stale {
        border-style: dashed;
      }
      .sectoral-spider-link {
        text-decoration: none;
        color: inherit;
        display: block;
        text-align: center;
      }
      .sectoral-spider-header {
        text-align: center;
        font-family: var(--serif, Georgia, serif);
        color: ${PALETTE.encre};
      }
      .sectoral-spider-title {
        font-size: 1rem;
        font-weight: 600;
        line-height: 1.3;
      }
      .sectoral-spider-subtitle {
        font-size: 0.78rem;
        color: ${PALETTE.sepia};
        margin-top: 2px;
        font-family: var(--grotesque-condensed, sans-serif);
      }
      .sectoral-spider-svg {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
      }
      .sectoral-spider-svg :global(svg) {
        max-width: 100%;
        height: auto;
      }
      .sectoral-spider-expand {
        width: 100%;
      }
      .sectoral-spider-toggle {
        font-family: var(--serif, Georgia, serif);
        font-size: 0.85rem;
        color: ${PALETTE.ocreBrule};
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 8px 0;
        text-decoration: underline dotted;
        text-underline-offset: 4px;
      }
      .sectoral-spider-toggle:hover {
        color: ${PALETTE.encre};
      }
      .sectoral-dimensions-list {
        list-style: decimal;
        padding-left: 24px;
        margin: 12px 0 0;
        text-align: left;
        font-family: var(--serif, Georgia, serif);
        color: ${PALETTE.encre};
      }
      .sectoral-dimensions-item {
        margin-bottom: 14px;
      }
      .sectoral-dimensions-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
        margin-bottom: 4px;
      }
      .sectoral-dimensions-label {
        font-weight: 600;
        font-size: 0.95rem;
      }
      .sectoral-dimensions-score {
        font-family: var(--grotesque-condensed, sans-serif);
        font-size: 0.85rem;
        color: ${PALETTE.sepia};
      }
      .sectoral-dimensions-def {
        font-size: 0.85rem;
        line-height: 1.5;
        margin: 4px 0;
        color: ${PALETTE.encre};
      }
      .sectoral-dimensions-notes {
        font-size: 0.82rem;
        line-height: 1.45;
        margin: 4px 0;
        color: ${PALETTE.sepia};
        font-style: italic;
      }
      .sectoral-dimensions-sources {
        list-style: none;
        padding-left: 0;
        margin: 4px 0;
        font-size: 0.78rem;
      }
      .sectoral-dimensions-sources li {
        margin-bottom: 2px;
      }
      .sectoral-dimensions-sources a {
        color: ${PALETTE.ocreBrule};
        text-decoration: none;
        border-bottom: 1px dotted ${PALETTE.ocreEteint};
      }
      .sectoral-dimensions-sources a:hover {
        color: ${PALETTE.encre};
        border-bottom-color: ${PALETTE.encre};
      }
      .sectoral-empty {
        padding: 16px 20px;
        background: ${PALETTE.cream};
        border: 1px dashed ${PALETTE.ocreEteint};
        border-radius: 2px;
        font-family: var(--serif, Georgia, serif);
        color: ${PALETTE.sepia};
        font-size: 0.85rem;
        line-height: 1.55;
        font-style: italic;
      }
      .sectoral-empty p {
        margin: 0;
      }
    `}</style>
  );
}

export default SectoralSpiderChart;
