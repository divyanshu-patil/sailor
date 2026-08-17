/* eslint-disable react-hooks/immutability */
// `useNativeState`'s ObservableState is written by assignment — that's its API,
// and the wizard's step-1 does the same. The rule can't tell it from a mutated
// hook return value.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  Button,
  Form,
  Host,
  Menu,
  Picker,
  RNHostView,
  Section,
  Text as SwiftUIText,
  TextField,
  useNativeState,
} from "@expo/ui/swift-ui";
import {
  font,
  lineLimit,
  listRowInsets,
  onSubmit,
  submitLabel,
  tag,
} from "@expo/ui/swift-ui/modifiers";

import { useDeck } from "@/hooks";
import { useAppUserStore } from "@/store/app-user.store";
import { DECK_CATEGORIES, SUGGESTED_TAGS } from "@/constants/deck-categories";
import { DECK_PALETTE } from "@/constants/deck-palette";
import { PublicDeckCardBody } from "@/screens/discover/components/public-deck-card";
import { useColors } from "@/constants/theme";

const MIN_DESCRIPTION = 10;
const MAX_DESCRIPTION = 280;
const MAX_TAGS = 8;

/** First paragraph, whitespace collapsed, cut at a word boundary. A starting
 *  point the author edits — not something that can exceed the API's limit. */
const toSummary = (raw: string): string => {
  const firstParagraph = raw.split(/\n\s*\n/)[0] ?? "";
  const flat = firstParagraph.replace(/\s+/g, " ").trim();
  if (flat.length <= MAX_DESCRIPTION) return flat;
  const cut = flat.slice(0, MAX_DESCRIPTION);
  return cut.slice(0, cut.lastIndexOf(" ")).trimEnd();
};

/**
 * The publish review sheet.
 *
 * Publishing is an action with a preview, not a toggle: the author sees the
 * exact card the feed will show — their own deck colour, their byline, their
 * tags — before anything becomes visible to anyone else. Nothing is written
 * until Publish is tapped.
 *
 * Republishing reopens this pre-filled, because unpublishing keeps the metadata
 * rather than wiping it.
 */
