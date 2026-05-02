'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [status, setStatus] = useState<'idle' | 'creating' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
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

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-line"></div>
          <h1 className="auth-brand-name">PRÉLUDE</h1>
          <div className="auth-brand-tagline">Configuration initiale</div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
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
            autoFocus
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
          {status === 'error' && (
            <div className="auth-error">{errorMsg}</div>
          )}
        </form>
      </div>

      <style jsx>{`
        .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: var(--paper); }
        .auth-card { width: 100%; max-width: 440px; background: var(--surface); border: 1px solid var(--hairline); padding: 48px 44px 40px; }
        .auth-brand { margin-bottom: 36px; padding-bottom: 22px; border-bottom: 1px solid var(--hairline); }
        .auth-brand-line { width: 32px; height: 2px; background: var(--accent); margin-bottom: 14px; }
        .auth-brand-name { font-family: var(--serif); font-size: 26px; letter-spacing: 0.04em; color: var(--accent); font-weight: 500; margin-bottom: 6px; }
        .auth-brand-tagline { font-family: var(--sans); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
        .auth-form { display: flex; flex-direction: column; gap: 14px; }
        .auth-label { font-family: var(--sans); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: -4px; }
        .auth-input { padding: 13px 14px; font-size: 15px; font-family: var(--sans); color: var(--ink); background: var(--paper); border: 1px solid var(--hairline); border-radius: 0; transition: border-color 0.12s; }
        .auth-input:focus { outline: none; border-color: var(--accent); }
        .auth-btn { margin-top: 8px; padding: 13px 20px; font-family: var(--sans); font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 500; background: var(--accent); color: #fefefe; border: 1px solid var(--accent); cursor: pointer; transition: opacity 0.12s; }
        .auth-btn:hover { opacity: 0.92; }
        .auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .auth-error { padding: 10px 14px; background: var(--warn-soft); border-left: 3px solid var(--warn); font-size: 13px; color: var(--warn); }
        .auth-help { font-family: var(--sans); font-size: 12px; color: var(--muted); line-height: 1.5; }
      `}</style>
    </main>
  );
}
