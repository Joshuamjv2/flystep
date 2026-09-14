import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const useApiGet = (key, fn, options) => {
  return useQuery({
    queryKey: key,
    queryFn: fn,
    ...options,
  });
};

export const useApiSend = (fn, success, error, invalidateKey, options) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      if (invalidateKey) {
        invalidateKey.forEach((key) => {
          // Use the object syntax for invalidateQueries to ensure compatibility
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
      if (success) success(data);
    },
    onError: error,
    retry: 2,
    ...options,
  });
};
