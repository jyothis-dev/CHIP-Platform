/** The registry fixes the page size for the facility search at 10 (HFR-009). */
export const FACILITY_PAGE_SIZE = 10;

/** Ownership codes the facility search accepts (M4 specification: "G", "P" or "PP"). */
export const OWNERSHIP_CODES = ['G', 'P', 'PP'];

export const BRIDGE_ROLES = ['HIP', 'HIU'];

export const MASTER_KINDS = ['states', 'districts', 'subdistricts'];

/** The specification: 12 characters, starting IN. Not validated more strictly than that. */
export const FACILITY_ID_PATTERN = /^IN.{10}$/;

/** M4 specification: alphanumeric and -_.(),/ with a single space between words. */
export const FACILITY_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-_.(),/]*( [A-Za-z0-9\-_.(),/]+)*$/;

/** M4 specification: at most 15 characters, no special characters. */
export const HIP_NAME_PATTERN = /^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/;
export const HIP_NAME_MAX = 15;
