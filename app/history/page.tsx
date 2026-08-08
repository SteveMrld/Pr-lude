// ============================================================
// Page /history - Vue de fonds des analyses
// ------------------------------------------------------------
// Liste les analyses sauvegardees avec, pour chaque dossier :
//   - badge de stade workflow (depose, en instruction, DD terrain,
//     IC, signe, refuse) avec date relative de transition
//   - compteurs de versions et de commentaires non resolus
//   - filtres par verdict, par stade, recherche texte
//   - stats de fonds en haut (verdicts, score moyen, total)
//
// L objectif est de donner immediatement a un partner ou un membre
// du fonds une vue de pilotage : ou en sont mes 23 dossiers, lequel
// attend un retour, lequel est pret pour le comite.
// ============================================================

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import DossierLigne from '@/app/components/DossierLigne';
import DossierGroupeVue from '@/app/components/DossierGroupe';
import { regrouperParDossier, type DossierGroupe } from '@/lib/note/regrouper-dossiers';

/**
 * Combien d executions la page charge avant de les regrouper.
 *
 * Le regroupement ne voit que ce qui est charge : au-dela de cette
 * borne, un dossier verrait ses reprises tronquees. Le corpus en compte
 * trente-neuf pour un fonds au 8 aout 2026 ; la borne est posee tres
 * au-dessus, et la liste dit quand elle est atteinte plutot que de
 * rendre un compte silencieusement partiel.
 */
const BORNE_CHARGEMENT = 300;

interface AnalysisSummary {
  id: string;
  companyName: string;
  sector: string | null;
  subSector: string | null;
  country: string | null;
  yearFounded: number | null;
  roundType: string | null;
  roundAmountEur: number | null;
  verdict: string;
  globalScore: number | null;
  blindspotScore: number | null;
  contrarianScore: number | null;
  coherenceScore: number | null;
  createdAt: string;
  workflowStage: string | null;
  workflowStageUpdatedAt: string | null;
  versionsCount: number;
  openCommentsCount: number;
  hasBloc2: boolean;
  sourceFilename: string | null;
  status: string | null;
  failedEnginesCount: number | null;
  /**
   * Ce que le bulletin de fiabilite retient, ou null quand il n a jamais
   * ete releve. Null n est pas zero : le bulletin n existe que sur les
   * runs depuis le 5 aout 2026, et un dossier sans bulletin n est pas un
   * dossier sans reserve.
   */
  reserves: { total: number; majeures: number } | null;
}

interface Stats {
  total: number;
  byVerdict: Record<string, number>;
  avgGlobalScore: number | null;
  avgBlindspotScore: number | null;
  lastAnalysisAt: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  deposited: 'Depose',
  in_review: 'En instruction',
  dd_field: 'DD terrain',
  ic_review: 'Pret pour IC',
  signed: 'Signe',
  declined: 'Refuse',
};

// Palette identite : voir WorkflowStageBadge.tsx pour le rationnel. La
// progression va du gris muted vers l encre puis le vert, en passant par
// l ocre mi-ton puis ocre porteur.
// LE STADE SE LIT A L ENCRE, ET SEUL CELUI QUI AVANCE PORTE L OCRE.
// Les six stades portaient six traitements dont un vert et un rouge, et
// `in_review`, qui est le stade par defaut de tous les dossiers, sortait
// en aplat ocre : il etait donc la chose la plus voyante de chaque ligne
// alors qu il ne distingue rien, puisque les trente-neuf dossiers le
// portent. L ocre est reserve aux deux stades qui signifient qu un
// travail est engage, le reste reste a l encre.
const STAGE_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  deposited: { bg: 'transparent', fg: 'var(--muted-soft)', border: 'var(--hairline)' },
  in_review: { bg: 'transparent', fg: 'var(--muted)',      border: 'var(--hairline)' },
  dd_field:  { bg: 'var(--accent-soft)', fg: 'var(--accent)', border: 'var(--accent)' },
  ic_review: { bg: 'transparent', fg: 'var(--accent)',    border: 'var(--accent-mid)' },
  signed:    { bg: 'var(--accent)', fg: 'var(--paper)',   border: 'var(--accent)' },
  declined:  { bg: 'transparent', fg: 'var(--muted-soft)', border: 'var(--hairline)' },
};

