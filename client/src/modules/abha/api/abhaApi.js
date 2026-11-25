import { http } from '@/shared/api/http.js';

export function requestOtp({ patientId, aadhaar }) {
  return http.post('/abha/enrolment/otp', { patientId, aadhaar });
}

export function verifyOtp(body) {
  return http.post('/abha/enrolment/verify', body);
}

export function verifyMobile(body) {
  return http.post('/abha/enrolment/mobile/verify', body);
}

export function addressSuggestions(transactionId) {
  return http.get(`/abha/enrolment/${transactionId}/address-suggestions`);
}

export function createAddress(body) {
  return http.post('/abha/enrolment/address', body);
}

export function getCard(transactionId) {
  return http.get(`/abha/enrolment/${transactionId}/card`);
}
