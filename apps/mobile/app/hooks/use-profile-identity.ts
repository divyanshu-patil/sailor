import { useUser } from "@clerk/expo";

import { isOAuthImage } from "@/utils/oauth-image";

export interface ProfileIdentity {
  /** Clerk's verified primary email, or null. */
  email: string | null;
  /** A photo the person chose, or null — then the avatar is the Blobatar
   *  seeded from their nickname. */
  imageUrl: string | null;
  /** False until Clerk's user resource is available. */
  isLoaded: boolean;
}

/**
 * The one place the app reads identity for avatars/profile from.
 *
 * Clerk owns identity: the verified email lives here, so it's what a brand-new
 * profile shows before the backend row has been filled in. `imageUrl` is only
 * ever Clerk's — the backend's `avatar_url` is never consulted — and only an
 * upload: `hasImage` rules out Clerk's default placeholder, and the photo Clerk
 * copies from Google or Apple at sign-in is left out too, so an account made
 * that way still wears the face its nickname gave it.
 */
export function useProfileIdentity(): ProfileIdentity {
  const { user, isLoaded } = useUser();

  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const uploaded =
    !!user?.hasImage &&
    !isOAuthImage(
      user.imageUrl,
      user.externalAccounts.map((account) => account.imageUrl),
    );

  return {
    email,
    imageUrl: uploaded ? user!.imageUrl : null,
    isLoaded,
  };
}
