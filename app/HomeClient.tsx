'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import InvestmentNoteView from './components/InvestmentNoteView';
import HistoricalComparables from './components/HistoricalComparables';
import RadarDimensions from './components/RadarDimensions';
import GaugeProbability from './components/GaugeProbability';
import PipelineProgress from './components/PipelineProgress';
import PipelinePreview from './components/PipelinePreview';
import CompetitiveMatrix from './components/CompetitiveMatrix';
import {
  requestNotificationPermissionSilent,
  notifyPipelineComplete,
  setTabTitleAttention,
  bindTabTitleRestore,
} from '@/lib/pipeline-notifier';
import IcPackView from './components/IcPackView';
import { TrajectoryView } from './components/TrajectoryView';
import WorkflowStageBadge from './components/WorkflowStageBadge';
import ThemeToggle from './components/ThemeToggle';
import CommentsPanel from './components/CommentsPanel';
import VersionSelector from './components/VersionSelector';
import { enrichProse, splitIntoParagraphs } from '@/lib/note-typography';
import { ENGINE_PICTOS } from './components/Pictos';
import { Picto } from './components/Picto';

// Liste des moteurs affiches pendant l execution. Organisee selon
// la structure du repositionnement Bloc 1 (Note d instruction) /
// Bloc 2 (Data Room). Les moteurs Bloc 2 ne tournent que si les
// documents data room correspondants ont ete uploades, sinon ils
// sont silencieux.
type EngineBlock = 'instruction' | 'dataroom';
const ENGINES: Array<{ id: string; name: string; label: string; block: EngineBlock }> = [
  // BLOC 0 - PRE-SCAN (TRIAGE RAPIDE)
  { id: 'prescan', name: 'Pré-scan', label: 'Triage rapide six à dix tests éliminatoires selon la thèse du fonds', block: 'instruction' },

  // BLOC 1 - NOTE D INSTRUCTION
  { id: 'extraction', name: 'Lecture du dossier', label: 'Structuration des informations du pitch deck', block: 'instruction' },
  { id: 'team', name: 'Équipe', label: 'Couverture systémique, anti-fragilité, transposition d\'expérience', block: 'instruction' },
  { id: 'market', name: 'Marché', label: 'Intensité du besoin, défensibilité, comparables internationaux', block: 'instruction' },
  { id: 'macro', name: 'Macro', label: 'Position cycle, géopolitique, fenêtre temporelle critique', block: 'instruction' },
  { id: 'financial-extraction', name: 'Extraction financière', label: 'Données financières du deck et du business plan', block: 'instruction' },
  { id: 'pattern', name: 'Pattern matching', label: 'Confrontation au corpus de cas instruits', block: 'instruction' },
  { id: 'causal', name: 'Retournement causal', label: 'Sept angles morts et questions à instruire', block: 'instruction' },
  { id: 'blindspot', name: 'Vigilance critique', label: 'Détection des dix patterns d\'erreur de jugement VC', block: 'instruction' },
  { id: 'contrarian', name: 'Singularités contrariennes', label: 'Détection des dix signaux contrariens à évaluer', block: 'instruction' },
  { id: 'financial-coherence', name: 'Cohérence financière', label: 'Sept tests de cohérence des projections et unit economics', block: 'instruction' },
  { id: 'tech-claim', name: 'Cohérence revendication tech', label: 'Audit du moat technologique revendiqué : budget, traçabilité, contre-factuel', block: 'instruction' },
  { id: 'execution-friction', name: 'Friction d\'exécution', label: 'Huit axes : go-to-market, financement transactionnel, industrialisation, supply chain, écosystème, régulation, référencement, talent rare', block: 'instruction' },
  { id: 'narrative-drift', name: 'Lecture du langage', label: 'Mesure du glissement concret/abstrait du discours et de la cohérence narrative dans le temps', block: 'instruction' },
  { id: 'fragility-structurelle', name: 'Fragilité structurelle', label: 'Sept patterns Phase 4 : croissance subventionnée, captivité infrastructure, coûts fixes, régulation à venir, érosion défensibilité, cap table, industrialisation prématurée', block: 'instruction' },
  { id: 'orchestrate', name: 'Orchestration', label: 'Synthèse, probabilités chiffrées, résolution dialectique', block: 'instruction' },
  { id: 'reference-checks', name: 'Reference checks', label: 'Plan d\'appels DD terrain : fondateurs, clients, gouvernance', block: 'instruction' },

  // BLOC 2 - DATA ROOM (DD approfondie)
  { id: 'ledger-parsing', name: 'Parsing grand livre', label: 'Lecture FEC ou Excel : soldes, CA réel 12M, marge réelle, top clients, engagements', block: 'dataroom' },
  { id: 'dd-financial', name: 'DD financière', label: 'Sept tests : CA, marge, burn, headcount, concentration, trajectoire, engagements vs narratif', block: 'dataroom' },
  { id: 'cap-table-parsing', name: 'Parsing cap table', label: 'Structure d\'actionnariat : fondateurs, investisseurs, pool d\'options, dilution', block: 'dataroom' },
  { id: 'dd-contractual', name: 'DD contractuelle', label: 'Cartographie de quinze clauses sensibles avec citation exacte : pacte, statuts, contrats clients', block: 'dataroom' },
  { id: 'dd-technical', name: 'DD technique', label: 'Lecture du dossier technique fourni : architecture, sécurité, RGPD, IP, BCP. Citation mot pour mot.', block: 'dataroom' },
];

const ARCHETYPE_LABELS: Record<string, string> = {
  'interpretive': 'Interprétatif',
  'depth': 'Profondeur d\'instruction',
  'capacity': 'Capacité opérationnelle',
  'cumulative-mid': 'Cumulé moyen terme',
  'cumulative-long': 'Cumulé long terme',
};

const BLINDSPOT_LABELS: Record<string, string> = {
  maturiteExecution: 'Maturité d\'exécution',
  intensiteBesoin: 'Intensité du besoin',
  distributionAcquise: 'Distribution acquise',
  antiFragilite: 'Anti-fragilité',
  coherenceNarrative: 'Cohérence narrative',
  signauxOrganiques: 'Signaux organiques',
  timingContracyclique: 'Timing contracyclique',
};

// Joint plusieurs morceaux par un separateur en filtrant les vides.
// Evite les artefacts visuels du genre ', France' ou 'seed ·' quand
// un des deux cotes du separateur est null/undefined/string vide.
// Si tous les morceaux sont vides, renvoie un fallback (defaut '—').
function joinNonEmpty(parts: (string | number | null | undefined)[], sep: string, fallback = '—'): string {
  const filtered = parts
    .filter(p => p !== null && p !== undefined && String(p).trim() !== '')
    .map(p => String(p).trim());
  if (filtered.length === 0) return fallback;
  return filtered.join(sep);
}

type EngineState = {
  status: 'idle' | 'running' | 'done' | 'error';
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
};

// Classification cote client des fichiers deposes pour donner un
// retour visuel immediat au partner. Logique alignee sur celle du
// file-processor cote serveur (seul le nom et le type sont
// inspectes), sans dependance Excel pour pouvoir tourner en
// navigateur. Utilise pour afficher la nature detectee de chaque
// fichier dans la liste apres upload.
type FileFamily =
  | 'pitch_deck'
  | 'business_plan'
  | 'general_ledger'
  | 'shareholders_agreement'
  | 'statutes'
  | 'cap_table'
  | 'client_contract'
  | 'technical_doc'
  | 'unknown';

const FAMILY_LABELS: Record<FileFamily, string> = {
  pitch_deck: 'Pitch Deck',
  business_plan: 'Business Plan',
  general_ledger: 'Grand livre comptable',
  shareholders_agreement: 'Pacte d\u2019actionnaires',
  statutes: 'Statuts',
  cap_table: 'Cap table',
  client_contract: 'Contrat client',
  technical_doc: 'Dossier technique',
  unknown: 'Non classifié',
};

function classifyFileClient(file: File): FileFamily {
  const lower = file.name.toLowerCase();
  const isPdf = file.type.includes('pdf') || lower.endsWith('.pdf');
  const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv');

  // Grand livre / FEC en priorite
  if (lower.includes('grand livre') || lower.includes('grand_livre') ||
      lower.includes('grandlivre') || lower.includes('general ledger') ||
      lower.includes('general_ledger') || lower.includes('generalledger') ||
      lower.includes('fec.') || lower.startsWith('fec_') ||
      lower.includes('_fec_') || lower.includes(' fec ') ||
      lower.includes('ecritures comptables') || lower.includes('ecritures_comptables') ||
      lower.includes('compta_') || lower.includes('_compta.') ||
      lower.includes('balance generale') || lower.includes('balance_generale') ||
      lower.includes('journal_compta') || lower.includes('ledger.')) {
    return 'general_ledger';
  }
  // Pacte
  if (lower.includes('pacte') ||
      lower.includes('shareholders agreement') ||
      lower.includes('shareholders_agreement') ||
      lower.includes('shareholdersagreement') ||
      lower.includes(' sha.') || lower.startsWith('sha_') ||
      lower.includes('_sha_') || lower.includes('sha-') ||
      lower.includes('shareholder_agreement') ||
      lower.includes('investment agreement')) {
    return 'shareholders_agreement';
  }
  // Statuts
  if (lower.includes('statuts') || lower.includes('articles of association') ||
      lower.includes('articles_of_association') ||
      lower.includes(' aoa.') || lower.startsWith('aoa_') ||
      lower.includes('articlesofassociation') ||
      lower.includes('bylaws') ||
      lower.includes('memorandum and articles')) {
    return 'statutes';
  }
  // Cap table
  if (lower.includes('cap table') || lower.includes('cap_table') ||
      lower.includes('captable') || lower.includes('capitalisation') ||
      lower.includes('capitalization') || lower.includes('actionnariat') ||
      lower.includes('cap-table') ||
      lower.includes('table de capitalisation') ||
      lower.includes('cap_structure') || lower.includes('capstructure') ||
      lower.includes('repartition capital')) {
    return 'cap_table';
  }
  // Contrat client
  if (lower.includes('contrat client') || lower.includes('contrat_client') ||
      lower.includes('contract_client') || lower.includes('clientcontract') ||
      lower.includes('client_agreement') ||
      lower.includes(' msa.') || lower.startsWith('msa_') ||
      lower.includes('_msa_') || lower.includes('master services agreement') ||
      lower.includes('master_services_agreement') ||
      lower.includes(' sla.') || lower.startsWith('sla_') ||
      lower.includes('order form') || lower.includes('order_form') ||
      lower.includes('purchase agreement') ||
      lower.includes('framework agreement')) {
    return 'client_contract';
  }
  // Dossier technique (Module 3)
  if (lower.includes('tech overview') || lower.includes('tech_overview') ||
      lower.includes('techoverview') ||
      lower.includes('tech & ip') || lower.includes('tech and ip') ||
      lower.includes('tech_ip') || lower.includes('techip') ||
      lower.includes('dossier technique') || lower.includes('dossier_technique') ||
      lower.includes('dossiertechnique') ||
      lower.includes('technical overview') || lower.includes('technical_overview') ||
      lower.includes('technicaloverview') ||
      lower.includes('architecture') ||
      lower.includes('security policy') || lower.includes('security_policy') ||
      lower.includes('securitypolicy') || lower.includes('security-policy') ||
      lower.includes('infosec') ||
      lower.includes('iso 27001') || lower.includes('iso_27001') ||
      lower.includes('iso27001') ||
      lower.includes(' soc2') || lower.includes('_soc2') ||
      lower.includes('soc 2') || lower.startsWith('soc2_') ||
      lower.includes('bcp') ||
      lower.includes('business continuity') ||
      lower.includes('business_continuity') ||
      lower.includes('disaster recovery') ||
      lower.includes('disaster_recovery') ||
      lower.includes('disasterrecovery') ||
      lower.includes('rgpd') ||
      lower.includes(' gdpr') || lower.includes('_gdpr') ||
      lower.includes('gdpr_') || lower.includes('gdpr-') ||
      lower.startsWith('gdpr') ||
      lower.includes('data protection') ||
      lower.includes('data_protection') ||
      lower.includes('dataprotection') ||
      lower.includes('registre des traitements') ||
      lower.includes('registre_des_traitements') ||
      lower.includes('processing register') ||
      lower.includes('technical_dd') || lower.includes('technicaldd') ||
      lower.includes('tech_dd') || lower.includes('techdd') ||
      lower.includes('tech-dd') ||
      lower.includes('ip schedule') || lower.includes('ip_schedule') ||
      lower.includes('ipschedule')) {
    return 'technical_doc';
  }
  // Business plan
  if (lower.includes('business plan') || lower.includes('businessplan') ||
      lower.includes('bp ') || lower.includes('_bp_') ||
      lower.includes('financial') || lower.includes('financier') ||
      lower.includes('budget') || lower.includes('forecast') ||
      lower.includes('projection')) {
    return 'business_plan';
  }
  // Pitch deck par defaut sur PDF non identifie
  if (lower.includes('pitch') || lower.includes('deck') ||
      lower.includes('teaser') || lower.includes('investor')) {
    return 'pitch_deck';
  }
  if (isPdf) return 'pitch_deck';
  if (isExcel) return 'business_plan';
  return 'unknown';
}

