import { useUser } from "@clerk/expo";

export interface ProfileIdentity {
  /**
   * The deterministic avatar seed, following the app's fallback chain:
   * first + last name → full name → username → email → Clerk user id. Empty
   * only until the Clerk user loads.
   */
  name: string;
  /**
   * A human display name only — first + last name → full name → username.
   * Deliberately excludes the email/id fallbacks so a name field never shows
   * an address.
   */
  displayName: string;
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
 * Clerk owns identity: the name entered at signup and the verified email both
 * live here, so they're what a brand-new profile shows before the backend row
 * has been filled in. `imageUrl` is only ever Clerk's — the backend's
 * `avatar_url` is never consulted. `hasImage` is what tells a real upload apart
 * from Clerk's default placeholder, and the placeholder is exactly what
 * Blobatar replaces.
 */
export function useProfileIdentity(): ProfileIdentity {
  const { user, isLoaded } = useUser();

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.fullName?.trim() ||
    user?.username ||
    "";

  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  const name = displayName || email || user?.id || "";

  return {
    name,
    displayName,
    email,
    imageUrl: user?.hasImage ? user.imageUrl : null,
    isLoaded,
  };
}
