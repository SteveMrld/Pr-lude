// Store de jobs en mémoire pour découpler client/serveur
// Permet au client de poller le status sans maintenir une connexion ouverte
// Limitation : si Vercel redémarre la fonction (cold start), les jobs sont perdus
// C'est acceptable pour un test mobile, à remplacer par Vercel KV ou Supabase pour prod

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

// Singleton store en mémoire
class JobStore {
  private jobs: Map<string, Job> = new Map();
  private maxJobs = 100; // limite mémoire

  create(): Job {
    return this.createWithId(`job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
  }

  createWithId(id: string): Job {
    // Nettoyage : si trop de jobs, supprimer les plus vieux
    if (this.jobs.size >= this.maxJobs) {
      const sorted = Array.from(this.jobs.entries()).sort((a, b) => a[1].updatedAt - b[1].updatedAt);
      for (let i = 0; i < 10 && i < sorted.length; i++) {
        this.jobs.delete(sorted[i][0]);
      }
    }

    const job: Job = {
      id,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      engineStates: {},
    };
    this.jobs.set(id, job);
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  update(id: string, patch: Partial<Job>): Job | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    const updated = { ...job, ...patch, updatedAt: Date.now() };
    this.jobs.set(id, updated);
    return updated;
  }

  setEngineRunning(id: string, engine: string, label?: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.engineStates[engine] = {
      status: 'running',
      startedAt: Date.now(),
    };
    job.status = 'running';
    job.updatedAt = Date.now();
  }

  setEngineDone(id: string, engine: string, output: any): void {
    const job = this.jobs.get(id);
    if (!job) return;
    const prev = job.engineStates[engine] || {};
    job.engineStates[engine] = {
      ...prev,
      status: 'done',
      completedAt: Date.now(),
      output,
    };
    job.updatedAt = Date.now();
  }

  setComplete(id: string, result: any): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = 'complete';
    job.result = result;
    job.updatedAt = Date.now();
  }

  setError(id: string, error: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = 'error';
    job.error = error;
    job.updatedAt = Date.now();
  }
}

// Singleton global qui persiste entre les invocations dans la même instance Vercel
declare global {
  // eslint-disable-next-line no-var
  var __preludeJobStore: JobStore | undefined;
}

export function getJobStore(): JobStore {
  if (!globalThis.__preludeJobStore) {
    globalThis.__preludeJobStore = new JobStore();
  }
  return globalThis.__preludeJobStore;
}
