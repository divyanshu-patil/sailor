/**
 * Whether a Clerk profile image is the photo copied from Google/Apple at
 * sign-in, rather than one the person chose.
 *
 * Clerk serves both through `img.clerk.com/<base64url JSON>`, and the JSON's
 * `src` names the source: `…/oauth_google/…` for a copied one, `…/uploaded/…`
 * for an upload. The linked accounts' own image URLs are checked first, for a
 * URL that isn't in that shape.
 */
export function isOAuthImage(
  imageUrl: string,
  externalImageUrls: (string | null | undefined)[] = [],
): boolean {
  if (externalImageUrls.includes(imageUrl)) return true;
  const payload = imageUrl.split("?")[0].split("/").pop() ?? "";
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    return json.includes("/oauth_");
  } catch {
    return false;
  }
}
