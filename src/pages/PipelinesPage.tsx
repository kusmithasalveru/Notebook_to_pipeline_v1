import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Play, Plus, Save, Trash2 } from 'lucide-react';
import { DagCanvas, type DagNodeItem } from '../components/visualization/DagCanvas';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { NotebookRecord, PipelineDefinition, PipelineEdge, PipelineStep } from '../types/domain';

export function PipelinesPage() {
  const [pipelines, setPipelines] = useState<PipelineDefinition[]>([]);
  const [notebooks, setNotebooks] = useState<NotebookRecord[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [envSpec, setEnvSpec] = useState({
    baseImage: 'ghcr.io/cloud39/notebook-runner:py312-pinned',
    pythonVersion: '3.12.7',
    cpuRequest: '4 vCPU',
    memoryRequest: '8 GiB',
  });
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [edges, setEdges] = useState<PipelineEdge[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [addNotebookId, setAddNotebookId] = useState('');
  const [saving, setSaving] = useState(false);

  const setActiveSection = useAppStore((s) => s.setActiveSection);
  const setSelectedRunId = useAppStore((s) => s.setSelectedRunId);
  const pushToast = useAppStore((s) => s.pushToast);

  const hydratePipeline = (pl: PipelineDefinition) => {
    setActiveId(pl.id);
    setName(pl.name);
    setDescription(pl.description);
    setEnvSpec(pl.environmentSpec);
    setSteps(pl.steps);
    setEdges(pl.edges);
    setValidationErrors(pl.validationErrors);
    setSelectedStepId(pl.steps[0]?.id || null);
  };

  useEffect(() => {
    Promise.all([api.listPipelines(), api.listNotebooks()]).then(([pRes, nRes]) => {
      setPipelines(pRes.pipelines);
      setNotebooks(nRes.notebooks);
      if (nRes.notebooks[0]) setAddNotebookId(nRes.notebooks[0].id);
      if (pRes.pipelines[0]) hydratePipeline(pRes.pipelines[0]);
    });
  }, []);

  const dagNodes: DagNodeItem[] = useMemo(
    () =>
      steps.map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: s.notebookName,
        categoryLabel: `Step · ${Object.keys(s.parameters).length} params`,
        status: s.status,
        position: s.position,
      })),
    [steps]
  );

  const selectedStep = steps.find((s) => s.id === selectedStepId) || null;

  const handleAddStep = () => {
    const nb = notebooks.find((n) => n.id === addNotebookId) || notebooks[0];
    if (!nb) return;
    const stepNum = steps.length + 1;
    const stepId = `step_${Date.now().toString(36).slice(-4)}`;
    const defaultParams: Record<string, string> = {};
    nb.parameters.forEach((p) => {
      defaultParams[p.name] = p.defaultValue;
    });

    const newStep: PipelineStep = {
      id: stepId,
      name: `Step ${stepNum}: ${nb.name.replace(/\.ipynb$/, '')}`,
      notebookId: nb.id,
      notebookName: nb.name,
      position: { x: 80 + steps.length * 260, y: 120 },
      parameters: defaultParams,
      timeoutSec: 180,
      retries: 2,
      status: 'idle',
    };

    const prevStep = steps[steps.length - 1];
    setSteps((prev) => [...prev, newStep]);
    if (prevStep) {
      setEdges((prev) => [
        ...prev,
        { id: `edge_${prevStep.id}_${stepId}`, source: prevStep.id, target: stepId, label: 'artifact.parquet' },
      ]);
    }
    setSelectedStepId(stepId);
  };

  const handleRemoveStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
    if (selectedStepId === id) setSelectedStepId(null);
  };

  const handleNodeMove = (nodeId: string, pos: { x: number; y: number }) => {
    setSteps((prev) => prev.map((s) => (s.id === nodeId ? { ...s, position: pos } : s)));
  };

  const handleUpdateStepParam = (key: string, val: string) => {
    if (!selectedStep) return;
    setSteps((prev) =>
      prev.map((s) =>
        s.id === selectedStep.id ? { ...s, parameters: { ...s.parameters, [key]: val } } : s
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.savePipeline({
        id: activeId || undefined,
        name,
        description,
        environmentSpec: envSpec,
        steps,
        edges,
      });
      setPipelines((prev) => {
        const exists = prev.some((p) => p.id === res.pipeline.id);
        return exists
          ? prev.map((p) => (p.id === res.pipeline.id ? res.pipeline : p))
          : [res.pipeline, ...prev];
      });
      hydratePipeline(res.pipeline);
      if (res.pipeline.validationErrors.length > 0) {
        pushToast('error', `Saved with ${res.pipeline.validationErrors.length} validation issue(s)`);
      } else {
        pushToast('success', `Validated and saved DAG "${res.pipeline.name}"`);
      }
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    if (!activeId) return;
    try {
      const res = await api.triggerRun({ pipelineId: activeId, triggeredBy: 'manual' });
      setSelectedRunId(res.run.id);
      pushToast('success', `Triggered manual run ${res.run.id} — streaming live logs`);
      setActiveSection('runs');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to trigger run');
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1440px]">
      {/* Pipeline Selector & Action Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Select pipeline"
            value={activeId}
            onChange={(e) => {
              const found = pipelines.find((p) => p.id === e.target.value);
              if (found) hydratePipeline(found);
            }}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F] text-slate-900 dark:text-slate-100"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.version})
              </option>
            ))}
          </select>

          <select
            aria-label="Notebook to append as step"
            value={addNotebookId}
            onChange={(e) => setAddNotebookId(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F] text-slate-800 dark:text-slate-200"
          >
            {notebooks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleAddStep}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-[#1E3A5F] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1B2A4A] whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Notebook Step</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-[#00D4FF]/60 text-[#007FA3] dark:text-[#00D4FF] hover:bg-[#00D4FF]/10 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Validate & Save DAG'}</span>
          </button>
          <button
            type="button"
            onClick={handleRunNow}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#00A3CC] dark:bg-[#00D4FF] text-white dark:text-[#08131E] hover:bg-[#008EB3] dark:hover:bg-[#33DDFF] whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run Pipeline Now</span>
          </button>
        </div>
      </div>

      {/* Validation Status Line */}
      {validationErrors.length > 0 ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-200 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>DAG Validation Errors ({validationErrors.length})</span>
          </div>
          {validationErrors.map((err, i) => (
            <div key={i}>• {err}</div>
          ))}
        </div>
      ) : (
        <div className="text-xs font-mono text-emerald-600 dark:text-[#00FF88] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>DAG Validated · Acyclic ({steps.length} steps, {edges.length} edges) · Ready for scheduled execution</span>
        </div>
      )}

      {/* Interactive DAG Canvas */}
      <DagCanvas
        nodes={dagNodes}
        edges={edges}
        selectedNodeId={selectedStepId}
        onSelectNode={setSelectedStepId}
        onNodeMove={handleNodeMove}
        heightClass="min-h-[340px]"
      />

      {/* Bottom Split: Selected Step Parameters + Pipeline Environment Spec */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5 space-y-4">
          {selectedStep ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-[#1E3A5F] pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Step Configuration — {selectedStep.name}
                  </h3>
                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                    Notebook: {selectedStep.notebookName} · Timeout {selectedStep.timeoutSec}s · Retries {selectedStep.retries}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveStep(selectedStep.id)}
                  className="inline-flex items-center gap-1 text-xs text-rose-500 hover:underline"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Step</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(selectedStep.parameters).map(([k, v]) => (
                  <div key={k}>
                    <label className="block text-xs font-mono text-slate-600 dark:text-slate-300 mb-1">
                      {k}
                    </label>
                    <input
                      type="text"
                      value={v}
                      onChange={(e) => handleUpdateStepParam(k, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F] text-slate-900 dark:text-slate-100"
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
              Select any step node on the DAG canvas above to inspect or edit its Papermill parameters.
            </div>
          )}
        </div>

        <div className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Frozen Container &amp; Resource Envelope (AC-4)
          </h3>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">OCI Base Image</label>
            <input
              type="text"
              value={envSpec.baseImage}
              onChange={(e) => setEnvSpec((prev) => ({ ...prev, baseImage: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F] text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Python</label>
              <input
                type="text"
                value={envSpec.pythonVersion}
                onChange={(e) => setEnvSpec((prev) => ({ ...prev, pythonVersion: e.target.value }))}
                className="w-full px-2.5 py-2 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F]"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">CPU</label>
              <input
                type="text"
                value={envSpec.cpuRequest}
                onChange={(e) => setEnvSpec((prev) => ({ ...prev, cpuRequest: e.target.value }))}
                className="w-full px-2.5 py-2 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F]"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Memory</label>
              <input
                type="text"
                value={envSpec.memoryRequest}
                onChange={(e) => setEnvSpec((prev) => ({ ...prev, memoryRequest: e.target.value }))}
                className="w-full px-2.5 py-2 rounded-lg text-xs font-mono bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
