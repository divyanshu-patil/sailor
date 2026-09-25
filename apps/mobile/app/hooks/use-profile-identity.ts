import { useUser } from "@clerk/expo";

export interface ProfileIdentity {
  /**
   * The deterministic avatar seed: the email, else the Clerk user id. Empty
   * only until the Clerk user loads.
   */
  name: string;
  /** Clerk's verified primary email, or null. */
  email: string | null;
  /** The real profile image URL, or null when the user has none. */
  imageUrl: string | null;
  /** False until Clerk's user resource is available. */
  isLoaded: boolean;
}

/**
 * The one place the app reads identity for avatars/profile from.
 *
 * Clerk owns identity: the verified email lives here, so it's what a brand-new
 * profile shows before the backend row has been filled in. `imageUrl` is only ever Clerk's — the backend's
 * `avatar_url` is never consulted. `hasImage` is what tells a real upload apart
 * from Clerk's default placeholder, and the placeholder is exactly what
 * Blobatar replaces.
 */
export function useProfileIdentity(): ProfileIdentity {
  const { user, isLoaded } = useUser();

  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  return {
    name: email || user?.id || "",
    email,
    imageUrl: user?.hasImage ? user.imageUrl : null,
    isLoaded,
  };
}
