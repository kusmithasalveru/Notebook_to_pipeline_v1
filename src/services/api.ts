import { useAppStore } from '../store/useAppStore';
import type {
  AcceptanceCondition,
  ArtifactRecord,
  AuthUser,
  CapstoneDocument,
  DependencyLock,
  EnvironmentManifest,
  FaultInjectionTest,
  KpiSnapshot,
  LineageEdge,
  LineageNode,
  NegativeTestCode,
  NotebookRecord,
  PipelineDefinition,
  PipelineEdge,
  PipelineRun,
  PipelineStep,
  ReproductionJob,
  ScheduleRecord,
  WorkspaceSettings,
} from '../types/domain';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useAppStore.getState().authToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export interface OverviewResponse {
  counts: {
    notebooks: number;
    activePipelines: number;
    enabledSchedules: number;
    totalRuns: number;
    reproductions: number;
    faultTestsPassed: number;
  };
  kpis: KpiSnapshot[];
  acceptanceConditions: AcceptanceCondition[];
  upcomingSchedules: ScheduleRecord[];
  recentRuns: PipelineRun[];
}

export const api = {
  getOverview: () => request<OverviewResponse>('/api/v1/overview'),

  // Auth
  login: (email: string, password: string) =>
    request<{ user: AuthUser; token: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string, affiliation: string) =>
    request<{ user: AuthUser; token: string }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, affiliation }),
    }),

  // Notebooks
  listNotebooks: () => request<{ notebooks: NotebookRecord[] }>('/api/v1/notebooks'),
  uploadNotebook: (payload: { name: string; description?: string; rawContent: string }) =>
    request<{ notebook: NotebookRecord }>('/api/v1/notebooks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteNotebook: (id: string) =>
    request<{ deleted: boolean }>(`/api/v1/notebooks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Pipelines
  listPipelines: () => request<{ pipelines: PipelineDefinition[] }>('/api/v1/pipelines'),
  savePipeline: (payload: {
    id?: string;
    name: string;
    description: string;
    environmentSpec: PipelineDefinition['environmentSpec'];
    steps: PipelineStep[];
    edges: PipelineEdge[];
  }) =>
    request<{ pipeline: PipelineDefinition }>('/api/v1/pipelines', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Schedules
  listSchedules: () => request<{ schedules: ScheduleRecord[] }>('/api/v1/schedules'),
  createSchedule: (payload: {
    pipelineId: string;
    triggerType: 'cron' | 'interval';
    cronExpression: string;
    intervalMinutes?: number;
    timezone?: string;
    parameterOverrides: Record<string, string>;
  }) =>
    request<{ schedule: ScheduleRecord }>('/api/v1/schedules', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateSchedule: (
    id: string,
    patch: Partial<Pick<ScheduleRecord, 'enabled' | 'cronExpression' | 'intervalMinutes' | 'triggerType' | 'parameterOverrides'>>
  ) =>
    request<{ schedule: ScheduleRecord }>(`/api/v1/schedules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteSchedule: (id: string) =>
    request<{ deleted: boolean }>(`/api/v1/schedules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Runs
  listRuns: () => request<{ runs: PipelineRun[] }>('/api/v1/runs'),
  getRun: (id: string) => request<{ run: PipelineRun }>(`/api/v1/runs/${encodeURIComponent(id)}`),
  triggerRun: (payload: {
    pipelineId: string;
    triggeredBy?: 'manual' | 'scheduled';
    scheduleId?: string;
    parameterOverrides?: Record<string, string>;
  }) =>
    request<{ run: PipelineRun }>('/api/v1/runs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  cancelRun: (id: string) =>
    request<{ run: PipelineRun }>(`/api/v1/runs/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    }),

  // Environment & Lineage
  getEnvironment: (runId: string) =>
    request<{ environment: EnvironmentManifest; dependencyLock: DependencyLock }>(
      `/api/v1/environment/${encodeURIComponent(runId)}`
    ),
  getLineage: (runId?: string) =>
    request<{
      runId: string | null;
      pipelineName?: string;
      nodes: LineageNode[];
      edges: LineageEdge[];
      artifacts: ArtifactRecord[];
    }>(runId ? `/api/v1/lineage?runId=${encodeURIComponent(runId)}` : '/api/v1/lineage'),

  // Reproduction
  listReproductions: () => request<{ reproductions: ReproductionJob[] }>('/api/v1/reproduction'),
  startReproduction: (sourceRunId: string) =>
    request<{ reproduction: ReproductionJob }>('/api/v1/reproduction', {
      method: 'POST',
      body: JSON.stringify({ sourceRunId }),
    }),

  // Fault Injection
  listFaultTests: () => request<{ tests: FaultInjectionTest[] }>('/api/v1/fault-injection'),
  runFaultTest: (code: NegativeTestCode) =>
    request<{ test: FaultInjectionTest }>('/api/v1/fault-injection', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  // KPI & Acceptance
  getKpiSummary: () =>
    request<{
      kpis: KpiSnapshot[];
      acceptanceConditions: AcceptanceCondition[];
      documents: CapstoneDocument[];
    }>('/api/v1/kpi'),

  // Settings
  getSettings: () => request<{ settings: WorkspaceSettings }>('/api/v1/settings'),
  updateSettings: (patch: Partial<WorkspaceSettings>) =>
    request<{ settings: WorkspaceSettings }>('/api/v1/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
};
