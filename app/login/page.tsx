'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    setErrorMsg('');
    try {
      const supabase = getSupabaseBrowserClient();

      // Propagation du parametre next : si l user a ete redirige vers
      // /login?next=/history par le middleware, on doit transmettre cette
      // route au callback pour qu il y revienne apres l echange du code
      // contre une session. Sans cela, l user perd son contexte initial
      // et atterrit sur la home.
      //
      // On valide que next commence par / et ne contient pas de redirec-
      // tion externe (open redirect protection).
      const rawNext = searchParams.get('next');
      const safeNext = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
        ? rawNext
        : null;
      const callbackUrl = new URL(`${window.location.origin}/auth/callback`);
      if (safeNext) {
        callbackUrl.searchParams.set('next', safeNext);
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          // Apres clic sur le lien, l user atterrit sur /auth/callback
          // qui completera l echange du code contre une session.
          emailRedirectTo: callbackUrl.toString(),
        },
      });
      if (error) throw error;
      setStatus('sent');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message || "Erreur lors de l envoi du lien");
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-line"></div>
          <h1 className="auth-brand-name">PRÉLUDE</h1>
          <div className="auth-brand-tagline">Plateforme d&apos;instruction VC européenne</div>
        </div>

        {status !== 'sent' ? (
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-label" htmlFor="email">
              Adresse e-mail professionnelle
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prenom.nom@fonds.com"
              required
              className="auth-input"
              autoFocus
              autoComplete="email"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="auth-btn"
            >
              {status === 'sending' ? 'Envoi en cours…' : 'Recevoir le lien de connexion'}
            </button>
            {status === 'error' && (
              <div className="auth-error">{errorMsg}</div>
            )}
            <div className="auth-help">
              Vous recevrez un lien de connexion sécurisé par e-mail. Pas de mot de passe à retenir.
            </div>
          </form>
        ) : (
          <div className="auth-confirmation">
            <div className="auth-confirmation-title">Lien envoyé</div>
            <div className="auth-confirmation-text">
              Un message vient d&apos;être envoyé à <strong>{email}</strong>.
              Cliquez sur le lien pour accéder à Prélude.
            </div>
            <button
              type="button"
              className="auth-link"
              onClick={() => { setStatus('idle'); setEmail(''); }}
            >
              Utiliser une autre adresse
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .auth-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: var(--paper);
        }
        .auth-card {
          width: 100%;
          max-width: 440px;
          background: var(--surface);
          border: 1px solid var(--hairline);
          padding: 48px 44px 40px;
        }
        .auth-brand {
          margin-bottom: 36px;
          padding-bottom: 22px;
          border-bottom: 1px solid var(--hairline);
        }
        .auth-brand-line {
          width: 32px;
          height: 2px;
          background: var(--accent);
          margin-bottom: 14px;
        }
        .auth-brand-name {
          font-family: var(--serif);
          font-size: 26px;
          letter-spacing: 0.04em;
          color: var(--accent);
          font-weight: 500;
          margin-bottom: 6px;
        }
        .auth-brand-tagline {
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .auth-label {
          font-family: var(--sans);
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: -4px;
        }
        .auth-input {
          padding: 13px 14px;
          font-size: 15px;
          font-family: var(--sans);
          color: var(--ink);
          background: var(--paper);
          border: 1px solid var(--hairline);
          border-radius: 0;
          transition: border-color 0.12s;
        }
        .auth-input:focus {
          outline: none;
          border-color: var(--accent);
        }
        .auth-btn {
          margin-top: 8px;
          padding: 13px 20px;
          font-family: var(--sans);
          font-size: 13px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 500;
          background: var(--accent);
          color: #fefefe;
          border: 1px solid var(--accent);
          cursor: pointer;
          transition: opacity 0.12s;
        }
        .auth-btn:hover { opacity: 0.92; }
        .auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .auth-error {
          padding: 10px 14px;
          background: var(--warn-soft);
          border-left: 3px solid var(--warn);
          font-size: 13px;
          color: var(--warn);
        }
        .auth-help {
          margin-top: 4px;
          font-family: var(--sans);
          font-size: 12px;
          color: var(--muted);
          line-height: 1.5;
        }
        .auth-confirmation { text-align: left; }
        .auth-confirmation-title {
          font-family: var(--serif);
          font-size: 22px;
          font-weight: 500;
          margin-bottom: 14px;
          color: var(--accent);
        }
        .auth-confirmation-text {
          font-size: 14px;
          line-height: 1.6;
          color: var(--ink-soft);
          margin-bottom: 20px;
        }
        .auth-link {
          background: none;
          border: none;
          padding: 0;
          font-family: var(--sans);
          font-size: 13px;
          color: var(--accent);
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
        }
      `}</style>
    </main>
  );
}
