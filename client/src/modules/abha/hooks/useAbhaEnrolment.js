import { useMutation } from '@tanstack/react-query';
import * as abhaApi from '../api/abhaApi.js';

export function useAbhaEnrolment() {
  const requestOtp = useMutation({
    mutationFn: abhaApi.requestOtp,
  });
  const resendOtp = useMutation({
    mutationFn: abhaApi.resendOtp,
  });
  const verifyOtp = useMutation({
    mutationFn: abhaApi.verifyOtp,
  });
  const verifyMobile = useMutation({
    mutationFn: abhaApi.verifyMobile,
  });
  const loadSuggestions = useMutation({
    mutationFn: abhaApi.addressSuggestions,
  });
  const createAddress = useMutation({
    mutationFn: abhaApi.createAddress,
  });
  const loadCard = useMutation({
    mutationFn: abhaApi.getCard,
  });

  return {
    requestOtp,
    resendOtp,
    verifyOtp,
    verifyMobile,
    loadSuggestions,
    createAddress,
    loadCard,
    isBusy:
      requestOtp.isPending
      || resendOtp.isPending
      || verifyOtp.isPending
      || verifyMobile.isPending
      || loadSuggestions.isPending
      || createAddress.isPending
      || loadCard.isPending,
  };
}
