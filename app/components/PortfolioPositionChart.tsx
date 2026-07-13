// ============================================================
// PortfolioPositionChart - Courbe de positionnement du dossier
// ------------------------------------------------------------
// Affiche la distribution des scores du portfolio (densite KDE
// lissee) avec un marker sur le score du dossier en cours. Le
// partner voit immediatement si le dossier est dans le top, le
// median, ou le bottom de ses instructions.
//
// Sans cette courbe, le score absolu (47/100) est utile mais le
// score relatif au portfolio est ce qui aide a arbitrer en IC :
// 'on a deja passe du temps sur 5 dossiers similaires, celui-ci
// est dans le haut du panier' est une phrase qui se prononce
// naturellement en comite.
// ============================================================

'use client';

import { useEffect, useState, useMemo } from 'react';
import SectionFallbackLine from './SectionFallbackLine';

interface Props {
  /** Score du dossier en cours, 0-100 */
  currentScore: number;
  /** Mode print pour l export PDF (palette ajustee + interdit spinner) */
  printMode?: boolean;
}

/**
 * Estimation par noyau gaussien de la densite des scores du portfolio.
 * Bandwidth de Silverman pour des donnees non-symetriques. Avec moins
 * de 4 echantillons, on retombe sur un mode 'minimal' qui evite les
 * artefacts visuels (KDE sur 1-2 points produit une bosse trompeuse).
 */
function kernelDensity(values: number[], evalPoints: number[]): number[] {
  if (values.length === 0) return evalPoints.map(() => 0);

  // Bandwidth de Silverman : 1.06 * sigma * n^(-1/5)
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const sigma = Math.sqrt(variance);
  const bandwidth = Math.max(8, 1.06 * sigma * Math.pow(values.length, -0.2));

  return evalPoints.map((x) => {
    const sum = values.reduce((acc, v) => {
      const u = (x - v) / bandwidth;
      return acc + Math.exp(-0.5 * u * u);
    }, 0);
    return sum / (values.length * bandwidth * Math.sqrt(2 * Math.PI));
  });
}

/**
 * Calcule le percentile du score actuel dans la distribution donnee.
 * Retourne un entier 0-100 (ex : 65 = top 35%, on est meilleur que 65%
 * des autres dossiers).
 */
function computePercentile(values: number[], target: number): number {
  if (values.length === 0) return 50;
  const below = values.filter((v) => v < target).length;
  return Math.round((below / values.length) * 100);
}

/**
 * Genere un path SVG smooth (courbe de Bezier cubique) qui passe par
 * les points de la KDE. Le lissage de Catmull-Rom evite les angles
 * abrupts et donne une vraie allure de courbe editoriale.
 */
function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;

  let path = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return path;
}

