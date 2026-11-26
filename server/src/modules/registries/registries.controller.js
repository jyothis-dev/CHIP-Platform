import * as hfr from './hfr.js';
import * as hpr from './hpr.js';
import * as link from './link.js';
import { registriesReadiness } from './readiness.js';
import { OWNERSHIP_CODES } from './constants.js';

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

export async function readiness(req, res) {
  return ok(res, await registriesReadiness({ facilityId: req.auth.facilityId, correlationId: req.id }));
}

export async function options(_req, res) {
  return ok(res, { ownershipCodes: OWNERSHIP_CODES, facilityPageSize: 10 });
}

export async function facility(req, res) {
  return ok(res, await link.ownFacility({ auth: req.auth }));
}

export async function masters(req, res) {
  const { kind } = req.validated.params;
  const { parentCode } = req.validated.query;
  return ok(res, { items: await hfr.listMasters({ kind, parentCode, correlationId: req.id }) });
}

export async function searchFacilities(req, res) {
  return ok(res, await hfr.searchFacilities({
    input: req.validated.body, auth: req.auth, correlationId: req.id,
  }));
}

export async function hprExists(req, res) {
  return ok(res, await hpr.hprExists({
    hprId: req.validated.params.hprId, auth: req.auth, correlationId: req.id,
  }));
}

export async function hprSearchById(req, res) {
  return ok(res, await hpr.hprSearchById({
    hprId: req.validated.params.hprId, auth: req.auth, correlationId: req.id,
  }));
}

export async function hprSearchByMobile(req, res) {
  return ok(res, await hpr.hprSearchByMobile({
    mobile: req.validated.body.mobile, auth: req.auth, correlationId: req.id,
  }));
}

export async function professionalInfo(req, res) {
  return ok(res, await hpr.professionalInfo({
    practitioner: req.validated.body.practitioner, auth: req.auth, correlationId: req.id,
  }));
}

export async function attachFacilityHfr(req, res) {
  return ok(res, await link.attachFacilityHfr({
    facilityId: req.validated.params.id, hfrId: req.validated.body.hfrId, auth: req.auth, correlationId: req.id,
  }));
}

export async function attachPractitionerHpr(req, res) {
  return ok(res, await link.attachPractitionerHpr({
    practitionerId: req.validated.params.id, hprId: req.validated.body.hprId, auth: req.auth, correlationId: req.id,
  }));
}

export async function bridgeStatus(req, res) {
  return ok(res, await link.bridgeStatus({
    facilityId: req.validated.params.id, auth: req.auth, correlationId: req.id,
  }));
}

export async function bridgeLink(req, res) {
  return ok(res, await link.bridgeLink({
    facilityId: req.validated.params.id,
    roles: req.validated.body.roles,
    hipName: req.validated.body.hipName,
    auth: req.auth,
    correlationId: req.id,
  }));
}
