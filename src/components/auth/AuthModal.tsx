import { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { APP_NAME } from '../../constants.ts';

export function AuthModal() {
  const open = useAppStore((s) => s.authModalOpen);
  const setOpen = useAppStore((s) => s.setAuthModalOpen);
  const setAuthSession = useAppStore((s) => s.setAuthSession);
  const pushToast = useAppStore((s) => s.pushToast);

  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [affiliation, setAffiliation] = useState('KL University · Team C-162');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result =
        mode === 'register'
          ? await api.register(name, email, password, affiliation)
          : await api.login(email, password);
      setAuthSession(result.user, result.token);
      pushToast('success', `Signed in as ${result.user.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-[#1E3A5F] bg-white dark:bg-[#132238] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 id="auth-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {mode === 'register' ? 'Create Operator Account' : `Sign In to ${APP_NAME} Studio`}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Scrypt-hashed server authentication with in-memory Bearer tokens.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1B2A4A]"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0D1B2A] mb-5">
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              mode === 'register'
                ? 'bg-white dark:bg-[#1B2A4A] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              mode === 'login'
                ? 'bg-white dark:bg-[#1B2A4A] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Sign In
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Salveru Kusmitha"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00D4FF]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Team / Organization
                </label>
                <input
                  type="text"
                  value={affiliation}
                  onChange={(e) => setAffiliation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00D4FF]"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@university.edu"
              className="w-full px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00D4FF]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Password (min 8 chars)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-[#0D1B2A] border border-slate-200 dark:border-[#1E3A5F] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#00D4FF]"
            />
          </div>

          {error && (
            <div className="text-xs text-rose-500 font-medium bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-[#00A3CC] dark:bg-[#00D4FF] text-white dark:text-[#08131E] hover:bg-[#008EB3] dark:hover:bg-[#33DDFF] disabled:opacity-60 transition-colors"
          >
            {loading ? 'Authenticating...' : mode === 'register' ? 'Create Account' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
