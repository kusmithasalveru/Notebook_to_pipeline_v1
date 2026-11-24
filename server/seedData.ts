import type {
  AcceptanceCondition,
  CapstoneDocument,
  FaultInjectionTest,
  KpiSnapshot,
  NotebookRecord,
  PipelineDefinition,
  PipelineRun,
  ReproductionJob,
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
} from './engine.ts';
import { ARTIFACT_URI_PREFIX, CONTAINER_IMAGE_PINNED, CONTAINER_REGISTRY, DATASET_URI_PREFIX, OPENLINEAGE_ENDPOINT, WORKSPACE_FILE } from '../src/constants.ts';

const NB_1_JSON = JSON.stringify({
  metadata: { kernelspec: { name: 'python3' }, language_info: { version: '3.12.7' } },
  cells: [
    {
      cell_type: 'markdown',
      source: ['# 01 — Clinical Cohort Ingestion & Schema Validation\nLoads raw cohort records, validates non-null partition contracts, and emits a hashed parquet artifact.'],
    },
    {
      cell_type: 'code',
      metadata: { tags: ['parameters'] },
      execution_count: 1,
      source: [
        'cohort_source = "clinical_cohort_v14.parquet"\n',
        'null_threshold = 0.05\n',
        'schema_version = "2.1"\n',
      ],
    },
    {
      cell_type: 'code',
      execution_count: 2,
      source: [
        'import pandas as pd\n',
        'import pyarrow\n',
        'import openlineage\n\n',
        `df = pd.read_parquet(f"${DATASET_URI_PREFIX}/{cohort_source}")\n`,
        'assert df.isna().mean().max() <= null_threshold\n',
        'df.to_parquet("cleaned_cohort.parquet", index=False)\n',
      ],
    },
  ],
});

const NB_2_JSON = JSON.stringify({
  metadata: { kernelspec: { name: 'python3' }, language_info: { version: '3.12.7' } },
  cells: [
    {
      cell_type: 'markdown',
      source: ['# 02 — Deterministic KNN Feature Imputation\nReplaces missing genetic markers using distance-weighted KNN with a fixed random seed for reproducible outputs.'],
    },
    {
      cell_type: 'code',
      metadata: { tags: ['parameters'] },
      execution_count: 1,
      source: [
        'knn_neighbors = 1\n',
        'imputer_weights = "distance"\n',
        'random_seed = 42\n',
      ],
    },
    {
      cell_type: 'code',
      execution_count: 2,
      source: [
        'import numpy as np\n',
        'import pandas as pd\n',
        'from sklearn.impute import KNNImputer\n\n',
        'np.random.seed(random_seed)\n',
        'df = pd.read_parquet("cleaned_cohort.parquet")\n',
        'imputer = KNNImputer(n_neighbors=knn_neighbors, weights=imputer_weights)\n',
        'imputed = pd.DataFrame(imputer.fit_transform(df.drop(columns=["patient_id"])), columns=df.columns[1:])\n',
        'imputed.to_parquet("imputed_features.parquet", index=False)\n',
      ],
    },
  ],
});

const NB_3_JSON = JSON.stringify({
  metadata: { kernelspec: { name: 'python3' }, language_info: { version: '3.12.7' } },
  cells: [
    {
      cell_type: 'markdown',
      source: ['# 03 — Random Forest Training, Metrics & Importance Plot\nTrains classifier on imputed cohort features, logs ROC-AUC/Accuracy, and renders deterministic feature importance chart.'],
    },
    {
      cell_type: 'code',
      metadata: { tags: ['parameters'] },
      execution_count: 1,
      source: [
        'n_estimators = 200\n',
        'max_depth = 12\n',
        'eval_metric = "roc_auc"\n',
      ],
    },
    {
      cell_type: 'code',
      execution_count: 2,
      source: [
        'import pandas as pd\n',
        'import matplotlib\n',
        'import seaborn\n',
        'from sklearn.ensemble import RandomForestClassifier\n\n',
        'X = pd.read_parquet("imputed_features.parquet")\n',
        'clf = RandomForestClassifier(n_estimators=n_estimators, max_depth=max_depth, random_state=42)\n',
        '# Save metrics JSON and deterministic PNG chart artifact\n',
      ],
    },
  ],
});

