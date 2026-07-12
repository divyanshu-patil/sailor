import { useCallback } from "react";
import { userService, UserProfile } from "@/services/user.service";
import { useApiState, UseApiStateReturn } from "./use-api-state";

export interface UseUserOptions {
  /** Initial data to set */
  initialData?: UserProfile;
  /** Callback on successful fetch */
  onSuccess?: (data: UserProfile) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Number of retry attempts on failure */
  retryCount?: number;
  /** Delay between retries in ms */
  retryDelay?: number;
  /** Auto-fetch user profile on mount */
  immediate?: boolean;
}

export interface UseUserReturn extends UseApiStateReturn<UserProfile> {
  /** Fetch user profile */
  fetchProfile: () => Promise<void>;
  /** Update user profile */
  updateProfile: (payload: { email?: string }) => Promise<UserProfile | undefined>;
}

/**
 * Hook for managing user profile operations.
 * Provides loading, error, and mutation states along with CRUD operations.
 */
export function useUser(options: UseUserOptions = {}): UseUserReturn {
  const {
    initialData,
    onSuccess,
    onError,
    retryCount = 3,
    retryDelay = 1000,
    immediate = true,
  } = options;

  const {
    data,
    isLoading,
    isRefreshing,
    isMutating,
    error,
    execute,
    refresh,
    clearError,
    setData,
  } = useApiState<UserProfile>({
    initialData,
    onSuccess,
    onError,
    retryCount,
    retryDelay,
  });

  const fetchProfile = useCallback(async () => {
    await execute(userService.getProfile());
  }, [execute]);

  const updateProfile = useCallback(
    async (payload: { email?: string }): Promise<UserProfile | undefined> => {
      const result = await execute(userService.updateProfile(payload));
      if (result) {
        setData(result);
      }
      return result;
    },
    [execute, setData],
  );

  // Auto-fetch on mount if immediate is true
  if (immediate && !data && !isLoading && !error) {
    fetchProfile();
  }

  return {
    data,
    isLoading,
    isRefreshing,
    isMutating,
    error,
    execute,
    refresh: fetchProfile,
    clearError,
    setData,
    fetchProfile,
    updateProfile,
  };
}