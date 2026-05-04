'use client';

// ============================================================
// /onboarding (client)
// ------------------------------------------------------------
// Deux scenarios :
//   1. L user a une ou plusieurs invitations pending pour son email
//      -> on lui propose de rejoindre l organisation correspondante.
//      Il peut aussi choisir de creer sa propre org en dessous.
//   2. Pas d invitation : formulaire de creation d organisation classique.
// ============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface PendingInvitation {
  id: string;
  organizationId: string;
  organizationName: string;
  role: 'admin' | 'member' | 'observer';
  invitedByEmail: string | null;
  createdAt: string;
}

interface Props {
  userEmail: string;
  pendingInvitations: PendingInvitation[];
}

export default function OnboardingClient({ userEmail, pendingInvitations }: Props) {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [status, setStatus] = useState<'idle' | 'creating' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(pendingInvitations.length === 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim()) return;
    setStatus('creating');
    setErrorMsg('');
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erreur ${res.status}`);
      }
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message || 'Erreur inattendue');
    }
  }

  async function handleAccept(invitationId: string) {
    setAcceptingId(invitationId);
    setErrorMsg('');
    try {
      const res = await fetch('/api/organizations/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erreur ${res.status}`);
      }
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setAcceptingId(null);
      setErrorMsg(err?.message || 'Erreur inattendue');
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-line"></div>
          <h1 className="auth-brand-name">PRÉLUDE</h1>
          <div className="auth-brand-tagline">Configuration initiale</div>
        </div>

        {pendingInvitations.length > 0 && (
          <section className="invite-block">
            <p className="invite-intro">
              {pendingInvitations.length === 1
                ? 'Vous avez une invitation en attente pour cette adresse.'
                : 'Vous avez plusieurs invitations en attente pour cette adresse.'}
            </p>
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="invite-card">
                <div className="invite-org">{inv.organizationName}</div>
                <div className="invite-meta">
                  Rôle proposé : {inv.role === 'admin' ? 'Administrateur' : inv.role === 'observer' ? 'Observateur' : 'Membre'}
                  {inv.invitedByEmail ? ` · invité par ${inv.invitedByEmail}` : ''}
                </div>
                <button
                  onClick={() => handleAccept(inv.id)}
                  disabled={acceptingId === inv.id}
                  className="auth-btn"
                  style={{ marginTop: 14 }}
                >
                  {acceptingId === inv.id ? 'Activation…' : `Rejoindre ${inv.organizationName}`}
                </button>
              </div>
            ))}
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="invite-secondary"
                type="button"
              >
                Ou créer une nouvelle organisation
              </button>
            )}
          </section>
        )}

        {showCreateForm && (
          <form onSubmit={handleCreate} className="auth-form">
            {pendingInvitations.length > 0 && (
              <div className="auth-divider">
                <span>Ou créer une organisation</span>
              </div>
            )}
            <label className="auth-label" htmlFor="orgName">
              Nom de votre fonds ou structure
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Ardian, Eurazeo, Bpifrance…"
              required
              className="auth-input"
              autoFocus={pendingInvitations.length === 0}
            />
            <div className="auth-help">
              Ce nom apparaîtra dans l&apos;en-tête de Prélude. Vous pourrez le modifier plus tard.
              Toutes les analyses et clés API seront rattachées à cette organisation.
            </div>
            <button
              type="submit"
              disabled={status === 'creating'}
              className="auth-btn"
            >
              {status === 'creating' ? 'Création…' : 'Créer mon espace'}
            </button>
          </form>
        )}

        {errorMsg && <div className="auth-error">{errorMsg}</div>}

        <div className="auth-footer">Connecté en tant que {userEmail}</div>
      </div>

      <style jsx>{`
        .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: var(--paper); }
        .auth-card { width: 100%; max-width: 480px; background: var(--surface); border: 1px solid var(--hairline); padding: 44px 40px 36px; }
        .auth-brand { margin-bottom: 28px; padding-bottom: 22px; border-bottom: 1px solid var(--hairline); }
        .auth-brand-line { width: 32px; height: 2px; background: var(--accent); margin-bottom: 14px; }
        .auth-brand-name { font-family: var(--serif); font-size: 26px; letter-spacing: 0.04em; color: var(--accent); font-weight: 500; margin-bottom: 6px; }
        .auth-brand-tagline { font-family: var(--sans); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
        .invite-block { margin-bottom: 18px; }
        .invite-intro { font-family: var(--serif); font-size: 14.5px; line-height: 1.55; color: var(--ink-soft); margin-bottom: 18px; }
        .invite-card { padding: 18px 20px; background: var(--paper); border: 1px solid var(--hairline-strong); margin-bottom: 12px; }
        .invite-org { font-family: var(--serif); font-size: 18px; font-weight: 500; color: var(--ink); margin-bottom: 6px; }
        .invite-meta { font-family: var(--sans); font-size: 12px; color: var(--muted); }
        .invite-secondary { margin-top: 8px; padding: 10px 14px; width: 100%; background: transparent; border: 1px dashed var(--hairline); color: var(--muted); font-family: var(--sans); font-size: 12px; letter-spacing: 0.04em; cursor: pointer; transition: border-color 0.12s, color 0.12s; }
        .invite-secondary:hover { border-color: var(--ink); color: var(--ink); }
        .auth-form { display: flex; flex-direction: column; gap: 14px; }
        .auth-divider { display: flex; align-items: center; gap: 10px; margin: 6px 0 4px; font-family: var(--sans); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
        .auth-divider::before, .auth-divider::after { content: ''; flex: 1; height: 1px; background: var(--hairline); }
        .auth-label { font-family: var(--sans); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: -4px; }
        .auth-input { padding: 13px 14px; font-size: 15px; font-family: var(--sans); color: var(--ink); background: var(--paper); border: 1px solid var(--hairline); border-radius: 0; transition: border-color 0.12s; }
        .auth-input:focus { outline: none; border-color: var(--accent); }
        .auth-btn { padding: 13px 20px; font-family: var(--sans); font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 500; background: var(--accent); color: #fefefe; border: 1px solid var(--accent); cursor: pointer; transition: opacity 0.12s; }
        .auth-btn:hover:not(:disabled) { opacity: 0.92; }
        .auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .auth-error { margin-top: 14px; padding: 10px 14px; background: var(--warn-soft); border-left: 3px solid var(--warn); font-size: 13px; color: var(--warn); }
        .auth-help { font-family: var(--sans); font-size: 12px; color: var(--muted); line-height: 1.5; }
        .auth-footer { margin-top: 28px; padding-top: 18px; border-top: 1px solid var(--hairline); font-family: var(--sans); font-size: 11px; color: var(--muted); text-align: center; }
      `}</style>
    </main>
  );
}
