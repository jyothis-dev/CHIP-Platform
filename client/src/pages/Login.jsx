import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import './Login.css';

export default function LoginPage() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
          try {
            await login(email, password);
            navigate('/');
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        <div>
          <h1>Sign in</h1>
          <p className="muted">Staff use the demo account for this facility.</p>
        </div>
        <label className="field">
          Email
          <input type="email" value={email} autoComplete="username" onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="field">
          Password
          <input type="password" value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn-primary" type="submit">Sign in</button>
      </form>
    </main>
  );
}
