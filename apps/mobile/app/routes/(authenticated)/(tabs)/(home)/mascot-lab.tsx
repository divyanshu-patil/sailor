import { useEffect, useRef, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import type { Dotlottie } from "@lottiefiles/dotlottie-react-native";

import Mascot from "@/components/ui/mascot";

/**
 * TEMP: the mascot's `isTyping` input on a switch, with the playhead read back
 * off the player every 250ms.
 *
 * The frame counter is the thing to watch. The composition runs 0-226, with
 * `watching` declared as segment [0,126] and `observe` as [135,226]. If the
 * state machine is governing playback the counter stays inside one of those
 * windows; if it sweeps the whole range the machine is not applying its
 * states' `segment`, and the morph frames can never be reached on their own.
 */
const RUST = "#B75C5C";
const INK = "#1B1B1B";

export default function MascotLab() {
  const [observing, setObserving] = useState(false);
  const [entered, setEntered] = useState("—");
  const [frame, setFrame] = useState<number | null>(null);
  const [lo, setLo] = useState<number | null>(null);
  const [hi, setHi] = useState<number | null>(null);
  const [playing, setPlaying] = useState<boolean | null>(null);
  const [animId, setAnimId] = useState("—");
  const player = useRef<Dotlottie | null>(null);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const f = await player.current?.currentFrame();
        if (f == null) return;
        setFrame(Math.round(f));
        setLo((p) => (p == null ? f : Math.min(p, f)));
        setHi((p) => (p == null ? f : Math.max(p, f)));
        setPlaying((await player.current?.isPlaying()) ?? null);
        setAnimId((await player.current?.activeAnimationId()) ?? "—");
      } catch {
        // The view can be gone between ticks; nothing to report.
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.root}>
      <Mascot
        ref={player}
        size={300}
        observing={observing}
        onStateEntered={setEntered}
      />

      <View style={styles.row}>
        <Text style={styles.label}>
          isTyping = {observing ? "true" : "false"}
        </Text>
        <Switch
          value={observing}
          onValueChange={(v) => {
            // Range is per-toggle, so each flip is measured on its own.
            setLo(null);
            setHi(null);
            setObserving(v);
          }}
          trackColor={{ true: RUST, false: "#D8D2CC" }}
        />
      </View>

      <View style={styles.readout}>
        <Text style={styles.mono}>entered: {entered}</Text>
        <Text style={styles.mono}>animation: {animId}</Text>
        <Text style={styles.mono}>
          frame: {frame ?? "—"} playing: {String(playing)}
        </Text>
        <Text style={styles.mono}>
          range since toggle: {lo == null ? "—" : Math.round(lo)}–
          {hi == null ? "—" : Math.round(hi)}
        </Text>
        <Text style={styles.hint}>
          expecting {observing ? "135–226" : "0–126"}; 0–226 means segment is
          being ignored
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  label: { fontSize: 17, color: INK, fontVariant: ["tabular-nums"] },
  readout: { alignItems: "center", gap: 4 },
  mono: {
    fontSize: 14,
    color: INK,
    fontVariant: ["tabular-nums"],
    fontFamily: "Menlo",
  },
  hint: { fontSize: 12, color: "#A39B94", marginTop: 6, textAlign: "center" },
});
