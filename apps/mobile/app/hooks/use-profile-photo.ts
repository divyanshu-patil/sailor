import { useCallback, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { useUser } from "@clerk/expo";

export interface UseProfilePhotoReturn {
  /** The most recently picked image, waiting to be uploaded (or previewed). */
  pendingAsset: ImagePicker.ImagePickerAsset | null;
  /** Opens the library. Returns the asset, or null if cancelled/denied. */
  pickImage: () => Promise<ImagePicker.ImagePickerAsset | null>;
  /** Uploads one asset to Clerk and refreshes the local user. */
  uploadAsset: (asset: ImagePicker.ImagePickerAsset) => Promise<boolean>;
  /** Uploads whatever `pickImage` last returned. */
  uploadPending: () => Promise<boolean>;
  /** Removes the current image, dropping the user back to their Blobatar. */
  removePhoto: () => Promise<boolean>;
  clearPending: () => void;
  isPicking: boolean;
  isUploading: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * The "pick a photo and give it to Clerk" logic behind Edit Profile.
 *
 * Clerk is the owner of the image: `user.setProfileImage` replaces it, `null`
 * removes it, and `user.reload()` refreshes `imageUrl`/`hasImage` so every
 * ProfileAvatar on screen updates without an app restart. A cancelled picker is
 * deliberately not an error.
 */
export function useProfilePhoto(): UseProfilePhotoReturn {
  const { user } = useUser();
  const [pendingAsset, setPendingAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);
  const clearPending = useCallback(() => setPendingAsset(null), []);

  const pickImage = useCallback(async () => {
    setError(null);
    setIsPicking(true);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(
          "Allow photo library access in Settings to add a profile picture.",
        );
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        // Clerk only accepts an upload from base64 (a data URL) on Expo, so
        // the picker has to hand it over encoded rather than as a file URI.
        base64: true,
      });

      // Cancellation is not an error and must not navigate or reset anything.
      if (result.canceled) return null;

      const asset = result.assets?.[0] ?? null;
      if (asset) setPendingAsset(asset);
      return asset;
    } catch (e) {
      console.warn("[profile-photo] pick failed", e);
      setError("We couldn't open your photos. Please try again.");
      return null;
    } finally {
      setIsPicking(false);
    }
  }, []);

  const uploadAsset = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      if (!user) {
        setError("Your session isn't ready yet. Try again in a moment.");
        return false;
      }

      const mimeType = asset.mimeType ?? "image/jpeg";
      const file = asset.base64
        ? `data:${mimeType};base64,${asset.base64}`
        : asset.uri;

      setError(null);
      setIsUploading(true);
      try {
        await user.setProfileImage({ file });
        await user.reload();
        setPendingAsset(null);
        return true;
      } catch (e) {
        // Optional step: a failure keeps the session intact and the preview
        // up, so the caller can offer Retry or Skip.
        console.warn("[profile-photo] upload failed", e);
        setError(
          "We couldn't save your photo. Check your connection and retry.",
        );
        return false;
      } finally {
        setIsUploading(false);
      }
    },
    [user],
  );

  const uploadPending = useCallback(async () => {
    if (!pendingAsset) return false;
    return uploadAsset(pendingAsset);
  }, [pendingAsset, uploadAsset]);

  const removePhoto = useCallback(async () => {
    if (!user) return false;
    setError(null);
    setIsUploading(true);
    try {
      await user.setProfileImage({ file: null });
      await user.reload();
      setPendingAsset(null);
      return true;
    } catch (e) {
      console.warn("[profile-photo] remove failed", e);
      setError("We couldn't remove your photo. Please try again.");
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [user]);

  return {
    pendingAsset,
    pickImage,
    uploadAsset,
    uploadPending,
    removePhoto,
    clearPending,
    isPicking,
    isUploading,
    error,
    clearError,
  };
}
