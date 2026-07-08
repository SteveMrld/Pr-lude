import { NextRequest } from 'next/server';
import { runPreScan } from '@/lib/engines/prescan-engine';
import { resolvePreScanOverride } from '@/lib/engines/prescan-override';
import { extractFromDeck } from '@/lib/engines/extraction-engine';
import { analyzeTeam } from '@/lib/engines/team-engine';
import { analyzeMarket } from '@/lib/engines/market-engine';
import { analyzeMacro } from '@/lib/engines/macro-engine';
import { matchPatterns } from '@/lib/engines/pattern-engine';
import { performCausalReversal } from '@/lib/engines/causal-engine';
import { analyzeBlindspots } from '@/lib/engines/blindspot-engine';
import { analyzeContrarian } from '@/lib/engines/contrarian-engine';
import { extractFinancialData } from '@/lib/engines/financial-extraction-engine';
import { analyzeFinancialCoherence } from '@/lib/engines/financial-coherence-engine';
import { analyzeBenchmarks } from '@/lib/engines/benchmark-engine';
import { analyzeTechClaimCoherence } from '@/lib/engines/tech-claim-coherence-engine';
import { analyzeExecutionFriction } from '@/lib/engines/execution-friction-engine';
import { analyzeNarrativeDrift } from '@/lib/engines/narrative-drift-engine';
// Import du moteur Phase 4 : analyzeFragiliteStructurelle est l entry point.
// Les patterns individuels sont importes en side-effect pour s auto-enregistrer
// dans le registry via registerPattern. Ajouter ici tout nouveau pattern
// implemente.
import { analyzeFragiliteStructurelle } from '@/lib/engines/fragility-structurelle';
import '@/lib/engines/fragility-structurelle/growth-subsidized-pattern';
import '@/lib/engines/fragility-structurelle/infrastructure-hostage-pattern';
import '@/lib/engines/fragility-structurelle/fixed-cost-trap-pattern';
import '@/lib/engines/fragility-structurelle/regulatory-time-bomb-pattern';
import '@/lib/engines/fragility-structurelle/commoditization-drift-pattern';
import '@/lib/engines/fragility-structurelle/capital-structure-fragility-pattern';
import '@/lib/engines/fragility-structurelle/scale-mirage-risk-pattern';
import { orchestrateFinalRecommendation } from '@/lib/engines/orchestrator';
import { computeMechanicalScore } from '@/lib/engines/score-calculator';
import {
  buildSkippedTeamOutput,
  buildSkippedPatternMatchingOutput,
  buildSkippedBlindspotOutput,
  buildSkippedCausalOutput,
} from '@/lib/engines/skipped-outputs';
import { computeValuation } from '@/lib/engines/valuation-engine';
import { computeIndicators } from '@/lib/engines/indicators-engine';
import { extractSaasMetrics } from '@/lib/engines/saas-metrics-engine';
import { extractIndustrialMetrics } from '@/lib/engines/industrial-metrics-engine';
import { computeRelevanceMatrix } from '@/lib/engines/relevance-matrix';
import { normalizeAssetClass } from '@/lib/data/sector-benchmarks';
import { generateReferenceChecks } from '@/lib/engines/reference-checks-engine';
import { auditAssertions } from '@/lib/engines/assertion-validator';
import { processFileRefs, type FileBufferInput } from '@/lib/file-processor';
import { logException } from '@/lib/error-logger';
import {
  createPendingAnalysis,
  updateAnalysisProgress,
  markAnalysisCompleted,
  markAnalysisFailed,
  extractAnalysisMetadata,
  getCurrentUserId,
} from '@/lib/analysis-store';
import { getAuthenticatedContext, isAuthEnabled } from '@/lib/auth';
import { dispatchSlackNotifications } from '@/lib/slack-dispatch';
import {
  downloadDossierFile,
  isValidStoragePath,
  type DossierFileRef,
} from '@/lib/storage/dossier-uploads';
import { buildVersionStamp, sealVersionStamp } from '@/lib/instrumentation/version-stamp';
import { insertPredictionRecord } from '@/lib/prediction-records-store';

