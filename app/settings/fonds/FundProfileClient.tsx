'use client';

import { useState } from 'react';
import Link from 'next/link';

// ============================================================
// PAGE PROFIL FONDS
// ------------------------------------------------------------
// These d investissement de l organisation. Lecture pour tout
// membre, edition reservee aux admins.
// Voix Le Grand Continent / The Atlantic. Pas d em-dashes.
// ============================================================

interface FundProfile {
  sectorsFocus: string[];
  sectorsExcluded: string[];
  geographiesFocus: string[];
  geographiesExcluded: string[];
  ticketMinEur: number | null;
  ticketMaxEur: number | null;
  stagesFocus: string[];
  notes: string | null;
  updatedAt?: string;
}

interface Props {
  orgName: string;
  orgRole: 'admin' | 'member' | 'observer';
  initialProfile: FundProfile | null;
  isOnboarding?: boolean;
}

const COMMON_SECTORS = [
  'SaaS B2B', 'Fintech', 'Insurtech', 'Healthtech', 'Biotech', 'Medtech',
  'Deeptech', 'Cleantech', 'Climate tech', 'AI / ML', 'Cyber',
  'Mobilité', 'Spatial', 'Defense', 'Agritech', 'Foodtech',
  'E-commerce', 'Marketplace', 'Consumer', 'Education', 'HR tech',
  'Proptech', 'Industrial tech', 'Robotique', 'IoT', 'Web3 / Crypto',
];

const COMMON_SECTORS_EXCLUDED = [
  'Defense', 'Tabac', 'Alcool', 'Jeu', 'Adult', 'Fossile', 'Crypto spéculatif',
];

const COMMON_GEOGRAPHIES = [
  'France', 'Royaume-Uni', 'Allemagne', 'Espagne', 'Italie',
  'Benelux', 'Nordics', 'Europe (UE)', 'Royaume-Uni + Irlande',
  'États-Unis', 'Canada', 'Amérique du Nord',
  'Israël', 'MENA', 'Afrique', 'Amérique latine', 'Asie', 'Monde',
];

const COMMON_GEOGRAPHIES_EXCLUDED = [
  'Russie', 'Chine', 'Iran', 'Corée du Nord', 'Pays sous sanctions',
];

const COMMON_STAGES = [
  'pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth',
  'late-stage', 'pre-IPO',
];

const TICKET_PRESETS = [
  { label: 'Pre-seed', range: '50k - 500k', min: 50_000, max: 500_000 },
  { label: 'Seed early', range: '250k - 1M', min: 250_000, max: 1_000_000 },
  { label: 'Seed', range: '500k - 2M', min: 500_000, max: 2_000_000 },
  { label: 'Seed+', range: '1M - 3M', min: 1_000_000, max: 3_000_000 },
  { label: 'Series A', range: '2M - 8M', min: 2_000_000, max: 8_000_000 },
  { label: 'Series A+', range: '5M - 15M', min: 5_000_000, max: 15_000_000 },
  { label: 'Series B', range: '10M - 30M', min: 10_000_000, max: 30_000_000 },
  { label: 'Growth', range: '20M et au-delà', min: 20_000_000, max: 100_000_000 },
];

