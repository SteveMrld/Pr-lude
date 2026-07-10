// ============================================================
// Renderer dedie : orchestrate (finalRecommendation)
// ------------------------------------------------------------
// Sortie la plus riche du pipeline. Reproduit la structure
// d analyse deja consommee par la note d instruction : verdict,
// trois probabilites cles (globalScore, successProbability,
// failureProbability), seuils d investissement, resolution
// dialectique blindspots / contrarien, decision drivers et
// conditions cles. On reste tres defensif sur le shape : tout
// est optionnel, chaque section disparait si elle n est pas
// disponible.
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
  formatPercent,
  splitParagraphs,
} from './format';
import {
  sanitizeNarrative,
  sanitizeNarrativeList,
  sectionFallbackCopy,
} from '@/lib/note/section-fallback';

export function OrchestratorRenderer({ output }: ToileRendererProps) {
  if (!isPlainObject(output)) {
    return (
      <EmptyState message={sectionFallbackCopy('orchestrator')} />
    );
  }

  const o = output;
  const verdict = formatVerdict(o.verdict);
  const globalScore = o.globalScore;
  const successProbability = o.successProbability;
  const failureProbability = o.failureProbability;
  const rawArgumentation = isNonEmptyString(o.argumentation) ? o.argumentation : null;
  const argumentation = rawArgumentation
    ? sanitizeNarrative(rawArgumentation, 'orchestrator')
    : null;
  const keyConditions = isNonEmptyArray(o.keyConditions)
    ? sanitizeNarrativeList(o.keyConditions, 'orchestrator')
    : null;
  const decisionDrivers = isNonEmptyArray(o.decisionDrivers)
    ? sanitizeNarrativeList(o.decisionDrivers, 'orchestrator')
    : null;
  const dialectical = isPlainObject(o.blindspotsVsContrarian)
    ? o.blindspotsVsContrarian
    : null;
  const threshold = isPlainObject(o.investmentThreshold) ? o.investmentThreshold : null;
  const degraded = o.degraded === true;

  return (
    <div>
      {degraded && (
        <p
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--muted, #5c5348)',
            marginBottom: 18,
            paddingBottom: 12,
            borderBottom: '1px solid var(--paper-accent, #e8dfcc)',
          }}
        >
          {sectionFallbackCopy('orchestrator')}
        </p>
      )}

      <Section title="Verdict">
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
            { label: 'Score global', value: formatScore(globalScore) },
            { label: 'Probabilite succes', value: formatPercent(successProbability) },
            { label: 'Probabilite echec', value: formatPercent(failureProbability) },
          ]}
        />
      </Section>

      {argumentation && (
        <Section title="Argumentation">
          <Prose>
            {splitParagraphs(argumentation, 3).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </Prose>
        </Section>
      )}

      {dialectical && (
        <Section title="Dialectique blindspots / contrarien">
          {(typeof dialectical.blindspotsWeight === 'number' ||
            typeof dialectical.contrarianWeight === 'number') && (
            <StatList
              items={[
                {
                  label: 'Poids blindspots',
                  value: formatScore(dialectical.blindspotsWeight, '/10'),
                },
                {
                  label: 'Poids contrarien',
                  value: formatScore(dialectical.contrarianWeight, '/10'),
                },
              ]}
            />
          )}
          {isNonEmptyString(dialectical.resolution) && (
            <div style={{ marginTop: 14 }}>
              <Prose>
                {splitParagraphs(
                  sanitizeNarrative(dialectical.resolution, 'orchestrator'),
                  2,
                ).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </Prose>
            </div>
          )}
        </Section>
      )}

      {threshold && (
        <Section title="Seuils d investissement">
          <StatList
            items={[
              {
                label: 'Approfondir',
                value: formatScore(threshold.thresholdToInvestigate),
              },
              {
                label: 'Conditions',
                value: formatScore(threshold.thresholdToCondition),
              },
              {
                label: 'Investir',
                value: formatScore(threshold.thresholdToInvest),
              },
              {
                label: 'Niveau atteint',
                value: formatScore(threshold.currentLevel ?? globalScore),
              },
            ]}
          />
        </Section>
      )}

      {decisionDrivers && decisionDrivers.length > 0 && (
        <Section title="Decision drivers">
          <BulletList items={decisionDrivers} />
        </Section>
      )}

      {keyConditions && keyConditions.length > 0 && (
        <Section title="Conditions cles">
          <BulletList items={keyConditions} />
        </Section>
      )}
    </div>
  );
}
