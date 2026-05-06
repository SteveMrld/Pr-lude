'use client';

import { useState } from 'react';
import Link from 'next/link';

// ============================================================
// PAGE PROFIL FONDS
// ------------------------------------------------------------
// Permet a un admin de l organisation de saisir la these
// d investissement du fonds : secteurs cibles, secteurs exclus,
// zones geographiques, gamme de tickets, stades investis, notes
// libres.
//
// Ces parametres sont injectes dans le moteur de pre-scan Bloc 0
// pour evaluer le sector_fit, geography_fit, ticket_fit, stage_fit
// d un dossier entrant et permettre le triage automatique des
// dossiers hors these avant le pipeline complet.
//
// Lecture : tout membre. Ecriture : admin uniquement.
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
  'Mobilite', 'Spatial', 'Defense', 'Agritech', 'Foodtech',
  'E-commerce', 'Marketplace', 'Consumer', 'Education', 'HR tech',
  'Proptech', 'Industrial tech', 'Robotique', 'IoT', 'Web3 / Crypto',
];

const COMMON_GEOGRAPHIES = [
  'France', 'Royaume-Uni', 'Allemagne', 'Espagne', 'Italie',
  'Benelux', 'Nordics', 'Europe (EU)', 'Royaume-Uni + Irlande',
  'Etats-Unis', 'Canada', 'Amerique du Nord',
  'Israel', 'MENA', 'Afrique', 'Amerique latine', 'Asie', 'Monde',
];

