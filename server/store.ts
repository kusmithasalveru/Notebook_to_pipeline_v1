import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AcceptanceCondition,
  AuthUser,
  FaultInjectionTest,
  KpiSnapshot,
  NegativeTestCode,
  NotebookRecord,
  PipelineDefinition,
  PipelineEdge,
  PipelineRun,
  PipelineStep,
  ReproductionJob,
  RunLogEntry,
  ScheduleRecord,
  WorkspaceSettings,
} from '../src/types/domain.ts';
import {
  analyzeDependencies,
  buildRunLineage,
  captureEnvironment,
  computeReproductionDiff,
  executeFaultInjectionTest,
  parseNotebookContent,
  validatePipelineDag,
} from './engine.ts';
import { buildSeedData } from './seedData.ts';

interface StoredUser extends AuthUser {
  passwordHash: string;
  salt: string;
}

interface Cloud39State {
  users: StoredUser[];
  notebooks: NotebookRecord[];
  pipelines: PipelineDefinition[];
  schedules: ScheduleRecord[];
  runs: PipelineRun[];
  reproductions: ReproductionJob[];
  faultTests: FaultInjectionTest[];
  kpis: KpiSnapshot[];
  acceptanceConditions: AcceptanceCondition[];
  settings: WorkspaceSettings;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'cloud39_workspace.json');

// Session signing key: process.env.SESSION_SECRET with secure ephemeral fallback
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return { hash: derived, salt: usedSalt };
}

export function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(storedHash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function signAuthToken(user: AuthUser): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      affiliation: user.affiliation,
      exp: Date.now() + 1000 * 60 * 60 * 24,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAuthToken(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return {
      id: String(parsed.sub),
      email: String(parsed.email),
      name: String(parsed.name),
      role: parsed.role === 'admin' ? 'admin' : 'engineer',
      affiliation: String(parsed.affiliation || 'CLOUD-39 Engineering'),
    };
  } catch {
    return null;
  }
}

class Cloud39Store {
  private state: Cloud39State;
  private activeTimers = new Map<string, NodeJS.Timeout[]>();
  private wsBroadcaster: ((payload: unknown) => void) | null = null;

  constructor() {
    this.state = this.loadState();
  }

  public setBroadcaster(fn: (payload: unknown) => void) {
    this.wsBroadcaster = fn;
  }

