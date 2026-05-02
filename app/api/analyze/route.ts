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

    const { pitchDeck, businessPlan, others } = await processFiles(files);

    if (!pitchDeck) {
      return new Response(JSON.stringify({ error: 'Pitch deck PDF requis' }), { status: 400 });
    }

    const startTime = Date.now();
    const allFileNames = [pitchDeck.name, ...(businessPlan ? [businessPlan.name] : []), ...others.map(o => o.name)];

    // Streaming SSE simple comme dans la version qui marchait
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        function send(eventType: string, data: any) {
          const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        }

        try {
          send('files-received', {
            pitchDeck: pitchDeck.name,
            businessPlan: businessPlan?.name || null,
            others: others.map(o => o.name),
          });

          // Moteur 1 : Extraction
          send('engine-start', { engine: 'extraction', label: 'Extraction du contenu du pitch deck' });
          const extraction = await extractFromDeck(pitchDeck.payload);
          send('engine-done', { engine: 'extraction', output: extraction });

          // Moteurs 2, 3, 4 + Extraction financière en parallèle
          send('engine-start', { engine: 'team', label: 'Analyse de l\'équipe fondatrice' });
          send('engine-start', { engine: 'market', label: 'Analyse du marché' });
          send('engine-start', { engine: 'macro', label: 'Lecture macro et géopolitique' });
          send('engine-start', { engine: 'financial-extraction', label: businessPlan ? 'Extraction des données financières (deck + BP)' : 'Extraction des données financières (deck)' });

          const [team, market, macro, financialData] = await Promise.all([
            analyzeTeam(extraction).then(r => { send('engine-done', { engine: 'team', output: r }); return r; }),
            analyzeMarket(extraction).then(r => { send('engine-done', { engine: 'market', output: r }); return r; }),
            analyzeMacro(extraction).then(r => { send('engine-done', { engine: 'macro', output: r }); return r; }),
            extractFinancialData(pitchDeck.payload, businessPlan?.payload || null, extraction).then(r => { send('engine-done', { engine: 'financial-extraction', output: r }); return r; }),
          ]);

          // Moteur 5 : Pattern Matching
          send('engine-start', { engine: 'pattern', label: 'Pattern matching contre le corpus de cas' });
          const patternMatching = await matchPatterns(extraction, team, market, macro);
          send('engine-done', { engine: 'pattern', output: patternMatching });

          // Moteurs 6, 7, 8, 14 en parallèle
          send('engine-start', { engine: 'causal', label: 'Retournement causal' });
          send('engine-start', { engine: 'blindspot', label: 'Détection des patterns d\'aveuglement collectif' });
          send('engine-start', { engine: 'contrarian', label: 'Détection des singularités contrariennes' });
          send('engine-start', { engine: 'financial-coherence', label: 'Tests de cohérence financière' });

          const [causalReversal, blindspotAnalysis, contrarianAnalysis, financialCoherence] = await Promise.all([
            performCausalReversal(extraction, team, market, macro, patternMatching).then(r => { send('engine-done', { engine: 'causal', output: r }); return r; }),
            analyzeBlindspots(extraction, team, market, macro).then(r => { send('engine-done', { engine: 'blindspot', output: r }); return r; }),
            analyzeContrarian(extraction, team, market, macro).then(r => { send('engine-done', { engine: 'contrarian', output: r }); return r; }),
            analyzeFinancialCoherence(extraction, financialData, market).then(r => { send('engine-done', { engine: 'financial-coherence', output: r }); return r; }),
          ]);

          // Moteur 11 : Orchestration finale
          send('engine-start', { engine: 'orchestrate', label: 'Synthèse finale' });
          const finalRecommendation = await orchestrateFinalRecommendation(
            extraction, team, market, macro, patternMatching, causalReversal,
            blindspotAnalysis, contrarianAnalysis
          );
          send('engine-done', { engine: 'orchestrate', output: finalRecommendation });

          const result = {
            meta: {
              filename: pitchDeck.name,
              additionalFiles: allFileNames.filter(n => n !== pitchDeck.name),
              analyzedAt: new Date().toISOString(),
              durationMs: Date.now() - startTime,
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
