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

export function OrchestratorRenderer({ output }: ToileRendererProps) {
  if (!isPlainObject(output)) {
    return (
      <EmptyState message="La synthese finale n est pas disponible pour cette analyse. Le moteur d orchestration n a soit pas tourne, soit echoue avant production." />
    );
  }

  const o = output;
  const verdict = formatVerdict(o.verdict);
  const globalScore = o.globalScore;
  const successProbability = o.successProbability;
  const failureProbability = o.failureProbability;
  const argumentation = isNonEmptyString(o.argumentation) ? o.argumentation : null;
  const keyConditions = isNonEmptyArray(o.keyConditions) ? o.keyConditions : null;
  const decisionDrivers = isNonEmptyArray(o.decisionDrivers) ? o.decisionDrivers : null;
  const dialectical = isPlainObject(o.blindspotsVsContrarian)
    ? o.blindspotsVsContrarian
    : null;
  const threshold = isPlainObject(o.investmentThreshold) ? o.investmentThreshold : null;
  const degraded = o.degraded === true;
  const degradedReason = isNonEmptyString(o.degradedReason) ? o.degradedReason : null;

  return (
    <div>
      {degraded && (
        <Section title="Mode degrade">
          <Prose>
            <p>
              La synthese finale a ete produite en mode degrade : l orchestrateur
              n a pas pu agreger tous les moteurs. Les scores et le verdict
              ci-dessous sont indicatifs.
            </p>
            {degradedReason && (
              <p style={{ fontStyle: 'italic', color: 'var(--muted)' }}>
                Cause : {degradedReason}
              </p>
            )}
          </Prose>
        </Section>
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
                {splitParagraphs(dialectical.resolution as string, 2).map((p, i) => (
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

      {decisionDrivers && (
        <Section title="Decision drivers">
          <BulletList items={decisionDrivers.map((d) => (typeof d === 'string' ? d : JSON.stringify(d)))} />
        </Section>
      )}

      {keyConditions && (
        <Section title="Conditions cles">
          <BulletList items={keyConditions.map((c) => (typeof c === 'string' ? c : JSON.stringify(c)))} />
        </Section>
      )}
    </div>
  );
}
