import { Suspense, lazy, useEffect } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/modules/auth/hooks/useAuth.jsx';
import LoginPage from '@/modules/auth/pages/Login.jsx';
import { Spinner } from '@/shared/ui/index.js';
import { clearToken } from '@/shared/api/token.js';
import { setUnauthorizedHandler } from '@/shared/api/sessionEvents.js';
import './App.css';

const PatientsPage = lazy(() => import('@/modules/patients/pages/Patients.jsx'));
const AbhaEnrolmentPage = lazy(() => import('@/modules/abha/pages/AbhaEnrolment.jsx'));
const ActivityLogPage = lazy(() => import('@/modules/audit/pages/ActivityLog.jsx'));

function Guard({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner label="Checking session…" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Shell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken();
      queryClient.clear();
      navigate('/login', { replace: true });
    });
  }, [navigate, queryClient]);

  return (
    <div className="shell">
      <aside className="nav">
        <p className="brand">WombTo18</p>
        <p className="muted">{user.name}</p>
        <p className="role">{user.role}</p>
        <nav className="nav-links">
          <Link to="/">Dashboard</Link>
          <Link to="/patients">Patients</Link>
          <Link to="/abha">ABHA enrolment</Link>
          <Link to="/activity">Activity log</Link>
        </nav>
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
      <p className="muted">
        Register a mother or child, select them for ABHA enrolment, and review facility activity in the log.
      </p>
      <p className="row">
        <Link className="btn-primary" to="/patients">Register or select patient</Link>
        <Link className="btn" to="/abha">Open ABHA enrolment</Link>
        <Link className="btn" to="/activity">View activity log</Link>
      </p>
    </section>
  );
}

function LazyPage({ children }) {
  return <Suspense fallback={<Spinner label="Loading page…" />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Guard><Shell><Dashboard /></Shell></Guard>} />
      <Route
        path="/patients"
        element={(
          <Guard>
            <Shell>
              <LazyPage><PatientsPage /></LazyPage>
            </Shell>
          </Guard>
        )}
      />
      <Route
        path="/abha"
        element={(
          <Guard>
            <Shell>
              <LazyPage><AbhaEnrolmentPage /></LazyPage>
            </Shell>
          </Guard>
        )}
      />
      <Route
        path="/activity"
        element={(
          <Guard>
            <Shell>
              <LazyPage><ActivityLogPage /></LazyPage>
            </Shell>
          </Guard>
        )}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
