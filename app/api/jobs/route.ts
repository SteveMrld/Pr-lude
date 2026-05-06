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

    const {
      pitchDeck, businessPlan, generalLedger,
      shareholdersAgreement, statutes, capTable, clientContracts,
      others,
    } = await processFiles(files);

    if (!pitchDeck) {
      return new Response(JSON.stringify({ error: 'Pitch deck PDF requis' }), { status: 400 });
    }

    // Module 3 DD technique : URL et token GitHub passes dans le
    // FormData. Token jamais persiste dans le job-store, transmis
    // uniquement au pipeline-runner.
    const githubRepoUrl = (() => {
      const v = formData.get('githubRepoUrl');
      return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
    })();
    const githubToken = (() => {
      const v = formData.get('githubToken');
      return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
    })();

    const store = getJobStore();
    await store.createWithId(clientJobId);
    await store.update(clientJobId, {
      status: 'running',
      filesReceived: {
        pitchDeck: pitchDeck.name,
        businessPlan: businessPlan?.name || null,
        generalLedger: generalLedger?.name || null,
        shareholdersAgreement: shareholdersAgreement?.name || null,
        statutes: statutes?.name || null,
        capTable: capTable?.name || null,
        clientContracts: clientContracts.map(c => c.name),
        others: others.map(o => o.name),
      } as any,
    });

    // Lancer le pipeline. La fonction POST attend sa fin (jusqu'au maxDuration de 300s).
    // Le client polle GET /api/jobs/[id] indépendamment.
    // Si la POST timeout côté Vercel mais le pipeline a écrit le résultat dans Supabase, le client le voit.
    await runPipeline({
      jobId: clientJobId,
      pitchDeckPayload: pitchDeck.payload,
      pitchDeckName: pitchDeck.name,
      businessPlanPayload: businessPlan?.payload || null,
      businessPlanName: businessPlan?.name || null,
      generalLedgerPayload: generalLedger?.payload || null,
      generalLedgerName: generalLedger?.name || null,
      legalDocuments: {
        shareholdersAgreementPdf: shareholdersAgreement?.payload || null,
        shareholdersAgreementName: shareholdersAgreement?.name || null,
        statutesPdf: statutes?.payload || null,
        statutesName: statutes?.name || null,
        capTablePayload: capTable?.payload || null,
        capTableName: capTable?.name || null,
        capTableType: capTable?.type === 'excel' || capTable?.type === 'csv' || capTable?.type === 'pdf'
          ? capTable.type as 'excel' | 'csv' | 'pdf'
          : null,
        clientContracts: clientContracts.map(c => ({ name: c.name, pdfBase64: c.payload })),
      },
      githubAuditConfig: {
        repoUrl: githubRepoUrl,
        token: githubToken,
      },
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
