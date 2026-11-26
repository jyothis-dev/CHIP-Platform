import { useState } from 'react';
import {
  Alert, Button, EmptyState, Field, Pagination, Select, Spinner, Table,
} from '@/shared/ui/index.js';
import { useAuth } from '@/modules/auth/hooks/useAuth.jsx';
import { ADMIN_ROLES, hasRole } from '@/modules/auth/hooks/roles.js';
import {
  useAttachFacilityHfr, useFacilitySearch, useMasters, useOwnFacility, useRegistryOptions,
} from '../hooks/useRegistries.js';
import { fieldErrors, toSearchBody } from '../validation/registrySchemas.js';

const EMPTY = {
  facilityId: '',
  facilityName: '',
  ownershipCode: '',
  stateLGDCode: '',
  districtLGDCode: '',
  subDistrictLGDCode: '',
  pincode: '',
};

const COLUMNS = [
  { key: 'id', label: 'Facility ID' },
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'type', label: 'Type' },
  { key: 'place', label: 'Location' },
  { key: 'action', label: '' },
];

function MasterSelect({ label, id, kind, parentCode, value, onChange }) {
  const masters = useMasters(kind, parentCode);
  const items = masters.data?.items || [];
  const waiting = kind !== 'states' && !parentCode;
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value} disabled={waiting || masters.isLoading} onChange={(event) => onChange(event.target.value)}>
        <option value="">{waiting ? 'Choose the level above first' : 'Any'}</option>
        {items.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
      </Select>
    </Field>
  );
}

export function FacilitySearch() {
  const { user } = useAuth();
  const options = useRegistryOptions();
  const own = useOwnFacility();
  const search = useFacilitySearch();
  const attach = useAttachFacilityHfr();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [lastBody, setLastBody] = useState(null);
  const canAttach = hasRole(user, ADMIN_ROLES);
  const result = search.data;

  const set = (key) => (value) => setValues((current) => {
    const next = { ...current, [key]: value };
    if (key === 'stateLGDCode') { next.districtLGDCode = ''; next.subDistrictLGDCode = ''; }
    if (key === 'districtLGDCode') next.subDistrictLGDCode = '';
    return next;
  });

  // Paging repeats the search that was run, not whatever was typed since.
  function run(page = 1, base = null) {
    setMessage('');
    try {
      const body = base ? { ...base, page } : toSearchBody(values, page);
      setErrors({});
      setLastBody(body);
      search.mutate(body);
    } catch (err) {
      if (err?.issues) setErrors(fieldErrors(err));
      else throw err;
    }
  }

  async function saveHfrId(hfrId) {
    setMessage('');
    try {
      await attach.mutateAsync({ facilityId: own.data.id, hfrId });
      setMessage(`Saved ${hfrId} as the HFR ID of ${own.data.name}.`);
    } catch {
      // The error is shown from attach.error below.
    }
  }

  return (
    <div className="stack">
      <form
        className="stack registry-form"
        onSubmit={(event) => { event.preventDefault(); run(1); }}
        noValidate
      >
        <p className="muted">Search by facility ID, or by name with ownership and state.</p>
        <div className="registry-grid">
          <Field label="Facility ID" error={errors.facilityId}>
            {(a11y) => (
              <input
                {...a11y}
                className="text-input"
                value={values.facilityId}
                maxLength={12}
                placeholder="IN0000000000"
                onChange={(event) => set('facilityId')(event.target.value.toUpperCase())}
              />
            )}
          </Field>
          <Field label="Facility name" error={errors.facilityName}>
            {(a11y) => (
              <input {...a11y} className="text-input" value={values.facilityName} onChange={(event) => set('facilityName')(event.target.value)} />
            )}
          </Field>
          <Field label="Ownership code" error={errors.ownershipCode}>
            {(a11y) => (
              <Select {...a11y} value={values.ownershipCode} onChange={(event) => set('ownershipCode')(event.target.value)}>
                <option value="">Choose</option>
                {(options.data?.ownershipCodes || []).map((code) => <option key={code} value={code}>{code}</option>)}
              </Select>
            )}
          </Field>
          <div>
            <MasterSelect label="State" id="registry-state" kind="states" value={values.stateLGDCode} onChange={set('stateLGDCode')} />
            {errors.stateLGDCode ? <span className="ui-field-error" role="alert">{errors.stateLGDCode}</span> : null}
          </div>
          <MasterSelect label="District" id="registry-district" kind="districts" parentCode={values.stateLGDCode} value={values.districtLGDCode} onChange={set('districtLGDCode')} />
          <MasterSelect label="Sub-district" id="registry-subdistrict" kind="subdistricts" parentCode={values.districtLGDCode} value={values.subDistrictLGDCode} onChange={set('subDistrictLGDCode')} />
          <Field label="Pincode" error={errors.pincode}>
            {(a11y) => (
              <input {...a11y} className="text-input" inputMode="numeric" maxLength={6} value={values.pincode} onChange={(event) => set('pincode')(event.target.value.replace(/\D/g, ''))} />
            )}
          </Field>
        </div>
        <div className="row">
          <Button type="submit" disabled={search.isPending}>Search</Button>
          <Button type="button" variant="ghost" onClick={() => { setValues(EMPTY); setErrors({}); search.reset(); }}>Clear</Button>
        </div>
      </form>

      {search.isPending ? <Spinner label="Searching the registry…" /> : null}
      <Alert>{search.error ? search.error.message : null}</Alert>
      <Alert>{attach.error ? attach.error.message : null}</Alert>
      <Alert tone="ok">{message}</Alert>

      {result && result.facilities.length === 0 ? (
        <EmptyState>No facility matches. A facility still in Draft is not visible in the registry.</EmptyState>
      ) : null}
      {result && result.facilities.length > 0 ? (
        <>
          <Table columns={COLUMNS}>
            {result.facilities.map((row) => (
              <tr key={row.facilityId}>
                <td>{row.facilityId}</td>
                <td>{row.facilityName}</td>
                <td>{row.facilityStatus || '—'}</td>
                <td>{row.facilityType || '—'}</td>
                <td>{[row.districtName, row.stateName].filter(Boolean).join(', ') || '—'}</td>
                <td>
                  {canAttach && own.data && own.data.hfrId !== row.facilityId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={attach.isPending}
                      onClick={() => saveHfrId(row.facilityId)}
                    >
                      Use as our HFR ID
                    </Button>
                  ) : null}
                  {own.data?.hfrId === row.facilityId ? <span className="muted">Our HFR ID</span> : null}
                </td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.totalFacilities}
            disabled={search.isPending}
            onPageChange={(page) => run(page, lastBody)}
          />
        </>
      ) : null}
    </div>
  );
}