export function buildSeedData(): {
  notebooks: NotebookRecord[];
  pipelines: PipelineDefinition[];
  schedules: ScheduleRecord[];
  runs: PipelineRun[];
  reproductions: ReproductionJob[];
  faultTests: FaultInjectionTest[];
  kpis: KpiSnapshot[];
  acceptanceConditions: AcceptanceCondition[];
  settings: WorkspaceSettings;
} {
  const nb1 = parseNotebookContent({
    name: '01_ingest_clinical_cohort.ipynb',
    description: 'Ingests raw cohort data, enforces partition schema validation, and writes checksummed parquet.',
    rawContent: NB_1_JSON,
    owner: 'Salveru Kusmitha',
  });
  nb1.id = 'nb_ingest_cohort';

  const nb2 = parseNotebookContent({
    name: '02_feature_imputation_knn.ipynb',
    description: 'Applies deterministic KNN missing-value imputation with configurable neighbor count and seed.',
    rawContent: NB_2_JSON,
    owner: 'Sanjay Kumar Mugada',
  });
  nb2.id = 'nb_knn_impute';

  const nb3 = parseNotebookContent({
    name: '03_train_evaluate_rf.ipynb',
    description: 'Trains Random Forest cohort classifier, records evaluation metrics, and exports plot artifact.',
    rawContent: NB_3_JSON,
    owner: 'Godati Vinay Kumar',
  });
  nb3.id = 'nb_train_rf';

  const notebooks = [nb1, nb2, nb3];

  const pipeline: PipelineDefinition = {
    id: 'pipe_clinical_cohort',
    name: 'Clinical Cohort Reproducible ML Pipeline',
    description: 'End-to-end 3-step Papermill DAG turning exploratory cohort notebooks into a scheduled, lineage-tracked production pipeline.',
    version: 'v1.4.0',
    environmentSpec: {
      baseImage: CONTAINER_IMAGE_PINNED,
      pythonVersion: '3.12.7',
      cpuRequest: '4 vCPU',
      memoryRequest: '8 GiB',
    },
    steps: [
      {
        id: 'step_1',
        name: 'Ingest & Validate Cohort',
        notebookId: nb1.id,
        notebookName: nb1.name,
        position: { x: 80, y: 120 },
        parameters: { cohort_source: 'clinical_cohort_v14.parquet', null_threshold: '0.05', schema_version: '2.1' },
        timeoutSec: 120,
        retries: 2,
        status: 'succeeded',
      },
      {
        id: 'step_2',
        name: 'KNN Feature Imputation',
        notebookId: nb2.id,
        notebookName: nb2.name,
        position: { x: 370, y: 120 },
        parameters: { knn_neighbors: '1', imputer_weights: 'distance', random_seed: '42' },
        timeoutSec: 180,
        retries: 2,
        status: 'succeeded',
      },
      {
        id: 'step_3',
        name: 'Train & Evaluate RF',
        notebookId: nb3.id,
        notebookName: nb3.name,
        position: { x: 660, y: 120 },
        parameters: { n_estimators: '200', max_depth: '12', eval_metric: 'roc_auc' },
        timeoutSec: 240,
        retries: 1,
        status: 'succeeded',
      },
    ],
    edges: [
      { id: 'edge_1_2', source: 'step_1', target: 'step_2', label: 'cleaned_cohort.parquet' },
      { id: 'edge_2_3', source: 'step_2', target: 'step_3', label: 'imputed_features.parquet' },
    ],
    validationErrors: [],
    createdAt: '2026-11-10T08:00:00.000Z',
    updatedAt: '2026-11-21T14:30:00.000Z',
  };

  const allImports = Array.from(new Set([...nb1.imports, ...nb2.imports, ...nb3.imports]));

  const makeRun = (cfg: {
    id: string;
    status: PipelineRun['status'];
    triggeredBy: PipelineRun['triggeredBy'];
    startedAt: string;
    durationSec: number;
    params: Record<string, string>;
    gitCommit: string;
    reproductionOfRunId?: string;
  }): PipelineRun => {
    const env = captureEnvironment({ runId: cfg.id, pipeline, gitCommit: cfg.gitCommit });
    const lock = analyzeDependencies(cfg.id, allImports);
    const { nodes, edges, artifacts } = buildRunLineage({
      runId: cfg.id,
      pipeline,
      parameters: cfg.params,
      status: cfg.status,
    });

    const stepStatuses: Record<string, PipelineRun['status']> = {
      step_1: 'succeeded',
      step_2: cfg.status === 'degraded' ? 'degraded' : 'succeeded',
      step_3: cfg.status === 'failed' ? 'failed' : cfg.status === 'reproduced' ? 'succeeded' : cfg.status,
    };

    const logs = [
      {
        id: `log_${cfg.id}_1`,
        runId: cfg.id,
        stepId: 'step_1',
        timestamp: cfg.startedAt,
        level: 'INFO' as const,
        message: `Frozen OCI digest ${env.containerDigest} · Papermill 2.6.0 executing 01_ingest_clinical_cohort.ipynb`,
      },
      {
        id: `log_${cfg.id}_2`,
        runId: cfg.id,
        stepId: 'step_2',
        timestamp: cfg.startedAt,
        level: cfg.status === 'degraded' ? ('WARN' as const) : ('INFO' as const),
        message:
          cfg.status === 'degraded'
            ? 'OpenLineage endpoint latency spike detected; buffered facet payload to local WAL before flush.'
            : `Step 2 completed KNN imputation (k=${cfg.params.knn_neighbors || '1'}, seed=${cfg.params.random_seed || '42'}).`,
      },
      {
        id: `log_${cfg.id}_3`,
        runId: cfg.id,
        stepId: 'step_3',
        timestamp: cfg.startedAt,
        level: cfg.status === 'failed' ? ('ERROR' as const) : ('INFO' as const),
        message:
          cfg.status === 'failed'
            ? 'Schema contract error: column FGFR4 missing in upstream cohort_v13 batch. Aborted fail-closed.'
            : 'Step 3 finished: emitted rf_evaluation_metrics.json and feature_importance_plot.png with SHA-256 hashes.',
      },
    ];

    return {
      id: cfg.id,
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      scheduleId: cfg.triggeredBy === 'scheduled' ? 'sched_daily_cohort' : undefined,
      triggeredBy: cfg.triggeredBy,
      status: cfg.status,
      startedAt: cfg.startedAt,
      completedAt: new Date(new Date(cfg.startedAt).getTime() + cfg.durationSec * 1000).toISOString(),
      durationSec: cfg.durationSec,
      parameters: cfg.params,
      stepStatuses,
      environment: env,
      dependencyLock: lock,
      lineageNodes: nodes,
      lineageEdges: edges,
      artifacts,
      logs,
      reproductionOfRunId: cfg.reproductionOfRunId,
    };
  };

  // 5 Historical Runs: 2 succeeded, 1 failed, 1 degraded, 1 reproduced
  const run1 = makeRun({
    id: 'run_4001',
    status: 'succeeded',
    triggeredBy: 'scheduled',
    startedAt: '2026-11-18T06:00:00.000Z',
    durationSec: 46.2,
    params: { cohort_source: 'clinical_cohort_v14.parquet', knn_neighbors: '5', random_seed: '42', n_estimators: '200' },
    gitCommit: '7d1e04c',
  });

  const run2 = makeRun({
    id: 'run_4002',
    status: 'succeeded',
    triggeredBy: 'scheduled',
    startedAt: '2026-11-20T06:00:00.000Z',
    durationSec: 42.8,
    params: { cohort_source: 'clinical_cohort_v14.parquet', knn_neighbors: '1', random_seed: '42', n_estimators: '200' },
    gitCommit: '8f3c21a',
  });

  const run3 = makeRun({
    id: 'run_4003',
    status: 'failed',
    triggeredBy: 'scheduled',
    startedAt: '2026-11-21T06:00:00.000Z',
    durationSec: 19.4,
    params: { cohort_source: 'clinical_cohort_v13_corrupt.parquet', knn_neighbors: '1', random_seed: '42', n_estimators: '200' },
    gitCommit: '8f3c21a',
  });

  const run4 = makeRun({
    id: 'run_4004',
    status: 'degraded',
    triggeredBy: 'manual',
    startedAt: '2026-11-21T15:10:00.000Z',
    durationSec: 53.7,
    params: { cohort_source: 'clinical_cohort_v14.parquet', knn_neighbors: '1', random_seed: '42', n_estimators: '200' },
    gitCommit: '8f3c21a',
  });

  const run5 = makeRun({
    id: 'run_4005',
    status: 'reproduced',
    triggeredBy: 'reproduction',
    startedAt: '2026-11-22T09:15:00.000Z',
    durationSec: 42.1,
    params: { ...run2.parameters },
    gitCommit: run2.environment.gitCommit,
    reproductionOfRunId: run2.id,
  });

  const runs = [run5, run4, run3, run2, run1];

  const schedules: ScheduleRecord[] = [
    {
      id: 'sched_daily_cohort',
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      triggerType: 'cron',
      cronExpression: '0 6 * * *',
      timezone: 'UTC',
      enabled: true,
      parameterOverrides: { knn_neighbors: '1', n_estimators: '200', random_seed: '42' },
      nextRunAt: '2026-11-23T06:00:00.000Z',
      lastRunId: run2.id,
      lastRunStatus: run2.status,
      createdAt: '2026-11-12T10:00:00.000Z',
    },
    {
      id: 'sched_weekly_audit',
      pipelineId: pipeline.id,
      pipelineName: pipeline.name,
      triggerType: 'interval',
      cronExpression: '0 2 * * 0',
      intervalMinutes: 10080,
      timezone: 'UTC',
      enabled: true,
      parameterOverrides: { knn_neighbors: '5', n_estimators: '300', random_seed: '42' },
      nextRunAt: '2026-11-29T02:00:00.000Z',
      lastRunId: run1.id,
      lastRunStatus: run1.status,
      createdAt: '2026-11-14T11:30:00.000Z',
    },
  ];

  // 1 completed reproduction with full side-by-side diff
  const completedRepro = computeReproductionDiff(run2, run5);
  completedRepro.id = 'repro_4002_verify';

  // 1 fault-injection record per NT-1..NT-5
  const faultTests: FaultInjectionTest[] = (['NT-1', 'NT-2', 'NT-3', 'NT-4', 'NT-5'] as const).map((code) =>
    executeFaultInjectionTest(code)
  );

  // KPI-1..KPI-6 from NoteOps Project Charter
  const kpis: KpiSnapshot[] = [
    {
      id: 'KPI-1',
      measure: 'Reproduction Fidelity of Historical Runs',
      unit: 'ratio',
      direction: 'higher',
      baselineValue: 0.84,
      targetRule: '≥ O2 + 3 pp (≥ 0.87)',
      targetNumeric: 0.87,
      currentValue: 0.996,
      acceptanceConditions: ['AC-1', 'AC-3'],
      status: 'pass',
    },
    {
      id: 'KPI-2',
      measure: 'Lineage & Metadata Completeness',
      unit: '%',
      direction: 'higher',
      baselineValue: 78.0,
      targetRule: '≥ 95.0% (100% safety items)',
      targetNumeric: 95.0,
      currentValue: 99.4,
      acceptanceConditions: ['AC-1', 'AC-3'],
      status: 'pass',
    },
    {
      id: 'KPI-3',
      measure: 'Scheduling Reliability Test Pass Rate',
      unit: '%',
      direction: 'higher',
      baselineValue: 91.5,
      targetRule: '≥ O2 + 3 pp (≥ 94.5%)',
      targetNumeric: 94.5,
      currentValue: 98.8,
      acceptanceConditions: ['AC-1', 'AC-3'],
      status: 'pass',
    },
    {
      id: 'KPI-4',
      measure: 'Successful Recovery Rate Under Fault Injection',
      unit: '%',
      direction: 'higher',
      baselineValue: 82.0,
      targetRule: '≥ O2 + 3 pp (≥ 85.0%)',
      targetNumeric: 85.0,
      currentValue: 100.0,
      acceptanceConditions: ['AC-1', 'AC-2', 'AC-3'],
      status: 'pass',
    },
    {
      id: 'KPI-5',
      measure: 'Service Error Rate at Declared Load',
      unit: '%',
      direction: 'lower',
      baselineValue: 1.4,
      targetRule: '≤ 0.80 × O2 (≤ 1.12%)',
      targetNumeric: 1.12,
      currentValue: 0.32,
      acceptanceConditions: ['AC-1', 'AC-3'],
      status: 'pass',
    },
    {
      id: 'KPI-6',
      measure: 'Request Latency p95',
      unit: 'ms',
      direction: 'lower',
      baselineValue: 210,
      targetRule: '≤ 0.80 × O2 (≤ 168 ms)',
      targetNumeric: 168,
      currentValue: 114,
      acceptanceConditions: ['AC-1', 'AC-4'],
      status: 'pass',
    },
  ];

  const acceptanceConditions: AcceptanceCondition[] = [
    {
      id: 'AC-1',
      title: 'Representative Operation',
      description: 'Validate reproducibility and OpenLineage completeness across multi-step scheduled notebook pipelines.',
      status: 'pass',
      evidenceSummary: '3 parameterized notebooks executed in scheduled DAG with 99.4% lineage completeness.',
    },
    {
      id: 'AC-2',
      title: 'Boundary and Failure Operation',
      description: 'Exercise environment drift breaking reproduction, lost lineage, hidden notebook state, timeouts, and partition faults.',
      status: 'pass',
      evidenceSummary: 'All 5 mandatory negative tests (NT-1..NT-5) passed with degraded-mode capture and clean recovery.',
    },
    {
      id: 'AC-3',
      title: 'Independent Acceptance Evidence',
      description: 'Use a representative workload and independent fault campaign with versioned configuration and workload traces.',
      status: 'pass',
      evidenceSummary: 'Versioned fixtures, SHA-256 lock manifests, and historical reproduction diff oracle verified.',
    },
    {
      id: 'AC-4',
      title: 'Frozen Resource Envelope',
      description: 'Use the same approved versions, workload, hardware limits, and resource budget for reference and final comparisons.',
      status: 'pass',
      evidenceSummary: 'Pinned container digest + 4 vCPU / 8 GiB pod envelope enforced across baseline and candidate runs.',
    },
  ];

  const settings: WorkspaceSettings = {
    artifactStorageUri: ARTIFACT_URI_PREFIX,
    containerRegistry: CONTAINER_REGISTRY,
    openLineageEndpoint: OPENLINEAGE_ENDPOINT,
    defaultTimeoutSec: 180,
    enforceStrictLockMatch: true,
    autoFailClosedOnDrift: true,
  };

  return {
    notebooks,
    pipelines: [pipeline],
    schedules,
    runs,
    reproductions: [completedRepro],
    faultTests,
    kpis,
    acceptanceConditions,
    settings,
  };
}

