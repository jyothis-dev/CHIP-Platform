import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import LoginPage from './pages/Login.jsx';
import './App.css';

function Guard({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="muted">Checking session…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Shell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="shell">
      <aside className="nav">
        <p className="brand">WombTo18</p>
        <p className="muted">{user.name}</p>
        <p className="role">{user.role}</p>
        <button
          type="button"
          className="btn-ghost"
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
        >
          Log out
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

function Dashboard() {
  return (
    <section className="stack">
      <h1>Dashboard</h1>
      <p className="muted">The mother and child journey is the next step. No clinical records are stored in this shell.</p>
    </section>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Guard><Shell><Dashboard /></Shell></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
