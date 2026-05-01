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

  // Couleur de l'arc plein selon le niveau de succes : encre fonce >= 65,
  // gris medium 45-64, gris clair < 45 (sobre, editorial).
  const successColor = success >= 65 ? '#1a4d2e' : success >= 45 ? '#7a5c1f' : '#7a1f1f';

  return (
    <div style={{ width: size, position: 'relative', display: 'inline-block' }}>
      <svg width={size} height={size * 0.78} viewBox={`0 0 ${size} ${size * 0.78}`}>
        {/* Arc de fond */}
        <path
          d={`M ${startPt.x} ${startPt.y} A ${r} ${r} 0 0 1 ${endPt.x} ${endPt.y}`}
          stroke="rgba(0,0,0,0.08)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="butt"
        />
        {/* Arc de succes */}
        {success > 0 && (
          <path
            d={`M ${startPt.x} ${startPt.y} A ${r} ${r} 0 ${success > 50 ? 1 : 0} 1 ${successEndPt.x} ${successEndPt.y}`}
            stroke={successColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="butt"
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
              stroke="rgba(0,0,0,0.25)"
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
          fontFamily: 'var(--serif, Georgia, serif)',
          fontWeight: 500,
          lineHeight: 1,
          color: successColor,
        }}>
          {success}<span style={{ fontSize: size * 0.07, opacity: 0.6 }}>%</span>
        </div>
        <div style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          opacity: 0.55,
          marginTop: 4,
        }}>
          Probabilité de succès
        </div>
      </div>
      {/* Bornes 0 et 100 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 10,
        opacity: 0.5,
        padding: '0 4px',
        marginTop: -size * 0.05,
      }}>
        <span>0%</span>
        {failure != null && (
          <span style={{ fontSize: 11, opacity: 0.7 }}>
            risque <strong style={{ fontWeight: 500 }}>{failure}%</strong>
          </span>
        )}
        <span>100%</span>
      </div>
    </div>
  );
}