export default function FundProfileClient({ orgName, orgRole, initialProfile, isOnboarding }: Props) {
  const isAdmin = orgRole === 'admin';

  const [sectorsFocus, setSectorsFocus] = useState<string[]>(initialProfile?.sectorsFocus || []);
  const [sectorsExcluded, setSectorsExcluded] = useState<string[]>(initialProfile?.sectorsExcluded || []);
  const [geographiesFocus, setGeographiesFocus] = useState<string[]>(initialProfile?.geographiesFocus || []);
  const [geographiesExcluded, setGeographiesExcluded] = useState<string[]>(initialProfile?.geographiesExcluded || []);
  const [ticketMin, setTicketMin] = useState<string>(
    initialProfile?.ticketMinEur ? String(initialProfile.ticketMinEur) : '',
  );
  const [ticketMax, setTicketMax] = useState<string>(
    initialProfile?.ticketMaxEur ? String(initialProfile.ticketMaxEur) : '',
  );
  const [stagesFocus, setStagesFocus] = useState<string[]>(initialProfile?.stagesFocus || []);
  const [notes, setNotes] = useState<string>(initialProfile?.notes || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>(initialProfile?.updatedAt);

  function toggle(list: string[], setList: (v: string[]) => void, item: string) {
    if (list.includes(item)) {
      setList(list.filter(x => x !== item));
    } else {
      setList([...list, item]);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const body = {
      sectorsFocus,
      sectorsExcluded,
      geographiesFocus,
      geographiesExcluded,
      ticketMinEur: ticketMin ? parseInt(ticketMin, 10) : null,
      ticketMaxEur: ticketMax ? parseInt(ticketMax, 10) : null,
      stagesFocus,
      notes: notes.trim() || null,
    };

    try {
      const res = await fetch('/api/fund-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur à la sauvegarde');
      } else {
        if (isOnboarding) {
          window.location.href = '/';
          return;
        }
        setSuccess('Thèse du fonds enregistrée. Le pré-scan utilisera ces critères pour les prochains dossiers.');
        setUpdatedAt(data.profile?.updatedAt);
      }
    } catch (e: any) {
      setError(e.message || 'Erreur réseau');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fund-profile-page">
      <style jsx>{`
        .fund-profile-page {
          max-width: 920px;
          margin: 0 auto;
          padding: 56px 32px 80px;
          font-family: var(--sans);
        }
        @media (max-width: 720px) {
          .fund-profile-page {
            padding: 32px 20px 64px;
          }
        }

        .fp-back {
          display: inline-block;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          text-decoration: none;
          margin-bottom: 32px;
          transition: color var(--motion-fast);
        }
        .fp-back:hover { color: var(--ink); }

        .fp-onboarding {
          margin-bottom: 48px;
          padding: 28px 32px;
          background: var(--ocre-brule-soft);
          border-left: 3px solid var(--ocre-brule);
        }
        .fp-onboarding-eyebrow {
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ocre-brule);
          font-weight: 600;
          margin-bottom: 10px;
        }
        .fp-onboarding-title {
          font-family: var(--serif);
          font-size: 26px;
          font-weight: 500;
          line-height: 1.25;
          margin-bottom: 14px;
          color: var(--ink);
        }
        .fp-onboarding-body {
          font-size: 14.5px;
          line-height: 1.7;
          color: var(--ink-soft);
          max-width: 700px;
        }

        .fp-eyebrow {
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 600;
          margin-bottom: 12px;
        }
        .fp-title {
          font-family: var(--serif);
          font-size: 40px;
          font-weight: 500;
          line-height: 1.1;
          letter-spacing: -0.01em;
          margin: 0 0 20px;
          color: var(--ink);
        }
        @media (max-width: 720px) {
          .fp-title { font-size: 32px; }
        }
        .fp-lede {
          font-family: var(--serif);
          font-size: 18px;
          line-height: 1.55;
          color: var(--ink-soft);
          max-width: 720px;
          margin: 0 0 12px;
        }

        .fp-meta-bar {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 14px 0;
          margin: 28px 0 0;
          border-top: 1px solid var(--hairline);
          border-bottom: 1px solid var(--hairline);
          font-size: 12px;
          color: var(--muted);
          flex-wrap: wrap;
        }
        .fp-meta-bar strong {
          color: var(--ink);
          font-weight: 600;
        }

        .fp-readonly-banner {
          padding: 14px 18px;
          background: var(--ocre-brule-soft);
          border-left: 3px solid var(--ocre-brule);
          font-size: 13px;
          line-height: 1.55;
          margin: 28px 0;
          color: var(--ink-soft);
        }

        .fp-section {
          padding: 36px 0;
          border-bottom: 1px solid var(--hairline);
        }
        .fp-section:last-of-type {
          border-bottom: none;
        }
        .fp-section-header {
          margin-bottom: 18px;
        }
        .fp-section-num {
          display: inline-block;
          font-family: var(--serif);
          font-size: 12px;
          color: var(--muted-soft);
          margin-right: 10px;
          vertical-align: 2px;
        }
        .fp-section-title {
          display: inline;
          font-family: var(--serif);
          font-size: 22px;
          font-weight: 500;
          line-height: 1.25;
          color: var(--ink);
        }
        .fp-section-subtitle {
          font-size: 14px;
          color: var(--ink-soft);
          line-height: 1.6;
          margin: 8px 0 0;
          max-width: 720px;
        }

        .fp-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
        }
        .fp-chip {
          padding: 7px 14px;
          font-size: 13px;
          background: transparent;
          border: 1px solid var(--hairline);
          color: var(--ink-soft);
          cursor: pointer;
          font-family: inherit;
          border-radius: 999px;
          transition: all var(--motion-fast);
          white-space: nowrap;
        }
        .fp-chip:hover:not(:disabled) {
          border-color: var(--muted);
          color: var(--ink);
        }
        .fp-chip[data-selected="true"] {
          background: var(--ink);
          border-color: var(--ink);
          color: #fff;
        }
        .fp-chip[data-selected="true"][data-variant="excluded"] {
          background: var(--rouge-anglais);
          border-color: var(--rouge-anglais);
          color: #fff;
        }
        .fp-chip:disabled {
          opacity: 0.55;
          cursor: default;
        }

        .fp-add-row {
          display: flex;
          gap: 8px;
          align-items: stretch;
          margin-top: 4px;
          max-width: 460px;
        }
        .fp-add-input {
          flex: 1;
          padding: 9px 14px;
          font-size: 13px;
          border: 1px solid var(--hairline);
          background: var(--surface);
          font-family: inherit;
          border-radius: 4px;
          color: var(--ink);
          transition: border-color var(--motion-fast);
        }
        .fp-add-input:focus {
          outline: none;
          border-color: var(--ink);
        }
        .fp-add-btn {
          padding: 9px 16px;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 600;
          border: 1px solid var(--hairline);
          background: var(--surface);
          color: var(--ink);
          cursor: pointer;
          font-family: inherit;
          border-radius: 4px;
          transition: all var(--motion-fast);
        }
        .fp-add-btn:hover {
          background: var(--ink);
          color: #fff;
          border-color: var(--ink);
        }

        .fp-ticket-presets {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 10px;
          margin-bottom: 24px;
        }
        @media (max-width: 720px) {
          .fp-ticket-presets {
            grid-template-columns: 1fr 1fr;
          }
        }
        .fp-ticket-preset {
          padding: 14px 16px;
          background: var(--surface);
          border: 1px solid var(--hairline);
          border-radius: 4px;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          transition: all var(--motion-fast);
        }
        .fp-ticket-preset:hover:not(:disabled) {
          border-color: var(--ink);
        }
        .fp-ticket-preset[data-active="true"] {
          background: var(--accent-soft);
          border-color: var(--accent);
        }
        .fp-ticket-preset:disabled {
          opacity: 0.55;
          cursor: default;
        }
        .fp-ticket-preset-label {
          font-family: var(--serif);
          font-size: 15px;
          font-weight: 500;
          color: var(--ink);
          display: block;
          margin-bottom: 2px;
        }
        .fp-ticket-preset-range {
          font-size: 12px;
          color: var(--muted);
          font-variant-numeric: tabular-nums;
        }

        .fp-ticket-inputs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          max-width: 520px;
        }
        @media (max-width: 480px) {
          .fp-ticket-inputs {
            grid-template-columns: 1fr;
          }
        }
        .fp-input-label {
          display: block;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 8px;
          font-weight: 600;
        }
        .fp-input-num {
          width: 100%;
          padding: 11px 14px;
          font-size: 14px;
          border: 1px solid var(--hairline);
          background: var(--surface);
          font-family: inherit;
          border-radius: 4px;
          color: var(--ink);
          font-variant-numeric: tabular-nums;
          transition: border-color var(--motion-fast);
        }
        .fp-input-num:focus {
          outline: none;
          border-color: var(--ink);
        }
        .fp-clear-btn {
          background: transparent;
          border: none;
          padding: 0;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          cursor: pointer;
          font-family: inherit;
          margin-bottom: 12px;
          transition: color var(--motion-fast);
        }
        .fp-clear-btn:hover { color: var(--ink); }

        .fp-textarea {
          width: 100%;
          padding: 14px 16px;
          font-size: 14px;
          line-height: 1.6;
          border: 1px solid var(--hairline);
          background: var(--surface);
          font-family: inherit;
          border-radius: 4px;
          color: var(--ink);
          resize: vertical;
          min-height: 110px;
          transition: border-color var(--motion-fast);
        }
        .fp-textarea:focus {
          outline: none;
          border-color: var(--ink);
        }

        .fp-actions {
          margin-top: 48px;
          padding-top: 28px;
          border-top: 1px solid var(--hairline);
        }
        .fp-alert {
          padding: 14px 18px;
          font-size: 13.5px;
          line-height: 1.55;
          margin-bottom: 18px;
          border-left: 3px solid;
        }
        .fp-alert-error {
          background: var(--rouge-anglais-soft);
          border-color: var(--rouge-anglais);
          color: var(--ink);
        }
        .fp-alert-success {
          background: var(--vert-foret-soft);
          border-color: var(--vert-foret);
          color: var(--ink);
        }
        .fp-save-btn {
          padding: 14px 32px;
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-weight: 600;
          background: var(--ink);
          color: #fff;
          border: none;
          cursor: pointer;
          font-family: inherit;
          border-radius: 4px;
          transition: background var(--motion-fast);
        }
        .fp-save-btn:hover:not(:disabled) {
          background: var(--accent);
        }
        .fp-save-btn:disabled {
          opacity: 0.55;
          cursor: default;
        }
      `}</style>

      {!isOnboarding && (
        <Link href="/" className="fp-back">
          ← Retour au pipeline
        </Link>
      )}

      {isOnboarding && (
        <div className="fp-onboarding">
          <div className="fp-onboarding-eyebrow">Étape préliminaire</div>
          <div className="fp-onboarding-title">
            Renseignez la thèse de votre fonds avant la première analyse
          </div>
          <div className="fp-onboarding-body">
            Prélude utilise ces paramètres pour faire un triage rapide des dossiers entrants en quelques secondes. Sans thèse renseignée, le moteur de pré-scan ne peut pas évaluer si un dossier correspond à votre périmètre, et tourne en mode dégradé. Ce passage est obligatoire avant la première analyse, mais vous pouvez modifier la thèse à tout moment depuis cette même page. Si vous êtes un fonds généraliste sans filtre particulier, laissez les listes vides et cliquez sur enregistrer, c&apos;est suffisant.
          </div>
        </div>
      )}

      <div className="fp-eyebrow">{orgName} · Paramètres</div>
      <h1 className="fp-title">Thèse d&apos;investissement du fonds</h1>
      <p className="fp-lede">
        Ces paramètres définissent la thèse d&apos;investissement du fonds. Ils alimentent le moteur de pré-scan qui évalue en quelques secondes si un dossier entrant correspond à votre périmètre, avant de lancer le pipeline complet. Un dossier hors thèse reçoit un verdict défavorable, ce qui économise environ deux dollars de crédits LLM par dossier écarté.
      </p>

      <div className="fp-meta-bar">
        <span>Rôle : <strong>{orgRole === 'admin' ? 'Administrateur' : orgRole === 'observer' ? 'Observateur' : 'Membre'}</strong></span>
        {updatedAt && (
          <span>Dernière mise à jour : <strong>{new Date(updatedAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</strong></span>
        )}
      </div>

      {!isAdmin && (
        <div className="fp-readonly-banner">
          Vous êtes membre observateur ou simple membre de cette organisation. La thèse est consultable mais seul un administrateur peut la modifier.
        </div>
      )}

      <Section
        num="01"
        title="Secteurs cibles"
        subtitle="Les domaines dans lesquels le fonds investit prioritairement. Laisser vide si fonds généraliste."
      >
        <ChipPicker
          options={COMMON_SECTORS}
          selected={sectorsFocus}
          onToggle={(item) => toggle(sectorsFocus, setSectorsFocus, item)}
          customPlaceholder="Ajouter un secteur libre"
          onAddCustom={(value) => setSectorsFocus([...sectorsFocus, value])}
          disabled={!isAdmin}
        />
      </Section>

      <Section
        num="02"
        title="Secteurs exclus"
        subtitle="Les domaines explicitement hors thèse. Un dossier dans un secteur exclu est knockout immédiat."
      >
        <ChipPicker
          options={COMMON_SECTORS_EXCLUDED}
          selected={sectorsExcluded}
          onToggle={(item) => toggle(sectorsExcluded, setSectorsExcluded, item)}
          customPlaceholder="Ajouter un secteur exclu"
          onAddCustom={(value) => setSectorsExcluded([...sectorsExcluded, value])}
          disabled={!isAdmin}
          variant="excluded"
        />
      </Section>

      <Section
        num="03"
        title="Zones géographiques cibles"
        subtitle="Pays ou régions dans lesquels le fonds investit. Laisser vide si pas de filtre géographique."
      >
        <ChipPicker
          options={COMMON_GEOGRAPHIES}
          selected={geographiesFocus}
          onToggle={(item) => toggle(geographiesFocus, setGeographiesFocus, item)}
          customPlaceholder="Ajouter une zone libre"
          onAddCustom={(value) => setGeographiesFocus([...geographiesFocus, value])}
          disabled={!isAdmin}
        />
      </Section>

      <Section
        num="04"
        title="Zones géographiques exclues"
        subtitle="Pays ou régions hors périmètre. Optionnel."
      >
        <ChipPicker
          options={COMMON_GEOGRAPHIES_EXCLUDED}
          selected={geographiesExcluded}
          onToggle={(item) => toggle(geographiesExcluded, setGeographiesExcluded, item)}
          customPlaceholder="Ajouter une zone exclue"
          onAddCustom={(value) => setGeographiesExcluded([...geographiesExcluded, value])}
          disabled={!isAdmin}
          variant="excluded"
        />
      </Section>

      <Section
        num="05"
        title="Gamme de tickets"
        subtitle="Cliquez sur une plage typique pour la pré-remplir, ou saisissez manuellement vos bornes en euros. Laisser vide si le fonds n a pas de plage stricte."
      >
        <div className="fp-ticket-presets">
          {TICKET_PRESETS.map(preset => {
            const currentMin = ticketMin ? parseInt(ticketMin, 10) : null;
            const currentMax = ticketMax ? parseInt(ticketMax, 10) : null;
            const isActive = currentMin === preset.min && currentMax === preset.max;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  if (!isAdmin) return;
                  setTicketMin(String(preset.min));
                  setTicketMax(String(preset.max));
                }}
                disabled={!isAdmin}
                data-active={isActive}
                className="fp-ticket-preset"
              >
                <span className="fp-ticket-preset-label">{preset.label}</span>
                <span className="fp-ticket-preset-range">{preset.range} €</span>
              </button>
            );
          })}
        </div>

        {(ticketMin || ticketMax) && isAdmin && (
          <button
            type="button"
            onClick={() => { setTicketMin(''); setTicketMax(''); }}
            className="fp-clear-btn"
          >
            Effacer les bornes
          </button>
        )}

        <div className="fp-ticket-inputs">
          <div>
            <label className="fp-input-label">Ticket minimum (EUR)</label>
            <input
              type="number"
              value={ticketMin}
              onChange={(e) => setTicketMin(e.target.value)}
              disabled={!isAdmin}
              placeholder="ex. 250000"
              className="fp-input-num"
            />
          </div>
          <div>
            <label className="fp-input-label">Ticket maximum (EUR)</label>
            <input
              type="number"
              value={ticketMax}
              onChange={(e) => setTicketMax(e.target.value)}
              disabled={!isAdmin}
              placeholder="ex. 5000000"
              className="fp-input-num"
            />
          </div>
        </div>
      </Section>

      <Section
        num="06"
        title="Stades investis"
        subtitle="Les stades du cycle de vie auxquels le fonds entre dans un dossier."
      >
        <ChipPicker
          options={COMMON_STAGES}
          selected={stagesFocus}
          onToggle={(item) => toggle(stagesFocus, setStagesFocus, item)}
          customPlaceholder="Ajouter un stade libre"
          onAddCustom={(value) => setStagesFocus([...stagesFocus, value])}
          disabled={!isAdmin}
        />
      </Section>

      <Section
        num="07"
        title="Notes libres"
        subtitle="Nuances, exceptions, critères spécifiques que les listes ci-dessus ne capturent pas. Le moteur de pré-scan les lit et en tient compte."
      >
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={!isAdmin}
          rows={5}
          placeholder="Exemple : on peut investir hors thèse sectorielle si le fondateur est un ancien CEO de portfolio. On évite les modèles purement publicitaires."
          className="fp-textarea"
        />
      </Section>

      {isAdmin && (
        <div className="fp-actions">
          {error && <div className="fp-alert fp-alert-error">{error}</div>}
          {success && <div className="fp-alert fp-alert-success">{success}</div>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="fp-save-btn"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer la thèse'}
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ num, title, subtitle, children }: { num: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="fp-section">
      <div className="fp-section-header">
        <span className="fp-section-num">{num}</span>
        <h2 className="fp-section-title">{title}</h2>
        <p className="fp-section-subtitle">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function ChipPicker({
  options, selected, onToggle, customPlaceholder, onAddCustom, disabled, variant = 'normal',
}: {
  options: string[];
  selected: string[];
  onToggle: (item: string) => void;
  customPlaceholder: string;
  onAddCustom: (value: string) => void;
  disabled?: boolean;
  variant?: 'normal' | 'excluded';
}) {
  const [draft, setDraft] = useState('');

  function handleAddCustom() {
    const value = draft.trim();
    if (value && !selected.includes(value)) {
      onAddCustom(value);
      setDraft('');
    }
  }

  const customs = selected.filter(s => !options.includes(s));
  const allOptions = [...options, ...customs];

  return (
    <div>
      <div className="fp-chips">
        {allOptions.map(opt => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => !disabled && onToggle(opt)}
              disabled={disabled}
              data-selected={isSelected}
              data-variant={variant}
              className="fp-chip"
            >
              {opt}
            </button>
          );
        })}
      </div>
      {!disabled && (
        <div className="fp-add-row">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustom(); } }}
            placeholder={customPlaceholder}
            className="fp-add-input"
          />
          <button
            type="button"
            onClick={handleAddCustom}
            className="fp-add-btn"
          >
            Ajouter
          </button>
        </div>
      )}
    </div>
  );
}