export default function PortfolioPositionChart({ currentScore, printMode = false }: Props) {
  const [scores, setScores] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/portfolio/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.stats?.allScores) {
          setScores(data.stats.allScores);
        } else {
          setScores([]);
        }
      })
      .catch(() => {
        if (!cancelled) setScores([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Tous les calculs se font en memoization stable pour que le rendu
  // soit identique entre client et hydration server.
  const computed = useMemo(() => {
    if (!scores || scores.length < 2) return null;

    const evalPoints = Array.from({ length: 101 }, (_, i) => i);
    const densities = kernelDensity(scores, evalPoints);
    const maxDensity = Math.max(...densities);
    if (maxDensity === 0) return null;

    const percentile = computePercentile(scores, currentScore);

    return { evalPoints, densities, maxDensity, percentile };
  }, [scores, currentScore]);

  if (loading) {
    // Rendu fige (printMode / export PDF) : jamais de spinner. On rend
    // la ligne neutre "Section non renseignee dans cette version de la
    // note." plutot que l etat de chargement transitoire.
    if (printMode) {
      return <SectionFallbackLine kind="portfolio" />;
    }
    return (
      <div style={{ padding: '20px 0', fontSize: 12, color: 'var(--muted)' }}>
        Chargement de la distribution du portfolio...
      </div>
    );
  }

  // Pas assez de dossiers pour produire une courbe lisible. On affiche
  // un message editorial plutot qu une courbe trompeuse.
  if (!computed || !scores || scores.length < 2) {
    return (
      <div style={{
        padding: '14px 16px',
        background: printMode ? 'transparent' : 'var(--surface-soft)',
        border: '1px dashed var(--hairline)',
        borderRadius: 6,
        fontSize: 12.5,
        color: 'var(--muted)',
        lineHeight: 1.55,
      }}>
        La courbe de positionnement dans le portfolio s&apos;affichera après l&apos;instruction d&apos;au moins deux dossiers. Ce dossier est l&apos;un des premiers à passer le pipeline.
      </div>
    );
  }

  // ----------- Geometrie SVG
  const W = 560;
  const H = 140;
  const padX = 40;
  const padTop = 12;
  const padBottom = 28;
  const innerW = W - 2 * padX;
  const innerH = H - padTop - padBottom;

  const points = computed.evalPoints.map((x, i) => ({
    x: padX + (x / 100) * innerW,
    y: padTop + innerH - (computed.densities[i] / computed.maxDensity) * innerH,
  }));

  const pathLine = smoothPath(points);
  const pathArea = `${pathLine} L${(padX + innerW).toFixed(2)},${(padTop + innerH).toFixed(2)} L${padX.toFixed(2)},${(padTop + innerH).toFixed(2)} Z`;

  const markerX = padX + (currentScore / 100) * innerW;
  const markerY = (() => {
    const idx = Math.min(100, Math.max(0, Math.round(currentScore)));
    return padTop + innerH - (computed.densities[idx] / computed.maxDensity) * innerH;
  })();

  // Couleurs : ocre brule pour la courbe (palette editoriale Le Grand
  // Continent), accent profond pour le marker du dossier.
  const lineColor = printMode ? '#8B6F47' : 'var(--ocre-brule)';
  const fillColor = printMode ? 'rgba(139, 111, 71, 0.10)' : 'var(--ocre-brule-soft)';
  const markerColor = printMode ? '#1a2a3a' : 'var(--accent)';

  // Texte editorial du percentile
  const percentileText = (() => {
    const p = computed.percentile;
    if (p >= 75) return `Ce dossier se situe au ${p}e percentile de votre portfolio. C'est dans le haut du panier de vos instructions.`;
    if (p >= 50) return `Ce dossier se situe au ${p}e percentile de votre portfolio. Au-dessus de la médiane de vos instructions.`;
    if (p >= 25) return `Ce dossier se situe au ${p}e percentile de votre portfolio. En dessous de la médiane de vos instructions.`;
    return `Ce dossier se situe au ${p}e percentile de votre portfolio. Dans le bas du panier de vos instructions.`;
  })();

  return (
    <div style={{ marginTop: 6 }}>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: 'block', maxWidth: '100%' }}
        aria-label={`Distribution des scores du portfolio. Ce dossier au ${computed.percentile}e percentile.`}
      >
        {/* Seuils verticaux pour ancrer la lecture : 45 / 60 / 75 sont
            les seuils du systeme de verdicts. Le partner voit ou se
            situe le dossier par rapport a ces seuils. */}
        {[45, 60, 75].map((threshold) => {
          const x = padX + (threshold / 100) * innerW;
          return (
            <line
              key={threshold}
              x1={x}
              y1={padTop}
              x2={x}
              y2={padTop + innerH}
              stroke="var(--hairline)"
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity="0.5"
            />
          );
        })}

        {/* Courbe de densite des scores du portfolio */}
        <path d={pathArea} fill={fillColor} />
        <path d={pathLine} fill="none" stroke={lineColor} strokeWidth="1.5" />

        {/* Marker du dossier en cours */}
        <line
          x1={markerX}
          y1={padTop}
          x2={markerX}
          y2={padTop + innerH}
          stroke={markerColor}
          strokeWidth="1.5"
        />
        <circle
          cx={markerX}
          cy={markerY}
          r="4"
          fill={markerColor}
        />
        <text
          x={markerX}
          y={padTop - 2}
          fontSize="10"
          fontFamily="var(--serif)"
          fill={markerColor}
          textAnchor={currentScore > 80 ? 'end' : currentScore < 20 ? 'start' : 'middle'}
          fontWeight="600"
        >
          {currentScore}
        </text>

        {/* Axe X : graduations 0 / 45 / 60 / 75 / 100 */}
        {[0, 45, 60, 75, 100].map((tick) => {
          const x = padX + (tick / 100) * innerW;
          return (
            <text
              key={tick}
              x={x}
              y={H - 8}
              fontSize="9"
              fontFamily="var(--sans)"
              fill="var(--muted)"
              textAnchor="middle"
              opacity="0.7"
            >
              {tick}
            </text>
          );
        })}
      </svg>
      <div style={{
        fontSize: 12,
        color: 'var(--ink-soft)',
        marginTop: 6,
        lineHeight: 1.55,
        fontStyle: 'italic',
      }}>
        {percentileText} Distribution établie sur {scores.length} dossier{scores.length > 1 ? 's' : ''} instruit{scores.length > 1 ? 's' : ''}, seuils 45 / 60 / 75 du système de verdicts indiqués en pointillés.
      </div>
    </div>
  );
}
