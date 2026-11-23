import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import LoginPage from './pages/Login.jsx';
import HospitalsPage from './pages/Hospitals.jsx';
import HospitalDetailPage from './pages/HospitalDetail.jsx';
import ChildrenPage from './pages/Children.jsx';
import ChildDetailPage from './pages/ChildDetail.jsx';
import AuditPage from './pages/Audit.jsx';
import './App.css';

function Guard({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <p className="muted">Checking session…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Shell({ children }) {
  const { user, can, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="shell">
      <aside className="nav">
        <p className="brand">Child health</p>
        <p className="muted">{user.hospital.name}</p>
        <p className="role">{user.role.name}</p>
        <nav className="nav-links">
          {can('hospital.manage') || can('department.manage') ? <NavLink to="/hospitals">Hospitals</NavLink> : null}
          {can('child.read') ? <NavLink to="/children">Children</NavLink> : null}
          {can('audit.read') ? <NavLink to="/audit">Audit</NavLink> : null}
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

function Home() {
  const { can } = useAuth();
  if (can('child.read')) return <Navigate to="/children" replace />;
  if (can('hospital.manage')) return <Navigate to="/hospitals" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Guard><Shell><Home /></Shell></Guard>} />
      <Route path="/hospitals" element={<Guard><Shell><HospitalsPage /></Shell></Guard>} />
      <Route path="/hospitals/:id" element={<Guard><Shell><HospitalDetailPage /></Shell></Guard>} />
      <Route path="/children" element={<Guard><Shell><ChildrenPage /></Shell></Guard>} />
      <Route path="/children/:id" element={<Guard><Shell><ChildDetailPage /></Shell></Guard>} />
      <Route path="/audit" element={<Guard><Shell><AuditPage /></Shell></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