export const CAPSTONE_DOCUMENTS: CapstoneDocument[] = [
  {
    id: 'doc_spec',
    title: 'NoteOps Official Capstone Charter & Specification',
    subtitle: 'KL University · O1–O5 Gates, AC-1..AC-4, KPI-1..KPI-6 Contract',
    url: '/assets/aistudio/capstone_project_details_1b064970.pdf',
  },
  {
    id: 'doc_review',
    title: 'Capstone Review Deck — Turning Notebooks into Reproducible Scheduled Pipelines',
    subtitle: 'Team C-162 · Guide: Dr. K.V.D. Kiran · Architecture & ER Diagram',
    url: '/assets/aistudio/Capstone_Review_Notebooks_Pipelines__1___2__9aa244da.pdf',
  },
  {
    id: 'doc_poster',
    title: 'Capstone Poster CP3 — End-to-End Pipeline Architecture',
    subtitle: 'Department of CSE · Academic Year 2026–2027',
    url: '/assets/aistudio/poster_cp3_cd16dcb9.pdf',
  },
  {
    id: 'doc_paper',
    title: 'Provenance and Comparative Visualization for Exploratory Notebooks',
    subtitle: 'Eckelt, Gadhave, Lex, Streit · IEEE TVCG Vol. 31, No. 1 (2025)',
    url: '/assets/aistudio/01_LOOPS_IEEE_PAPER_ca39fa63.pdf',
  },
];
