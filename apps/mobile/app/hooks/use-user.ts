import { useCallback, useEffect } from "react";
import {
  userService,
  UserProfile,
  UserService,
} from "@/services/user.debug.service";
import { useApiState, UseApiStateReturn } from "./use-api-state";

export interface UseUserOptions {
  /** Custom user service to use (defaults to userService) */
  userService?: UserService;
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
  updateProfile: (payload: {
    email?: string;
  }) => Promise<UserProfile | undefined>;
}

/**
 * Hook for managing user profile operations.
 * Provides loading, error, and mutation states along with CRUD operations.
 */
export function useUser(options: UseUserOptions = {}): UseUserReturn {
  const {
    userService: customService,
    initialData,
    onSuccess,
    onError,
    retryCount = 3,
    retryDelay = 1000,
    immediate = true,
  } = options;

  // Use custom service if provided, otherwise use default
  const service = customService || userService;

  const {
    data,
    isLoading,
    isRefreshing,
    error,
    execute,
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
    await execute(service.getProfile());
  }, [execute, service]);

  const updateProfile = useCallback(
    async (payload: { email?: string }): Promise<UserProfile | undefined> => {
      const result = await execute(service.updateProfile(payload));
      if (result) {
        setData(result);
      }
      return result;
    },
    [execute, setData, service],
  );

  // Auto-fetch on mount if immediate is true.
  //
  // In an effect, not in the render body. This used to call fetchProfile()
  // directly during render, which starts a request and sets state as a side
  // effect of rendering — React may render a component more than once (and
  // this project builds with the React Compiler, which makes that routine), so
  // it was a fetch whose count depended on how often React happened to render.
  useEffect(() => {
    if (immediate && !data && !isLoading && !error) {
      void fetchProfile();
    }
  }, [immediate, data, isLoading, error, fetchProfile]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    execute,
    refresh: fetchProfile,
    clearError,
    setData,
    fetchProfile,
    updateProfile,
  };
}
