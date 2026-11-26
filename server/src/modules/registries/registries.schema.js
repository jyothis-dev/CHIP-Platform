import { z } from 'zod';
import {
  BRIDGE_ROLES, FACILITY_ID_PATTERN, FACILITY_NAME_PATTERN, HIP_NAME_MAX, HIP_NAME_PATTERN, MASTER_KINDS, OWNERSHIP_CODES,
} from './constants.js';

const empty = z.object({}).passthrough();
const id = z.string().uuid();
const facilityId = z.string().regex(FACILITY_ID_PATTERN, 'Facility ID is 12 characters and starts with IN');
const lgdCode = z.string().regex(/^\d{1,10}$/, 'LGD codes are numeric');
// Not stricter than the platform: no whitespace or URL separators, nothing else assumed.
const hprId = z.string().min(1).max(100).regex(/^[^\s/?#\\]+$/, 'HPR ID must not contain spaces or slashes');

export const facilitySearchSchema = z.object({
  body: z.object({
    facilityId: facilityId.optional(),
    facilityName: z.string().min(1).max(200).regex(FACILITY_NAME_PATTERN, 'Facility name accepts letters, digits and -_.(),/ with single spaces').optional(),
    ownershipCode: z.enum(OWNERSHIP_CODES).optional(),
    stateLGDCode: lgdCode.optional(),
    districtLGDCode: lgdCode.optional(),
    subDistrictLGDCode: lgdCode.optional(),
    pincode: z.string().regex(/^\d{6}$/, 'Pincode is 6 digits').optional(),
    page: z.coerce.number().int().min(1).max(10000).optional().default(1),
  }).superRefine((value, ctx) => {
    // M4 specification: facilityId, or facilityName with ownershipCode and stateLGDCode.
    if (value.facilityId) return;
    for (const key of ['facilityName', 'ownershipCode', 'stateLGDCode']) {
      if (!value[key]) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'Required unless a facility ID is given' });
      }
    }
  }),
  params: empty,
  query: empty,
});

export const mastersSchema = z.object({
  body: empty,
  params: z.object({ kind: z.enum(MASTER_KINDS) }),
  query: z.object({ parentCode: lgdCode.optional() }),
}).superRefine((value, ctx) => {
  if (value.params.kind !== 'states' && !value.query.parentCode) {
    ctx.addIssue({
      code: 'custom',
      path: ['query', 'parentCode'],
      message: value.params.kind === 'districts' ? 'State code is required' : 'District code is required',
    });
  }
});

export const hprIdParamSchema = z.object({
  body: empty,
  params: z.object({ hprId }),
  query: empty,
});

export const hprMobileSchema = z.object({
  body: z.object({ mobile: z.string().regex(/^\d{10}$/, 'Mobile number is 10 digits') }),
  params: empty,
  query: empty,
});

export const professionalInfoSchema = z.object({
  body: z.object({
    practitioner: z.object({
      id: z.string().min(1).max(100).optional(),
      name: z.string().min(1).max(200).optional(),
      contactNumber: z.string().regex(/^\d{10}$/, 'Mobile number is 10 digits').optional(),
      state: z.string().min(1).max(100).optional(),
      registrationNumber: z.string().min(1).max(100).optional(),
      stateCouncilName: z.string().min(1).max(200).optional(),
    }).refine((value) => Object.keys(value).length > 0, 'Give at least one search field'),
  }),
  params: empty,
  query: empty,
});

export const idParamSchema = z.object({
  body: empty,
  params: z.object({ id }),
  query: empty,
});

export const attachFacilitySchema = z.object({
  body: z.object({ hfrId: facilityId }),
  params: z.object({ id }),
  query: empty,
});

export const attachPractitionerSchema = z.object({
  body: z.object({ hprId }),
  params: z.object({ id }),
  query: empty,
});

export const bridgeLinkSchema = z.object({
  body: z.object({
    roles: z.array(z.enum(BRIDGE_ROLES)).min(1).max(BRIDGE_ROLES.length)
      .refine((list) => new Set(list).size === list.length, 'Roles must not repeat'),
    hipName: z.string().min(1, 'HIP name is required')
      .max(HIP_NAME_MAX, `HIP name is ${HIP_NAME_MAX} characters or fewer`)
      .regex(HIP_NAME_PATTERN, 'HIP name has no special characters'),
    confirm: z.literal(true, { error: 'Confirm that you want to change the registry link' }),
  }),
  params: z.object({ id }),
  query: empty,
});
