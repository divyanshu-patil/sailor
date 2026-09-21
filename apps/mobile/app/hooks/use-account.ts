import { useCallback } from "react";
import { userService } from "@/services/user.service";
// (The in-memory stub lives at "@/services/user.debug.service" while testing.)
import { useApiMutation } from "./use-api-state";

export interface UseAccountOptions {
  onDeleted?: () => void;
  onError?: (error: Error) => void;
}

export interface UseAccountReturn {
  isDeleting: boolean;
  error: string | null;
  deleteAccount: () => Promise<void>;
  clearError: () => void;
}

/** Owns account-deletion state. Nothing outside this hook calls userService.deleteAccount. */
export function useAccount(options: UseAccountOptions = {}): UseAccountReturn {
  const { onDeleted, onError } = options;
  const { isMutating, error, mutate, clearError } = useApiMutation<void>({
    onSuccess: onDeleted,
    onError,
  });

  const deleteAccount = useCallback(async () => {
    await mutate(userService.deleteAccount());
  }, [mutate]);

  return { isDeleting: isMutating, error, deleteAccount, clearError };
}
