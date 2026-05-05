'use client';

type Props = {
  successProbability: number; // 0-100
  failureProbability?: number;
  size?: number;
};

// Jauge demi-cercle (arc gauche-droite) construite en SVG pur, sans dependance.
// Style sobre, traits fins, palette editoriale (encre fonce + accent gris + rouge
// sombre pour le risque). Pas de neon, pas de degrade flash.
export default function GaugeProbability({ successProbability, failureProbability, size = 280 }: Props) {
  const success = Math.max(0, Math.min(100, successProbability ?? 0));
  const failure = failureProbability != null
    ? Math.max(0, Math.min(100, failureProbability))
    : 100 - success;

  // Geometrie : demi-cercle de rayon r centre en (cx, cy).
  const cx = size / 2;
  const cy = size * 0.7; // baissez le centre pour que le demi-cercle tienne sans rogner
  const r = size * 0.42;
  const strokeWidth = Math.max(8, size * 0.045);

  // Arc total : 180 degrees, de gauche (180 deg) vers droite (0 deg).
  // On convertit le pourcentage en angle dans le repere SVG.
  const startAngle = Math.PI; // 180 deg, point gauche
  const endAngle = 0;          // 0 deg, point droit

  // Position du point d'extremite a un pourcentage donne (0-100).
  function pointAt(pct: number) {
    const angle = startAngle + ((endAngle - startAngle) * pct) / 100;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }

  const startPt = pointAt(0);
  const endPt = pointAt(100);
  const successEndPt = pointAt(success);

  // Couleur de l'arc plein selon le niveau de succes :
  //   >= 65  -> vert foret (signal positif fort)
  //   45-64  -> ocre brule (zone d hesitation)
  //   < 45   -> warn (rouge sourd, signal d alarme)
  // Tokens du design system pour rester coherent avec le reste de l app.
  const successColor = success >= 65
    ? 'var(--vert-foret)'
    : success >= 45
      ? 'var(--ocre-brule)'
      : 'var(--warn)';

  return (
    <div style={{ width: size, position: 'relative', display: 'inline-block' }}>
      <svg width={size} height={size * 0.78} viewBox={`0 0 ${size} ${size * 0.78}`}>
        {/* Arc de fond */}
        <path
          d={`M ${startPt.x} ${startPt.y} A ${r} ${r} 0 0 1 ${endPt.x} ${endPt.y}`}
          stroke="var(--hairline)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        {/* Arc de succes */}
        {success > 0 && (
          <path
            d={`M ${startPt.x} ${startPt.y} A ${r} ${r} 0 ${success > 50 ? 1 : 0} 1 ${successEndPt.x} ${successEndPt.y}`}
            stroke={successColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
          />
        )}
        {/* Graduations a 25, 50, 75 */}
        {[25, 50, 75].map(pct => {
          const pInner = pointAt(pct);
          const angle = startAngle + ((endAngle - startAngle) * pct) / 100;
          const xOuter = cx + (r + strokeWidth / 1.5) * Math.cos(angle);
          const yOuter = cy + (r + strokeWidth / 1.5) * Math.sin(angle);
          return (
            <line
              key={pct}
              x1={pInner.x}
              y1={pInner.y}
              x2={xOuter}
              y2={yOuter}
              stroke="var(--muted-soft)"
              strokeWidth={1}
            />
          );
        })}
      </svg>
      {/* Etiquettes superposees */}
      <div style={{
        position: 'absolute',
        top: '38%',
        left: 0,
        right: 0,
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: size * 0.18,
          fontFamily: 'var(--serif)',
          fontWeight: 700,
          lineHeight: 1,
          color: successColor,
          fontFeatureSettings: '"lnum","tnum"',
          letterSpacing: '-0.02em',
        }}>
          {success}<span style={{ fontSize: size * 0.07, opacity: 0.6, fontWeight: 500 }}>%</span>
        </div>
        <div style={{
          fontFamily: 'var(--sans)',
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          marginTop: 6,
          fontWeight: 600,
        }}>
          Probabilité de succès
        </div>
      </div>
      {/* Bornes 0 et 100 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 10,
        color: 'var(--muted-soft)',
        padding: '0 4px',
        marginTop: -size * 0.05,
        fontFamily: 'var(--sans)',
        letterSpacing: '0.04em',
      }}>
        <span>0%</span>
        {failure != null && (
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            risque <strong style={{ fontWeight: 700, color: 'var(--ink-soft)' }}>{failure}%</strong>
          </span>
        )}
        <span>100%</span>
      </div>
    </div>
  );
}
