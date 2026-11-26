import { logAudit } from '../../shared/audit.js';
import { callRegistry } from './registryGateway.js';
import { isOk, registryFailure } from './errors.js';
import { FACILITY_PAGE_SIZE } from './constants.js';

function facilityView(item) {
  return {
    facilityId: item.facilityId || null,
    facilityName: item.facilityName || null,
    address: item.address || null,
    facilityStatus: item.facilityStatus || null,
    facilityType: item.facilityType || null,
    ownership: item.ownership || null,
    ownershipCode: item.ownershipCode || null,
    systemOfMedicine: item.systemOfMedicine || null,
    stateName: item.stateName || null,
    districtName: item.districtName || null,
    subDistrictName: item.subDistrictName || null,
    pincode: item.pincode || null,
  };
}

function searchBody(input) {
  const body = { page: input.page || 1, resultsPerPage: FACILITY_PAGE_SIZE };
  for (const key of [
    'facilityId', 'facilityName', 'ownershipCode', 'stateLGDCode', 'districtLGDCode',
    'subDistrictLGDCode', 'pincode',
  ]) {
    if (input[key]) body[key] = input[key];
  }
  return body;
}

async function auditSearch({ auth, correlationId, outcome, message }) {
  await logAudit({
    actorId: auth.userId,
    action: 'registry.hfr.search',
    resourceType: 'facility',
    facilityId: auth.facilityId,
    outcome,
    message,
    correlationId,
  });
}

/**
 * Search the facility registry. A 404 or an empty list means no match, which is how the
 * documentation says to read it before onboarding. The page size is fixed server-side.
 * `audit: false` is for internal verification searches that are not a staff lookup.
 */
export async function searchFacilities({
  input, auth, correlationId, http, audit = true,
}) {
  const body = searchBody(input);
  const result = await callRegistry({
    name: 'hfrSearchFacility', body, workflow: 'm4.hfr.search', correlationId, http,
  });

  let view;
  if (isOk(result)) {
    const facilities = Array.isArray(result.body?.facilities) ? result.body.facilities : [];
    view = {
      facilities: facilities.map(facilityView),
      page: body.page,
      pageSize: FACILITY_PAGE_SIZE,
      totalFacilities: Number(result.body?.totalFacilities ?? facilities.length),
      numberOfPages: Number(result.body?.numberOfPages ?? (facilities.length ? 1 : 0)),
      message: result.body?.message || null,
    };
  } else if (result.status === 404) {
    view = {
      facilities: [],
      page: body.page,
      pageSize: FACILITY_PAGE_SIZE,
      totalFacilities: 0,
      numberOfPages: 0,
      message: null,
    };
  } else {
    if (audit) {
      await auditSearch({
        auth,
        correlationId,
        outcome: 'failure',
        message: `Facility registry search by ${auth.name || 'staff'} failed (HTTP ${result.status}).`,
      });
    }
    throw registryFailure(result);
  }

  if (audit) {
    await auditSearch({
      auth,
      correlationId,
      outcome: 'success',
      message: `Facility registry search by ${auth.name || 'staff'} returned ${view.facilities.length} of ${view.totalFacilities}.`,
    });
  }
  return view;
}

const MASTER_CONTRACTS = {
  states: { name: 'hfrLgdStates', workflow: 'm4.hfr.lgd.states' },
  districts: { name: 'hfrLgdDistricts', workflow: 'm4.hfr.lgd.districts', param: 'stateCode' },
  subdistricts: { name: 'hfrLgdSubdistricts', workflow: 'm4.hfr.lgd.subdistricts', param: 'districtCode' },
};

/** LGD master data: the codes the search takes, fetched rather than typed. */
export async function listMasters({
  kind, parentCode, correlationId, http,
}) {
  const config = MASTER_CONTRACTS[kind];
  const result = await callRegistry({
    name: config.name,
    query: config.param ? { [config.param]: parentCode } : undefined,
    workflow: config.workflow,
    correlationId,
    http,
  });
  if (result.status === 404) return [];
  if (!isOk(result)) throw registryFailure(result);
  const rows = Array.isArray(result.body) ? result.body : [];
  return rows.map((row) => ({ code: String(row.code), name: row.name || '' }));
}
