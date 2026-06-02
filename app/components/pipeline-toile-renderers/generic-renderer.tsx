// ============================================================
// Renderer generique
// ------------------------------------------------------------
// Filet de securite : tout moteur sans renderer dedie passe par
// ici. La logique est volontairement simple : on parcourt l
// output en distinguant scalaires, listes courtes, objets, et on
// les rend dans la voix editoriale. Aucun dump JSON brut, aucune
// coloration syntaxique facon IDE. Si l output est totalement
// vide, on affiche un etat sobre.
//
// Le rendu privilegie la lisibilite sur l exhaustivite : on
// coupe les chaines tres longues a 600 caracteres, on limite les
// listes a 24 items affiches, on ne descend pas plus de deux
// niveaux d objets imbriques. Cela garantit qu un drill-down
// reste consultable a l ecran sans devoir scroller dix pages,
// et que des moteurs aux outputs encore non specifies ne cassent
// pas la planche.
// ============================================================

import type { ReactNode } from 'react';
import type { ToileRendererProps } from './types';
import {
  Section,
  EmptyState,
  KvRow,
  BulletList,
  isPlainObject,
} from './format';

const MAX_STRING_LENGTH = 600;
const MAX_LIST_ITEMS = 24;
const MAX_DEPTH = 2;

function isScalar(v: unknown): v is string | number | boolean | null {
  return (
    v === null ||
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean'
  );
}

function humanizeKey(k: string): string {
  // Coupe camelCase et kebab-case, met en majuscule la premiere
  // lettre. La table dediee s arrete au cas commun ; la voix
  // editoriale finale est portee par les renderers types.
  if (!k) return '';
  const spaced = k
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function truncate(s: string): string {
  if (s.length <= MAX_STRING_LENGTH) return s;
  return s.slice(0, MAX_STRING_LENGTH - 1).trimEnd() + '…';
}

function renderScalar(v: unknown): ReactNode {
  if (v === null) return <em style={{ color: 'var(--muted)' }}>néant</em>;
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  if (typeof v === 'number') {
    if (!isFinite(v)) return '—';
    return Number.isInteger(v) ? v.toString() : v.toFixed(2);
  }
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return <em style={{ color: 'var(--muted)' }}>vide</em>;
    return truncate(t);
  }
  return String(v);
}

function renderArray(arr: unknown[], depth: number): ReactNode {
  if (arr.length === 0) {
    return <em style={{ color: 'var(--muted)' }}>liste vide</em>;
  }
  const truncated = arr.slice(0, MAX_LIST_ITEMS);
  const overflow = arr.length - truncated.length;

  if (truncated.every(isScalar)) {
    return (
      <>
        <BulletList
          items={truncated.map((v) => renderScalar(v))}
        />
        {overflow > 0 && (
          <p style={{
            margin: '6px 0 0',
            fontFamily: 'var(--serif)',
            fontSize: 12,
            fontStyle: 'italic',
            color: 'var(--muted)',
          }}>
            … et {overflow} autre{overflow > 1 ? 's' : ''} element{overflow > 1 ? 's' : ''}.
          </p>
        )}
      </>
    );
  }

  if (depth >= MAX_DEPTH) {
    return (
      <p style={{ fontStyle: 'italic', color: 'var(--muted)', margin: 0 }}>
        {arr.length} element{arr.length > 1 ? 's' : ''} structures, non deplies a ce niveau.
      </p>
    );
  }

  return (
    <div>
      {truncated.map((v, i) => (
        <div key={i} style={{
          padding: '10px 0',
          borderBottom: i < truncated.length - 1 ? '1px solid var(--hairline)' : 'none',
        }}>
          <div style={{
            fontFamily: 'var(--sans)',
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: 6,
          }}>
            Element {i + 1}
          </div>
          {renderValue(v, depth + 1)}
        </div>
      ))}
      {overflow > 0 && (
        <p style={{
          margin: '12px 0 0',
          fontFamily: 'var(--serif)',
          fontSize: 12,
          fontStyle: 'italic',
          color: 'var(--muted)',
        }}>
          … et {overflow} autre{overflow > 1 ? 's' : ''} element{overflow > 1 ? 's' : ''}.
        </p>
      )}
    </div>
  );
}

function renderObject(obj: Record<string, unknown>, depth: number): ReactNode {
  const entries = Object.entries(obj);
  if (entries.length === 0) {
    return <em style={{ color: 'var(--muted)' }}>objet vide</em>;
  }

  // Si tout est scalaire, on rend une table kv compacte
  if (entries.every(([, v]) => isScalar(v))) {
    return (
      <div>
        {entries.map(([k, v]) => (
          <KvRow key={k} label={humanizeKey(k)} value={renderScalar(v)} />
        ))}
      </div>
    );
  }

  if (depth >= MAX_DEPTH) {
    return (
      <p style={{ fontStyle: 'italic', color: 'var(--muted)', margin: 0 }}>
        {entries.length} champ{entries.length > 1 ? 's' : ''} structures, non deplies a ce niveau.
      </p>
    );
  }

  return (
    <div>
      {entries.map(([k, v]) => (
        <div key={k} style={{ marginBottom: 14 }}>
          <div style={{
            fontFamily: 'var(--sans)',
            fontSize: 10.5,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: 6,
          }}>
            {humanizeKey(k)}
          </div>
          {renderValue(v, depth + 1)}
        </div>
      ))}
    </div>
  );
}

function renderValue(v: unknown, depth: number): ReactNode {
  if (isScalar(v)) return renderScalar(v);
  if (Array.isArray(v)) return renderArray(v, depth);
  if (isPlainObject(v)) return renderObject(v, depth);
  return <em style={{ color: 'var(--muted)' }}>valeur non rendable</em>;
}

export function GenericRenderer({ output }: ToileRendererProps) {
  if (output === null || output === undefined) {
    return (
      <EmptyState message="Aucune sortie disponible pour ce moteur. Soit il n a pas tourne sur cette analyse, soit son output n est pas remonte dans le flux SSE ni dans le result_json." />
    );
  }

  if (isScalar(output)) {
    return (
      <Section title="Sortie">
        <p style={{ margin: 0 }}>{renderScalar(output)}</p>
      </Section>
    );
  }

  if (Array.isArray(output)) {
    return (
      <Section title="Sortie">
        {renderArray(output, 0)}
      </Section>
    );
  }

  if (isPlainObject(output)) {
    const entries = Object.entries(output);
    if (entries.length === 0) {
      return (
        <EmptyState message="L output existe mais ne contient aucun champ. Le moteur a tourne sans rien produire d exploitable." />
      );
    }
    // Premier niveau : une section par cle de premier niveau. Cela
    // restitue la structure intuitive d un output moteur (verdict,
    // score, rationale, signaux, etc.).
    return (
      <div>
        {entries.map(([k, v]) => (
          <Section key={k} title={humanizeKey(k)}>
            {renderValue(v, 1)}
          </Section>
        ))}
      </div>
    );
  }

  return (
    <EmptyState message="Le format de cette sortie n est pas reconnu par le renderer generique." />
  );
}
