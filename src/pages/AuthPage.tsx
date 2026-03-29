import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import HexLogo from '@/components/HexLogo';
import { login, register, enableGuestSession, getGuestUser } from '@/lib/auth';
import { useAuthStore } from '@/store/authStore';
import { useStore } from '@/store/useStore';

type AuthMode = 'signin' | 'signup';

const featurePills = [
  'Web search · Tavily',
  'Browser automation · Playwright',
  'Desktop control · PyAutoGUI',
];

const passwordStrengthSegments = (password: string) => {
  if (password.length === 0) return 0;
  if (password.length < 6) return 1;
  if (password.length <= 8) return 2;
  if (password.length <= 12) return 3;
  return 4;
};

const strengthColors = [
  'bg-destructive',
  'bg-orange-400',
  'bg-yellow-400',
  'bg-success',
];

const AuthPage = () => {
  const navigate = useNavigate();
  const backendOnline = useStore((s) => s.backendOnline);
  const backendChecked = useStore((s) => s.backendChecked);
  const loading = useAuthStore((s) => s.loading);
  const canAccessApp = useAuthStore((s) => s.canAccessApp);
  const setUser = useAuthStore((s) => s.setUser);
  const setToken = useAuthStore((s) => s.setToken);
  const setGuestMode = useAuthStore((s) => s.setGuestMode);

  const [mode, setMode] = useState<AuthMode>('signin');
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!loading && canAccessApp()) {
      navigate('/', { replace: true });
    }
  }, [canAccessApp, loading, navigate]);

  const passwordStrength = useMemo(() => passwordStrengthSegments(signUpPassword), [signUpPassword]);

  const handleContinueAsGuest = () => {
    enableGuestSession();
    setGuestMode(true);
    setUser(getGuestUser());
    setToken(null);
    navigate('/', { replace: true });
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage('');

    try {
      const result = await login(signInEmail.trim(), signInPassword);
      setGuestMode(false);
      setUser(result.user);
      setToken(result.token);
      navigate('/', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage('');

    try {
      const result = await register(signUpEmail.trim(), signUpName.trim(), signUpPassword);
      setGuestMode(false);
      setUser(result.user);
      setToken(result.token);
      navigate('/', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Create account failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[linear-gradient(180deg,#0d1020_0%,#13172a_52%,#090b14_100%)] text-white">
      <aside className="relative hidden w-[420px] shrink-0 overflow-hidden border-r border-white/8 bg-[#0a0a12] lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(111,92,255,0.28),transparent_30%),radial-gradient(circle_at_70%_75%,rgba(52,211,153,0.18),transparent_25%)]" />
        <div className="absolute left-[-20%] top-[14%] h-64 w-64 rounded-full bg-fuchsia-500/20 blur-[100px]" />
        <div className="absolute bottom-[12%] right-[-10%] h-72 w-72 rounded-full bg-teal-400/15 blur-[120px]" />

        <div className="relative z-10 flex max-w-[280px] flex-col items-center text-center">
          <HexLogo size={40} />
          <h1 className="mt-4 text-[18px] font-medium tracking-tight text-white">AgentOS</h1>
          <p className="mt-2 text-sm text-white/58">Your AI agent, always ready.</p>

          <div className="mt-8 space-y-3">
            {featurePills.map((pill) => (
              <div
                key={pill}
                className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/72 backdrop-blur-md"
              >
                <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_6px_rgba(139,92,246,0.10)]" />
                <span>{pill}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px]">
          <div className="rounded-[28px] border border-white/10 bg-[rgba(13,17,27,0.82)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.30)] backdrop-blur-2xl md:p-6">
            <div className="rounded-full border border-white/10 bg-white/[0.04] p-1">
              <div className="relative grid grid-cols-2">
                <div
                  className={`absolute inset-y-0 w-1/2 rounded-full bg-white/[0.08] transition-transform duration-300 ${
                    mode === 'signup' ? 'translate-x-full' : 'translate-x-0'
                  }`}
                />
                <button
                  onClick={() => {
                    setMode('signin');
                    setErrorMessage('');
                  }}
                  className={`relative z-10 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    mode === 'signin' ? 'text-white' : 'text-white/50'
                  }`}
                >
                  Sign in
                </button>
                <button
                  onClick={() => {
                    setMode('signup');
                    setErrorMessage('');
                  }}
                  className={`relative z-10 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    mode === 'signup' ? 'text-white' : 'text-white/50'
                  }`}
                >
                  Create account
                </button>
              </div>
            </div>

            {backendChecked && !backendOnline && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300/14 bg-amber-400/8 px-4 py-3 text-sm text-amber-100">
                <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Backend offline</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-100/72">
                    Local auth endpoints are unavailable right now. You can still continue without an account.
                  </p>
                </div>
              </div>
            )}

            {mode === 'signin' ? (
              <form className="mt-5 space-y-4" onSubmit={handleSignIn}>
                <Field label="Email">
                  <input
                    type="email"
                    autoComplete="email"
                    value={signInEmail}
                    onChange={(event) => setSignInEmail(event.target.value)}
                    className="w-full rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                    placeholder="you@example.com"
                  />
                </Field>
                <Field label="Password">
                  <PasswordField
                    value={signInPassword}
                    onChange={setSignInPassword}
                    show={showSignInPassword}
                    onToggle={() => setShowSignInPassword((value) => !value)}
                  />
                </Field>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  {submitting ? 'Signing in...' : 'Sign in'}
                </button>

                {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

                <p className="text-center text-sm text-white/50">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setErrorMessage('');
                    }}
                    className="text-primary hover:opacity-90"
                  >
                    Create one
                  </button>
                </p>
              </form>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={handleSignUp}>
                <Field label="Display name">
                  <input
                    type="text"
                    value={signUpName}
                    onChange={(event) => setSignUpName(event.target.value)}
                    className="w-full rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                    placeholder="Alex"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    autoComplete="email"
                    value={signUpEmail}
                    onChange={(event) => setSignUpEmail(event.target.value)}
                    className="w-full rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                    placeholder="you@example.com"
                  />
                </Field>
                <Field label="Password">
                  <PasswordField
                    value={signUpPassword}
                    onChange={setSignUpPassword}
                    show={showSignUpPassword}
                    onToggle={() => setShowSignUpPassword((value) => !value)}
                  />
                </Field>

                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 4 }).map((_, index) => {
                      const active = index < passwordStrength;
                      const colorClass = active ? strengthColors[Math.min(passwordStrength - 1, 3)] : 'bg-white/8';
                      return <div key={index} className={`h-2 rounded-full ${colorClass}`} />;
                    })}
                  </div>
                  <p className="text-xs text-white/42">Use at least 6 characters for a stronger local password.</p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  {submitting ? 'Creating account...' : 'Create account'}
                </button>

                {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

                <p className="text-center text-sm text-white/50">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setErrorMessage('');
                    }}
                    className="text-primary hover:opacity-90"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}

            <div className="mt-6 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={handleContinueAsGuest}
                className="w-full text-center text-sm text-white/60 transition-colors hover:text-white"
              >
                Continue without account
              </button>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-white/45">
            Runs locally on your machine. No data leaves your computer.
          </p>
        </div>
      </main>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-white/46">{label}</span>
    {children}
  </label>
);

const PasswordField = ({
  value,
  onChange,
  show,
  onToggle,
}: {
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
}) => (
  <div className="relative">
    <input
      type={show ? 'text' : 'password'}
      value={value}
      autoComplete="current-password"
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-2xl border border-border bg-muted px-4 py-3 pr-12 text-sm text-foreground outline-none transition-colors focus:border-primary"
      placeholder="••••••••"
    />
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/45 transition-colors hover:text-white"
    >
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  </div>
);

export default AuthPage;
