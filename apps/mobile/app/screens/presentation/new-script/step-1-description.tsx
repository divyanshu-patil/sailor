/* eslint-disable react-hooks/immutability */
import React, { useCallback, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  Host,
  Form,
  Section,
  TextField,
  Button,
  HStack,
  Spacer,
  Text,
  Image,
  List,
  Menu,
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  font,
  foregroundStyle,
  padding,
  frame,
  keyboardType,
  animation,
  Animation,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { usePresentationForm } from "./form-context";
import { AttachmentKind, Attachment } from "./types/types";

function iconForKind(kind: AttachmentKind) {
  switch (kind) {
    case "image":
      return "photo";
    case "document":
      return "doc.text";
    case "link":
      return "link";
  }
}

export default function StepDescription() {
  const {
    form,
    addAttachment,
    removeAttachment,
    descriptionState,
    setDescriptionValue,
    linkDraftState,
  } = usePresentationForm();

  const linkDraft = linkDraftState;
  const [showLinkInput, setShowLinkInput] = useState(false);

  const addImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    result.assets.forEach((asset, i) => {
      addAttachment({
        id: `img-${Date.now()}-${i}`,
        kind: "image",
        name: asset.fileName ?? `Image ${form.attachments.length + i + 1}`,
        uri: asset.uri,
      });
    });
  }, [addAttachment, form.attachments.length]);

  const addDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      type: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ],
    });
    if (result.canceled) return;
    result.assets.forEach((asset, i) => {
      addAttachment({
        id: `doc-${Date.now()}-${i}`,
        kind: "document",
        name: asset.name,
        uri: asset.uri,
      });
    });
  }, [addAttachment]);

  const addLink = useCallback(() => {
    const trimmed = linkDraft.value.trim();
    if (!trimmed) return;
    addAttachment({ id: `link-${Date.now()}`, kind: "link", name: trimmed });

    linkDraft.value = "";
    setShowLinkInput(false);
  }, [linkDraft, addAttachment]);

  return (
    <>
      <Host style={{ flex: 1 }}>
        <Form>
          <Section
            title="Description"
            footer={
              <Text
                modifiers={[
                  font({ size: 13 }),
                  foregroundStyle({ type: "hierarchical", style: "secondary" }),
                ]}
              >
                Describe the topic, goal, and tone of your presentation.
              </Text>
            }
          >
            <HStack spacing={8} alignment={"top"}>
              <Menu
                label=""
                systemImage="plus"
                modifiers={[
                  tint("#c11b5c"),
                  foregroundStyle("#c11b5c"),
                  padding({ top: 10 }),
                ]}
              >
                <Button onPress={addImage}>
                  <HStack spacing={6}>
                    <Image systemName="photo" size={15} />
                    <Text>Image</Text>
                  </HStack>
                </Button>
                <Button onPress={addDocument}>
                  <HStack spacing={6}>
                    <Image systemName="doc.text" size={15} />
                    <Text>Document</Text>
                  </HStack>
                </Button>
                <Button onPress={() => setShowLinkInput((v) => !v)}>
                  <HStack spacing={6}>
                    <Image systemName="link" size={15} />
                    <Text>Link</Text>
                  </HStack>
                </Button>
              </Menu>
              <TextField
                axis="vertical"
                text={descriptionState}
                placeholder="e.g. A persuasive pitch deck for a seed-stage climate tech startup..."
                modifiers={[padding({ vertical: 4 }), keyboardType("url")]}
                onTextChange={setDescriptionValue}
              />
            </HStack>
          </Section>

          {(form.attachments.length > 0 || showLinkInput) && (
            <Section
              title="Attachments"
              modifiers={[animation(Animation.default, showLinkInput)]}
              footer={
                <Text
                  modifiers={[
                    font({ size: 13 }),
                    foregroundStyle({
                      type: "hierarchical",
                      style: "secondary",
                    }),
                  ]}
                >
                  Optional — add images, documents, or links to ground the
                  presentation in your own material.
                </Text>
              }
            >
              {showLinkInput && (
                <HStack
                  spacing={8}
                  modifiers={[animation(Animation.spring(), showLinkInput)]}
                >
                  <TextField
                    placeholder="https://example.com"
                    text={linkDraft}
                    modifiers={[frame({ minWidth: 0 }), keyboardType("url")]}
                  />
                  <Button
                    modifiers={[buttonStyle("glassProminent")]}
                    onPress={addLink}
                  >
                    <Text>Add</Text>
                  </Button>
                </HStack>
              )}

              {form.attachments.length > 0 && (
                <List>
                  {form.attachments.map((item: Attachment) => (
                    <HStack
                      key={item.id}
                      modifiers={[padding({ vertical: 4 })]}
                    >
                      <Image
                        systemName={iconForKind(item.kind)}
                        size={18}
                        color="#8E8E93"
                      />
                      <Text
                        modifiers={[
                          padding({ leading: 8 }),
                          font({ size: 15 }),
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Spacer />
                      <Button
                        modifiers={[buttonStyle("plain")]}
                        onPress={() => removeAttachment(item.id)}
                      >
                        <Image
                          systemName="xmark.circle.fill"
                          size={18}
                          color="#C7C7CC"
                        />
                      </Button>
                    </HStack>
                  ))}
                </List>
              )}
            </Section>
          )}
        </Form>
      </Host>
    </>
  );
}