function formatRelative(iso: string): string {
  if (!iso) return '';
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffMin = Math.floor((now - then) / 60000);
    if (diffMin < 1) return 'a l instant';
    if (diffMin < 60) return `il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `il y a ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `il y a ${diffD}j`;
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

export default function HistoryPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (verdictFilter) params.set('verdict', verdictFilter);
      if (stageFilter) params.set('workflow_stage', stageFilter);
      if (searchQuery) params.set('q', searchQuery);
      // LE REGROUPEMENT SE FAIT SUR CE QUI EST CHARGE, donc la borne est
      // posee explicitement plutot que laissee au defaut de la route.
      // Un dossier dont une partie des executions serait restee hors de
      // la page afficherait un compte de reprises trop bas, et rien ne
      // le dirait. La borne se declare aussi a l ecran quand la page est
      // pleine.
      params.set('limit', String(BORNE_CHARGEMENT));
      const res = await fetch(`/api/analyses/list?${params.toString()}`);
      const data = await res.json();
      setEnabled(data.enabled);
      setAnalyses(data.analyses || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error('Erreur chargement historique :', err);
    } finally {
      setLoading(false);
    }
  }, [verdictFilter, stageFilter, searchQuery]);

  /**
   * Export CSV de la liste de dossiers actuellement filtree. Utile pour
   * un partner qui veut partager son pipeline en comite, ou un analyste
   * qui veut faire des stats croisees dans Excel. Genere le fichier cote
   * client (pas de round-trip serveur), nomme avec la date du jour.
   *
   * Colonnes : nom societe, secteur, sous-secteur, pays, annee fondation,
   * tour, montant EUR, verdict, score global, score vigilance, score
   * coherence, stade workflow, derniere transition, versions, commentaires
   * ouverts, presence Bloc 2, date de creation.
   *
   * Encode les champs avec virgule, guillemet ou retour ligne en double-
   * guillemet pour la conformite CSV. UTF-8 BOM en tete pour qu Excel
   * ouvre correctement les accents en francais.
   */
  const exportCsv = useCallback(() => {
    if (analyses.length === 0) return;
    const header = [
      'Societe', 'Secteur', 'Sous-secteur', 'Pays', 'Annee fondation',
      'Tour', 'Montant EUR', 'Verdict', 'Score global', 'Score vigilance',
      'Score coherence', 'Stade', 'Derniere transition', 'Versions',
      'Commentaires ouverts', 'Bloc 2', 'Date analyse',
    ];
    const escape = (value: any): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };
    const rows = analyses.map(a => [
      a.companyName,
      a.sector || '',
      a.subSector || '',
      a.country || '',
      a.yearFounded || '',
      a.roundType || '',
      a.roundAmountEur || '',
      a.verdict || '',
      a.globalScore ?? '',
      a.blindspotScore ?? '',
      a.coherenceScore ?? '',
      STAGE_LABELS[a.workflowStage || 'deposited'] || a.workflowStage || '',
      a.workflowStageUpdatedAt ? new Date(a.workflowStageUpdatedAt).toLocaleDateString('fr-FR') : '',
      a.versionsCount,
      a.openCommentsCount,
      a.hasBloc2 ? 'oui' : 'non',
      a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '',
    ].map(escape).join(','));
    const csv = '\uFEFF' + [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const today = new Date().toISOString().slice(0, 10);
    link.download = `prelude-portefeuille-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [analyses]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer definitivement l analyse de ${name} ?`)) return;
    try {
      const res = await fetch(`/api/analyses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        load();
      } else {
        alert('Suppression échouée');
      }
    } catch {
      alert('Erreur réseau');
    }
  };

  // Repartition par stade workflow pour les pastilles
  const stageBreakdown = analyses.reduce((acc, a) => {
    const stage = a.workflowStage || 'in_review';
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (enabled === false) {
    return (
      <main style={{ padding: '40px 32px', maxWidth: 980, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500, marginBottom: 16 }}>
          Historique des analyses
        </h1>
        <div style={{
          padding: 24, background: 'var(--surface-deep, var(--surface))', border: '1px solid var(--hairline)',
          fontSize: 14, lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 8 }}>
            Persistance désactivée
          </div>
          <p style={{ marginBottom: 12 }}>
            La sauvegarde des analyses n&apos;est pas encore activée sur cette
            instance. Pour l&apos;activer, l&apos;administrateur doit :
          </p>
          <ol style={{ paddingLeft: 20, marginBottom: 12 }}>
            <li>Exécuter le script <code>supabase-persistence-schema.sql</code> dans le SQL Editor de Supabase</li>
            <li>Définir <code>ENABLE_PERSISTENCE=true</code> dans les variables d&apos;environnement Vercel</li>
            <li>Redéployer l&apos;application</li>
          </ol>
          <p style={{ opacity: 0.7 }}>
            En attendant, le pipeline d&apos;analyse reste pleinement fonctionnel.
            Les analyses ne sont simplement pas conservées entre sessions.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: '32px 24px 80px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 11,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            marginBottom: 18,
            fontWeight: 600,
            fontFamily: 'var(--sans)',
          }}>
            <span style={{
              width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%', display: 'inline-block',
            }} />
            <span>Vue de fonds · Historique</span>
          </div>
          <h1 style={{
            fontFamily: 'var(--serif)',
            fontSize: 'clamp(32px, 4.5vw, 44px)',
            fontWeight: 700,
            margin: 0,
            letterSpacing: '-0.022em',
            lineHeight: 1.05,
            color: 'var(--ink)',
          }}>
            Historique des analyses
          </h1>
        </div>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: 'var(--paper)',
            background: 'var(--ink)',
            textDecoration: 'none',
            padding: '12px 22px',
            borderRadius: 8,
            border: '1px solid var(--ink)',
            transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)',
            fontFamily: 'var(--sans)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent)';
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(30, 58, 138, 0.20)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--ink)';
            e.currentTarget.style.borderColor = 'var(--ink)';
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Nouvelle analyse →
        </Link>
      </div>

      {stats && stats.total > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 14, marginBottom: 24,
        }}>
          <StatBox label="Total" value={stats.total} />
          <StatBox label="Investir" value={stats.byVerdict.investir || 0} accent="var(--positif)" />
          <StatBox label="Conditions" value={stats.byVerdict['investir-conditions'] || 0} accent="var(--accent)" />
          <StatBox label="Approfondir" value={stats.byVerdict.approfondir || 0} accent="var(--ocre-brule)" />
          <StatBox label="Refuser" value={stats.byVerdict.refuser || 0} accent="var(--warn)" />
          {stats.avgGlobalScore != null && (
            <StatBox label="Score moyen" value={Math.round(stats.avgGlobalScore)} suffix="/100" />
          )}
        </div>
      )}

      {/* Repartition par stade workflow : pastilles cliquables filtre */}
      {!loading && analyses.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 18,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          <span style={{
            fontSize: 9,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
            fontWeight: 500,
            marginRight: 4,
          }}>
            Stades
          </span>
          {(['in_review', 'dd_field', 'ic_review', 'signed', 'declined'] as const).map((stage) => {
            const count = stageBreakdown[stage] || 0;
            const colors = STAGE_COLORS[stage];
            const isActive = stageFilter === stage;
            return (
              <button
                key={stage}
                onClick={() => setStageFilter(isActive ? '' : stage)}
                style={{
                  padding: '7px 14px',
                  fontSize: 10.5,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  background: isActive ? colors.fg : colors.bg,
                  color: isActive ? 'var(--paper)' : colors.fg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'var(--sans)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: count === 0 && !isActive ? 0.4 : 1,
                  transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {STAGE_LABELS[stage]}
                <span style={{ fontSize: 10.5, fontWeight: 700, opacity: isActive ? 0.95 : 0.85 }}>{count}</span>
              </button>
            );
          })}
          {stageFilter && (
            <button
              onClick={() => setStageFilter('')}
              style={{
                padding: '5px 9px',
                fontSize: 10,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: 'transparent',
                color: 'var(--muted)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textDecoration: 'underline',
              }}
            >
              Effacer
            </button>
          )}
        </div>
      )}

      <div style={{
        display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap',
        padding: 18,
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        borderRadius: 12,
      }}>
        <input
          type="text"
          placeholder="Rechercher une societe..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: '1 1 220px',
            padding: '10px 14px',
            fontSize: 13.5,
            border: '1px solid var(--hairline)',
            background: 'var(--paper)',
            color: 'var(--ink)',
            fontFamily: 'var(--serif)',
            borderRadius: 8,
            outline: 'none',
            transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--hairline)'; }}
        />
        <select
          value={verdictFilter}
          onChange={(e) => setVerdictFilter(e.target.value)}
          style={{
            padding: '10px 14px',
            fontSize: 13.5,
            border: '1px solid var(--hairline)',
            background: 'var(--paper)',
            color: 'var(--ink)',
            fontFamily: 'var(--serif)',
            borderRadius: 8,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">Tous verdicts</option>
          <option value="investir">Investir</option>
          <option value="investir-conditions">Investir avec conditions</option>
          <option value="approfondir">Approfondir</option>
          <option value="refuser">Refuser</option>
        </select>
        <button
          onClick={exportCsv}
          disabled={analyses.length === 0}
          title="Exporter la liste filtree en CSV (compatible Excel et Google Sheets)"
          style={{
            padding: '10px 16px',
            fontSize: 12.5,
            border: '1px solid var(--ink)',
            background: 'transparent',
            color: 'var(--ink)',
            fontFamily: 'var(--serif)',
            borderRadius: 8,
            cursor: analyses.length === 0 ? 'not-allowed' : 'pointer',
            opacity: analyses.length === 0 ? 0.4 : 1,
            outline: 'none',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          Export CSV ({analyses.length})
        </button>
      </div>

      {loading ? (
        <div style={{
          padding: 60,
          textAlign: 'center',
          color: 'var(--muted)',
          fontFamily: 'var(--serif)',
          fontStyle: 'italic',
        }}>Chargement...</div>
      ) : analyses.length === 0 ? (
        <div style={{
          padding: 60,
          textAlign: 'center',
          background: 'var(--surface)',
          border: '2px dashed var(--hairline)',
          borderRadius: 12,
          fontSize: 15,
          color: 'var(--muted)',
          fontFamily: 'var(--serif)',
          fontStyle: 'italic',
        }}>
          {searchQuery || verdictFilter || stageFilter
            ? 'Aucune analyse ne correspond aux filtres.'
            : 'Aucune analyse sauvegardee pour le moment. Lance une analyse depuis l accueil.'}
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--hairline)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
        }}>
          {regrouperParDossier(analyses, (a) => ({
            id: a.id,
            companyName: a.companyName,
            sourceFilename: a.sourceFilename,
            createdAt: a.createdAt,
            verdict: a.verdict,
          })).map((groupe, i, tous) => (
            <AnalysisRow
              key={groupe.clef}
              analysis={groupe.tete}
              groupe={groupe}
              isLast={i === tous.length - 1}
              onDelete={() => handleDelete(groupe.tete.id, groupe.tete.companyName)}
              onStageChanged={load}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function StatBox({ label, value, suffix, accent }: {
  label: string;
  value: number | string;
  suffix?: string;
  accent?: string;
}) {
  return (
    <div style={{
      padding: '20px 22px 18px',
      background: 'var(--surface)',
      border: '1px solid var(--hairline)',
      borderRadius: 12,
      transition: 'all 220ms cubic-bezier(0.16, 1, 0.3, 1)',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = 'var(--muted-soft)';
      e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.05)';
      e.currentTarget.style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = 'var(--hairline)';
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.transform = 'none';
    }}
    >
      <div style={{
        fontFamily: 'var(--sans)',
        fontSize: 10.5,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        marginBottom: 10,
        fontWeight: 600,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--serif)',
        fontSize: 32,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: '-0.02em',
        color: accent || 'var(--accent)',
        fontFeatureSettings: '"lnum","tnum"',
      }}>
        {value}{suffix && <span style={{ fontSize: 16, opacity: 0.5, marginLeft: 2, fontWeight: 500 }}>{suffix}</span>}
      </div>
    </div>
  );
}

function AnalysisRow({ analysis, groupe, isLast, onDelete, onStageChanged }: {
  analysis: AnalysisSummary;
  groupe: DossierGroupe<AnalysisSummary>;
  isLast: boolean;
  onDelete: () => void;
  onStageChanged: () => void;
}) {
  // LA LIGNE EST CELLE DE L ACCUEIL. Elle vivait ici en propre, sur une
  // grille de cinq colonnes, avec ses tables de libelles et de couleurs,
  // et l accueil avait les siennes : les deux avaient diverge du
  // producteur et pas de la meme facon. L historique ne garde donc que ce
  // qu il a de plus, le stade d instruction et les actions, qu il passe
  // en enfants.
  const date = new Date(analysis.createdAt);
  const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  const stage = analysis.workflowStage || 'in_review';

  const bouton = (fond: string, encre: string, bordure: string) => ({
    padding: '5px 11px',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: encre,
    border: `1px solid ${bordure}`,
    background: fond,
    textDecoration: 'none',
    borderRadius: 6,
    fontFamily: 'var(--sans)',
    whiteSpace: 'nowrap' as const,
    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
  });

  const compteur = (titre: string, texte: string, encre: string) => (
    <span
      title={titre}
      style={{
        fontFamily: 'var(--sans)',
        fontSize: 9.5,
        letterSpacing: '0.06em',
        padding: '2px 6px',
        color: encre,
        border: `1px solid ${encre === 'var(--accent)' ? 'var(--accent)' : 'var(--hairline)'}`,
        borderRadius: 999,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {texte}
    </span>
  );

  return (
    <DossierGroupeVue
      derniere={isLast}
      verdictABouge={groupe.verdictABouge}
      reprises={groupe.runs.slice(1).map((r) => ({
        id: r.id,
        createdAtLabel: new Date(r.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
        verdict: r.verdict,
        globalScore: r.globalScore,
        // Le parcours n est persiste nulle part : la route le lit a
        // l entree et ne l ecrit jamais. La colonne reste vide plutot
        // que de porter une valeur devinee.
        parcours: null,
      }))}
      rendreTete={(boutonReprises) => (
    <DossierLigne
      id={analysis.id}
      companyName={analysis.companyName}
      verdict={analysis.verdict}
      globalScore={analysis.globalScore}
      status={analysis.status}
      failedEnginesCount={analysis.failedEnginesCount}
      reserves={analysis.reserves}
      sector={analysis.sector}
      country={analysis.country}
      createdAtLabel={dateStr}
      createdAtIso={analysis.createdAt}
      sourceFilename={analysis.sourceFilename}
      derniere
      metaSupplementaire={
        // LA VIGILANCE ET L ETAT DE DD QUALIFIENT LE DOSSIER, ILS NE LE
        // DECLENCHENT PAS. Ils occupaient deux colonnes de la premiere
        // ligne, ou ils repoussaient le nom jusqu a le faire passer a la
        // ligne, et « Bloc 1 seul » y sortait en ocre sur trente lignes
        // sur trente-neuf, c est-a-dire qu il criait une propriete que
        // presque tous partagent. Ils descendent en seconde ligne, avec
        // le reste de ce qui se lit une fois qu on s est arrete.
        <>
          {analysis.blindspotScore != null && (
            <span style={{ color: 'var(--muted)' }}>
              {' · '}vigilance <strong style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>{Math.round(analysis.blindspotScore)}</strong>
            </span>
          )}
          {analysis.verdict !== 'refuser' && (
            <span style={{ color: 'var(--muted-soft)' }}>
              {' · '}{analysis.hasBloc2 ? 'DD complete' : 'Bloc 1 seul'}
            </span>
          )}
        </>
      }
      marqueurs={
        <>
          {analysis.versionsCount > 1 && compteur(
            `${analysis.versionsCount} versions`, `v${analysis.versionsCount}`, 'var(--muted)',
          )}
          {analysis.openCommentsCount > 0 && compteur(
            `${analysis.openCommentsCount} commentaire(s) non resolu(s)`,
            `${analysis.openCommentsCount} a traiter`,
            'var(--accent)',
          )}
          {boutonReprises}
        </>
      }
    >
      <div style={{ minWidth: 116 }}>
        <InlineStageEditor
          analysisId={analysis.id}
          currentStage={stage}
          onChanged={onStageChanged}
        />
        {analysis.workflowStageUpdatedAt && (
          <div style={{ fontSize: 9, color: 'var(--muted-soft)', marginTop: 2, letterSpacing: 0 }}>
            {formatRelative(analysis.workflowStageUpdatedAt)}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        {analysis.verdict !== 'refuser' && !analysis.hasBloc2 && (
          <Link
            href={`/dossiers/${analysis.id}?action=dd`}
            // L ocre s est retire de ce bouton : il figurait sur trente
            // lignes sur trente-neuf, donc il ne distinguait rien et
            // depensait l accent que la reserve et l etat degrade
            // utilisent pour dire qu un dossier demande quelque chose.
            style={bouton('transparent', 'var(--ink-soft)', 'var(--hairline)')}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.color = 'var(--paper)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--ink-soft)';
              e.currentTarget.style.borderColor = 'var(--hairline)';
            }}
          >
            Lancer DD
          </Link>
        )}
        <Link
          href={`/dossiers/${analysis.id}`}
          style={bouton('var(--surface)', 'var(--ink)', 'var(--hairline)')}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent)';
            e.currentTarget.style.color = 'var(--paper)';
            e.currentTarget.style.borderColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface)';
            e.currentTarget.style.color = 'var(--ink)';
            e.currentTarget.style.borderColor = 'var(--hairline)';
          }}
        >
          Ouvrir
        </Link>
        <button
          onClick={onDelete}
          aria-label="Supprimer l analyse"
          style={{
            ...bouton('var(--surface)', 'var(--muted)', 'var(--hairline)'),
            cursor: 'pointer',
            fontSize: 13,
            lineHeight: 1,
            padding: '5px 9px',
          }}
        >
          ×
        </button>
      </div>
    </DossierLigne>
      )}
    />
  );
}

// ============================================================
// InlineStageEditor
// ------------------------------------------------------------
// Badge de stade workflow cliquable, qui ouvre un menu pour faire
// passer le dossier d un stade a un autre sans avoir a quitter
// la liste de fonds. Au clic sur une option, on PATCH la route
// /api/analyses/[id]/status (qui poste aussi la notif Slack en
// best effort) et on appelle onChanged() pour que le parent
// rafraichisse la liste avec le nouveau stade.
//
// Outside-click ferme le menu. Loading state pendant le PATCH
// avec opacite reduite et texte Mise a jour.
// ============================================================
function InlineStageEditor({
  analysisId,
  currentStage,
  onChanged,
}: {
  analysisId: string;
  currentStage: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Outside click pour fermer le menu
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const colors = STAGE_COLORS[currentStage] || STAGE_COLORS.in_review;
  const label = STAGE_LABELS[currentStage] || currentStage;

  const handleSelect = async (newStage: string) => {
    if (newStage === currentStage) {
      setOpen(false);
      return;
    }
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/analyses/${analysisId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setOpen(false);
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Erreur');
    } finally {
      setUpdating(false);
    }
  };

  const stageOptions = ['deposited', 'in_review', 'dd_field', 'ic_review', 'signed', 'declined'];

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(!open)}
        disabled={updating}
        style={{
          padding: '4px 10px',
          fontSize: 10,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          fontWeight: 500,
          background: colors.bg,
          color: colors.fg,
          border: `1px solid ${colors.border}`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
          cursor: updating ? 'wait' : 'pointer',
          opacity: updating ? 0.6 : 1,
          fontFamily: 'inherit',
        }}
        title="Cliquer pour changer le stade d&apos;instruction"
      >
        <span style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: colors.fg,
          display: 'inline-block',
        }} />
        {updating ? 'Mise a jour...' : label}
        <span style={{ fontSize: 8, opacity: 0.7, marginLeft: 2 }}>▾</span>
      </button>

      {open && !updating && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          zIndex: 50,
          background: 'var(--paper, #faf6ed)',
          border: '1px solid var(--hairline)',
          minWidth: 160,
          boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
        }}>
          {stageOptions.map((opt) => {
            const optColors = STAGE_COLORS[opt];
            const isCurrent = opt === currentStage;
            return (
              <button
                key={opt}
                onClick={() => handleSelect(opt)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 12px',
                  background: isCurrent ? optColors.bg : 'transparent',
                  color: optColors.fg,
                  border: 'none',
                  borderBottom: '1px solid var(--hairline)',
                  cursor: 'pointer',
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: optColors.fg,
                  display: 'inline-block',
                  flexShrink: 0,
                }} />
                {STAGE_LABELS[opt]}
                {isCurrent && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.7 }}>actuel</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          fontSize: 10,
          color: 'var(--warn)',
          padding: '4px 8px',
          background: 'var(--warn-soft)',
          border: '1px solid var(--warn)',
          borderRadius: 6,
          whiteSpace: 'nowrap',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
