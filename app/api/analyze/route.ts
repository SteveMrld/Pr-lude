import { NextRequest } from 'next/server';
import { runPreScan } from '@/lib/engines/prescan-engine';
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
import { orchestrateFinalRecommendation } from '@/lib/engines/orchestrator';
import { generateReferenceChecks } from '@/lib/engines/reference-checks-engine';
import { auditAssertions } from '@/lib/engines/assertion-validator';
import { processFiles } from '@/lib/file-processor';
import { logException } from '@/lib/error-logger';

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
  try {
    const formData = await req.formData();

    // Recuperer tous les fichiers
    const files: File[] = [];
    const filesEntries = formData.getAll('files');
    for (const entry of filesEntries) {
      if (entry instanceof File) files.push(entry);
    }
    // Compat ascendante
    const legacyFile = formData.get('pitchdeck');
    if (legacyFile instanceof File) files.push(legacyFile);

    if (files.length === 0) {
      return new Response(JSON.stringify({ error: 'Au moins un fichier requis' }), { status: 400 });
    }

    // Flag d override du gating pre-scan. Si le pre-scan retourne un
    // verdict not_recommended (knockout), le pipeline s arrete par defaut
    // et l UI propose au partner de relancer avec ce flag a true s il
    // veut analyser le dossier malgre le verdict du Bloc 0. Permet
    // l economie reelle des credits LLM sur les dossiers eliminatoires
    // sans retirer le pouvoir de decision au partner.
    const forcePrescanRaw = formData.get('forcePrescan');
    const forcePrescan = forcePrescanRaw === 'true' || forcePrescanRaw === '1';

    const {
      pitchDeck, businessPlan, generalLedger,
      shareholdersAgreement, statutes, capTable, clientContracts,
      technicalDocs,
      others,
    } = await processFiles(files);

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
    try {
      const { isAuthEnabled, getAuthenticatedContext } = await import('@/lib/auth');
      if (isAuthEnabled()) {
        const ctx = await getAuthenticatedContext();
        if (ctx) {
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

        function send(eventType: string, data: any) {
          const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        }

        function sendStart(engine: string, label: string) {
          engineStartedAt[engine] = Date.now();
          send('engine-start', { engine, label });
        }

        function sendDone(engine: string, output: any) {
          const startedAt = engineStartedAt[engine];
          const durationMs = startedAt != null ? Date.now() - startedAt : null;
          if (durationMs != null) engineDurations[engine] = durationMs;
          send('engine-done', { engine, output, durationMs });
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

        try {
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
          sendStart('prescan', fundProfileForPreScan
            ? 'Pré-scan : triage rapide dix tests (six universels et quatre fit thèse)'
            : 'Pré-scan : triage rapide six tests éliminatoires');
          let preScan: any = null;
          try {
            preScan = await runPreScan(pitchDeck.payload, fundProfileForPreScan || undefined);
          } catch (err: any) {
            logException('pipeline.prescan', err, {
              severity: 'warning',
              context: { phase: 'prescan-bloc-0' },
            });
          }
          sendDone('prescan', preScan);

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

          // ============================================================
          // VAGUE 2 : DIAGNOSTICS FONDAMENTAUX EN PARALLELE
          // (team, market, macro, financial-extraction)
          // ============================================================
          sendStart('team', 'Analyse de l\'equipe fondatrice');
          sendStart('market', 'Analyse du marche');
          sendStart('macro', 'Lecture macro et geopolitique');
          sendStart('financial-extraction', businessPlan ? 'Extraction des donnees financieres (deck + BP)' : 'Extraction des donnees financieres (deck)');

          const [team, market, macro, financialData] = await Promise.all([
            analyzeTeam(extraction, undefined, fundDimensionalNotes?.team).then(r => { sendDone('team', r); return r; }),
            analyzeMarket(extraction, fundDimensionalNotes?.market).then(r => { sendDone('market', r); return r; }),
            analyzeMacro(extraction, fundDimensionalNotes?.macro).then(r => { sendDone('macro', r); return r; }),
            extractFinancialData(pitchDeck.payload, businessPlan?.payload || null, extraction).then(r => { sendDone('financial-extraction', r); return r; }),
          ]);

          // ============================================================
          // BENCHMARKS : positionnement chiffre du dossier vs marche.
          // Deterministe, instantane. Sortie consommee par les moteurs
          // financiers en aval pour enrichir leur raisonnement.
          // Non bloquant : si echec, on continue.
          // ============================================================
          let benchmarks: any = null;
          try {
            benchmarks = await analyzeBenchmarks(extraction, financialData);
          } catch (err: any) {
            logException('pipeline.benchmarks', err, {
              severity: 'warning',
              context: { phase: 'benchmarks-deterministic' },
            });
          }

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
          // VAGUE 3 : SIX MOTEURS EN PARALLELE
          // ------------------------------------------------------------
          // Audit fonctionnel a constate que pattern, blindspot, contrarian,
          // financial-coherence, tech-claim et execution-friction sont
          // mutuellement independants : aucun n attend le resultat d un
          // autre. Les six peuvent demarrer simultanement des que la vague
          // 2 (extraction + team + market + macro + financial-extraction)
          // est terminee. Avant ce commit, ils tournaient en sequence
          // (~250s cumules) puis pattern bloquait la vague suivante.
          //
          // Apres : Promise.all sur les six. Duree dominee par le plus
          // lent (typiquement blindspot 60-90s). Gain ~140s sur le temps
          // total du pipeline.
          //
          // Risque maitrise : six appels Anthropic en pic. Sur Tier 2
          // (80k TPM Sonnet input), un dossier deeptech complexe peut
          // pousser ~200k tokens en pic. La fenetre rate limit etant par
          // minute glissante, le pic est etale sur 60-90s donc tient.
          // Surveiller les 429 Anthropic dans les logs si symptomes.
          // ============================================================
          sendStart('pattern', 'Pattern matching contre le corpus de cas');
          sendStart('blindspot', 'Détection des patterns de vigilance critique');
          sendStart('contrarian', 'Détection des singularités contrariennes');
          sendStart('financial-coherence', 'Tests de cohérence financière');
          sendStart('tech-claim', 'Cohérence revendication technologique');
          sendStart('execution-friction', 'Friction d\'exécution');

          const rawSummary = (extraction as any)?.rawSummary || '';

          const [
            patternMatching,
            blindspotAnalysis,
            contrarianAnalysis,
            financialCoherence,
            techClaimCoherence,
            executionFriction,
          ] = await Promise.all([
            matchPatterns(extraction, team, market, macro)
              .then(r => { sendDone('pattern', r); return r; }),
            analyzeBlindspots(extraction, team, market, macro)
              .then(r => { sendDone('blindspot', r); return r; }),
            analyzeContrarian(extraction, team, market, macro)
              .then(r => { sendDone('contrarian', r); return r; }),
            analyzeFinancialCoherence(extraction, financialData, market, benchmarks, fundDimensionalNotes?.financial)
              .then(r => { sendDone('financial-coherence', r); return r; }),
            analyzeTechClaimCoherence(extraction, financialData)
              .then(r => { sendDone('tech-claim', r); return r; })
              .catch(err => { logException('pipeline.tech-claim', err, { severity: 'warning' }); sendDone('tech-claim', null); return null; }),
            analyzeExecutionFriction(extraction, financialData ?? null, rawSummary)
              .then(r => { sendDone('execution-friction', r); return r; })
              .catch(err => { logException('pipeline.execution-friction', err, { severity: 'warning' }); sendDone('execution-friction', null); return null; }),
          ]);

          // ============================================================
          // VAGUE 4 : RETOURNEMENT CAUSAL
          // ------------------------------------------------------------
          // Sequentiel apres pattern. Le seul moteur Bloc 1 qui necessite
          // patternMatching dans ses inputs (les autres ont ete deplaces
          // en vague 3 parallele).
          // ============================================================
          sendStart('causal', 'Retournement causal');
          const causalReversal = await performCausalReversal(extraction, team, market, macro, patternMatching);
          sendDone('causal', causalReversal);

          // ============================================================
          // VAGUE 5 : ORCHESTRATION FINALE ET REFERENCE CHECKS EN PARALLELE
          // ------------------------------------------------------------
          // orchestrate consomme tous les outputs amont (extraction, team,
          // market, macro, pattern, causal, blindspot, contrarian) mais
          // PAS reference-checks. reference-checks consomme extraction,
          // team, blindspot, causal mais PAS orchestrate. Les deux sont
          // donc parallelisables. Gain ~40s sur le temps total.
          //
          // orchestrate garde son retry loop (2 retries avec backoff)
          // pour absorber les 529 transitoires d Anthropic. reference-
          // checks reste non-bloquant : si echec, on continue sans cette
          // section.
          // ============================================================
          sendStart('orchestrate', 'Synthèse finale');
          sendStart('reference-checks', 'Plan d\'appels DD terrain');

          const orchestratePromise = (async () => {
            const maxRetries = 2;
            let lastError: any = null;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
              try {
                const result = await orchestrateFinalRecommendation(
                  extraction, team, market, macro, patternMatching, causalReversal,
                  blindspotAnalysis, contrarianAnalysis, fundDimensionalNotes?.general,
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

          const referenceChecksPromise = generateReferenceChecks(
            extraction, team, blindspotAnalysis, causalReversal,
          ).catch(err => {
            logException('pipeline.reference-checks', err, { severity: 'warning' });
            return null;
          });

          const [finalRecommendation, referenceChecks] = await Promise.all([
            orchestratePromise.then(r => { sendDone('orchestrate', r); return r; }),
            referenceChecksPromise.then(r => { sendDone('reference-checks', r); return r; }),
          ]);

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

          const result = {
            meta: {
              filename: pitchDeck.name,
              additionalFiles: allFileNames.filter(n => n !== pitchDeck.name),
              analyzedAt: new Date().toISOString(),
              durationMs: Date.now() - startTime,
              engineDurations,
            },
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
          };

          send('complete', result);
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
            },
          });
          send('error', {
            message: error.message || 'Erreur pipeline',
            stack: error.stack ? String(error.stack).slice(0, 500) : undefined,
          });
        } finally {
          clearInterval(heartbeatInterval);
          controller.close();
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
    return new Response(JSON.stringify({ error: error.message || 'Erreur' }), { status: 500 });
  }
}
