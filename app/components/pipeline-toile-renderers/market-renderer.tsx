// ============================================================
// Renderer dedie : market
// ------------------------------------------------------------
// La sortie du moteur Marche est riche en sous-blocs (taille
// percue, intensite besoin, defensibilite, signaux organiques,
// dynamique concurrentielle, benchmarks internationaux). On
// expose ici les axes que la note d instruction consomme deja :
// taille percue, intensite, saturation, score de defensibilite,
// moats et vulnerabilites, signaux organiques, marketSizing
// TAM/SAM/SOM, dynamique concurrentielle resumee.
//
// Les autres axes (matrice competitive complete, benchmarks
// internationaux longs) restent consultables dans le dashboard
// analytique : on ne les duplique pas dans le drill-down.
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
  formatScore,
  splitParagraphs,
} from './format';

function capitalize(s: string): string {
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function MarketRenderer({ output }: ToileRendererProps) {
  if (!isPlainObject(output)) {
    return (
      <EmptyState message="Le moteur Marche n a pas produit de sortie sur cette analyse." />
    );
  }

  const o = output;
  const perceivedSize = isNonEmptyString(o.perceivedSize) ? capitalize(o.perceivedSize) : '—';
  const realIntensity = isNonEmptyString(o.realIntensity) ? capitalize(o.realIntensity) : '—';
  const saturation = isNonEmptyString(o.saturation) ? capitalize(o.saturation) : '—';

  const needIntensity = isPlainObject(o.needIntensity) ? o.needIntensity : null;
  const organicSignals = isPlainObject(o.organicSignals) ? o.organicSignals : null;
  const defensibility = isPlainObject(o.defensibility) ? o.defensibility : null;
  const marketSizing = isPlainObject(o.marketSizing) ? o.marketSizing : null;
  const competitiveDynamic = isNonEmptyString(o.competitiveDynamic)
    ? (o.competitiveDynamic as string)
    : null;
  const moats = defensibility && isNonEmptyArray(defensibility.moats)
    ? defensibility.moats.filter((m): m is string => typeof m === 'string')
    : null;
  const vulnerabilities = defensibility && isNonEmptyArray(defensibility.vulnerabilities)
    ? defensibility.vulnerabilities.filter((v): v is string => typeof v === 'string')
    : null;

  return (
    <div>
      <Section title="Lecture rapide">
        <StatList
          items={[
            { label: 'Taille percue', value: perceivedSize },
            { label: 'Intensite reelle', value: realIntensity },
            { label: 'Saturation', value: saturation },
            {
              label: 'Score defensibilite',
              value: defensibility && typeof defensibility.score === 'number'
                ? formatScore(defensibility.score)
                : '—',
            },
          ]}
        />
      </Section>

      {needIntensity && isNonEmptyString(needIntensity.rationale) && (
        <Section title="Intensite du besoin">
          <Prose>
            {splitParagraphs(needIntensity.rationale as string, 2).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {isNonEmptyString(needIntensity.gap) && (
              <p>
                <strong>Gap : </strong>
                {needIntensity.gap as string}
              </p>
            )}
          </Prose>
        </Section>
      )}

      {organicSignals && (isNonEmptyString(organicSignals.rationale) || typeof organicSignals.score === 'number') && (
        <Section title="Signaux organiques">
          {typeof organicSignals.score === 'number' && (
            <StatList
              items={[{ label: 'Score', value: formatScore(organicSignals.score) }]}
            />
          )}
          {isNonEmptyString(organicSignals.rationale) && (
            <div style={{ marginTop: 12 }}>
              <Prose>
                {splitParagraphs(organicSignals.rationale as string, 2).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </Prose>
            </div>
          )}
        </Section>
      )}

      {(moats || vulnerabilities) && (
        <Section title="Defensibilite">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 18,
          }}>
            {moats && (
              <div>
                <h4 style={{
                  margin: '0 0 8px',
                  fontFamily: 'var(--sans)',
                  fontSize: 10.5,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                }}>
                  Moats
                </h4>
                <BulletList items={moats} />
              </div>
            )}
            {vulnerabilities && (
              <div>
                <h4 style={{
                  margin: '0 0 8px',
                  fontFamily: 'var(--sans)',
                  fontSize: 10.5,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                }}>
                  Vulnerabilites
                </h4>
                <BulletList items={vulnerabilities} />
              </div>
            )}
          </div>
        </Section>
      )}

      {marketSizing && (
        <Section title="Sizing">
          <StatList
            items={[
              {
                label: 'TAM',
                value: isNonEmptyString(marketSizing.tam) ? marketSizing.tam as string : '—',
              },
              {
                label: 'SAM',
                value: isNonEmptyString(marketSizing.sam) ? marketSizing.sam as string : '—',
              },
              {
                label: 'SOM',
                value: isNonEmptyString(marketSizing.som) ? marketSizing.som as string : '—',
              },
            ]}
          />
          {isNonEmptyString(marketSizing.rationale) && (
            <div style={{ marginTop: 14 }}>
              <Prose>
                {splitParagraphs(marketSizing.rationale as string, 2).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </Prose>
            </div>
          )}
        </Section>
      )}

      {competitiveDynamic && (
        <Section title="Dynamique concurrentielle">
          <Prose>
            {splitParagraphs(competitiveDynamic, 2).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </Prose>
        </Section>
      )}
    </div>
  );
}
