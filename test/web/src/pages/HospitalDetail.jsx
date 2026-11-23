import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import './HospitalDetail.css';

export default function HospitalDetailPage() {
  const { id } = useParams();
  const { can, user, switchHospital } = useAuth();
  const [hospital, setHospital] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [staff, setStaff] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [error, setError] = useState('');
  const [department, setDepartment] = useState({ name: '', code: '' });
  const [role, setRole] = useState({ name: '', description: '' });
  const [member, setMember] = useState({
    email: '', password: '', firstName: '', lastName: '', designation: '', roleId: '', departmentId: '',
  });

  async function load() {
    const [hospitalData, departmentData, roleData] = await Promise.all([
      api(`/hospitals/${id}`),
      api(`/hospitals/${id}/departments`),
      api(`/hospitals/${id}/roles`),
    ]);
    setHospital(hospitalData);
    setDepartments(departmentData);
    setRoles(roleData);
    if (can('user.manage')) setStaff(await api(`/hospitals/${id}/users`));
    if (can('role.manage')) setPermissions(await api('/hospitals/permissions'));
  }

  useEffect(() => {
    if (!user || user.hospital.id !== id) return;
    load().catch((err) => setError(err.message));
  }, [id, user]);

  if (user && user.hospital.id !== id) {
    return (
      <section className="card stack">
        <h1>Different hospital</h1>
        <p className="muted">Switch into this hospital before editing it.</p>
        <button type="button" className="btn-primary" onClick={() => switchHospital(id)}>Switch</button>
      </section>
    );
  }

  return (
    <section className="stack">
      <h1 className="page-title">{hospital?.name ?? 'Hospital'}</h1>
      {error ? <p className="error">{error}</p> : null}
      <div className="split">
        <article className="card stack">
          <h2>Departments</h2>
          <ul className="plain-list">
            {departments.map((item) => <li key={item.id}>{item.name} <span className="muted">{item.code}</span></li>)}
          </ul>
          {can('department.manage') ? (
            <form
              className="stack"
              onSubmit={async (event) => {
                event.preventDefault();
                await api(`/hospitals/${id}/departments`, { method: 'POST', body: department });
                setDepartment({ name: '', code: '' });
                await load();
              }}
            >
              <label className="field">Name<input value={department.name} onChange={(event) => setDepartment({ ...department, name: event.target.value })} required /></label>
              <label className="field">Code<input value={department.code} onChange={(event) => setDepartment({ ...department, code: event.target.value })} required /></label>
              <button className="btn-primary" type="submit">Add department</button>
            </form>
          ) : null}
        </article>
        <article className="card stack">
          <h2>Roles</h2>
          <ul className="plain-list">
            {roles.map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong>
                <p className="muted">{item.permissions.join(', ') || 'No permissions yet'}</p>
              </li>
            ))}
          </ul>
          {can('role.manage') ? (
            <form
              className="stack"
              onSubmit={async (event) => {
                event.preventDefault();
                await api(`/hospitals/${id}/roles`, { method: 'POST', body: role });
                setRole({ name: '', description: '' });
                await load();
              }}
            >
              <label className="field">Role name<input value={role.name} onChange={(event) => setRole({ ...role, name: event.target.value })} required /></label>
              <label className="field">Description<input value={role.description} onChange={(event) => setRole({ ...role, description: event.target.value })} /></label>
              <button className="btn-primary" type="submit">Add role</button>
            </form>
          ) : null}
          {can('role.manage') && roles[0] ? (
            <form
              className="stack"
              onSubmit={async (event) => {
                event.preventDefault();
                const selected = [...event.target.elements].filter((element) => element.name === 'permission' && element.checked).map((element) => element.value);
                await api(`/hospitals/${id}/roles/${event.target.roleId.value}/permissions`, {
                  method: 'PUT',
                  body: { permissionKeys: selected },
                });
                await load();
              }}
            >
              <label className="field">
                Update permissions for
                <select name="roleId" defaultValue={roles[0].id}>
                  {roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <div className="checks">
                {permissions.map((permission) => (
                  <label key={permission.key}>
                    <input type="checkbox" name="permission" value={permission.key} /> {permission.key}
                  </label>
                ))}
              </div>
              <button className="btn-ghost" type="submit">Save permissions</button>
            </form>
          ) : null}
        </article>
      </div>
      {can('user.manage') ? (
        <article className="card stack">
          <h2>Staff</h2>
          <ul className="plain-list">
            {staff.map((person) => (
              <li key={person.id}>{person.profile?.firstName} {person.profile?.lastName} · {person.role.name} · {person.email}</li>
            ))}
          </ul>
          <form
            className="form-grid two"
            onSubmit={async (event) => {
              event.preventDefault();
              await api(`/hospitals/${id}/users`, {
                method: 'POST',
                body: {
                  ...member,
                  departmentId: member.departmentId || undefined,
                },
              });
              setMember({ email: '', password: '', firstName: '', lastName: '', designation: '', roleId: '', departmentId: '' });
              await load();
            }}
          >
            <label className="field">First name<input value={member.firstName} onChange={(event) => setMember({ ...member, firstName: event.target.value })} required /></label>
            <label className="field">Last name<input value={member.lastName} onChange={(event) => setMember({ ...member, lastName: event.target.value })} required /></label>
            <label className="field">Email<input type="email" value={member.email} onChange={(event) => setMember({ ...member, email: event.target.value })} required /></label>
            <label className="field">Password<input type="password" value={member.password} onChange={(event) => setMember({ ...member, password: event.target.value })} required /></label>
            <label className="field">Designation<input value={member.designation} onChange={(event) => setMember({ ...member, designation: event.target.value })} /></label>
            <label className="field">
              Role
              <select value={member.roleId} onChange={(event) => setMember({ ...member, roleId: event.target.value })} required>
                <option value="">Select</option>
                {roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="field">
              Department
              <select value={member.departmentId} onChange={(event) => setMember({ ...member, departmentId: event.target.value })}>
                <option value="">None</option>
                {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <button className="btn-primary" type="submit">Add staff</button>
          </form>
        </article>
      ) : null}
    </section>
  );
}
