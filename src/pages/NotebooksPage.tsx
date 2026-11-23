import { useEffect, useRef, useState } from 'react';
import { Code2, FileText, GitBranch, Package, Sliders, Trash2, Upload } from 'lucide-react';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { NotebookRecord } from '../types/domain';

export function NotebooksPage() {
  const [notebooks, setNotebooks] = useState<NotebookRecord[]>([]);
  const [selected, setSelected] = useState<NotebookRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const setActiveSection = useAppStore((s) => s.setActiveSection);
  const pushToast = useAppStore((s) => s.pushToast);

  const loadNotebooks = async () => {
    const res = await api.listNotebooks();
    setNotebooks(res.notebooks);
    setSelected((prev) => prev || res.notebooks[0] || null);
  };

  useEffect(() => {
    loadNotebooks();
  }, []);

  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const rawContent = await file.text();
      const res = await api.uploadNotebook({
        name: file.name,
        rawContent,
      });
      setNotebooks((prev) => [res.notebook, ...prev]);
      setSelected(res.notebook);
      pushToast(
        'success',
        `Parsed ${res.notebook.name}: ${res.notebook.parameters.length} parameters and ${res.notebook.imports.length} imports detected`
      );
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Notebook upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadSample = async () => {
    setUploading(true);
    try {
      const sampleIpynb = JSON.stringify({
        metadata: { kernelspec: { name: 'python3' }, language_info: { version: '3.12.7' } },
        cells: [
          {
            cell_type: 'markdown',
            source: ['# 04 — Drift Evaluation & Calibration Report\nComputes PSI drift score and calibration curve for scheduled production monitoring.'],
          },
          {
            cell_type: 'code',
            metadata: { tags: ['parameters'] },
            execution_count: 1,
            source: [
              'reference_window_days = 30\n',
              'psi_alert_threshold = 0.2\n',
              'report_format = "parquet"\n',
            ],
          },
          {
            cell_type: 'code',
            execution_count: 2,
            source: [
              'import pandas as pd\n',
              'import numpy as np\n',
              'import scipy\n',
              'df = pd.read_parquet("imputed_features.parquet")\n',
              'print(f"Evaluated {len(df)} rows with threshold {psi_alert_threshold}")\n',
            ],
          },
        ],
      });
      const res = await api.uploadNotebook({
        name: '04_drift_calibration_check.ipynb',
        description: 'Sample ingested notebook with Papermill parameter tags and SciPy/Pandas imports.',
        rawContent: sampleIpynb,
      });
      setNotebooks((prev) => [res.notebook, ...prev]);
      setSelected(res.notebook);
      pushToast('success', `Ingested ${res.notebook.name} (${res.notebook.parameters.length} params detected)`);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to ingest sample notebook');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (nb: NotebookRecord) => {
    try {
      await api.deleteNotebook(nb.id);
      const next = notebooks.filter((n) => n.id !== nb.id);
      setNotebooks(next);
      if (selected?.id === nb.id) setSelected(next[0] || null);
      pushToast('info', `Deleted ${nb.name}`);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1440px]">
      {/* Upload Action Strip */}
      <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Jupyter Notebook Repository &amp; Parameter Parser
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Upload any <code className="font-mono">.ipynb</code> notebook to inspect cells, auto-detect Papermill parameter cells, extract Python imports, and compose a scheduled pipeline DAG.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".ipynb,.py,.json"
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={handleUploadSample}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-[#1E3A5F] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1B2A4A] transition-colors whitespace-nowrap"
          >
            Ingest Sample .ipynb
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#00A3CC] dark:bg-[#00D4FF] text-white dark:text-[#08131E] hover:bg-[#008EB3] dark:hover:bg-[#33DDFF] disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? 'Parsing Notebook...' : 'Upload .ipynb File'}</span>
          </button>
        </div>
      </div>

      {/* Main Split: Notebook List (Left) + Inspector (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 space-y-3">
          {notebooks.map((nb) => {
            const active = selected?.id === nb.id;
            return (
              <div
                key={nb.id}
                onClick={() => setSelected(nb)}
                className={`rounded-xl border p-4 cursor-pointer transition-colors ${
                  active
                    ? 'border-[#00D4FF] bg-[#00D4FF]/6 dark:bg-[#162B47]'
                    : 'border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] hover:border-slate-300 dark:hover:border-[#2C4F7C]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {nb.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
                      {nb.cells.length} cells · {nb.parameters.length} params · {nb.imports.length} imports
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(nb);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-rose-500"
                    aria-label={`Delete ${nb.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-2 leading-relaxed">
                  {nb.description}
                </p>
                <div className="text-[11px] font-mono text-slate-400 mt-2">
                  {nb.checksum} · Python {nb.pythonVersionHint}
                </div>
              </div>
            );
          })}
        </div>

        <div className="xl:col-span-8 space-y-6">
          {selected && (
            <>
              {/* Detected Parameters & Imports Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-[#008EB3] dark:text-[#00D4FF]" />
                      <span>Detected Parameters ({selected.parameters.length})</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveSection('pipelines')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#008EB3] dark:text-[#00D4FF] hover:underline"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>Add to DAG</span>
                    </button>
                  </div>

                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-[#1E3A5F] text-slate-500 dark:text-slate-400">
                        <th className="py-2 text-left font-medium">Name</th>
                        <th className="py-2 text-left font-medium">Type</th>
                        <th className="py-2 text-right font-medium">Default</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-[#1E3A5F]">
                      {selected.parameters.map((p) => (
                        <tr key={p.name}>
                          <td className="py-2 font-mono font-semibold text-[#008EB3] dark:text-[#00D4FF]">
                            {p.name}
                          </td>
                          <td className="py-2 font-mono text-slate-500 dark:text-slate-400">{p.type}</td>
                          <td className="py-2 text-right font-mono text-slate-800 dark:text-slate-200">
                            {p.defaultValue}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4 text-emerald-500 dark:text-[#00FF88]" />
                    <span>Extracted Imports ({selected.imports.length})</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Automatically captured by the dependency analyzer when building pip/conda locks for reproducible execution.
                  </p>
                  <div className="space-y-1.5 text-xs font-mono text-slate-700 dark:text-slate-200">
                    {selected.imports.length > 0 ? (
                      selected.imports.map((imp) => (
                        <div
                          key={imp}
                          className="flex items-center justify-between py-1.5 border-b border-slate-200/70 dark:border-[#1E3A5F]/70 last:border-0"
                        >
                          <span>{imp}</span>
                          <span className="text-slate-400">pinned at runtime</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-500">No external imports detected.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Cell-by-Cell Notebook Inspector */}
              <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Notebook Cell Inspector — {selected.name}
                  </h3>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    Kernel: {selected.kernelName} · Owner: {selected.owner}
                  </span>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-[#1E3A5F]">
                  {selected.cells.map((cell) => (
                    <div key={cell.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                          {cell.cellType === 'markdown' ? (
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <Code2 className="w-3.5 h-3.5 text-[#008EB3] dark:text-[#00D4FF]" />
                          )}
                          <span>
                            Cell [{cell.index + 1}] · {cell.cellType}
                          </span>
                          {cell.isParameterCell && (
                            <span className="text-emerald-600 dark:text-[#00FF88] font-semibold">
                              · Papermill Parameters
                            </span>
                          )}
                        </span>
                        <span className="text-slate-400 tabular-nums">
                          exec_count: {cell.executionCount ?? '—'}
                        </span>
                      </div>

                      <pre className="p-3 rounded-lg bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F] text-xs font-mono leading-relaxed text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap">
                        {cell.source}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
