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
          onSetAll={setSectorsFocus}
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
          onSetAll={setSectorsExcluded}
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
          onSetAll={setGeographiesFocus}
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
          onSetAll={setGeographiesExcluded}
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
          onSetAll={setStagesFocus}
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
  options, selected, onToggle, onSetAll, customPlaceholder, onAddCustom, disabled, variant = 'normal',
}: {
  options: string[];
  selected: string[];
  onToggle: (item: string) => void;
  onSetAll: (next: string[]) => void;
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
  // Combien de presets sont selectionnes ? Permet d afficher Tout
  // selectionner ou Tout deselectionner intelligemment selon l etat.
  const selectedPresetsCount = options.filter(o => selected.includes(o)).length;
  const allPresetsSelected = selectedPresetsCount === options.length && options.length > 0;
  const noPresetSelected = selectedPresetsCount === 0;

  return (
    <div>
      {!disabled && options.length > 0 && (
        <div className="fp-chip-actions">
          <button
            type="button"
            className="fp-chip-action"
            onClick={() => {
              // Tout selectionner : on ajoute tous les presets manquants,
              // on garde les customs deja presents.
              const next = Array.from(new Set([...selected, ...options]));
              onSetAll(next);
            }}
            disabled={allPresetsSelected}
          >
            Tout sélectionner
          </button>
          <span className="fp-chip-action-sep">·</span>
          <button
            type="button"
            className="fp-chip-action"
            onClick={() => {
              // Tout deselectionner : on retire les presets, on garde les
              // customs (l utilisateur a explicitement saisi ces zones).
              const next = selected.filter(s => !options.includes(s));
              onSetAll(next);
            }}
            disabled={noPresetSelected}
          >
            Tout désélectionner
          </button>
        </div>
      )}
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
