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
  const { form, setDurationMinutes, setAudienceIndex } = usePresentationForm();

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
          max={60}
          // itemGap={15}
          // sigma={3}
          onChange={(v) => setDurationMinutes(Math.round(v))}
        />
      </View>
    </>
  );
}
