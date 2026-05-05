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
// Recharts ne resout pas les CSS variables sur strokes/fills, il faut donner
// des hex. On reprend les valeurs des tokens du design system (en sync avec
// app/globals.css) :
//   ink (#0f172a) pour neutre, vert-foret (#15803d) pour passer,
//   warn (#b91c1c) pour refuser, ocre-brule (#b45309) pour condition.
function colorFromVerdict(verdict?: string): string {
  if (!verdict) return '#0f172a';
  const v = verdict.toLowerCase();
  if (v.includes('passer') || v.includes('aller') || v.includes('go')) return '#15803d';
  if (v.includes('refuser') || v.includes('reject') || v.includes('no-go')) return '#b91c1c';
  if (v.includes('condition') || v.includes('hold')) return '#b45309';
  return '#0f172a';
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
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fontSize: 11, fill: '#0f172a', fontFamily: 'var(--serif, Georgia, serif)' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            tickCount={5}
            axisLine={false}
          />
          <Radar
            name="Probabilité de succès"
            dataKey="value"
            stroke={stroke}
            fill={stroke}
            fillOpacity={0.16}
            strokeWidth={1.75}
            isAnimationActive={true}
            animationDuration={600}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
