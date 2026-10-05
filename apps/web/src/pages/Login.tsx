import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { trackLogin } from '../lib/analytics';
import { Button, Field, InlineError, Input, Panel } from '../components/ui';
import { glyph } from '../components/morph';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      trackLogin(email);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            <span className="font-mono text-xl font-bold tracking-tight text-foreground">
              Scrinium
            </span>
          </span>
          <p className="mt-2 text-sm text-text-secondary">Sign in to your account</p>
        </div>

        <Panel className="card-glow p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Field label="Email" htmlFor="login-email">
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </Field>

            <Field label="Password" htmlFor="login-password">
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                required
              />
            </Field>

            {error && <InlineError>{error}</InlineError>}

            <Button
              type="submit"
              variant="primary"
              icon={glyph.login}
              status={loading ? 'busy' : 'idle'}
              busyLabel="Signing in"
              className="w-full"
            >
              Sign in
            </Button>
          </form>
        </Panel>

        <p className="mt-5 text-center text-sm text-text-tertiary">
          No account yet?{' '}
          <Link
            to="/register"
            className="text-accent transition-colors duration-150 ease-expo hover:text-accent-hover"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