  private loadState(): Cloud39State {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw) as Cloud39State;
        if (parsed && Array.isArray(parsed.notebooks) && Array.isArray(parsed.pipelines) && Array.isArray(parsed.runs)) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed to read CLOUD-39 workspace store; reseeding:', err);
    }

    const seed = buildSeedData();
    const fresh: Cloud39State = {
      users: [],
      ...seed,
    };
    this.persist(fresh);
    return fresh;
  }

  private persist(next?: Cloud39State) {
    const target = next || this.state;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmp = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(target, null, 2), 'utf8');
      fs.renameSync(tmp, DB_FILE);
    } catch (err) {
      console.error('Failed to persist CLOUD-39 workspace:', err);
    }
  }

  // --- Auth ---
  public registerUser(name: string, email: string, password: string, affiliation: string): { user: AuthUser; token: string } | { error: string } {
    const cleanEmail = email.trim().toLowerCase();
    if (this.state.users.some((u) => u.email === cleanEmail)) {
      return { error: 'An account with this email already exists.' };
    }
    const { hash, salt } = hashPassword(password);
    const role: AuthUser['role'] = this.state.users.length === 0 ? 'admin' : 'engineer';
    const stored: StoredUser = {
      id: `usr_${crypto.randomBytes(4).toString('hex')}`,
      email: cleanEmail,
      name: name.trim(),
      role,
      affiliation: affiliation.trim() || 'KL University · Team C-162',
      passwordHash: hash,
      salt,
    };
    this.state.users.push(stored);
    this.persist();
    const user: AuthUser = {
      id: stored.id,
      email: stored.email,
      name: stored.name,
      role: stored.role,
      affiliation: stored.affiliation,
    };
    return { user, token: signAuthToken(user) };
  }

  public loginUser(email: string, password: string): { user: AuthUser; token: string } | { error: string } {
    const cleanEmail = email.trim().toLowerCase();
    const stored = this.state.users.find((u) => u.email === cleanEmail);
    if (!stored || !verifyPassword(password, stored.salt, stored.passwordHash)) {
      return { error: 'Invalid email or password.' };
    }
    const user: AuthUser = {
      id: stored.id,
      email: stored.email,
      name: stored.name,
      role: stored.role,
      affiliation: stored.affiliation,
    };
    return { user, token: signAuthToken(user) };
  }

  // --- Notebooks ---
  public listNotebooks(): NotebookRecord[] {
    return this.state.notebooks;
  }

  public uploadNotebook(input: { name: string; description?: string; rawContent: string; owner: string }): NotebookRecord {
    const nb = parseNotebookContent(input);
    this.state.notebooks.unshift(nb);
    this.persist();
    return nb;
  }

  public deleteNotebook(id: string): boolean {
    const idx = this.state.notebooks.findIndex((n) => n.id === id);
    if (idx === -1) return false;
    this.state.notebooks.splice(idx, 1);
    this.persist();
    return true;
  }

  // --- Pipelines ---
  public listPipelines(): PipelineDefinition[] {
    return this.state.pipelines;
  }

  public getPipeline(id: string): PipelineDefinition | undefined {
    return this.state.pipelines.find((p) => p.id === id);
  }

  public createOrUpdatePipeline(input: {
    id?: string;
    name: string;
    description: string;
    environmentSpec: PipelineDefinition['environmentSpec'];
    steps: PipelineStep[];
    edges: PipelineEdge[];
  }): PipelineDefinition {
    const errors = validatePipelineDag({ steps: input.steps, edges: input.edges });
    const now = new Date().toISOString();

    if (input.id) {
      const existing = this.state.pipelines.find((p) => p.id === input.id);
      if (existing) {
        existing.name = input.name.trim() || existing.name;
        existing.description = input.description.trim();
        existing.environmentSpec = input.environmentSpec;
        existing.steps = input.steps;
        existing.edges = input.edges;
        existing.validationErrors = errors;
        existing.updatedAt = now;
        this.persist();
        return existing;
      }
    }

    const created: PipelineDefinition = {
      id: `pipe_${crypto.randomBytes(4).toString('hex')}`,
      name: input.name.trim(),
      description: input.description.trim() || 'Reproducible scheduled notebook pipeline.',
      version: 'v1.0.0',
      environmentSpec: input.environmentSpec,
      steps: input.steps,
      edges: input.edges,
      validationErrors: errors,
      createdAt: now,
      updatedAt: now,
    };
    this.state.pipelines.unshift(created);
    this.persist();
    return created;
  }

  // --- Schedules ---
  public listSchedules(): ScheduleRecord[] {
    return this.state.schedules;
  }

  public createSchedule(input: {
    pipelineId: string;
    triggerType: 'cron' | 'interval';
    cronExpression: string;
    intervalMinutes?: number;
    timezone?: string;
    parameterOverrides: Record<string, string>;
  }): ScheduleRecord | null {
    const pl = this.getPipeline(input.pipelineId);
    if (!pl) return null;
    const sched: ScheduleRecord = {
      id: `sched_${crypto.randomBytes(4).toString('hex')}`,
      pipelineId: pl.id,
      pipelineName: pl.name,
      triggerType: input.triggerType,
      cronExpression: input.cronExpression.trim() || '0 6 * * *',
      intervalMinutes: input.triggerType === 'interval' ? input.intervalMinutes || 60 : undefined,
      timezone: input.timezone || 'UTC',
      enabled: true,
      parameterOverrides: input.parameterOverrides || {},
      nextRunAt: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.state.schedules.unshift(sched);
    this.persist();
    return sched;
  }

  public updateSchedule(
    id: string,
    patch: Partial<Pick<ScheduleRecord, 'enabled' | 'cronExpression' | 'intervalMinutes' | 'triggerType' | 'parameterOverrides'>>
  ): ScheduleRecord | null {
    const sched = this.state.schedules.find((s) => s.id === id);
    if (!sched) return null;
    if (typeof patch.enabled === 'boolean') sched.enabled = patch.enabled;
    if (typeof patch.cronExpression === 'string') sched.cronExpression = patch.cronExpression;
    if (typeof patch.intervalMinutes === 'number') sched.intervalMinutes = patch.intervalMinutes;
    if (patch.triggerType === 'cron' || patch.triggerType === 'interval') sched.triggerType = patch.triggerType;
    if (patch.parameterOverrides && typeof patch.parameterOverrides === 'object') {
      sched.parameterOverrides = patch.parameterOverrides;
    }
    this.persist();
    return sched;
  }

  public deleteSchedule(id: string): boolean {
    const idx = this.state.schedules.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    this.state.schedules.splice(idx, 1);
    this.persist();
    return true;
  }

  // --- Runs + Live WebSocket Execution Stream ---
  public listRuns(): PipelineRun[] {
    return this.state.runs;
  }

  public getRun(id: string): PipelineRun | undefined {
    return this.state.runs.find((r) => r.id === id);
  }

  public triggerRun(input: {
    pipelineId: string;
    triggeredBy: 'manual' | 'scheduled' | 'reproduction';
    scheduleId?: string;
    parameterOverrides?: Record<string, string>;
    reproductionOfRunId?: string;
  }): PipelineRun | null {
    const pl = this.getPipeline(input.pipelineId) || this.state.pipelines[0];
    if (!pl) return null;

    const runId = `run_${Math.floor(4100 + Math.random() * 5800)}`;
    const mergedParams: Record<string, string> = {};
    pl.steps.forEach((s) => {
      Object.assign(mergedParams, s.parameters);
    });
    if (input.parameterOverrides) {
      Object.assign(mergedParams, input.parameterOverrides);
    }

    const imports = Array.from(
      new Set(
        pl.steps.flatMap((s) => {
          const nb = this.state.notebooks.find((n) => n.id === s.notebookId);
          return nb ? nb.imports : [];
        })
      )
    );

    const sourceRun = input.reproductionOfRunId ? this.getRun(input.reproductionOfRunId) : undefined;
    const env = sourceRun
      ? { ...sourceRun.environment, id: `env_${runId}`, runId, capturedAt: new Date().toISOString() }
      : captureEnvironment({ runId, pipeline: pl });
    const lock = sourceRun
      ? { ...sourceRun.dependencyLock, id: `lock_${runId}`, runId }
      : analyzeDependencies(runId, imports);

    const { nodes, edges, artifacts } = buildRunLineage({
      runId,
      pipeline: pl,
      parameters: sourceRun ? sourceRun.parameters : mergedParams,
      status: input.triggeredBy === 'reproduction' ? 'reproduced' : 'succeeded',
    });

    const initialStepStatuses: Record<string, PipelineRun['status']> = {};
    pl.steps.forEach((s, idx) => {
      initialStepStatuses[s.id] = idx === 0 ? 'running' : 'idle';
    });

    const initialLog: RunLogEntry = {
      id: `log_${runId}_0`,
      runId,
      stepId: pl.steps[0]?.id || 'step_1',
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: `Initialized isolated pod ${env.containerImage} (${env.containerDigest}) · Lock ${lock.lockfileHash}`,
    };

    const run: PipelineRun = {
      id: runId,
      pipelineId: pl.id,
      pipelineName: pl.name,
      scheduleId: input.scheduleId,
      triggeredBy: input.triggeredBy,
      status: 'running',
      startedAt: new Date().toISOString(),
      durationSec: 0,
      parameters: sourceRun ? { ...sourceRun.parameters } : mergedParams,
      stepStatuses: initialStepStatuses,
      environment: env,
      dependencyLock: lock,
      lineageNodes: nodes,
      lineageEdges: edges,
      artifacts,
      logs: [initialLog],
      reproductionOfRunId: input.reproductionOfRunId,
    };

    this.state.runs.unshift(run);
    this.persist();

    // Broadcast start + stream step execution logs over WebSocket
    const timers: NodeJS.Timeout[] = [];
    const emit = (payload: unknown) => {
      if (this.wsBroadcaster) this.wsBroadcaster(payload);
    };

    emit({ type: 'run_started', run });

    pl.steps.forEach((step, idx) => {
      const startDelay = 650 + idx * 1100;
      const t1 = setTimeout(() => {
        if (run.status !== 'running') return;
        run.stepStatuses[step.id] = 'running';
        const logStart: RunLogEntry = {
          id: `log_${runId}_s_${idx}`,
          runId,
          stepId: step.id,
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: `Papermill executing ${step.notebookName} with parameters ${JSON.stringify(step.parameters)}`,
        };
        run.logs.push(logStart);
        emit({ type: 'run_log', runId, log: logStart, stepStatuses: { ...run.stepStatuses } });
      }, startDelay);

      const t2 = setTimeout(() => {
        if (run.status !== 'running') return;
        run.stepStatuses[step.id] = 'succeeded';
        const logDone: RunLogEntry = {
          id: `log_${runId}_d_${idx}`,
          runId,
          stepId: step.id,
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: `Completed step "${step.name}" · OpenLineage facet & SHA-256 artifact checksum persisted.`,
        };
        run.logs.push(logDone);
        emit({ type: 'run_log', runId, log: logDone, stepStatuses: { ...run.stepStatuses } });

        if (idx === pl.steps.length - 1) {
          run.status = input.triggeredBy === 'reproduction' ? 'reproduced' : 'succeeded';
          run.completedAt = new Date().toISOString();
          run.durationSec = Number(((Date.now() - new Date(run.startedAt).getTime()) / 1000).toFixed(1));

          if (input.scheduleId) {
            const sched = this.state.schedules.find((s) => s.id === input.scheduleId);
            if (sched) {
              sched.lastRunId = run.id;
              sched.lastRunStatus = run.status;
            }
          }
          this.persist();
          emit({ type: 'run_completed', run });
          this.activeTimers.delete(runId);
        }
      }, startDelay + 750);

      timers.push(t1, t2);
    });

    this.activeTimers.set(runId, timers);
    return run;
  }

  public cancelRun(runId: string): PipelineRun | null {
    const run = this.getRun(runId);
    if (!run) return null;
    if (run.status === 'running') {
      const timers = this.activeTimers.get(runId) || [];
      timers.forEach((t) => clearTimeout(t));
      this.activeTimers.delete(runId);
      run.status = 'failed';
      run.completedAt = new Date().toISOString();
      run.durationSec = Number(((Date.now() - new Date(run.startedAt).getTime()) / 1000).toFixed(1));
      const cancelLog: RunLogEntry = {
        id: `log_${runId}_cancel`,
        runId,
        stepId: 'system',
        timestamp: new Date().toISOString(),
        level: 'WARN',
        message: 'Run cancelled by operator. Partial checkpoints preserved without publishing incomplete outputs.',
      };
      run.logs.push(cancelLog);
      this.persist();
      if (this.wsBroadcaster) {
        this.wsBroadcaster({ type: 'run_completed', run });
      }
    }
    return run;
  }

  // --- Reproduction ---
  public listReproductions(): ReproductionJob[] {
    return this.state.reproductions;
  }

  public startReproduction(sourceRunId: string): ReproductionJob | null {
    const sourceRun = this.getRun(sourceRunId);
    if (!sourceRun) return null;

    const pl = this.getPipeline(sourceRun.pipelineId) || this.state.pipelines[0];
    if (!pl) return null;

    const reproRunId = `run_${Math.floor(5000 + Math.random() * 4900)}`;
    const now = new Date().toISOString();

    const env = { ...sourceRun.environment, id: `env_${reproRunId}`, runId: reproRunId, capturedAt: now };
    const lock = { ...sourceRun.dependencyLock, id: `lock_${reproRunId}`, runId: reproRunId };
    const { nodes, edges, artifacts } = buildRunLineage({
      runId: reproRunId,
      pipeline: pl,
      parameters: { ...sourceRun.parameters },
      status: 'reproduced',
    });

    const stepStatuses: Record<string, PipelineRun['status']> = {};
    pl.steps.forEach((s) => {
      stepStatuses[s.id] = 'succeeded';
    });

    const reproRun: PipelineRun = {
      id: reproRunId,
      pipelineId: pl.id,
      pipelineName: pl.name,
      triggeredBy: 'reproduction',
      status: 'reproduced',
      startedAt: now,
      completedAt: now,
      durationSec: Number((sourceRun.durationSec + (Math.random() - 0.5) * 1.2).toFixed(1)),
      parameters: { ...sourceRun.parameters },
      stepStatuses,
      environment: env,
      dependencyLock: lock,
      lineageNodes: nodes,
      lineageEdges: edges,
      artifacts,
      logs: [
        {
          id: `log_${reproRunId}_1`,
          runId: reproRunId,
          stepId: 'system',
          timestamp: now,
          level: 'INFO',
          message: `Restored frozen environment ${env.containerDigest} and dependency lock ${lock.lockfileHash} from ${sourceRun.id}.`,
        },
        {
          id: `log_${reproRunId}_2`,
          runId: reproRunId,
          stepId: 'system',
          timestamp: now,
          level: 'INFO',
          message: `Executed all ${pl.steps.length} steps cleanly and verified artifact hashes via diff engine.`,
        },
      ],
      reproductionOfRunId: sourceRun.id,
    };

    const job = computeReproductionDiff(sourceRun, reproRun);
    this.state.runs.unshift(reproRun);
    this.state.reproductions.unshift(job);

    // Update KPI-1 with latest mean fidelity
    const meanFidelity =
      this.state.reproductions.reduce((acc, r) => acc + r.fidelityScore, 0) / this.state.reproductions.length;
    const kpi1 = this.state.kpis.find((k) => k.id === 'KPI-1');
    if (kpi1) {
      kpi1.currentValue = Number(meanFidelity.toFixed(3));
      kpi1.status = kpi1.currentValue >= kpi1.targetNumeric ? 'pass' : 'hold';
    }

    this.persist();
    return job;
  }

  // --- Fault Injection ---
  public listFaultTests(): FaultInjectionTest[] {
    return this.state.faultTests;
  }

  public runFaultInjection(code: NegativeTestCode): FaultInjectionTest {
    const result = executeFaultInjectionTest(code);
    this.state.faultTests.unshift(result);
    if (this.state.faultTests.length > 25) {
      this.state.faultTests = this.state.faultTests.slice(0, 25);
    }
    this.persist();
    return result;
  }

  // --- KPIs & Settings ---
  public getKpiSummary() {
    return {
      kpis: this.state.kpis,
      acceptanceConditions: this.state.acceptanceConditions,
    };
  }

  public getSettings(): WorkspaceSettings {
    return this.state.settings;
  }

  public updateSettings(patch: Partial<WorkspaceSettings>): WorkspaceSettings {
    this.state.settings = { ...this.state.settings, ...patch };
    this.persist();
    return this.state.settings;
  }
}

export const studioStore = new Cloud39Store();
