'use client';

type Player = {
  name: string;
  isTargetCompany?: boolean;
  coverage: boolean[];
};

type Props = {
  dimensions: string[];
  players: Player[];
  differentiationScore?: number;
};

// Matrice concurrentielle visuelle. Remplace le tableau brut √/X par une grille
// de pastilles. Format optimise mobile : criteres en lignes verticales, joueurs
// en lignes horizontales, lecture rapide. La cible est mise en valeur avec un
// fond legerement teinte et un libelle en italique.
export default function CompetitiveMatrix({ dimensions, players, differentiationScore }: Props) {
  if (!dimensions || dimensions.length === 0 || !players || players.length === 0) {
    return null;
  }

  // Largeur de chaque colonne critere : on cap a 11 criteres pour rester lisible mobile
  const visibleDims = dimensions.slice(0, 12);
  const cellSize = 26;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{
        borderCollapse: 'collapse',
        fontSize: 12,
        fontFamily: 'var(--sans, system-ui, sans-serif)',
        minWidth: '100%',
      }}>
        <thead>
          <tr>
            <th style={{
              textAlign: 'left',
              padding: '8px 12px 14px 0',
              fontWeight: 500,
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              opacity: 0.55,
              verticalAlign: 'bottom',
              minWidth: 130,
            }}>
              Acteur
            </th>
            {visibleDims.map((dim, i) => (
              <th key={i} style={{
                padding: '0 2px 8px 2px',
                fontWeight: 400,
                fontSize: 10,
                color: 'rgba(0,0,0,0.65)',
                verticalAlign: 'bottom',
                width: cellSize,
                height: 110,
              }}>
                <div style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  whiteSpace: 'nowrap',
                  textAlign: 'left',
                  margin: '0 auto',
                  letterSpacing: '0.02em',
                }}>
                  {dim}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <tr key={i} style={{
              borderTop: '1px solid rgba(0,0,0,0.08)',
              background: p.isTargetCompany ? 'rgba(122,92,31,0.06)' : 'transparent',
            }}>
              <td style={{
                padding: '10px 12px 10px 0',
                fontWeight: p.isTargetCompany ? 500 : 400,
                fontStyle: p.isTargetCompany ? 'italic' : 'normal',
                color: p.isTargetCompany ? '#7a5c1f' : '#1a1a1a',
                whiteSpace: 'nowrap',
                fontFamily: p.isTargetCompany ? 'var(--serif, Georgia, serif)' : 'inherit',
              }}>
                {p.name}
              </td>
              {visibleDims.map((_, j) => {
                const has = !!p.coverage[j];
                return (
                  <td key={j} style={{ padding: '6px 2px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: has ? (p.isTargetCompany ? '#7a5c1f' : '#1a4d2e') : 'transparent',
                      border: has ? 'none' : '1px solid rgba(0,0,0,0.18)',
                    }} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {differentiationScore != null && (
        <div style={{
          marginTop: 14,
          fontSize: 11,
          letterSpacing: '0.04em',
          color: 'rgba(0,0,0,0.6)',
        }}>
          Score de différenciation : <strong style={{ fontWeight: 500, color: '#1a1a1a' }}>{differentiationScore}/100</strong>
        </div>
      )}
    </div>
  );
}
