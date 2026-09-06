import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import Mascot from "@/components/ui/mascot";
import { usePresentationForm } from "./form-context";
import PillPicker from "./components/PillPicker";
import PillRuler from "./components/PillRuler";
import { AUDIENCES } from "./types/types";
import { MOOD_OPTIONS } from "@/types/settings/preferences";
import { PROFESSIONS, PROFESSION_LABELS } from "@/types/user";

const INK = "#1B1B1B";
const MUTED_INK = "#B4B0AC";

const MASCOT_SIZE = 104;

const AUDIENCE_COLOR = "#9CCDEA";
const MOOD_COLOR = "#EC9291";
const SPEAKING_COLOR = "#F3D96B";

interface StepDeliveryProps {
  /** False while another step is on screen. This one stays mounted behind it. */
  active: boolean;
}

export default function StepDelivery({ active }: StepDeliveryProps) {
  const { form, setAudienceIndex, setMood, setProfession } =
    usePresentationForm();

  const moodLabels = useMemo(() => MOOD_OPTIONS.map((m) => m.label), []);
  const professionLabels = useMemo(
    () => PROFESSIONS.map((p) => PROFESSION_LABELS[p]),
    [],
  );

  const moodIndex = Math.max(
    0,
    MOOD_OPTIONS.findIndex((m) => m.tag === form.mood),
  );
  const professionIndex = Math.max(
    0,
    PROFESSIONS.indexOf(form.profession ?? "other"),
  );

  // Which pill owns the gesture, and how far into the muted state everything
  // else is. Shared rather than state: the greying runs on the UI thread with
  // the drag, not a render behind it.
  const activePill = useSharedValue(-1);
  const interacting = useSharedValue(0);

  // One continuous position per pill, held here so the ruler can read the same
  // value the pill is drawn from.
  const audienceRaw = useSharedValue(form.audienceIndex);
  const moodRaw = useSharedValue(moodIndex);
  const speakingRaw = useSharedValue(professionIndex);

  // Which list the ruler shows. Followed off the shared value rather than a
  // callback prop, so the pills' gestures stay free of JS handlers. Left in
  // place after a drag so the ruler has something to draw while it fades out,
  // and null until the first one — the rows are invisible before that, and not
  // building them keeps them out of the step's entrance.
  const [rulerId, setRulerId] = useState<number | null>(null);
  useAnimatedReaction(
    () => activePill.value,
    (pill) => {
      if (pill >= 0) runOnJS(setRulerId)(pill);
    },
  );

  // Stable identities: an inline arrow here re-renders every pill on every step
  // the gesture crosses, which defeats the memo on PillPicker.
  const changeMood = useCallback(
    (i: number) => setMood(MOOD_OPTIONS[i].tag),
    [setMood],
  );
  const changeProfession = useCallback(
    (i: number) => setProfession(PROFESSIONS[i]),
    [setProfession],
  );

  const rulers = [
    { options: AUDIENCES, raw: audienceRaw },
    { options: moodLabels, raw: moodRaw },
    { options: professionLabels, raw: speakingRaw },
  ];

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      interacting.value,
      [0, 1],
      ["#FFFFFF", "#EFEDEA"],
    ),
  }));

  const chromeStyle = useAnimatedStyle(() => ({
    color: interpolateColor(interacting.value, [0, 1], [INK, MUTED_INK]),
  }));

  // Lottie can't be desaturated from JS, so the mascot steps back by fading.
  const mascotStyle = useAnimatedStyle(() => ({
    opacity: interpolate(interacting.value, [0, 1], [1, 0.4]),
  }));

  return (
    <View style={styles.root}>
      <View style={styles.cardWrap}>
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.header}>
            <Animated.View style={mascotStyle}>
              <Mascot size={MASCOT_SIZE} playing={active} />
            </Animated.View>
            <Animated.Text style={[styles.title, chromeStyle]}>
              Delivery
            </Animated.Text>
          </View>

          <View style={styles.pills}>
            <PillPicker
              id={1}
              caption="mood"
              options={moodLabels}
              index={moodIndex}
              onChange={changeMood}
              color={MOOD_COLOR}
              weight={1}
              raw={moodRaw}
              activePill={activePill}
              interacting={interacting}
            />
            <PillPicker
              id={2}
              caption="speaking as"
              options={professionLabels}
              index={professionIndex}
              onChange={changeProfession}
              color={SPEAKING_COLOR}
              weight={1.35}
              raw={speakingRaw}
              activePill={activePill}
              interacting={interacting}
            />
            <PillPicker
              id={0}
              caption="audience"
              options={AUDIENCES}
              index={form.audienceIndex}
              onChange={setAudienceIndex}
              color={AUDIENCE_COLOR}
              weight={2}
              raw={audienceRaw}
              activePill={activePill}
              interacting={interacting}
            />

            {rulerId !== null && (
              <PillRuler
                options={rulers[rulerId].options}
                raw={rulers[rulerId].raw}
                interacting={interacting}
              />
            )}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  cardWrap: { flex: 1, justifyContent: "center" },
  card: { borderRadius: 44, padding: 24, gap: 22 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 42, fontWeight: "500", letterSpacing: -0.5 },
  // Fixed height: the pills read as a bar chart, so the track has to be a known
  // length for the fills to mean anything.
  pills: { flexDirection: "row", gap: 14, height: 330 },
});
