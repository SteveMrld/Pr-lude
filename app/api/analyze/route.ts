import { NextRequest } from 'next/server';
import { extractFromDeck } from '@/lib/engines/extraction-engine';
import { analyzeTeam } from '@/lib/engines/team-engine';
import { analyzeMarket } from '@/lib/engines/market-engine';
import { analyzeMacro } from '@/lib/engines/macro-engine';
import { matchPatterns } from '@/lib/engines/pattern-engine';
import { performCausalReversal } from '@/lib/engines/causal-engine';
import { orchestrateFinalRecommendation } from '@/lib/engines/orchestrator';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('pitchdeck') as File;

    if (!file || !file.type.includes('pdf')) {
      return new Response(JSON.stringify({ error: 'PDF requis' }), { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Pdf = Buffer.from(arrayBuffer).toString('base64');
    const startTime = Date.now();

    // Streaming SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        function send(eventType: string, data: any) {
          const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        }

        try {
          // Moteur 1 : Extraction
          send('engine-start', { engine: 'extraction', label: 'Extraction du contenu du pitch deck' });
          const extraction = await extractFromDeck(base64Pdf);
          send('engine-done', { engine: 'extraction', output: extraction });

          // Moteurs 2, 3, 4 en parallèle (équipe, marché, macro)
          send('engine-start', { engine: 'team', label: 'Analyse de l\'équipe fondatrice' });
          send('engine-start', { engine: 'market', label: 'Analyse du marché et de la concurrence' });
          send('engine-start', { engine: 'macro', label: 'Lecture macro et géopolitique' });

          const [team, market, macro] = await Promise.all([
            analyzeTeam(extraction).then(r => { send('engine-done', { engine: 'team', output: r }); return r; }),
            analyzeMarket(extraction).then(r => { send('engine-done', { engine: 'market', output: r }); return r; }),
            analyzeMacro(extraction).then(r => { send('engine-done', { engine: 'macro', output: r }); return r; }),
          ]);

          // Moteur 5 : Pattern Matching (consomme outputs 1, 2, 3, 4)
          send('engine-start', { engine: 'pattern', label: 'Pattern matching contre le corpus de 32 cas' });
          const patternMatching = await matchPatterns(extraction, team, market, macro);
          send('engine-done', { engine: 'pattern', output: patternMatching });

          // Moteur 6 : Retournement Causal
          send('engine-start', { engine: 'causal', label: 'Retournement causal et identification des angles morts' });
          const causalReversal = await performCausalReversal(extraction, team, market, macro, patternMatching);
          send('engine-done', { engine: 'causal', output: causalReversal });

          // Moteur 7 : Orchestration
          send('engine-start', { engine: 'orchestrate', label: 'Synthèse et recommandation finale' });
          const finalRecommendation = await orchestrateFinalRecommendation(
            extraction, team, market, macro, patternMatching, causalReversal
          );
          send('engine-done', { engine: 'orchestrate', output: finalRecommendation });

          // Résultat final consolidé
          const result = {
            meta: {
              filename: file.name,
              analyzedAt: new Date().toISOString(),
              durationMs: Date.now() - startTime,
            },
            extraction,
            team,
            market,
            macro,
            patternMatching,
            causalReversal,
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
