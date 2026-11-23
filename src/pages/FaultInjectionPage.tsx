import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import type { FaultInjectionTest, NegativeTestCode } from '../types/domain';

const TEST_CATALOG: { code: NegativeTestCode; label: string; shortDesc: string }[] = [
  { code: 'NT-1', label: 'NT-1', shortDesc: 'Missing dependency / lockfile drift' },
  { code: 'NT-2', label: 'NT-2', shortDesc: 'Corrupted or missing input dataset' },
  { code: 'NT-3', label: 'NT-3', shortDesc: 'Worker crash mid-notebook execution' },
  { code: 'NT-4', label: 'NT-4', shortDesc: 'Step timeout & retry budget exhaustion' },
  { code: 'NT-5', label: 'NT-5', shortDesc: 'OpenLineage store outage (degraded mode)' },
];

export function FaultInjectionPage() {
  const { pushToast } = useAppStore();

  const [tests, setTests] = useState<FaultInjectionTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [runningCode, setRunningCode] = useState<NegativeTestCode | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTests = async () => {
    setLoading(true);
    try {
      const res = await api.listFaultTests();
      setTests(res.tests);
      if (res.tests.length > 0) {
        setSelectedTestId((prev) =>
          prev && res.tests.some((t) => t.id === prev) ? prev : res.tests[0].id
        );
      }
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to load fault-injection tests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTest = useMemo(
    () => tests.find((t) => t.id === selectedTestId) || tests[0] || null,
    [tests, selectedTestId]
  );

  const handleRunTest = async (code: NegativeTestCode) => {
    setRunningCode(code);
    try {
      const res = await api.runFaultTest(code);
      setTests((prev) => [res.test, ...prev]);
      setSelectedTestId(res.test.id);
      pushToast(
        'success',
        `${code} executed: ${res.test.outcome.toUpperCase()} (recovered in ${res.test.recoveryTimeSec}s)`
      );
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : `Failed to run ${code}`);
    } finally {
      setRunningCode(null);
    }
  };

  const passCount = tests.filter((t) => t.outcome === 'pass').length;
  const zeroStateLossCount = tests.filter((t) => !t.stateLossDetected).length;
  const zeroDuplicateCount = tests.filter((t) => !t.duplicateWorkDetected).length;

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-[#1E3A5F]">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Fault Injection & Negative Test Suite (NT-1 – NT-5)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Validate fail-closed provenance guards, degraded-mode durability, checkpoint resume, and zero-duplicate recovery under controlled failure injection.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
          <span>
            Passed: <strong className="text-emerald-600 dark:text-[#00FF88]">{passCount}/{tests.length}</strong>
          </span>
          <span>·</span>
          <span>
            Zero State Loss: <strong>{zeroStateLossCount}/{tests.length}</strong>
          </span>
          <span>·</span>
          <span>
            Zero Duplicate Work: <strong>{zeroDuplicateCount}/{tests.length}</strong>
          </span>
        </div>
      </div>

      {/* Trigger Cards for NT-1..NT-5 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {TEST_CATALOG.map((item) => {
          const latest = tests.find((t) => t.code === item.code);
          const busy = runningCode === item.code;
          return (
            <div
              key={item.code}
              className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#008EB3] dark:text-[#00D4FF]">
                    {item.label}
                  </span>
                  {latest && (
                    <span
                      className={`font-mono text-[11px] uppercase font-semibold ${
                        latest.outcome === 'pass'
                          ? 'text-emerald-600 dark:text-[#00FF88]'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {latest.outcome}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 text-xs font-medium text-slate-800 dark:text-slate-200">
                  {item.shortDesc}
                </div>
                {latest && (
                  <div className="mt-1 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    Recovery: {latest.recoveryTimeSec}s
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleRunTest(item.code)}
                disabled={runningCode !== null}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#1E3A5F] bg-slate-50 dark:bg-[#0D1B2A] hover:border-[#00D4FF] text-xs font-medium text-slate-900 dark:text-slate-100 disabled:opacity-50 transition-colors"
              >
                {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00D4FF]" /> : <Play className="w-3.5 h-3.5 text-[#00D4FF]" />}
                {busy ? 'Injecting…' : `Inject ${item.code}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Execution History + Forensic Inspector */}
      {loading ? (
        <div className="py-12 flex items-center justify-center text-xs font-mono text-slate-500 dark:text-slate-400 gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#00D4FF]" />
          Loading fault-injection results…
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Executed Test List */}
          <div className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-[#1E3A5F] flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Executed Negative Tests
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {tests.length} records
              </span>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-[#1E3A5F] max-h-[540px] overflow-y-auto">
              {tests.map((test) => {
                const selected = selectedTest?.id === test.id;
                return (
                  <button
                    key={test.id}
                    type="button"
                    onClick={() => setSelectedTestId(test.id)}
                    className={`w-full text-left p-4 transition-colors ${
                      selected
                        ? 'bg-slate-100 dark:bg-[#1B2A4A]'
                        : 'hover:bg-slate-50 dark:hover:bg-[#1B2A4A]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[#008EB3] dark:text-[#00D4FF]">
                        {test.code} · {test.title}
                      </span>
                      <span
                        className={`font-mono text-[11px] uppercase font-semibold ${
                          test.outcome === 'pass'
                            ? 'text-emerald-600 dark:text-[#00FF88]'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {test.outcome}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span className="tabular-nums">Recovery {test.recoveryTimeSec}s</span>
                      <span>{new Date(test.executedAt).toLocaleString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Forensic Detail Panel */}
          <div className="xl:col-span-7 space-y-4">
            {selectedTest && (
              <>
                <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-[#1E3A5F]">
                    <div>
                      <div className="font-mono text-xs text-[#008EB3] dark:text-[#00D4FF]">
                        {selectedTest.code} · Executed {new Date(selectedTest.executedAt).toLocaleString()}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {selectedTest.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase">
                      {selectedTest.outcome === 'pass' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-[#00FF88]" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      )}
                      <span
                        className={
                          selectedTest.outcome === 'pass'
                            ? 'text-emerald-600 dark:text-[#00FF88]'
                            : 'text-amber-600 dark:text-amber-400'
                        }
                      >
                        {selectedTest.outcome}
                      </span>
                    </div>
                  </div>

                  {/* Safety Verification Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F]">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-[#00D4FF]" />
                        Recovery Time
                      </div>
                      <div className="mt-1 font-mono tabular-nums text-base font-bold text-slate-900 dark:text-slate-100">
                        {selectedTest.recoveryTimeSec}s
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F]">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-[#00FF88]" />
                        State Durability
                      </div>
                      <div className="mt-1 font-mono text-sm font-semibold text-emerald-600 dark:text-[#00FF88]">
                        {selectedTest.stateLossDetected ? 'STATE LOSS' : 'Zero State Loss'}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F]">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        <ShieldAlert className="w-3.5 h-3.5 text-[#00D4FF]" />
                        Idempotency Guard
                      </div>
                      <div className="mt-1 font-mono text-sm font-semibold text-emerald-600 dark:text-[#00FF88]">
                        {selectedTest.duplicateWorkDetected ? 'DUPLICATES FOUND' : 'Zero Duplicate Work'}
                      </div>
                    </div>
                  </div>

                  {/* Structured Scenario Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="font-mono text-[11px] uppercase text-slate-500 dark:text-slate-400">
                        Scenario & Injected Fault
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        {selectedTest.scenario}
                      </p>
                      <div className="mt-2 p-2.5 rounded bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 font-mono text-[11px] text-rose-700 dark:text-rose-300">
                        Fault: {selectedTest.injectedFault}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="font-mono text-[11px] uppercase text-slate-500 dark:text-slate-400">
                          Expected Safe Behavior
                        </div>
                        <p className="mt-0.5 text-slate-700 dark:text-slate-300 leading-relaxed">
                          {selectedTest.expectedSafeBehavior}
                        </p>
                      </div>
                      <div>
                        <div className="font-mono text-[11px] uppercase text-slate-500 dark:text-slate-400">
                          Observed Degraded Mode
                        </div>
                        <p className="mt-0.5 text-amber-700 dark:text-amber-300 leading-relaxed">
                          {selectedTest.observedDegradedMode}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-[#1E3A5F] text-xs">
                    <div className="font-mono text-[11px] uppercase text-slate-500 dark:text-slate-400">
                      Automated Recovery Procedure
                    </div>
                    <p className="mt-1 text-slate-700 dark:text-slate-300 leading-relaxed">
                      {selectedTest.recoveryProcedure}
                    </p>
                  </div>
                </div>

                {/* Recovery Console Logs */}
                <div className="rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-[#0B1522] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#1E3A5F] flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                      <Terminal className="w-3.5 h-3.5 text-[#00D4FF]" />
                      Recovery Telemetry Console · {selectedTest.code}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {selectedTest.recoveryLogs.length} events
                    </span>
                  </div>
                  <div className="p-4 font-mono text-[11px] space-y-1.5 max-h-[240px] overflow-y-auto">
                    {selectedTest.recoveryLogs.map((line, idx) => (
                      <div
                        key={idx}
                        className={
                          line.includes('ERROR') || line.includes('FAULT')
                            ? 'text-rose-400'
                            : line.includes('WARN') || line.includes('DEGRADED')
                            ? 'text-amber-300'
                            : line.includes('RECOVERED') || line.includes('PASS') || line.includes('VERIFIED')
                            ? 'text-[#00FF88]'
                            : 'text-slate-300'
                        }
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
