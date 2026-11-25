import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as patientsApi from '../api/patientsApi.js';

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patientsApi.createPatient,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}
