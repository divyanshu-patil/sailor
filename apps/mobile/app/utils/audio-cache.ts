import { Directory, File, Paths } from "expo-file-system";

/**
 * On-disk cache of deck recordings.
 *
 * A recording lives in MinIO, but playback shouldn't wait on a network round
 * trip every time the user opens practice — and a presigned URL expires, so
 * holding onto one is not a substitute for holding onto the file. The download
 * happens once; every later open reads from disk.
 *
 * Deliberately under `Paths.cache` rather than `Paths.document`: this is
 * reconstructible from the server, so it's correct for iOS to reclaim it under
 * storage pressure, and correct for "Clear cache" in Settings to remove it.
 * Both cases re-download on the next open.
 */

const DIRECTORY_NAME = "deck-audio";

/** One recording per deck — the API enforces the same thing with a
 *  deterministic object key, so re-recording overwrites rather than piles up. */
const fileName = (deckId: string) => `${deckId}.m4a`;

function directory(): Directory {
  return new Directory(Paths.cache, DIRECTORY_NAME);
}

function ensureDirectory(): Directory {
  const dir = directory();
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** The local file for a deck's recording, or null if it isn't cached. */
export function getCachedAudioUri(deckId: string): string | null {
  const file = new File(directory(), fileName(deckId));
  return file.exists ? file.uri : null;
}

/**
 * Download a recording and return its local uri.
 *
 * `idempotent` overwrites rather than rejecting: re-recording a deck reuses the
 * same filename, and the stale file is exactly what must not survive.
 */
export async function cacheAudio(
  deckId: string,
  url: string,
): Promise<string> {
  ensureDirectory();
  const destination = new File(directory(), fileName(deckId));
  const downloaded = await File.downloadFileAsync(url, destination, {
    idempotent: true,
  });
  return downloaded.uri;
}

/**
 * Adopt a just-recorded file into the cache, instead of downloading back the
 * bytes we just uploaded.
 *
 * The recorder writes to a temporary location the OS is free to reclaim, so the
 * file does have to be copied somewhere durable — but copying the local take is
 * the same bytes as the round trip, minus the round trip.
 */
export function cacheLocalAudio(deckId: string, localUri: string): string {
  ensureDirectory();
  const destination = new File(directory(), fileName(deckId));
  if (destination.exists) destination.delete();
  new File(localUri).copySync(destination);
  return destination.uri;
}

/** Drop one deck's cached recording — used when the recording is deleted or
 *  replaced, so playback can't fall back to the previous take. */
export function deleteCachedAudio(deckId: string): void {
  try {
    const file = new File(directory(), fileName(deckId));
    if (file.exists) file.delete();
  } catch (e) {
    // A cache entry that won't delete is not worth failing a user action over;
    // the next download overwrites it anyway.
    console.log("audio cache delete failed", e);
  }
}

/** Bytes held by cached recordings. Counted into the figure Settings shows. */
export function getAudioCacheSizeBytes(): number {
  try {
    const dir = directory();
    return dir.exists ? (dir.size ?? 0) : 0;
  } catch (e) {
    console.log("audio cache size failed", e);
    return 0;
  }
}

/** Remove every cached recording. Called from "Clear cache" in Settings. */
export function clearAudioCache(): void {
  try {
    const dir = directory();
    if (dir.exists) dir.delete();
  } catch (e) {
    console.log("audio cache clear failed", e);
  }
}