// Vercel Pro permet jusqu a 800s par function (13 min). Avec 12+ moteurs
// Claude dont certains prennent 60s+ chacun, on a besoin de cette marge
// pour les dossiers complexes qui mobilisent toute la machinerie.
// NOTE : depuis le fix Bloc1/Bloc2, /api/analyze ne fait QUE le Bloc 1
// (instruction / screening). Les moteurs Bloc 2 (Data Room) tournent
// uniquement via /api/analyses/[id]/dd-deepen quand le VC declenche
// explicitement la DD approfondie apres avoir lu le verdict Bloc 1.
// Mesure logs prod : Bloc 1 seul tourne en 90-180s.
export const maxDuration = 800;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Declare au scope outer pour que le catch global puisse liberer
  // le slot rate-limit et marquer l analyse en echec si une erreur
  // survient apres acquisition de l id.
  let jobId: string | null = null;
  let analysisId: string | null = null;
  try {
    // Body JSON leger : plus aucun octet de fichier ne transite par
    // cette fonction. Les fichiers ont ete uploades par le client
    // sur Supabase Storage via signed URL (route /api/uploads/sign),
    // on n a recu ici que des references {storagePath, name,
    // mimeType, size}. Resout le FUNCTION_PAYLOAD_TOO_LARGE qui
    // sautait sur les decks lourds (>4,5 Mo, plafond Vercel).
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Body JSON invalide. Cette route ne prend plus de multipart, voir /api/uploads/sign pour le nouveau flux.' }),
        { status: 400 },
      );
    }

    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
    if (!sessionId || !/^[a-zA-Z0-9-]{8,64}$/.test(sessionId)) {
      return new Response(JSON.stringify({ error: 'sessionId requis (UUID généré côté client)' }), { status: 400 });
    }
    const ownerKey = typeof body?.ownerKey === 'string' ? body.ownerKey : 'solo';

    const rawRefs: any[] = Array.isArray(body?.files) ? body.files : [];
    if (rawRefs.length === 0) {
      return new Response(JSON.stringify({ error: 'Au moins une référence de fichier requise' }), { status: 400 });
    }
    if (rawRefs.length > 25) {
      return new Response(JSON.stringify({ error: 'Trop de fichiers (max 25)' }), { status: 400 });
    }

    // Validation defensive : chaque chemin doit pointer dans le
    // namespace de la session (sinon un client malveillant pourrait
    // tenter de telecharger un fichier d un autre dossier).
    const sessionPrefix = `${ownerKey}/${sessionId}`;
    const refs: DossierFileRef[] = [];
    for (const r of rawRefs) {
      if (!r || typeof r.storagePath !== 'string' || typeof r.name !== 'string') {
        return new Response(JSON.stringify({ error: 'Ref invalide : storagePath et name requis' }), { status: 400 });
      }
      if (!isValidStoragePath(r.storagePath, sessionPrefix)) {
        return new Response(JSON.stringify({ error: `Chemin Storage refusé : ${r.storagePath}` }), { status: 400 });
      }
      refs.push({
        storagePath: r.storagePath,
        name: r.name,
        mimeType: typeof r.mimeType === 'string' ? r.mimeType : '',
        size: typeof r.size === 'number' ? r.size : 0,
      });
    }

    const forcePrescan = body?.forcePrescan === true || body?.forcePrescan === 'true' || body?.forcePrescan === '1';
    let priorPreScan: any = null;
    if (forcePrescan && body?.priorPreScan) {
      priorPreScan = body.priorPreScan;
    }

    /**
     * Parcours d analyse choisi par le partner sur la page d entree.
     * Voir la suite du pipeline pour les conditions d activation
     * par moteur.
     */
    const track: 'early' | 'growth' = (body?.track === 'growth') ? 'growth' : 'early';

    const forceNarrativeDriftFlag = body?.forceNarrativeDrift === true || body?.forceNarrativeDrift === '1';
    const forceFragilityFlag = body?.forceFragility === true || body?.forceFragility === '1';

    // ============================================================
    // MODE GELE : run sans ouverture reseau (corpus ingestion)
    // ------------------------------------------------------------
    // frozen=true coupe en dur le web search dans les quatre moteurs
    // concernes (team, market, financial-coherence, macro), surpasse
    // ENABLE_WEB_SEARCH, et entre dans le fingerprint via version-stamp
    // pour former un segment de calibration etanche. Defaut false :
    // aucun changement pour le flux courant.
    //
    // asOf est la date de provenance du deck. Ne contraint pas l API
    // web search a des resultats historiques, c est purement
    // informatif. La prevention de fuite vient de frozen.
    // ============================================================
    const frozen = body?.frozen === true || body?.frozen === 'true';
    const asOfRaw = typeof body?.asOf === 'string' ? body.asOf.trim() : '';
    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(asOfRaw) ? asOfRaw : null;
    const runOptions = { frozen };

    // Download des fichiers depuis Storage en parallele. C est le
    // seul moment ou le serveur manipule les octets : ensuite c est
    // du base64 en memoire passe aux moteurs LLM. Pas d ecriture
    // disque, pas de copie inutile.
    const buffered: FileBufferInput[] = await Promise.all(
      refs.map(async (ref) => {
        const buf = await downloadDossierFile(ref.storagePath);
        return {
          name: ref.name,
          mimeType: ref.mimeType || guessMimeFromName(ref.name),
          size: ref.size || buf.byteLength,
          buffer: buf,
        };
      }),
    );

    const {
      pitchDeck, businessPlan, generalLedger,
      shareholdersAgreement, statutes, capTable, clientContracts,
      technicalDocs,
      others,
    } = await processFileRefs(buffered);

    if (!pitchDeck) {
      return new Response(JSON.stringify({ error: 'Pitch deck PDF requis' }), { status: 400 });
    }

    // ============================================================
    // RECUPERATION DU PROFIL FONDS
    // ------------------------------------------------------------
    // Si l auth est activee et que l utilisateur a une organisation,
    // on charge le profil fonds (these d investissement). Le pre-scan
    // l utilisera pour evaluer le sector_fit, geography_fit, ticket_fit
    // et stage_fit du dossier.
    //
    // Si pas d auth, ou pas d org, ou pas de profil configure, le
    // pre-scan tourne avec les 6 tests universels uniquement.
    // ============================================================
    let fundProfileForPreScan: any = null;
    let fundDimensionalNotes: {
      team: string | null;
      market: string | null;
      macro: string | null;
      financial: string | null;
      general: string | null;
    } | null = null;
    // Ces deux valeurs sont capturees pour le rate limiting (acquireJobSlot)
    // et pour le contexte des logs d erreur. Restent null en mode auth
    // desactivee, auquel cas le rate limiting est skip.
    let activeOrgId: string | null = null;
    let activeUserId: string | null = null;
    // Identite humaine du partner qui ouvre la note. Utilisee pour
    // BOARD_INSIDER : comparaison contre boardMembers et founders du
    // dossier. Vide en mode auth desactivee (le module conflict-of-interest
    // ne genere alors aucun flag board-insider, comportement attendu).
    let userIdentityForConflict: string | null = null;
    try {
      const { isAuthEnabled, getAuthenticatedContext } = await import('@/lib/auth');
      if (isAuthEnabled()) {
        const ctx = await getAuthenticatedContext();
        if (ctx) {
          activeOrgId = ctx.org.id;
          activeUserId = ctx.user.id;
          // Calcul de l identite humaine pour la detection BOARD_INSIDER.
          // displayName est la source canonique. Fallback sur la local-part
          // de l email (avant @) si displayName absent, ce qui couvre la
          // plupart des comptes Prelude ou le displayName n est pas encore
          // configure mais l email tel que "steve.moradel@example.com"
          // expose deja l identite reconnaissable.
          if (ctx.user.displayName) {
            userIdentityForConflict = ctx.user.displayName;
          } else if (ctx.user.email) {
            const localPart = ctx.user.email.split('@')[0] || '';
            // Reconstruit un nom lisible : remplace points/tirets/underscores
            // par espaces, mots capitalises. "steve.moradel" -> "Steve Moradel".
            userIdentityForConflict = localPart
              .split(/[._-]+/)
              .filter(Boolean)
              .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ');
          }
          const { getSupabaseAdminClient } = await import('@/lib/supabase/server');
          const admin = getSupabaseAdminClient();
          const { data } = await admin
            .from('fund_profiles')
            .select('*')
            .eq('organization_id', ctx.org.id)
            .maybeSingle();
          if (data) {
            fundProfileForPreScan = {
              sectorsFocus: data.sectors_focus || [],
              sectorsExcluded: data.sectors_excluded || [],
              geographiesFocus: data.geographies_focus || [],
              geographiesExcluded: data.geographies_excluded || [],
              ticketMinEur: data.ticket_min_eur,
              ticketMaxEur: data.ticket_max_eur,
              stagesFocus: data.stages_focus || [],
              notes: data.notes,
              // Champs optionnels pour la detection conflict-of-interest.
              // Tant que la table fund_profiles n a pas les colonnes
              // fund_name, portfolio_companies, syndicate_partners,
              // ces lectures rendent undefined et le moteur conflict
              // sort vide. Ajout sans migration cassante : si les
              // colonnes apparaissent plus tard, la detection se
              // declenche automatiquement.
              fundName: (data as any).fund_name ?? null,
              portfolioCompanies: (data as any).portfolio_companies || [],
              syndicatePartners: (data as any).syndicate_partners || [],
            };
            // Notes structurees par dimension. Permet d injecter dans
            // chaque moteur Bloc 1 les nuances de these qui le concer-
            // nent, sans diluer son contexte avec les notes des autres
            // dimensions. Champs facultatifs : si null, l injection
            // est skip pour le moteur correspondant.
            fundDimensionalNotes = {
              team: data.notes_team || null,
              market: data.notes_market || null,
              macro: data.notes_macro || null,
              financial: data.notes_financial || null,
              general: data.notes_general || null,
            };
          }
        }
      }
    } catch (err: any) {
      logException('api.analyze.fund-profile', err, {
        severity: 'warning',
        context: { phase: 'fund-profile-load' },
      });
    }

    // ============================================================
    // RATE LIMITING : reserve un slot dans active_jobs
    // ------------------------------------------------------------
    // Plafonne le nombre de pipelines simultanes par organisation
    // (defaut 3). Si la limite est atteinte, on retourne 429 sans
    // lancer le pipeline. Cela evite qu un acteur malveillant ou
    // un bug client ne brule les credits Anthropic.
    //
    // En mode auth desactivee (pas d activeOrgId), le rate limiting
    // est skip. Le slot est libere dans le finally du stream pour
    // garantir le cleanup meme en cas de pipeline qui plante.
    // ============================================================
    if (activeOrgId) {
      const { acquireJobSlot } = await import('@/lib/rate-limit');
      const slot = await acquireJobSlot(activeOrgId, activeUserId, pitchDeck.name);
      if (slot.jobId === null && slot.reason === 'limit-reached') {
        return new Response(JSON.stringify({
          error: `Limite de pipelines simultanes atteinte (${slot.currentCount}/${slot.maxAllowed}). Attendez la fin d'une analyse en cours pour en lancer une nouvelle.`,
          code: 'rate-limit-reached',
          currentCount: slot.currentCount,
          maxAllowed: slot.maxAllowed,
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      jobId = slot.jobId;
    }

    const startTime = Date.now();
    const allFileNames = [
      pitchDeck.name,
      ...(businessPlan ? [businessPlan.name] : []),
      ...(generalLedger ? [generalLedger.name] : []),
      ...(shareholdersAgreement ? [shareholdersAgreement.name] : []),
      ...(statutes ? [statutes.name] : []),
      ...(capTable ? [capTable.name] : []),
      ...clientContracts.map(c => c.name),
      ...technicalDocs.map(t => t.name),
      ...others.map(o => o.name),
    ];

    // ============================================================
    // CREATION DE LA LIGNE ANALYSES A T0
    // ------------------------------------------------------------
    // L id est assigne maintenant, AVANT le pipeline. Le client le
    // recoit immediatement dans le premier event SSE 'analysis-created'
    // et peut basculer en polling (/api/analyses/[id]/run-status) si
    // la connexion SSE coupe. Sans cette creation precoce, une
    // analyse perdue par timeout fonction ne laissait aucune trace
    // en base et produisait le "Analyse introuvable" cote lecture.
    //
    // En mode persistence-off (dev sans Supabase), on continue mais
    // sans id : le client ne pourra pas faire de polling, seul le
    // streaming SSE est utilisable.
    // ============================================================
    analysisId = await createPendingAnalysis({
      initialCompanyName: '(analyse en cours)',
      sourceFilename: pitchDeck.name,
      uploadedFiles: refs.map((r) => ({
        storagePath: r.storagePath,
        name: r.name,
        mimeType: r.mimeType,
        size: r.size,
      })),
      frozen,
      asOf,
    });

    // Streaming SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Capture des startedAt par moteur pour calculer la duree a l envoi
        // de l event done. Permet aussi d emettre la duree dans le payload
        // final (result.meta.engineDurations) pour la persistance et le
        // re-affichage en historique.
        const engineStartedAt: Record<string, number> = {};
        const engineDurations: Record<string, number> = {};

        // send() est safe contre un controller deja ferme : quand le
        // budget global du run est arme et que la sortie propre a deja
        // close() le stream, les moteurs en cours de convergence peuvent
        // continuer d appeler sendDone en arriere-plan (leurs promesses
        // resolvent apres notre bascule vers l abort). controller.enqueue
        // throw dans ce cas, ce qui produisait des unhandled rejections
        // qui polluaient les logs Vercel sans aider au diagnostic. On
        // avale silencieusement : le client a deja recu l event
        // run-budget-exhausted, il sait que le run est fini.
        function send(eventType: string, data: any) {
          const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          try {
            controller.enqueue(encoder.encode(message));
          } catch {
            // controller closed apres budget exhausted ou disconnect client
          }
        }

        function sendStart(engine: string, label: string) {
          engineStartedAt[engine] = Date.now();
          send('engine-start', { engine, label });
        }

        // sendDone idempotent : le wrapper withEngineDeadline peut
        // emettre un engine-done(null) sur deadline, puis la promesse
        // sous-jacente peut finir par resoudre plus tard et essayer
        // d emettre un engine-done(result) reel. On garde la premiere
        // emission (la seule dont le client tient compte pour son etat
        // pipeline) et on ignore les suivantes.
        const sentDone = new Set<string>();
        function sendDone(engine: string, output: any) {
          if (sentDone.has(engine)) return;
          sentDone.add(engine);
          const startedAt = engineStartedAt[engine];
          const durationMs = startedAt != null ? Date.now() - startedAt : null;
          if (durationMs != null) engineDurations[engine] = durationMs;
          send('engine-done', { engine, output, durationMs });
          // Flush throttled (2s) de la progression vers la base. Sert
          // au polling de secours quand la connexion SSE coupe.
          flushProgress(false).catch(() => {});
        }

        // Snapshot de progression : met a jour la ligne analyses avec
        // un patch des engines courants. Best effort : un echec
        // n arrete pas le pipeline, mais le polling cote client
        // perdrait son fil. Throttle 2 secondes pour ne pas marteler
        // la base avec douze updates par seconde quand plusieurs
        // moteurs resolvent en rafale.
        let lastProgressFlush = 0;
        async function flushProgress(force: boolean = false): Promise<void> {
          if (!analysisId) return;
          const now = Date.now();
          if (!force && now - lastProgressFlush < 2000) return;
          lastProgressFlush = now;
          const engines: Record<string, any> = {};
          for (const eng of Object.keys(engineStartedAt)) {
            const startedAt = engineStartedAt[eng];
            const durationMs = engineDurations[eng];
            engines[eng] = {
              startedAt,
              durationMs: durationMs ?? null,
              status: durationMs != null ? 'done' : 'running',
            };
          }
          await updateAnalysisProgress(analysisId, {
            progress: {
              stage: 'running',
              engines,
              heartbeatAt: new Date().toISOString(),
            },
          });
        }

        // Heartbeat SSE : envoie un commentaire SSE vide ":\n\n"
        // toutes les 15 secondes pour maintenir la connexion vivante.
        // Sans ce ping, les proxys (Vercel edge, Cloudflare, navigateur
        // mobile en arriere-plan) peuvent couper une connexion qui n a
        // pas envoye de donnees pendant 30-60s, ce qui produit le
        // "network error" client alors que le serveur tourne encore.
        // Particulierement critique sur les moteurs longs (orchestrate,
        // contrarian, blindspot) qui peuvent prendre 60-120s chacun.
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          } catch (err) {
            // Connection closed, on arrete le heartbeat
          }
        }, 15000);

        // ============================================================
        // TROIS GARDES DE TEMPS DU PIPELINE, DU PLUS FIN AU PLUS LARGE
        // ------------------------------------------------------------
        // Ces trois seuils se cumulent et couvrent chacun une classe de
        // defaillance distincte. Aucun n est optionnel, aucun ne se
        // substitue aux deux autres.
        //
        //   1. SDK Anthropic : timeout 60s par appel, maxRetries 0.
        //      Pose en axis 1 dans lib/engines/anthropic-client.ts.
        //      Coupe court a un appel individuel qui traine, empeche
        //      les reprises silencieuses du SDK (11.9s x3 puis 61s x3
        //      observes sur Food Pilot du 7 juillet 2026).
        //
        //   2. Par moteur : deadline 120s. Chaque moteur du pipeline
        //      est enveloppe dans withEngineDeadline qui, au trigger,
        //      logue 'deadline-exceeded' dans error_logs, emet
        //      sendDone(engine, null) au client et resoud la promesse
        //      sur null. Les autres moteurs continuent. Downstream
        //      accepte le null (orchestrate a son fallback degrade,
        //      les moteurs conditionnels ont deja le pattern).
        //      Budget nominal d un moteur Sonnet 4.6 = 20-60s, la
        //      deadline 120s laisse deux tentatives SDK dans le pire
        //      des cas avant abandon propre.
        //
        //   3. Budget global du run : 600s. AbortController arme des
        //      l entree du stream, budgetPromise rejette a l abort.
        //      Race le Promise.all central et orchestrate. Marge de
        //      200s avant le mur Vercel 800s pour la sortie propre :
        //      markAnalysisFailed lisible, event 'run-budget-exhausted'
        //      au client, close du stream. Sans ce budget, un incident
        //      Anthropic durable laissait courir jusqu au mur 800s
        //      puis Vercel tuait en Runtime Timeout Error opaque.
        // ============================================================
        const ENGINE_DEADLINE_MS = 120_000;
        const RUN_BUDGET_MS = 600_000;

        const budgetAbort = new AbortController();
        const budgetTimer = setTimeout(() => {
          budgetAbort.abort();
        }, RUN_BUDGET_MS);

        // Promesse qui rejette a l abort, race le Promise.all central et
        // orchestrate. Le message est un tag reconnu par le catch general
        // pour distinguer le budget exhausted d une erreur Anthropic
        // ordinaire et construire le userMessage adapte.
        const budgetPromise: Promise<never> = new Promise((_, reject) => {
          budgetAbort.signal.addEventListener('abort', () => {
            reject(new Error(`PIPELINE_BUDGET_EXHAUSTED:${RUN_BUDGET_MS}`));
          }, { once: true });
        });

        // Wrapper deadline par moteur. Au trigger : log
        // 'deadline-exceeded' dans error_logs avec le nom du moteur,
        // sendDone(engine, null) pour maintenir Promise.all vivant et
        // signaler au client que ce moteur specifique a echoue proprement,
        // puis resolve sur null. La promesse sous-jacente continue de
        // vivre mais son sendDone eventuel sera avale par l idempotence
        // de sentDone. Ne s applique pas a orchestrate qui a sa propre
        // logique de retry controle (2 tentatives max, cf axis 1).
        function withEngineDeadline<T>(engine: string, work: Promise<T>): Promise<T | null> {
          return new Promise((resolve) => {
            let settled = false;
            const timer = setTimeout(() => {
              if (settled) return;
              settled = true;
              logException(`pipeline.${engine}`, new Error('deadline-exceeded'), {
                severity: 'warning',
                context: { engine, deadlineMs: ENGINE_DEADLINE_MS },
              });
              try { sendDone(engine, null); } catch { /* controller closed */ }
              resolve(null);
            }, ENGINE_DEADLINE_MS);
            work.then(
              (v) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(v);
              },
              (err) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                logException(`pipeline.${engine}`, err, {
                  severity: 'warning',
                  context: { engine, phase: 'engine-error' },
                });
                try { sendDone(engine, null); } catch { /* controller closed */ }
                resolve(null);
              },
            );
          });
        }

        try {
          // Premier event : l id de l analyse cree a t0. Le client
          // peut deja brancher son polling de secours sur cet id
          // avant meme que le pipeline ait demarre. Si la persistance
          // est desactivee (mode dev), id=null et le polling est skip.
          send('analysis-created', { analysisId });

          send('files-received', {
            pitchDeck: pitchDeck.name,
            businessPlan: businessPlan?.name || null,
            generalLedger: generalLedger?.name || null,
            shareholdersAgreement: shareholdersAgreement?.name || null,
            statutes: statutes?.name || null,
            capTable: capTable?.name || null,
            clientContracts: clientContracts.map(c => c.name),
            technicalDocs: technicalDocs.map(t => t.name),
            others: others.map(o => o.name),
          });

          // ============================================================
          // VAGUE 0 : PRE-SCAN (TRIAGE BLOC 0)
          // ------------------------------------------------------------
          // Tourne en tete du pipeline en 5-8 secondes sur Haiku 4.5
          // pour 0.02$. Applique six tests eliminatoires structurels
          // (narrative, founder, financial, stage_ticket, market,
          // thesis_fit) et produit un verdict de triage. Si la these
          // du fonds est renseignee, quatre tests fit these s ajoutent
          // (sector, geography, ticket, stage) pour un total de dix.
          //
          // GATING DOUX : si verdict not_recommended (knockout), le
          // pipeline s arrete apres le pre-scan et envoie un signal
          // SSE prescan-knockout au client. L UI affiche le bandeau
          // rouge avec un bouton 'Lancer l analyse complete malgre tout'
          // qui repostera la meme analyse avec forcePrescan=true. Cela
          // economise les ~2.80$ du Bloc 1 complet sur les dossiers
          // manifestement eliminatoires (estimation 30% des dossiers
          // entrants sur un fonds early stage) tout en preservant le
          // pouvoir de decision du partner. Verdicts ready_for_pipeline
          // et pipeline_with_caveats laissent le pipeline continuer
          // normalement.
          // ============================================================
          let preScan: any = null;
          if (forcePrescan) {
            // Override partner apres knockout : on ne relance pas le
            // moteur. La resolution est deleguee a resolvePreScanOverride
            // pour pouvoir etre testee deterministe sans toucher a
            // l API LLM.
            sendStart('prescan', 'Pré-scan : verdict initial conservé, override partner');
            preScan = resolvePreScanOverride(priorPreScan);
            sendDone('prescan', preScan);
          } else {
            sendStart('prescan', fundProfileForPreScan
              ? 'Pré-scan : triage rapide dix tests (six universels et quatre fit thèse)'
              : 'Pré-scan : triage rapide six tests éliminatoires');
            try {
              preScan = await runPreScan(pitchDeck.payload, fundProfileForPreScan || undefined);
            } catch (err: any) {
              logException('pipeline.prescan', err, {
                severity: 'warning',
                context: { phase: 'prescan-bloc-0' },
              });
            }
            sendDone('prescan', preScan);
          }

          // Gating doux : on ne stoppe que si le pre-scan a effectivement
          // tourne (preScan non null), si son verdict est knockout, et si
          // le client n a pas explicitement forcé. En cas d echec du
          // pre-scan (preScan=null), on continue par securite, sinon une
          // panne API Anthropic empecherait toute analyse.
          if (preScan && preScan.recommendation === 'not_recommended' && !forcePrescan) {
            send('prescan-knockout', {
              recommendation: preScan.recommendation,
              summary: preScan.summary,
              failedTests: preScan.failedTests || [],
              score: preScan.score,
              totalTests: preScan.totalTests,
              message: 'Le pre-scan a leve un knockout. Pipeline complet non lance pour economiser les credits. Le partner peut forcer l analyse complete via le bouton dedie.',
            });
            // Termine proprement le stream sans envoyer 'complete'. Le
            // client recoit prescan-knockout et arrete le pipeline en
            // affichant le bandeau de gating.
            clearInterval(heartbeatInterval);
            controller.close();
            return;
          }

          // ============================================================
          // VAGUE 1 : EXTRACTION
          // ============================================================
          sendStart('extraction', 'Extraction du contenu du pitch deck');
          const extraction = await extractFromDeck(pitchDeck.payload);
          sendDone('extraction', extraction);

          // Propage les metadonnees de base en BDD des qu on les a :
          // companyName, sector, country, etc. La liste Historique
          // affiche desormais le bon nom et le secteur reels au lieu
          // de "(analyse en cours)" pendant toute la duree du pipeline.
          // Non bloquant : un echec ne stoppe pas le pipeline.
          if (analysisId) {
            updateAnalysisProgress(analysisId, {
              companyName: (extraction as any)?.companyName || null,
              sector: (extraction as any)?.sector || null,
              subSector: (extraction as any)?.subSector || null,
              country: (extraction as any)?.country || null,
              geographicHub: (extraction as any)?.geographicHub || null,
              yearFounded: typeof (extraction as any)?.yearFounded === 'number'
                ? (extraction as any).yearFounded : null,
              roundType: (extraction as any)?.roundType
                || (extraction as any)?.roundStage || null,
            }).catch(() => {});
          }

          // ============================================================
          // CONFLITS D INTERET : detection deterministe instantanee
          // ------------------------------------------------------------
          // Compare l identite du fonds qui instruit, son portfolio et
          // ses partenaires de syndicat aux leadInvestor / coInvestors
          // declares dans l extraction. Vide si fundProfile absent ou
          // si pas d acteur en chevauchement. Injecte ensuite en tete
          // du userPrompt de l orchestrateur final pour que la note
          // d instruction soit produite en conscience de la position
          // d interet du fonds. Persiste dans le resultJson sous la
          // cle conflictOfInterest.
          // ============================================================
          const { detectConflictsOfInterest } = await import('@/lib/engines/conflict-of-interest');
          // Enrichit fundProfile avec l identite humaine du partner qui
          // ouvre la note (displayName ou local-part de l email) pour
          // permettre la detection BOARD_INSIDER : si le user est listed
          // comme founder, board member ou advisor du dossier analyse.
          const conflictInputsWithUser = fundProfileForPreScan ? {
            ...fundProfileForPreScan,
            userIdentity: userIdentityForConflict,
          } : (userIdentityForConflict ? {
            fundName: null,
            portfolioCompanies: [],
            syndicatePartners: [],
            userIdentity: userIdentityForConflict,
          } : null);
          const conflictOfInterest = detectConflictsOfInterest(extraction, conflictInputsWithUser);

          // ============================================================
          // MATRICE DE PERTINENCE
          // ------------------------------------------------------------
          // Calcul deterministe instantane des huit criteres
          // structurels du dossier (asset class, modele business, chaine
          // de production, expositions, reproductibilite numerique,
          // funnel d acquisition) et des verdicts de pertinence par
          // moteur. Consomme par les moteurs Bloc 1 pour scoper leur
          // output sur les sous-blocs applicables au dossier.
          // ============================================================
          const matrixAssetClass = normalizeAssetClass(
            `${extraction.sector || ''} ${extraction.subSector || ''}`.trim() || extraction.sector,
          );
          const relevanceMatrix = computeRelevanceMatrix(extraction, matrixAssetClass);

          // ============================================================
          // SECTORAL INTELLIGENCE : resolution de la fiche sectorielle
          // ------------------------------------------------------------
          // Resout le secteur primaire et eventuels secondaires a partir
          // de l extraction, charge la derniere fiche sectorielle
          // persistee en Supabase pour chacun, evalue la fraicheur. Le
          // contexte resultant est passe aux six moteurs sectoriels
          // (macro, blindspot, contrarian, market, fragility, narrative
          // drift) qui l injectent dans leur prompt selon le mapping
          // doctrinal de la decision 6 (resume editorial commun plus
          // dimensions selectives par moteur).
          //
          // Non-bloquant : toute erreur Supabase retourne un contexte
          // mode='no_brief' qui desactive l injection silencieusement,
          // le pipeline continue avec le fonctionnement legacy.
          // ============================================================
          const { resolveSectoralContext } = await import('@/lib/engines/sectoral-injection');
          let sectoralContext: import('@/lib/engines/sectoral-injection').SectoralContext | null = null;
          try {
            sectoralContext = await resolveSectoralContext(extraction);
          } catch (err: any) {
            logException('pipeline.sectoral-injection.resolve', err, { severity: 'warning' });
            sectoralContext = null;
          }

          // ============================================================
          // PIPELINE DEPENDENCY-DRIVEN
          // ------------------------------------------------------------
          // Refonte du V2/V3/V4 historique en lancements pilotes par
          // dependances reelles. Au lieu de barrieres Promise.all rigides
          // entre vagues, chaque moteur attend uniquement ses deps
          // strictes et demarre des qu elles sont resolues. Le scheduler
          // JS prend la responsabilite d ordonnancer les appels Anthropic
          // en concurrence selon ce qui est pret.
          //
          // Topologie effective :
          //
          //   Couche 1 (parallele, gates : extraction)
          //     team, market, macro          (deps : extraction)
          //     financial-extraction         (deps : pitchDeck + BP + extraction)
          //     saas-metrics                 (deps : pitchDeck + BP + extraction)
          //     industrial-metrics           (conditionnel matrice)
          //
          //   Couche 2 (parallele, gates : sous-ensembles couche 1)
          //     benchmarks                   (deps : financial-extraction)
          //     pattern                      (deps : team + market + macro)
          //     blindspot                    (deps : team + market + macro)
          //     contrarian                   (deps : team + market + macro)
          //     narrative-drift              (deps : extraction)
          //     financial-coherence          (deps : market + financial + benchmarks)
          //     tech-claim                   (deps : financial)
          //     execution-friction           (deps : financial)
          //     fragility-structurelle       (deps : market + financial)
          //
          //   Couche 3 (parallele, gates : pattern)
          //     causal                       (deps : team + market + macro + pattern)
          //
          //   Couche 4 (parallele, gates : team + blindspot + causal)
          //     reference-checks
          //
          //   Couche 5 (gate final : tout)
          //     orchestrate
          //
          // Gain critique attendu : sur un dossier ou financial-extraction
          // domine la couche 1, pattern/blindspot/contrarian peuvent
          // demarrer des que team+market+macro sont prets sans attendre
          // financial. Causal pousse demarre des que pattern resout, sans
          // attendre une barriere vague 3 complete. Reference-checks
          // pousse demarre des que causal resout, sans attendre une
          // barriere vague 4 complete. Cumul observe ~70-90s gagnees sur
          // un dossier seed standard, ~120s sur dossier growth ou la
          // couche 1 financial-extraction est plus lourde.
          //
          // Le pic Anthropic reste maitrise : on n autorise pas plus de
          // moteurs simultanes qu avant (le V3 en lancait deja 7-8). On
          // optimise simplement le moment de leur lancement et l ordre
          // dans lequel ils convergent vers orchestrate.
          // ============================================================
          sendStart('team', 'Analyse de l\'equipe fondatrice');
          sendStart('market', 'Analyse du marche');
          sendStart('macro', 'Lecture macro et geopolitique');
          sendStart('financial-extraction', businessPlan ? 'Extraction des donnees financieres (deck + BP)' : 'Extraction des donnees financieres (deck)');

          // Moteur Equipe : skip en parcours growth, calibre early stage.
          // En growth on retourne immediatement un output neutre marque
          // skipped, sans appel LLM. Voir lib/engines/skipped-outputs.ts.
          const teamPromise = (track === 'growth'
            ? Promise.resolve(buildSkippedTeamOutput())
            : analyzeTeam(extraction, undefined, fundDimensionalNotes?.team, runOptions)
          ).then(r => { sendDone('team', r); return r; });

          const marketPromise = analyzeMarket(extraction, fundDimensionalNotes?.market, relevanceMatrix, sectoralContext, runOptions)
            .then(r => { sendDone('market', r); return r; });

          const macroPromise = analyzeMacro(extraction, fundDimensionalNotes?.macro, relevanceMatrix, sectoralContext, runOptions)
            .then(r => { sendDone('macro', r); return r; });

          const financialDataPromise = extractFinancialData(pitchDeck.payload, businessPlan?.payload || null, extraction)
            .then(r => { sendDone('financial-extraction', r); return r; });

          // saas-metrics-engine : extraction LLM dediee NDR et Magic
          // Number. Tourne en parallele de financial-extraction parce
          // qu il a besoin du meme pitch+BP mais cible differemment. En
          // cas d echec, retourne un objet vide qui laisse
          // indicators-engine retomber sur les fallbacks regex. Pas de
          // sendStart pour l instant : pas trace dans l UI de progression
          // Bloc 1, ce qui restera a brancher une fois la valeur du
          // moteur validee sur plusieurs dossiers.
          const saasMetricsPromise = extractSaasMetrics(pitchDeck.payload, businessPlan?.payload || null, extraction);

          // industrial-metrics-engine : extraction LLM dediee aux
          // metriques industrielles (cycle commercial, carnet de
          // commandes, working capital, capex projet, capacite, win
          // rate). Conditionne par la matrice : on ne brule l appel
          // LLM que si le verdict indicatorsIndustrial=full. Sur un
          // dossier SaaS classique, on retourne null sans appel reseau.
          const industrialMetricsPromise = relevanceMatrix.verdicts.indicatorsIndustrial.applicable === 'full'
            ? extractIndustrialMetrics(pitchDeck.payload, businessPlan?.payload || null, extraction)
            : Promise.resolve(null);

          // ============================================================
          // BENCHMARKS : positionnement chiffre du dossier vs marche.
          // Deterministe, instantane. Sortie consommee par les moteurs
          // financiers en aval pour enrichir leur raisonnement. Chaine
          // sur financialDataPromise pour ne bloquer aucun moteur qui
          // n a pas besoin de benchmarks.
          // ============================================================
          const benchmarksPromise = financialDataPromise.then(async (financialData) => {
            try {
              return await analyzeBenchmarks(extraction, financialData);
            } catch (err: any) {
              logException('pipeline.benchmarks', err, {
                severity: 'warning',
                context: { phase: 'benchmarks-deterministic' },
              });
              return null;
            }
          });

          // ============================================================
          // FIN DU BLOC 1 (INSTRUCTION / SCREENING)
          // ------------------------------------------------------------
          // Les moteurs Bloc 2 (Data Room : ledger-parsing, dd-financial,
          // cap-table-parsing, dd-contractual, dd-technical) ne tournent
          // PAS ici. Ils s executent uniquement via la route dediee
          // /api/analyses/[id]/dd-deepen lorsque le VC decide d ouvrir
          // la DD approfondie apres avoir lu le verdict Bloc 1.
          //
          // Cette separation respecte le workflow VC standard :
          //   1. Screening sur pitch + BP (Bloc 1) -> verdict
          //   2. Decision : approfondir / refuser
          //   3. Si on approfondit, demande des pieces data room a la
          //      startup (grand livre, pacte, statuts, cap table, etc.)
          //   4. Run Bloc 2 sur ces pieces (route /dd-deepen)
          // ============================================================

          // ============================================================
          // COUCHE 2 : MOTEURS DE DIAGNOSTIC EN DEP-DRIVEN
          // ------------------------------------------------------------
          // pattern, blindspot, contrarian : besoin uniquement de
          // team+market+macro (les moteurs Equipe-Marche-Macro). Demarrent
          // des que ces trois sont prets, sans attendre financial-extraction.
          //
          // financial-coherence : besoin marche + financial + benchmarks.
          // Demarre quand benchmarks resout (qui resout quand financial
          // resout).
          //
          // tech-claim et execution-friction : besoin financial. Demarrent
          // quand financialDataPromise resout.
          //
          // narrative-drift : besoin uniquement extraction. Pourrait
          // demarrer immediatement, conditionne par la matrice.
          //
          // fragility-structurelle : besoin extraction + market + financial.
          // Demarre quand les deux sont prets.
          //
          // Apres ce refactor, fragility passe de la vague 4 historique a
          // la couche 2 : la barriere artificielle "attendre la fin de la
          // vague 3" est levee. Causal reste sur sa propre couche puisqu il
          // a besoin de pattern (qui appartient lui-meme a la couche 2).
          // ============================================================
          sendStart('pattern', 'Pattern matching contre le corpus de cas');
          sendStart('blindspot', 'Détection des patterns de vigilance critique');
          sendStart('contrarian', 'Détection des singularités contrariennes');
          sendStart('financial-coherence', 'Tests de cohérence financière');
          sendStart('tech-claim', 'Cohérence revendication technologique');
          sendStart('execution-friction', 'Friction d\'exécution');

          // narrative-drift est conditionne par la matrice. Si la matrice
          // declare le moteur non applicable (none), on n emet pas la
          // tuile pipeline pour ne pas afficher un faux skip dans l UI.
          // Le client, lui, voit le verdict de la matrice dans la note.
          const narrativeDriftRequested = relevanceMatrix.verdicts.narrativeDrift.applicable !== 'none'
            || forceNarrativeDriftFlag;
          if (narrativeDriftRequested) {
            sendStart('narrative-drift', 'Lecture du langage');
          }

          // Detection si le moteur Fragilite Structurelle doit tourner.
          // Si au moins un verdict pattern Phase 4 est applicable, on emet
          // la tuile pipeline. Sinon on skip silencieusement (pas de tuile
          // pour eviter un faux skip dans l UI).
          //
          // Mode dev : le flag forceFragility passe par-dessus la matrice
          // et force l execution du moteur. Utile pour valider l UX sur
          // des dossiers seed qui seraient normalement filtres hors-scope
          // par la matrice. Le client envoie ce flag depuis le coin admin.
          const fsVerdicts = relevanceMatrix.verdicts.fragiliteStructurelle;
          const forceFragility = forceFragilityFlag;
          const fragiliteRequested = forceFragility || Object.values(fsVerdicts).some(
            (v) => v.applicable !== 'none',
          );
          if (fragiliteRequested) {
            sendStart('fragility-structurelle', 'Fragilité structurelle');
          }

          const rawSummary = (extraction as any)?.rawSummary || '';

          // Composition du corpus pitch pour narrative-drift. On agrege
          // les champs textuels denses de l extraction. Pas d ingestion
          // d interviews ou de posts a ce stade : ces sources externes
          // arriveront en V2 du moteur. Avec ce seul corpus, l applicabilite
          // calculee par le moteur sera typiquement 'partial' (pas de
          // baseline temporel).
          const narrativeDriftPitchText = [
            (extraction as any)?.rawSummary,
            (extraction as any)?.marketPitch,
            (extraction as any)?.productDescription,
            (extraction as any)?.businessModel,
          ].filter(Boolean).join('\n\n').trim();

          // Pattern Matching : skip en growth, calibre archetypes early.
          // Demarre des que team+market+macro sont prets, sans bloquer
          // sur financial-extraction.
          const patternPromise = (async () => {
            if (track === 'growth') {
              const r = buildSkippedPatternMatchingOutput();
              sendDone('pattern', r);
              return r;
            }
            const [team, market, macro] = await Promise.all([teamPromise, marketPromise, macroPromise]);
            const r = await matchPatterns(extraction, team, market, macro);
            sendDone('pattern', r);
            return r;
          })();

          // Aveuglement : skip en growth, calibre lecture du discours fondateur early.
          const blindspotPromise = (async () => {
            if (track === 'growth') {
              const r = buildSkippedBlindspotOutput();
              sendDone('blindspot', r);
              return r;
            }
            const [team, market, macro] = await Promise.all([teamPromise, marketPromise, macroPromise]);
            const r = await analyzeBlindspots(extraction, team, market, macro, sectoralContext);
            sendDone('blindspot', r);
            return r;
          })();

          const contrarianPromise = (async () => {
            const [team, market, macro] = await Promise.all([teamPromise, marketPromise, macroPromise]);
            const r = await analyzeContrarian(extraction, team, market, macro, sectoralContext);
            sendDone('contrarian', r);
            return r;
          })();

          const financialCoherencePromise = (async () => {
            const [market, financialData, benchmarks] = await Promise.all([
              marketPromise,
              financialDataPromise,
              benchmarksPromise,
            ]);
            const r = await analyzeFinancialCoherence({
              extraction,
              financialData,
              market,
              benchmarks,
              fundNote: fundDimensionalNotes?.financial,
              // Matrice de pertinence : source de verite pour la
              // classification archetypale (six archetypes A a F).
              // Conditionne le gating deterministe des tests
              // applicables avant l appel LLM, voir
              // lib/engines/financial-coherence-archetype.ts.
              relevanceMatrix,
              runOptions,
            });
            sendDone('financial-coherence', r);
            return r;
          })();

          const techClaimPromise = (async () => {
            const financialData = await financialDataPromise;
            try {
              const r = await analyzeTechClaimCoherence(extraction, financialData);
              sendDone('tech-claim', r);
              return r;
            } catch (err: any) {
              logException('pipeline.tech-claim', err, { severity: 'warning' });
              sendDone('tech-claim', null);
              return null;
            }
          })();

          const executionFrictionPromise = (async () => {
            const financialData = await financialDataPromise;
            try {
              const r = await analyzeExecutionFriction(extraction, financialData ?? null, rawSummary);
              sendDone('execution-friction', r);
              return r;
            } catch (err: any) {
              logException('pipeline.execution-friction', err, { severity: 'warning' });
              sendDone('execution-friction', null);
              return null;
            }
          })();

          // narrative-drift : conditionne par la matrice OU forcable par
          // flag dev. En non-applicable, on resoud immediatement sur null
          // (la note saura dire pourquoi a partir du verdict de matrice).
          // En cas d echec LLM, non-bloquant.
          const narrativeDriftPromise = narrativeDriftRequested
            ? (async () => {
                try {
                  const r = await analyzeNarrativeDrift({
                    extraction,
                    pitchText: narrativeDriftPitchText,
                    fundNote: fundDimensionalNotes?.market || null,
                    sectoralContext,
                    assetClass: relevanceMatrix.assetClass,
                  });
                  sendDone('narrative-drift', r);
                  return r;
                } catch (err: any) {
                  logException('pipeline.narrative-drift', err, { severity: 'warning' });
                  sendDone('narrative-drift', null);
                  return null;
                }
              })()
            : Promise.resolve(null);

          // Fragilite Structurelle : remontee de la vague 4 historique a
          // la couche 2 dep-driven. Le moteur n a besoin que de market et
          // financial, deux outputs de la couche 1. Avant ce refactor, il
          // etait artificiellement retenu derriere la barriere vague 3
          // (qui contient des moteurs qu il ne consomme pas).
          //
          // Le moteur s active typiquement a partir de Series B mais
          // certains patterns (regulatory-time-bomb, commoditization-drift
          // sur knowledge work, growth-subsidized sur Series A) peuvent
          // se declencher plus tot selon le profil du dossier.
          const fragilityPromise = fragiliteRequested
            ? (async () => {
                const [market, financialData] = await Promise.all([marketPromise, financialDataPromise]);
                try {
                  const r = await analyzeFragiliteStructurelle(
                    {
                      extraction,
                      financialData: financialData ?? null,
                      marketAnalysis: market,
                      rawPitchText: (extraction as any)?.rawSummary ?? null,
                      sectoralContext,
                    },
                    relevanceMatrix,
                  );
                  sendDone('fragility-structurelle', r);
                  return r;
                } catch (err: any) {
                  logException('pipeline.fragility-structurelle', err, { severity: 'warning' });
                  sendDone('fragility-structurelle', null);
                  return null;
                }
              })()
            : Promise.resolve(null);

          // ============================================================
          // COUCHE 3 : RETOURNEMENT CAUSAL (deps pattern)
          // ------------------------------------------------------------
          // causal consomme patternMatching donc demarre des que pattern
          // resout. En growth, skip avec output neutre. Fragilite Structurelle
          // remplace structurellement causal dans le verdict final pour
          // les dossiers growth (patterns de scale-up vs hypotheses
          // fondatrices), c est pour ca que causal devient un output
          // neutre dans ce track.
          // ============================================================
          sendStart('causal', 'Retournement causal');
          const causalPromise = (async () => {
            if (track === 'growth') {
              const r = buildSkippedCausalOutput();
              sendDone('causal', r);
              return r;
            }
            const [team, market, macro, pattern] = await Promise.all([
              teamPromise, marketPromise, macroPromise, patternPromise,
            ]);
            const r = await performCausalReversal(extraction, team, market, macro, pattern);
            sendDone('causal', r);
            return r;
          })();

          // ============================================================
          // COUCHE 4 : REFERENCE CHECKS (deps team + blindspot + causal)
          // ------------------------------------------------------------
          // generateReferenceChecks consomme extraction, team, blindspot,
          // causal. Demarre des que ces quatre sont prets, sans attendre
          // la convergence finale. Avant ce refactor, reference-checks
          // tournait dans la "vague 5" avec orchestrate : il etait
          // artificiellement retenu derriere la barriere vague 4 alors
          // que ses deps tombaient des que causal resolvait.
          //
          // Non bloquant : si echec, on continue avec null. La note
          // d instruction saura signaler l absence du plan d appels DD
          // terrain comme une degradation non critique.
          // ============================================================
          sendStart('reference-checks', 'Plan d\'appels DD terrain');
          const referenceChecksPromise = (async () => {
            const [team, blindspot, causal] = await Promise.all([
              teamPromise, blindspotPromise, causalPromise,
            ]);
            try {
              const r = await generateReferenceChecks(extraction, team, blindspot, causal);
              sendDone('reference-checks', r);
              return r;
            } catch (err: any) {
              logException('pipeline.reference-checks', err, { severity: 'warning' });
              sendDone('reference-checks', null);
              return null;
            }
          })();

          // ============================================================
          // CONVERGENCE COUCHE 2 + COUCHE 3
          // ------------------------------------------------------------
          // Toutes les promesses lancees ci-dessus convergent ici. Le
          // duree dominante est typiquement causal (qui attend pattern)
          // ou fragility/financial-coherence selon le profil du dossier.
          // ============================================================
          // Chaque promesse est enveloppee par withEngineDeadline (120s
          // max, fallback null loggue). La convergence Promise.all reste
          // donc vivante meme si un moteur particulier depasse sa
          // deadline : Promise.all voit un null a sa place. En surcouche,
          // race contre budgetPromise (600s) pour couper court a un
          // enchainement de deadlines qui saturerait quand meme le mur.
          const [
            team,
            market,
            macro,
            financialData,
            saasMetrics,
            industrialMetrics,
            benchmarks,
            patternMatching,
            blindspotAnalysis,
            contrarianAnalysis,
            financialCoherence,
            techClaimCoherence,
            executionFriction,
            narrativeDrift,
            fragiliteStructurelle,
            causalReversal,
            referenceChecks,
          ] = await Promise.race([
            Promise.all([
              withEngineDeadline('team', teamPromise),
              withEngineDeadline('market', marketPromise),
              withEngineDeadline('macro', macroPromise),
              withEngineDeadline('financial-extraction', financialDataPromise),
              withEngineDeadline('saas-metrics', saasMetricsPromise),
              withEngineDeadline('industrial-metrics', industrialMetricsPromise),
              withEngineDeadline('benchmarks', benchmarksPromise),
              withEngineDeadline('pattern', patternPromise),
              withEngineDeadline('blindspot', blindspotPromise),
              withEngineDeadline('contrarian', contrarianPromise),
              withEngineDeadline('financial-coherence', financialCoherencePromise),
              withEngineDeadline('tech-claim', techClaimPromise),
              withEngineDeadline('execution-friction', executionFrictionPromise),
              withEngineDeadline('narrative-drift', narrativeDriftPromise),
              withEngineDeadline('fragility-structurelle', fragilityPromise),
              withEngineDeadline('causal', causalPromise),
              withEngineDeadline('reference-checks', referenceChecksPromise),
            ]),
            budgetPromise,
          ]);

          // ============================================================
          // COUCHE FINALE : ORCHESTRATION (deps tout)
          // ------------------------------------------------------------
          // orchestrate consomme tous les outputs amont (extraction, team,
          // market, macro, pattern, causal, blindspot, contrarian,
          // narrative-drift, fragility, conflict-of-interest). Demarre des
          // que toutes ses deps sont resolues, donc apres la convergence
          // de la couche 2/3/4.
          //
          // Conserve son retry loop (2 retries avec backoff 2s puis 5s)
          // pour absorber les 529 transitoires d Anthropic. En cas
          // d echec definitif, fallback degrade pour ne pas perdre le
          // pipeline (le partner verra qu il y a eu un probleme et
          // pourra relancer ulterieurement).
          // ============================================================
          sendStart('orchestrate', 'Synthèse finale');

          // Score mecanique calcule a partir des moteurs Bloc 1. Source de
          // verite pour le score global et le verdict, qui ne sont plus
          // produits par l orchestrator LLM. Voir lib/engines/score-calculator.ts
          // pour la formule complete et les seuils.
          const mechanicalScore = computeMechanicalScore({
            team,
            market,
            macro,
            financial: financialCoherence,
            contrarian: contrarianAnalysis,
            blindspot: blindspotAnalysis,
          });

          // Calcul de fourchette de valorisation (deterministe, pas d appel
          // LLM). Croise multiples sectoriels, methode VC inverse, Berkus
          // et Scorecard selon les inputs disponibles. Voir
          // lib/engines/valuation-engine.ts pour les methodes et
          // lib/data/sector-benchmarks.ts pour les plages publiques.
          const valuation = computeValuation({
            extraction,
            financial: financialCoherence,
            financialData,
            team,
            market,
            teamScore: mechanicalScore.dimensions.team.score,
            marketScore: mechanicalScore.dimensions.market.score,
            // Source de verite unique pour l asset class. Sans cette
            // injection, valuation reclassifiait de son cote sur
            // extraction.sector + subSector seul, ratait les dossiers
            // hardware au vocabulaire FR, retombait en saas-b2b par
            // defaut et calibrait la fourchette sur des exits SaaS.
            relevanceMatrix,
          });

          // Calcul des sept indicateurs deal type (Burn multiple, Rule of
          // 40, NDR, Magic Number, Payback CAC, Marge brute, Revenue par
          // employe). Deterministe egalement, lit financialData et
          // saasMetrics et produit un verdict par indicateur confronte
          // aux benchmarks sectoriels par stade. Voir
          // lib/engines/indicators-engine.ts pour la logique et
          // lib/data/indicator-benchmarks.ts pour les seuils calibres
          // OpenView / Bessemer / Pavilion 2024.
          const indicators = computeIndicators({
            extraction,
            financial: financialCoherence,
            financialData,
            saasMetrics,
            industrialMetrics,
            relevanceMatrix,
          });

          const orchestratePromise = (async () => {
            // 2 tentatives max sur orchestrate (attempt=0 puis attempt=1).
            // Reduit du 3 historique a 2 pour ne pas ampiler la latence
            // en incident Anthropic : depuis que le SDK a maxRetries=0,
            // orchestrate est le seul moteur qui conserve une redondance
            // pour absorber les 529 transitoires. Un cumul superieur a
            // 2 essais ne fait plus que rallonger le mur sans changer
            // la probabilite de succes en cas d incident structurel.
            const maxRetries = 1;
            let lastError: any = null;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
              try {
                const result = await orchestrateFinalRecommendation(
                  extraction, team, market, macro, patternMatching, causalReversal,
                  blindspotAnalysis, contrarianAnalysis, fundDimensionalNotes?.general,
                  mechanicalScore,
                  narrativeDrift,
                  fragiliteStructurelle,
                  conflictOfInterest,
                );
                return result;
              } catch (err: any) {
                lastError = err;
                console.warn(`[orchestrate] attempt ${attempt + 1}/${maxRetries + 1} failed:`, err?.message);
                if (attempt < maxRetries) {
                  // Backoff : 2s puis 5s
                  const backoffMs = attempt === 0 ? 2000 : 5000;
                  await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
              }
            }
            // Fallback minimal : on construit une recommandation degradee
            // pour ne pas perdre le pipeline. Le partner verra qu il y a
            // eu un probleme et pourra relancer ulterieurement.
            await logException('pipeline.orchestrate', lastError, {
              severity: 'error',
              context: { attempts: maxRetries + 1, fallback: 'degraded' },
            });
            return {
              verdict: 'A reinstruire',
              successProbability: null,
              failureProbability: null,
              globalScore: null,
              argumentation: 'La synthèse finale n\'a pas pu être produite (échec du moteur d\'orchestration après plusieurs tentatives). Les moteurs Bloc 1 précédents ont néanmoins tourné et leurs résultats sont consultables dans le dashboard. Pour obtenir un verdict complet, relancer l\'analyse sur ce dossier (la plupart des échecs sont transitoires : 529 Anthropic, timeout réseau, surcharge LLM).',
              keyConditions: [],
              blindspotsVsContrarian: null,
              computedScoreBreakdown: null,
              investmentThreshold: null,
              degraded: true,
              degradedReason: lastError?.message || 'orchestrator failed after retries',
            };
          })();

          // Race orchestrate contre le budget global. Meme si orchestrate
          // a son propre retry loop (2 tentatives depuis axis 1), un
          // incident Anthropic prolonge peut le faire depasser le budget
          // residuel apres la convergence des 16 autres moteurs. Le
          // catch general produira alors la note partielle avec les 16
          // premiers aboutis mais sans synthese finale.
          const finalRecommendation = await Promise.race([
            orchestratePromise,
            budgetPromise,
          ]).then(r => {
            sendDone('orchestrate', r);
            return r;
          });

          // ============================================================
          // AUDIT CONSOLIDE DES ASSERTIONS (Niveau 2.B)
          // Parcourt mecaniquement les textes critiques et flagge :
          // - Les noms propres absents du pitch et non taggues
          //   [web]/[inference]
          // - Les conversions de devise non taggues
          // - Les annees inventees non taggues
          // Non bloquant : on remonte les warnings dans le resultat pour
          // que l UI puisse les exposer.
          // ============================================================
          let assertionAudit: any = null;
          try {
            const enginesToAudit: Array<[string, unknown]> = [
              ['team', team],
              ['market', market],
              ['macro', macro],
              ['pattern', patternMatching],
              ['causal', causalReversal],
              ['blindspot', blindspotAnalysis],
              ['contrarian', contrarianAnalysis],
              ['financial-coherence', financialCoherence],
              ['orchestrator', finalRecommendation],
            ];

            const allWarnings: any[] = [];
            const byEngine: Record<string, number> = {};
            const byCategory: Record<string, number> = {};
            const bySeverity: Record<string, number> = {};

            for (const [engineName, engineOutput] of enginesToAudit) {
              if (!engineOutput) continue;
              const report = auditAssertions(engineOutput, extraction);
              if (report.totalWarnings > 0) {
                byEngine[engineName] = report.totalWarnings;
                for (const w of report.warnings) {
                  allWarnings.push({ engine: engineName, ...w });
                }
              }
            }

            for (const w of allWarnings) {
              byCategory[w.category] = (byCategory[w.category] || 0) + 1;
              bySeverity[w.severity] = (bySeverity[w.severity] || 0) + 1;
            }

            assertionAudit = {
              totalWarnings: allWarnings.length,
              byEngine,
              byCategory,
              bySeverity,
              warnings: allWarnings,
            };

            if (allWarnings.length > 0) {
              console.warn(`[assertion-audit] ${allWarnings.length} warnings across engines:`, byCategory);
            }
          } catch (err: any) {
            logException('pipeline.assertion-audit', err, {
              severity: 'warning',
              context: { phase: 'post-pipeline-assertion-audit' },
            });
          }

          // ============================================================
          // VERSION STAMP - tampon de version du run
          // ------------------------------------------------------------
          // Assemble en un seul endroit (lib/instrumentation/version-stamp)
          // le SHA commit, les modeles LLM + temperatures, les hashes
          // des prompts et configs, les hashes des entrees. Persiste
          // sur l analyse pour qu une issue ulterieure puisse la
          // rattacher a la version exacte qui l a produite. Lecture
          // seule, ne change aucun comportement de moteur.
          // ============================================================
          const durationMs = Date.now() - startTime;
          const versionStamp = sealVersionStamp(
            buildVersionStamp({
              inputs: {
                deckBase64: pitchDeck.payload,
                deckBytes: pitchDeck.size,
                pitchText: null,
                bpText: businessPlan?.payload || null,
                additionalFiles: allFileNames.filter(n => n !== pitchDeck.name),
              },
              // Mode de run capture dans le stamp. frozen entre dans le
              // configsHash via runMode (cf version-stamp.ts), asOf reste
              // top-level comme provenance pure sans participation au hash.
              runMode: { frozen, asOf },
            }),
            durationMs,
          );

          const result = {
            meta: {
              filename: pitchDeck.name,
              additionalFiles: allFileNames.filter(n => n !== pitchDeck.name),
              analyzedAt: new Date().toISOString(),
              durationMs,
              engineDurations,
              versionStamp,
            },
            // Flags conflit d interet calcules juste apres extraction
            // (voir bloc CONFLITS D INTERET). Vide sur les dossiers
            // sans signal, present avec severites variables sinon.
            conflictOfInterest,
            preScan,
            extraction,
            financialData,
            team,
            market,
            macro,
            benchmarks,
            patternMatching,
            causalReversal,
            blindspotAnalysis,
            contrarianAnalysis,
            financialCoherence,
            techClaimCoherence,
            executionFriction,
            // Bloc 2 (Data Room) : volontairement non execute ici. Sera
            // peuple par /api/analyses/[id]/dd-deepen quand le VC declenche
            // la DD approfondie. Les champs ledgerExtraction, ddFinancial,
            // capTableExtraction, ddContractual, ddTechnical seront merges
            // dans le resultJson lors de cet appel.
            ledgerExtraction: null,
            ddFinancial: null,
            capTableExtraction: null,
            ddContractual: null,
            ddTechnical: null,
            // Metadonnees des documents techniques uploades. Au Bloc 1
            // (run /api/analyze), on capture seulement les noms : les
            // contenus seront lus au Bloc 2 si les fichiers sont uploades
            // a nouveau via /dd-deepen.
            technicalDocsMeta: {
              count: technicalDocs.length,
              names: technicalDocs.map(t => t.name),
            },
            legalDocumentsMeta: {
              hasShareholdersAgreement: !!shareholdersAgreement,
              shareholdersAgreementName: shareholdersAgreement?.name || null,
              hasStatutes: !!statutes,
              statutesName: statutes?.name || null,
              hasCapTable: !!capTable,
              capTableName: capTable?.name || null,
              clientContractsCount: clientContracts.length,
              clientContractsNames: clientContracts.map(c => c.name),
            },
            finalRecommendation,
            referenceChecks,
            assertionAudit,
            // Fourchette de valorisation : calcul deterministe a partir
            // des moteurs Bloc 1 et des scores mecaniques. Inclut le
            // detail des methodes utilisees (multiples sectoriels, VC
            // method, Berkus, Scorecard) avec leur rationale.
            valuation,
            // Sept indicateurs deal type (Burn multiple, Rule of 40, NDR,
            // Magic Number, Payback CAC, Marge brute, Revenue par
            // employe) confrontes aux benchmarks sectoriels par stade.
            indicators,
            // Extraction LLM dediee aux metriques SaaS recurrentes (NDR,
            // Magic Number, retention metrics). Persiste dans le
            // resultJson pour que le useMemo client-side puisse rejouer
            // computeIndicators sans appel LLM si besoin.
            saasMetrics,
            // Extraction LLM dediee aux metriques industrielles (cycle
            // commercial, carnet de commandes, capex projet, capacite,
            // win rate). null sur les dossiers non industriels.
            industrialMetrics,
            // Matrice de pertinence : criteres structurels du dossier
            // (asset class, modele business, expositions) et verdicts
            // de pertinence par moteur. Consomme par les moteurs en
            // amont, persiste pour alimenter l encart "perimetre d
            // analyse" de la note d investissement.
            relevanceMatrix,
            // Lecture du langage : moteur transversal de derive
            // narrative. Mesure le glissement concret/abstrait du
            // discours sur le corpus du dossier (rawSummary +
            // marketPitch + productDescription + businessModel).
            // null si la matrice declare le moteur non applicable
            // ou si l appel LLM a echoue (non-bloquant).
            narrativeDrift,
            // Fragilite structurelle (Bloc Phase 4) : sept patterns
            // de fragilite cumulee (croissance subventionnee, captivite
            // infrastructure, couts fixes incompressibles, regulation a
            // venir, erosion de defensibilite, fragilite cap table,
            // industrialisation prematuree). Active conditionnellement
            // selon le stade et le profil sectoriel du dossier.
            // null si aucun pattern applicable ou en cas d echec global.
            fragiliteStructurelle,
            // Contexte sectoriel resolu pour ce dossier : fiche
            // primaire (avec sa fraicheur), secondaires eventuels,
            // methodologyNote destinee a la section methode de la
            // note d instruction. null si secteur hors catalogue ou
            // si la resolution Supabase a echoue. Sert au rendu du
            // mini spider chart en tete de note et a l annexe
            // sectorielle en fin de note.
            sectoralContext,
          };

          // ============================================================
          // STATUT TERMINAL : COMPLETED
          // ------------------------------------------------------------
          // La ligne analyses a ete creee a t0 et tenue a jour par
          // flushProgress tout au long du pipeline. On la basule
          // maintenant en status='completed' avec le result_json
          // complet, le verdict, les scores et toutes les metadonnees.
          //
          // L ancien flux passait par persistAnalysisAutomatically
          // qui creait une nouvelle ligne en fin de pipeline. Cela
          // posait deux problemes : (1) si la fonction mourait avant
          // ce point, l analyse etait perdue alors que les credits
          // Anthropic avaient ete brules ; (2) le client recoit
          // l "Analyse introuvable" parce que la ligne n existait
          // jamais. La creation a t0 + update terminal resout les
          // deux d un coup.
          //
          // Non-bloquant : si markAnalysisCompleted echoue (Supabase
          // down, ligne deleted entre temps), on log et on envoie
          // quand meme le complete au client avec le payload complet.
          // Le client peut afficher le resultat meme sans persistance.
          // ============================================================
          let persistOk = false;
          if (analysisId) {
            try {
              const metadata = extractAnalysisMetadata(result);
              persistOk = await markAnalysisCompleted(analysisId, {
                ...metadata,
                companyName: metadata.companyName || (extraction as any)?.companyName || 'Sans nom',
                verdict: metadata.verdict || 'approfondir',
                resultJson: result,
                sourceFilename: pitchDeck.name,
                pipelineDurationMs: durationMs,
                pipelineEnginesStatus: null,
              });
              if (persistOk) {
                console.log(`[api/analyze] analyse ${analysisId} marquee completed`);
              } else {
                console.warn(`[api/analyze] markAnalysisCompleted echec pour ${analysisId}`);
              }
            } catch (persistErr: any) {
              console.error('[api/analyze] persistence exception :', persistErr);
              await logException('api.analyze.persist', persistErr, {
                severity: 'warning',
                context: { phase: 'mark-completed', analysisId },
              });
            }
          }

          // ============================================================
          // PREDICTION RECORD - cliche fige pour la reconciliation
          // ------------------------------------------------------------
          // Pilier preuve. Persiste un snapshot immuable de la
          // prediction qui vient d etre produite : verdict, score
          // global, probabilite de succes, six scores de dimension,
          // version stamp complet. Permet plus tard de calculer une
          // courbe de calibration segmentee par version. Best-effort :
          // si la persistance dediee est down, on log et on continue.
          // Ne pas bloquer le complete event.
          // ============================================================
          if (analysisId && persistOk) {
            try {
              const ownerId = await getCurrentUserId();
              if (ownerId) {
                const reco: any = finalRecommendation || {};
                const successProb = typeof reco.successProbability === 'number'
                  ? reco.successProbability
                  : null;
                await insertPredictionRecord({
                  analysisId,
                  userId: ownerId,
                  verdict: reco.verdict || 'approfondir',
                  globalScore: typeof mechanicalScore.globalScore === 'number'
                    ? mechanicalScore.globalScore
                    : null,
                  successProbability: successProb,
                  dimensions: {
                    team: mechanicalScore.dimensions.team.score,
                    market: mechanicalScore.dimensions.market.score,
                    macro: mechanicalScore.dimensions.macro.score,
                    financial: mechanicalScore.dimensions.financial.score,
                    contrarian: mechanicalScore.dimensions.contrarian.score,
                    vigilance: mechanicalScore.dimensions.vigilance.score,
                  },
                  versionStamp,
                });
              }
            } catch (predErr: any) {
              console.warn('[api/analyze] insertPredictionRecord echec :', predErr?.message);
            }
          }

          // Notifications Slack non bloquantes apres persistance OK.
          // Auparavant gere par /api/analyses cote client : maintenant
          // cote serveur pour que la notif parte meme si le SSE coupe.
          if (persistOk && analysisId && isAuthEnabled()) {
            try {
              const ctx = await getAuthenticatedContext();
              if (ctx) {
                dispatchSlackNotifications({
                  organizationId: ctx.org.id,
                  analysisId,
                  result,
                  baseUrl: req.nextUrl.origin,
                }).catch(() => {});
              }
            } catch (notifErr) {
              console.warn('[api/analyze] dispatch Slack failed silently:', notifErr);
            }
          }

          // Inclut l id de persistance dans le complete event pour
          // que le client puisse rediriger directement sur la note.
          // Mode reste 'new-record' (le versioning automatique a
          // disparu avec la creation a t0 : si re-run sur dossier
          // homonyme, c est un nouveau dossier ; le partner peut
          // ensuite versionner via l UI dediee).
          send('complete', {
            ...result,
            _persisted: {
              saved: persistOk,
              id: analysisId,
              mode: 'new-record',
            },
          });
        } catch (error: any) {
          // Persistence du log structure : permet de retrouver
          // l erreur dans le dashboard admin meme si la connexion
          // SSE client a deja coupe.
          await logException('api.analyze.pipeline', error, {
            severity: 'error',
            context: {
              pitchDeckName: pitchDeck.name,
              hasBP: !!businessPlan,
              forcePrescan,
              budgetExhausted: /^PIPELINE_BUDGET_EXHAUSTED/.test(String(error.message || '')),
              enginesCompleted: Object.keys(engineDurations),
            },
          });

          // Traduction des erreurs Anthropic en messages actionnables
          // pour l utilisateur final. Sans ce traitement, le partner
          // voit un JSON brut illisible dans le bandeau erreur, alors
          // que la cause est souvent une limite cote console Anthropic
          // qu il peut lever lui-meme en deux clics.
          let userMessage = error.message || 'Erreur pipeline';
          const rawMessage = String(error.message || '');
          if (/^PIPELINE_BUDGET_EXHAUSTED/.test(rawMessage)) {
            // Sortie propre sur budget global expire (600s). On produit
            // une note partielle horodatee listant les moteurs qui ont
            // eu le temps d aboutir, pour que le partner sache exactement
            // ou le pipeline a coupe et puisse relancer en connaissance
            // de cause. Sans ce message dedie, le user voyait un tag
            // technique opaque.
            const completed = Object.keys(engineDurations);
            const budgetSeconds = Math.round(RUN_BUDGET_MS / 1000);
            const nowIso = new Date().toISOString();
            userMessage = completed.length === 0
              ? `Budget de temps du run epuise (${budgetSeconds}s) avant qu aucun moteur n aboutisse a ${nowIso}. Signe fort d incident Anthropic ou de web_search bloque sur un upstream lent. Patiente cinq minutes et relance. Si le probleme persiste, verifie https://status.anthropic.com.`
              : `Budget de temps du run epuise (${budgetSeconds}s) a ${nowIso}. ${completed.length} moteur(s) abouti(s) : ${completed.join(', ')}. Les moteurs restants n ont pas eu le temps de resoudre. Relance le dossier pour obtenir une note complete. Si l incident se reproduit, verifie https://status.anthropic.com.`;
            // Emet un event dedie pour que le client puisse afficher un
            // bandeau specifique (note partielle) plutot que la banniere
            // rouge classique. Le champ enginesCompleted permet au client
            // de rendre l etat exact du pipeline au moment du kill.
            send('run-budget-exhausted', {
              budgetMs: RUN_BUDGET_MS,
              enginesCompleted: completed,
              enginesCompletedCount: completed.length,
              exhaustedAt: nowIso,
            });
          } else if (rawMessage.includes('specified API usage limits')) {
            userMessage = 'Limite de consommation Anthropic atteinte. La cle API a un plafond mensuel configure dans la console Anthropic. Pour relancer immediatement les analyses, va sur https://console.anthropic.com/settings/limits et augmente ou supprime le Spend limit. Tu peux aussi consulter ta consommation reelle sur https://console.anthropic.com/settings/usage. La limite se reset automatiquement le 1er du mois suivant.';
          } else if (rawMessage.includes('rate_limit_error') || rawMessage.includes('rate_limit_exceeded')) {
            userMessage = 'Limite de requetes par minute Anthropic temporairement saturee (rafale d analyses simultanees). Patiente une minute et relance. Si le probleme persiste, augmente ton tier dans https://console.anthropic.com/settings/limits.';
          } else if (rawMessage.includes('overloaded_error') || rawMessage.includes('529')) {
            userMessage = 'Surcharge transitoire des serveurs Anthropic. Patiente une minute et relance. C est rare et passager.';
          } else if (rawMessage.includes('credit_balance_too_low') || rawMessage.includes('insufficient_quota')) {
            userMessage = 'Solde de credits Anthropic epuise. Recharge sur https://console.anthropic.com/settings/billing puis relance.';
          }

          // Marque la ligne d analyse en status='failed' avec le
          // message d erreur traduit. Le client peut alors lire
          // /api/analyses/[id]/run-status et afficher l erreur
          // meme apres une coupure SSE. Sans cette ecriture, la
          // ligne restait coincee a status='running' indefiniment.
          if (analysisId) {
            markAnalysisFailed(analysisId, userMessage).catch(() => {});
          }

          send('error', {
            message: userMessage,
            stack: error.stack ? String(error.stack).slice(0, 500) : undefined,
            analysisId,
          });
        } finally {
          clearInterval(heartbeatInterval);
          // Desarmement du timer budget global : evite qu il fire en
          // arriere-plan apres la fin nominale du run et que le SDK
          // Anthropic recoive un abort spurieux sur un run reussi
          // suivant qui partagerait le meme worker Vercel.
          clearTimeout(budgetTimer);
          // Liberation du slot rate-limit. Async fire-and-forget pour
          // ne pas retarder la fermeture du stream. Le cleanup au pire
          // des cas se fait par la purge MAX_JOB_AGE_MS au prochain
          // appel acquireJobSlot.
          if (jobId) {
            const { releaseJobSlot } = await import('@/lib/rate-limit');
            releaseJobSlot(jobId).catch(() => {});
          }
          try { controller.close(); } catch { /* deja close */ }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    // Si le slot a ete acquis avant l erreur, on le libere pour ne
    // pas bloquer l org sur un pipeline qui n a pas demarre.
    if (jobId) {
      try {
        const { releaseJobSlot } = await import('@/lib/rate-limit');
        await releaseJobSlot(jobId);
      } catch (releaseErr) {
        // On log mais on continue : le slot sera de toute facon
        // purge au prochain acquireJobSlot par MAX_JOB_AGE_MS.
        console.warn('[api/analyze] releaseJobSlot echec en catch top-level :', releaseErr);
      }
    }
    // Si la ligne d analyse a ete creee avant l erreur, on la
    // bascule en status='failed' pour qu elle n apparaisse pas
    // indefiniment comme 'running' dans Historique. Le client
    // peut lire le message via /api/analyses/[id]/run-status.
    // Si markAnalysisFailed lui-meme echoue, le cron cleanup-stale-running
    // rattrape la ligne apres le seuil (30 min), mais on log pour
    // que l incident soit visible dans les logs Vercel.
    if (analysisId) {
      try {
        await markAnalysisFailed(analysisId, error?.message || 'Erreur avant pipeline');
      } catch (markErr) {
        console.error(
          '[api/analyze] markAnalysisFailed echec en catch top-level, cleanup cron rattrapera :',
          markErr,
        );
      }
    }
    return new Response(JSON.stringify({ error: error.message || 'Erreur', analysisId }), { status: 500 });
  }
}

/**
 * Helper minimal : devine le MIME type a partir de l extension du
 * nom de fichier quand le client ne fournit pas explicitement le
 * mimeType dans la reference. file-processor accepte les MIMEs
 * approximatifs (il classe surtout par extension du nom), ce
 * fallback suffit donc largement pour eviter d echouer faute de
 * Content-Type cote client.
 */
function guessMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.doc')) return 'application/msword';
  return 'application/octet-stream';
}
