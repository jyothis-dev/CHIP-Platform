import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useLogin } from '../hooks/useLogin.js';
import { parseLogin } from '../validation/loginSchema.js';
import { Alert, Button, Field, PageHeader } from '@/shared/ui/index.js';
import './Login.css';

export default function LoginPage() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');

  if (ready && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="login">
      <form
        className="card login-card stack"
        onSubmit={async (event) => {
          event.preventDefault();
          setError('');
          setFieldErrors({});
          const parsed = parseLogin({ email, password });
          if (!parsed.success) {
            const next = {};
            for (const issue of parsed.error.issues) {
              next[issue.path[0]] = issue.message;
            }
            setFieldErrors(next);
            return;
          }
          try {
            await loginMutation.mutateAsync(parsed.data);
            navigate('/');
          } catch (err) {
            setError(err.message || 'Sign in failed');
          }
        }}
      >
        <PageHeader
          title="Sign in"
          description="Staff use the demo account for this facility."
        />
        <Field label="Email" error={fieldErrors.email}>
          {({ id, ...a11y }) => (
            <input
              id={id}
              type="email"
              value={email}
              autoComplete="username"
              onChange={(event) => setEmail(event.target.value)}
              {...a11y}
            />
          )}
        </Field>
        <Field label="Password" error={fieldErrors.password}>
          {({ id, ...a11y }) => (
            <input
              id={id}
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              {...a11y}
            />
          )}
        </Field>
        <Alert>{error}</Alert>
        <Button type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  );
}
