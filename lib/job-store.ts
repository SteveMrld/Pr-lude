// Store de jobs sur Supabase (partagé entre toutes les instances Vercel)

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

let supabaseClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises');
  }
  supabaseClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseClient;
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
    const client = getClient();
    const { error } = await client.from('prelude_jobs').insert({
      id: job.id,
      status: job.status,
      engine_states: job.engineStates,
      files_received: null,
      result: null,
      error_message: null,
    });
    if (error && error.code !== '23505') {
      console.error('Failed to create job:', error);
      throw error;
    }
    return job;
  }

  async create(): Promise<Job> {
    return this.createWithId(`job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
  }

  async get(id: string): Promise<Job | undefined> {
    const client = getClient();
    const { data, error } = await client.from('prelude_jobs').select('*').eq('id', id).maybeSingle();
    if (error) {
      console.error('Failed to get job:', error);
      return undefined;
    }
    if (!data) return undefined;
    return {
      id: data.id,
      status: data.status as JobStatus,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      engineStates: data.engine_states || {},
      filesReceived: data.files_received || undefined,
      result: data.result || undefined,
      error: data.error_message || undefined,
    };
  }

  async update(id: string, patch: Partial<Job>): Promise<void> {
    const client = getClient();
    const dbPatch: any = { updated_at: new Date().toISOString() };
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.engineStates !== undefined) dbPatch.engine_states = patch.engineStates;
    if (patch.filesReceived !== undefined) dbPatch.files_received = patch.filesReceived;
    if (patch.result !== undefined) dbPatch.result = patch.result;
    if (patch.error !== undefined) dbPatch.error_message = patch.error;
    const { error } = await client.from('prelude_jobs').update(dbPatch).eq('id', id);
    if (error) console.error('Failed to update job:', error);
  }

  async setEngineRunning(id: string, engine: string): Promise<void> {
    const job = await this.get(id);
    if (!job) return;
    const engineStates = { ...job.engineStates, [engine]: { status: 'running' as const, startedAt: Date.now() } };
    await this.update(id, { engineStates, status: 'running' });
  }

  async setEngineDone(id: string, engine: string, output: any): Promise<void> {
    const job = await this.get(id);
    if (!job) return;
    const prev = job.engineStates[engine] || {};
    const engineStates = {
      ...job.engineStates,
      [engine]: { ...prev, status: 'done' as const, completedAt: Date.now(), output },
    };
    await this.update(id, { engineStates });
  }

  async setComplete(id: string, result: any): Promise<void> {
    await this.update(id, { status: 'complete', result });
  }

  async setError(id: string, error: string): Promise<void> {
    await this.update(id, { status: 'error', error });
  }
}

let storeInstance: JobStore | null = null;
export function getJobStore(): JobStore {
  if (!storeInstance) storeInstance = new JobStore();
  return storeInstance;
}
