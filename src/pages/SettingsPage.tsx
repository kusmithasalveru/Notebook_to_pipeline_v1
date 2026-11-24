import { useEffect, useState } from 'react';
import { Database, RefreshCw, Save, Server, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { WorkspaceSettings } from '../types/domain';

export function SettingsPage() {
  const { pushToast } = useAppStore();

  const [form, setForm] = useState<WorkspaceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .getSettings()
      .then((res) => setForm(res.settings))
      .catch((err) => {
        pushToast('error', err instanceof Error ? err.message : 'Failed to load workspace settings');
      })
      .finally(() => setLoading(false));
  }, [pushToast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const res = await api.updateSettings(form);
      setForm(res.settings);
      pushToast('success', 'Workspace reproducibility settings saved');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="p-6 lg:p-8 py-16 flex items-center justify-center text-xs font-mono text-slate-500 dark:text-slate-400 gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-[#00D4FF]" />
        Loading workspace configuration…
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
      <div className="pb-4 border-b border-slate-200 dark:border-[#1E3A5F]">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Workspace & Provenance Runtime Settings
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure artifact storage endpoints, pinned container registries, OpenLineage telemetry collectors, and fail-closed determinism guards.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Infrastructure Endpoints */}
        <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-[#1E3A5F]">
            <Server className="w-4 h-4 text-[#00D4FF]" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Storage, Registry & OpenLineage Endpoints
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Artifact Object Storage URI
              </label>
              <input
                type="text"
                value={form.artifactStorageUri}
                onChange={(e) => setForm({ ...form, artifactStorageUri: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#1E3A5F] bg-slate-50 dark:bg-[#0D1B2A] font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#00D4FF]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Pinned Container Registry
              </label>
              <input
                type="text"
                value={form.containerRegistry}
                onChange={(e) => setForm({ ...form, containerRegistry: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#1E3A5F] bg-slate-50 dark:bg-[#0D1B2A] font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#00D4FF]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                OpenLineage Collector Endpoint
              </label>
              <input
                type="text"
                value={form.openLineageEndpoint}
                onChange={(e) => setForm({ ...form, openLineageEndpoint: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#1E3A5F] bg-slate-50 dark:bg-[#0D1B2A] font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#00D4FF]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Default Step Execution Timeout (seconds)
              </label>
              <input
                type="number"
                min={30}
                max={86400}
                value={form.defaultTimeoutSec}
                onChange={(e) =>
                  setForm({ ...form, defaultTimeoutSec: Math.max(30, Number(e.target.value) || 300) })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-[#1E3A5F] bg-slate-50 dark:bg-[#0D1B2A] font-mono tabular-nums text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#00D4FF]"
              />
            </div>
          </div>
        </div>

        {/* Reproducibility & Fail-Closed Guardrails */}
        <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-[#1E3A5F]">
            <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-[#00FF88]" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Determinism & Fail-Closed Provenance Policies
            </h3>
          </div>

          <label className="flex items-start justify-between gap-4 cursor-pointer p-3 rounded-lg bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F]">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Enforce Strict SHA-256 Dependency Lockfile Match
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Require exact wheel hash verification before executing any scheduled or reproduced notebook step (NT-1 guard).
              </div>
            </div>
            <input
              type="checkbox"
              checked={form.enforceStrictLockMatch}
              onChange={(e) => setForm({ ...form, enforceStrictLockMatch: e.target.checked })}
              className="mt-1 h-4 w-4 accent-[#00D4FF]"
            />
          </label>

          <label className="flex items-start justify-between gap-4 cursor-pointer p-3 rounded-lg bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F]">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Auto Fail-Closed on Input Dataset Drift
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Abort downstream pipeline steps immediately if an input dataset hash or schema column mismatches the pinned contract (NT-2 guard).
              </div>
            </div>
            <input
              type="checkbox"
              checked={form.autoFailClosedOnDrift}
              onChange={(e) => setForm({ ...form, autoFailClosedOnDrift: e.target.checked })}
              className="mt-1 h-4 w-4 accent-[#00D4FF]"
            />
          </label>
        </div>

        {/* Persistence Note & Save */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
            <Database className="w-3.5 h-3.5 text-[#00D4FF]" />
            Workspace metadata persisted to server store (data/noteops_workspace.json)
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00D4FF] text-[#0D1B2A] text-xs font-semibold hover:bg-[#33DDFF] disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
