import { NextRequest } from 'next/server';
import { processFiles } from '@/lib/file-processor';
import { getJobStore } from '@/lib/job-store';
import { runPipeline } from '@/lib/pipeline-runner';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Le jobId est généré par le client avant l'upload pour permettre le polling
    // même si la connexion POST se coupe en cours (cas mobile)
    const clientJobId = formData.get('jobId');
    if (!clientJobId || typeof clientJobId !== 'string') {
      return new Response(JSON.stringify({ error: 'jobId manquant' }), { status: 400 });
    }

    const files: File[] = [];
    const filesEntries = formData.getAll('files');
    for (const entry of filesEntries) {
      if (entry instanceof File) files.push(entry);
    }

    if (files.length === 0) {
      return new Response(JSON.stringify({ error: 'Au moins un fichier requis' }), { status: 400 });
    }

    const { pitchDeck, businessPlan, others } = await processFiles(files);

    if (!pitchDeck) {
      return new Response(JSON.stringify({ error: 'Pitch deck PDF requis' }), { status: 400 });
    }

    const store = getJobStore();
    await store.createWithId(clientJobId);
    await store.update(clientJobId, {
      status: 'running',
      filesReceived: {
        pitchDeck: pitchDeck.name,
        businessPlan: businessPlan?.name || null,
        others: others.map(o => o.name),
      },
    });

    // Lancer le pipeline. La fonction POST attend sa fin (jusqu'au maxDuration de 300s).
    // Si le client se déconnecte (mobile), le pipeline continue côté serveur et écrit dans le store.
    // Le client peut ensuite poller GET /api/jobs/[id] pour récupérer l'état.
    await runPipeline({
      jobId: clientJobId,
      pitchDeckPayload: pitchDeck.payload,
      pitchDeckName: pitchDeck.name,
      businessPlanPayload: businessPlan?.payload || null,
      businessPlanName: businessPlan?.name || null,
      otherFileNames: others.map(o => o.name),
    });

    const finalJob = await store.get(clientJobId);
    return new Response(
      JSON.stringify({ jobId: clientJobId, status: finalJob?.status || 'complete' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Erreur' }), { status: 500 });
  }
}
