import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Database,
  FileCode2,
  GitFork,
  Hash,
  Layers,
  Package,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { DagCanvas, statusTextClass, type DagEdgeItem, type DagNodeItem } from '../components/visualization/DagCanvas';
import type {
  ArtifactRecord,
  DependencyLock,
  EnvironmentManifest,
  LineageEdge,
  LineageNode,
  PipelineRun,
} from '../types/domain';

export function LineagePage() {
  const { selectedRunId, setSelectedRunId, setActiveSection, pushToast } = useAppStore();

  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [activeRunId, setActiveRunId] = useState<string>(selectedRunId || '');
  const [nodes, setNodes] = useState<LineageNode[]>([]);
  const [edges, setEdges] = useState<LineageEdge[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
  const [environment, setEnvironment] = useState<EnvironmentManifest | null>(null);
  const [dependencyLock, setDependencyLock] = useState<DependencyLock | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRuns = async () => {
    try {
      const res = await api.listRuns();
      setRuns(res.runs);
      const targetId =
        (selectedRunId && res.runs.some((r) => r.id === selectedRunId) && selectedRunId) ||
        (activeRunId && res.runs.some((r) => r.id === activeRunId) && activeRunId) ||
        res.runs[0]?.id ||
        '';
      if (targetId) {
        setActiveRunId(targetId);
      } else {
        setLoading(false);
      }
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to load runs');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedRunId && selectedRunId !== activeRunId) {
      setActiveRunId(selectedRunId);
    }
  }, [selectedRunId, activeRunId]);

  useEffect(() => {
    if (!activeRunId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([api.getLineage(activeRunId), api.getEnvironment(activeRunId)])
      .then(([lineageRes, envRes]) => {
        if (cancelled) return;
        setNodes(lineageRes.nodes);
        setEdges(lineageRes.edges);
        setArtifacts(lineageRes.artifacts);
        setEnvironment(envRes.environment);
        setDependencyLock(envRes.dependencyLock);
        setSelectedNodeId((prev) =>
          prev && lineageRes.nodes.some((n) => n.id === prev) ? prev : lineageRes.nodes[0]?.id || null
        );
      })
      .catch((err) => {
        if (!cancelled) {
          pushToast('error', err instanceof Error ? err.message : 'Failed to load lineage graph');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRunId, pushToast]);

  const activeRun = useMemo(() => runs.find((r) => r.id === activeRunId) || null, [runs, activeRunId]);

  const dagNodes: DagNodeItem[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        title: n.label,
        subtitle: n.sha256 ? `sha256:${n.sha256.slice(0, 14)}…` : n.uri,
        categoryLabel:
          n.kind === 'dataset_in' ? 'DATASET' : n.kind === 'artifact_out' ? 'ARTIFACT' : 'STEP',
        status: n.status,
        position: n.position,
      })),
    [nodes]
  );

  const dagEdges: DagEdgeItem[] = useMemo(
    () =>
      edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.relation,
      })),
    [edges]
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const handleSelectRun = (runId: string) => {
    setActiveRunId(runId);
    setSelectedRunId(runId);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] space-y-6">
      {/* Header & Run Selector Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#1E3A5F]">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            OpenLineage Provenance & Dataset Graph
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Inspect immutable dataset hashes, schema snapshots, step edges, and frozen runtime manifests captured per run.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-mono text-slate-500 dark:text-slate-400" htmlFor="lineage-run-select">
            Run
          </label>
          <select
            id="lineage-run-select"
            value={activeRunId}
            onChange={(e) => handleSelectRun(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#00D4FF]"
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} · {r.status.toUpperCase()} · {r.triggeredBy}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              if (activeRunId) {
                setSelectedRunId(activeRunId);
                setActiveSection('reproduction');
              }
            }}
            disabled={!activeRunId}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#00D4FF] text-[#0D1B2A] text-xs font-semibold hover:bg-[#33DDFF] disabled:opacity-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reproduce Run
          </button>
        </div>
      </div>

      {/* Run Provenance Summary Strip */}
      {activeRun && environment && dependencyLock && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Run & Status</span>
              <GitFork className="w-4 h-4 text-[#00D4FF]" />
            </div>
            <div className="mt-2 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
              {activeRun.id}{' '}
              <span className={`uppercase text-xs ${statusTextClass(activeRun.status)}`}>
                · {activeRun.status}
              </span>
            </div>
            <div className="mt-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
              {activeRun.pipelineName}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Container Digest</span>
              <Layers className="w-4 h-4 text-emerald-500 dark:text-[#00FF88]" />
            </div>
            <div className="mt-2 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              {environment.containerImage}
            </div>
            <div className="mt-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
              {environment.containerDigest}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Dependency Lock ({dependencyLock.resolver})</span>
              <Package className="w-4 h-4 text-[#00D4FF]" />
            </div>
            <div className="mt-2 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              sha256:{dependencyLock.lockfileHash}
            </div>
            <div className="mt-1 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {dependencyLock.entries.length} pinned packages · Python {environment.pythonVersion}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Lineage Coverage</span>
              <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-[#00FF88]" />
            </div>
            <div className="mt-2 font-mono tabular-nums text-sm font-semibold text-slate-900 dark:text-slate-100">
              {nodes.length} nodes · {edges.length} edges
            </div>
            <div className="mt-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Git {environment.gitCommit} · Papermill {environment.papermillVersion}
            </div>
          </div>
        </div>
      )}

      {/* Lineage Canvas + Node Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8">
          {loading ? (
            <div className="min-h-[420px] rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] flex items-center justify-center text-xs font-mono text-slate-500 dark:text-slate-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#00D4FF]" />
              Loading OpenLineage provenance graph…
            </div>
          ) : (
            <DagCanvas
              nodes={dagNodes}
              edges={dagEdges}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              heightClass="min-h-[420px]"
            />
          )}
        </div>

        {/* Selected Node Inspector */}
        <div className="xl:col-span-4 rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#1E3A5F]">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Node Provenance Inspector
            </h3>
            {selectedNode && (
              <span className={`text-[11px] font-mono uppercase ${statusTextClass(selectedNode.status)}`}>
                {selectedNode.kind} · {selectedNode.status}
              </span>
            )}
          </div>

          {!selectedNode ? (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 py-10 text-center">
              Select any dataset, execution step, or output artifact node on the graph to inspect its SHA-256 fingerprint and schema snapshot.
            </div>
          ) : (
            <div className="mt-4 space-y-4 text-xs">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Entity Label
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedNode.label}
                </div>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F] font-mono text-[11px]">
                <div className="flex items-start gap-2">
                  <Database className="w-3.5 h-3.5 text-[#00D4FF] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-slate-500 dark:text-slate-400">URI</div>
                    <div className="text-slate-800 dark:text-slate-200 break-all">{selectedNode.uri}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 pt-2 border-t border-slate-200 dark:border-[#1E3A5F]">
                  <Hash className="w-3.5 h-3.5 text-emerald-500 dark:text-[#00FF88] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-slate-500 dark:text-slate-400">Content SHA-256</div>
                    <div className="text-slate-800 dark:text-slate-200 break-all">{selectedNode.sha256}</div>
                  </div>
                </div>
                {typeof selectedNode.rowCount === 'number' && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-[#1E3A5F]">
                    <span className="text-slate-500 dark:text-slate-400">Row Count</span>
                    <span className="tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                      {selectedNode.rowCount.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Schema Snapshot Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Schema Snapshot
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {selectedNode.schemaSnapshot?.length || 0} columns
                  </span>
                </div>

                {selectedNode.schemaSnapshot && selectedNode.schemaSnapshot.length > 0 ? (
                  <div className="rounded-lg border border-slate-200 dark:border-[#1E3A5F] overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-[#0D1B2A] text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1E3A5F]">
                          <th className="py-2 px-3">Column</th>
                          <th className="py-2 px-3">DType</th>
                          <th className="py-2 px-3 text-right">Null</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-[#1E3A5F] font-mono text-[11px]">
                        {selectedNode.schemaSnapshot.map((col) => (
                          <tr key={col.column} className="hover:bg-slate-50 dark:hover:bg-[#1B2A4A]/40">
                            <td className="py-1.5 px-3 text-slate-900 dark:text-slate-100">{col.column}</td>
                            <td className="py-1.5 px-3 text-[#008EB3] dark:text-[#00D4FF]">{col.dtype}</td>
                            <td className="py-1.5 px-3 text-right text-slate-500 dark:text-slate-400">
                              {col.nullable ? 'yes' : 'no'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border border-dashed border-slate-200 dark:border-[#1E3A5F] text-[11px] text-slate-500 dark:text-slate-400">
                    No tabular schema attached to this {selectedNode.kind} entity.
                  </div>
                )}
              </div>

              {/* Connected Edges */}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Connected Lineage Edges
                </div>
                <div className="space-y-1.5">
                  {edges
                    .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                    .map((e) => {
                      const src = nodes.find((n) => n.id === e.source)?.label || e.source;
                      const tgt = nodes.find((n) => n.id === e.target)?.label || e.target;
                      return (
                        <div
                          key={e.id}
                          className="flex items-center gap-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#0D1B2A] px-2.5 py-1.5 rounded border border-slate-200 dark:border-[#1E3A5F]"
                        >
                          <span className="truncate">{src}</span>
                          <ArrowRight className="w-3 h-3 text-[#00D4FF] shrink-0" />
                          <span className="text-[#008EB3] dark:text-[#00D4FF] shrink-0">{e.relation}</span>
                          <ArrowRight className="w-3 h-3 text-[#00D4FF] shrink-0" />
                          <span className="truncate">{tgt}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Captured Artifacts Ledger & Pinned Dependencies */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7 rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-[#00D4FF]" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Captured Run Artifacts & Checksums
              </h3>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {artifacts.length} artifacts
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#0D1B2A] text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1E3A5F]">
                  <th className="py-2.5 px-4">Artifact</th>
                  <th className="py-2.5 px-4">Kind</th>
                  <th className="py-2.5 px-4">SHA-256</th>
                  <th className="py-2.5 px-4 text-right">Size</th>
                  <th className="py-2.5 px-4">Metrics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#1E3A5F] text-xs">
                {artifacts.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-[#1B2A4A]/40">
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{a.name}</div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                        {a.path}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono uppercase text-[11px] text-[#008EB3] dark:text-[#00D4FF]">
                      {a.kind}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {a.sha256.slice(0, 16)}…
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-right text-slate-600 dark:text-slate-300">
                      {a.sizeKb} KB
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {a.metrics
                        ? Object.entries(a.metrics)
                            .map(([k, v]) => `${k}=${v}`)
                            .join(' · ')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dependency Lock Entries */}
        <div className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-500 dark:text-[#00FF88]" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Frozen Dependency Lock
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {dependencyLock?.resolver || 'pip-freeze'}
            </span>
          </div>
          <div className="overflow-x-auto max-h-[320px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#0D1B2A] text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#1E3A5F]">
                  <th className="py-2 px-4">Package</th>
                  <th className="py-2 px-4">Version</th>
                  <th className="py-2 px-4">Wheel SHA-256</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#1E3A5F] font-mono text-[11px]">
                {(dependencyLock?.entries || []).map((dep) => (
                  <tr key={dep.packageName} className="hover:bg-slate-50 dark:hover:bg-[#1B2A4A]/40">
                    <td className="py-2 px-4 text-slate-900 dark:text-slate-100">{dep.packageName}</td>
                    <td className="py-2 px-4 text-emerald-600 dark:text-[#00FF88]">=={dep.version}</td>
                    <td className="py-2 px-4 text-slate-500 dark:text-slate-400">{dep.sha256.slice(0, 14)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
