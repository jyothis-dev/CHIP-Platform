export const AADHAAR_INVALID_MESSAGE = 'Aadhaar Number is not valid';

export const TERMS_TEXT = 'I, hereby declare that I am voluntarily sharing my Aadhaar number and demographic information issued by UIDAI, with National Health Authority (NHA) for the sole purpose of creation of ABHA number. I understand that my ABHA number can be used and shared for purposes as may be notified by ABDM from time to time including provision of healthcare services. Further, I am aware that my personal identifiable information (Name, Address, Age, Date of Birth, Gender and Photograph) may be made available to the entities working in the National Digital Health Ecosystem (NDHE) which inter alia includes stakeholders and entities such as healthcare professionals (e.g. doctors), facilities (e.g. hospitals, laboratories) and data fiduciaries (e.g. health programmes), which are registered with or linked to the Ayushman Bharat Digital Mission (ABDM), and various processes there under. I authorize NHA to use my Aadhaar number for performing Aadhaar based authentication with UIDAI as per the provisions of the Aadhaar (Targeted Delivery of Financial and other Subsidies, Benefits and Services) Act, 2016 for the aforesaid purpose. I understand that UIDAI will share my e-KYC details, or response of “Yes” with NHA upon successful authentication. I have been duly informed about the option of using other IDs apart from Aadhaar; however, I consciously choose to use Aadhaar number for the purpose of availing benefits across the NDHE. I am aware that my personal identifiable information excluding Aadhaar number / VID number can be used and shared for purposes as mentioned above. I reserve the right to revoke the given consent at any point of time as per provisions of Aadhaar Act and Regulations.';

export const DECLARATIONS = [
  {
    id: 'shareAadhaar',
    required: true,
    text: 'I am voluntarily sharing my Aadhaar Number / Virtual ID issued by the Unique Identification Authority of India (“UIDAI”), and my demographic information for the purpose of creating an Ayushman Bharat Health Account number (“ABHA number”) and Ayushman Bharat Health Account address (“ABHA Address”). I authorize NHA to use my Aadhaar number / Virtual ID for performing Aadhaar based authentication with UIDAI as per the provisions of the Aadhaar (Targeted Delivery of Financial and other Subsidies, Benefits and Services) Act, 2016 for the aforesaid purpose. I understand that UIDAI will share my e-KYC details, or response of “Yes” with NHA upon successful authentication.',
  },
  {
    id: 'otherDocument',
    required: false,
    text: 'I intend to create Ayushman Bharat Health Account Number (“ABHA number”) and Ayushman Bharat Health Account address (“ABHA Address”) using document other than Aadhaar. (Click here to proceed further)',
  },
  {
    id: 'linkRecords',
    required: true,
    text: 'I consent to usage of my ABHA address and ABHA number for linking of my legacy (past) government health records and those which will be generated during this encounter.',
  },
  {
    id: 'shareRecords',
    required: true,
    text: 'I authorize the sharing of all my health records with healthcare provider(s) for the purpose of providing healthcare services to me during this encounter.',
  },
  {
    id: 'anonymize',
    required: true,
    text: 'I consent to the anonymization and subsequent use of my government health records for public health purposes.',
  },
];

export function abhaAddressRules(value) {
  const raw = String(value || '').trim();
  const at = raw.lastIndexOf('@');
  const suffix = at >= 0 ? raw.slice(at).toLowerCase() : '';
  const hasKnownSuffix = suffix === '@sbx' || suffix === '@abdm';
  const local = hasKnownSuffix ? raw.slice(0, at) : raw;
  const full = hasKnownSuffix ? raw : `${raw}@sbx`;
  const lengthOk = full.length >= 8 && full.length <= 18 && local.length > 0;
  const charsetOk = /^[A-Za-z0-9._]+$/.test(local);
  const dotCount = (local.match(/\./g) || []).length;
  const underscoreCount = (local.match(/_/g) || []).length;
  const specialsOk = charsetOk
    && dotCount <= 1
    && underscoreCount <= 1
    && !local.startsWith('.')
    && !local.endsWith('.')
    && !local.startsWith('_')
    && !local.endsWith('_');
  return {
    lengthOk,
    charsetOk,
    specialsOk,
    valid: Boolean(lengthOk && charsetOk && specialsOk),
  };
}