const COMMON_STAGES = [
  'pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth',
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
        setError(data.error || 'Erreur a la sauvegarde');
      } else {
        if (isOnboarding) {
          // Onboarding : la racine attendait que la these soit configuree.
          // Maintenant qu elle l est, on retourne au pipeline.
          window.location.href = '/';
          return;
        }
        setSuccess('These du fonds enregistree. Le pre-scan utilisera ces criteres pour les prochains dossiers.');
        setUpdatedAt(data.profile?.updatedAt);
      }
    } catch (e: any) {
      setError(e.message || 'Erreur reseau');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '40px 24px' }}>
      {!isOnboarding && (
        <div style={{ marginBottom: 32 }}>
          <Link href="/" style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--ink-tertiary)',
            textDecoration: 'none',
          }}>
            &larr; Retour au pipeline
          </Link>
        </div>
      )}

      {isOnboarding && (
        <div style={{
          marginBottom: 36,
          padding: '24px 28px',
          background: 'linear-gradient(135deg, rgba(192, 138, 63, 0.10) 0%, rgba(192, 138, 63, 0.03) 100%)',
          borderLeft: '3px solid #c08a3f',
          borderRadius: 2,
        }}>
          <div style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#c08a3f',
            fontWeight: 600,
            marginBottom: 8,
          }}>
            Etape preliminaire
          </div>
          <div style={{
            fontFamily: 'var(--serif)',
            fontSize: 22,
            fontWeight: 500,
            marginBottom: 12,
            lineHeight: 1.3,
          }}>
            Renseignez la these de votre fonds avant la premiere analyse
          </div>
          <div style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: 'var(--ink-soft)',
            maxWidth: 680,
          }}>
            Prelude utilise ces parametres pour faire un triage rapide des dossiers entrants en quelques secondes. Sans these renseignee, le moteur de pre-scan ne peut pas evaluer si un dossier correspond a votre perimetre, et tourne en mode degrade. Ce passage est obligatoire avant la premiere analyse, mais vous pouvez modifier la these a tout moment depuis cette meme page. Si vous etes un fonds generaliste sans filtre particulier, laissez les listes vides et cliquez sur enregistrer, c est suffisant.
          </div>
        </div>
      )}

      <div style={{ marginBottom: 8, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-tertiary)' }}>
        {orgName} &middot; Parametres
      </div>
      <h1 style={{
        fontFamily: 'var(--serif)',
        fontSize: 36,
        fontWeight: 500,
        lineHeight: 1.15,
        marginBottom: 16,
      }}>
        These d investissement du fonds
      </h1>
      <p style={{
        fontSize: 15,
        lineHeight: 1.65,
        color: 'var(--ink-soft)',
        marginBottom: 32,
        maxWidth: 720,
      }}>
        Ces parametres definissent la these d investissement du fonds. Ils sont utilises par le moteur de pre-scan pour evaluer en quelques secondes si un dossier entrant correspond a votre perimetre, avant de lancer le pipeline complet. Un dossier hors these recoit un verdict de pre-scan defavorable, ce qui permet d economiser environ 2 dollars de credits LLM par dossier ecarte.
      </p>

      {!isAdmin && (
        <div style={{
          padding: '14px 18px',
          background: 'rgba(192, 138, 63, 0.08)',
          borderLeft: '3px solid #c08a3f',
          fontSize: 13,
          marginBottom: 28,
        }}>
          Vous etes membre observateur ou simple membre de cette organisation. La these est consultable mais seul un administrateur peut la modifier.
        </div>
      )}

      {updatedAt && (
        <div style={{ fontSize: 12, color: 'var(--ink-tertiary)', marginBottom: 24 }}>
          Derniere mise a jour : {new Date(updatedAt).toLocaleString('fr-FR')}
        </div>
      )}

      {/* SECTEURS CIBLES */}
      <Section title="Secteurs cibles" subtitle="Les domaines dans lesquels le fonds investit prioritairement. Laisser vide si fonds generaliste.">
        <ChipPicker
          options={COMMON_SECTORS}
          selected={sectorsFocus}
          onToggle={(item) => toggle(sectorsFocus, setSectorsFocus, item)}
          customPlaceholder="Ajouter un secteur libre"
          onAddCustom={(value) => setSectorsFocus([...sectorsFocus, value])}
          disabled={!isAdmin}
        />
      </Section>

      {/* SECTEURS EXCLUS */}
      <Section title="Secteurs exclus" subtitle="Les domaines explicitement hors these. Un dossier dans un secteur exclus est knockout immediat.">
        <ChipPicker
          options={['Defense', 'Tabac', 'Alcool', 'Jeu', 'Adult', 'Fossile', 'Crypto speculatif']}
          selected={sectorsExcluded}
          onToggle={(item) => toggle(sectorsExcluded, setSectorsExcluded, item)}
          customPlaceholder="Ajouter un secteur exclu"
          onAddCustom={(value) => setSectorsExcluded([...sectorsExcluded, value])}
          disabled={!isAdmin}
          variant="excluded"
        />
      </Section>

      {/* ZONES GEOGRAPHIQUES */}
      <Section title="Zones geographiques cibles" subtitle="Pays ou regions dans lesquels le fonds investit. Laisser vide si pas de filtre geographique.">
        <ChipPicker
          options={COMMON_GEOGRAPHIES}
          selected={geographiesFocus}
          onToggle={(item) => toggle(geographiesFocus, setGeographiesFocus, item)}
          customPlaceholder="Ajouter une zone libre"
          onAddCustom={(value) => setGeographiesFocus([...geographiesFocus, value])}
          disabled={!isAdmin}
        />
      </Section>

      <Section title="Zones geographiques exclues" subtitle="Pays ou regions hors perimetre. Optionnel.">
        <ChipPicker
          options={[]}
          selected={geographiesExcluded}
          onToggle={(item) => toggle(geographiesExcluded, setGeographiesExcluded, item)}
          customPlaceholder="Ajouter une zone exclue"
          onAddCustom={(value) => setGeographiesExcluded([...geographiesExcluded, value])}
          disabled={!isAdmin}
          variant="excluded"
        />
      </Section>

      {/* TICKETS */}
      <Section title="Gamme de tickets" subtitle="Montant minimum et maximum que le fonds peut investir, en euros.">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px' }}>
            <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-tertiary)', marginBottom: 6 }}>
              Ticket minimum (EUR)
            </label>
            <input
              type="number"
              value={ticketMin}
              onChange={(e) => setTicketMin(e.target.value)}
              disabled={!isAdmin}
              placeholder="ex. 250000"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: '1 1 240px' }}>
            <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-tertiary)', marginBottom: 6 }}>
              Ticket maximum (EUR)
            </label>
            <input
              type="number"
              value={ticketMax}
              onChange={(e) => setTicketMax(e.target.value)}
              disabled={!isAdmin}
              placeholder="ex. 5000000"
              style={inputStyle}
            />
          </div>
        </div>
      </Section>

      {/* STADES */}
      <Section title="Stades investis" subtitle="Les stades du cycle de vie auxquels le fonds entre dans un dossier.">
        <ChipPicker
          options={COMMON_STAGES}
          selected={stagesFocus}
          onToggle={(item) => toggle(stagesFocus, setStagesFocus, item)}
          customPlaceholder="Ajouter un stade libre"
          onAddCustom={(value) => setStagesFocus([...stagesFocus, value])}
          disabled={!isAdmin}
        />
      </Section>

      {/* NOTES LIBRES */}
      <Section title="Notes libres" subtitle="Nuances, exceptions, criteres specifiques que les listes ci-dessus ne capturent pas. Le moteur de pre-scan les lit et en tient compte.">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={!isAdmin}
          rows={5}
          placeholder="Exemple : on peut investir hors these sectorielle si le fondateur est un ancien CEO de portfolio. On evite les modeles purement publicitaires."
          style={{ ...inputStyle, fontFamily: 'inherit', minHeight: 100 }}
        />
      </Section>

      {/* ACTIONS */}
      {isAdmin && (
        <div style={{ marginTop: 36, paddingTop: 24, borderTop: '1px solid var(--rule-soft)' }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(192, 64, 60, 0.08)',
              borderLeft: '3px solid #c0403c',
              fontSize: 13,
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(80, 140, 90, 0.08)',
              borderLeft: '3px solid #508c5a',
              fontSize: 13,
              marginBottom: 16,
            }}>
              {success}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer la these'}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPOSANTS LOCAUX
// ============================================================

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{
        fontFamily: 'var(--serif)',
        fontSize: 18,
        fontWeight: 500,
        marginBottom: 4,
      }}>
        {title}
      </h2>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 14, lineHeight: 1.55 }}>
        {subtitle}
      </p>
      {children}
    </div>
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

  // Toutes les options : presets + selections custom non dans presets
  const customs = selected.filter(s => !options.includes(s));
  const allOptions = [...options, ...customs];

  const selectedColor = variant === 'excluded' ? 'rgba(192, 64, 60, 0.2)' : 'rgba(31, 41, 95, 0.18)';
  const selectedBorder = variant === 'excluded' ? '#c0403c' : 'var(--ink)';

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {allOptions.map(opt => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => !disabled && onToggle(opt)}
              disabled={disabled}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: isSelected ? selectedColor : 'transparent',
                border: `1px solid ${isSelected ? selectedBorder : 'var(--rule)'}`,
                color: isSelected ? 'var(--ink)' : 'var(--ink-soft)',
                cursor: disabled ? 'default' : 'pointer',
                borderRadius: 2,
                fontFamily: 'inherit',
                opacity: disabled ? 0.6 : 1,
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {!disabled && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustom(); } }}
            placeholder={customPlaceholder}
            style={{ ...inputStyle, flex: 1, fontSize: 12, padding: '6px 10px' }}
          />
          <button
            type="button"
            onClick={handleAddCustom}
            style={{
              padding: '6px 14px',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              border: '1px solid var(--rule)',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Ajouter
          </button>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 14,
  border: '1px solid var(--rule)',
  background: 'var(--bg)',
  fontFamily: 'inherit',
  borderRadius: 2,
  color: 'var(--ink)',
};