export default function PublishSheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: deck, publish, isMutating, error } = useDeck({ deckId: id });
  const appUser = useAppUserStore((state) => state.appUser);
  const { colors } = useColors();

  const description = useNativeState("");
  const tagDraft = useNativeState("");
  // The native field owns the text; this mirror is what the preview card and
  // the validation below re-render against.
  const [descriptionText, setDescriptionText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [category, setCategory] = useState<string | null>(null);

  // Seed once, from whatever the deck already has. Re-seeding on every deck
  // refresh would overwrite what the author is in the middle of typing.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !deck) return;
    seeded.current = true;
    // A deck's stored description is the *generation brief* — often a couple of
    // thousand characters of instructions. Seeding it raw pushed straight past
    // the API's 280-character limit, and since the only client-side check was a
    // minimum, Publish stayed enabled and the request came back 422. Trimmed to
    // a real summary here; `maxLength` on the field keeps it there from then on.
    const initial = toSummary(deck.description ?? "");
    description.value = initial;
    setDescriptionText(initial);
    setTags(deck.tags ?? []);
    setCategory(deck.category ?? null);
  }, [deck, description]);

  const addTag = (raw: string) => {
    const cleaned = raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 24);
    if (!cleaned) return;
    setTags((prev) =>
      prev.includes(cleaned) || prev.length >= MAX_TAGS ? prev : [...prev, cleaned],
    );
    tagDraft.value = "";
  };

  const canPublish =
    !!deck &&
    !isMutating &&
    descriptionText.trim().length >= MIN_DESCRIPTION &&
    descriptionText.trim().length <= MAX_DESCRIPTION &&
    tags.length > 0 &&
    !!category;

  const previewDeck = useMemo(
    () => ({
      id: id ?? "preview",
      title: deck?.title ?? "Untitled",
      description: descriptionText,
      // Only reachable in the instant before the deck loads; the palette's own
      // first entry rather than a colour invented here.
      color: deck?.color ?? DECK_PALETTE[0],
      audience: "general",
      durationMins: deck?.durationMins ?? 0,
      slideCount: deck?.slideCount ?? 0,
      tags,
      category,
      practiceCount: deck?.practiceCount ?? 0,
      saveCount: deck?.saveCount ?? 0,
      publishedAt: null,
      creator: {
        id: 0,
        // Same fallback order the API uses for the byline: nickname, then name.
        name: appUser?.nickname || appUser?.fullName || "You",
      },
    }),
    [id, deck, descriptionText, tags, category, appUser],
  );

  const onPublish = async () => {
    if (!canPublish || !category) return;
    const result = await publish({
      description: descriptionText.trim(),
      tags,
      category,
    });
    if (result) {
      router.back();
    } else {
      Alert.alert("Couldn't publish", error ?? "Please try again.");
    }
  };

  return (
    <>
      {/* Publish is the screen's one commitment, so it sits where a commitment
          belongs on iOS — top right of the sheet. Cancel is gone: the sheet's
          own swipe-down (and its close affordance) already means "not now",
          and a second way to say it only crowded the form. */}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          variant="prominent"
          tintColor={colors.rust}
          disabled={!canPublish}
          onPress={onPublish}
        >
          {isMutating ? "Publishing…" : "Publish"}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Host style={styles.host}>
      <Form>
        <Section title="Preview" modifiers={[listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 })]}>
          {/* The feed card itself, embedded in the SwiftUI form. matchContents
              lets the row take its height from the card rather than a guess
              that goes stale the moment the card gains a line.

              listRowInsets zeroes the row's own padding — SwiftUI's default
              insets were being applied *around* a card already sized to the
              full row, which pushed it past both edges and left a white band
              above and below it. The card's breathing room now comes from one
              place: the wrapper below. */}
          <RNHostView matchContents>
            <View style={styles.preview}>
              <PublicDeckCardBody deck={previewDeck} />
            </View>
          </RNHostView>
        </Section>

        <Section
          title="Description"
          footer={
            <SwiftUIText modifiers={[font({ size: 13 })]}>
              {descriptionText.trim().length < MIN_DESCRIPTION
                ? `At least ${MIN_DESCRIPTION} characters — this is what people read in the feed.`
                : `${descriptionText.trim().length}/${MAX_DESCRIPTION}`}
            </SwiftUIText>
          }
        >
          <TextField
            text={description}
            axis="vertical"
            maxLength={MAX_DESCRIPTION}
            placeholder="What is this deck for?"
            modifiers={[lineLimit(4)]}
            onTextChange={setDescriptionText}
          />
        </Section>

        <Section
          title="Tags"
          footer={
            <SwiftUIText modifiers={[font({ size: 13 })]}>
              {tags.length === 0
                ? "At least one tag. Tags are how people filter the feed."
                : `${tags.length}/${MAX_TAGS}`}
            </SwiftUIText>
          }
        >
          {tags.map((item) => (
            <Button
              key={item}
              label={item}
              systemImage="minus.circle"
              role="destructive"
              onPress={() => setTags((prev) => prev.filter((t) => t !== item))}
            />
          ))}

          <TextField
            text={tagDraft}
            placeholder="Add a tag"
            maxLength={24}
            // The return key commits the tag, so adding several in a row never
            // leaves the keyboard.
            modifiers={[
              submitLabel("done"),
              onSubmit(() => addTag(tagDraft.value)),
            ]}
          />

          <Menu label="Suggested tags" systemImage="tag">
            {SUGGESTED_TAGS.filter((item) => !tags.includes(item)).map((item) => (
              <Button key={item} label={item} onPress={() => addTag(item)} />
            ))}
          </Menu>
        </Section>

        <Section title="Category">
          <Picker
            label="Category"
            selection={category}
            onSelectionChange={(value) => setCategory(value as string)}
          >
            {DECK_CATEGORIES.map((option) => (
              <SwiftUIText key={option.value} modifiers={[tag(option.value)]}>
                {option.label}
              </SwiftUIText>
            ))}
          </Picker>
        </Section>

      </Form>
    </Host>
    </>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  preview: { paddingHorizontal: 16, paddingVertical: 8 },
});
