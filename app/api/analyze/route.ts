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
import { orchestrateFinalRecommendation } from '@/lib/engines/orchestrator';
import { generateReferenceChecks } from '@/lib/engines/reference-checks-engine';
import { processFiles } from '@/lib/file-processor';

// Vercel Pro permet jusqu a 800s par function (13 min). Avec 12 moteurs
// Claude dont certains prennent 60s+ chacun, on a besoin de cette marge
// pour les dossiers complexes type Pen Group qui mobilisent toute la
// machinerie. Mesure logs prod : pipeline complet ~210-300s en fonction
// de la latence Anthropic du moment.
export const maxDuration = 800;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Récupérer tous les fichiers
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

    // Streaming SSE simple comme dans la version qui marchait
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Capture des startedAt par moteur pour calculer la duree
        // a l envoi de l event done. Permet aussi d emettre la duree
        // dans le payload final (result.meta.engineDurations) pour
        // la persistance et le re-affichage en historique.
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
            others: others.map(o => o.name),
          });

          // Moteur 1 : Extraction
          sendStart('extraction', 'Extraction du contenu du pitch deck');
          const extraction = await extractFromDeck(pitchDeck.payload);
          sendDone('extraction', extraction);

          // Moteurs 2, 3, 4 + Extraction financière en parallèle
          sendStart('team', 'Analyse de l\'équipe fondatrice');
          sendStart('market', 'Analyse du marché');
          sendStart('macro', 'Lecture macro et géopolitique');
          sendStart('financial-extraction', businessPlan ? 'Extraction des données financières (deck + BP)' : 'Extraction des données financières (deck)');

          const [team, market, macro, financialData] = await Promise.all([
            analyzeTeam(extraction).then(r => { sendDone('team', r); return r; }),
            analyzeMarket(extraction).then(r => { sendDone('market', r); return r; }),
            analyzeMacro(extraction).then(r => { sendDone('macro', r); return r; }),
            extractFinancialData(pitchDeck.payload, businessPlan?.payload || null, extraction).then(r => { sendDone('financial-extraction', r); return r; }),
          ]);

          // Moteur 5 : Pattern Matching
          sendStart('pattern', 'Pattern matching contre le corpus de cas');
          const patternMatching = await matchPatterns(extraction, team, market, macro);
          sendDone('pattern', patternMatching);

          // Moteurs 6, 7, 8, 14 en parallèle
          sendStart('causal', 'Retournement causal');
          sendStart('blindspot', 'Détection des patterns de vigilance critique');
          sendStart('contrarian', 'Détection des singularités contrariennes');
          sendStart('financial-coherence', 'Tests de cohérence financière');

          const [causalReversal, blindspotAnalysis, contrarianAnalysis, financialCoherence] = await Promise.all([
            performCausalReversal(extraction, team, market, macro, patternMatching).then(r => { sendDone('causal', r); return r; }),
            analyzeBlindspots(extraction, team, market, macro).then(r => { sendDone('blindspot', r); return r; }),
            analyzeContrarian(extraction, team, market, macro).then(r => { sendDone('contrarian', r); return r; }),
            analyzeFinancialCoherence(extraction, financialData, market).then(r => { sendDone('financial-coherence', r); return r; }),
          ]);

          // Moteur 11 : Orchestration finale
          sendStart('orchestrate', 'Synthèse finale');
          const finalRecommendation = await orchestrateFinalRecommendation(
            extraction, team, market, macro, patternMatching, causalReversal,
            blindspotAnalysis, contrarianAnalysis
          );
          sendDone('orchestrate', finalRecommendation);

          // Moteur 12 : Reference Checks (plan d appels DD terrain).
          // Genere le plan d appels (founders, customers, board) avec questions
          // calibrees Golden Seeds / GCV. Non-bloquant : si echec, on continue
          // sans cette section et le bandeau pipeline marque l etape comme
          // 'done' avec output null (l UI affichera juste 'pas de plan d appels
          // disponible' au lieu de planter).
          //
          // Bug historique corrige ici : auparavant cette route /api/analyze
          // s arretait a l orchestration et envoyait directement send('complete'),
          // alors que la liste ENGINES cote client comporte 12 moteurs. Le
          // bandeau pipeline restait donc bloque sur l etape 'reference-checks'
          // en statut 'idle' apres le verdict. Le moteur ne tournait que dans
          // lib/pipeline-runner.ts qui n est pas utilise par la route en live.
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

          const result = {
            meta: {
              filename: pitchDeck.name,
              additionalFiles: allFileNames.filter(n => n !== pitchDeck.name),
              analyzedAt: new Date().toISOString(),
              durationMs: Date.now() - startTime,
              // Durees par moteur en ms, captees au fil du run. Permet
              // a l UI historique d afficher les durees individuelles
              // sans avoir a refaire tourner le pipeline ni a recalculer
              // depuis startedAt / completedAt.
              engineDurations,
            },
            extraction,
            financialData,
            team,
            market,
            macro,
            patternMatching,
            causalReversal,
            blindspotAnalysis,
            contrarianAnalysis,
            financialCoherence,
            finalRecommendation,
            referenceChecks,
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
