// Helpers de formatage partages par les renderers. Aucune
// dependance React state, rien que du rendu. Voix editoriale
// Le Grand Continent : prose dense, peu de listes a puces, pas
// d emojis, pas de gradient, pas d ombre.

import type { ReactNode } from 'react';

export function formatVerdict(v: unknown): string {
  if (typeof v !== 'string') return '—';
  const s = v.trim();
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatScore(n: unknown, suffix = '/100'): string {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  return `${Math.round(n)}${suffix}`;
}

export function formatPercent(n: unknown): string {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  return `${Math.round(n)}%`;
}

export function formatDuration(ms: number | undefined): string {
  if (typeof ms !== 'number' || !isFinite(ms)) return '—';
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s - m * 60);
  return `${m} min ${rem.toString().padStart(2, '0')} s`;
}

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function isNonEmptyArray(v: unknown): v is unknown[] {
  return Array.isArray(v) && v.length > 0;
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Splits a long string into pseudo-paragraphs. Reproduit la
 * logique deja en place ailleurs dans le projet pour conserver
 * la voix editoriale lorsqu un LLM renvoie un blob unique sans
 * retour ligne.
 */
export function splitParagraphs(text: string, target = 3): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  if (cleaned.includes('\n\n')) {
    return cleaned.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  }
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= target) return [cleaned];
  const perParagraph = Math.ceil(sentences.length / target);
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += perParagraph) {
    out.push(sentences.slice(i, i + perParagraph).join(' '));
  }
  return out;
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="toile-section">
      <h3 className="toile-section-title">{title}</h3>
      <div className="toile-section-body">{children}</div>
      <style jsx>{`
        .toile-section {
          margin: 0 0 26px;
        }
        .toile-section-title {
          font-family: var(--sans);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 10px;
          color: var(--muted);
          margin: 0 0 10px;
        }
        .toile-section-body {
          font-family: var(--serif);
          font-size: 14px;
          line-height: 1.65;
          color: var(--ink-soft);
        }
      `}</style>
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="toile-prose">
      {children}
      <style jsx>{`
        .toile-prose :global(p) {
          margin: 0 0 12px;
        }
        .toile-prose :global(p:last-child) {
          margin-bottom: 0;
        }
      `}</style>
    </div>
  );
}

export function KvRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="toile-kv-row">
      <div className="toile-kv-label">{label}</div>
      <div className="toile-kv-value">{value}</div>
      <style jsx>{`
        .toile-kv-row {
          display: grid;
          grid-template-columns: 180px 1fr;
          gap: 16px;
          padding: 8px 0;
          border-bottom: 1px solid var(--hairline);
          align-items: baseline;
        }
        .toile-kv-row:last-child {
          border-bottom: none;
        }
        .toile-kv-label {
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.02em;
          color: var(--muted);
        }
        .toile-kv-value {
          font-family: var(--serif);
          font-size: 14px;
          line-height: 1.55;
          color: var(--ink);
        }
      `}</style>
    </div>
  );
}

export function StatList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="toile-stats">
      {items.map((it, i) => (
        <div key={i} className="toile-stat">
          <div className="toile-stat-label">{it.label}</div>
          <div className="toile-stat-value">{it.value}</div>
        </div>
      ))}
      <style jsx>{`
        .toile-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 16px;
          border-top: 1px solid var(--hairline);
          border-bottom: 1px solid var(--hairline);
          padding: 14px 0;
        }
        .toile-stat {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .toile-stat-label {
          font-family: var(--sans);
          font-size: 10.5px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .toile-stat-value {
          font-family: var(--serif);
          font-size: 18px;
          font-weight: 500;
          color: var(--ink);
        }
      `}</style>
    </div>
  );
}

export function BulletList({ items }: { items: ReactNode[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="toile-bullets">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
      <style jsx>{`
        .toile-bullets {
          margin: 0;
          padding-left: 18px;
        }
        .toile-bullets :global(li) {
          margin: 4px 0;
          font-family: var(--serif);
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--ink-soft);
        }
      `}</style>
    </ul>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="toile-empty">
      <p>{message}</p>
      <style jsx>{`
        .toile-empty {
          padding: 28px 4px;
          font-family: var(--serif);
          font-style: italic;
          font-size: 14px;
          line-height: 1.6;
          color: var(--muted);
          max-width: 460px;
        }
        .toile-empty :global(p) {
          margin: 0;
        }
      `}</style>
    </div>
  );
}
