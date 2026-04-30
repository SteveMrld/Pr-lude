import { NextRequest } from 'next/server';
import { getJobStore } from '@/lib/job-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const store = getJobStore();
  const job = await store.get(params.id);

  if (!job) {
    return new Response(JSON.stringify({ error: 'Job introuvable', status: 'not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // On retourne tout sauf le payload des fichiers (pas besoin côté client)
  return new Response(
    JSON.stringify({
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      engineStates: job.engineStates,
      filesReceived: job.filesReceived,
      result: job.result,
      error: job.error,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
  );
}
