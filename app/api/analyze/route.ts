import { NextRequest } from 'next/server';
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
import { analyzeDDFinancial } from '@/lib/engines/dd-financial-engine';
import { analyzeDDContractual } from '@/lib/engines/dd-contractual-engine';
import { analyzeDDTechnical } from '@/lib/engines/dd-technical-engine';
import { orchestrateFinalRecommendation } from '@/lib/engines/orchestrator';
import { generateReferenceChecks } from '@/lib/engines/reference-checks-engine';
import { auditAssertions } from '@/lib/engines/assertion-validator';
import { parseLedger } from '@/lib/ledger-parser';
import { parseCapTable } from '@/lib/cap-table-parser';
import { processFiles } from '@/lib/file-processor';

// Vercel Pro permet jusqu a 800s par function (13 min). Avec 12+ moteurs
// Claude dont certains prennent 60s+ chacun, on a besoin de cette marge
// pour les dossiers complexes qui mobilisent toute la machinerie. Mesure
// logs prod : pipeline complet 210-300s en fonction de la latence
// Anthropic du moment, parfois plus avec les modules Data Room.
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

    const {
      pitchDeck, businessPlan, generalLedger,
      shareholdersAgreement, statutes, capTable, clientContracts,
      others,
    } = await processFiles(files);

    if (!pitchDeck) {
      return new Response(JSON.stringify({ error: 'Pitch deck PDF requis' }), { status: 400 });
    }

    // Module 3 DD technique : URL du depot GitHub et token PAT optionnel.
    // Inputs textuels separes des fichiers, transmis dans le FormData
    // sous les cles githubRepoUrl et githubToken. Le token n est jamais
    // logge ni persiste dans le payload final, on garde seulement un
    // booleen tokenProvided dans output.audit.
    const githubRepoUrl = (() => {
      const v = formData.get('githubRepoUrl');
      return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
    })();
    const githubToken = (() => {
      const v = formData.get('githubToken');
      return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
    })();

    const startTime = Date.now();
    const allFileNames = [
      pitchDeck.name,
      ...(businessPlan ? [businessPlan.name] : []),
      ...(generalLedger ? [generalLedger.name] : []),
      ...(shareholdersAgreement ? [shareholdersAgreement.name] : []),
      ...(statutes ? [statutes.name] : []),
      ...(capTable ? [capTable.name] : []),
      ...clientContracts.map(c => c.name),
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

        try {
          send('files-received', {
            pitchDeck: pitchDeck.name,
            businessPlan: businessPlan?.name || null,
            generalLedger: generalLedger?.name || null,
            shareholdersAgreement: shareholdersAgreement?.name || null,
            statutes: statutes?.name || null,
            capTable: capTable?.name || null,
            clientContracts: clientContracts.map(c => c.name),
            others: others.map(o => o.name),
          });

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
            analyzeTeam(extraction).then(r => { sendDone('team', r); return r; }),
            analyzeMarket(extraction).then(r => { sendDone('market', r); return r; }),
            analyzeMacro(extraction).then(r => { sendDone('macro', r); return r; }),
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
            console.warn('[benchmarks] engine failed, continuing without:', err?.message);
          }

          // ============================================================
          // TECH CLAIM COHERENCE : audit la revendication technologique.
          // Se declenche uniquement si triggers detectes dans le pitch.
          // Sinon retourne not_applicable sans appel LLM.
          // Non bloquant.
          // ============================================================
          sendStart('tech-claim', 'Coherence revendication technologique');
          let techClaimCoherence: any = null;
          try {
            techClaimCoherence = await analyzeTechClaimCoherence(extraction, financialData);
          } catch (err: any) {
            console.warn('[tech-claim] engine failed, continuing without:', err?.message);
          }
          sendDone('tech-claim', techClaimCoherence);

          // ============================================================
          // EXECUTION FRICTION : 8 axes de friction commerciale et
          // industrielle. Se declenche si au moins 2 flags sur 8.
          // Sinon retourne not_applicable sans appel LLM. Non bloquant.
          // ============================================================
          sendStart('execution-friction', 'Friction d\'execution');
          let executionFriction: any = null;
          try {
            const rawSummary = (extraction as any)?.rawSummary || '';
            executionFriction = await analyzeExecutionFriction(extraction, financialData ?? null, rawSummary);
          } catch (err: any) {
            console.warn('[execution-friction] engine failed, continuing without:', err?.message);
          }
          sendDone('execution-friction', executionFriction);

          // ============================================================
          // BLOC 2 DATA ROOM : MODULE 1 DD FINANCIERE
          // Etape 1 : parsing deterministe du grand livre comptable.
          // Etape 2 : moteur de reconciliation BP vs realite (7 tests +
          // synthese LLM Sonnet). Ne tournent que si BP + grand livre
          // presents, sinon not_applicable.
          // ============================================================
          sendStart('ledger-parsing', 'Parsing grand livre comptable');
          let ledgerExtraction: any = null;
          try {
            if (generalLedger) {
              ledgerExtraction = parseLedger(generalLedger.payload);
            }
          } catch (err: any) {
            console.warn('[ledger-parsing] failed:', err?.message);
          }
          sendDone('ledger-parsing', ledgerExtraction);

          sendStart('dd-financial', 'DD financiere : reconciliation BP vs realite');
          let ddFinancial: any = null;
          try {
            ddFinancial = await analyzeDDFinancial(extraction, financialData ?? null, ledgerExtraction);
          } catch (err: any) {
            console.warn('[dd-financial] engine failed, continuing without:', err?.message);
          }
          sendDone('dd-financial', ddFinancial);

          // ============================================================
          // BLOC 2 DATA ROOM : MODULE 2 DD CONTRACTUELLE
          // Etape 1 : parsing deterministe du cap table.
          // Etape 2 : cartographie LLM des clauses sensibles (pacte,
          // statuts, contrats clients).
          // ============================================================
          sendStart('cap-table-parsing', 'Parsing cap table');
          let capTableExtraction: any = null;
          try {
            if (capTable && (capTable.type === 'excel' || capTable.type === 'csv' || capTable.type === 'pdf')) {
              capTableExtraction = parseCapTable(capTable.payload, capTable.type);
            }
          } catch (err: any) {
            console.warn('[cap-table-parsing] failed:', err?.message);
          }
          sendDone('cap-table-parsing', capTableExtraction);

          sendStart('dd-contractual', 'DD contractuelle : cartographie clauses sensibles');
          let ddContractual: any = null;
          try {
            if (shareholdersAgreement || statutes) {
              ddContractual = await analyzeDDContractual(extraction, {
                shareholdersAgreementPdf: shareholdersAgreement?.payload || null,
                shareholdersAgreementName: shareholdersAgreement?.name || null,
                statutesPdf: statutes?.payload || null,
                statutesName: statutes?.name || null,
                capTableExtraction,
                clientContracts: clientContracts.map(c => ({ name: c.name, pdfBase64: c.payload })),
              });
            }
          } catch (err: any) {
            console.warn('[dd-contractual] engine failed, continuing without:', err?.message);
          }
          sendDone('dd-contractual', ddContractual);

          // ============================================================
          // BLOC 2 DATA ROOM : MODULE 3 DD TECHNIQUE
          // Audit deterministe d un depot GitHub via l API REST v3 :
          // qualite de la discipline d ingenierie, dette technique
          // observable, cadence des releases, securite basique. Aucun
          // appel LLM, dix tests structures avec evidence chiffree et
          // questions DD ciblees. Ne tourne que si l URL est fournie
          // dans le formulaire. Le token est optionnel : sans token, le
          // moteur reste fonctionnel sur depots publics avec un rate
          // limit reduit (60 req/h) et certains champs securite
          // structurellement non observables.
          // ============================================================
          sendStart('dd-technical', 'DD technique : audit du depot GitHub');
          let ddTechnical: any = null;
          try {
            ddTechnical = await analyzeDDTechnical(githubRepoUrl, githubToken);
          } catch (err: any) {
            console.warn('[dd-technical] engine failed, continuing without:', err?.message);
          }
          sendDone('dd-technical', ddTechnical);

          // ============================================================
          // VAGUE 3 : PATTERN MATCHING
          // ============================================================
          sendStart('pattern', 'Pattern matching contre le corpus de cas');
          const patternMatching = await matchPatterns(extraction, team, market, macro);
          sendDone('pattern', patternMatching);

          // ============================================================
          // VAGUE 4 : DIALECTIQUE EN PARALLELE
          // (causal, blindspot, contrarian, financial-coherence)
          // ============================================================
          sendStart('causal', 'Retournement causal');
          sendStart('blindspot', 'Detection des patterns de vigilance critique');
          sendStart('contrarian', 'Detection des singularites contrariennes');
          sendStart('financial-coherence', 'Tests de coherence financiere');

          const [causalReversal, blindspotAnalysis, contrarianAnalysis, financialCoherence] = await Promise.all([
            performCausalReversal(extraction, team, market, macro, patternMatching).then(r => { sendDone('causal', r); return r; }),
            analyzeBlindspots(extraction, team, market, macro).then(r => { sendDone('blindspot', r); return r; }),
            analyzeContrarian(extraction, team, market, macro).then(r => { sendDone('contrarian', r); return r; }),
            analyzeFinancialCoherence(extraction, financialData, market, benchmarks).then(r => { sendDone('financial-coherence', r); return r; }),
          ]);

          // ============================================================
          // VAGUE 5 : ORCHESTRATION FINALE
          // ============================================================
          sendStart('orchestrate', 'Synthese finale');
          const finalRecommendation = await orchestrateFinalRecommendation(
            extraction, team, market, macro, patternMatching, causalReversal,
            blindspotAnalysis, contrarianAnalysis
          );
          sendDone('orchestrate', finalRecommendation);

          // ============================================================
          // REFERENCE CHECKS : plan d'appels DD terrain.
          // Non bloquant : si echec, on continue sans cette section.
          // ============================================================
          sendStart('reference-checks', 'Plan d\'appels DD terrain');
          let referenceChecks: any = null;
          try {
            referenceChecks = await generateReferenceChecks(
              extraction, team, blindspotAnalysis, causalReversal,
            );
          } catch (err: any) {
            console.warn('[reference-checks] engine failed, continuing without:', err?.message);
          }
          sendDone('reference-checks', referenceChecks);

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
            console.warn('[assertion-audit] failed, continuing without:', err?.message);
          }

          const result = {
            meta: {
              filename: pitchDeck.name,
              additionalFiles: allFileNames.filter(n => n !== pitchDeck.name),
              analyzedAt: new Date().toISOString(),
              durationMs: Date.now() - startTime,
              engineDurations,
            },
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
            ledgerExtraction,
            ddFinancial,
            capTableExtraction,
            ddContractual,
            ddTechnical,
            // Metadonnees des documents juridiques uploades, sans payloads
            // bruts : on n expose que les noms et la presence pour ne pas
            // persister de documents juridiques sensibles dans result_json.
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
          console.error('Erreur pipeline:', error);
          send('error', { message: error.message || 'Erreur pipeline' });
        } finally {
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
