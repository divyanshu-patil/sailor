import { useUser } from "@clerk/expo";

export interface ProfileIdentity {
  /** Clerk's verified primary email, or null. */
  email: string | null;
  /** False until Clerk's user resource is available. */
  isLoaded: boolean;
}

/**
 * The one place the app reads identity for the profile from.
 *
 * Clerk owns identity: the verified email lives here, so it's what a brand-new
 * profile shows before the backend row has been filled in. The avatar isn't
 * Clerk's at all — it's the Blobatar seeded from the nickname.
 */
export function useProfileIdentity(): ProfileIdentity {
  const { user, isLoaded } = useUser();

  return {
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    isLoaded,
  };
}
