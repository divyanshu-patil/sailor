import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LayoutAnimationConfig } from "react-native-reanimated";
import {
  Button,
  Image,
  Menu,
  ProgressView,
  RNHostView,
  Section,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  aspectRatio,
  background,
  clipShape,
  font,
  foregroundStyle,
  frame,
  imageScale,
  labelStyle,
  listRowBackground,
  offset,
  padding,
  resizable,
} from "@expo/ui/swift-ui/modifiers";

import { useProfileIdentity } from "@/hooks/use-profile-identity";
import { useProfilePhoto } from "@/hooks/use-profile-photo";
import MorphingAvatar from "@/screens/onboarding/components/morphing-avatar";
import { PROFILE_PASTELS } from "@/screens/profile/theme";

const AVATAR_SIZE = 112;
/** The pencil badge, overlapping the photo's bottom-right like every other
 *  edit-profile flow. Sized against the photo so the two scale together. */
const BADGE_SIZE = Math.round(AVATAR_SIZE * 0.3);

/** `file://` in front of a bare path, left alone if it already has a scheme. */
function toFileUrl(path: string): string {
  return path.startsWith("file://") ? path : `file://${path}`;
}

/**
 * Turns a remote avatar URL into a local file path.
 *
 * SwiftUI's `Image` takes `uiImage`, which is a file on disk — it cannot fetch
 * a URL. `expo-image` has already cached the bytes for the profile screen, so
 * this asks for that cache entry rather than downloading anything twice, and
 * only prefetches when the entry is missing.
 *
 * Null while it resolves, and null forever if it fails, which the caller draws
 * as the "no photo" state rather than as an error — an avatar that cannot be
 * read is not something the person can act on.
 */
