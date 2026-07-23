import React, { useEffect, useMemo, useRef } from "react";
import { ScrollView, StyleSheet, View, Keyboard } from "react-native";
import {
  useLocalSearchParams,
  Stack,
  router,
  useFocusEffect,
} from "expo-router";
import { useDeckGeneration } from "@/hooks/use-deck-generation";
import { PresentationFormState } from "../../new-script/types/types";
import GeneratingScreen from "./components/generating";
import BlobBackground from "../components/background";
import StatusText from "./components/generating/components/status-text";
import { getGeneratingMessages } from "./components/generating/utils/get-generation-messages";
import { useHeaderHeight } from "expo-router/build/react-navigation";
import ScriptText from "./components/script-text/script-text";
import Animated, { LinearTransition } from "react-native-reanimated";
import ReviseBar, { ReviseBarRef } from "./components/revise-bar";
import { useColors } from "@/constants/theme";
import { KeyboardController } from "react-native-keyboard-controller";

type GeneratePreviewParams = {
  form: string;
};

const PreviewScreen = () => {
  const reviseBarRef = useRef<ReviseBarRef>(null);
  const headerHeight = useHeaderHeight();
  const { form } = useLocalSearchParams<GeneratePreviewParams>();
  const formState: PresentationFormState = useMemo(
    () => JSON.parse(form),
    [form],
  );

  const {
    deck,
    status,
    isScriptReady,
    isConfirming,
    isRevising,
    error,
    generate,
    revise,
    confirm,
    cancel,
  } = useDeckGeneration();

  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    generate({
      description: formState.description,
      durationMins: formState.durationMinutes,
      audience: formState.audience,
      cardCount: formState.cardCount,
      // formState.attachments still isn't consumed by the backend — see
      // deck_controller.create_deck / DeckCreateRequest.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRevise = async (instruction: string) => {
    if (!isScriptReady) return;
    await revise(instruction);
  };

  const handleCreate = async () => {
    if (!isScriptReady || !deck) return;
    await confirm();
    router.push({
      pathname: "/(authenticated)/(script)/results",
      params: { deckId: String(deck.id) },
    });
  };

  const { colors } = useColors();

  useEffect(() => {
    KeyboardController.dismiss();
    Keyboard.dismiss();
  }, []);

  useFocusEffect(() => {
    KeyboardController.dismiss();
    Keyboard.dismiss();
  });

  const showScript = !!deck?.script && (isScriptReady || isRevising);

  useEffect(() => {
    if (showScript) {
      console.log(
        "[preview] showScript is now true, script length:",
        deck?.script?.length,
      );
    }
  }, [showScript, deck?.script?.length]);

  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon={"square.and.pencil"}
          hidden={!isScriptReady}
          tintColor={colors.rust}
          disabled={isConfirming}
          onPress={() => {
            reviseBarRef.current?.blur();
            router.push({
              pathname: "/(authenticated)/(script)/modals/edit-script",
              params: { deckId: String(deck?.id) },
            });
          }}
        />
        <Stack.Toolbar.Button
          hidden={!isScriptReady}
          tintColor={colors.rust}
          variant="prominent"
          disabled={isConfirming}
          onPress={handleCreate}
        >
          Create
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <View style={{ flex: 1 }}>
        <BlobBackground />
        <ScrollView
          style={[{ paddingTop: headerHeight + 20 }, styles.container]}
          scrollEnabled={showScript}
          keyboardDismissMode="on-drag"
        >
          <StatusText
            labels={getGeneratingMessages(status, deck?.title)}
            accentColor={colors.rust}
          />

          {showScript && (
            <Animated.View
              layout={LinearTransition.springify()}
              style={styles.scriptContainer}
            >
              <ScriptText script={deck!.script!} fontSize={20} />
            </Animated.View>
          )}
        </ScrollView>

        {isScriptReady && (
          <ReviseBar
            ref={reviseBarRef}
            onSubmit={handleRevise}
            accentColor={colors.rust}
          />
        )}

        {!isScriptReady && status !== "completed" && (
          <GeneratingScreen
            status={status ?? "pending"}
            error={error}
            onStop={cancel}
          />
        )}
      </View>
    </>
  );
};

export default PreviewScreen;

const styles = StyleSheet.create({
  scriptContainer: { marginTop: 30 },
  container: { flex: 1, paddingHorizontal: 20 },
});
