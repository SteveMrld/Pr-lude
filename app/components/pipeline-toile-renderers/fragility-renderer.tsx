// ============================================================
// Renderer dedie : fragility-structurelle
// ------------------------------------------------------------
// La sortie globale est FragiliteStructurelleAnalysisOutput (cf
// lib/engines/fragility-structurelle/types.ts). On affiche en
// tete le score global et le verdict, la synthese editoriale,
// les combinaisons diagnostiques cross-patterns quand elles
// existent (Trajectoire WeWork, Pattern Britishvolt, etc.), puis
// la liste des sept patterns avec leur applicabilite, leur score
// individuel et leur verdict. Le drill-down par pattern est
// volontairement compact a ce niveau : la note d instruction
// reste l endroit ou on lit le detail.
// ============================================================

import type { ToileRendererProps } from './types';
import {
  Section,
  Prose,
  StatList,
  BulletList,
  EmptyState,
  isPlainObject,
  isNonEmptyArray,
  isNonEmptyString,
  formatVerdict,
  formatScore,
  splitParagraphs,
} from './format';

const PATTERN_LABELS: Record<string, string> = {
  'growth-subsidized': 'Croissance subventionnee',
  'infrastructure-hostage': 'Captivite infrastructure',
  'fixed-cost-trap': 'Couts fixes incompressibles',
  'regulatory-time-bomb': 'Regulation a venir',
  'commoditization-drift': 'Derive de commoditisation',
  'capital-structure-fragility': 'Fragilite cap table',
  'scale-mirage-risk': 'Mirage de scale',
};

const SEVERITE_TONE: Record<string, string> = {
  attention: 'var(--ink-soft)',
  alerte: 'var(--ocre-brule)',
  'drapeau-rouge': 'var(--ocre-brule)',
};

export function FragilityRenderer({ output }: ToileRendererProps) {
  if (!isPlainObject(output)) {
    return (
      <EmptyState message="Le moteur Fragilite structurelle n a pas produit de sortie sur cette analyse. Soit la matrice de pertinence l a desactive, soit l execution a echoue." />
    );
  }

  const o = output;
  const globalScore = o.globalFragilityScore;
  const verdict = formatVerdict(o.verdict);
  const resumeEditorial = isNonEmptyString(o.resumeEditorial) ? o.resumeEditorial : null;
  const combinaisons = isNonEmptyArray(o.combinaisons) ? o.combinaisons : null;
  const patterns = isPlainObject(o.patterns) ? o.patterns : null;
  const recommandationsDD = isNonEmptyArray(o.recommandationsDD) ? o.recommandationsDD : null;

  return (
    <div>
      <Section title="Verdict global">
        <div style={{
          fontFamily: 'var(--serif)',
          fontSize: 22,
          fontWeight: 500,
          color: 'var(--ink)',
          letterSpacing: '-0.01em',
          textTransform: 'capitalize',
          marginBottom: 14,
        }}>
          {verdict}
        </div>
        <StatList
          items={[
            { label: 'Score de fragilite', value: formatScore(globalScore) },
            {
              label: 'Patterns analyses',
              value: patterns ? Object.keys(patterns).length : '—',
            },
            {
              label: 'Combinaisons detectees',
              value: combinaisons ? combinaisons.length : 0,
            },
          ]}
        />
      </Section>

      {resumeEditorial && (
        <Section title="Synthese">
          <Prose>
            {splitParagraphs(resumeEditorial, 3).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </Prose>
        </Section>
      )}

      {combinaisons && (
        <Section title="Combinaisons diagnostiques">
          <div>
            {combinaisons.map((c, i) => {
              if (!isPlainObject(c)) return null;
              const nom = isNonEmptyString(c.nom) ? c.nom : 'Combinaison';
              const rationale = isNonEmptyString(c.rationale) ? c.rationale : null;
              const severite = typeof c.severite === 'string' ? c.severite : 'attention';
              const patternList = isNonEmptyArray(c.patterns)
                ? (c.patterns as unknown[])
                    .filter((p): p is string => typeof p === 'string')
                    .map((p) => PATTERN_LABELS[p] ?? p)
                : [];
              return (
                <div key={i} style={{
                  padding: '14px 0',
                  borderBottom: i < combinaisons.length - 1 ? '1px solid var(--hairline)' : 'none',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 6,
                  }}>
                    <strong style={{
                      fontFamily: 'var(--serif)',
                      fontSize: 15,
                      color: 'var(--ink)',
                    }}>
                      {nom}
                    </strong>
                    <span style={{
                      fontFamily: 'var(--sans)',
                      fontSize: 10.5,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: SEVERITE_TONE[severite] ?? 'var(--muted)',
                    }}>
                      {severite.replace('-', ' ')}
                    </span>
                  </div>
                  {patternList.length > 0 && (
                    <p style={{
                      margin: '0 0 6px',
                      fontFamily: 'var(--sans)',
                      fontSize: 11,
                      color: 'var(--muted)',
                    }}>
                      Patterns : {patternList.join(', ')}
                    </p>
                  )}
                  {rationale && (
                    <p style={{
                      margin: 0,
                      fontFamily: 'var(--serif)',
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      color: 'var(--ink-soft)',
                    }}>
                      {rationale}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {patterns && (
        <Section title="Patterns">
          <div>
            {Object.entries(patterns).map(([id, p], i, arr) => {
              const label = PATTERN_LABELS[id] ?? id;
              if (!isPlainObject(p)) {
                return (
                  <div key={id} style={{
                    padding: '10px 0',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--hairline)' : 'none',
                  }}>
                    <strong style={{ fontFamily: 'var(--serif)', fontSize: 14 }}>{label}</strong>
                    <span style={{
                      marginLeft: 10,
                      fontFamily: 'var(--sans)',
                      fontSize: 11,
                      color: 'var(--muted)',
                    }}>
                      non applicable
                    </span>
                  </div>
                );
              }
              const pVerdict = formatVerdict(p.verdict);
              const pScore = p.globalScore;
              const applicabilite = isNonEmptyString(p.applicabilite) ? p.applicabilite : null;
              const resume = isNonEmptyString(p.resumeEditorial) ? p.resumeEditorial : null;
              return (
                <div key={id} style={{
                  padding: '12px 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--hairline)' : 'none',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 4,
                  }}>
                    <strong style={{ fontFamily: 'var(--serif)', fontSize: 14.5, color: 'var(--ink)' }}>
                      {label}
                    </strong>
                    <span style={{
                      fontFamily: 'var(--sans)',
                      fontSize: 11,
                      color: 'var(--muted)',
                    }}>
                      {formatScore(pScore)} · {pVerdict}
                    </span>
                  </div>
                  {applicabilite && applicabilite !== 'full' && (
                    <p style={{
                      margin: '0 0 6px',
                      fontFamily: 'var(--sans)',
                      fontSize: 10.5,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                    }}>
                      Applicabilite : {applicabilite}
                    </p>
                  )}
                  {resume && (
                    <p style={{
                      margin: 0,
                      fontFamily: 'var(--serif)',
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      color: 'var(--ink-soft)',
                    }}>
                      {resume}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {recommandationsDD && (
        <Section title="Recommandations DD">
          <BulletList items={recommandationsDD.map((r) => (typeof r === 'string' ? r : JSON.stringify(r)))} />
        </Section>
      )}
    </div>
  );
}
