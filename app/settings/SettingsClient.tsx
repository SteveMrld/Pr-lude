'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SourceDescriptor } from '@/lib/sources';
import type { OrgApiKeyRow } from '@/lib/auth/api-keys';

interface Props {
  orgName: string;
  orgRole: 'admin' | 'member';
  userEmail: string;
  byokSources: SourceDescriptor[];
  configuredKeys: OrgApiKeyRow[];
}

type LocalState = {
  // Map sourceId -> (entree en cours d edition par l utilisateur)
  drafts: Record<string, string>;
  // sourceId actuellement en cours de save / delete
  busyId: string | null;
  // sourceId -> message d erreur courant
  errors: Record<string, string>;
  // sourceId -> message de succes ephemere
  successes: Record<string, string>;
  // Map sourceId -> apercu masque (synchronise avec la base)
  knownKeys: Record<string, OrgApiKeyRow>;
};

export default function SettingsClient({
  orgName,
  orgRole,
  userEmail,
  byokSources,
  configuredKeys,
}: Props) {
  const initialKnown: Record<string, OrgApiKeyRow> = {};
  for (const k of configuredKeys) initialKnown[k.source_id] = k;

  const [state, setState] = useState<LocalState>({
    drafts: {},
    busyId: null,
    errors: {},
    successes: {},
    knownKeys: initialKnown,
  });

  function setDraft(sourceId: string, value: string) {
    setState((s) => ({ ...s, drafts: { ...s.drafts, [sourceId]: value } }));
  }

  async function handleSave(sourceId: string) {
    const draft = (state.drafts[sourceId] || '').trim();
    if (!draft) return;
    setState((s) => ({ ...s, busyId: sourceId, errors: { ...s.errors, [sourceId]: '' } }));
    try {
      const res = await fetch('/api/api-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, key: draft }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erreur ${res.status}`);
      }
      // Recharge la liste pour refleter le nouveau masked_preview
      const list = await fetch('/api/api-keys').then((r) => r.json());
      const known: Record<string, OrgApiKeyRow> = {};
      for (const k of (list.keys || []) as OrgApiKeyRow[]) known[k.source_id] = k;
      setState((s) => ({
        ...s,
        busyId: null,
        drafts: { ...s.drafts, [sourceId]: '' },
        knownKeys: known,
        successes: { ...s.successes, [sourceId]: 'Clé enregistrée' },
      }));
      setTimeout(() => {
        setState((s) => ({ ...s, successes: { ...s.successes, [sourceId]: '' } }));
      }, 2500);
    } catch (err: any) {
      setState((s) => ({
        ...s,
        busyId: null,
        errors: { ...s.errors, [sourceId]: err?.message || 'Erreur' },
      }));
    }
  }

  async function handleDelete(sourceId: string) {
    if (!confirm('Supprimer cette clé ? Les analyses utilisant cette source ne pourront plus être enrichies.')) {
      return;
    }
    setState((s) => ({ ...s, busyId: sourceId, errors: { ...s.errors, [sourceId]: '' } }));
    try {
      const res = await fetch(`/api/api-keys?sourceId=${encodeURIComponent(sourceId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erreur ${res.status}`);
      }
      setState((s) => {
        const newKnown = { ...s.knownKeys };
        delete newKnown[sourceId];
        return { ...s, busyId: null, knownKeys: newKnown };
      });
    } catch (err: any) {
      setState((s) => ({
        ...s,
        busyId: null,
        errors: { ...s.errors, [sourceId]: err?.message || 'Erreur' },
      }));
    }
  }

  // Groupe les sources par tier
  const tier2 = byokSources.filter((s) => s.tier === 2);
  const tier1Optional = byokSources.filter((s) => s.tier === 1);
  const tier3 = byokSources.filter((s) => s.tier === 3);

  const isReadonly = orgRole !== 'admin';

  return (
    <main className="settings-main">
      <header className="settings-header">
        <Link href="/" className="settings-back">← Retour à l&apos;analyse</Link>
        <div className="settings-header-id">
          <div className="settings-org-name">{orgName}</div>
          <div className="settings-user-email">{userEmail}</div>
        </div>
      </header>

      <section className="settings-intro">
        <div className="settings-kicker">Configuration</div>
        <h1 className="settings-title">Sources de données externes</h1>
        <p className="settings-lede">
          Prélude exploite par défaut les sources publiques (registres officiels, brevets,
          publications scientifiques, code public). Vous pouvez enrichir l&apos;analyse en
          branchant vos abonnements professionnels via vos clés API. Chaque clé est chiffrée
          côté serveur et n&apos;apparaît jamais en clair après saisie.
        </p>
        {isReadonly && (
          <div className="settings-readonly">
            Mode lecture seule. Seul un administrateur de l&apos;organisation peut modifier les clés.
          </div>
        )}
      </section>

      {tier2.length > 0 && (
        <SourceGroup
          title="Tier 2 — Sources premium"
          subtitle="Deal data, intelligence corporate, données financières institutionnelles. Activation recommandée pour une instruction comparable à celle d&apos;une équipe d&apos;associés senior."
          sources={tier2}
          state={state}
          isReadonly={isReadonly}
          onDraft={setDraft}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {tier1Optional.length > 0 && (
        <SourceGroup
          title="Tier 1 — Sources primaires (optionnel)"
          subtitle="Sources accessibles gratuitement avec un quota limité. L&apos;ajout de votre clé personnelle débloque des quotas plus élevés et accélère l&apos;analyse."
          sources={tier1Optional}
          state={state}
          isReadonly={isReadonly}
          onDraft={setDraft}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {tier3.length > 0 && (
        <SourceGroup
          title="Tier 3 — Signaux complémentaires"
          subtitle="Sources de signaux faibles : profils LinkedIn structurés, communautés produit, mentions presse spécialisée."
          sources={tier3}
          state={state}
          isReadonly={isReadonly}
          onDraft={setDraft}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      <section className="src-group" style={{ marginTop: 12 }}>
        <h2 className="src-group-title">Équipe</h2>
        <p className="src-group-subtitle">
          Invitez les membres de votre fonds à partager les analyses, les notes
          d&apos;investissement et les votes du comité. Les administrateurs gèrent
          les accès et la configuration des sources.
        </p>
        <Link
          href="/settings/members"
          style={{
            display: 'block',
            padding: '18px 22px',
            background: 'var(--surface)',
            border: '1px solid var(--hairline)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'border-color 0.15s',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 500, marginBottom: 4 }}>
                Membres et invitations
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>
                Liste des membres actifs, gestion des rôles, envoi d&apos;invitations par email.
                L&apos;invitation est consommée à la première connexion du destinataire.
              </div>
            </div>
            <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink)', whiteSpace: 'nowrap' }}>
              Gérer →
            </span>
          </div>
        </Link>
      </section>

      <section className="src-group" style={{ marginTop: 12 }}>
        <h2 className="src-group-title">Intégrations</h2>
        <p className="src-group-subtitle">
          Connectez Prélude aux outils de votre fonds pour porter les analyses dans les rituels
          d&apos;instruction quotidiens, sans changement de contexte.
        </p>
        <Link
          href="/settings/slack"
          style={{
            display: 'block',
            padding: '18px 22px',
            background: 'var(--surface)',
            border: '1px solid var(--hairline)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'border-color 0.15s',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 500, marginBottom: 4 }}>
                Slack
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>
                Push automatique des analyses dans un channel du fonds. Alertes distinctes sur
                les verdicts critiques. Configuration par webhook entrant.
              </div>
            </div>
            <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink)', whiteSpace: 'nowrap' }}>
              Configurer →
            </span>
          </div>
        </Link>
      </section>

      <style jsx>{`
        .settings-main {
          max-width: 880px;
          margin: 0 auto;
          padding: 32px 28px 80px;
        }
        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 18px;
          margin-bottom: 36px;
          border-bottom: 1px solid var(--hairline);
        }
        .settings-back {
          font-family: var(--sans);
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
          text-decoration: none;
          transition: color 0.12s;
        }
        .settings-back:hover { color: var(--ink); }
        .settings-header-id {
          text-align: right;
          font-family: var(--sans);
        }
        .settings-org-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--ink);
        }
        .settings-user-email {
          font-size: 11px;
          color: var(--muted);
          margin-top: 2px;
        }
        .settings-intro {
          margin-bottom: 44px;
          max-width: 640px;
        }
        .settings-kicker {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 10px;
        }
        .settings-title {
          font-family: var(--serif);
          font-size: 32px;
          font-weight: 500;
          line-height: 1.2;
          letter-spacing: -0.005em;
          color: var(--ink);
          margin-bottom: 14px;
        }
        .settings-lede {
          font-family: var(--serif);
          font-size: 15.5px;
          line-height: 1.6;
          color: var(--ink-soft);
        }
        .settings-readonly {
          margin-top: 16px;
          padding: 10px 14px;
          background: var(--signal-soft);
          border-left: 3px solid var(--signal);
          font-family: var(--sans);
          font-size: 13px;
          color: var(--signal);
        }
      `}</style>
    </main>
  );
}

// ------------------------------------------------------------
// Sous-composants
// ------------------------------------------------------------

function SourceGroup({
  title,
  subtitle,
  sources,
  state,
  isReadonly,
  onDraft,
  onSave,
  onDelete,
}: {
  title: string;
  subtitle: string;
  sources: SourceDescriptor[];
  state: LocalState;
  isReadonly: boolean;
  onDraft: (sourceId: string, value: string) => void;
  onSave: (sourceId: string) => void;
  onDelete: (sourceId: string) => void;
}) {
  return (
    <section className="src-group">
      <h2 className="src-group-title">{title}</h2>
      <p className="src-group-subtitle">{subtitle}</p>
      <div className="src-list">
        {sources.map((s) => (
          <SourceRow
            key={s.id}
            source={s}
            knownKey={state.knownKeys[s.id]}
            draft={state.drafts[s.id] || ''}
            error={state.errors[s.id] || ''}
            success={state.successes[s.id] || ''}
            busy={state.busyId === s.id}
            isReadonly={isReadonly}
            onDraft={(v) => onDraft(s.id, v)}
            onSave={() => onSave(s.id)}
            onDelete={() => onDelete(s.id)}
          />
        ))}
      </div>
      <style jsx>{`
        .src-group {
          margin-bottom: 56px;
        }
        .src-group-title {
          font-family: var(--serif);
          font-size: 22px;
          font-weight: 500;
          color: var(--ink);
          margin-bottom: 8px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--hairline-strong);
        }
        .src-group-subtitle {
          font-family: var(--serif);
          font-size: 14px;
          line-height: 1.55;
          color: var(--muted);
          margin-bottom: 22px;
          max-width: 640px;
        }
        .src-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
      `}</style>
    </section>
  );
}

function SourceRow({
  source,
  knownKey,
  draft,
  error,
  success,
  busy,
  isReadonly,
  onDraft,
  onSave,
  onDelete,
}: {
  source: SourceDescriptor;
  knownKey?: OrgApiKeyRow;
  draft: string;
  error: string;
  success: string;
  busy: boolean;
  isReadonly: boolean;
  onDraft: (v: string) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const isConfigured = Boolean(knownKey);
  const tierLabel = `Tier ${source.tier}`;

  return (
    <div className={`src-row ${isConfigured ? 'configured' : ''}`}>
      <div className="src-row-head">
        <div>
          <div className="src-name">
            {source.name}
            <span className="src-tier">· {tierLabel}</span>
          </div>
          <div className="src-desc">{source.description}</div>
          <div className="src-domains">
            {source.domains.map((d) => (
              <span key={d} className="src-domain">{d}</span>
            ))}
          </div>
        </div>
        <div className="src-status">
          {isConfigured ? (
            <span className="src-status-ok">Configurée</span>
          ) : (
            <span className="src-status-empty">Non configurée</span>
          )}
        </div>
      </div>

      {isConfigured && knownKey && (
        <div className="src-current">
          <span className="src-current-label">Clé actuelle</span>
          <span className="src-current-value">{knownKey.masked_preview}</span>
          <span className="src-current-meta">
            mise à jour le {new Date(knownKey.updated_at).toLocaleDateString('fr-FR')}
          </span>
        </div>
      )}

      <div className="src-input-row">
        <input
          type="password"
          className="src-input"
          placeholder={isConfigured ? 'Saisir une nouvelle clé pour remplacer' : 'Coller votre clé API'}
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          disabled={busy || isReadonly}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          className="src-btn-save"
          onClick={onSave}
          disabled={busy || isReadonly || !draft.trim()}
        >
          {busy ? '…' : isConfigured ? 'Remplacer' : 'Enregistrer'}
        </button>
        {isConfigured && (
          <button
            className="src-btn-delete"
            onClick={onDelete}
            disabled={busy || isReadonly}
            title="Supprimer la clé"
          >
            Retirer
          </button>
        )}
      </div>

      {(error || success || source.byokHint) && (
        <div className="src-footer">
          {error && <div className="src-error">{error}</div>}
          {success && <div className="src-success">{success}</div>}
          {!error && !success && source.byokHint && (
            <a
              className="src-hint"
              href={source.byokHint}
              target="_blank"
              rel="noopener noreferrer"
            >
              Obtenir une clé chez {source.name} ↗
            </a>
          )}
        </div>
      )}

      <style jsx>{`
        .src-row {
          padding: 22px 0;
          border-bottom: 1px solid var(--hairline-soft);
        }
        .src-row-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 14px;
        }
        .src-name {
          font-family: var(--serif);
          font-size: 17px;
          font-weight: 500;
          color: var(--ink);
        }
        .src-tier {
          font-family: var(--sans);
          font-size: 11px;
          color: var(--muted);
          margin-left: 6px;
          letter-spacing: 0.06em;
        }
        .src-desc {
          font-family: var(--serif);
          font-size: 13.5px;
          color: var(--ink-soft);
          line-height: 1.5;
          margin-top: 4px;
          max-width: 580px;
        }
        .src-domains {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .src-domain {
          font-family: var(--sans);
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          background: var(--paper-accent);
          padding: 2px 8px;
        }
        .src-status {
          flex-shrink: 0;
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .src-status-ok { color: var(--good); }
        .src-status-empty { color: var(--muted); }
        .src-current {
          display: flex;
          align-items: baseline;
          gap: 12px;
          padding: 8px 12px;
          background: var(--paper-accent);
          margin-bottom: 12px;
          font-family: var(--sans);
          font-size: 13px;
          flex-wrap: wrap;
        }
        .src-current-label {
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .src-current-value {
          font-family: var(--mono);
          color: var(--ink);
          letter-spacing: 0.06em;
        }
        .src-current-meta {
          font-size: 11px;
          color: var(--muted);
        }
        .src-input-row {
          display: flex;
          gap: 8px;
          align-items: stretch;
        }
        .src-input {
          flex: 1;
          padding: 10px 12px;
          font-family: var(--mono);
          font-size: 13px;
          color: var(--ink);
          background: var(--paper);
          border: 1px solid var(--hairline);
          border-radius: 0;
          transition: border-color 0.12s;
        }
        .src-input:focus { outline: none; border-color: var(--accent); }
        .src-input:disabled { background: var(--paper-accent); opacity: 0.6; }
        .src-btn-save {
          padding: 10px 16px;
          font-family: var(--sans);
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 500;
          background: var(--accent);
          color: #fefefe;
          border: 1px solid var(--accent);
          cursor: pointer;
          transition: opacity 0.12s;
          white-space: nowrap;
        }
        .src-btn-save:hover:not(:disabled) { opacity: 0.92; }
        .src-btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
        .src-btn-delete {
          padding: 10px 14px;
          font-family: var(--sans);
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
          background: transparent;
          border: 1px solid var(--hairline);
          cursor: pointer;
          transition: all 0.12s;
          white-space: nowrap;
        }
        .src-btn-delete:hover:not(:disabled) {
          color: var(--warn);
          border-color: var(--warn);
        }
        .src-btn-delete:disabled { opacity: 0.4; cursor: not-allowed; }
        .src-footer {
          margin-top: 8px;
          font-family: var(--sans);
          font-size: 12px;
        }
        .src-error {
          color: var(--warn);
          padding: 6px 0;
        }
        .src-success {
          color: var(--good);
          padding: 6px 0;
        }
        .src-hint {
          color: var(--muted);
          text-decoration: none;
          transition: color 0.12s;
        }
        .src-hint:hover { color: var(--accent); }
      `}</style>
    </div>
  );
}
