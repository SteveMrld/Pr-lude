import { NextRequest } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { processFiles } from '@/lib/file-processor';
import { getJobStore } from '@/lib/job-store';
import { runPipeline } from '@/lib/pipeline-runner';

export const maxDuration = 600; // 10 minutes max (couvre les pipelines les plus longs)
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Le jobId est genere par le client AVANT l'upload. Cela permet :
    //  1. au client de commencer a poller immediatement apres reception de la response
    //  2. de reprendre le polling apres un reload (jobId stocke en localStorage)
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

    // CLE DE L'ARCHITECTURE : on schedule le pipeline avec waitUntil() pour qu'il
    // tourne EN ARRIERE-PLAN apres l'envoi de la response. Le client recoit
    // immediatement le jobId et commence a poller. Si la connexion mobile coupe
    // pendant le pipeline, ce n'est plus un probleme : le pipeline continue sur
    // Vercel et ecrit son resultat dans Supabase. Le client reprend des qu'il
    // peut a nouveau communiquer.
    waitUntil(
      runPipeline({
        jobId: clientJobId,
        pitchDeckPayload: pitchDeck.payload,
        pitchDeckName: pitchDeck.name,
        businessPlanPayload: businessPlan?.payload || null,
        businessPlanName: businessPlan?.name || null,
        otherFileNames: others.map(o => o.name),
      }).catch(async (err: any) => {
        console.error('Background pipeline error:', err);
        try {
          await getJobStore().setError(clientJobId, err?.message || 'Erreur pipeline');
        } catch (_e) {
          // Last-ditch error logging, swallow
        }
      })
    );

    // Retour immediat. Le client peut commencer a poller GET /api/jobs/[id].
    return new Response(
      JSON.stringify({ jobId: clientJobId, status: 'running' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Erreur' }), { status: 500 });
  }
}
