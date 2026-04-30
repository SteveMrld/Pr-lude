// Store de jobs persistant via Supabase
// Remplace l'ancien store en mémoire qui ne marchait pas en multi-instance Vercel

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type JobStatus = 'pending' | 'running' | 'complete' | 'error';

export type EngineState = {
  status: 'idle' | 'running' | 'done' | 'error';
  startedAt?: number;
  completedAt?: number;
  output?: any;
};

export interface Job {
  id: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  engineStates: Record<string, EngineState>;
  filesReceived?: { pitchDeck: string; businessPlan: string | null; others: string[] };
  result?: any;
  error?: string;
}

const TABLE = 'prelude_jobs';

let _client: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant');
  }
  _client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _client;
}

class JobStore {
  async createWithId(id: string): Promise<Job> {
    const job: Job = {
      id,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      engineStates: {},
    };
    const { error } = await client().from(TABLE).insert({
      id,
      status: 'pending',
      created_at: new Date(job.createdAt).toISOString(),
      updated_at: new Date(job.updatedAt).toISOString(),
      engine_states: {},
      files_received: null,
      result: null,
      error_message: null,
    });
    if (error && error.code !== '23505') {
      console.error('createWithId error:', error);
    }
    return job;
  }

  async get(id: string): Promise<Job | undefined> {
    const { data, error } = await client().from(TABLE).select('*').eq('id', id).maybeSingle();
    if (error) {
      console.error('get error:', error);
      return undefined;
    }
    if (!data) return undefined;
    return {
      id: data.id,
      status: data.status,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      engineStates: data.engine_states || {},
      filesReceived: data.files_received || undefined,
      result: data.result || undefined,
      error: data.error_message || undefined,
    };
  }

  async update(id: string, patch: Partial<Job>): Promise<void> {
    const dbPatch: any = { updated_at: new Date().toISOString() };
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.engineStates !== undefined) dbPatch.engine_states = patch.engineStates;
    if (patch.filesReceived !== undefined) dbPatch.files_received = patch.filesReceived;
    if (patch.result !== undefined) dbPatch.result = patch.result;
    if (patch.error !== undefined) dbPatch.error_message = patch.error;

    const { error } = await client().from(TABLE).update(dbPatch).eq('id', id);
    if (error) console.error('update error:', error);
  }

  async setEngineRunning(id: string, engine: string): Promise<void> {
    const job = await this.get(id);
    if (!job) return;
    job.engineStates[engine] = { status: 'running', startedAt: Date.now() };
    await this.update(id, { engineStates: job.engineStates, status: 'running' });
  }

  async setEngineDone(id: string, engine: string, output: any): Promise<void> {
    const job = await this.get(id);
    if (!job) return;
    const prev = job.engineStates[engine] || {};
    job.engineStates[engine] = {
      ...prev,
      status: 'done',
      completedAt: Date.now(),
      output,
    };
    await this.update(id, { engineStates: job.engineStates });
  }

  async setComplete(id: string, result: any): Promise<void> {
    await this.update(id, { status: 'complete', result });
  }

  async setError(id: string, error: string): Promise<void> {
    await this.update(id, { status: 'error', error });
  }
}

let _store: JobStore | null = null;
export function getJobStore(): JobStore {
  if (!_store) _store = new JobStore();
  return _store;
}