function useLocalAvatarPath(remoteUrl: string | null): string | null {
  // A pick from the library is already a file, so it needs no resolving and no
  // state — deriving it keeps the effect below for the one case that is async.
  const isLocalFile =
    !!remoteUrl &&
    (remoteUrl.startsWith("file://") || remoteUrl.startsWith("/"));

  // Stored with the URL it belongs to, so a changed avatar reads as "not
  // resolved yet" rather than briefly showing the previous one.
  const [resolved, setResolved] = useState<{
    url: string;
    path: string | null;
  } | null>(null);

  useEffect(() => {
    if (!remoteUrl || isLocalFile) return;

    let cancelled = false;
    (async () => {
      try {
        let cached = await ExpoImage.getCachePathAsync(remoteUrl);
        if (!cached) {
          await ExpoImage.prefetch(remoteUrl, { cachePolicy: "disk" });
          cached = await ExpoImage.getCachePathAsync(remoteUrl);
        }
        // `getCachePathAsync` hands back a bare filesystem path; SwiftUI's
        // `uiImage` wants a URL. Without the scheme it silently draws nothing,
        // which is the invisible avatar.
        if (!cancelled) {
          setResolved({
            url: remoteUrl,
            path: cached ? toFileUrl(cached) : null,
          });
        }
      } catch {
        if (!cancelled) setResolved({ url: remoteUrl, path: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [remoteUrl, isLocalFile]);

  if (!remoteUrl) return null;
  if (isLocalFile) return toFileUrl(remoteUrl);
  return resolved?.url === remoteUrl ? resolved.path : null;
}

/**
 * The avatar row for Edit Profile — a `Section` in the form, not a view above it.
 *
 * It used to be a React Native row sitting on top of the SwiftUI `Form`, which
 * is why it had its own cream background and stayed nailed in place while the
 * form scrolled underneath it. Inside the form it scrolls with everything else
 * and inherits the grouped background, so the row background is cleared to
 * nothing and the photo is simply centred on the page.
 *
 * The only control is the pencil. With no photo it opens the picker; with one,
 * it is a menu, so replacing and removing are both reachable without putting a
 * second word of chrome on the screen.
 *
 * With no photo, the avatar is the Blobatar the nickname gave them in
 * onboarding — the same morphing face, following the nickname field as it's
 * edited, before anything is saved.
 */
const ProfilePhotoSection = ({ nickname }: { nickname: string }) => {
  const { imageUrl } = useProfileIdentity();
  const {
    pendingAsset,
    pickImage,
    uploadAsset,
    removePhoto,
    isPicking,
    isUploading,
  } = useProfilePhoto();

  const busy = isPicking || isUploading;
  const localPath = useLocalAvatarPath(pendingAsset?.uri ?? imageUrl);
  const hasPhoto = localPath !== null;

  const handleChange = async () => {
    const asset = await pickImage();
    if (asset) await uploadAsset(asset);
  };

  return (
    <Section modifiers={[listRowBackground("clear")]}>
      {/* The badge sits ON the photo, bottom-right, rather than under it —
          which is where every edit-profile flow puts it and where a thumb
          expects to find it. `ZStack` with a bottomTrailing alignment does
          that natively; the offset nudges it onto the circle's edge. */}
      <ZStack
        alignment="bottomTrailing"
        modifiers={[
          frame({ maxWidth: Infinity, alignment: "center" }),
          padding({ vertical: 14 }),
        ]}
      >
        <ZStack
          modifiers={[frame({ width: AVATAR_SIZE, height: AVATAR_SIZE })]}
        >
          {hasPhoto ? (
            <Image
              uiImage={localPath}
              // Order is SwiftUI's own: resizable and aspectRatio first, so the
              // photo scales to fill the frame, THEN the frame, then the crop.
              // Without the first two it draws at its native pixel size and the
              // circle shows whatever happens to be in the middle of it.
              modifiers={[
                resizable(),
                aspectRatio({ contentMode: "fill" }),
                frame({ width: AVATAR_SIZE, height: AVATAR_SIZE }),
                clipShape("circle"),
              ]}
            />
          ) : (
            <RNHostView matchContents>
              {/* The first face is simply there — only a change of nickname
                  morphs. A layout entrance starting while the sheet presents
                  can stall invisible. */}
              <LayoutAnimationConfig skipEntering>
                <View
                  style={{
                    width: AVATAR_SIZE,
                    height: AVATAR_SIZE,
                    borderRadius: AVATAR_SIZE / 2,
                    backgroundColor: PROFILE_PASTELS.pink,
                    overflow: "hidden",
                  }}
                >
                  <MorphingAvatar name={nickname} size={AVATAR_SIZE} />
                </View>
              </LayoutAnimationConfig>
            </RNHostView>
          )}
        </ZStack>

        {busy ? (
          <ProgressView
            modifiers={[frame({ width: BADGE_SIZE, height: BADGE_SIZE })]}
          />
        ) : hasPhoto ? (
          <Menu
            label="Edit photo"
            systemImage="pencil.circle.fill"
            modifiers={[
              labelStyle("iconOnly"),
              imageScale("large"),
              font({ size: BADGE_SIZE }),
              foregroundStyle("#1F1D1D"),
              background("#FFFFFF", { shape: "circle" }),
              clipShape("circle"),
              // Half on the photo, half off it — the rim is where this badge
              // belongs; fully inside reads as part of the picture.
              offset({ x: 4, y: 4 }),
            ]}
          >
            <Button
              systemImage="photo"
              label="Choose photo"
              onPress={handleChange}
            />
            <Button
              systemImage="trash"
              label="Remove photo"
              role="destructive"
              onPress={removePhoto}
            />
          </Menu>
        ) : (
          <Button
            label="Add photo"
            systemImage="pencil.circle.fill"
            onPress={handleChange}
            modifiers={[
              labelStyle("iconOnly"),
              imageScale("large"),
              font({ size: BADGE_SIZE }),
              foregroundStyle("#1F1D1D"),
              background("#FFFFFF", { shape: "circle" }),
              clipShape("circle"),
              offset({ x: 4, y: 4 }),
            ]}
          />
        )}
      </ZStack>
    </Section>
  );
};

export default ProfilePhotoSection;
