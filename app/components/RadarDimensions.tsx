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

// Mapping des noms longs vers des labels courts adaptes a l affichage radar.
// Les labels longs (Singularites contrariennes, Vigilance critique / risques,
// Modele economique) etaient tronques a 16 caracteres avec ellipsis, ce qui
// donnait sur le PDF Platypus des libelles peu lisibles : Macro / t...,
// Singularites con..., Vigilance critiq.... On utilise des labels courts mais
// reconnaissables, et un fallback sur la troncation si le nom de dimension
// n est pas dans le mapping.
const SHORT_LABELS: Record<string, string> = {
  'Équipe': 'Équipe',
  'Equipe': 'Equipe',
  'Marché': 'Marché',
  'Marche': 'Marche',
  'Macro / timing': 'Macro',
  'Macro/ timing': 'Macro',
  'Modèle économique': 'Modèle éco.',
  'Modele economique': 'Modele eco.',
  'Singularités contrariennes': 'Contrariens',
  'Singularites contrariennes': 'Contrariens',
  'Vigilance critique / risques': 'Vigilance',
  'Vigilance critique/risques': 'Vigilance',
};

function shortLabel(name: string): string {
  if (SHORT_LABELS[name]) return SHORT_LABELS[name];
  // Fallback : tronquer a 14 caracteres pour eviter coupure visuelle dans le radar
  if (name.length > 14) return name.slice(0, 12) + '…';
  return name;
}

export default function RadarDimensions({ dimensions, verdict }: Props) {
  if (!dimensions || dimensions.length === 0) return null;

  // Format Recharts : { dimension, fullName, value, weight }
  const data = dimensions.map(d => ({
    dimension: shortLabel(d.dimensionName),
    fullName: d.dimensionName,
    value: d.successProbability,
    weight: d.weight,
  }));

  const stroke = colorFromVerdict(verdict);

  return (
    <div style={{ width: '100%', height: 380 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 28, right: 56, bottom: 28, left: 56 }}>
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
