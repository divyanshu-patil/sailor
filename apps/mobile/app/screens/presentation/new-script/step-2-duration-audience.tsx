import React from "react";
import { Host, Form, Section, Picker, Text } from "@expo/ui/swift-ui";
import {
  tag,
  pickerStyle,
  font,
  foregroundStyle,
  tint,
  contentTransition,
  animation,
  Animation,
} from "@expo/ui/swift-ui/modifiers";
import { usePresentationForm } from "./form-context";
import { AUDIENCES } from "./types/types";
import { MOOD_OPTIONS, ScriptMood } from "@/types/settings/preferences";
import {
  ExperienceLevel,
  Profession,
  PROFESSIONS,
  PROFESSION_LABELS,
} from "@/types/user";
import { EXPERIENCE_LEVELS } from "@/screens/profile/edit-profile/components/constants";
import AnimatedSlider from "./components/Slider";
import { View } from "react-native";

function formatMinutes(value: number) {
  const minutes = Math.round(value);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export default function StepDurationAudience() {
  const {
    form,
    setDurationMinutes,
    setAudienceIndex,
    setMood,
    setProfession,
    setExperienceLevel,
  } = usePresentationForm();

  return (
    <>
      <Host style={{ flex: 1 }}>
        <Form>
          {/* Audience */}
          <Section title="Audience">
            <Picker
              label="Who is this for?"
              modifiers={[pickerStyle("menu"), tint("#c11b5c")]}
              selection={form.audienceIndex}
              onSelectionChange={setAudienceIndex}
            >
              {AUDIENCES.map((label, index) => (
                <Text key={label} modifiers={[tag(index)]}>
                  {label}
                </Text>
              ))}
            </Picker>
          </Section>

          {/* Delivery — pre-selected from Settings, changed here for this
              script only. Nothing written back: Settings stays the default. */}
          <Section title="Delivery">
            <Picker
              label="Mood"
              modifiers={[pickerStyle("menu"), tint("#c11b5c")]}
              selection={form.mood}
              onSelectionChange={(value) => setMood(value as ScriptMood)}
            >
              {MOOD_OPTIONS.map((mood) => (
                <Text key={mood.tag} modifiers={[tag(mood.tag)]}>
                  {mood.label}
                </Text>
              ))}
            </Picker>
            <Picker
              label="Speaking as"
              modifiers={[pickerStyle("menu"), tint("#c11b5c")]}
              selection={form.profession}
              onSelectionChange={(value) => setProfession(value as Profession)}
            >
              {PROFESSIONS.map((p) => (
                <Text key={p} modifiers={[tag(p)]}>
                  {PROFESSION_LABELS[p]}
                </Text>
              ))}
            </Picker>
            <Picker
              label="Experience"
              modifiers={[pickerStyle("menu"), tint("#c11b5c")]}
              selection={form.experienceLevel}
              onSelectionChange={(value) =>
                setExperienceLevel(value as ExperienceLevel)
              }
            >
              {EXPERIENCE_LEVELS.map((level) => (
                <Text key={level.tag} modifiers={[tag(level.tag)]}>
                  {level.label}
                </Text>
              ))}
            </Picker>
          </Section>
        </Form>

        <Host
          modifiers={[animation(Animation.default, form.durationMinutes)]}
          // style={{ backgroundColor: "red" }}
          pointerEvents="none"
        >
          <Text
            modifiers={[
              font({ weight: "semibold", size: 56 }),
              foregroundStyle("#c11b5c"),
              contentTransition("numericText", { countsDown: true }),
              animation(Animation.default, form.durationMinutes),
            ]}
          >
            {formatMinutes(form.durationMinutes)}
          </Text>
        </Host>
      </Host>
      <View
        style={{
          paddingHorizontal: 35,
          alignSelf: "center",
          flex: 1,
          marginTop: -100,
        }}
      >
        <AnimatedSlider
          min={2}
          max={20}
          itemGap={15}
          sigma={4}
          onChange={(v) => setDurationMinutes(Math.round(v))}
        />
      </View>
    </>
  );
}
