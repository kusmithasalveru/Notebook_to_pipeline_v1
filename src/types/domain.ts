export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'engineer' | 'admin';
  affiliation: string;
}

export type ExecutionStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'degraded' | 'reproduced';

export interface NotebookParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  defaultValue: string;
  cellIndex: number;
  inferredFromTag: boolean;
}

export interface NotebookCell {
  id: string;
  index: number;
  cellType: 'markdown' | 'code';
  isParameterCell: boolean;
  executionCount: number | null;
  source: string;
  outputPreview?: string;
}

export interface NotebookRecord {
  id: string;
  name: string;
  description: string;
  kernelName: string;
  pythonVersionHint: string;
  owner: string;
  uploadedAt: string;
  checksum: string;
  cells: NotebookCell[];
  parameters: NotebookParameter[];
  imports: string[];
}

export interface PipelineStep {
  id: string;
  name: string;
  notebookId: string;
  notebookName: string;
  position: { x: number; y: number };
  parameters: Record<string, string>;
  timeoutSec: number;
  retries: number;
  status: ExecutionStatus;
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface PipelineDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  environmentSpec: {
    baseImage: string;
    pythonVersion: string;
    cpuRequest: string;
    memoryRequest: string;
  };
  steps: PipelineStep[];
  edges: PipelineEdge[];
  validationErrors: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleRecord {
  id: string;
  pipelineId: string;
  pipelineName: string;
  triggerType: 'cron' | 'interval';
  cronExpression: string;
  intervalMinutes?: number;
  timezone: string;
  enabled: boolean;
  parameterOverrides: Record<string, string>;
  nextRunAt: string;
  lastRunId?: string;
  lastRunStatus?: ExecutionStatus;
  createdAt: string;
}

export interface DependencyLockEntry {
  packageName: string;
  version: string;
  source: 'pip' | 'conda';
  sha256: string;
}

export interface DependencyLock {
  id: string;
  runId: string;
  resolver: 'pip-freeze' | 'conda-lock';
  lockfileHash: string;
  entries: DependencyLockEntry[];
}

export interface EnvironmentManifest {
  id: string;
  runId: string;
  pythonVersion: string;
  osRelease: string;
  containerImage: string;
  containerDigest: string;
  hardwareProfile: string;
  gitCommit: string;
  papermillVersion: string;
  capturedAt: string;
}

export interface LineageNode {
  id: string;
  runId: string;
  kind: 'dataset_in' | 'step' | 'artifact_out';
  label: string;
  uri: string;
  sha256: string;
  rowCount?: number;
  schemaSnapshot?: { column: string; dtype: string; nullable: boolean }[];
  status: ExecutionStatus;
  position: { x: number; y: number };
}

export interface LineageEdge {
  id: string;
  runId: string;
  source: string;
  target: string;
  relation: 'reads' | 'produces' | 'depends_on';
}

export interface ArtifactRecord {
  id: string;
  runId: string;
  stepId: string;
  name: string;
  kind: 'table' | 'metric' | 'image' | 'notebook';
  path: string;
  sha256: string;
  sizeKb: number;
  metrics?: Record<string, number>;
  tablePreview?: Record<string, string | number>[];
}

export interface RunLogEntry {
  id: string;
  runId: string;
  stepId: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  pipelineName: string;
  scheduleId?: string;
  triggeredBy: 'manual' | 'scheduled' | 'reproduction';
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  durationSec: number;
  parameters: Record<string, string>;
  stepStatuses: Record<string, ExecutionStatus>;
  environment: EnvironmentManifest;
  dependencyLock: DependencyLock;
  lineageNodes: LineageNode[];
  lineageEdges: LineageEdge[];
  artifacts: ArtifactRecord[];
  logs: RunLogEntry[];
  reproductionOfRunId?: string;
}

export interface TableDiffRow {
  rowKey: string;
  status: 'unchanged' | 'changed' | 'added' | 'removed';
  columns: Record<string, { original: string; reproduced: string; changed: boolean }>;
}

export interface MetricDelta {
  metric: string;
  original: number;
  reproduced: number;
  delta: number;
  withinTolerance: boolean;
}

export interface ImageHashComparison {
  artifactName: string;
  originalHash: string;
  reproducedHash: string;
  pixelSimilarityPct: number;
  exactMatch: boolean;
}

export interface ReproductionJob {
  id: string;
  sourceRunId: string;
  reproducedRunId: string;
  pipelineName: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt: string;
  fidelityScore: number; // 0..1
  environmentMatch: boolean;
  dependencyLockMatch: boolean;
  inputDatasetHashMatch: boolean;
  metricDeltas: MetricDelta[];
  tableDiff: {
    columns: string[];
    rows: TableDiffRow[];
  };
  imageHashes: ImageHashComparison[];
  summaryNote: string;
}

export type NegativeTestCode = 'NT-1' | 'NT-2' | 'NT-3' | 'NT-4' | 'NT-5';

export interface FaultInjectionTest {
  id: string;
  code: NegativeTestCode;
  title: string;
  scenario: string;
  injectedFault: string;
  expectedSafeBehavior: string;
  observedDegradedMode: string;
  recoveryProcedure: string;
  recoveryTimeSec: number;
  stateLossDetected: boolean;
  duplicateWorkDetected: boolean;
  outcome: 'pass' | 'hold';
  executedAt: string;
  recoveryLogs: string[];
}

export interface KpiSnapshot {
  id: 'KPI-1' | 'KPI-2' | 'KPI-3' | 'KPI-4' | 'KPI-5' | 'KPI-6';
  measure: string;
  unit: string;
  direction: 'higher' | 'lower';
  baselineValue: number;
  targetRule: string;
  targetNumeric: number;
  currentValue: number;
  acceptanceConditions: ('AC-1' | 'AC-2' | 'AC-3' | 'AC-4')[];
  status: 'pass' | 'hold';
}

export interface AcceptanceCondition {
  id: 'AC-1' | 'AC-2' | 'AC-3' | 'AC-4';
  title: string;
  description: string;
  status: 'pass' | 'hold';
  evidenceSummary: string;
}

export interface WorkspaceSettings {
  artifactStorageUri: string;
  containerRegistry: string;
  openLineageEndpoint: string;
  defaultTimeoutSec: number;
  enforceStrictLockMatch: boolean;
  autoFailClosedOnDrift: boolean;
}

export interface CapstoneDocument {
  id: string;
  title: string;
  subtitle: string;
  url: string;
}
