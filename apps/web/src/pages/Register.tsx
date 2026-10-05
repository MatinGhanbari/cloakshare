import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { trackSignup } from '../lib/analytics';
import { Button, CopyField, Field, InlineError, Input, Panel, PanelHeader } from '../components/ui';
import { CheckIcon } from '../components/icons';
import { glyph } from '../components/morph';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const key = await register(email, password);
      trackSignup(email, 'free');
      setApiKey(key);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (apiKey) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md">
          <Panel className="p-8">
            <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-control border border-accent-line bg-accent-muted text-accent">
              <CheckIcon size={16} />
            </span>
            <PanelHeader
              title="Account created"
              description="Save your API key now. It is shown once and cannot be retrieved later."
            />
            <CopyField value={apiKey} className="mt-4" />
            <Button
              variant="primary"
              className="mt-5 w-full"
              onClick={() => navigate('/')}
            >
              Go to the dashboard
            </Button>
          </Panel>
        </div>
      </div>
    );
  }

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
          <p className="mt-2 text-sm text-text-secondary">Create your account</p>
        </div>

        <Panel className="card-glow p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Field label="Email" htmlFor="register-email">
              <Input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </Field>

            <Field
              label="Password"
              htmlFor="register-password"
              hint="At least 8 characters."
            >
              <Input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>

            {error && <InlineError>{error}</InlineError>}

            <Button
              type="submit"
              variant="primary"
              icon={glyph.signup}
              status={loading ? 'busy' : 'idle'}
              busyLabel="Creating"
              className="w-full"
            >
              Create account
            </Button>
          </form>
        </Panel>

        <p className="mt-5 text-center text-sm text-text-tertiary">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-accent transition-colors duration-150 ease-expo hover:text-accent-hover"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
