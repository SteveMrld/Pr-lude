'use client';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, PolarRadiusAxis } from 'recharts';

type Dimension = {
  dimensionName: string;
  successProbability: number;
  weight: number;
  riskScore?: number;
};

type Props = {
  dimensions: Dimension[];
  verdict?: string;
};

// Couleur du radar en fonction du verdict global. Codes couleur sobres editoriaux,
// pas de neon : encre fonce pour 'passer', gris pour 'conditionnel', rouge sombre
// pour 'refuser'. Reste fidele a la palette Idinvest factsheet.
function colorFromVerdict(verdict?: string): string {
  if (!verdict) return '#1a1a1a';
  const v = verdict.toLowerCase();
  if (v.includes('passer') || v.includes('aller') || v.includes('go')) return '#1a4d2e';
  if (v.includes('refuser') || v.includes('reject') || v.includes('no-go')) return '#7a1f1f';
  if (v.includes('condition') || v.includes('hold')) return '#7a5c1f';
  return '#1a1a1a';
}

export default function RadarDimensions({ dimensions, verdict }: Props) {
  if (!dimensions || dimensions.length === 0) return null;

  // Recharts attend un format { dimension: 'nom', value: nombre }.
  // On simplifie les noms longs pour qu'ils tiennent autour du radar.
  const data = dimensions.map(d => ({
    dimension: d.dimensionName.length > 18 ? d.dimensionName.slice(0, 16) + '…' : d.dimensionName,
    fullName: d.dimensionName,
    value: d.successProbability,
    weight: d.weight,
  }));

  const stroke = colorFromVerdict(verdict);

  return (
    <div style={{ width: '100%', height: 380 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 24, right: 32, bottom: 24, left: 32 }}>
          <PolarGrid stroke="rgba(0,0,0,0.12)" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fontSize: 11, fill: '#1a1a1a', fontFamily: 'var(--serif, Georgia, serif)' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: 'rgba(0,0,0,0.4)' }}
            tickCount={5}
            axisLine={false}
          />
          <Radar
            name="Probabilité de succès"
            dataKey="value"
            stroke={stroke}
            fill={stroke}
            fillOpacity={0.18}
            strokeWidth={1.5}
            isAnimationActive={true}
            animationDuration={600}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
