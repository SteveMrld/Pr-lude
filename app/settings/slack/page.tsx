'use client';

// ============================================================
// /settings/slack
// ------------------------------------------------------------
// Page de configuration du webhook Slack pour l organisation
// courante. Edition complete de la config + bouton test.
// Necessite auth ; redirige vers /login si pas de session.
// ============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Config = {
  organizationId: string;
  webhookUrlMasked: string;
  channelName: string | null;
  defaultPartnerMention: string | null;
  alertThresholdScore: number;
  notifyOnCriticalVerdict: boolean;
  notifyOnHighBlindspot: boolean;
  enabled: boolean;
  hasWebhook: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
};

export default function SlackSettingsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingWebhook, setEditingWebhook] = useState(false);
  const [webhookInput, setWebhookInput] = useState('');
  const [channelInput, setChannelInput] = useState('');
  const [mentionInput, setMentionInput] = useState('');
  const [enabledInput, setEnabledInput] = useState(true);
  const [notifyCriticalInput, setNotifyCriticalInput] = useState(true);
  const [notifyBlindspotInput, setNotifyBlindspotInput] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/slack/config');
      if (res.ok) {
        const data = await res.json();
        const c = data.config as Config | null;
        setConfig(c);
        if (c) {
          setChannelInput(c.channelName || '');
          setMentionInput(c.defaultPartnerMention || '');
          setEnabledInput(c.enabled);
          setNotifyCriticalInput(c.notifyOnCriticalVerdict);
          setNotifyBlindspotInput(c.notifyOnHighBlindspot);
        }
      } else if (res.status === 401 || res.status === 403) {
        setError('Cette page necessite un compte fonds connecte.');
      }
    } catch {
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    setTestResult(null);
    try {
      const body: any = {
        channelName: channelInput || null,
        defaultPartnerMention: mentionInput || null,
        enabled: enabledInput,
        notifyOnCriticalVerdict: notifyCriticalInput,
        notifyOnHighBlindspot: notifyBlindspotInput,
      };

      // Le webhook URL est requis si pas encore de config en base.
      // Si l utilisateur a tape un nouveau webhook (cas creation ou edition),
      // on l envoie. Sinon, si la config existe deja en base, on n a meme pas
      // besoin d envoyer le webhook (le serveur conservera l existant).
      const trimmed = webhookInput.trim();
      if (trimmed) {
        if (!trimmed.startsWith('https://hooks.slack.com/services/')) {
          setError('L URL doit commencer par https://hooks.slack.com/services/');
          setSaving(false);
          return;
        }
        body.webhookUrl = trimmed;
      } else if (!config?.hasWebhook) {
        setError('Webhook URL requis');
        setSaving(false);
        return;
      } else {
        // Pas de nouveau webhook saisi mais une config existe : on ne peut
        // pas mettre a jour les options sans renvoyer le webhook (le PUT
        // serveur l exige). On demande a l utilisateur de re-cliquer Modifier
        // et de re-saisir l URL pour mettre a jour les options.
        setError('Pour modifier les options, cliquez Modifier et re-saisissez l URL du webhook.');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/slack/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.saved) {
        throw new Error(data.detail || data.error || 'Echec sauvegarde');
      }
      setConfig(data.config);
      setEditingWebhook(false);
      setWebhookInput('');
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/slack/test', { method: 'POST' });
      const data = await res.json();
      setTestResult({ ok: data.ok, msg: data.error });
      load();
    } catch (err: any) {
      setTestResult({ ok: false, msg: err.message });
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    if (!confirm('Supprimer la configuration Slack ? Les notifications cesseront pour toute l organisation.')) return;
    try {
      const res = await fetch('/api/slack/config', { method: 'DELETE' });
      if (res.ok) {
        setConfig(null);
        setWebhookInput('');
        setChannelInput('');
        setMentionInput('');
        setEditingWebhook(false);
      }
    } catch {
      // silencieux
    }
  };

  return (
    <main style={{
      maxWidth: 720,
      margin: '0 auto',
      padding: '40px 24px 80px',
      fontFamily: 'var(--sans)',
    }}>
      <Link
        href="/"
        style={{
          fontSize: 11,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: 24,
        }}
      >
        ← Retour a Prelude
      </Link>

      <div style={{
        fontSize: 9,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        marginBottom: 8,
        fontWeight: 500,
      }}>
        Parametres organisation
      </div>
      <h1 style={{
        fontFamily: 'var(--serif)',
        fontSize: 32,
        fontWeight: 500,
        margin: '0 0 8px',
        letterSpacing: '-0.01em',
      }}>
        Integration Slack
      </h1>
      <p style={{
        fontSize: 14,
        color: 'var(--ink-soft, var(--ink))',
        lineHeight: 1.6,
        marginBottom: 32,
        opacity: 0.8,
      }}>
        Connectez Prelude a un channel Slack du fonds. Chaque dossier instruit y sera publie
        automatiquement avec son verdict, ses facteurs decisifs et ses risques critiques. Une
        alerte distincte se declenche en plus pour les dossiers refuses ou presentant des
        patterns à risque intenses.
      </p>

      {loading && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Chargement...</div>}

      {!loading && (
        <>
          {/* Webhook URL */}
          <section style={{
            border: '1px solid var(--hairline)',
            background: 'var(--surface)',
            padding: '20px 24px',
            marginBottom: 16,
          }}>
            <div style={{
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              fontWeight: 500,
              marginBottom: 8,
            }}>
              Webhook entrant
            </div>
            {!editingWebhook && config?.hasWebhook && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <code style={{
                  fontSize: 12,
                  fontFamily: 'monospace',
                  color: 'var(--ink)',
                  wordBreak: 'break-all',
                }}>
                  {config.webhookUrlMasked}
                </code>
                <button
                  onClick={() => { setEditingWebhook(true); setWebhookInput(''); }}
                  style={{
                    padding: '6px 12px',
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: 'transparent',
                    color: 'var(--ink)',
                    border: '1px solid var(--ink)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Modifier
                </button>
              </div>
            )}
            {(editingWebhook || !config?.hasWebhook) && (
              <>
                <input
                  type="text"
                  value={webhookInput}
                  onChange={(e) => setWebhookInput(e.target.value)}
                  placeholder="https://hooks.slack.com/services/T0XXX/B0YYY/abc123..."
                  style={{
                    width: '100%',
                    fontSize: 12,
                    padding: '10px 12px',
                    border: '1px solid var(--hairline)',
                    background: 'var(--paper)',
                    fontFamily: 'monospace',
                    color: 'var(--ink)',
                    marginBottom: 8,
                  }}
                />
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>
                  Creez un webhook entrant dans Slack via{' '}
                  <a
                    href="https://api.slack.com/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--ink)', textDecoration: 'underline' }}
                  >
                    api.slack.com/apps
                  </a>
                  {' '}puis collez l URL ici.
                </p>
              </>
            )}
          </section>

          {/* Options */}
          <section style={{
            border: '1px solid var(--hairline)',
            background: 'var(--surface)',
            padding: '20px 24px',
            marginBottom: 16,
          }}>
            <div style={{
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              fontWeight: 500,
              marginBottom: 16,
            }}>
              Options
            </div>

            <Field label="Nom du channel (informatif)">
              <input
                type="text"
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                placeholder="#instruction-fonds"
                style={inputStyle}
              />
            </Field>

            <Field
              label="Mention du partner principal"
              help="Ajoute en bas de chaque message. Ex : <@U12345> ou @prenom"
            >
              <input
                type="text"
                value={mentionInput}
                onChange={(e) => setMentionInput(e.target.value)}
                placeholder="<@U0XYZ123>"
                style={inputStyle}
              />
            </Field>

            <ToggleField
              label="Notifications activees"
              checked={enabledInput}
              onChange={setEnabledInput}
              help="Quand desactive, plus aucun message n est envoye sans supprimer la config."
            />

            <ToggleField
              label="Alerte sur verdict critique (refuser)"
              checked={notifyCriticalInput}
              onChange={setNotifyCriticalInput}
              help="Message distinct envoye en plus pour les dossiers refuses."
            />

            <ToggleField
              label="Alerte sur aveuglement collectif eleve"
              checked={notifyBlindspotInput}
              onChange={setNotifyBlindspotInput}
              help="Declenche quand le score d aveuglement global depasse 75/100."
            />
          </section>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                padding: '10px 20px',
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: 'var(--ink)',
                color: 'var(--paper)',
                border: 'none',
                cursor: saving ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                fontWeight: 500,
              }}
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>

            {config?.hasWebhook && (
              <>
                <button
                  onClick={test}
                  disabled={testing}
                  style={{
                    padding: '10px 20px',
                    fontSize: 12,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: 'transparent',
                    color: 'var(--ink)',
                    border: '1px solid var(--ink)',
                    cursor: testing ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {testing ? 'Envoi...' : 'Envoyer un test'}
                </button>
                <button
                  onClick={remove}
                  style={{
                    padding: '10px 20px',
                    fontSize: 12,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: 'transparent',
                    color: '#7a1f1f',
                    border: '1px solid #7a1f1f',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    marginLeft: 'auto',
                  }}
                >
                  Supprimer la config
                </button>
              </>
            )}
          </div>

          {error && (
            <div style={{
              marginTop: 16,
              padding: '12px 16px',
              background: 'rgba(122,31,31,0.05)',
              borderLeft: '3px solid #7a1f1f',
              fontSize: 13,
              color: '#7a1f1f',
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          {testResult && (
            <div style={{
              marginTop: 16,
              padding: '12px 16px',
              background: testResult.ok ? 'rgba(31,122,60,0.08)' : 'rgba(122,31,31,0.05)',
              borderLeft: `3px solid ${testResult.ok ? '#1f7a3c' : '#7a1f1f'}`,
              fontSize: 13,
              color: testResult.ok ? '#1f7a3c' : '#7a1f1f',
              lineHeight: 1.5,
            }}>
              {testResult.ok
                ? '✓ Message de test envoye. Verifiez votre channel Slack.'
                : `Echec : ${testResult.msg || 'erreur inconnue'}`}
            </div>
          )}

          {config?.lastTestAt && (
            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--muted)' }}>
              Dernier test :{' '}
              {new Date(config.lastTestAt).toLocaleString('fr-FR')}
              {config.lastTestOk === true && ' · OK'}
              {config.lastTestOk === false && ' · Echec'}
            </div>
          )}
        </>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 13,
  padding: '8px 12px',
  border: '1px solid var(--hairline)',
  background: 'var(--paper)',
  fontFamily: 'inherit',
  color: 'var(--ink)',
};

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block',
        fontSize: 11,
        letterSpacing: '0.04em',
        color: 'var(--ink)',
        marginBottom: 6,
        fontWeight: 500,
      }}>
        {label}
      </label>
      {children}
      {help && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.45 }}>
          {help}
        </div>
      )}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  help?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span style={{ fontSize: 13, color: 'var(--ink)' }}>{label}</span>
      </label>
      {help && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, marginLeft: 24, lineHeight: 1.45 }}>
          {help}
        </div>
      )}
    </div>
  );
}