export default function HomeClient({
  userEmail,
  userId,
  orgName,
  authEnabled = false,
  userRole,
}: {
  userEmail?: string;
  userId?: string;
  orgName?: string;
  authEnabled?: boolean;
  userRole?: 'admin' | 'member' | 'observer';
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  // DD APPROFONDIE (Bloc 2) : workflow en deux temps. Le partner
  // declenche cette phase apres avoir lu la note Bloc 1 et decide
  // que le dossier merite une instruction approfondie (verdict
  // different de refuser). La zone d upload Bloc 2 ne s ouvre qu a
  // sa demande, via le bandeau dans la note.
  const [ddDeepenOpen, setDdDeepenOpen] = useState<boolean>(false);
  const [ddDeepenFiles, setDdDeepenFiles] = useState<File[]>([]);
  const [ddDeepenAnalyzing, setDdDeepenAnalyzing] = useState<boolean>(false);
  const [ddDeepenError, setDdDeepenError] = useState<string | null>(null);
  const ddDeepenInputRef = useRef<HTMLInputElement | null>(null);
  const [engineStates, setEngineStates] = useState<Record<string, EngineState>>(
    Object.fromEntries(ENGINES.map(e => [e.id, { status: 'idle' }]))
  );
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // Gating doux du pre-scan : si verdict Bloc 0 knockout sans force,
  // le pipeline s arrete et on stocke le verdict ici pour afficher le
  // bandeau de gating qui propose au partner de forcer l analyse
  // complete malgre tout (relance avec forcePrescan=true).
  const [prescanKnockout, setPrescanKnockout] = useState<{
    summary: string;
    failedTests: string[];
    score: number;
    totalTests: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  // Mode dev : permet de forcer l execution du moteur narrative-drift
  // (Lecture du langage) meme quand la matrice de pertinence le
  // declare non applicable. Toggle exposé dans la zone d options
  // d analyse, persiste en localStorage entre sessions pour le QA.
  const [forceNarrativeDrift, setForceNarrativeDriftRaw] = useState<boolean>(false);
  const setForceNarrativeDrift = (v: boolean) => {
    setForceNarrativeDriftRaw(v);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('prelude_force_narrative_drift', v ? '1' : '0');
      }
    } catch {
      // localStorage indisponible, on continue
    }
  };
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const v = localStorage.getItem('prelude_force_narrative_drift');
      if (v === '1') setForceNarrativeDriftRaw(true);
    } catch {
      // ignore
    }
  }, []);
  const [activeTab, setActiveTab] = useState('synthesis');
  // Onglet actif sur la landing page : permet de presenter le
  // contenu en sections separees plutot qu en un long scroll. Quatre
  // onglets : vision (pourquoi + pour qui), method (les 4 temps et
  // 18 moteurs), deliverables (note + data room), sources
  // (calibration externe et standards juridiques).
  // Persiste en localStorage pour que la preference de lecture
  // (un partner qui aime entrer par Methode) survive aux refresh.
  const [landingTab, setLandingTab] = useState<'vision' | 'method' | 'deliverables' | 'sources'>(() => {
    if (typeof window === 'undefined') return 'vision';
    try {
      const stored = localStorage.getItem('prelude_landing_tab');
      if (stored === 'vision' || stored === 'method' || stored === 'deliverables' || stored === 'sources') {
        return stored;
      }
    } catch {}
    return 'vision';
  });
  useEffect(() => {
    try {
      localStorage.setItem('prelude_landing_tab', landingTab);
    } catch {}
  }, [landingTab]);

  // Bind du restore de titre d onglet quand le partner revient
  // sur l onglet apres une notification systeme. Idempotent et
  // sans effet si le navigateur ne supporte pas visibilitychange.
  useEffect(() => {
    return bindTabTitleRestore();
  }, []);
  const [viewMode, setViewMode] = useState<'dashboard' | 'note'>('dashboard');
  const [printMode, setPrintMode] = useState(false); // quand true, toutes les sections rendues simultanement pour export PDF complet
  // Note d investissement : mode compact (lecture rapide) vs mode complet
  // (lecture exhaustive). Persistance via localStorage. Le mode compact replie
  // les sections 2 et 4 par defaut. Le mode print force compactNoteMode=false
  // pour que l export PDF reste complet.
  const [compactNoteMode, setCompactNoteMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('prelude_compact_note') === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('prelude_compact_note', String(compactNoteMode));
    } catch {}
  }, [compactNoteMode]);
  // Persistence : ID de l analyse sauvegardee (pour bouton "voir dans l historique")
  const [savedAnalysisId, setSavedAnalysisId] = useState<string | null>(null);
  // Historique workflow : transitions de stade pour le dossier en cours.
  // Charge en async des qu un savedAnalysisId est connu, pour pouvoir le
  // passer au IcPackView qui le rend en timeline page 1.
  const [workflowHistory, setWorkflowHistory] = useState<Array<{
    fromStage: string | null;
    toStage: string;
    changedAt: string;
    comment: string | null;
  }>>([]);
  // Votes IC du comite : enregistrements en base, charges en async des
  // qu un dossier est connu. Format aligne sur ce qu attend IcPackView.
  const [icVotes, setIcVotes] = useState<Array<{
    userId: string;
    userEmail: string | null;
    voteOption: string;
    votedAt: string;
  }>>([]);
  // Decision officielle IC (page 3 du Pack IC) : verdict final, partner,
  // date de comite, conditions retenues. Persiste en base. Distinct des
  // votes individuels (icVotes) qui agregent les positions par membre.
  const [icDecision, setIcDecision] = useState<{
    analysisId: string;
    partnerPrincipal: string | null;
    committeeDate: string | null;
    voteResult: 'approuve' | 'approuve-avec-conditions' | 'reporte' | 'refuse' | null;
    conditions: string | null;
    updatedAt: string;
    updatedBy: string | null;
  } | null>(null);
  // Stats agregees du fonds, chargees au mount pour alimenter la barre
  // de contexte du hero (Eurazeo · X dossiers · Y en instruction · 
  // derniere analyse il y a Z jours). Donne une dimension de pilotage
  // a la home plutot qu un simple ecran statique d upload.
  const [fundStats, setFundStats] = useState<{
    total: number;
    inInstruction: number;
    lastAnalyzedAt: string | null;
  } | null>(null);
  // Etat d ouverture du volet de commentaires partages multi-membres
  // (distinct du AnnotationBlock notes personnelles existant).
  const [commentsOpen, setCommentsOpen] = useState(false);
  // Versioning des notes : quand l utilisateur consulte une version
  // historique, on swap result par le snapshot et on garde le live
  // dans liveResultBackup pour pouvoir restaurer.
  const [liveResultBackup, setLiveResultBackup] = useState<any | null>(null);
  const [viewedVersionNum, setViewedVersionNum] = useState<number | null>(null);
  // Detection collision : quand le serveur detecte qu un dossier du
  // meme nom de societe existe deja, on stocke le payload en attente
  // de decision utilisateur (nouveau dossier ou nouvelle version).
  const [pendingCollision, setPendingCollision] = useState<{
    existingId: string;
    existingCompanyName: string;
    existingCreatedAt: string;
    nextVersionNum: number;
    pendingResult: any;
    pendingSourceFilename: string | null;
    pendingPipelineDurationMs: number | null;
  } | null>(null);

  // Notification toast simple pour signaler les actions de sauvegarde
  // automatiques (par exemple quand le dialog de collision est dismisse
  // sans choix explicite et qu on sauvegarde par defaut comme nouvelle
  // version pour ne pas perdre l analyse). Auto-disparition apres 5s.
  const [saveNotification, setSaveNotification] = useState<string | null>(null);
  useEffect(() => {
    if (!saveNotification) return;
    const timer = setTimeout(() => setSaveNotification(null), 5000);
    return () => clearTimeout(timer);
  }, [saveNotification]);

  const handleVersionChange = (snapshotJson: any | null, versionNum: number | null) => {
    if (snapshotJson === null) {
      // Retour a la version live
      if (liveResultBackup) {
        setResult(liveResultBackup);
        setLiveResultBackup(null);
      }
      setViewedVersionNum(null);
    } else {
      // Bascule vers une version historique : on backup le live si pas deja fait
      if (!liveResultBackup) setLiveResultBackup(result);
      setResult(snapshotJson);
      setViewedVersionNum(versionNum);
    }
  };

  // Helper interne : appelle POST /api/analyses avec un mode donne
  // et applique la reponse (savedAnalysisId, ou ouverture dialog).
  const submitSave = async (mode: 'detect' | 'new-record' | 'new-version', payload: {
    result: any;
    sourceFilename: string | null;
    pipelineDurationMs: number | null;
    existingId?: string;
  }) => {
    try {
      const res = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          result: payload.result,
          sourceFilename: payload.sourceFilename,
          pipelineDurationMs: payload.pipelineDurationMs,
          existingId: payload.existingId,
        }),
      });
      const saved = await res.json();
      if (saved?.collision) {
        setPendingCollision({
          existingId: saved.collision.existingId,
          existingCompanyName: saved.collision.existingCompanyName,
          existingCreatedAt: saved.collision.existingCreatedAt,
          nextVersionNum: saved.collision.nextVersionNum,
          pendingResult: payload.result,
          pendingSourceFilename: payload.sourceFilename,
          pendingPipelineDurationMs: payload.pipelineDurationMs,
        });
        return;
      }
      if (saved?.saved && saved?.id) {
        setSavedAnalysisId(saved.id);
      }
    } catch {
      // silencieux : la persistence n est pas critique
    }
  };
  // Pipeline timing : pour mesurer la duree d execution et la stocker en metadonnees
  const [pipelineStartTime, setPipelineStartTime] = useState<number | null>(null);
  // Compteur de duree ecoulee, mis a jour toutes les secondes pendant
  // que le pipeline tourne. Permet d afficher un timer total reel
  // dans la vue pipeline plutot que de laisser l utilisateur faire la
  // somme des durees par moteur (qui est trompeuse car les moteurs
  // tournent largement en parallele : 6 a 7 moteurs simultanes par
  // batch, donc somme cumulee largement superieure a la duree reelle).
  const [pipelineElapsedMs, setPipelineElapsedMs] = useState<number>(0);
  // Etat de chargement d une analyse passee depuis ?analysis=ID
  const [loadingPastAnalysis, setLoadingPastAnalysis] = useState(false);

  // Tick toutes les secondes pendant que le pipeline tourne pour
  // mettre a jour pipelineElapsedMs. Cleanup quand analyzing repasse
  // a false ou quand le composant se demonte.
  useEffect(() => {
    if (!analyzing || !pipelineStartTime) {
      setPipelineElapsedMs(0);
      return;
    }
    const interval = setInterval(() => {
      setPipelineElapsedMs(Date.now() - pipelineStartTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [analyzing, pipelineStartTime]);

  // Charge automatiquement une analyse passee si l URL contient ?analysis=ID.
  // Permet d arriver depuis /history -> bouton "Ouvrir" et restaurer la note.
  // Quand on charge depuis l historique, on force tous les engineStates en done
  // pour que le bandeau pipeline n affiche pas un faux 0/12 moteurs : le
  // pipeline a forcement tourne sinon on n aurait pas de resultJson en base.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const analysisId = url.searchParams.get('analysis');
    if (!analysisId) return;

    setLoadingPastAnalysis(true);
    fetch(`/api/analyses/${analysisId}`)
      .then((res) => {
        if (!res.ok) throw new Error('not-found');
        return res.json();
      })
      .then((data) => {
        if (data?.analysis?.resultJson) {
          setResult(data.analysis.resultJson);
          setSavedAnalysisId(analysisId);
          // Restaure les etats de moteurs.
          // Pour le Bloc 1 (instruction) : tous done si resultJson existe.
          // Pour le Bloc 2 (dataroom) : done UNIQUEMENT si l output
          // correspondant est present dans resultJson (sinon idle).
          // Critere par moteur Bloc 2 :
          //   ledger-parsing -> resultJson.ledgerExtraction non null
          //   dd-financial -> resultJson.ddFinancial non null
          //   cap-table-parsing -> resultJson.capTableExtraction non null
          //   dd-contractual -> resultJson.ddContractual non null
          //   dd-technical -> resultJson.ddTechnical non null
          // Sans ce filtre, on affichait 5 coches vertes a 0.0s pour des
          // moteurs qui n avaient jamais tourne.
          const enginesStatus = data.analysis.pipelineEnginesStatus || {};
          const engineDurations = data.analysis.resultJson?.meta?.engineDurations || {};
          const restored: Record<string, EngineState> = {};
          const rj = data.analysis.resultJson || {};
          const bloc2OutputKeys: Record<string, string> = {
            'ledger-parsing': 'ledgerExtraction',
            'dd-financial': 'ddFinancial',
            'cap-table-parsing': 'capTableExtraction',
            'dd-contractual': 'ddContractual',
            'dd-technical': 'ddTechnical',
          };
          ENGINES.forEach((e) => {
            const stored = enginesStatus[e.id];
            const duration = typeof engineDurations[e.id] === 'number'
              ? engineDurations[e.id]
              : undefined;
            // Bloc 2 : verification de la presence reelle de l output
            if (e.block === 'dataroom') {
              const outputKey = bloc2OutputKeys[e.id];
              const hasOutput = outputKey && rj[outputKey] != null;
              if (stored === 'failed' || stored === 'error') {
                restored[e.id] = { status: 'error', durationMs: duration };
              } else if (hasOutput) {
                restored[e.id] = { status: 'done', durationMs: duration };
              } else {
                restored[e.id] = { status: 'idle' };
              }
              return;
            }
            // Bloc 1 : done si pas explicitement failed
            if (stored && (stored === 'failed' || stored === 'error')) {
              restored[e.id] = { status: 'error', durationMs: duration };
            } else {
              restored[e.id] = { status: 'done', durationMs: duration };
            }
          });
          setEngineStates(restored);

          // Auto-ouverture de la zone Data Room si l URL contient action=dd.
          // Permet d arriver depuis /history -> bouton "Lancer DD" et
          // tomber directement sur la zone d upload, sans avoir a scroller
          // pour trouver le bandeau "Passer en DD approfondie". Conditions :
          //   - le query param est present
          //   - le verdict ne justifie pas un refus
          //   - la DD n a pas deja tourne (sinon les sections sont visibles)
          const action = url.searchParams.get('action');
          if (action === 'dd') {
            const verdict = rj?.finalRecommendation?.verdict;
            const hasBloc2 = !!(rj.ledgerExtraction || rj.ddFinancial
              || rj.capTableExtraction || rj.ddContractual || rj.ddTechnical);
            if (verdict && verdict !== 'refuser' && !hasBloc2) {
              setDdDeepenOpen(true);
              setDdDeepenError(null);
            }
          }
        }
      })
      .catch(() => {
        setError('Analyse introuvable ou non accessible.');
      })
      .finally(() => {
        setLoadingPastAnalysis(false);
      });
  }, []);

  // Charge l historique workflow (transitions de stade) des qu un dossier
  // est connu. Re-charge a chaque changement d ID. Best effort : si la
  // route renvoie une erreur on degrade silencieusement, la timeline
  // n apparaitra simplement pas dans le pack IC.
  useEffect(() => {
    if (!savedAnalysisId) {
      setWorkflowHistory([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/analyses/${savedAnalysisId}/status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const history = Array.isArray(data.history) ? data.history : [];
        setWorkflowHistory(history.map((h: any) => ({
          fromStage: h.fromStage ?? h.from_stage ?? null,
          toStage: h.toStage ?? h.to_stage,
          changedAt: h.changedAt ?? h.changed_at,
          comment: h.comment ?? null,
        })));
      })
      .catch(() => {
        if (!cancelled) setWorkflowHistory([]);
      });
    return () => { cancelled = true; };
  }, [savedAnalysisId]);

  // Charge les votes IC du dossier. Best effort. Re-charge a chaque
  // changement de dossier. Les composants enfants peuvent forcer un
  // refresh via reloadIcVotes ci-dessous (apres un POST).
  const reloadIcVotes = useCallback(async () => {
    if (!savedAnalysisId) {
      setIcVotes([]);
      return;
    }
    try {
      const res = await fetch(`/api/analyses/${savedAnalysisId}/ic-votes`);
      if (!res.ok) {
        setIcVotes([]);
        return;
      }
      const data = await res.json();
      const votes = Array.isArray(data.votes) ? data.votes : [];
      setIcVotes(votes.map((v: any) => ({
        userId: v.userId,
        userEmail: v.userEmail,
        voteOption: v.voteOption,
        votedAt: v.votedAt,
      })));
    } catch {
      setIcVotes([]);
    }
  }, [savedAnalysisId]);

  useEffect(() => {
    reloadIcVotes();
  }, [reloadIcVotes]);

  // Callback de vote : envoie le vote du user actuel et recharge la liste
  // pour avoir le compteur a jour. Si le user clique sur l option qu il
  // a deja votee, on retire son vote (toggle).
  const handleVote = useCallback(async (voteOption: string) => {
    if (!savedAnalysisId) return;
    const myCurrentVote = icVotes.find((v) => v.userId === userId)?.voteOption;
    try {
      if (myCurrentVote === voteOption) {
        // Toggle off : on retire le vote
        await fetch(`/api/analyses/${savedAnalysisId}/ic-votes`, { method: 'DELETE' });
      } else {
        await fetch(`/api/analyses/${savedAnalysisId}/ic-votes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voteOption }),
        });
      }
      await reloadIcVotes();
    } catch (err) {
      console.error('handleVote failed:', err);
    }
  }, [savedAnalysisId, icVotes, userId, reloadIcVotes]);

  // Charge la decision IC officielle du dossier (champs page 3 du Pack IC).
  // Best effort, silencieux en cas d echec.
  const reloadIcDecision = useCallback(async () => {
    if (!savedAnalysisId) {
      setIcDecision(null);
      return;
    }
    try {
      const res = await fetch(`/api/analyses/${savedAnalysisId}/ic-decision`);
      if (!res.ok) {
        setIcDecision(null);
        return;
      }
      const data = await res.json();
      setIcDecision(data.decision || null);
    } catch {
      setIcDecision(null);
    }
  }, [savedAnalysisId]);

  useEffect(() => {
    reloadIcDecision();
  }, [reloadIcDecision]);

  // Charge les stats agregees du fonds une fois au mount pour la barre
  // de contexte du hero. On ne recharge pas au fil de la session : pas
  // d incidence sur les performances, et l info reste valable tant que
  // l user n a pas relance une analyse (qui sera reflete via
  // savedAnalysisId mais c est un autre flow).
  useEffect(() => {
    if (!authEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/analyses/list?limit=1');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const analyses = Array.isArray(data?.analyses) ? data.analyses : [];
        const stats = data?.stats || null;
        const lastAnalyzedAt = analyses[0]?.analyzedAt || analyses[0]?.analyzed_at || null;
        const total = stats?.total ?? analyses.length;
        // Heuristique : nombre de dossiers en cours d instruction
        // (workflow_stage != 'verdict' && != 'closed'). On regarde les
        // stats par stage si fournies, sinon on fallback a 0.
        const byStage = stats?.byStage || {};
        const closed = (byStage.closed || 0) + (byStage.archived || 0);
        const inInstruction = Math.max(0, total - closed);
        setFundStats({ total, inInstruction, lastAnalyzedAt });
      } catch {
        // silencieux : la barre ne s affichera juste pas
      }
    })();
    return () => { cancelled = true; };
  }, [authEnabled]);

  // Callback de mise a jour : envoie un patch partiel et recharge.
  // Ne fait rien si pas authentifie (les observateurs et solo se voient
  // refuser cote serveur, mais on prefere ne pas faire la requete pour
  // ne pas afficher d erreur inutile cote UI).
  const handleUpdateDecision = useCallback(async (patch: any) => {
    if (!savedAnalysisId || !authEnabled) return;
    try {
      const res = await fetch(`/api/analyses/${savedAnalysisId}/ic-decision`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = await res.json();
        setIcDecision(data.decision || null);
      }
    } catch (err) {
      console.error('updateIcDecision failed:', err);
    }
  }, [savedAnalysisId, authEnabled]);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFilesSelect(newFiles: FileList | null) {
    if (!newFiles || newFiles.length === 0) return;
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const f of Array.from(newFiles)) {
      const lower = f.name.toLowerCase();
      const isPdf = f.type.includes('pdf') || lower.endsWith('.pdf');
      const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv');
      const isWord = lower.endsWith('.docx');
      if (!isPdf && !isExcel && !isWord) {
        rejected.push(f.name);
        continue;
      }
      if (f.size > 32 * 1024 * 1024) {
        rejected.push(f.name + ' (dépasse 32 Mo)');
        continue;
      }
      accepted.push(f);
    }
    if (rejected.length > 0) {
      setError('Fichiers refusés : ' + rejected.join(', ') + '. Formats acceptés : PDF, XLSX, XLS, CSV, DOCX.');
    } else {
      setError(null);
    }
    setFiles(prev => [...prev, ...accepted]);
    setResult(null);
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setResult(null);
  }


  async function analyze(opts: { forcePrescan?: boolean; skipDuplicateCheck?: boolean; forceNarrativeDrift?: boolean } = {}) {
    if (files.length === 0) return;
    const hasPdf = files.some(f => f.type.includes('pdf') || f.name.toLowerCase().endsWith('.pdf'));
    if (!hasPdf) {
      setError('Au moins un fichier PDF (pitch deck) est requis');
      return;
    }

    // GARDE-FOU CONTRE LES RE-RUNS ACCIDENTELS
    // ----------------------------------------------------------
    // Une analyse Bloc 1 complete coute environ 2,50 USD de credits
    // Anthropic. Tester un meme dossier 5 fois dans la nuit (cas
    // typique en developpement ou QA) brule 12,50 USD pour rien
    // si le code ne change pas significativement. Le garde-fou
    // calcule un hash SHA-256 du PDF principal et le compare aux
    // hashs des analyses lancees dans les 7 derniers jours stockes
    // en localStorage. En cas de match, popup de confirmation qui
    // propose au choix de voir l analyse existante (gratuit) ou
    // de relancer quand meme (paye 2,50 USD).
    if (!opts.skipDuplicateCheck && typeof window !== 'undefined') {
      try {
        const pitchPdf = files.find(f => f.type.includes('pdf') || f.name.toLowerCase().endsWith('.pdf'));
        if (pitchPdf) {
          const buffer = await pitchPdf.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
          const hashHex = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          const recentRunsRaw = localStorage.getItem('prelude_recent_runs') || '[]';
          const recentRuns: Array<{ hash: string; analysisId: string | null; companyName: string; ts: number }> = JSON.parse(recentRunsRaw);
          const now = Date.now();
          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
          const fresh = recentRuns.filter(r => now - r.ts < sevenDaysMs);
          const match = fresh.find(r => r.hash === hashHex);
          if (match) {
            const ageHours = Math.floor((now - match.ts) / (60 * 60 * 1000));
            const ageStr = ageHours < 1 ? 'moins d une heure' : ageHours < 24 ? `${ageHours} heures` : `${Math.floor(ageHours / 24)} jours`;
            const userChoice = window.confirm(
              `Ce dossier a deja ete analyse il y a ${ageStr} (${match.companyName || 'sans nom'}).\n\nLe pipeline complet coute environ 2,50 USD de credits Anthropic. Tu peux :\n\n- OK : voir l analyse existante (gratuit, instantane)\n- Annuler : relancer le pipeline complet (paye 2,50 USD)`
            );
            if (userChoice && match.analysisId) {
              // L utilisateur veut voir l analyse existante : on redirige
              window.location.href = `/?analysis=${match.analysisId}`;
              return;
            }
            if (userChoice && !match.analysisId) {
              // Hash connu mais pas d id d analyse persistee (cas degenere) :
              // on continue le pipeline normalement.
            }
            // Si l utilisateur a cliqué Annuler, il veut relancer : on continue.
          }
          // Memoire du hash pour la prochaine fois : on stocke avant
          // meme la fin du pipeline pour couvrir les cas d echec en
          // cours (re-tentative immediate sera detectee comme doublon).
          // L analysisId sera mis a jour quand le pipeline finira.
          fresh.unshift({ hash: hashHex, analysisId: null, companyName: pitchPdf.name.replace(/\.pdf$/i, ''), ts: now });
          localStorage.setItem('prelude_recent_runs', JSON.stringify(fresh.slice(0, 50)));
        }
      } catch (hashErr) {
        // Ignore : crypto.subtle ou JSON.parse a echoue, on continue
        // sans le garde-fou. Pas critique.
        console.warn('[analyze] hash verification skipped:', hashErr);
      }
    }

    setAnalyzing(true);
    setError(null);
    setResult(null);
    setPrescanKnockout(null);
    setSavedAnalysisId(null);
    setPipelineStartTime(Date.now());
    setEngineStates(Object.fromEntries(ENGINES.map(e => [e.id, { status: 'idle' }])));

    // Demande silencieuse de la permission de notification au navigateur.
    // Si l utilisateur a deja accepte, no-op. Si il a refuse, on ne re-demande
    // pas. Si premier lancement, le navigateur affiche le dialog. Pas
    // bloquant : on continue le pipeline meme si la permission n est
    // pas accordee, juste sans notification systeme a la fin.
    requestNotificationPermissionSilent();

    // Marqueur visuel sur l onglet pour que le partner reperere l onglet
    // Prelude dans sa barre d onglets si il bascule sur un autre tab.
    setTabTitleAttention('running');

    // Wake Lock : empeche l'ecran de dormir pendant le pipeline.
    // Non bloquant : si le navigateur ne supporte pas ou refuse, on continue.
    let wakeLock: any = null;
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        wakeLock = await (navigator as any).wakeLock.request('screen');
      }
    } catch (_e) {
      // Wake Lock non disponible : on continue sans
    }

    try {
      const formData = new FormData();
      for (const f of files) {
        formData.append('files', f);
      }
      // Si l user force apres un knockout pre-scan, on l indique au
      // serveur pour qu il bypasse le gating.
      if (opts.forcePrescan) {
        formData.append('forcePrescan', 'true');
      }
      // Mode dev : force l execution du moteur narrative-drift meme si
      // la matrice de pertinence le declare non applicable. Sert au
      // QA sur dossiers seed avec corpus court pour valider la
      // robustesse du moteur en bord de plage.
      if (opts.forceNarrativeDrift || forceNarrativeDrift) {
        formData.append('forceNarrativeDrift', '1');
      }

      const response = await fetch('/api/analyze', { method: 'POST', body: formData });

      // Cas 429 : rate limit atteint au niveau de l organisation. Le
      // serveur retourne un JSON structure avec currentCount et
      // maxAllowed pour qu on affiche un message clair au partner.
      if (response.status === 429) {
        const body = await response.json().catch(() => ({}));
        const msg = body?.error || 'Limite de pipelines simultanes atteinte. Patientez avant de relancer.';
        throw new Error(msg);
      }

      if (!response.ok || !response.body) {
        const errBody = await response.text();
        throw new Error(errBody || 'Erreur reseau');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let receivedTerminal = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          if (!event.trim()) continue;
          const evtLines = event.split('\n');
          let eventType = '';
          let dataStr = '';
          for (const line of evtLines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            else if (line.startsWith('data: ')) dataStr = line.slice(6);
          }
          if (!eventType || !dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            if (eventType === 'engine-start') {
              setEngineStates(prev => ({
                ...prev,
                [data.engine]: { status: 'running', startedAt: Date.now() }
              }));
            } else if (eventType === 'engine-done') {
              setEngineStates(prev => ({
                ...prev,
                [data.engine]: {
                  ...prev[data.engine],
                  status: 'done',
                  completedAt: Date.now(),
                  // Si le serveur a envoye la duree, on la garde
                  // explicitement pour eviter les decalages dus a la
                  // latence reseau (Date.now du client != now serveur).
                  durationMs: typeof data.durationMs === 'number'
                    ? data.durationMs
                    : prev[data.engine]?.durationMs,
                }
              }));
            } else if (eventType === 'complete') {
              setResult(data);
              receivedTerminal = true;

              // Notification systeme et titre d onglet "termine" pour
              // alerter le partner qui a quitte l onglet pendant les
              // 10 minutes du pipeline. La notif systeme ne se
              // declenche que si l onglet est en background.
              try {
                const co = data?.extraction?.companyName || 'Dossier';
                const verdict = data?.recommendation?.verdict || null;
                notifyPipelineComplete({ companyName: co, verdict });
                setTabTitleAttention('done', co);
              } catch {
                // Silencieux : pas de notif n est pas un blocant
              }

              // Persistance : depuis la refonte, le serveur persiste
              // l analyse cote serveur juste avant d emettre ce
              // complete event. Si la persistence cote serveur a
              // reussi, data._persisted contient l id deja persiste
              // et on l adopte directement sans rappeler /api/analyses.
              // Cela rend la persistence robuste a la deconnexion
              // SSE : meme si le client coupe avant ce point, l
              // analyse est en base et apparait dans Historique.
              //
              // Fallback : si _persisted est absent ou saved=false
              // (env de dev sans persistence, ou erreur cote serveur),
              // on retombe sur l ancien comportement client-side qui
              // appelle /api/analyses pour persister.
              if (data?._persisted?.saved && data._persisted.id) {
                setSavedAnalysisId(data._persisted.id);
                // Mise a jour du garde-fou de re-run : on associe l id
                // d analyse persistee au hash stocke en localStorage juste
                // avant le pipeline. Ainsi, si l utilisateur relance le
                // meme dossier, on pourra le rediriger vers l analyse
                // existante au lieu de tout recalculer.
                try {
                  const recentRunsRaw = localStorage.getItem('prelude_recent_runs') || '[]';
                  const recentRuns: Array<{ hash: string; analysisId: string | null; companyName: string; ts: number }> = JSON.parse(recentRunsRaw);
                  if (recentRuns.length > 0 && !recentRuns[0].analysisId) {
                    // L entree la plus recente sans analysisId est celle qu on vient de creer
                    recentRuns[0].analysisId = data._persisted.id;
                    if (data?.extraction?.companyName) {
                      recentRuns[0].companyName = data.extraction.companyName;
                    }
                    localStorage.setItem('prelude_recent_runs', JSON.stringify(recentRuns));
                  }
                } catch (storageErr) {
                  // Ignore : pas critique
                }
              } else {
                const sourceFilename = files[0]?.name || null;
                const pipelineDurationMs = pipelineStartTime ? Date.now() - pipelineStartTime : null;
                submitSave('detect', {
                  result: data,
                  sourceFilename,
                  pipelineDurationMs,
                });
              }
            } else if (eventType === 'prescan-knockout') {
              // Gating doux du pre-scan : le verdict Bloc 0 est knockout
              // et le pipeline complet n a pas tourne pour economiser les
              // credits LLM. On stocke le verdict pre-scan pour affichage,
              // on flag prescanKnockout pour que l UI propose le bouton
              // 'Lancer l analyse complete malgre tout' qui repostera la
              // meme analyse avec forcePrescan=true.
              setPrescanKnockout({
                summary: data.summary,
                failedTests: data.failedTests || [],
                score: data.score,
                totalTests: data.totalTests,
              });
              receivedTerminal = true;

              // Notification : meme apres knockout, le partner doit savoir
              // que le triage est termine et qu il y a une decision a
              // prendre (lire la synthese du knockout, decider de forcer
              // ou pas).
              try {
                const co = files[0]?.name?.replace(/\.[^.]+$/, '') || 'Dossier';
                notifyPipelineComplete({ companyName: co, isPrescanKnockout: true });
                setTabTitleAttention('knockout', co);
              } catch {
                // Silencieux
              }
            } else if (eventType === 'error') {
              setError(data.message);
              receivedTerminal = true;
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }

      // Stream termine sans event complete ni error : probable timeout serveur
      if (!receivedTerminal) {
        throw new Error('Le pipeline s\'est interrompu avant la fin (probable timeout serveur). Recharge la page et réessaie. Si le problème persiste, le pipeline prend trop de temps et il faut réduire la charge.');
      }
    } catch (e: any) {
      // Enrichissement du message d erreur : on ajoute le contexte du
      // dernier moteur en running au moment de l erreur, ce qui permet
      // au partner de comprendre OU le pipeline a plante (orchestrate ?
      // contrarian ? execution-friction ?). Une simple "network error"
      // n est pas exploitable, alors qu un "le moteur orchestrate a
      // plante apres 87s" oriente le diagnostic.
      const states = engineStates;
      const runningEngine = ENGINES.find(e => states[e.id]?.status === 'running');
      const lastDoneEngine = [...ENGINES].reverse().find(e => states[e.id]?.status === 'done');
      let contextSuffix = '';
      if (runningEngine) {
        contextSuffix = `\n\nDernier moteur actif : ${runningEngine.label} (${runningEngine.id}). Il etait en cours d execution au moment de la coupure.`;
      } else if (lastDoneEngine) {
        contextSuffix = `\n\nDernier moteur termine avec succes : ${lastDoneEngine.label} (${lastDoneEngine.id}).`;
      }
      const baseMsg = e.message || 'Erreur reseau';
      const enrichedMsg = baseMsg.includes('network')
        || baseMsg.includes('Network')
        || baseMsg.toLowerCase().includes('failed to fetch')
        ? `Connexion interrompue avec le serveur Prelude. Cause typique sur mobile : ecran qui s eteint ou app en arriere-plan, le navigateur coupe le flux SSE. Le serveur peut avoir continue a tourner et persister l analyse meme apres la coupure cote client.\n\nA verifier en premier : ouvrir l onglet Historique pour voir si le dossier est apparu (le moteur orchestrate est l avant-dernier de la chaine, donc l analyse a souvent ete sauvee). Si le dossier est present, ne pas relancer. Si absent au bout de 2 minutes, recharger la page et relancer le pipeline a zero.${contextSuffix}`
        : baseMsg + contextSuffix;
      setError(enrichedMsg);
    } finally {
      setAnalyzing(false);
      // Release Wake Lock
      if (wakeLock) {
        try { await wakeLock.release(); } catch (_e) {}
      }
    }
  }


  function reset() {
    setFiles([]);
    setResult(null);
    setError(null);
    setPrescanKnockout(null);
    setEngineStates(Object.fromEntries(ENGINES.map(e => [e.id, { status: 'idle' }])));
    setActiveTab('synthesis');
    if (inputRef.current) inputRef.current.value = '';
  }

  // ============================================================
  // DD APPROFONDIE (Bloc 2) - mecanique de re-run incrementale
  // ------------------------------------------------------------
  // Le partner declenche cette phase apres avoir lu la note Bloc 1
  // et decide que le dossier merite l ouverture de la data room.
  // Ne tourne que si une analyse est sauvegardee (savedAnalysisId)
  // et que le verdict autorise la DD (controle cote serveur dans
  // la route /api/analyses/[id]/dd-deepen).
  //
  // Workflow :
  //   1. Bandeau dans la note clique : ddDeepenOpen passe a true
  //   2. Zone d upload Bloc 2 visible au-dessus de la note
  //   3. Partner depose les documents data room
  //   4. Click sur "Lancer la DD approfondie" : analyzeDDDeepen()
  //   5. Streaming SSE des moteurs Bloc 2, bandeau pipeline visible
  //   6. Au callback complete : result mis a jour, sections Data
  //      Room apparaissent dans la note, zone d upload se ferme
  // ============================================================

  function handleDdDeepenFilesSelect(filelist: FileList | null) {
    if (!filelist || filelist.length === 0) return;
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (let i = 0; i < filelist.length; i += 1) {
      const f = filelist[i];
      const lower = f.name.toLowerCase();
      const ok = lower.endsWith('.pdf') || lower.endsWith('.xlsx') ||
        lower.endsWith('.xls') || lower.endsWith('.csv') || lower.endsWith('.docx');
      if (!ok) {
        rejected.push(f.name);
      } else {
        accepted.push(f);
      }
    }
    if (rejected.length > 0) {
      setDdDeepenError('Fichiers refuses : ' + rejected.join(', ') + '. Formats acceptés : PDF, XLSX, XLS, CSV, DOCX.');
    } else {
      setDdDeepenError(null);
    }
    setDdDeepenFiles(prev => [...prev, ...accepted]);
  }

  function removeDdDeepenFile(index: number) {
    setDdDeepenFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function analyzeDDDeepen() {
    if (!savedAnalysisId) {
      setDdDeepenError('Analyse non sauvegardee. Impossible de lancer la DD approfondie.');
      return;
    }
    if (ddDeepenFiles.length === 0) {
      setDdDeepenError('Au moins un document data room requis (grand livre, pacte, statuts, cap table, contrats clients ou dossier technique).');
      return;
    }

    setDdDeepenAnalyzing(true);
    setDdDeepenError(null);

    // Reset les etats des moteurs Bloc 2 a idle, pour que le bandeau
    // pipeline les affiche en cours d execution. Les moteurs Bloc 1
    // restent a done pour montrer qu ils sont conserves.
    const bloc2EngineIds = ['ledger-parsing', 'dd-financial', 'cap-table-parsing', 'dd-contractual', 'dd-technical'];
    setEngineStates(prev => {
      const next = { ...prev };
      for (const id of bloc2EngineIds) {
        next[id] = { status: 'idle' };
      }
      return next;
    });
    setPipelineStartTime(Date.now());

    let wakeLock: any = null;
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        wakeLock = await (navigator as any).wakeLock.request('screen');
      }
    } catch (_e) {}

    try {
      const formData = new FormData();
      for (const f of ddDeepenFiles) {
        formData.append('files', f);
      }

      const response = await fetch(`/api/analyses/${savedAnalysisId}/dd-deepen`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok || !response.body) {
        const errBody = await response.text();
        let msg = errBody || 'Erreur reseau';
        try {
          const parsed = JSON.parse(errBody);
          msg = parsed.error || msg;
        } catch {}
        throw new Error(msg);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let receivedTerminal = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          if (!event.trim()) continue;
          const evtLines = event.split('\n');
          let eventType = '';
          let dataStr = '';
          for (const line of evtLines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            else if (line.startsWith('data: ')) dataStr = line.slice(6);
          }
          if (!eventType || !dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            if (eventType === 'engine-start') {
              setEngineStates(prev => ({
                ...prev,
                [data.engine]: { status: 'running', startedAt: Date.now() }
              }));
            } else if (eventType === 'engine-done') {
              setEngineStates(prev => ({
                ...prev,
                [data.engine]: {
                  ...prev[data.engine],
                  status: 'done',
                  completedAt: Date.now(),
                  durationMs: typeof data.durationMs === 'number'
                    ? data.durationMs
                    : prev[data.engine]?.durationMs,
                }
              }));
            } else if (eventType === 'complete') {
              setResult(data.result);
              setDdDeepenOpen(false);
              setDdDeepenFiles([]);
              receivedTerminal = true;
            } else if (eventType === 'error') {
              setDdDeepenError(data.error || 'Erreur pipeline DD approfondie');
              receivedTerminal = true;
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }

      if (!receivedTerminal) {
        throw new Error('Le pipeline DD approfondie s est interrompu avant la fin (probable timeout serveur). Recharger la page et reessayer.');
      }
    } catch (e: any) {
      setDdDeepenError(e.message || 'Erreur reseau');
    } finally {
      setDdDeepenAnalyzing(false);
      if (wakeLock) {
        try { await wakeLock.release(); } catch (_e) {}
      }
    }
  }

  function getBarClass(score: number) {
    if (score < 35) return 'warn';
    if (score >= 70) return 'good';
    return '';
  }

  function formatDuration(ms: number) {
    return (ms / 1000).toFixed(1) + 's';
  }

  // Distinguer les moteurs qui ont court-circuite (sortie en quelques
  // millisecondes via leur logique interne de pertinence : pas de moat
  // tech revendique, pas de friction d execution detectee, pas de
  // donnees financieres exploitables) des moteurs qui ont reellement
  // tourne. Un appel LLM prend toujours au moins 1-2 secondes ; sous
  // 200ms c est forcement un court-circuit deterministe ou un cache
  // hit. On affiche alors "non applicable" qui est la verite : le
  // moteur a juge que le dossier ne necessitait pas son analyse, et
  // il est sorti sans bruler de tokens. C est une feature, pas un bug.
  function formatEngineDuration(ms: number | null): string {
    if (ms === null) return '';
    if (ms < 200) return 'non applicable';
    return formatDuration(ms);
  }

  return (
    <>
      <header className="header">
        <div>
          <div className="brand">Prélude</div>
          <div className="brand-meta">Plateforme d'instruction VC · Analyse rigoureuse en pipeline</div>
        </div>
        {authEnabled && orgName ? (
          <div className="header-identity">
            <div className="header-org">{orgName}</div>
            {userEmail && <div className="header-user">{userEmail}</div>}
            <div className="header-actions">
              <a className="header-action" href="/portfolio">Portefeuille</a>
              <a className="header-action" href="/history">Historique</a>
              <a className="header-action" href="/settings">Réglages</a>
              <button
                className="header-action"
                onClick={async () => {
                  await fetch('/api/auth/logout', { method: 'POST' });
                  window.location.href = '/login';
                }}
                aria-label="Se déconnecter"
              >
                Déconnexion
              </button>
              <ThemeToggle />
            </div>
          </div>
        ) : (
          <div className="header-identity">
            <div className="header-actions">
              <a className="header-action" href="/history">Historique</a>
              <ThemeToggle />
            </div>
          </div>
        )}
      </header>

      <main className="main">
        {/* Bandeau de progression du pipeline en sticky en haut.
            S'affiche pendant le run (analyzing=true) ET reste visible
            une fois le pipeline termine pour permettre de cliquer sur
            un moteur et scroller vers la section correspondante du
            dashboard. Inspire du flow Meegle. */}
        {(analyzing || result) && (() => {
          // Filtrage des moteurs affiches : on cache les moteurs Bloc 2
          // (Data Room) tant que le run /dd-deepen n a pas ete declenche.
          // Critere : si AUCUN moteur Bloc 2 n est en running ou done, on
          // les retire de la liste affichee. Des qu un moteur Bloc 2 passe
          // a running ou done, toute la liste Bloc 2 reapparait.
          // Evite l effet "5 moteurs Data Room valides a 0.0s" quand ils
          // n ont pas tourne.
          const hasBloc2Activity = ENGINES
            .filter(e => e.block === 'dataroom')
            .some(e => {
              const s = engineStates[e.id]?.status;
              return s === 'running' || s === 'done' || s === 'error';
            });
          const visibleEngines = hasBloc2Activity
            ? ENGINES
            : ENGINES.filter(e => e.block !== 'dataroom');
          return (
            <PipelineProgress
              engines={visibleEngines}
              states={engineStates}
              analyzing={analyzing}
              elapsedMs={pipelineStartTime ? Date.now() - pipelineStartTime : undefined}
              onEngineClick={(engineId) => {
                // Scroll vers l'ancre du moteur si elle existe dans le dashboard
                const target = document.getElementById(`engine-section-${engineId}`);
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            />
          );
        })()}

        {!result && !analyzing && (
          <>
            {/* HERO - refonte sobre :
                - Un seul titre fort, ton editorial Le Grand Continent
                - Sous-titre dense en une seule phrase
                - UN SEUL CTA vers la zone de depot
                - Preview animee du pipeline juste en dessous (wow effect
                  sans charger la home)
                Pas de logos clients (Prelude est en early stage), pas
                d emojis, pas de tone fun corporate americain. */}
            <section className="landing-hero">
              <div className="hero-grid">
                <div className="hero-text">
                  <div className="hero-rule" aria-hidden="true"></div>
                  <div className="page-kicker">
                    <span className="page-kicker-bullet" aria-hidden="true"></span>
                    <span>Prélude · Depuis 2026</span>
                  </div>
                  <h1 className="page-title">
                    <span className="page-title-line">Instruire un dossier</span>
                    <span className="page-title-line page-title-emph">comme on instruit une affaire.</span>
                  </h1>
                  <p className="page-subtitle">
                    Du screening initial à la due diligence approfondie, deux registres d&apos;instruction dans un seul outil.
                    Lecture rapide pour qualifier un dossier en cinq minutes, ou Data Room complète quand le dossier passe en DD comité.
                  </p>

                  <div className="hero-modes">
                    <a href="#commencer" className="hero-mode hero-mode-screening" aria-label="Lancer une note d&apos;instruction">
                      <div className="hero-mode-tag">Bloc 1</div>
                      <div className="hero-mode-title">Note d&apos;instruction</div>
                      <div className="hero-mode-sub">Screening &middot; 5 min</div>
                      <div className="hero-mode-stats">
                        <div className="hero-mode-stat-line">Pitch + BP</div>
                        <div className="hero-mode-stat-line muted">Verdict, drivers, vigilance critique, friction d&apos;exécution</div>
                      </div>
                      <div className="hero-mode-cta">Lancer <Picto name="arrow-right" size={11} /></div>
                    </a>
                    <a href="#commencer" className="hero-mode hero-mode-dataroom" aria-label="Lancer une data room">
                      <div className="hero-mode-tag">Bloc 2</div>
                      <div className="hero-mode-title">Data Room</div>
                      <div className="hero-mode-sub">DD approfondie &middot; 15 min</div>
                      <div className="hero-mode-stats">
                        <div className="hero-mode-stat-line">+ grand livre, pacte, statuts, contrats, cap table</div>
                        <div className="hero-mode-stat-line muted">Réconciliation BP vs réel, cartographie des clauses</div>
                      </div>
                      <div className="hero-mode-cta">Lancer <Picto name="arrow-right" size={11} /></div>
                    </a>
                  </div>

                  <div className="hero-cta-row" style={{ justifyContent: 'flex-start' }}>
                    <a href="#commencer" className="btn btn-primary">
                      Lancer une instruction
                      <Picto name="arrow-right" size={14} />
                    </a>
                  </div>
                </div>

                <div className="hero-side">
                  {/* Carte de stats fonds visible uniquement quand l user
                      est connecte avec au moins un dossier instruit.
                      Sinon : carte d apercu pipeline. */}
                  {authEnabled && fundStats && fundStats.total > 0 ? (
                    <div className="hero-card">
                      <div className="hero-card-head">
                        <div className="hero-card-eyebrow">Activité du fonds</div>
                        <div className="hero-card-org">{orgName || 'Votre organisation'}</div>
                      </div>
                      <div className="hero-card-stats">
                        <div className="hero-card-stat">
                          <div className="hero-card-num hero-card-num-blue">{fundStats.total}</div>
                          <div className="hero-card-label">Dossier{fundStats.total > 1 ? 's' : ''} instruit{fundStats.total > 1 ? 's' : ''}</div>
                        </div>
                        <div className="hero-card-stat">
                          <div className="hero-card-num hero-card-num-amber">{fundStats.inInstruction}</div>
                          <div className="hero-card-label">En cours d&apos;instruction</div>
                        </div>
                      </div>
                      {fundStats.lastAnalyzedAt && (
                        <div className="hero-card-meta">
                          <Picto name="circle-half" size={14} />
                          <span>Dernière analyse <strong>{formatRelativeDate(fundStats.lastAnalyzedAt)}</strong></span>
                        </div>
                      )}
                      <a href="/portfolio" className="hero-card-link">
                        <span>Voir le portefeuille</span>
                        <Picto name="arrow-right" size={14} />
                      </a>
                    </div>
                  ) : (
                    <PipelinePreview />
                  )}
                </div>
              </div>

              {/* Preview animée du pipeline pour les visiteurs deja connectes
                  qui ont des dossiers : on l affiche sous la grille pour ne
                  pas perdre cet element. */}
              {authEnabled && fundStats && fundStats.total > 0 && (
                <div style={{ marginTop: 56 }}>
                  <PipelinePreview />
                </div>
              )}
            </section>

            {/* NAVIGATION PAR ONGLETS
                Remplace l empilement vertical de cinq sections (I a V) qui
                obligeait a scroller longuement. Quatre onglets compacts qui
                organisent la lecture par registre :
                - vision      : pourquoi Prelude existe et a qui il s adresse
                - method      : les quatre temps d instruction et 18 moteurs
                - deliverables: structure de la note et de la data room
                - sources     : calibration externe et standards juridiques
                Le hero reste toujours visible au-dessus. La zone de depot
                #commencer reste accessible plus bas pour le CTA final. */}
            <nav className="landing-tabs" role="tablist" aria-label="Sections de la presentation">
              <button
                type="button"
                role="tab"
                aria-selected={landingTab === 'vision'}
                className={`landing-tab ${landingTab === 'vision' ? 'is-active' : ''}`}
                onClick={() => setLandingTab('vision')}
              >
                <span className="landing-tab-num">I</span>
                <span className="landing-tab-label">Vision</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={landingTab === 'method'}
                className={`landing-tab ${landingTab === 'method' ? 'is-active' : ''}`}
                onClick={() => setLandingTab('method')}
              >
                <span className="landing-tab-num">II</span>
                <span className="landing-tab-label">Méthode</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={landingTab === 'deliverables'}
                className={`landing-tab ${landingTab === 'deliverables' ? 'is-active' : ''}`}
                onClick={() => setLandingTab('deliverables')}
              >
                <span className="landing-tab-num">III</span>
                <span className="landing-tab-label">Livrables</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={landingTab === 'sources'}
                className={`landing-tab ${landingTab === 'sources' ? 'is-active' : ''}`}
                onClick={() => setLandingTab('sources')}
              >
                <span className="landing-tab-num">IV</span>
                <span className="landing-tab-label">Calibration</span>
              </button>
            </nav>

            {/* CONTENU DES ONGLETS
                Chaque onglet rend une ou plusieurs sections existantes selon
                landingTab. La section III (Pour qui) rejoint la section I
                (Pourquoi) dans l onglet Vision pour rester coherent : c est
                la lecture du probleme et du destinataire. */}
            {landingTab === 'vision' && (
              <>
            {/* SECTION 2 - Le problème */}
            <section className="landing-section">
              <div className="landing-h2-block">
                <div className="landing-h2-num">I.</div>
                <h2 className="landing-h2">Pourquoi Prélude existe.</h2>
              </div>
              <div className="landing-prose">
                <p className="landing-prose-lead">
                  Le métier du capital-risque souffre d&apos;angles morts structurels. Les fonds font face à un déficit chronique de capital patient, à des biais de pedigree hérités, et à des cadres macroéconomiques distincts qui appellent une instruction propre.
                </p>
                <p>
                  Les outils d&apos;analyse existants ont été conçus pour le marché américain. Ils transposent mécaniquement des grilles SaaS, des seuils de croissance et des comparables qui ne s&apos;appliquent ni à un industriel deeptech français, ni à un éditeur SaaS allemand, ni à un acteur défense scandinave, ni d&apos;ailleurs à un fonds family-office moyen-oriental.
                </p>
                <p>
                  Prélude est conçu autour d&apos;une méthode d&apos;instruction qui distingue le diagnostic chiffré, la lecture critique, la lecture dialectique et la décision. Une logique applicable à tout dossier, calibrée sur les sources et patterns européens consolidés (Atomico, EU-INC, pipeline réglementaire EU 2026) sans s&apos;y limiter.
                </p>
                <p>
                  Prélude est lui-même un produit pensé à l&apos;ère de l&apos;intelligence artificielle générative. Sa défensibilité ne repose pas sur le code, qui est reproductible. Elle repose sur trois choses : la qualité éditoriale du raisonnement, le corpus historique et les annotations des dossiers passés que chaque fonds accumule au fil de son usage, et l&apos;intégration au workflow d&apos;un partner habitué à l&apos;ouvrir le matin. Le seul de ces trois leviers qui se construit avec le temps est le deuxième. C&apos;est pour cela que la mémoire institutionnelle, et la réconciliation entre prédiction et réalité, ne sont pas des fonctionnalités annexes. Elles sont la matière même que Prélude rend opérable.
                </p>
                <p>
                  De la première lecture à la signature, Prélude couvre désormais deux temps distincts de l&apos;instruction. Le Bloc 1 produit la note d&apos;instruction qui qualifie un dossier en cinq minutes pour un analyste ou un principal. Le Bloc 2 ouvre la data room et produit l&apos;audit approfondi qui prépare le comité d&apos;investissement, à la lecture du partner senior et de l&apos;avocat M&amp;A. Deux registres complémentaires dans un seul outil.
                </p>
              </div>
            </section>
              </>
            )}

            {landingTab === 'method' && (
              <>
            {/* SECTION 3 - Méthode : 12 moteurs en accordéon par catégorie.
                Au repos : 4 cartes compactes (une par catégorie semantique).
                Au clic : la catégorie se déplie et révèle ses moteurs en
                lignes denses avec picto coloré différencié par groupe.
                Beaucoup plus aére qu une grille de 12 carres. */}
            <section className="landing-section" id="methode">
              <div className="landing-h2-block">
                <div className="landing-h2-num">II.</div>
                <h2 className="landing-h2">Une méthode, deux registres.</h2>
              </div>
              <p className="landing-section-intro">
                Dix-huit moteurs articulés en deux blocs distincts. Le Bloc 1 instruit un dossier au moment du screening : quatorze moteurs en quatre temps. Le Bloc 2 ouvre la data room en due diligence approfondie : quatre moteurs supplémentaires qui confrontent le pitch projeté à la réalité opérationnelle.
              </p>

              <div className="method-block-header method-block-header-instruction">
                <span className="method-block-tag">Bloc 1</span>
                <span className="method-block-title">Note d&apos;instruction &middot; 14 moteurs</span>
                <span className="method-block-sub">Pitch deck + BP optionnel &middot; 5 minutes</span>
              </div>

              <div className="method-accordion">
                {[
                  {
                    id: 'diagnostic',
                    label: 'Diagnostic chiffré',
                    sub: 'La matière brute du dossier',
                    color: 'blue',
                    engines: [
                      { id: 'extraction',           num: '01', name: 'Lecture du dossier',     desc: 'Pitch deck, fondateurs, modèle, projections.' },
                      { id: 'team',                 num: '02', name: 'Équipe',                 desc: 'Couverture systémique, anti-fragilité, transposition.' },
                      { id: 'market',               num: '03', name: 'Marché',                 desc: 'Intensité du besoin, défensibilité, comparables.' },
                      { id: 'macro',                num: '04', name: 'Macro',                  desc: 'Cycle, géopolitique, fenêtre, capital VC sur segment.' },
                      { id: 'financial-extraction', num: '05', name: 'Extraction financière',  desc: 'Projections, hypothèses, modèle décomposé.' },
                    ],
                  },
                  {
                    id: 'critique',
                    label: 'Lecture critique',
                    sub: 'Confrontation aux corpus de cas',
                    color: 'violet',
                    engines: [
                      { id: 'pattern',              num: '06', name: 'Pattern matching',       desc: 'Confrontation aux trajectoires comparables historiques.' },
                      { id: 'financial-coherence',  num: '07', name: 'Cohérence financière',   desc: 'Sept tests de cohérence des projections et unit economics.' },
                      { id: 'tech-claim',           num: '08', name: 'Cohérence revendication tech', desc: 'Audit du moat technologique : budget, traçabilité, contre-factuel.' },
                    ],
                  },
                  {
                    id: 'dialectique',
                    label: 'Lecture dialectique',
                    sub: 'Vigilance vs singularité',
                    color: 'amber',
                    engines: [
                      { id: 'causal',               num: '09', name: 'Retournement causal',    desc: 'Sept angles morts et questions critiques à instruire.' },
                      { id: 'blindspot',            num: '10', name: 'Vigilance critique',  desc: 'Patterns d\u2019erreur systémiques (Theranos, WeWork, Ynsect).' },
                      { id: 'contrarian',           num: '11', name: 'Singularités contrariennes', desc: 'Signaux qui justifient le pari à contre-courant (Wiz, Stripe).' },
                      { id: 'execution-friction',   num: '12', name: 'Friction d\u2019exécution', desc: 'Huit axes : go-to-market, financement transactionnel, industrialisation, supply chain, écosystème, régulation, référencement, talent rare.' },
                    ],
                  },
                  {
                    id: 'decision',
                    label: 'Décision',
                    sub: 'Synthèse et plan d\u2019action',
                    color: 'green',
                    engines: [
                      { id: 'orchestrate',          num: '13', name: 'Orchestration',          desc: 'Synthèse, probabilités, résolution dialectique.' },
                      { id: 'reference-checks',     num: '14', name: 'Reference checks',       desc: 'Plan d\u2019appels DD terrain et signaux faibles.' },
                    ],
                  },
                ].map((cat, idx) => (
                  <details key={cat.id} className={`method-cat method-cat-${cat.color}`} open={idx === 0}>
                    <summary className="method-cat-head">
                      <div className="method-cat-meta">
                        <div className="method-cat-num">{String(idx + 1).padStart(2, '0')}</div>
                        <div>
                          <div className="method-cat-label">{cat.label}</div>
                          <div className="method-cat-sub">{cat.sub}</div>
                        </div>
                      </div>
                      <div className="method-cat-count">
                        <span className="method-cat-count-num">{cat.engines.length}</span>
                        <span className="method-cat-count-label">moteur{cat.engines.length > 1 ? 's' : ''}</span>
                        <span className="method-cat-chevron" aria-hidden="true">
                          <Picto name="chevron-right" size={14} />
                        </span>
                      </div>
                    </summary>
                    <div className="method-cat-body">
                      {cat.engines.map((e) => {
                        const EnginePicto = ENGINE_PICTOS[e.id as keyof typeof ENGINE_PICTOS];
                        return (
                          <div className="method-engine" key={e.id}>
                            <div className="method-engine-picto" aria-hidden="true">
                              {EnginePicto && <EnginePicto />}
                            </div>
                            <div className="method-engine-num">{e.num}</div>
                            <div className="method-engine-text">
                              <div className="method-engine-name">{e.name}</div>
                              <div className="method-engine-desc">{e.desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>

              <div className="method-block-header method-block-header-dataroom">
                <span className="method-block-tag">Bloc 2</span>
                <span className="method-block-title">Data Room &middot; 4 moteurs</span>
                <span className="method-block-sub">+ grand livre, pacte, statuts, contrats clients, cap table &middot; 15 minutes</span>
              </div>

              <div className="method-accordion">
                <details className="method-cat method-cat-bronze" open>
                  <summary className="method-cat-head">
                    <div className="method-cat-meta">
                      <div className="method-cat-num">05</div>
                      <div>
                        <div className="method-cat-label">Due diligence approfondie</div>
                        <div className="method-cat-sub">Confrontation BP versus réalité opérationnelle</div>
                      </div>
                    </div>
                    <div className="method-cat-count">
                      <span className="method-cat-count-num">4</span>
                      <span className="method-cat-count-label">moteurs</span>
                      <span className="method-cat-chevron" aria-hidden="true">
                        <Picto name="chevron-right" size={14} />
                      </span>
                    </div>
                  </summary>
                  <div className="method-cat-body">
                    {[
                      { id: 'dd-financial',  num: '15', name: 'DD financière',     desc: 'Sept tests de réconciliation BP versus grand livre comptable : CA, marge, burn, headcount, concentration client, trajectoire, engagements hors bilan.' },
                      { id: 'dd-contractual', num: '16', name: 'DD contractuelle', desc: 'Cartographie de quinze clauses sensibles avec citation exacte mot pour mot : pacte, statuts, contrats clients, comparaison France Invest Series A/B.' },
                      { id: 'dd-technical',  num: '17', name: 'DD technique',      desc: 'Lecture du dossier technique transmis par la startup au fonds (architecture, sécurité IT, RGPD, BCP, IP). Dix tests structurés alignés sur la GCV Investor Due Diligence Checklist sections 4, 6, 7 et 8, avec citation mot pour mot et identification des zones non documentées comme questions DD.' },
                      { id: 'dd-references', num: '18', name: 'Reference checks structurés', desc: 'Saisie des notes d\u2019appels DD terrain (anciens supérieurs, pairs, subordonnés du fondateur, clients, board, signaux faibles) puis agrégation par moteur LLM dédié. Détecte les signaux convergents par 2+ sources, les divergences entre interlocuteurs, les red flags confirmés, les lacunes restantes et la conviction émergente. Disponible dans le Pack IC une fois le dossier persisté.' },
                    ].map((e) => {
                      const EnginePicto = ENGINE_PICTOS[e.id as keyof typeof ENGINE_PICTOS];
                      return (
                        <div className="method-engine" key={e.id}>
                          <div className="method-engine-picto" aria-hidden="true">
                            {EnginePicto && <EnginePicto />}
                          </div>
                          <div className="method-engine-num">{e.num}</div>
                          <div className="method-engine-text">
                            <div className="method-engine-name">{e.name}</div>
                            <div className="method-engine-desc">{e.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              </div>
            </section>
              </>
            )}

            {landingTab === 'vision' && (
              <>
            {/* SECTION 4 - Pour qui (rejoint l onglet Vision) */}
            <section className="landing-section">
              <div className="landing-h2-block">
                <div className="landing-h2-num">III.</div>
                <h2 className="landing-h2">Pensé pour les fonds qui instruisent réellement.</h2>
              </div>
              <div className="landing-prose">
                <p>
                  Prélude s&apos;adresse aux fonds early-stage et growth-stage qui instruisent en moyenne 200 à 500 dossiers par an et n&apos;en transforment qu&apos;une poignée. Le goulot d&apos;étranglement n&apos;est pas l&apos;accès au deal flow, c&apos;est la qualité et la profondeur de l&apos;instruction.
                </p>
                <p>
                  Deux destinataires complémentaires utilisent la plateforme à des moments différents du pipeline. L&apos;analyste ou le principal qualifie un dossier en cinq minutes avec la note d&apos;instruction du Bloc 1 : verdict chiffré, drivers, vigilance critique, friction d&apos;exécution. Si le dossier mérite d&apos;être poussé, le partner senior ouvre la data room du Bloc 2 et obtient en quinze minutes la confrontation BP versus réalité comptable, la cartographie des clauses sensibles du pacte et des contrats clients, et l&apos;audit data room qui prépare le comité d&apos;investissement. L&apos;avocat M&amp;A peut prendre le relais avec les citations exactes des clauses déjà extraites.
                </p>
                <p>
                  La plateforme est calibrée pour la rigueur européenne sans s&apos;y limiter : sources consolidées trimestriellement (Atomico, PitchBook, Bain, Correlation Ventures), pipeline réglementaire EU 2026 (28e régime, AI Development Act, Quantum Act), comparables européens 2024-2026 (Helsing, Mistral, NScale, Quantum-Systems), méthode applicable à tout dossier mondial.
                </p>
              </div>
            </section>
              </>
            )}

            {landingTab === 'deliverables' && (
              <>
            {/* SECTION 5 - Le livrable */}
            <section className="landing-section">
              <div className="landing-h2-block">
                <div className="landing-h2-num">IV.</div>
                <h2 className="landing-h2">Deux livrables, deux usages.</h2>
              </div>
              <p className="landing-section-intro">
                En sortie, Prélude produit deux livrables complémentaires : la note d&apos;instruction qui qualifie un dossier au screening, et la data room qui prépare le comité d&apos;investissement. Chacun a sa structure propre, calibrée pour son lecteur.
              </p>

              <div className="deliverable-columns">
                <div className="deliverable-column deliverable-column-instruction">
                  <div className="deliverable-column-header">
                    <span className="deliverable-column-tag">Bloc 1</span>
                    <span className="deliverable-column-title">Note d&apos;instruction</span>
                    <span className="deliverable-column-sub">IC-ready en 5 minutes</span>
                  </div>
                  <div className="deliverable-grid deliverable-grid-stack">
                    <div className="deliverable-block">
                      <div className="deliverable-num">1.</div>
                      <div className="deliverable-name">Company &amp; Project</div>
                      <div className="deliverable-desc">Synthèse du dossier, executive staff, projections financières, modèle économique.</div>
                    </div>
                    <div className="deliverable-block">
                      <div className="deliverable-num">2.</div>
                      <div className="deliverable-name">Investment Thesis</div>
                      <div className="deliverable-desc">Verdict, score chiffré, probabilité de succès. The case for, the case against, dialectical resolution.</div>
                    </div>
                    <div className="deliverable-block">
                      <div className="deliverable-num">3.</div>
                      <div className="deliverable-name">Risk &amp; Comparables</div>
                      <div className="deliverable-desc">Strategic, operational, financial risks. Competitive positioning. Comparables historiques internationaux.</div>
                    </div>
                    <div className="deliverable-block">
                      <div className="deliverable-num">4.</div>
                      <div className="deliverable-name">Transaction &amp; Conditions</div>
                      <div className="deliverable-desc">Stage, nominal, valuation. Conditions clés actionnables, plan de structuring 0-3 / 3-12 / 12+ mois.</div>
                    </div>
                  </div>
                </div>

                <div className="deliverable-column deliverable-column-dataroom">
                  <div className="deliverable-column-header">
                    <span className="deliverable-column-tag">Bloc 2</span>
                    <span className="deliverable-column-title">Data Room</span>
                    <span className="deliverable-column-sub">Audit DD en 15 minutes</span>
                  </div>
                  <div className="deliverable-grid deliverable-grid-stack">
                    <div className="deliverable-block">
                      <div className="deliverable-num">5.</div>
                      <div className="deliverable-name">DD financière</div>
                      <div className="deliverable-desc">Sept tests de réconciliation BP versus grand livre comptable : CA déclaré vs réel, marge brute projetée vs réelle, burn rate, headcount vs charges salariales, concentration client, trajectoire récente, engagements hors bilan.</div>
                    </div>
                    <div className="deliverable-block">
                      <div className="deliverable-num">6.</div>
                      <div className="deliverable-name">DD contractuelle</div>
                      <div className="deliverable-desc">Cartographie de quinze clauses sensibles avec citation exacte mot pour mot : pacte d&apos;actionnaires, statuts, contrats clients top dix. Comparaison aux standards France Invest Series A/B.</div>
                    </div>
                    <div className="deliverable-block">
                      <div className="deliverable-num">7.</div>
                      <div className="deliverable-name">DD technique <span className="deliverable-tag-soon">à venir</span></div>
                      <div className="deliverable-desc">Audit du repo GitHub : qualité du code, cadence release, dépendances obsolètes, secrets en dur, couverture de tests.</div>
                    </div>
                    <div className="deliverable-block">
                      <div className="deliverable-num">8.</div>
                      <div className="deliverable-name">Reference checks structurés <span className="deliverable-tag-soon">à venir</span></div>
                      <div className="deliverable-desc">Agrégation des notes d&apos;appels DD terrain pour faire émerger les patterns récurrents, les signaux faibles et les contradictions entre sources.</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
              </>
            )}

            {landingTab === 'sources' && (
              <>
            {/* SECTION 6 - Méthode et sources */}
            <section className="landing-section">
              <div className="landing-h2-block">
                <div className="landing-h2-num">V.</div>
                <h2 className="landing-h2">Sources externes et standards calibrés.</h2>
              </div>
              <p className="landing-section-intro">
                La rigueur méthodologique de Prélude repose sur un corpus externe consolidé chaque trimestre, qui sert de borne calibrée pour tous les jugements quantitatifs du Bloc 1. Pour le Bloc 2, les standards juridiques et comptables français servent de référentiel.
              </p>
              <ol className="sources-grid">
                <li className="source-card">
                  <div className="source-num">01</div>
                  <div className="source-name">PitchBook-NVCA</div>
                  <div className="source-edition">Venture Monitor Q1 2026</div>
                  <div className="source-desc">Médianes pré-money par stade, séparation IA vs non-IA, concentration extrême du capital US, step-up médian.</div>
                </li>
                <li className="source-card">
                  <div className="source-num">02</div>
                  <div className="source-name">Atomico</div>
                  <div className="source-edition">State of European Tech 2025</div>
                  <div className="source-desc">Profondeur du marché européen, allocation pension funds VC, Mighty 50, pipeline réglementaire EU 2026.</div>
                </li>
                <li className="source-card">
                  <div className="source-num">03</div>
                  <div className="source-name">Bain &amp; Company</div>
                  <div className="source-edition">Global Private Equity Report 2025</div>
                  <div className="source-desc">Liquidité LP, distributions to NAV, gap fundraising entre top et bottom quartile, multiples buyout EBITDA.</div>
                </li>
                <li className="source-card">
                  <div className="source-num">04</div>
                  <div className="source-name">Correlation &amp; Cambridge</div>
                  <div className="source-edition">Power-law VC returns</div>
                  <div className="source-desc">Loi de puissance des retours VC, benchmarks TRI et TVPI par quartile, persistance Kaplan-Schoar.</div>
                </li>
                <li className="source-card">
                  <div className="source-num">05</div>
                  <div className="source-name">France Invest &amp; BPI Capital</div>
                  <div className="source-edition">Standards Series A/B France</div>
                  <div className="source-desc">Calibration des clauses sensibles du pacte d&apos;actionnaires : liquidation preference, anti-dilution, drag along, tag along, droits de veto, répartition standards France 2024-2026.</div>
                </li>
                <li className="source-card">
                  <div className="source-num">06</div>
                  <div className="source-name">Plan Comptable Général</div>
                  <div className="source-edition">PCG 2024 &middot; FEC légal</div>
                  <div className="source-desc">Parsing du grand livre comptable au format FEC standard ou Excel libre. Soldes par classe (1 à 7), réconciliation BP versus réalité opérationnelle.</div>
                </li>
              </ol>
            </section>
              </>
            )}

            {/* SECTION 7 - CTA upload (toujours visible, hors onglets)
                La zone de depot reste accessible quel que soit l onglet
                actif : c est le call-to-action principal de la page. */}
            <section className="landing-section landing-cta-section" id="commencer">
              <div className="landing-h2-block">
                <div className="landing-h2-num">VI.</div>
                <h2 className="landing-h2">Commencer l&apos;instruction.</h2>
              </div>
              <p className="landing-section-intro">
                Pour le Bloc 1 (note d&apos;instruction), déposer le pitch deck PDF avec le business plan optionnel. Pour le Bloc 2 (data room), ajouter le grand livre comptable, le pacte d&apos;actionnaires, les statuts, les contrats clients principaux, le cap table et le dossier technique transmis par la startup. Les moteurs Bloc 2 ne tournent que si les documents correspondants sont fournis. Voir ci-dessous la convention de nommage attendue pour la classification automatique.
              </p>

              {/* PRESCAN KNOCKOUT - Affiche en HAUT de la zone d action,
                  avant l upload box, pour etre la premiere chose vue par
                  l utilisateur quand il revient sur la page apres un
                  pre-scan defavorable. Avant la refonte, ce bloc etait
                  affiche en bas de la zone CTA, ce qui obligeait a
                  scroller pour voir le verdict. */}
              {prescanKnockout && !analyzing && (
                <div className="prescan-gate prescan-gate-top">
                  <div className="prescan-gate-eyebrow">Triage Bloc 0 · Pré-scan défavorable</div>
                  <div className="prescan-gate-title">Le pré-scan a levé un drapeau éliminatoire</div>
                  <div className="prescan-gate-summary">{prescanKnockout.summary}</div>
                  {prescanKnockout.failedTests.length > 0 && (
                    <div className="prescan-gate-tests">
                      <div className="prescan-gate-tests-label">Tests échoués</div>
                      <ul className="prescan-gate-tests-list">
                        {prescanKnockout.failedTests.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="prescan-gate-meta">
                    Score {prescanKnockout.score}/{prescanKnockout.totalTests}. Le pipeline complet, qui mobilise quatorze moteurs analytiques pour environ 2,80 USD de crédits, n&apos;a pas été déclenché.
                  </div>
                  <div className="prescan-gate-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => analyze({ forcePrescan: true })}
                    >
                      Lancer l&apos;analyse complète malgré tout
                    </button>
                    <button
                      className="btn"
                      onClick={() => { setPrescanKnockout(null); reset(); }}
                    >
                      Ranger le dossier
                    </button>
                  </div>
                </div>
              )}

              {files.length === 0 ? (
                <>
                  <div className={`upload-box ${dragging ? 'dragging' : ''}`}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); handleFilesSelect(e.dataTransfer.files); }}>
                    <div className="upload-icon" aria-hidden="true">
                      <Picto name="upload" size={36} strokeWidth={1.5} />
                    </div>
                    <div className="upload-label">Déposer un dossier d&apos;investissement</div>
                    <div className="upload-hint">PDF (deck), XLSX/CSV (BP), 32 Mo max par fichier &middot; Cliquer ou glisser-déposer &middot; Plusieurs fichiers acceptés</div>
                    <input ref={inputRef} type="file" multiple accept="application/pdf,.pdf,.xlsx,.xls,.csv,.docx"
                      className="upload-input"
                      onChange={(e) => handleFilesSelect(e.target.files)} />
                  </div>

                  {/* Guide de classification : liste des familles de
                      documents reconnues automatiquement, avec exemples
                      de noms de fichiers. La detection se fait sur le
                      nom au moment de l upload (cf. classifyFileClient).
                      Les fichiers non reconnus partent dans others et
                      ne declenchent pas de moteur Bloc 2. */}
                  <div className="upload-guide">
                    <div className="upload-guide-title">Documents reconnus automatiquement par leur nom</div>
                    <div className="upload-guide-grid">
                      <div className="upload-guide-block">
                        <div className="upload-guide-block-tag">Bloc 1 (Note)</div>
                        <div className="upload-guide-row"><strong>Pitch Deck</strong> <span>pitch_deck.pdf, deck.pdf, teaser.pdf, investor_deck.pdf</span></div>
                        <div className="upload-guide-row"><strong>Business Plan</strong> <span>business_plan.xlsx, bp_2026.xlsx, financial_model.xlsx, forecast.csv</span></div>
                      </div>
                      <div className="upload-guide-block">
                        <div className="upload-guide-block-tag">Bloc 2 (Data Room)</div>
                        <div className="upload-guide-row"><strong>Grand livre</strong> <span>grand_livre.xlsx, FEC_2025.xlsx, ecritures_comptables.csv, balance_generale.xlsx</span></div>
                        <div className="upload-guide-row"><strong>Pacte d&apos;actionnaires</strong> <span>pacte.pdf, shareholders_agreement.pdf, sha.pdf, investment_agreement.pdf</span></div>
                        <div className="upload-guide-row"><strong>Statuts</strong> <span>statuts.pdf, articles_of_association.pdf, aoa.pdf, bylaws.pdf</span></div>
                        <div className="upload-guide-row"><strong>Cap table</strong> <span>cap_table.xlsx, captable.xlsx, capitalisation.xlsx, actionnariat.xlsx</span></div>
                        <div className="upload-guide-row"><strong>Contrats clients</strong> <span>contrat_client_X.pdf, msa_acmecorp.pdf, sla_acmecorp.pdf, master_services_agreement.pdf</span></div>
                        <div className="upload-guide-row"><strong>Dossier technique</strong> <span>architecture.pdf, security_policy.pdf, bcp.pdf, rgpd.pdf, gdpr_register.pdf, iso27001.pdf, soc2.pdf, dossier_technique.pdf, ip_schedule.pdf, disaster_recovery.pdf</span></div>
                      </div>
                    </div>
                    <div className="upload-guide-footer">
                      Les moteurs du Bloc 2 ne tournent que si les documents correspondants sont fournis. Un fichier non reconnu par son nom est ajouté dans &laquo; autres &raquo; et n&apos;active aucun moteur. Pour le Module 3 DD technique, plusieurs documents techniques peuvent être déposés (architecture + sécurité + RGPD séparés), ils seront tous lus en un seul appel.
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 16 }}>
                    {files.map((f, i) => {
                      const family = classifyFileClient(f);
                      const label = FAMILY_LABELS[family];
                      const isUnknown = family === 'unknown';
                      return (
                        <div key={i} className="file-info" style={{ marginBottom: 8 }}>
                          <div>
                            <div className="file-name">{f.name}</div>
                            <div className="file-size">
                              {(f.size / 1024 / 1024).toFixed(2)} Mo &middot;{' '}
                              <span style={{
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                fontSize: 10,
                                opacity: isUnknown ? 0.6 : 0.9,
                                color: isUnknown ? 'var(--ocre-brule, #b47832)' : 'inherit',
                                fontWeight: isUnknown ? 600 : 400,
                              }}>
                                {label}
                              </span>
                              {isUnknown && (
                                <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7, fontStyle: 'italic' }}>
                                  &middot; renommer pour activer un moteur Bloc 2
                                </span>
                              )}
                            </div>
                          </div>
                          <button className="btn" onClick={() => removeFile(i)}>Retirer</button>
                        </div>
                      );
                    })}
                    <button className="btn" style={{ marginTop: 8 }} onClick={() => inputRef.current?.click()}>+ Ajouter un fichier</button>
                    <input ref={inputRef} type="file" multiple accept="application/pdf,.pdf,.xlsx,.xls,.csv,.docx"
                      style={{ display: 'none' }}
                      onChange={(e) => { handleFilesSelect(e.target.files); if (inputRef.current) inputRef.current.value = ''; }} />
                  </div>
                  <div className="cta-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-muted, #6b6657)', fontFamily: 'inherit', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={forceNarrativeDrift}
                        onChange={(e) => setForceNarrativeDrift(e.target.checked)}
                        style={{ accentColor: 'var(--ocre, #a8743a)' }}
                      />
                      <span>Forcer la lecture du langage <span style={{ opacity: 0.55 }}>(mode QA, dossiers seed)</span></span>
                    </label>
                    <button className="btn btn-primary" onClick={() => analyze()}>Lancer le pipeline →</button>
                  </div>
                </>
              )}

              {error && <div className="error-box"><div className="error-title">Erreur</div><div>{error}</div></div>}
            </section>

            {/* COLOPHON FOOTER */}
            <footer className="landing-footer">
              <div className="landing-footer-line">Prélude · Le moteur d&apos;instruction des fonds de capital-risque</div>
              <div className="landing-footer-line muted">Document confidentiel · Usage strictement interne au Comité d'Investissement</div>
            </footer>
          </>
        )}

        {analyzing && (() => {
          // ECRAN DEDIE PRE-SCAN
          // Tant que le pre-scan tourne et qu aucun moteur Bloc 1 n a
          // commence, on affiche un ecran simple "Pre-scan en cours"
          // au lieu de la liste de 22 moteurs tous en idle. Cela rend
          // l attente plus lisible et cohere avec la doctrine Bloc 0
          // separe : le pre-scan est un triage qui peut s arreter le
          // pipeline, il merite un ecran dedie. Une fois le pre-scan
          // valide, on bascule automatiquement sur la vue pipeline
          // standard avec tous les moteurs.
          const prescanState = engineStates['prescan']?.status;
          const extractionState = engineStates['extraction']?.status;
          const inPrescanPhase = prescanState === 'running' && extractionState === 'idle';
          if (inPrescanPhase) {
            return (
              <div className="prescan-fullscreen">
                <div className="prescan-fullscreen-eyebrow">Bloc 0 · Triage</div>
                <div className="prescan-fullscreen-title">Pré-scan en cours</div>
                <div className="prescan-fullscreen-pulse" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <p className="prescan-fullscreen-text">
                  Six à dix tests éliminatoires sont appliqués au dossier selon la thèse du fonds. Si l&apos;un d&apos;eux échoue, le pipeline complet n&apos;est pas déclenché et le verdict apparaît directement en tête de page. Sinon l&apos;analyse continue automatiquement avec les quatorze moteurs Bloc 1.
                </p>
                <div className="prescan-fullscreen-meta">
                  Durée typique 15 à 30 secondes · Coût marginal moins de 0,10 USD
                </div>
                <div className="prescan-fullscreen-timer">
                  {Math.floor(pipelineElapsedMs / 1000)} s écoulées
                </div>
              </div>
            );
          }
          // Sinon, vue pipeline standard
          return (
          <div className="pipeline">
            <div className="pipeline-head">
              <div className="pipeline-title">Pipeline en cours d&apos;exécution</div>
              <div className="pipeline-sub">
                Onze moteurs travaillent en parallèle ou en cascade selon les dépendances. Suivi en temps réel dans le bandeau ci-dessus.
              </div>
              <div className="pipeline-timer">
                <span className="pipeline-timer-label">Durée écoulée</span>
                <span className="pipeline-timer-value">
                  {Math.floor(pipelineElapsedMs / 60000)} min {Math.floor((pipelineElapsedMs % 60000) / 1000).toString().padStart(2, '0')} s
                </span>
                <span className="pipeline-timer-hint">
                  Estimation 3 à 4 minutes selon le dossier. Les durées affichées par moteur ci-dessous ne s&apos;additionnent pas : six moteurs tournent en parallèle dans le même batch, leur durée totale est celle du plus lent.
                </span>
              </div>
            </div>
            <div style={{ padding: '12px 18px', background: 'var(--ocre-brule-soft)', border: '1px solid var(--ocre-brule)', marginBottom: 16, fontSize: 12, lineHeight: 1.5 }}>
              <strong>Sur mobile :</strong> idéalement laisse l&apos;écran allumé pendant les 3-4 minutes du pipeline.
              Si la connexion est interrompue, l&apos;analyse continue de tourner côté serveur et apparaît dans Historique au prochain refresh. Aucune perte possible.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button
                onClick={() => {
                  try {
                    localStorage.removeItem('prelude_active_job');
                    localStorage.removeItem('prelude_active_job_started_at');
                  } catch (e) {}
                  setAnalyzing(false);
                  setFiles([]);
                  setEngineStates(Object.fromEntries(ENGINES.map(e => [e.id, { status: 'idle' }])));
                }}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  background: 'transparent',
                  border: '1px solid var(--ink)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: 'var(--ink)',
                }}>
                Annuler et recommencer
              </button>
            </div>
            {/* Vue detaillee verticale conservee en complement du bandeau sticky.
                Le bandeau donne la vue de flux ; cette liste donne le detail
                avec sous-titres explicatifs. Utile pour les utilisateurs qui
                veulent comprendre ce que fait chaque moteur.
                Liste structuree en deux blocs : Note d instruction (screening)
                et Data Room (DD approfondie). Les moteurs Data Room ne
                tournent que si les documents data room ont ete uploades. */}
            {ENGINES.map((engine, idx) => {
              const state = engineStates[engine.id];
              const durationMs = state.completedAt && state.startedAt
                ? state.completedAt - state.startedAt : null;
              const duration = formatEngineDuration(durationMs);

              // Insertion du separateur Bloc 1 avant le premier moteur
              const showInstructionHeader = idx === 0;
              // Insertion du separateur Bloc 2 avant le premier moteur dataroom
              const prevBlock = idx > 0 ? ENGINES[idx - 1].block : null;
              const showDataRoomHeader = engine.block === 'dataroom' && prevBlock !== 'dataroom';

              return (
                <React.Fragment key={engine.id}>
                  {showInstructionHeader && (
                    <div className="engine-block-header engine-block-header-instruction">
                      <span className="engine-block-tag">Bloc 1</span>
                      <span className="engine-block-title">Note d&apos;instruction</span>
                      <span className="engine-block-sub">Screening &middot; Deal qualification</span>
                    </div>
                  )}
                  {showDataRoomHeader && (
                    <div className="engine-block-header engine-block-header-dataroom">
                      <span className="engine-block-tag">Bloc 2</span>
                      <span className="engine-block-title">Data Room</span>
                      <span className="engine-block-sub">Due diligence approfondie</span>
                    </div>
                  )}
                  <div className="engine-row">
                    <div className={`engine-status ${state.status}`}>
                      {state.status === 'idle' && (idx + 1)}
                      {state.status === 'running' && '·'}
                      {state.status === 'done' && '✓'}
                      {state.status === 'error' && '✕'}
                    </div>
                    <div>
                      <div className="engine-name">{engine.name}</div>
                      <div className="engine-label">{engine.label}</div>
                    </div>
                    <div
                      className="engine-time"
                      style={duration === 'non applicable'
                        ? { fontStyle: 'italic', opacity: 0.55, fontSize: '0.92em' }
                        : undefined}
                    >
                      {duration || ''}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          );
        })()}

        {result && (
          <>
            {/* PANEL DD APPROFONDIE
                Visible uniquement si le partner a clique sur le bandeau
                "Passer en DD approfondie" dans la note d instruction. La
                zone d upload n accepte que les documents Bloc 2. Au
                lancement, /api/analyses/[id]/dd-deepen tourne les
                moteurs Data Room et merge dans le result_json existant
                sans recalculer le Bloc 1. */}
            {ddDeepenOpen && savedAnalysisId && (
              <div className="dd-deepen-panel">
                <div className="dd-deepen-panel-head">
                  <div>
                    <div className="dd-deepen-panel-tag">Phase 2 - Data Room</div>
                    <div className="dd-deepen-panel-title">DD approfondie</div>
                  </div>
                  <button
                    className="btn"
                    onClick={() => { setDdDeepenOpen(false); setDdDeepenFiles([]); setDdDeepenError(null); }}
                    disabled={ddDeepenAnalyzing}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    Fermer
                  </button>
                </div>
                <p className="dd-deepen-panel-desc">
                  Deposer les documents data room transmis par la startup. Les moteurs Bloc 2 vont enrichir la note existante sans recalculer le Bloc 1. Documents reconnus : grand livre comptable, pacte d&apos;actionnaires, statuts, cap table, contrats clients, dossier technique.
                </p>

                {ddDeepenFiles.length === 0 ? (
                  <div className="upload-box" onClick={() => ddDeepenInputRef.current?.click()}>
                    <div className="upload-icon" aria-hidden="true">
                      <Picto name="upload" size={32} strokeWidth={1.5} />
                    </div>
                    <div className="upload-label">Deposer les documents data room</div>
                    <div className="upload-hint">PDF, XLSX, CSV, DOCX - Plusieurs fichiers acceptes</div>
                    <input
                      ref={ddDeepenInputRef}
                      type="file"
                      multiple
                      accept="application/pdf,.pdf,.xlsx,.xls,.csv,.docx"
                      className="upload-input"
                      onChange={(e) => handleDdDeepenFilesSelect(e.target.files)}
                    />
                  </div>
                ) : (
                  <div style={{ marginBottom: 16 }}>
                    {ddDeepenFiles.map((f, i) => {
                      const family = classifyFileClient(f);
                      const label = FAMILY_LABELS[family];
                      const isUnknown = family === 'unknown';
                      const isBloc1Family = family === 'pitch_deck' || family === 'business_plan';
                      const isInvalid = isUnknown || isBloc1Family;
                      return (
                        <div key={i} className="file-info" style={{ marginBottom: 8 }}>
                          <div>
                            <div className="file-name">{f.name}</div>
                            <div className="file-size">
                              {(f.size / 1024 / 1024).toFixed(2)} Mo &middot;{' '}
                              <span style={{
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                fontSize: 10,
                                color: isInvalid ? 'var(--ocre-brule, #b47832)' : 'inherit',
                                fontWeight: isInvalid ? 600 : 400,
                              }}>
                                {label}
                              </span>
                              {isBloc1Family && (
                                <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7, fontStyle: 'italic' }}>
                                  &middot; document Bloc 1, ne sera pas traite ici
                                </span>
                              )}
                              {isUnknown && (
                                <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7, fontStyle: 'italic' }}>
                                  &middot; non reconnu, renommer ou retirer
                                </span>
                              )}
                            </div>
                          </div>
                          <button className="btn" onClick={() => removeDdDeepenFile(i)} disabled={ddDeepenAnalyzing}>Retirer</button>
                        </div>
                      );
                    })}
                    <button
                      className="btn"
                      style={{ marginTop: 8 }}
                      onClick={() => ddDeepenInputRef.current?.click()}
                      disabled={ddDeepenAnalyzing}
                    >
                      + Ajouter un fichier
                    </button>
                    <input
                      ref={ddDeepenInputRef}
                      type="file"
                      multiple
                      accept="application/pdf,.pdf,.xlsx,.xls,.csv,.docx"
                      style={{ display: 'none' }}
                      onChange={(e) => { handleDdDeepenFilesSelect(e.target.files); if (ddDeepenInputRef.current) ddDeepenInputRef.current.value = ''; }}
                    />
                    <div className="cta-row" style={{ marginTop: 16 }}>
                      <button
                        className="btn btn-primary"
                        onClick={analyzeDDDeepen}
                        disabled={ddDeepenAnalyzing}
                      >
                        {ddDeepenAnalyzing ? 'DD approfondie en cours...' : 'Lancer la DD approfondie \u2192'}
                      </button>
                    </div>
                  </div>
                )}

                {ddDeepenError && (
                  <div className="error-box" style={{ marginTop: 12 }}>
                    <div className="error-title">Erreur</div>
                    <div>{ddDeepenError}</div>
                  </div>
                )}
              </div>
            )}

            {/* Bandeau d avertissement quand l utilisateur consulte une
                version historique. Discret mais explicite, pour eviter qu il
                pense regarder la version live. */}
            {viewedVersionNum !== null && (
              <div style={{
                marginBottom: 14,
                padding: '10px 16px',
                background: 'rgba(122,92,31,0.10)',
                border: '1px solid rgba(122,92,31,0.30)',
                borderLeft: '3px solid #7a5c1f',
                fontSize: 12,
                color: 'var(--ocre-brule)',
                lineHeight: 1.5,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}>
                <span>
                  <strong>Version historique v{viewedVersionNum}.</strong>
                  {' '}Vous consultez un snapshot anterieur de cette analyse, en lecture seule.
                </span>
                <button
                  onClick={() => handleVersionChange(null, null)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: 'transparent',
                    color: 'var(--ocre-brule)',
                    border: '1px solid #5a4a32',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Revenir a la version actuelle
                </button>
              </div>
            )}
            {/* Bandeau Workflow + Versions : visible des le haut de la page
                d analyse pour permettre de faire evoluer le stade d instruction
                sans avoir a scroller jusqu en bas. C est l interaction pivot
                de la vue de fonds : un partner ouvre un dossier, voit son
                stade actuel, le change en deux clics, et toute l equipe est
                notifiee dans Slack. */}
            {savedAnalysisId && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 16,
                padding: '14px 18px',
                background: 'var(--surface)',
                border: '1px solid var(--hairline)',
                flexWrap: 'wrap',
              }}>
                <span style={{
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                  fontWeight: 500,
                }}>
                  Stade d&apos;instruction
                </span>
                <WorkflowStageBadge analysisId={savedAnalysisId} authEnabled={authEnabled} />
                <div style={{ flex: 1 }} />
                <VersionSelector
                  analysisId={savedAnalysisId}
                  currentVersionNum={viewedVersionNum}
                  onVersionChange={handleVersionChange}
                />
              </div>
            )}
            {/* Toggle de vue : Dashboard vs Note d'investissement, plus bouton export */}
            <div className="view-toggle-row" style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => setViewMode('dashboard')}
                style={{
                  padding: '8px 18px',
                  fontSize: 12,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: viewMode === 'dashboard' ? 'var(--ink)' : 'transparent',
                  color: viewMode === 'dashboard' ? '#fefefe' : 'var(--ink)',
                  border: '1px solid var(--ink)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>
                Dashboard analytique
              </button>
              <button
                onClick={() => setViewMode('note')}
                style={{
                  padding: '8px 18px',
                  fontSize: 12,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: viewMode === 'note' ? 'var(--ink)' : 'transparent',
                  color: viewMode === 'note' ? '#fefefe' : 'var(--ink)',
                  border: '1px solid var(--ink)',
                  borderLeft: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>
                Note d&apos;investissement
              </button>

              {/* Toggle Lecture rapide / Lecture complete - visible uniquement
                  en vue note. La lecture rapide replie les sections 2 (Proposed
                  Project) et 4 (Transaction Features) par defaut. La preference
                  est persistee via localStorage. L export PDF reste TOUJOURS
                  complet, independant de ce toggle. */}
              {viewMode === 'note' && (
                <div style={{ display: 'flex', marginLeft: 6 }}>
                  <button
                    onClick={() => setCompactNoteMode(true)}
                    title="Replie les sections secondaires (Projet proposé, Modalités de la transaction). Verdict, score et conditions clés restent visibles."
                    style={{
                      padding: '8px 14px',
                      fontSize: 11,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      background: compactNoteMode ? '#5a4a32' : 'transparent',
                      color: compactNoteMode ? '#fefefe' : 'var(--ink)',
                      border: '1px solid #5a4a32',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}>
                    Lecture rapide
                  </button>
                  <button
                    onClick={() => setCompactNoteMode(false)}
                    title="Affiche toutes les sections de la note depliees."
                    style={{
                      padding: '8px 14px',
                      fontSize: 11,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      background: !compactNoteMode ? '#5a4a32' : 'transparent',
                      color: !compactNoteMode ? '#fefefe' : 'var(--ink)',
                      border: '1px solid #5a4a32',
                      borderLeft: 'none',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}>
                    Lecture complète
                  </button>
                </div>
              )}
              {/* Bouton export PDF : active printMode qui rend toutes les sections
                  (dashboard analytique + note d investissement) simultanement,
                  puis envoie le HTML rendu a la route serveur /api/export-pdf
                  qui genere le PDF avec Puppeteer. Plus fiable que window.print()
                  qui produit des PDF corrompus selon le navigateur (Chrome desktop
                  generait des fichiers 0 octets, Android coupait au bout de 4 pages). */}
              <button
                onClick={async () => {
                  setPrintMode(true);
                  // Attendre que React rende toutes les sections en printMode
                  await new Promise((r) => setTimeout(r, 800));

                  try {
                    // Recuperer le HTML rendu de la zone de contenu principale
                    const mainEl = document.querySelector('.dashboard-content') || document.querySelector('main');
                    if (!mainEl) {
                      throw new Error('Zone de contenu non trouvee');
                    }
                    const html = mainEl.outerHTML;

                    // Recuperer tous les styles : <style> inline + feuilles externes
                    const styleSheets = Array.from(document.styleSheets);
                    const cssRules: string[] = [];
                    for (const sheet of styleSheets) {
                      try {
                        const rules = sheet.cssRules || sheet.rules;
                        if (rules) {
                          for (let i = 0; i < rules.length; i++) {
                            cssRules.push(rules[i].cssText);
                          }
                        }
                      } catch {
                        // CORS sur certaines feuilles externes : on ignore
                      }
                    }
                    const css = cssRules.join('\n');

                    // Appel a la route serveur
                    const companyName = result?.extraction?.companyName || 'analyse';
                    const fileName = `prelude-${String(companyName).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;

                    const res = await fetch('/api/export-pdf', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        html,
                        css,
                        title: `Prelude · ${companyName}`,
                        fileName,
                      }),
                    });

                    if (!res.ok) {
                      const errorData = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
                      throw new Error(errorData.error || `HTTP ${res.status}`);
                    }

                    // Telecharger le PDF
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch (err: any) {
                    console.error('Export PDF echec:', err);
                    alert('Echec export PDF : ' + (err?.message || 'erreur inconnue'));
                  } finally {
                    setPrintMode(false);
                  }
                }}
                title="Exporter le dashboard analytique complet et la note d&apos;investissement en PDF"
                style={{
                  padding: '8px 18px',
                  fontSize: 12,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: 'transparent',
                  color: 'var(--ink)',
                  border: '1px solid var(--ink)',
                  marginLeft: 8,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>
                ⤓ Exporter en PDF
              </button>
              {/* Bouton Pack IC : ouvre la vue dediee (3 pages calibrees pour
                  le comite). L export PDF du pack est ensuite accessible
                  depuis la vue elle-meme via un bouton dedie. Avant, ce bouton
                  declenchait directement un telechargement PDF, ce qui etait
                  trompeur sur mobile : on s attend a voir la vue d abord. */}
              <button
                onClick={() => {
                  setActiveTab('ic-pack');
                  // Scroll vers la zone de contenu apres le rendu React
                  setTimeout(() => {
                    const el = document.querySelector('.ic-pack');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 200);
                }}
                title="Ouvrir le Pack IC (3 pages prêtes pour le comite)"
                style={{
                  padding: '8px 18px',
                  fontSize: 12,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: activeTab === 'ic-pack' ? 'var(--ink)' : 'transparent',
                  color: activeTab === 'ic-pack' ? '#fefefe' : 'var(--ink)',
                  border: '1px solid var(--ink)',
                  marginLeft: 8,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}>
                Pack IC
              </button>
              {/* Bouton ouverture du volet de commentaires partages multi-membres.
                  Visible uniquement quand l analyse est sauvegardee en base
                  (savedAnalysisId existe), car les commentaires sont rattaches
                  a un id d analyse persistee. Affiche un compteur si commentaires
                  ouverts. */}
              {savedAnalysisId && (
                <button
                  onClick={() => setCommentsOpen(true)}
                  title="Voir et ajouter des commentaires partages avec les autres membres du fonds"
                  style={{
                    padding: '8px 18px',
                    fontSize: 12,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: 'transparent',
                    color: 'var(--ink)',
                    border: '1px solid var(--ink)',
                    marginLeft: 8,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}>
                  ✎ Commentaires
                </button>
              )}
              {/* Lien vers l historique des analyses sauvegardees + indicateur
                  visuel discret quand l analyse en cours a ete persistee */}
              <a
                href="/history"
                style={{
                  padding: '8px 18px',
                  fontSize: 12,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: 'transparent',
                  color: 'var(--ink)',
                  border: '1px solid var(--ink)',
                  marginLeft: 8,
                  textDecoration: 'none',
                  fontFamily: 'inherit',
                }}
                title="Voir l historique des analyses"
              >
                Historique
              </a>
              {savedAnalysisId && (
                <span style={{
                  marginLeft: 12,
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--vert-foret)',
                  alignSelf: 'center',
                }}>
                  ✓ Sauvegardée
                </span>
              )}
            </div>

            {/* NIVEAU 3.A : Bloc d annotation utilisateur.
                Apparait uniquement quand l analyse est sauvegardee
                (savedAnalysisId existe). Permet a l utilisateur d ajouter
                des notes libres qui seront stockees et reutilisees comme
                contexte d apprentissage sur les futurs dossiers du meme
                secteur. */}
            {savedAnalysisId && (
              <AnnotationBlock analysisId={savedAnalysisId} />
            )}

            {/* En mode normal: bascule selon viewMode. En mode print: rend dashboard + note en cascade. */}
            {(viewMode === 'note' && !printMode) ? (
              <InvestmentNoteView
                result={result}
                analysisId={savedAnalysisId || undefined}
                compactMode={compactNoteMode}
                onDeepenDDClick={() => {
                  setDdDeepenOpen(true);
                  setDdDeepenError(null);
                  // Scroll en haut de page pour que la zone d upload soit visible
                  if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
              />
            ) : (
              <>
            {/* Bandeau audit des assertions : signale les noms / dates / devises
                non sources detectes mecaniquement dans les outputs des moteurs.
                Si > 5 warnings, encadre rouge ; sinon encadre ambre discret. */}
            {result.assertionAudit && result.assertionAudit.totalWarnings > 0 && (
              <div style={{
                marginBottom: 18, padding: '12px 16px',
                background: result.assertionAudit.totalWarnings > 5
                  ? 'rgba(220, 80, 60, 0.10)'
                  : 'rgba(220, 160, 60, 0.08)',
                border: result.assertionAudit.totalWarnings > 5
                  ? '1px solid rgba(220, 80, 60, 0.35)'
                  : '1px solid rgba(220, 160, 60, 0.30)',
                borderRadius: 4,
                fontSize: 12,
              }}>
                <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.75, marginBottom: 6 }}>
                  Audit des assertions · {result.assertionAudit.totalWarnings} point{result.assertionAudit.totalWarnings > 1 ? 's' : ''} à vérifier
                </div>
                <div style={{ opacity: 0.9, lineHeight: 1.55 }}>
                  {result.assertionAudit.byCategory.unknown_name ? (
                    <span style={{ marginRight: 14 }}>
                      <strong>{result.assertionAudit.byCategory.unknown_name}</strong> nom{result.assertionAudit.byCategory.unknown_name > 1 ? 's' : ''} propre{result.assertionAudit.byCategory.unknown_name > 1 ? 's' : ''} non sourcé{result.assertionAudit.byCategory.unknown_name > 1 ? 's' : ''} dans le pitch
                    </span>
                  ) : null}
                  {result.assertionAudit.byCategory.currency_mismatch ? (
                    <span style={{ marginRight: 14 }}>
                      <strong>{result.assertionAudit.byCategory.currency_mismatch}</strong> conversion{result.assertionAudit.byCategory.currency_mismatch > 1 ? 's' : ''} de devise non explicitée{result.assertionAudit.byCategory.currency_mismatch > 1 ? 's' : ''}
                    </span>
                  ) : null}
                  {result.assertionAudit.byCategory.invented_date ? (
                    <span style={{ marginRight: 14 }}>
                      <strong>{result.assertionAudit.byCategory.invented_date}</strong> date{result.assertionAudit.byCategory.invented_date > 1 ? 's' : ''} sans correspondance pitch
                    </span>
                  ) : null}
                </div>
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 11, opacity: 0.7 }}>Voir le détail</summary>
                  <div style={{ marginTop: 10, paddingLeft: 8, borderLeft: '2px solid rgba(255,255,255,0.15)' }}>
                    {result.assertionAudit.warnings.slice(0, 12).map((w: any, i: number) => (
                      <div key={i} style={{ marginBottom: 10, fontSize: 11, lineHeight: 1.5 }}>
                        <div style={{ opacity: 0.5, fontSize: 10 }}>
                          {w.engine} · {w.field}
                        </div>
                        <div style={{ opacity: 0.9 }}>{w.message}</div>
                        {w.excerpt && (
                          <div style={{ marginTop: 4, fontStyle: 'italic', opacity: 0.6 }}>
                            « …{w.excerpt}… »
                          </div>
                        )}
                      </div>
                    ))}
                    {result.assertionAudit.warnings.length > 12 && (
                      <div style={{ fontSize: 10, opacity: 0.6 }}>
                        … et {result.assertionAudit.warnings.length - 12} autre{result.assertionAudit.warnings.length - 12 > 1 ? 's' : ''}.
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}

            {/* ENCART PRE-SCAN
                Affiche le verdict du moteur de triage Bloc 0 si present.
                Trois etats visuels :
                  - ready_for_pipeline : encart vert sobre, mentionne juste
                    que le triage est passe
                  - pipeline_with_caveats : encart ambre, liste les warns
                  - not_recommended : encart rouge, liste les fails et
                    invite a reflechir avant d aller plus loin
                Toujours affiche pour la transparence : le partner doit
                voir que le pre-scan a tourne et savoir ce qu il a dit. */}
            {result.preScan && (() => {
              const ps = result.preScan;
              const isOk = ps.recommendation === 'ready_for_pipeline';
              const isCaveats = ps.recommendation === 'pipeline_with_caveats';
              const colors = isOk
                ? { bg: 'rgba(80, 140, 90, 0.06)', border: 'rgba(80, 140, 90, 0.45)', accent: '#508c5a' }
                : isCaveats
                ? { bg: 'rgba(192, 138, 63, 0.08)', border: 'rgba(192, 138, 63, 0.5)', accent: '#c08a3f' }
                : { bg: 'rgba(192, 64, 60, 0.08)', border: 'rgba(192, 64, 60, 0.5)', accent: '#c0403c' };
              const verdictLabel = isOk
                ? 'Pré-scan favorable'
                : isCaveats
                ? 'Pré-scan avec réserves'
                : 'Pré-scan défavorable';
              // Le pre-scan applique six tests universels par defaut, et
              // jusqu a dix si la these du fonds est renseignee (fit
              // sectoriel, geographique, ticket, stade). Le total reel
              // est dans ps.totalTests (fallback six si absent pour
              // compat avec anciennes analyses).
              const totalTests = typeof ps.totalTests === 'number' ? ps.totalTests : 6;
              const testCountLabel = totalTests === 10 ? 'dix' : 'six';
              return (
                <div style={{
                  marginBottom: 24,
                  padding: '20px 24px',
                  background: colors.bg,
                  borderLeft: `3px solid ${colors.border}`,
                  borderRadius: 2,
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 10,
                    flexWrap: 'wrap',
                    gap: 8,
                  }}>
                    <div style={{
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: colors.accent,
                      fontWeight: 600,
                    }}>
                      Triage Bloc 0 · {verdictLabel}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-tertiary)' }}>
                      Score {ps.score}/{totalTests}{ps.durationMs ? ` · ${(ps.durationMs / 1000).toFixed(1)}s` : ''}{ps.estimatedCostUsd ? ` · ~$${ps.estimatedCostUsd.toFixed(2)}` : ''}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: 'var(--ink)',
                    marginBottom: ps.tests?.length ? 14 : 0,
                  }}>
                    {ps.summary}
                  </div>
                  {Array.isArray(ps.tests) && ps.tests.length > 0 && (
                    <details style={{ marginTop: 6 }}>
                      <summary style={{
                        cursor: 'pointer',
                        fontSize: 11,
                        color: colors.accent,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        fontWeight: 600,
                        userSelect: 'none',
                      }}>
                        Voir le détail des {testCountLabel} tests
                      </summary>
                      <div style={{ marginTop: 12 }}>
                        {ps.tests.map((t: any, i: number) => {
                          const testColor = t.status === 'pass'
                            ? '#508c5a'
                            : t.status === 'warn'
                            ? '#c08a3f'
                            : '#c0403c';
                          return (
                            <div key={i} style={{
                              marginBottom: 12,
                              paddingLeft: 12,
                              borderLeft: `2px solid ${testColor}`,
                            }}>
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: 4,
                                gap: 8,
                                flexWrap: 'wrap',
                              }}>
                                <strong style={{ fontSize: 13, fontFamily: 'var(--serif)' }}>
                                  {t.name}
                                </strong>
                                <span style={{
                                  fontSize: 10,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.08em',
                                  color: testColor,
                                  fontWeight: 600,
                                }}>
                                  {t.status}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--ink-soft)' }}>
                                {t.rationale}
                              </div>
                              {t.evidence && (
                                <div style={{
                                  fontSize: 11,
                                  fontStyle: 'italic',
                                  color: 'var(--ink-tertiary)',
                                  marginTop: 4,
                                }}>
                                  « {t.evidence} »
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </div>
              );
            })()}

            {/* Recommandation hero enrichie */}
            <div className="reco-card">
              <div className="small-caps" style={{ opacity: 0.7, marginBottom: 8 }}>Recommandation finale du pipeline</div>
              <div className="reco-verdict">{result.finalRecommendation?.verdict || '—'}</div>

              {/* Probabilités chiffrées success/failure */}
              {result.finalRecommendation?.successProbability !== undefined && (
                <div style={{ display: 'flex', gap: 32, marginTop: 20, marginBottom: 24, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 6 }}>Probabilité de succès</div>
                    <div style={{ fontSize: 42, fontFamily: 'var(--serif)', fontWeight: 500, lineHeight: 1 }}>
                      {result.finalRecommendation.successProbability}<span style={{ fontSize: 20, opacity: 0.7 }}>%</span>
                    </div>
                  </div>
                  <div style={{ flex: '1 1 200px' }}>
                    <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 6 }}>Probabilité d'échec</div>
                    <div style={{ fontSize: 42, fontFamily: 'var(--serif)', fontWeight: 500, lineHeight: 1, opacity: 0.85 }}>
                      {result.finalRecommendation.failureProbability}<span style={{ fontSize: 20, opacity: 0.7 }}>%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Jauge avec seuils */}
              {result.finalRecommendation?.investmentThreshold && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 8 }}>
                    Score global · Seuils de décision
                  </div>
                  <div style={{ position: 'relative', height: 32, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                    {/* Seuils marqués */}
                    {[
                      { v: result.finalRecommendation.investmentThreshold.thresholdToInvestigate, label: 'Approfondir' },
                      { v: result.finalRecommendation.investmentThreshold.thresholdToCondition, label: 'Conditions' },
                      { v: result.finalRecommendation.investmentThreshold.thresholdToInvest, label: 'Investir' },
                    ].map((t, i) => (
                      <div key={i} style={{
                        position: 'absolute', left: `${t.v}%`, top: 0, height: '100%',
                        borderLeft: '1px dashed rgba(255,255,255,0.3)',
                      }}>
                        <div style={{ position: 'absolute', top: -16, left: 4, fontSize: 10, opacity: 0.6 }}>
                          {t.v}
                        </div>
                      </div>
                    ))}
                    {/* Niveau actuel */}
                    <div style={{
                      position: 'absolute', left: 0, top: 0, height: '100%',
                      width: `${result.finalRecommendation.investmentThreshold.currentLevel || result.finalRecommendation.globalScore}%`,
                      background: 'rgba(255,255,255,0.25)',
                    }} />
                    {/* Pointer */}
                    <div style={{
                      position: 'absolute',
                      left: `${result.finalRecommendation.investmentThreshold.currentLevel || result.finalRecommendation.globalScore}%`,
                      top: 0, height: '100%', width: 3, background: '#fff',
                      transform: 'translateX(-1px)',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, opacity: 0.5, marginTop: 6 }}>
                    <span>0</span><span>50</span><span>100</span>
                  </div>
                </div>
              )}

              <div className="reco-score">
                <div className="reco-score-num">{result.finalRecommendation?.globalScore || 0}</div>
                <div className="reco-score-label">Score global / 100</div>
              </div>

              {/* Score auditable : delta entre jugement LLM et calcul mecanique
                  des dimensions ponderees + ajustement blindspots/contrarian.
                  Si delta > 15 points, bandeau d alerte de divergence. */}
              {result.finalRecommendation?.computedScoreBreakdown && (
                <div style={{
                  marginTop: 18, padding: '14px 16px',
                  background: Math.abs(result.finalRecommendation.computedScoreBreakdown.delta) > 15
                    ? 'rgba(220, 80, 60, 0.10)'
                    : 'rgba(255,255,255,0.04)',
                  border: Math.abs(result.finalRecommendation.computedScoreBreakdown.delta) > 15
                    ? '1px solid rgba(220, 80, 60, 0.4)'
                    : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 4,
                  fontSize: 12,
                }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 8 }}>
                    Audit du score · jugement LLM vs calcul mécanique
                  </div>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 10 }}>
                    <div>
                      <div style={{ opacity: 0.6, fontSize: 10 }}>Score LLM</div>
                      <div style={{ fontSize: 22, fontFamily: 'var(--serif)' }}>{result.finalRecommendation.computedScoreBreakdown.llmScore}</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.6, fontSize: 10 }}>Score mécanique</div>
                      <div style={{ fontSize: 22, fontFamily: 'var(--serif)' }}>{result.finalRecommendation.computedScoreBreakdown.finalComputedScore}</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.6, fontSize: 10 }}>Écart</div>
                      <div style={{
                        fontSize: 22, fontFamily: 'var(--serif)',
                        color: Math.abs(result.finalRecommendation.computedScoreBreakdown.delta) > 15 ? '#e88a7e' : 'inherit',
                      }}>
                        {result.finalRecommendation.computedScoreBreakdown.delta > 0 ? '+' : ''}
                        {result.finalRecommendation.computedScoreBreakdown.delta}
                      </div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.6, fontSize: 10 }}>Dimensions pondérées</div>
                      <div style={{ fontSize: 14 }}>{result.finalRecommendation.computedScoreBreakdown.weightedDimensionScore}</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.6, fontSize: 10 }}>Ajustement blindspots / contrarian</div>
                      <div style={{ fontSize: 14 }}>
                        {result.finalRecommendation.computedScoreBreakdown.blindspotsContrarianAdjustment > 0 ? '+' : ''}
                        {result.finalRecommendation.computedScoreBreakdown.blindspotsContrarianAdjustment}
                      </div>
                    </div>
                  </div>
                  <div style={{ opacity: 0.85, lineHeight: 1.5 }}>
                    {result.finalRecommendation.computedScoreBreakdown.auditNote}
                  </div>
                </div>
              )}

              {/* Recommandation finale - prose dense decoupee en paragraphes
                  courts (3 phrases chacun) avec chiffres mis en valeur.
                  Sans cette refonte, la prose etait un mur de 12 lignes
                  illisible sur mobile et peu engageant en general. */}
              <div className="reco-arg-aerated">
                {splitIntoParagraphs(result.finalRecommendation?.argumentation, 3).map((p, i) => (
                  <p key={i} className="reco-arg-para">{enrichProse(p)}</p>
                ))}
              </div>

              {/* Top 3 risques critiques - hierarchisation : on remonte
                  les patterns à risque haute intensite + alertes
                  critiques pour qu un VC voie l essentiel sans deplier
                  10 sections. Sur UP&CHARGE le 6,3:1 prix/substitut etait
                  noye page 4 ; ce bloc le remonte au-dessus du fold. */}
              {(() => {
                const topRisks: Array<{ label: string; intensity: number; evidence: string }> = [];
                // 1. Patterns de vigilance critique haute intensite (>= 70)
                const patterns = result.blindspotAnalysis?.patterns || {};
                Object.values(patterns).forEach((p: any) => {
                  if (p?.detected && (p.intensity || 0) >= 70) {
                    topRisks.push({
                      label: p.patternName || 'Pattern à risque',
                      intensity: p.intensity || 0,
                      evidence: (p.evidence || '').slice(0, 220),
                    });
                  }
                });
                // 2. Alertes critiques bruts si pas assez de patterns
                if (topRisks.length < 3) {
                  const alertes = result.blindspotAnalysis?.alertesCritiques || [];
                  for (const a of alertes.slice(0, 3 - topRisks.length)) {
                    topRisks.push({
                      label: 'Alerte critique',
                      intensity: 80,
                      evidence: typeof a === 'string' ? a.slice(0, 220) : '',
                    });
                  }
                }
                // Tri par intensite decroissante, top 3
                topRisks.sort((a, b) => b.intensity - a.intensity);
                const top = topRisks.slice(0, 3);
                if (top.length === 0) return null;
                return (
                  <div style={{
                    marginTop: 24, padding: '20px 24px',
                    background: 'rgba(220, 80, 60, 0.06)',
                    borderLeft: '2px solid rgba(220, 80, 60, 0.5)',
                  }}>
                    <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8, marginBottom: 14 }}>
                      Risques critiques · Top {top.length}
                    </div>
                    {top.map((r, i) => (
                      <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < top.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500 }}>{r.label}</span>
                          <span style={{ fontSize: 11, opacity: 0.7 }}>intensité {r.intensity}/100</span>
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.55, opacity: 0.88 }}>
                          {r.evidence}{r.evidence.length >= 220 ? '…' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Tension dialectique blindspots/contrarian - prose decoupee
                  en paragraphes courts pour respiration visuelle */}
              {result.finalRecommendation?.blindspotsVsContrarian && (
                <div style={{ marginTop: 28, padding: '24px 28px', background: 'rgba(255,255,255,0.06)', borderLeft: '2px solid rgba(255,255,255,0.4)' }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 14 }}>
                    Résolution dialectique · Vigilance vs Singularité
                  </div>
                  <div style={{ display: 'flex', gap: 28, marginBottom: 18 }}>
                    <div>
                      <span style={{ opacity: 0.7, fontSize: 12 }}>Poids vigilance : </span>
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{result.finalRecommendation.blindspotsVsContrarian.blindspotsWeight}</span>
                    </div>
                    <div>
                      <span style={{ opacity: 0.7, fontSize: 12 }}>Poids singularité : </span>
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>{result.finalRecommendation.blindspotsVsContrarian.contrarianWeight}</span>
                    </div>
                  </div>
                  <div className="reco-dialectique-aerated">
                    {splitIntoParagraphs(result.finalRecommendation.blindspotsVsContrarian.resolution, 3).map((p, i) => (
                      <p key={i} className="reco-arg-para">{enrichProse(p)}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Decision drivers */}
              {result.finalRecommendation?.decisionDrivers?.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 10 }}>
                    Facteurs décisifs
                  </div>
                  <ul style={{ paddingLeft: 18, lineHeight: 1.6 }}>
                    {(result.finalRecommendation.decisionDrivers || []).map((d: string, i: number) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              )}

              {result.finalRecommendation?.keyConditions?.length > 0 && (
                <div className="reco-conditions">
                  <h4>Conditions clés</h4>
                  <ul>{(result.finalRecommendation.keyConditions || []).map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}
            </div>

            {/* BANDEAU PASSER EN DD APPROFONDIE (mode dashboard)
                Equivalent du bandeau present dans InvestmentNoteView mais
                visible directement dans le dashboard, juste apres le verdict.
                Sans ce bandeau, le partner qui regarde le dashboard ne voit
                aucun mecanisme pour passer en Bloc 2 et reste bloque sur
                le screening sans savoir comment continuer.
                Conditions d affichage :
                  - Analyse sauvegardee (savedAnalysisId present)
                  - Verdict different de "refuser" (pas de DD sur dossier elimine)
                  - Aucun moteur Bloc 2 deja triggered (sinon les sections
                    Data Room sont deja visibles plus bas)
                  - La zone d upload n est pas deja ouverte (sinon doublon) */}
            {(() => {
              const verdict = result.finalRecommendation?.verdict;
              const hasBloc2Output = !!result.ledgerExtraction
                || !!result.ddFinancial
                || !!result.capTableExtraction
                || !!result.ddContractual
                || !!result.ddTechnical;
              const canDeepen = !!savedAnalysisId
                && verdict
                && verdict !== 'refuser'
                && !hasBloc2Output
                && !ddDeepenOpen;
              if (!canDeepen) return null;
              return (
                <div style={{
                  marginTop: 24,
                  marginBottom: 32,
                  padding: '24px 28px',
                  background: 'linear-gradient(135deg, rgba(192, 138, 63, 0.08) 0%, rgba(192, 138, 63, 0.03) 100%)',
                  borderLeft: '3px solid #c08a3f',
                  borderRadius: 2,
                }}>
                  <div style={{
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--ocre-brule)',
                    fontWeight: 600,
                    marginBottom: 8,
                  }}>
                    Etape suivante
                  </div>
                  <div style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 22,
                    fontWeight: 500,
                    marginBottom: 10,
                    lineHeight: 1.25,
                  }}>
                    Passer en DD approfondie
                  </div>
                  <div style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: 'var(--ink-soft)',
                    marginBottom: 18,
                    maxWidth: 720,
                  }}>
                    {verdict === 'approfondir' && (
                      <>L&apos;instruction Bloc 1 ne tranche pas. Le score positionne le dossier en zone d&apos;instruction approfondie, la DD doit cristalliser l&apos;arbitrage. Demander a la startup les documents data room : grand livre comptable, pacte d&apos;actionnaires, statuts, cap table, contrats clients principaux, dossier technique. La note s&apos;enrichira des cinq audits Bloc 2 sans recalculer le Bloc 1.</>
                    )}
                    {verdict === 'investir avec conditions' && (
                      <>L&apos;instruction Bloc 1 conclut a un go conditionne. La DD doit valider les conditions identifiees plus loin dans la note, en particulier sur la coherence financiere et la structure capitalistique. Demander a la startup les documents data room (grand livre, pacte, statuts, cap table, contrats, dossier technique) avant de formaliser la term sheet.</>
                    )}
                    {verdict === 'investir' && (
                      <>L&apos;instruction Bloc 1 conclut a un go franc. La DD est confirmatoire : valider que les chiffres declares dans le pitch se retrouvent dans le grand livre, que le pacte ne contient pas de clauses bloquantes, que la cap table est propre, et que le dossier technique tient ses promesses. Apres ces verifications, la term sheet peut etre formalisee.</>
                    )}
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setDdDeepenOpen(true);
                      setDdDeepenError(null);
                      if (typeof window !== 'undefined') {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                  >
                    Ouvrir la zone d&apos;upload Data Room &rarr;
                  </button>
                </div>
              );
            })()}

            {/* Dashboard navigation - sidebar sticky desktop, dropdown mobile.
                Les 14 dimensions d analyse sont regroupees en 4 sections
                semantiques pour clarifier la hierarchie de lecture :
                  1. Diagnostic chiffre  : la matiere brute du dossier
                  2. Lecture critique    : confrontation aux corpus de cas
                  3. Lecture dialectique : vigilance critique vs singularite
                  4. Decision            : plan d action et points a instruire */}
            {(() => {
              const tabGroups: Array<{
                label: string;
                tabs: Array<{ id: string; label: string; picto?: import('./components/Picto').PictoName }>;
              }> = [
                {
                  label: 'Diagnostic chiffré',
                  tabs: [
                    { id: 'synthesis',  label: 'Synthèse',            picto: 'sparkle' },
                    { id: 'dimensions', label: 'Dimensions chiffrées', picto: 'concurrence' },
                    { id: 'team',       label: 'Équipe',              picto: 'equipe' },
                    { id: 'verified',   label: 'Données vérifiées',    picto: 'check' },
                    { id: 'market',     label: 'Marché',              picto: 'marche' },
                    { id: 'macro',      label: 'Macro',               picto: 'macro' },
                  ],
                },
                {
                  label: 'Lecture critique',
                  tabs: [
                    { id: 'financial', label: 'Cohérence financière', picto: 'financiers' },
                    { id: 'pattern',   label: 'Pattern matching',     picto: 'concurrence' },
                  ],
                },
                {
                  label: 'Lecture dialectique',
                  tabs: [
                    { id: 'aveuglement', label: 'Vigilance critique',  picto: 'blindspot' },
                    { id: 'singularite', label: 'Singularités', picto: 'sparkle' },
                    { id: 'blindspots',  label: 'Angles morts', picto: 'blindspot' },
                    { id: 'narrative',   label: 'Lecture du langage', picto: 'argumentation' },
                    { id: 'fragility',   label: 'Fragilité structurelle', picto: 'risques' },
                  ],
                },
                {
                  label: 'Décision',
                  tabs: [
                    { id: 'risksplan',   label: 'Risques & Plan',    picto: 'risques' },
                    { id: 'refchecks',   label: 'Reference checks',  picto: 'argumentation' },
                    { id: 'trajectory',  label: 'Trajectoire',       picto: 'sparkle' },
                    { id: 'instruction', label: 'À instruire',       picto: 'instruction' },
                    { id: 'ic-pack',     label: 'Pack IC',           picto: 'pack-ic' },
                  ],
                },
              ];
              const currentGroup = tabGroups.find(g => g.tabs.some(t => t.id === activeTab));

              return (
                <div className="dashboard-grid">
                  {/* SIDEBAR DESKTOP : navigation verticale sticky */}
                  <aside className="dashboard-sidebar" aria-label="Sections d&apos;analyse">
                    {tabGroups.map(group => (
                      <div className="sidebar-group" key={group.label}>
                        <div className="sidebar-group-label">{group.label}</div>
                        {group.tabs.map(t => (
                          <button
                            key={t.id}
                            className={`sidebar-tab ${activeTab === t.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(t.id)}
                            aria-current={activeTab === t.id ? 'page' : undefined}
                          >
                            {t.picto && (
                              <span className="sidebar-tab-picto" aria-hidden="true">
                                <Picto name={t.picto} size={16} strokeWidth={1.5} />
                              </span>
                            )}
                            <span className="sidebar-tab-label">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </aside>

                  {/* CONTENU : panneaux conditionnels */}
                  <div className="dashboard-content">
                    {/* MOBILE NAV : dropdown natif au-dessus du contenu, visible < 1024px */}
                    <div className="dashboard-mobile-nav">
                      <div className="dashboard-mobile-context">
                        {currentGroup?.label || ''}
                      </div>
                      <select
                        className="dashboard-mobile-select"
                        value={activeTab}
                        onChange={(e) => setActiveTab(e.target.value)}
                        aria-label="Naviguer entre les sections d&apos;analyse"
                      >
                        {tabGroups.map(group => (
                          <optgroup key={group.label} label={group.label}>
                            {group.tabs.map(t => (
                              <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    {/* Tab content */}
              {(activeTab === 'synthesis' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  {/* Alerte de desaccord motive : affiche en haut de la
                      synthese quand le moteur d orchestration a estime que
                      son jugement structurel diverge du calcul mecanique
                      deterministe. Le score affiche reste mecanique mais le
                      partner voit l alerte editoriale et peut en tenir compte. */}
                  {result.finalRecommendation?.assessorDisagreement?.present && (
                    <div style={{
                      padding: '14px 18px',
                      marginBottom: 20,
                      background: 'var(--ocre-brule-soft)',
                      borderLeft: '3px solid var(--ocre-brule)',
                    }}>
                      <div style={{
                        fontSize: 11,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--ocre-brule)',
                        marginBottom: 6,
                        fontWeight: 600,
                      }}>
                        Desaccord motive de l&apos;analyste
                      </div>
                      <p style={{ fontSize: 13, margin: '0 0 6px 0', lineHeight: 1.55 }}>
                        Calcul mecanique : <strong>{result.finalRecommendation.assessorDisagreement.mechanicalVerdict}</strong> a {result.finalRecommendation.assessorDisagreement.mechanicalScore}/100. Jugement structurel : <strong>{result.finalRecommendation.assessorDisagreement.llmVerdict}</strong> a {result.finalRecommendation.assessorDisagreement.llmScoreSuggestion}/100. Ecart de {result.finalRecommendation.assessorDisagreement.scoreDelta > 0 ? '+' : ''}{result.finalRecommendation.assessorDisagreement.scoreDelta} points.
                      </p>
                      <p style={{ fontSize: 13, margin: 0, fontStyle: 'italic', lineHeight: 1.55 }}>
                        {result.finalRecommendation.assessorDisagreement.rationale}
                      </p>
                      <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8 }}>
                        Le score affiche reste le calcul mecanique deterministe. Cette alerte est un signal qualitatif a integrer a la decision.
                      </div>
                    </div>
                  )}
                  {/* Bloc visuel : jauge probabilite + radar 6 dimensions */}
                  {(result.finalRecommendation?.successProbability != null || (result.finalRecommendation?.dimensionProbabilities || []).length > 0) && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: 24,
                      marginBottom: 32,
                      padding: '24px 0',
                      borderBottom: '1px solid var(--hairline)',
                      alignItems: 'center',
                    }}>
                      {result.finalRecommendation?.successProbability != null && (
                        <div style={{ textAlign: 'center' }}>
                          <GaugeProbability
                            successProbability={result.finalRecommendation.successProbability}
                            failureProbability={result.finalRecommendation?.failureProbability}
                            size={260}
                          />
                          {result.finalRecommendation?.verdict && (
                            <div style={{
                              marginTop: 4,
                              fontSize: 11,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              opacity: 0.6,
                            }}>
                              Verdict · <strong style={{ fontWeight: 500, opacity: 0.95 }}>{result.finalRecommendation.verdict}</strong>
                            </div>
                          )}
                        </div>
                      )}
                      {(result.finalRecommendation?.dimensionProbabilities || []).length > 0 && (
                        <div>
                          <div style={{
                            fontSize: 10,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            opacity: 0.55,
                            marginBottom: 4,
                            textAlign: 'center',
                          }}>
                            Probabilités par dimension
                          </div>
                          <RadarDimensions
                            dimensions={result.finalRecommendation.dimensionProbabilities}
                            verdict={result.finalRecommendation?.verdict}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="archetype-badge">
                    Archétype dominant · {ARCHETYPE_LABELS[result.patternMatching?.archetypeDominant] || result.patternMatching?.archetypeDominant}
                  </div>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, margin: '0 0 10px' }}>
                    Société identifiée : {result.extraction?.companyName}
                  </h3>
                  <p style={{ marginBottom: 18 }}>
                    {result.extraction?.rawSummary}
                  </p>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500, marginTop: 24, marginBottom: 10 }}>
                    Narratif de retournement causal
                  </h3>
                  <p>{result.causalReversal?.reversalNarrative}</p>
                  <div style={{ marginTop: 24 }}>
                    <div className="kv-grid">
                      <div className="kv-item">
                        <div className="kv-key">Secteur</div>
                        <div className="kv-val">{joinNonEmpty([result.extraction?.sector, result.extraction?.subSector], ' / ')}</div>
                      </div>
                      <div className="kv-item">
                        <div className="kv-key">Géographie</div>
                        <div className="kv-val">{joinNonEmpty([result.extraction?.geographicHub, result.extraction?.country], ', ')}</div>
                      </div>
                      <div className="kv-item">
                        <div className="kv-key">Tour</div>
                        <div className="kv-val">{joinNonEmpty([result.extraction?.fundraise?.stage, result.extraction?.fundraise?.amount], ' · ', 'non renseigné')}</div>
                      </div>
                      <div className="kv-item">
                        <div className="kv-key">Année fondation</div>
                        <div className="kv-val">{result.extraction?.yearFounded && result.extraction.yearFounded > 0 ? result.extraction.yearFounded : 'non renseigné'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(activeTab === 'dimensions' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                    Probabilités de succès par dimension
                  </h3>
                  {/* LEGENDE EXPLICATIVE
                      ----------------------------------------------------------
                      Le partner peut etre dérouté par la coexistence de deux
                      chiffres par carte (Succes en % et Risque sur 100). Sur le
                      PDF Platypus, on lit Equipe Succes 48% Risque 62/100, et
                      48 + 62 ne fait pas 100. La raison : il s agit de deux
                      mesures distinctes que le moteur produit separement,
                      basees sur des cadres differents (probabilite bayesienne
                      de retour positif vs score de risque structurel
                      compose). Sans legende, l ambiguite suggere une erreur
                      de calcul. */}
                  <div style={{
                    marginBottom: 18,
                    padding: '10px 14px',
                    background: 'rgba(29, 28, 26, 0.04)',
                    borderLeft: '2px solid var(--hairline)',
                    fontSize: 12,
                    color: 'var(--ink-soft)',
                    lineHeight: 1.55,
                    fontStyle: 'italic',
                  }}>
                    <strong style={{ fontWeight: 600, fontStyle: 'normal', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-tertiary)' }}>Lecture des deux chiffres</strong>
                    <br />
                    <strong style={{ fontWeight: 600, fontStyle: 'normal' }}>Succès %</strong> : probabilité bayésienne de retour positif sur cette dimension, integre l incertitude residuelle. <strong style={{ fontWeight: 600, fontStyle: 'normal' }}>Risque /100</strong> : score de risque structurel composé sur la dimension, mesure différente. Les deux chiffres ne s additionnent pas a 100 car ils répondent à deux questions distinctes : la probabilité de réussir vs l intensité des facteurs de risque structurels.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    {(result.finalRecommendation?.dimensionProbabilities || [])
                      .filter((dim: any) => dim && typeof dim === 'object')
                      .map((dim: any, i: number) => (
                      <div key={i} style={{ padding: 18, border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>{dim?.dimensionName ?? '—'}</div>
                          <div style={{ fontSize: 11, opacity: 0.6 }}>poids {Math.round((dim?.weight ?? 0) * 100)}%</div>
                        </div>
                        <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                          <div title="Probabilité bayésienne de retour positif sur cette dimension">
                            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Probabilité succès</div>
                            <div style={{ fontSize: 28, fontFamily: 'var(--serif)', fontWeight: 500, lineHeight: 1.1 }}>
                              {dim?.successProbability ?? '—'}<span style={{ fontSize: 14, opacity: 0.6 }}>%</span>
                            </div>
                          </div>
                          <div title="Score composé d intensité des facteurs de risque structurels">
                            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Score risque structurel</div>
                            <div style={{ fontSize: 28, fontFamily: 'var(--serif)', fontWeight: 500, lineHeight: 1.1, opacity: 0.85 }}>
                              {dim?.riskScore ?? '—'}<span style={{ fontSize: 14, opacity: 0.6 }}>/100</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', marginBottom: 12 }}>
                          <div style={{
                            height: '100%',
                            width: `${dim?.successProbability ?? 0}%`,
                            background: (dim?.successProbability ?? 0) >= 65 ? 'var(--ink)' : (dim?.successProbability ?? 0) >= 45 ? '#888' : '#ccc',
                          }} />
                        </div>
                        <div style={{ fontSize: 13, marginBottom: 10, opacity: 0.85 }}>{dim?.rationale ?? ''}</div>
                        {dim.keyDrivers?.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.5, marginBottom: 4 }}>Drivers</div>
                            <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                              {(dim.keyDrivers || []).map((d: string, j: number) => <li key={j}>{d}</li>)}
                            </ul>
                          </div>
                        )}
                        {dim.keyRisks?.length > 0 && (
                          <div>
                            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.5, marginBottom: 4 }}>Risques</div>
                            <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                              {(dim.keyRisks || []).map((r: string, j: number) => <li key={j}>{r}</li>)}
                            </ul>
                          </div>
                        )}
                        {/* Sous-scores composites : seules les dimensions Equipe et
                            Marche sont des composites de plusieurs scores moteur.
                            On les affiche en bas de la carte pour permettre au
                            partner d auditer la formation du score : le 62/100
                            de la carte Equipe est compose de couverture systemique
                            55, anti-fragilite 75, transposition 70, obsession 45. */}
                        {(() => {
                          const breakdown = result.finalRecommendation?.computedScoreBreakdown as any;
                          const mech = breakdown?.mechanicalDimensions;
                          if (!mech) return null;
                          const dimKey = dim?.dimensionName?.toLowerCase().includes('equipe') || dim?.dimensionName?.toLowerCase().includes('équipe')
                            ? 'team'
                            : dim?.dimensionName?.toLowerCase().includes('marche') || dim?.dimensionName?.toLowerCase().includes('marché')
                            ? 'market'
                            : null;
                          if (!dimKey) return null;
                          const sub = mech[dimKey]?.subScores;
                          if (!Array.isArray(sub) || sub.length === 0) return null;
                          return (
                            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dotted var(--hairline)' }}>
                              <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.5, marginBottom: 4 }}>Composition du score</div>
                              <div style={{ fontSize: 11, lineHeight: 1.6, opacity: 0.8 }}>
                                {sub.map((s: any, k: number) => (
                                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{s.name} <span style={{ opacity: 0.5 }}>(poids {Math.round(s.weight * 100)}%)</span></span>
                                    <span style={{ fontFamily: 'var(--serif)' }}>{s.score}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(activeTab === 'financial' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                    Cohérence financière · Sept tests structurés
                  </h3>

                  {(!result.financialCoherence || !result.financialCoherence.hasFinancialData) ? (
                    <div style={{ padding: '20px 24px', background: 'var(--ocre-brule-soft)', border: '1px solid var(--ocre-brule)', marginBottom: 20 }}>
                      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ocre-brule)', marginBottom: 6 }}>Données financières insuffisantes</div>
                      <p style={{ fontSize: 14, margin: 0 }}>
                        Aucun business plan exploitable n'a été fourni avec ce dossier. La cohérence financière ne peut pas être testée en l'état.
                        Demander au fondateur un BP structuré au format Excel ou CSV avant de poursuivre l'instruction.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 20, padding: '14px 18px', background: 'var(--surface)', borderLeft: '3px solid var(--ink)' }}>
                        <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap' }}>
                          <div>
                            <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Score global cohérence </span>
                            <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginLeft: 6 }}>{result.financialCoherence.globalCoherenceScore}/100</span>
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            Source : {result.financialCoherence.dataSource === 'both' ? 'Pitch deck + Business plan' : result.financialCoherence.dataSource === 'bp' ? 'Business plan' : 'Pitch deck uniquement'}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            Tests passés : {Object.values(result.financialCoherence.tests || {}).filter((t: any) => t?.passed).length}/7
                          </div>
                        </div>
                        <p style={{ fontSize: 14, margin: 0 }}>{result.financialCoherence.syntheseCoherence}</p>
                      </div>

                      {result.financialCoherence.alertesCritiques?.length > 0 && (
                        <div style={{ marginBottom: 20, padding: '12px 16px', border: '1px solid var(--ocre-brule)', background: 'var(--ocre-brule-soft)' }}>
                          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, color: 'var(--ocre-brule)' }}>Alertes critiques</div>
                          <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                            {(result.financialCoherence.alertesCritiques || []).map((a: string, i: number) => <li key={i}>{a}</li>)}
                          </ul>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 24 }}>
                        {Object.values(result.financialCoherence.tests || {})
                          .filter((t: any) => t && typeof t === 'object')
                          .map((t: any, i: number) => (
                          <div key={i} style={{
                            padding: 16,
                            border: '1px solid var(--hairline)',
                            background: 'var(--surface)',
                            borderLeft: t?.passed ? '3px solid #3a5a3a' : '3px solid #a04040',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500 }}>
                                {t?.testId} · {t?.testName}
                              </div>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>{t?.score ?? '—'}/100</div>
                            </div>
                            <div style={{ height: 3, background: 'rgba(0,0,0,0.06)', marginBottom: 10 }}>
                              <div style={{
                                height: '100%',
                                width: `${t?.score ?? 0}%`,
                                background: (t?.score ?? 0) >= 70 ? '#3a5a3a' : (t?.score ?? 0) >= 40 ? '#888' : '#a04040',
                              }} />
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
                              <strong style={{ fontWeight: 500 }}>Calcul / observation :</strong> {t.evidence}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
                              <strong style={{ fontWeight: 500 }}>Benchmark :</strong> {t.benchmark}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.75 }}>
                              <strong style={{ fontWeight: 500 }}>Implication :</strong> {t.implication}
                            </div>
                          </div>
                        ))}
                      </div>

                      {result.financialCoherence.recalculsEffectues?.length > 0 && (
                        <div style={{ marginBottom: 24 }}>
                          <h4 style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500, marginBottom: 12 }}>Recalculs effectués</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                            {(result.financialCoherence.recalculsEffectues || []).map((r: any, i: number) => (
                              <div key={i} style={{ padding: 14, border: '1px solid var(--hairline)' }}>
                                <div style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{r.metric}</div>
                                <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
                                  <div>
                                    <div style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Déclaré</div>
                                    <div style={{ fontSize: 14 }}>{r.declaredValue}</div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recalculé</div>
                                    <div style={{ fontSize: 14 }}>{r.recalculatedValue}</div>
                                  </div>
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.8 }}>{r.discrepancy}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.financialCoherence.incoherenceDeckVsBP?.length > 0 && (
                        <div>
                          <h4 style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500, marginBottom: 12 }}>Incohérences entre pitch deck et business plan</h4>
                          <ul style={{ paddingLeft: 18, lineHeight: 1.6, fontSize: 13 }}>
                            {(result.financialCoherence.incoherenceDeckVsBP || []).map((inc: string, i: number) => <li key={i}>{inc}</li>)}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {(activeTab === 'risksplan' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                    Cartographie des risques · Trois axes
                  </h3>
                  <p style={{ fontSize: 13, opacity: 0.8, marginTop: -4, marginBottom: 18 }}>
                    Évaluation préliminaire structurée selon le cadre conseil M&A : risques stratégiques, opérationnels, financiers.
                  </p>

                  {result.blindspotAnalysis?.riskMap ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 32 }}>
                      {[
                        { key: 'strategicRisks', title: 'Risques stratégiques', color: 'var(--accent)' },
                        { key: 'operationalRisks', title: 'Risques opérationnels', color: 'var(--vert-foret)' },
                        { key: 'financialRisks', title: 'Risques financiers', color: 'var(--rouge-anglais)' },
                      ].map(cat => {
                        const risks = result.blindspotAnalysis.riskMap[cat.key] || [];
                        return (
                          <div key={cat.key} style={{ padding: 18, border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                            <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500, marginBottom: 14, paddingBottom: 10, borderBottom: `2px solid ${cat.color}` }}>
                              {cat.title}
                            </div>
                            {risks.length === 0 ? (
                              <div style={{ fontSize: 12, opacity: 0.6, fontStyle: 'italic' }}>Aucun risque identifié dans cette catégorie</div>
                            ) : (
                              <div>
                                {risks.map((r: any, i: number) => {
                                  const sevColor = r.severity === 'critical' ? '#a04040' : r.severity === 'high' ? '#c4a484' : r.severity === 'medium' ? '#888' : '#bbb';
                                  return (
                                    <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < risks.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                                        <div style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 500 }}>{r.title}</div>
                                        <div style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: sevColor, fontWeight: 600 }}>{r.severity}</div>
                                      </div>
                                      <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.5 }}>{r.description}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 32, padding: 16, background: 'var(--surface-deep)', border: '1px solid var(--hairline)' }}>
                      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 6 }}>Pas de cartographie générée</div>
                      <div>Le moteur Vigilance critique n&apos;a pas produit de cartographie pour ce dossier. Les risques détectés sont disponibles dans l&apos;onglet « Vigilance critique » sous forme de patterns (P1 à P10) avec evidence et implication par pattern.</div>
                    </div>
                  )}

                  {result.finalRecommendation?.structuringPlan ? (
                    <>
                      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                        Plan de chantiers de structuration
                      </h3>
                      <p style={{ fontSize: 13, opacity: 0.8, marginTop: -4, marginBottom: 18 }}>
                        Trois horizons d'action structurants si la décision est d'investir avec conditions ou d'approfondir.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                        {[
                          { key: 'shortTerm', title: 'Court terme · 0-3 mois', subtitle: 'Pré-requis et clarté' },
                          { key: 'mediumTerm', title: 'Moyen terme · 3-12 mois', subtitle: 'Structuration & développement' },
                          { key: 'longTerm', title: 'Long terme · 12+ mois', subtitle: 'Maturité & vision groupe' },
                        ].map(horizon => {
                          const actions = result.finalRecommendation.structuringPlan[horizon.key] || [];
                          return (
                            <div key={horizon.key} style={{ padding: 18, border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                              <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>{horizon.title}</div>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--hairline)' }}>
                                {horizon.subtitle}
                              </div>
                              {actions.length === 0 ? (
                                <div style={{ fontSize: 12, opacity: 0.6, fontStyle: 'italic' }}>Aucune action sur cet horizon</div>
                              ) : (
                                <div>
                                  {actions.map((a: any, i: number) => (
                                    <div key={i} style={{ marginBottom: 12 }}>
                                      <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, color: 'var(--ink)', marginBottom: 3 }}>
                                        {a.axis}
                                      </div>
                                      <div style={{ fontSize: 13, lineHeight: 1.5 }}>{a.action}</div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, opacity: 0.6, fontStyle: 'italic' }}>
                      Plan de chantiers non applicable pour ce verdict (réservé aux verdicts "investir avec conditions" et "approfondir").
                    </div>
                  )}
                </div>
              )}

              {(activeTab === 'blindspots' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 14 }}>
                    Sept angles morts du métier VC européen
                  </h3>
                  <div className="blindspots-grid">
                    {Object.entries(result.causalReversal?.blindspotsScores || {})
                      .filter(([, val]: [string, any]) => val && typeof val === 'object')
                      .map(([key, val]: [string, any]) => (
                      <div key={key} className={`bs-card ${val?.alerte ? 'alerte' : ''}`}>
                        {val?.alerte && <span className="bs-alerte-tag">Alerte</span>}
                        <div className="bs-name">{BLINDSPOT_LABELS[key] || key}</div>
                        <div className="bs-score">{val?.score ?? '—'}<span style={{ fontSize: 13, color: 'var(--muted)' }}>/100</span></div>
                        <div className="bs-bar-track">
                          <div className={`bs-bar-fill ${getBarClass(val?.score ?? 0)}`} style={{ width: `${val?.score ?? 0}%` }} />
                        </div>
                        <div className="bs-lecture">{val?.lecture}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(activeTab === 'aveuglement' || printMode) && result.blindspotAnalysis && (
                <div style={{ padding: '28px 32px' }}>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                    Vigilance critique · Dix patterns d'erreur de jugement VC
                  </h3>
                  <div style={{ marginBottom: 20, padding: '14px 18px', background: 'var(--surface)', borderLeft: '3px solid var(--ink)' }}>
                    <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Score global de vigilance </span>
                        <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginLeft: 6 }}>{result.blindspotAnalysis.globalBlindspotScore}/100</span>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Patterns détectés : {Object.values(result.blindspotAnalysis.patterns || {}).filter((p: any) => p?.detected).length}/10
                      </div>
                    </div>
                    <p style={{ fontSize: 14, margin: 0 }}>{result.blindspotAnalysis.syntheseAveuglement}</p>
                  </div>

                  {result.blindspotAnalysis.alertesCritiques?.length > 0 && (
                    <div style={{ marginBottom: 20, padding: '12px 16px', border: '1px solid var(--ocre-brule)', background: 'var(--ocre-brule-soft)' }}>
                      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, color: 'var(--ocre-brule)' }}>Alertes critiques</div>
                      <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                        {(result.blindspotAnalysis.alertesCritiques || []).map((a: string, i: number) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
                    {Object.values(result.blindspotAnalysis.patterns || {}).map((p: any, i: number) => (
                      <div key={i} style={{
                        padding: 16,
                        border: '1px solid var(--hairline)',
                        background: p.detected ? 'var(--surface)' : 'transparent',
                        opacity: p.detected ? 1 : 0.55,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                          <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500 }}>
                            {p.patternId} · {p.patternName}
                          </div>
                          {p.detected && (
                            <div style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>{p.intensity}</div>
                          )}
                        </div>
                        {p.detected ? (
                          <>
                            <div style={{ height: 3, background: 'rgba(0,0,0,0.06)', marginBottom: 10 }}>
                              <div style={{
                                height: '100%',
                                width: `${p.intensity}%`,
                                background: p.intensity >= 70 ? '#a04040' : p.intensity >= 40 ? '#888' : '#bbb',
                              }} />
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
                              <strong style={{ fontWeight: 500 }}>Evidence :</strong> {p.evidence}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.75 }}>
                              <strong style={{ fontWeight: 500 }}>Implication :</strong> {p.implication}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: 11, opacity: 0.6, fontStyle: 'italic' }}>Pattern non détecté</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {result.blindspotAnalysis.patternsHistoriques?.length > 0 && (
                    <div>
                      <h4 style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500, marginBottom: 12 }}>Patterns historiques comparables</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                        {(result.blindspotAnalysis.patternsHistoriques || []).map((c: any, i: number) => (
                          <div key={i} style={{ padding: 14, border: '1px solid var(--hairline)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500 }}>{c.case}</div>
                              <div style={{ fontSize: 11, opacity: 0.6 }}>{c.similarity}%</div>
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {c.outcome === 'failure' ? 'Échec' : c.outcome === 'survival' ? 'Survie' : 'Succès'}
                            </div>
                            <div style={{ fontSize: 12 }}>{c.keyLearning}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(activeTab === 'singularite' || printMode) && result.contrarianAnalysis && (
                <div style={{ padding: '28px 32px' }}>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                    Singularités contrariennes · Dix signaux contrariens à évaluer
                  </h3>
                  <div style={{ marginBottom: 20, padding: '14px 18px', background: 'var(--surface)', borderLeft: '3px solid var(--ink)' }}>
                    <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Score global contrarien </span>
                        <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginLeft: 6 }}>{result.contrarianAnalysis.globalContrarianScore}/100</span>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        Signaux détectés : {Object.values(result.contrarianAnalysis.signals || {}).filter((s: any) => s?.detected).length}/10
                      </div>
                    </div>
                    <p style={{ fontSize: 14, margin: '0 0 10px 0' }}>{result.contrarianAnalysis.syntheseSingularite}</p>
                    {result.contrarianAnalysis.recommandationContrarienne && (
                      <p style={{ fontSize: 13, margin: 0, fontStyle: 'italic', opacity: 0.85 }}>
                        <strong style={{ fontStyle: 'normal' }}>Recommandation contrarienne :</strong> {result.contrarianAnalysis.recommandationContrarienne}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
                    {Object.values(result.contrarianAnalysis.signals || {}).map((s: any, i: number) => (
                      <div key={i} style={{
                        padding: 16,
                        border: '1px solid var(--hairline)',
                        background: s.detected ? 'var(--surface)' : 'transparent',
                        opacity: s.detected ? 1 : 0.55,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                          <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500 }}>
                            {s.signalId} · {s.signalName}
                          </div>
                          {s.detected && (
                            <div style={{ fontFamily: 'var(--serif)', fontSize: 16 }}>{s.strength}</div>
                          )}
                        </div>
                        {s.detected ? (
                          <>
                            <div style={{ height: 3, background: 'rgba(0,0,0,0.06)', marginBottom: 10 }}>
                              <div style={{
                                height: '100%',
                                width: `${s.strength}%`,
                                background: s.strength >= 70 ? '#3a5a3a' : s.strength >= 40 ? '#888' : '#bbb',
                              }} />
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
                              <strong style={{ fontWeight: 500 }}>Evidence :</strong> {s.evidence}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.75 }}>
                              <strong style={{ fontWeight: 500 }}>Implication :</strong> {s.implication}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: 11, opacity: 0.6, fontStyle: 'italic' }}>Signal non détecté</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {result.contrarianAnalysis.comparablesContrariens?.length > 0 && (
                    <div>
                      <h4 style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500, marginBottom: 12 }}>
                        Comparables contrariens · Cas où le consensus s'est trompé
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                        {(result.contrarianAnalysis.comparablesContrariens || []).map((c: any, i: number) => (
                          <div key={i} style={{ padding: 16, border: '1px solid var(--hairline)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>{c.name}</div>
                              <div style={{ fontSize: 11, opacity: 0.6 }}>{c.multipleAtExit}</div>
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {c.sectorContext}
                            </div>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>
                              <strong style={{ fontWeight: 500 }}>Consensus initial :</strong> {c.initialConsensus}
                            </div>
                            <div style={{ fontSize: 12, marginBottom: 6 }}>
                              <strong style={{ fontWeight: 500 }}>Pari contrarien :</strong> {c.contrarianBet}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.85 }}>
                              <strong style={{ fontWeight: 500 }}>Outcome :</strong> {c.outcome}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(activeTab === 'narrative' || printMode) && (() => {
                const ndr = result.narrativeDrift;
                const ndv = result.relevanceMatrix?.verdicts?.narrativeDrift;
                if (!ndr && !ndv) return null;

                // Cas matrice declare none : on rend un encart court
                // pour la transparence du perimetre, sans faux signal.
                if (!ndr && ndv && ndv.applicable === 'none') {
                  return (
                    <div style={{ padding: '28px 32px' }}>
                      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                        Lecture du langage
                      </h3>
                      <div style={{ padding: '14px 18px', background: 'var(--surface)', borderLeft: '3px solid var(--ink)', fontSize: 13, opacity: 0.85 }}>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>Non applicable sur ce dossier</div>
                        <div>{ndv.rationale}</div>
                      </div>
                    </div>
                  );
                }

                // Cas moteur lance mais payload null : incident transitoire.
                if (!ndr) {
                  return (
                    <div style={{ padding: '28px 32px' }}>
                      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                        Lecture du langage
                      </h3>
                      <div style={{ padding: '14px 18px', background: 'var(--surface)', borderLeft: '3px solid var(--ocre-brule, #a04040)', fontSize: 13, opacity: 0.85 }}>
                        Lecture indisponible (incident transitoire). Le moteur etait pourtant retenu par la matrice ({ndv?.rationale?.toLowerCase() || 'verdict applicable'}). Relancer l analyse pour reproduire.
                      </div>
                    </div>
                  );
                }

                // Cas nominal : moteur a produit son analyse.
                const verdictBg: Record<string, { bg: string; ink: string; label: string }> = {
                  'sain': { bg: '#f1ead8', ink: '#3f4a2b', label: 'Sain' },
                  'attention': { bg: '#ede2c8', ink: '#7a5a1d', label: 'Attention' },
                  'alerte': { bg: '#e8d4b1', ink: '#8a4a17', label: 'Alerte' },
                  'drapeau-rouge': { bg: '#dcc3a3', ink: '#7a2916', label: 'Drapeau rouge' },
                };
                const v = verdictBg[ndr.verdict] || verdictBg['attention'];
                const axes: Array<{ key: string; label: string; data: any }> = [
                  { key: 'glissementIndicateurs', label: 'Glissement des indicateurs', data: ndr.glissementIndicateurs },
                  { key: 'opaciteProgressive', label: 'Opacite progressive', data: ndr.opaciteProgressive },
                  { key: 'narrativePremiumCollapse', label: 'Decalage recit / fondamentaux', data: ndr.narrativePremiumCollapse },
                ];

                return (
                  <div style={{ padding: '28px 32px' }}>
                    <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                      Lecture du langage
                    </h3>

                    {/* Bandeau verdict + score, dans la palette ocre. */}
                    <div style={{ marginBottom: 20, padding: '14px 18px', background: v.bg, borderLeft: `3px solid ${v.ink}` }}>
                      <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap' }}>
                        <div>
                          <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, color: v.ink }}>Verdict global </span>
                          <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginLeft: 6, color: v.ink }}>{v.label}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, color: v.ink }}>Score de derive </span>
                          <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginLeft: 6, color: v.ink }}>{ndr.globalDriftScore}/100</span>
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.75, color: v.ink }}>
                          Champ d&apos;application : {ndr.applicabilite === 'full' ? 'complet' : ndr.applicabilite === 'partial' ? 'partiel' : ndr.applicabilite === 'weak-signal' ? 'signal faible' : 'non applicable'}
                        </div>
                      </div>
                      <p style={{ fontSize: 13, margin: 0, fontStyle: 'italic', color: v.ink, opacity: 0.9 }}>
                        {ndr.applicabiliteRationale}
                      </p>
                    </div>

                    {/* Bloc des metriques lexicales, en grand pour lecture editoriale. */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
                      <div style={{ padding: 16, border: '1px solid var(--hairline)' }}>
                        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 6 }}>Densite concrete</div>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500 }}>{ndr.metriquesLexicales.densiteConcrete.toFixed(1)}</div>
                        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>mots concrets / 1000 (sain ≥ 30)</div>
                      </div>
                      <div style={{ padding: 16, border: '1px solid var(--hairline)' }}>
                        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 6 }}>Ratio abstrait/concret</div>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500 }}>{ndr.metriquesLexicales.ratioAbstraitConcret.toFixed(2)}</div>
                        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>sain &lt; 0,3, drapeau rouge &gt; 2</div>
                      </div>
                      <div style={{ padding: 16, border: '1px solid var(--hairline)' }}>
                        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 6 }}>Score d&apos;opacite</div>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500 }}>{ndr.metriquesLexicales.opaciteScore.toFixed(1)}%</div>
                        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>jargon non chiffre</div>
                      </div>
                      <div style={{ padding: 16, border: '1px solid var(--hairline)' }}>
                        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 6 }}>Corpus analyse</div>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500 }}>{ndr.metriquesLexicales.totalWordsAnalyses}</div>
                        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>mots</div>
                      </div>
                    </div>

                    {/* Top abstraits / concrets : observation directe du
                        vocabulaire dominant. Aide le partner a calibrer
                        sa propre lecture du pitch. */}
                    {(ndr.metriquesLexicales.topAbstractWords?.length > 0 || ndr.metriquesLexicales.topConcreteWords?.length > 0) && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
                        {ndr.metriquesLexicales.topAbstractWords?.length > 0 && (
                          <div style={{ padding: 14, border: '1px solid var(--hairline)' }}>
                            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 8 }}>Vocabulaire abstrait dominant</div>
                            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                              {ndr.metriquesLexicales.topAbstractWords.slice(0, 8).map((w: any, i: number) => (
                                <span key={i} style={{ marginRight: 12, opacity: 0.85 }}>
                                  <strong style={{ fontWeight: 500 }}>{w.word}</strong>
                                  <span style={{ opacity: 0.55 }}> ×{w.count}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {ndr.metriquesLexicales.topConcreteWords?.length > 0 && (
                          <div style={{ padding: 14, border: '1px solid var(--hairline)' }}>
                            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 8 }}>Vocabulaire concret dominant</div>
                            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                              {ndr.metriquesLexicales.topConcreteWords.slice(0, 8).map((w: any, i: number) => (
                                <span key={i} style={{ marginRight: 12, opacity: 0.85 }}>
                                  <strong style={{ fontWeight: 500 }}>{w.word}</strong>
                                  <span style={{ opacity: 0.55 }}> ×{w.count}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Trois axes en grille, chacun avec son verdict propre. */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 24 }}>
                      {axes.map((axis) => {
                        const a = axis.data;
                        if (!a) return null;
                        const tone: Record<string, string> = {
                          'sain': '#3f4a2b',
                          'attention': '#7a5a1d',
                          'alerte': '#8a4a17',
                          'drapeau-rouge': '#7a2916',
                          'non-applicable': '#888',
                        };
                        const c = tone[a.verdict] || tone['attention'];
                        return (
                          <div key={axis.key} style={{ padding: 16, border: '1px solid var(--hairline)', borderLeft: `3px solid ${c}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500 }}>{axis.label}</div>
                              <div style={{ fontSize: 11, color: c, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{a.verdict.replace('-', ' ')}</div>
                            </div>
                            {a.verdict !== 'non-applicable' ? (
                              <>
                                <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 8 }}>
                                  Score {a.score}/100 · confiance {a.confidence}/100
                                </div>
                                <p style={{ fontSize: 13, lineHeight: 1.55, marginTop: 0, marginBottom: 10 }}>{a.rationale}</p>
                                {a.evidencePro?.length > 0 && (
                                  <div style={{ fontSize: 12, marginBottom: 6 }}>
                                    <strong style={{ fontWeight: 500, color: c }}>Au charge :</strong> {a.evidencePro.join(' ')}
                                  </div>
                                )}
                                {a.evidenceContra?.length > 0 && (
                                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                                    <strong style={{ fontWeight: 500 }}>Au contraire :</strong> {a.evidenceContra.join(' ')}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div style={{ fontSize: 12, opacity: 0.55, fontStyle: 'italic' }}>{a.rationale || 'Non applicable sur ce dossier.'}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Counter-archetype : situe le dossier dans une trajectoire historique. */}
                    {ndr.counterArchetype?.closest && ndr.counterArchetype.closest !== 'non determine' && (
                      <div style={{ marginBottom: 18, padding: 14, border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 6 }}>Archetype le plus proche</div>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500, marginBottom: 6 }}>
                          {ndr.counterArchetype.closest}
                          <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 8, fontWeight: 400 }}>
                            {ndr.counterArchetype.direction === 'derive-confirmee' ? 'trajectoire de derive confirmee' : 'trajectoire saine'}
                          </span>
                        </div>
                        {ndr.counterArchetype.rationale && (
                          <p style={{ fontSize: 13, margin: 0, opacity: 0.85 }}>{ndr.counterArchetype.rationale}</p>
                        )}
                      </div>
                    )}

                    {/* Trajectoire si baseline anterieur disponible. */}
                    {ndr.trajectory && (
                      <div style={{ marginBottom: 18, padding: 14, border: '1px solid var(--hairline)' }}>
                        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 6 }}>Trajectoire</div>
                        <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                          {ndr.trajectory.interpretation === 'aggravation' ? 'Aggravation' : ndr.trajectory.interpretation === 'amelioration' ? 'Amelioration' : 'Stabilisation'}
                        </div>
                        <p style={{ fontSize: 13, margin: 0, opacity: 0.85 }}>{ndr.trajectory.rationale}</p>
                      </div>
                    )}

                    {/* Recommandation DD encadree. */}
                    {ndr.recommandationDD && (
                      <div style={{ padding: 14, borderLeft: '3px solid var(--ocre, #a8743a)', background: 'rgba(168, 116, 58, 0.06)' }}>
                        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 6 }}>A investiguer</div>
                        <p style={{ fontSize: 13, margin: 0, lineHeight: 1.55 }}>{ndr.recommandationDD}</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {(activeTab === 'fragility' || printMode) && (() => {
                const fsr = result.fragiliteStructurelle;
                const fsv = result.relevanceMatrix?.verdicts?.fragiliteStructurelle;
                if (!fsr && !fsv) return null;

                // Cas matrice tous patterns non applicables
                if (!fsr && fsv && Object.values(fsv).every((v: any) => v.applicable === 'none')) {
                  return (
                    <div style={{ padding: '28px 32px' }}>
                      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                        Fragilite structurelle
                      </h3>
                      <div style={{ padding: '14px 18px', background: 'var(--surface)', borderLeft: '3px solid var(--ink)', fontSize: 13, opacity: 0.85 }}>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>Non applicable sur ce dossier</div>
                        <div>Aucun des sept patterns Phase 4 ne s applique a ce dossier selon la matrice de pertinence (stade et profil sectoriel hors-scope).</div>
                      </div>
                    </div>
                  );
                }

                // Cas moteur lance mais payload null
                if (!fsr) {
                  return (
                    <div style={{ padding: '28px 32px' }}>
                      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                        Fragilite structurelle
                      </h3>
                      <div style={{ padding: '14px 18px', background: 'var(--surface)', borderLeft: '3px solid var(--ocre-brule, #a04040)', fontSize: 13, opacity: 0.85 }}>
                        Lecture indisponible (incident transitoire). Au moins un pattern etait pourtant retenu par la matrice. Relancer l analyse pour reproduire.
                      </div>
                    </div>
                  );
                }

                const verdictBg: Record<string, { bg: string; ink: string; label: string }> = {
                  'sain': { bg: '#f1ead8', ink: '#3f4a2b', label: 'Sain' },
                  'attention': { bg: '#ede2c8', ink: '#7a5a1d', label: 'Attention' },
                  'alerte': { bg: '#e8d4b1', ink: '#8a4a17', label: 'Alerte' },
                  'drapeau-rouge': { bg: '#dcc3a3', ink: '#7a2916', label: 'Drapeau rouge' },
                  'non-applicable': { bg: '#f5f0e3', ink: '#666', label: 'Non applicable' },
                };
                const v = verdictBg[fsr.verdict] || verdictBg['attention'];

                const patternIds = ['growth-subsidized-model', 'infrastructure-hostage', 'fixed-cost-trap', 'regulatory-time-bomb', 'commoditization-drift', 'capital-structure-fragility', 'scale-mirage-risk'] as const;
                const patternLabels: Record<string, string> = {
                  'growth-subsidized-model': 'Croissance subventionnee',
                  'infrastructure-hostage': 'Captivite infrastructure',
                  'fixed-cost-trap': 'Couts fixes incompressibles',
                  'regulatory-time-bomb': 'Risque reglementaire date',
                  'commoditization-drift': 'Erosion de defensibilite',
                  'capital-structure-fragility': 'Fragilite cap table',
                  'scale-mirage-risk': 'Industrialisation prematuree',
                };

                return (
                  <div style={{ padding: '28px 32px' }}>
                    <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                      Fragilite structurelle
                    </h3>

                    {/* Bandeau verdict global */}
                    <div style={{ marginBottom: 20, padding: '14px 18px', background: v.bg, borderLeft: `3px solid ${v.ink}` }}>
                      <div style={{ display: 'flex', gap: 24, alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap' }}>
                        <div>
                          <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, color: v.ink }}>Verdict global </span>
                          <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginLeft: 6, color: v.ink }}>{v.label}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, color: v.ink }}>Score de fragilite </span>
                          <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, marginLeft: 6, color: v.ink }}>{fsr.globalFragilityScore}/100</span>
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.75, color: v.ink }}>
                          {Object.values(fsr.patterns).filter((p: any) => p && p.applicabilite !== 'not-applicable').length} patterns sur 7 actifs
                        </div>
                      </div>
                      <p style={{ fontSize: 13, margin: 0, fontStyle: 'italic', color: v.ink, opacity: 0.9 }}>
                        {fsr.resumeEditorial}
                      </p>
                    </div>

                    {/* Combinaisons diagnostiques */}
                    {fsr.combinaisons && fsr.combinaisons.length > 0 && (
                      <div style={{ marginBottom: 20, padding: 14, borderLeft: '3px solid var(--ocre-brule, #8a4a17)', background: 'rgba(138, 74, 23, 0.06)' }}>
                        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 10, color: 'var(--ocre-brule, #8a4a17)', fontWeight: 600 }}>
                          Combinaisons diagnostiques detectees
                        </div>
                        {fsr.combinaisons.map((comb: any, i: number) => (
                          <div key={i} style={{ marginBottom: i < fsr.combinaisons.length - 1 ? 12 : 0 }}>
                            <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                              {comb.nom}
                              <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.7, fontWeight: 400, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {comb.severite.replace('-', ' ')}
                              </span>
                            </div>
                            <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, opacity: 0.9 }}>{comb.rationale}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Cartes des sept patterns en grille */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 24 }}>
                      {patternIds.map((patternId) => {
                        const p = fsr.patterns?.[patternId];
                        const label = patternLabels[patternId] ?? patternId;

                        if (!p || p.applicabilite === 'not-applicable') {
                          return (
                            <div key={patternId} style={{ padding: 14, border: '1px dashed var(--hairline)', opacity: 0.55 }}>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{label}</div>
                              <div style={{ fontSize: 12, fontStyle: 'italic' }}>{p?.applicabiliteRationale || 'Non applicable sur ce dossier.'}</div>
                            </div>
                          );
                        }

                        const tone: Record<string, string> = {
                          'sain': '#3f4a2b',
                          'attention': '#7a5a1d',
                          'alerte': '#8a4a17',
                          'drapeau-rouge': '#7a2916',
                        };
                        const c = tone[p.verdict] || '#3f4a2b';

                        return (
                          <div key={patternId} style={{ padding: 16, border: '1px solid var(--hairline)', borderLeft: `3px solid ${c}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500 }}>{label}</div>
                              <div style={{ fontSize: 11, color: c, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.verdict.replace('-', ' ')}</div>
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 8 }}>
                              Score {p.globalScore}/100
                            </div>
                            {p.resumeEditorial && (
                              <p style={{ fontSize: 13, lineHeight: 1.55, marginTop: 0, marginBottom: 8 }}>{p.resumeEditorial}</p>
                            )}
                            {p.counterArchetype?.closest && p.counterArchetype.closest !== 'non determine' && (
                              <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.85 }}>
                                <strong style={{ fontWeight: 500 }}>Archetype proche :</strong> {p.counterArchetype.closest}
                                <span style={{ opacity: 0.7, marginLeft: 4 }}>
                                  ({p.counterArchetype.direction === 'derive-confirmee' ? 'derive confirmee' : 'trajectoire saine'})
                                </span>
                              </div>
                            )}
                            {p.recommandationDD && (
                              <div style={{ fontSize: 12, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--hairline)', opacity: 0.85 }}>
                                <strong style={{ fontWeight: 500 }}>DD :</strong> {p.recommandationDD}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Recommandations DD consolidees */}
                    {fsr.recommandationsDD && fsr.recommandationsDD.length > 0 && (
                      <div style={{ padding: 14, borderLeft: '3px solid var(--ocre, #a8743a)', background: 'rgba(168, 116, 58, 0.06)' }}>
                        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 10, fontWeight: 600 }}>A investiguer en DD</div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
                          {fsr.recommandationsDD.map((reco: string, i: number) => (
                            <li key={i} style={{ marginBottom: 4 }}>{reco}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}

              {(activeTab === 'trajectory' || printMode) && savedAnalysisId && (
                <TrajectoryView analysisId={savedAnalysisId} />
              )}

              {(activeTab === 'team' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  {(() => {
                    // Helper : affiche le score s il est defini, sinon
                    // un message lisible "Donnees insuffisantes". Evite
                    // l affichage "/100" sans chiffre devant qui s est
                    // produit en prod sur des dossiers ou le moteur Team
                    // n a pas reussi a extraire les 4 axes (parse JSON
                    // partiel ou input deck trop pauvre).
                    const renderTeamScore = (label: string, score: number | undefined | null) => (
                      <div className="kv-item">
                        <div className="kv-key">{label}</div>
                        {typeof score === 'number' ? (
                          <div className="kv-val serif">{score}/100</div>
                        ) : (
                          <div
                            className="kv-val"
                            style={{
                              fontStyle: 'italic',
                              color: 'var(--ink-tertiary)',
                              fontSize: 13,
                              fontFamily: 'inherit',
                            }}
                            title="Le moteur Équipe n&apos;a pas pu produire ce score. Verifier que le pitch deck contient une section equipe exploitable."
                          >
                            Donnees insuffisantes
                          </div>
                        )}
                      </div>
                    );
                    return (
                      <div className="kv-grid" style={{ marginBottom: 22 }}>
                        {renderTeamScore('Couverture systémique', result.team?.systemicCoverage?.score)}
                        {renderTeamScore('Anti-fragilité collective', result.team?.collectiveAntiFragility?.score)}
                        {renderTeamScore('Transposition d\'expérience', result.team?.experienceTransposition?.score)}
                        {renderTeamScore('Obsession produit', result.team?.founderObsession?.score)}
                      </div>
                    );
                  })()}

                  <h3>Couverture systémique de l'équipe</h3>
                  <p>{result.team?.systemicCoverage?.rationale}</p>
                  {result.team?.systemicCoverage?.gaps?.length > 0 && (
                    <p style={{ marginTop: 6 }}><strong>Gaps identifiés :</strong> {result.team.systemicCoverage.gaps.join(' · ')}</p>
                  )}

                  <h3>Anti-fragilité collective</h3>
                  <p>{result.team?.collectiveAntiFragility?.rationale}</p>

                  <h3>Transposition d'expérience</h3>
                  <p>{result.team?.experienceTransposition?.rationale}</p>
                  {result.team?.experienceTransposition?.analogousSectors?.length > 0 && (
                    <p style={{ marginTop: 6 }}><strong>Secteurs analogues :</strong> {result.team.experienceTransposition.analogousSectors.join(' · ')}</p>
                  )}

                  <div className="flags-row">
                    <div className="flag-col green">
                      <div className="flag-title green">Green flags</div>
                      <ul className="flag-list">
                        {(result.team?.greenFlags || []).map((f: string, i: number) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                    <div className="flag-col red">
                      <div className="flag-title red">Red flags</div>
                      <ul className="flag-list">
                        {(result.team?.redFlags || []).map((f: string, i: number) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                  </div>

                  {result.team?.founderMarketFit?.length > 0 && (
                    <>
                      <h3 style={{ marginTop: 32 }}>Founder-Market Fit · Évaluation par fondateur</h3>
                      <p style={{ fontSize: 13, opacity: 0.8, marginTop: -6, marginBottom: 6 }}>
                        Cadre Eisenmann (2020). Pour chaque fondateur : trajectoire, signaux positifs, gaps, expertise tacite asymétrique, expériences transposables.
                      </p>
                      {/* GLOSSAIRE EISENMANN
                          ----------------------------------------------------------
                          La litterature Eisenmann (HBS, Why Startups Fail 2021)
                          utilise les termes Y-intercept et Slope dans l evaluation
                          du founder-market fit. Sans definition, le partner peut
                          rater la finesse de l analyse. Y-intercept = niveau
                          de depart (pedigree, network, capital intellectuel a
                          l instant zero). Slope = vitesse d apprentissage et
                          d execution dans le temps. Un fondateur peut avoir un
                          Y-intercept faible (pas de pedigree startup) mais un
                          Slope exceptionnel (trajectoire d apprentissage et
                          d execution forte sur 10 ans), ce qui est typiquement
                          le profil contrarien (Bertrand, etc.). */}
                      <div style={{
                        marginBottom: 18,
                        padding: '8px 14px',
                        background: 'rgba(29, 28, 26, 0.04)',
                        borderLeft: '2px solid var(--hairline)',
                        fontSize: 11.5,
                        color: 'var(--ink-soft)',
                        lineHeight: 1.55,
                        fontStyle: 'italic',
                      }}>
                        <strong style={{ fontWeight: 600, fontStyle: 'normal' }}>Y-intercept</strong> : niveau de départ du fondateur (pedigree, network, capital intellectuel a l instant zéro). <strong style={{ fontWeight: 600, fontStyle: 'normal' }}>Slope</strong> : vitesse d apprentissage et d exécution dans le temps. Un Y-intercept faible compensé par un Slope exceptionnel est typiquement le profil contrarien (trajectoire silencieuse longue, expertise accumulée sans pedigree startup).
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
                        {(result.team.founderMarketFit || []).map((f: any, i: number) => (
                          <div key={i} style={{ padding: 18, border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500 }}>{f.name}</div>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500 }}>{f.overallFitScore}<span style={{ fontSize: 12, opacity: 0.6 }}>/100</span></div>
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.role}</div>
                            <div style={{ height: 3, background: 'rgba(0,0,0,0.06)', marginBottom: 14 }}>
                              <div style={{
                                height: '100%',
                                width: `${f.overallFitScore}%`,
                                background: f.overallFitScore >= 70 ? '#3a5a3a' : f.overallFitScore >= 45 ? '#888' : '#a04040',
                              }} />
                            </div>
                            <div style={{ fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>{f.trajectorySummary}</div>

                            {f.tacitExpertise && (
                              <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(0,0,0,0.03)', fontSize: 12 }}>
                                <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>Expertise tacite asymétrique</div>
                                <div>{f.tacitExpertise}</div>
                              </div>
                            )}

                            {f.fitSignals?.length > 0 && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4, color: 'var(--vert-foret)' }}>Signaux positifs</div>
                                <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                                  {(f.fitSignals || []).map((s: string, j: number) => <li key={j}>{s}</li>)}
                                </ul>
                              </div>
                            )}

                            {f.fitGaps?.length > 0 && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4, color: 'var(--rouge-anglais)' }}>Gaps identifiés</div>
                                <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                                  {(f.fitGaps || []).map((g: string, j: number) => <li key={j}>{g}</li>)}
                                </ul>
                              </div>
                            )}

                            {f.transposedExperiences?.length > 0 && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>Expériences transposables</div>
                                <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                                  {(f.transposedExperiences || []).map((e: string, j: number) => <li key={j}>{e}</li>)}
                                </ul>
                              </div>
                            )}

                            {f.redFlagsForRole?.length > 0 && (
                              <div>
                                <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4, color: 'var(--rouge-anglais)' }}>Red flags pour le rôle</div>
                                <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                                  {(f.redFlagsForRole || []).map((r: string, j: number) => <li key={j}>{r}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {(activeTab === 'verified' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                    Données vérifiées par sources publiques
                  </h3>
                  <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 22 }}>
                    Le moteur d'équipe interroge OpenAlex, GitHub, Wikipedia et arXiv en temps réel pour confronter
                    les données déclarées par le pitch deck à des faits vérifiables. Les chiffres ci-dessous proviennent
                    directement de ces sources, ils ne sont pas générés par IA.
                  </p>

                  {(result.team?.realData || []).length === 0 && (
                    <p style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                      Aucune donnée vérifiée récupérée pour cette analyse.
                    </p>
                  )}

                  {(result.team?.realData || []).map((rd: any, i: number) => (
                    <div key={i} style={{ marginBottom: 28, paddingBottom: 22, borderBottom: '1px solid var(--hairline)' }}>
                      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 500, marginBottom: 6 }}>
                        ● {rd.name}
                      </h3>
                      <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 12 }}>
                        Sources interrogées : {rd.sourcesQueried.join(', ')} ·
                        {' '}Sources avec résultats : <strong>{rd.sourcesFound.length > 0 ? rd.sourcesFound.join(', ') : 'aucune'}</strong>
                      </p>

                      <div className="kv-grid" style={{ marginBottom: 14 }}>
                        {(() => {
                          const apl = rd.scoresApplicability;
                          // Critere "donnees insuffisantes" : aucune source ne
                          // retourne de resultat ET les 4 scores sont a zero.
                          // Dans ce cas, on n affiche pas 0/100 (qui suggere un
                          // jugement negatif) mais un libelle neutre. C est la
                          // distinction entre :
                          //   - applicable=false : la source n est pas pertinente
                          //     pour ce profil (ex: OpenAlex pour un commercial)
                          //   - donnees insuffisantes : la source pourrait etre
                          //     pertinente mais n a rien retourne (ex: profil
                          //     trop discret, homonymie non levee, etc.)
                          const noSourceData = (rd.sourcesFound?.length || 0) === 0;
                          const allScoresZero = !rd.objectiveScores?.scientific_signature
                            && !rd.objectiveScores?.technical_signature
                            && !rd.objectiveScores?.public_presence
                            && !rd.objectiveScores?.recent_activity;
                          const insufficientData = noSourceData && allScoresZero;

                          // Helper : rend le score si applicable et sourcable.
                          const renderScore = (
                            label: string,
                            value: number | undefined,
                            applicable: boolean | undefined,
                          ) => {
                            const isApplicable = applicable !== false;
                            // Cas 1 : source non pertinente pour le profil
                            if (!isApplicable) {
                              return (
                                <div className="kv-item">
                                  <div className="kv-key">{label}</div>
                                  <div
                                    className="kv-val"
                                    style={{
                                      fontStyle: 'italic',
                                      color: 'var(--ink-tertiary)',
                                      fontSize: 13,
                                      fontFamily: 'inherit',
                                    }}
                                    title={apl?.rationale || 'Source non pertinente pour ce profil de fondateur'}
                                  >
                                    Non applicable
                                  </div>
                                </div>
                              );
                            }
                            // Cas 2 : applicable mais aucune donnee disponible
                            if (insufficientData) {
                              return (
                                <div className="kv-item">
                                  <div className="kv-key">{label}</div>
                                  <div
                                    className="kv-val"
                                    style={{
                                      fontStyle: 'italic',
                                      color: 'var(--ink-tertiary)',
                                      fontSize: 13,
                                      fontFamily: 'inherit',
                                    }}
                                    title="Aucune donnee disponible. Les sources interrogees n ont retourne aucun resultat exploitable."
                                  >
                                    Donnees insuffisantes
                                  </div>
                                </div>
                              );
                            }
                            // Cas 3 : score normal
                            return (
                              <div className="kv-item">
                                <div className="kv-key">{label}</div>
                                <div className="kv-val serif">{value || 0}/100</div>
                              </div>
                            );
                          };
                          return (
                            <>
                              {renderScore('Score scientifique (objectif)', rd.objectiveScores?.scientific_signature, apl?.scientific_applicable)}
                              {renderScore('Score technique (objectif)', rd.objectiveScores?.technical_signature, apl?.technical_applicable)}
                              {renderScore('Présence publique', rd.objectiveScores?.public_presence, apl?.public_applicable)}
                              {renderScore('Activité récente', rd.objectiveScores?.recent_activity, apl?.recent_applicable)}
                            </>
                          );
                        })()}
                      </div>

                      {/* Bandeau "donnees insuffisantes" : visible quand
                          aucune source n a retourne de resultat. Distinct
                          du bandeau "Calibration des sources" qui parle de
                          la pertinence. Ici le message est differente :
                          les sources etaient potentiellement utiles mais
                          le profil est trop discret pour qu on puisse
                          conclure quoi que ce soit. Le partner doit faire
                          ses propres recherches presse / LinkedIn avant
                          de s appuyer sur cette section. */}
                      {(rd.sourcesFound?.length || 0) === 0
                        && !rd.objectiveScores?.scientific_signature
                        && !rd.objectiveScores?.technical_signature
                        && !rd.objectiveScores?.public_presence
                        && !rd.objectiveScores?.recent_activity && (
                        <div style={{
                          marginTop: -4,
                          marginBottom: 14,
                          padding: '10px 14px',
                          background: 'rgba(192, 138, 63, 0.08)',
                          borderLeft: '3px solid #c08a3f',
                          fontSize: 12,
                          color: 'var(--ink)',
                          lineHeight: 1.5,
                        }}>
                          <strong style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.1em', color: 'var(--ocre-brule)' }}>Donnees insuffisantes</strong>
                          <br />
                          Les sources publiques interrogees n ont retourne aucune information exploitable sur ce profil. Cela ne signifie pas que le fondateur manque de credibilite : cela signifie que les outils de scan automatique (OpenAlex, GitHub, Wikipedia, arXiv) ne sont pas adaptes a son parcours, ou que sa presence digitale est volontairement discrete. Verifier manuellement via LinkedIn, presse business (Les Echos, Forbes France, Sifted), interviews, conferences, et reseau professionnel avant de conclure.
                        </div>
                      )}

                      {rd.scoresApplicability && rd.profileType && rd.profileType !== 'unknown' && (
                        <div style={{
                          marginTop: -4,
                          marginBottom: 14,
                          padding: '8px 12px',
                          background: 'rgba(29, 28, 26, 0.04)',
                          borderLeft: '2px solid var(--hairline)',
                          fontSize: 12,
                          fontStyle: 'italic',
                          color: 'var(--ink-soft)',
                          lineHeight: 1.5,
                        }}>
                          <strong style={{ fontWeight: 600, fontStyle: 'normal', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-tertiary)' }}>Calibration des sources</strong>
                          <br />
                          {rd.scoresApplicability.rationale}
                        </div>
                      )}

                      {rd.openalex && (
                        <div style={{ padding: '12px 16px', background: 'var(--paper)', border: '1px solid var(--hairline)', marginBottom: 10 }}>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 6 }}>OpenAlex (publications académiques)</div>
                          <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                            <strong>{rd.verifiableFacts.openalex_pubs}</strong> publications · h-index <strong>{rd.verifiableFacts.openalex_h_index}</strong> · <strong>{rd.verifiableFacts.openalex_citations.toLocaleString()}</strong> citations<br />
                            Institution(s) : {rd.verifiableFacts.openalex_institutions.join(' / ') || 'non renseigné'}
                          </div>
                          {rd.recentPublications && rd.recentPublications.length > 0 && (
                            <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-soft)' }}>
                              <div style={{ fontWeight: 500, marginBottom: 4 }}>Publications récentes :</div>
                              {rd.recentPublications.map((p: any, j: number) => (
                                <div key={j} style={{ paddingLeft: 12, position: 'relative', marginBottom: 3 }}>
                                  <span style={{ position: 'absolute', left: 0 }}>·</span>
                                  {p.title} ({p.year}, {p.cited_by} cit.)
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {rd.github && (
                        <div style={{ padding: '12px 16px', background: 'var(--paper)', border: '1px solid var(--hairline)', marginBottom: 10 }}>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 6 }}>GitHub (présence technique)</div>
                          <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                            <strong>@{rd.verifiableFacts.github_login}</strong> · <strong>{rd.verifiableFacts.github_followers.toLocaleString()}</strong> followers · <strong>{rd.verifiableFacts.github_repos}</strong> repos publics
                            {rd.github.bio && <><br/><em>"{rd.github.bio}"</em></>}
                          </div>
                          {rd.topRepos && rd.topRepos.length > 0 && (
                            <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--ink-soft)' }}>
                              <div style={{ fontWeight: 500, marginBottom: 4 }}>Top repos :</div>
                              {rd.topRepos.map((r: any, j: number) => (
                                <div key={j} style={{ paddingLeft: 12, position: 'relative', marginBottom: 3 }}>
                                  <span style={{ position: 'absolute', left: 0 }}>·</span>
                                  <strong>{r.name}</strong> ({r.stars.toLocaleString()}★, {r.language || '?'})
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {rd.wikipedia && (
                        <div style={{ padding: '12px 16px', background: 'var(--paper)', border: '1px solid var(--hairline)', marginBottom: 10 }}>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 6 }}>Wikipedia ({rd.wikipedia.lang})</div>
                          <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 4 }}>{rd.wikipedia.title}</div>
                          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                            {rd.wikipedia.extract.slice(0, 300)}...
                          </div>
                        </div>
                      )}

                      {rd.arxivRecent && rd.arxivRecent.length > 0 && (
                        <div style={{ padding: '12px 16px', background: 'var(--paper)', border: '1px solid var(--hairline)' }}>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 6 }}>arXiv (preprints récents)</div>
                          {rd.arxivRecent.map((p: any, j: number) => (
                            <div key={j} style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 4, paddingLeft: 12, position: 'relative', lineHeight: 1.5 }}>
                              <span style={{ position: 'absolute', left: 0 }}>·</span>
                              {p.title.slice(0, 100)} ({p.published})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {result.team?.declaredVsVerified && (
                    <div style={{ marginTop: 22 }}>
                      <h3 style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500, marginBottom: 10 }}>
                        Croisement déclaré vs vérifié
                      </h3>
                      <div className="kv-item" style={{ marginBottom: 14 }}>
                        <div className="kv-key">Score d'alignement déclaré/vérifié</div>
                        <div className="kv-val serif">{result.team.declaredVsVerified.alignmentScore}/100</div>
                      </div>
                      {result.team.declaredVsVerified.verifiedClaims?.length > 0 && (
                        <div className="flag-col green" style={{ marginBottom: 10 }}>
                          <div className="flag-title green">Affirmations vérifiées</div>
                          <ul className="flag-list">
                            {result.team.declaredVsVerified.verifiedClaims.map((c: string, i: number) => <li key={i}>{c}</li>)}
                          </ul>
                        </div>
                      )}
                      {result.team.declaredVsVerified.unverifiableClaims?.length > 0 && (
                        <div style={{ padding: '14px 16px', background: 'rgba(140, 109, 44, 0.04)', borderLeft: '3px solid var(--signal)', marginBottom: 10 }}>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--signal)', marginBottom: 8, fontWeight: 500 }}>Non vérifiables</div>
                          <ul className="flag-list">
                            {result.team.declaredVsVerified.unverifiableClaims.map((c: string, i: number) => <li key={i}>{c}</li>)}
                          </ul>
                        </div>
                      )}
                      {result.team.declaredVsVerified.discrepancies?.length > 0 && (
                        <div className="flag-col red">
                          <div className="flag-title red">Écarts identifiés</div>
                          <ul className="flag-list">
                            {result.team.declaredVsVerified.discrepancies.map((c: string, i: number) => <li key={i}>{c}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {(activeTab === 'market' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <div className="kv-grid" style={{ marginBottom: 22 }}>
                    <div className="kv-item">
                      <div className="kv-key">Taille perçue</div>
                      <div className="kv-val serif" style={{ textTransform: 'capitalize' }}>{result.market?.perceivedSize || '—'}</div>
                    </div>
                    <div className="kv-item">
                      <div className="kv-key">Intensité réelle</div>
                      <div className="kv-val serif" style={{ textTransform: 'capitalize' }}>{result.market?.realIntensity || '—'}</div>
                    </div>
                    <div className="kv-item">
                      <div className="kv-key">Saturation</div>
                      <div className="kv-val serif" style={{ textTransform: 'capitalize' }}>{result.market?.saturation || '—'}</div>
                    </div>
                    <div className="kv-item">
                      <div className="kv-key">Défensibilité</div>
                      <div className="kv-val serif">{typeof result.market?.defensibility?.score === 'number' ? `${result.market.defensibility.score}/100` : '—'}</div>
                    </div>
                  </div>

                  {result.market?.needIntensity?.rationale && (
                    <>
                      <h3>Intensité du besoin</h3>
                      <p>{result.market.needIntensity.rationale}</p>
                      {result.market.needIntensity.gap && (
                        <p style={{ marginTop: 6 }}><strong>Gap :</strong> {result.market.needIntensity.gap}</p>
                      )}
                    </>
                  )}

                  {(result.market?.organicSignals?.rationale || typeof result.market?.organicSignals?.score === 'number') && (
                    <>
                      <h3>Signaux organiques</h3>
                      {result.market.organicSignals.rationale && <p>{result.market.organicSignals.rationale}</p>}
                      {typeof result.market.organicSignals.score === 'number' && (
                        <p><strong>Score :</strong> {result.market.organicSignals.score}/100</p>
                      )}
                    </>
                  )}

                  {((result.market?.defensibility?.moats || []).length > 0 || (result.market?.defensibility?.vulnerabilities || []).length > 0) && (
                    <>
                      <h3>Défensibilité</h3>
                      <div className="flags-row">
                        {(result.market?.defensibility?.moats || []).length > 0 && (
                          <div className="flag-col green">
                            <div className="flag-title green">Moats</div>
                            <ul className="flag-list">
                              {(result.market?.defensibility?.moats || []).map((m: string, i: number) => <li key={i}>{m}</li>)}
                            </ul>
                          </div>
                        )}
                        {(result.market?.defensibility?.vulnerabilities || []).length > 0 && (
                          <div className="flag-col red">
                            <div className="flag-title red">Vulnérabilités</div>
                            <ul className="flag-list">
                              {(result.market?.defensibility?.vulnerabilities || []).map((v: string, i: number) => <li key={i}>{v}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {(result.market?.internationalBenchmarks || []).length > 0 && (
                    <>
                      <h3>Comparables internationaux</h3>
                      {(result.market?.internationalBenchmarks || []).map((b: any, i: number) => (
                        <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--hairline)' }}>
                          <strong>{b.name}</strong> · {b.geography} · {b.relevance}
                        </div>
                      ))}
                    </>
                  )}

                  {result.market?.competitiveMatrix?.dimensions?.length > 0 && (
                    <>
                      <h3 style={{ marginTop: 32 }}>Matrice concurrentielle</h3>
                      <p style={{ fontSize: 13, opacity: 0.8, marginTop: -6, marginBottom: 14 }}>
                        Évaluation binaire de la couverture fonctionnelle de la société analysée vs ses concurrents directs sur les dimensions critiques du secteur.
                      </p>
                      <div style={{ marginBottom: 16 }}>
                        <CompetitiveMatrix
                          dimensions={result.market.competitiveMatrix.dimensions || []}
                          players={result.market.competitiveMatrix.players || []}
                          differentiationScore={result.market.competitiveMatrix.differentiationScore}
                        />
                      </div>
                      <div style={{ padding: '14px 16px', background: 'var(--surface)', borderLeft: '3px solid var(--ink)', marginBottom: 8 }}>
                        <p style={{ fontSize: 13, margin: 0 }}>{result.market.competitiveMatrix.differentiationRationale}</p>
                      </div>
                    </>
                  )}

                  {result.market?.competitiveDynamic && (
                    <>
                      <h3 style={{ marginTop: 32 }}>Dynamique compétitive</h3>
                      <p>{result.market.competitiveDynamic}</p>
                    </>
                  )}
                </div>
              )}

              {(activeTab === 'macro' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  {/* Si tous les champs macro sont vides ou null, afficher un
                      message unique plutot que des en-tetes vides. Le moteur
                      Macro peut renvoyer des champs null si les sources de
                      donnees manquent ou si la dimension n est pas pertinente
                      pour le dossier. Mieux vaut signaler honnetement que
                      l information n est pas disponible que d afficher des
                      blocs vides qui font cosmetiquement faiblir la note. */}
                  {(() => {
                    const macro = result.macro || {};
                    const hasCycle = !!macro.cyclePosition;
                    const hasVc = !!macro.vcCapitalOnSegment;
                    const hasRate = !!macro.interestRateRegime;
                    const hasGeo = !!macro.geopolitics;
                    const hasTiming = !!macro.criticalTimingWindow?.rationale || macro.criticalTimingWindow?.exists != null;
                    const hasContraryc = !!macro.contraryclicalOpportunity?.rationale || typeof macro.contraryclicalOpportunity?.score === 'number';
                    const hasTrends = (macro.structuralTrends || []).length > 0;
                    const hasReg = !!macro.regulatoryEnvironment;
                    const hasCycleD = !!macro.demandCycle;
                    const anyFilled = hasCycle || hasVc || hasRate || hasGeo || hasTiming || hasContraryc || hasTrends || hasReg || hasCycleD;
                    if (!anyFilled) {
                      return (
                        <div style={{
                          padding: '20px 24px',
                          background: 'rgba(29, 28, 26, 0.04)',
                          borderLeft: '3px solid var(--hairline)',
                          fontSize: 13.5,
                          fontStyle: 'italic',
                          color: 'var(--ink-soft)',
                          lineHeight: 1.6,
                        }}>
                          Analyse macro non concluante pour ce dossier. Les sources interrogees n ont pas produit de signal sur le cycle, le capital VC, la geopolitique ou les tendances structurelles applicables. Pour completer cette dimension : verifier le contexte sectoriel via un brief macro externe (Atomico SoET, PitchBook, Bain Global Private Equity Report).
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {(result.macro?.cyclePosition || result.macro?.vcCapitalOnSegment) && (
                    <div className="kv-grid" style={{ marginBottom: 16 }}>
                      {result.macro?.cyclePosition && (
                        <div className="kv-item">
                          <div className="kv-key">Position cycle</div>
                          <div className="kv-val">{result.macro.cyclePosition}</div>
                        </div>
                      )}
                      {result.macro?.vcCapitalOnSegment && (
                        <div className="kv-item">
                          <div className="kv-key">Capital VC sur segment</div>
                          <div className="kv-val">{result.macro.vcCapitalOnSegment}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* interestRateRegime et geopolitics sont des phrases longues
                      generees par le LLM (cf macro-engine prompt). Les rendre
                      en kv-grid produit un layout casse en PDF : le label
                      apparait sur une page et la valeur sur la suivante,
                      donnant l impression d un orphelin. On les sort donc en
                      sous-rubriques avec h4 + paragraphe, qui paginent
                      proprement. */}
                  {result.macro?.interestRateRegime && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{
                        fontSize: 10.5,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: 'var(--muted)',
                        marginBottom: 4,
                      }}>Régime de taux</div>
                      <p style={{ margin: 0 }}>{result.macro.interestRateRegime}</p>
                    </div>
                  )}
                  {result.macro?.geopolitics && (
                    <div style={{ marginBottom: 22 }}>
                      <div style={{
                        fontSize: 10.5,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: 'var(--muted)',
                        marginBottom: 4,
                      }}>Géopolitique</div>
                      <p style={{ margin: 0 }}>{result.macro.geopolitics}</p>
                    </div>
                  )}

                  {(result.macro?.criticalTimingWindow?.rationale || result.macro?.criticalTimingWindow?.exists != null) && (
                    <>
                      <h3>Fenêtre temporelle critique</h3>
                      <p><strong>{result.macro?.criticalTimingWindow?.exists ? 'OUI' : 'Non'}</strong>
                        {result.macro?.criticalTimingWindow?.horizon && ` · Horizon : ${result.macro.criticalTimingWindow.horizon}`}</p>
                      {result.macro?.criticalTimingWindow?.rationale && (
                        <p>{result.macro.criticalTimingWindow.rationale}</p>
                      )}
                    </>
                  )}

                  {(result.macro?.contraryclicalOpportunity?.rationale || typeof result.macro?.contraryclicalOpportunity?.score === 'number') && (
                    <>
                      <h3>Opportunité contracyclique</h3>
                      {typeof result.macro?.contraryclicalOpportunity?.score === 'number' && (
                        <p><strong>Score : {result.macro.contraryclicalOpportunity.score}/100</strong></p>
                      )}
                      {result.macro?.contraryclicalOpportunity?.rationale && (
                        <p>{result.macro.contraryclicalOpportunity.rationale}</p>
                      )}
                    </>
                  )}

                  {(result.macro?.structuralTrends || []).length > 0 && (
                    <>
                      <h3>Tendances structurelles</h3>
                      <ul className="flag-list">
                        {(result.macro?.structuralTrends || []).map((t: string, i: number) => <li key={i}>{t}</li>)}
                      </ul>
                    </>
                  )}

                  {result.macro?.regulatoryEnvironment && (
                    <>
                      <h3>Environnement réglementaire</h3>
                      <p>{result.macro.regulatoryEnvironment}</p>
                    </>
                  )}

                  {result.macro?.demandCycle && (
                    <>
                      <h3>Cycle de demande</h3>
                      <p>{result.macro.demandCycle}</p>
                    </>
                  )}
                </div>
              )}

              {(activeTab === 'pattern' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <div className="archetype-badge">
                    {ARCHETYPE_LABELS[result.patternMatching?.archetypeDominant]}
                  </div>
                  <p>{result.patternMatching?.archetypeRationale}</p>

                  <h3>Comparables historiques du corpus</h3>
                  <p style={{ fontSize: 13, opacity: 0.8, marginTop: -6, marginBottom: 16, fontStyle: 'italic', lineHeight: 1.55 }}>
                    Comparables retenus pour leur proximité de pattern d&apos;instruction (archétype dominant identifié, dynamiques structurelles partagées). Le tag par carte signale s&apos;il s&apos;agit d&apos;un comparable sectoriel direct (même asset class) ou d&apos;un comparable de pattern (analogie structurelle sans similarité sectorielle).
                  </p>
                  {(result.patternMatching?.comparables || []).map((c: any, i: number) => {
                    const typeLabel = c.comparableType === 'sectoral' ? 'Sectoriel'
                      : c.comparableType === 'pattern' ? 'Pattern'
                      : c.comparableType === 'mixed' ? 'Mixte' : null;
                    return (
                      <div className="comp-row" key={i}>
                        <div>
                          <span className="comp-name">{c.name}</span>
                          <span className="comp-year">{c.year}</span>
                          {typeLabel && (
                            <span className={`comp-type-tag comp-type-${c.comparableType}`} title={c.comparableTypeRationale || ''}>
                              {typeLabel}
                            </span>
                          )}
                          <div className="comp-reason">{c.structuralAnalogy}</div>
                          {c.comparableTypeRationale && c.comparableType !== 'sectoral' && (
                            <div className="comp-reason" style={{ marginTop: 4, fontSize: 12, opacity: 0.75, fontStyle: 'italic' }}>
                              {c.comparableTypeRationale}
                            </div>
                          )}
                          {c.divergences?.length > 0 && (
                            <div className="comp-reason" style={{ marginTop: 6, fontStyle: 'italic' }}>
                              <strong>Divergences :</strong> {c.divergences.join(' · ')}
                            </div>
                          )}
                          {c.sharedPatterns?.length > 0 && (
                            <div className="comp-patterns">
                              {c.sharedPatterns.map((p: string, j: number) => <span key={j} className="pattern-pill">{p}</span>)}
                            </div>
                          )}
                        </div>
                        <div className="comp-prox">Proximité {c.proximity}%</div>
                      </div>
                    );
                  })}

                  <h3>Patterns transversaux identifiés</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(result.patternMatching?.matchingPatterns || []).map((p: string, i: number) => (
                      <span key={i} className="pattern-pill" style={{ fontSize: 12, padding: '4px 12px' }}>{p}</span>
                    ))}
                  </div>

                  {result.patternMatching?.internationalBenchmarks?.length > 0 && (
                    <>
                      <h3 style={{ marginTop: 32 }}>Comparables internationaux étayés</h3>
                      <p style={{ fontSize: 13, opacity: 0.8, marginTop: -6, marginBottom: 16 }}>
                        Trois cas internationaux dont la trajectoire éclaire le dossier en cours, avec données chiffrées et facteurs clés.
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
                        {(result.patternMatching.internationalBenchmarks || []).map((b: any, i: number) => (
                          <div key={i} style={{ padding: 18, border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500 }}>{b.name}</div>
                              <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{b.geography}</div>
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {b.sector} · fondé en {b.foundedYear}
                            </div>
                            <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(0,0,0,0.03)', fontSize: 13 }}>
                              <strong style={{ fontWeight: 500 }}>Pari initial :</strong> {b.initialBet}
                            </div>
                            {b.trajectory?.length > 0 && (
                              <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 8 }}>Trajectoire chiffrée</div>
                                {b.trajectory.map((t: any, j: number) => (
                                  <div key={j} style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: 12 }}>
                                    <div style={{ minWidth: 50, fontFamily: 'var(--serif)', fontWeight: 500 }}>{t.year}</div>
                                    <div style={{ flex: 1 }}>
                                      <div>{t.milestone}</div>
                                      <div style={{ opacity: 0.7, fontSize: 11 }}>{t.revenueOrFunding}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{ marginBottom: 10, paddingTop: 10, borderTop: '1px solid var(--hairline)' }}>
                              <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
                                <div>
                                  <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Outcome</div>
                                  <div style={{ fontSize: 13 }}>{b.outcome}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Valuation finale</div>
                                  <div style={{ fontSize: 13 }}>{b.finalValuation}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6 }}>Multiple exit</div>
                                  <div style={{ fontSize: 13 }}>{b.multipleAtExit}</div>
                                </div>
                              </div>
                            </div>
                            {b.keySuccessFactors?.length > 0 && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>Facteurs de succès</div>
                                <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                                  {b.keySuccessFactors.map((f: string, j: number) => <li key={j}>{f}</li>)}
                                </ul>
                              </div>
                            )}
                            {b.keyFailureFactors?.length > 0 && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 4 }}>Facteurs d'échec</div>
                                <ul style={{ paddingLeft: 16, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
                                  {b.keyFailureFactors.map((f: string, j: number) => <li key={j}>{f}</li>)}
                                </ul>
                              </div>
                            )}
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline)', fontSize: 12, fontStyle: 'italic', opacity: 0.85 }}>
                              <strong style={{ fontWeight: 500, fontStyle: 'normal' }}>Pertinence pour ce dossier :</strong> {b.relevanceToCurrentDeal}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <h3 style={{ marginTop: 32 }}>Benchmark rétrospectif</h3>
                  {/* Le score moyen n est affiche que si la majorite des
                      comparables sont sectoraux ou mixtes. Pour les comparables
                      de pattern pur, le moteur retourne null et on cache la
                      ligne pour eviter d afficher 'Score moyen : /100'.
                      Le comparableScopeWarning rendu en dessous explique pourquoi. */}
                  {typeof result.patternMatching?.retrospectiveBenchmark?.averageScore === 'number' && (
                    <p><strong>Score moyen des comparables :</strong> {result.patternMatching.retrospectiveBenchmark.averageScore}/100</p>
                  )}
                  {result.patternMatching?.retrospectiveBenchmark?.successRate && (
                    <p>{result.patternMatching.retrospectiveBenchmark.successRate}</p>
                  )}
                  {result.patternMatching?.retrospectiveBenchmark?.insights && (
                    <p>{result.patternMatching.retrospectiveBenchmark.insights}</p>
                  )}
                  {result.patternMatching?.retrospectiveBenchmark?.comparableScopeWarning && (
                    <div style={{
                      marginTop: 14,
                      padding: '10px 14px',
                      background: 'rgba(122,92,31,0.08)',
                      border: '1px solid rgba(122,92,31,0.25)',
                      borderLeft: '3px solid #7a5c1f',
                      fontSize: 12,
                      color: 'var(--ocre-brule)',
                      lineHeight: 1.55,
                      fontStyle: 'italic',
                    }}>
                      <strong style={{ fontWeight: 600, fontStyle: 'normal' }}>Mise en garde sur la portée des comparables :</strong> {result.patternMatching.retrospectiveBenchmark.comparableScopeWarning}
                    </div>
                  )}
                </div>
              )}

              {(activeTab === 'refchecks' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  {!result.referenceChecks ? (
                    <p style={{ opacity: 0.7, fontStyle: 'italic' }}>
                      Reference checks non disponibles pour ce dossier.
                    </p>
                  ) : (
                    <>
                      <p style={{ marginTop: 0, marginBottom: 18, fontSize: 13, opacity: 0.75 }}>
                        Plan d&apos;appels de due diligence terrain. Liste structurée des contacts à appeler, profils à identifier, et questions-types pour valider l&apos;équipe, les clients et la gouvernance.
                      </p>

                      {(result.referenceChecks.priorityOrder || []).length > 0 && (
                        <div style={{ padding: '14px 18px', background: 'var(--surface)', borderLeft: '3px solid var(--ink)', marginBottom: 28 }}>
                          <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.6, marginBottom: 8 }}>
                            Ordre de priorité recommandé
                          </div>
                          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.6 }}>
                            {(result.referenceChecks.priorityOrder || []).map((p: string, i: number) => (
                              <li key={i} style={{ marginBottom: 4 }}>{p}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {(result.referenceChecks.founderChecks || []).length > 0 && (
                        <div style={{ marginBottom: 32 }}>
                          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 14 }}>
                            Appels fondateurs
                          </h3>
                          {(result.referenceChecks.founderChecks || []).map((fc: any, i: number) => (
                            <div key={i} style={{ marginBottom: 22, padding: '16px 18px', border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500, marginBottom: 12 }}>
                                {fc.founderName}
                              </div>
                              {(fc.contactsToFind || []).length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                  <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 6 }}>
                                    Contacts à identifier
                                  </div>
                                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                                    {(fc.contactsToFind || []).map((c: any, j: number) => (
                                      <li key={j} style={{ marginBottom: 4 }}>
                                        <strong style={{ fontWeight: 500, textTransform: 'capitalize' }}>{c.type}</strong> · {c.profile}
                                        {c.hint && <span style={{ display: 'block', fontSize: 12, opacity: 0.65, marginTop: 2 }}>↳ {c.hint}</span>}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {(fc.keyQuestions || []).length > 0 && (
                                <div>
                                  <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 6 }}>
                                    Questions clés
                                  </div>
                                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                                    {(fc.keyQuestions || []).map((q: string, j: number) => <li key={j}>{q}</li>)}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {(result.referenceChecks.customerChecks || []).length > 0 && (
                        <div style={{ marginBottom: 32 }}>
                          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 14 }}>
                            Appels clients
                          </h3>
                          {(result.referenceChecks.customerChecks || []).map((cc: any, i: number) => (
                            <div key={i} style={{ marginBottom: 18, padding: '14px 18px', border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                                <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500 }}>
                                  {cc.clientName}{cc.company ? <span style={{ fontWeight: 400, opacity: 0.7 }}> · {cc.company}</span> : null}
                                </div>
                                {cc.contractStatus && (
                                  <span style={{
                                    fontSize: 10,
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                    padding: '2px 8px',
                                    background: cc.contractStatus === 'contract' ? 'rgba(26,77,46,0.12)' : cc.contractStatus === 'pilot' ? 'rgba(122,92,31,0.12)' : 'rgba(0,0,0,0.06)',
                                    color: cc.contractStatus === 'contract' ? '#1a4d2e' : cc.contractStatus === 'pilot' ? '#7a5c1f' : 'inherit',
                                  }}>
                                    {cc.contractStatus}
                                  </span>
                                )}
                              </div>
                              {(cc.keyQuestions || []).length > 0 && (
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                                  {(cc.keyQuestions || []).map((q: string, j: number) => <li key={j}>{q}</li>)}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {(result.referenceChecks.boardChecks || []).length > 0 && (
                        <div style={{ marginBottom: 32 }}>
                          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 14 }}>
                            Appels gouvernance
                          </h3>
                          {(result.referenceChecks.boardChecks || []).map((bc: any, i: number) => (
                            <div key={i} style={{ marginBottom: 18, padding: '14px 18px', border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                              <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
                                {bc.memberName}
                              </div>
                              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
                                {bc.role}{bc.affiliation ? ' · ' + bc.affiliation : ''}
                              </div>
                              {(bc.keyQuestions || []).length > 0 && (
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>
                                  {(bc.keyQuestions || []).map((q: string, j: number) => <li key={j}>{q}</li>)}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {(result.referenceChecks.weakSignalsChecks || []).length > 0 && (
                        <div style={{ marginBottom: 32 }}>
                          <h3 style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 500, marginBottom: 6 }}>
                            Signaux faibles à vérifier
                          </h3>
                          <p style={{ fontSize: 12, opacity: 0.7, marginTop: 0, marginBottom: 14 }}>
                            Vérifications quantitatives à conduire en parallèle des appels. Approche debusqueurs : la traction réelle se lit dans la donnée publique avant qu&apos;elle ne devienne consensus.
                          </p>
                          {(result.referenceChecks.weakSignalsChecks || []).map((ws: any, i: number) => {
                            const SIGNAL_LABELS: Record<string, string> = {
                              github: 'GitHub',
                              similarweb: 'SimilarWeb',
                              product_hunt: 'Product Hunt',
                              hacker_news: 'Hacker News',
                              recruiting: 'Pages recrutement',
                              app_store: 'App Store / Play Store',
                            };
                            const label = SIGNAL_LABELS[ws.signalType] || ws.signalType;
                            return (
                              <div key={i} style={{ marginBottom: 16, padding: '14px 18px', border: '1px solid var(--hairline)', background: 'var(--surface)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                                  <span style={{
                                    fontSize: 10,
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                    padding: '2px 8px',
                                    background: 'rgba(122,92,31,0.12)',
                                    color: 'var(--ocre-brule)',
                                    fontWeight: 500,
                                  }}>
                                    {label}
                                  </span>
                                  {ws.target && (
                                    <span style={{ fontSize: 12, fontFamily: 'var(--mono, monospace)', opacity: 0.85 }}>
                                      {ws.target}
                                    </span>
                                  )}
                                </div>
                                {ws.rationale && (
                                  <div style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 6 }}>
                                    <span style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.55, marginRight: 6 }}>Pertinence</span>
                                    {ws.rationale}
                                  </div>
                                )}
                                {ws.expectedFinding && (
                                  <div style={{ fontSize: 13, lineHeight: 1.55, opacity: 0.8 }}>
                                    <span style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.55, marginRight: 6 }}>Lecture attendue</span>
                                    {ws.expectedFinding}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {(result.referenceChecks.redFlagsToProbe || []).length > 0 && (
                        <div style={{ padding: '16px 18px', background: 'rgba(122,31,31,0.05)', borderLeft: '3px solid #7a1f1f' }}>
                          <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--rouge-anglais)', marginBottom: 8, fontWeight: 500 }}>
                            Red flags à sonder en priorité
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                            {(result.referenceChecks.redFlagsToProbe || []).map((r: string, i: number) => (
                              <li key={i} style={{ marginBottom: 4 }}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {(activeTab === 'instruction' || printMode) && (
                <div style={{ padding: '28px 32px' }}>
                  <h3>Questions à instruire avant décision</h3>
                  <ol className="questions-list" style={{ marginTop: 12 }}>
                    {(result.causalReversal?.questionsToInvestigate || []).map((q: string, i: number) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ol>

                  <h3>Opérateurs lift-the-hood recommandés</h3>
                  <div className="op-list" style={{ marginTop: 12 }}>
                    {(result.causalReversal?.recommendedOperators || []).map((o: any, i: number) => (
                      <div className="op-card" key={i}>
                        <div className="op-profil">{o.profile}</div>
                        <div className="op-mission">{o.mission}</div>
                        <div className="op-duration">Durée estimée : {o.estimatedDuration}</div>
                      </div>
                    ))}
                  </div>

                  <h3>Proxies à calculer</h3>
                  <ul className="flag-list">
                    {(result.causalReversal?.proxiesToCalculate || []).map((p: string, i: number) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {activeTab === 'ic-pack' && (
                <IcPackView
                  result={result}
                  filename={result?.meta?.filename}
                  workflowHistory={workflowHistory}
                  icVotes={icVotes}
                  currentUserId={userId || null}
                  onVote={authEnabled && savedAnalysisId && userRole !== 'observer' ? handleVote : undefined}
                  partnerPrincipalDefault={userEmail || null}
                  icDecision={icDecision}
                  onUpdateDecision={authEnabled && savedAnalysisId && userRole !== 'observer' ? handleUpdateDecision : undefined}
                  analysisId={savedAnalysisId || null}
                  canEditReferenceCalls={Boolean(authEnabled && savedAnalysisId && userRole !== 'observer')}
                />
              )}

              {/* PRINT MODE : note d investissement complete (sections 1, 1.5,
                  1.6, 1.7 valorisation, 1.8 indicateurs deal type, 2, 3)
                  rendue a la suite des onglets dashboard pour que l export
                  PDF contienne tout. CRUCIAL : ce bloc doit rester DANS
                  .dashboard-content puisque c est le selecteur que la
                  fonction d export PDF capture. Place precedemment hors
                  du wrapper, la note etait silencieusement absente du PDF
                  meme si correctement rendue dans le DOM. */}
              {printMode && (
                <div style={{ pageBreakBefore: 'always', marginTop: 48 }}>
                  <InvestmentNoteView result={result} analysisId={savedAnalysisId || undefined} compactMode={false} />
                </div>
              )}
                  </div>
                </div>
              );
            })()}
              </>
            )}

            {/* SECTION COMPARABLES HISTORIQUES - Visible en mode dashboard.
                En mode note, la section est rendue dans InvestmentNoteView
                (Section 5). En mode print, idem. Ici on l affiche standalone
                pour que les utilisateurs en vue dashboard la voient aussi. */}
            {savedAnalysisId && !printMode && viewMode !== 'note' && (
              <section style={{
                maxWidth: 1080,
                margin: '48px auto 32px',
                padding: '0 24px',
              }}>
                <div style={{
                  marginBottom: 18,
                }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    fontFamily: 'var(--sans)',
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--accent)',
                    fontWeight: 700,
                    marginBottom: 12,
                  }}>
                    <span style={{
                      width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%',
                    }} />
                    <span>Memoire institutionnelle</span>
                  </div>
                  <h2 style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 28,
                    fontWeight: 700,
                    letterSpacing: '-0.014em',
                    margin: '0 0 8px',
                    color: 'var(--ink)',
                  }}>
                    Cas comparables historiques
                  </h2>
                  <p style={{
                    fontFamily: 'var(--serif)',
                    fontSize: 15,
                    lineHeight: 1.55,
                    color: 'var(--ink-soft)',
                    margin: 0,
                    maxWidth: 720,
                  }}>
                    Rapprochement avec un corpus de 40 startups europeennes documentees au moment
                    de leur tour qualifiant. Le matching s appuie sur six dimensions
                    (founder, market, traction, deal, defensibility, risk) et pondere un boost sectoriel.
                  </p>
                </div>
                <HistoricalComparables analysisId={savedAnalysisId} />
              </section>
            )}

            <div className="reset-row" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn" onClick={reset}>Analyser un nouveau dossier</button>
            </div>
          </>
        )}
      </main>

      {/* Volet de commentaires partages multi-membres : monte de maniere
          conditionnelle pour eviter les fetch inutiles quand non ouvert. */}
      {savedAnalysisId && (
        <CommentsPanel
          analysisId={savedAnalysisId}
          authEnabled={authEnabled}
          isOpen={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          currentUserEmail={userEmail}
        />
      )}

      {/* Dialog de collision : un dossier du meme nom existe deja.
          On demande a l utilisateur de choisir entre creer une v(N+1)
          du dossier existant ou un nouveau dossier independant. */}
      {pendingCollision && (
        <>
          <div
            onClick={async () => {
              // Dismiss du dialog : pour ne pas perdre l analyse fraichement
              // generee, on sauvegarde par defaut comme nouvelle version du
              // dossier existant. C est le comportement le moins destructeur
              // (on peut toujours supprimer une version, on ne peut pas
              // recuperer une analyse perdue). Une notification toast confirme
              // l action a l utilisateur.
              const c = pendingCollision;
              if (!c) return;
              setPendingCollision(null);
              try {
                await submitSave('new-version', {
                  result: c.pendingResult,
                  sourceFilename: c.pendingSourceFilename,
                  pipelineDurationMs: c.pendingPipelineDurationMs,
                  existingId: c.existingId,
                });
                setSaveNotification(
                  `Sauvegarde comme nouvelle version de ${c.existingCompanyName} (version ${c.nextVersionNum}).`,
                );
              } catch {
                setSaveNotification(
                  `Erreur de sauvegarde. L analyse n a pas ete persistee, veuillez relancer.`,
                );
              }
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.32)',
              zIndex: 200,
            }}
          />
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(560px, calc(100% - 32px))',
            maxHeight: '90vh',
            background: 'var(--paper)',
            border: '1px solid var(--ink)',
            zIndex: 201,
            padding: '28px 32px 24px',
            fontFamily: 'var(--sans)',
            overflowY: 'auto',
          }}>
            <div style={{
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              marginBottom: 8,
              fontWeight: 500,
            }}>
              Dossier existant detecte
            </div>
            <h3 style={{
              fontFamily: 'var(--serif)',
              fontSize: 22,
              fontWeight: 500,
              margin: '0 0 14px',
              lineHeight: 1.2,
            }}>
              Un dossier <em>{pendingCollision.existingCompanyName}</em> existe deja
            </h3>
            <p style={{
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--ink)',
              margin: '0 0 20px',
            }}>
              Vous avez instruit cette societe le {new Date(pendingCollision.existingCreatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}.
              Cette nouvelle analyse peut etre traitee comme une mise a jour
              du dossier existant (version {pendingCollision.nextVersionNum}) ou comme un nouveau dossier independant.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={async () => {
                  const c = pendingCollision;
                  setPendingCollision(null);
                  await submitSave('new-version', {
                    result: c.pendingResult,
                    sourceFilename: c.pendingSourceFilename,
                    pipelineDurationMs: c.pendingPipelineDurationMs,
                    existingId: c.existingId,
                  });
                }}
                style={{
                  padding: '14px 18px',
                  fontSize: 13,
                  background: 'var(--ink)',
                  color: 'var(--paper)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <span style={{ fontWeight: 500 }}>
                  Creer la version {pendingCollision.nextVersionNum}
                </span>
                <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 400, lineHeight: 1.4 }}>
                  L analyse precedente est conservee comme version historique. Le dossier garde son fil de commentaires et son stade d instruction.
                </span>
              </button>

              <button
                onClick={async () => {
                  const c = pendingCollision;
                  setPendingCollision(null);
                  await submitSave('new-record', {
                    result: c.pendingResult,
                    sourceFilename: c.pendingSourceFilename,
                    pipelineDurationMs: c.pendingPipelineDurationMs,
                  });
                }}
                style={{
                  padding: '14px 18px',
                  fontSize: 13,
                  background: 'transparent',
                  color: 'var(--ink)',
                  border: '1px solid var(--ink)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <span style={{ fontWeight: 500 }}>Creer un nouveau dossier independant</span>
                <span style={{ fontSize: 11, opacity: 0.75, fontWeight: 400, lineHeight: 1.4 }}>
                  Le dossier precedent reste intact. Utile si la societe a change de nom ou si c est en realite un projet different.
                </span>
              </button>

              <button
                onClick={() => setPendingCollision(null)}
                style={{
                  padding: '8px 14px',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: 'transparent',
                  color: 'var(--muted)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  marginTop: 6,
                }}
              >
                Annuler la sauvegarde
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast de notification de sauvegarde
          S affiche en bas a droite quand une action de sauvegarde
          automatique est effectuee (typiquement : dismiss du dialog
          de collision sans choix explicite, qui sauvegarde par defaut
          comme nouvelle version pour ne pas perdre l analyse).
          Auto-disparition apres 5 secondes (cf useEffect plus haut). */}
      {saveNotification && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            maxWidth: 380,
            padding: '14px 18px',
            background: 'var(--paper)',
            border: '1px solid var(--ocre-brule)',
            borderLeft: '3px solid var(--ocre-brule)',
            borderRadius: 4,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--ink)',
            zIndex: 250,
            fontFamily: 'var(--sans)',
          }}
        >
          <div style={{
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
            color: 'var(--ocre-brule)',
            marginBottom: 4,
          }}>
            Sauvegarde
          </div>
          {saveNotification}
        </div>
      )}
    </>
  );
}

// ============================================================
// NIVEAU 3.A : COMPOSANT BLOC D ANNOTATION
// ------------------------------------------------------------
// Champ texte libre permettant a l utilisateur d annoter une analyse.
// Les annotations sont stockees dans Supabase via PATCH /api/analyses/[id]
// et seront automatiquement injectees dans le prompt de finalRecommendation
// pour les futurs dossiers du meme secteur.
//
// Comportement :
//   - Charge les notes existantes au mount (si analyse passee)
//   - Save manuel via bouton (pas d auto-save pour eviter les ecrits
//     intempestifs pendant que l utilisateur reflechit)
//   - Indicateur visuel de l etat : draft / saving / saved
// ============================================================
// Format relatif : 'aujourd hui', 'hier', 'il y a 3j', 'il y a 2 sem'.
// Utilise pour la barre de contexte fonds dans le hero.
function formatRelativeDate(iso: string | null): string {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return 'aujourd\u2019hui';
    if (diffDays === 1) return 'hier';
    if (diffDays < 7) return `il y a ${diffDays}j`;
    if (diffDays < 30) {
      const w = Math.floor(diffDays / 7);
      return `il y a ${w} sem`;
    }
    if (diffDays < 365) {
      const m = Math.floor(diffDays / 30);
      return `il y a ${m} mois`;
    }
    const y = Math.floor(diffDays / 365);
    return `il y a ${y} an${y > 1 ? 's' : ''}`;
  } catch {
    return '';
  }
}

function AnnotationBlock({ analysisId }: { analysisId: string }) {
  const [notes, setNotes] = useState<string>('');
  const [originalNotes, setOriginalNotes] = useState<string>('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [expanded, setExpanded] = useState(false);

  // Charge les notes existantes (si l analyse a deja ete annotee)
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/analyses/${analysisId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled) return;
        const existing = data?.analysis?.userNotes || '';
        setNotes(existing);
        setOriginalNotes(existing);
      })
      .catch(() => { /* silencieux */ });
    return () => { cancelled = true; };
  }, [analysisId]);

  const hasChanges = notes !== originalNotes;

  const handleSave = async () => {
    setSaveState('saving');
    try {
      const res = await fetch(`/api/analyses/${analysisId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userNotes: notes }),
      });
      if (res.ok) {
        setSaveState('saved');
        setOriginalNotes(notes);
        setTimeout(() => setSaveState('idle'), 2000);
      } else {
        setSaveState('error');
      }
    } catch {
      setSaveState('error');
    }
  };

  return (
    <div style={{
      margin: '20px 0',
      background: 'var(--surface)',
      border: '1px solid var(--hairline)',
      padding: expanded ? '20px 24px' : '14px 20px',
      transition: 'padding 0.15s',
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          fontWeight: 600,
        }}>
          {expanded ? '▾' : '▸'} Annotations & feedback
          {originalNotes && !expanded && (
            <span style={{ marginLeft: 8, opacity: 0.7, textTransform: 'none', letterSpacing: 0 }}>
              · annotée
            </span>
          )}
        </div>
        {!expanded && (
          <span style={{ fontSize: 11, opacity: 0.6 }}>
            Cliquer pour annoter
          </span>
        )}
      </div>

      {expanded && (
        <>
          <div style={{
            fontSize: 12.5,
            color: 'var(--muted)',
            lineHeight: 1.55,
            marginTop: 10,
            marginBottom: 12,
          }}>
            Annote librement cette analyse : ce que le moteur a bien capté, ce qu&apos;il a sous-estimé,
            les comparables qui te semblent justes ou faux, ta thèse personnelle. Tes annotations sont
            réutilisées comme contexte d&apos;apprentissage pour les futurs dossiers du même secteur.
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex. Le moteur a sous-estimé le founder-market fit. Le pattern Helsing est juste mais trop appuyé. La traction réelle est probablement meilleure que les zéro ARR/NRR documentés."
            rows={5}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 14,
              fontFamily: 'inherit',
              border: '1px solid var(--hairline)',
              background: 'var(--paper)',
              color: 'var(--ink)',
              resize: 'vertical',
              lineHeight: 1.55,
            }}
          />
          <div style={{
            marginTop: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {saveState === 'saving' && 'Sauvegarde...'}
              {saveState === 'saved' && <span style={{ color: 'var(--vert-foret)' }}>✓ Annotation sauvegardée</span>}
              {saveState === 'error' && <span style={{ color: 'var(--rouge-anglais)' }}>⨯ Erreur de sauvegarde</span>}
              {saveState === 'idle' && hasChanges && <span style={{ opacity: 0.7 }}>Modifications non sauvegardées</span>}
              {saveState === 'idle' && !hasChanges && <span style={{ opacity: 0.5 }}>{notes.length} caractères</span>}
            </div>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saveState === 'saving'}
              style={{
                padding: '7px 18px',
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: hasChanges ? 'var(--ink)' : 'transparent',
                color: hasChanges ? 'var(--paper)' : 'var(--muted)',
                border: '1px solid ' + (hasChanges ? 'var(--ink)' : 'var(--hairline)'),
                cursor: hasChanges ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              Sauvegarder
            </button>
          </div>
        </>
      )}
    </div>
  );
}
