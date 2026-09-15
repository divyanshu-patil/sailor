import { StyleSheet, TextInput, useWindowDimensions } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  measure,
  SharedValue,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { ScriptLine } from "../../script-text/ScriptLine";
import { getNormalCardTransform, MAX_ROTATION } from "../utils/cardMath";
import Lucide from "@react-native-vector-icons/lucide";
import { AnimatedPressable } from "@/components/ui/animated/AnimatedComponents";
import { fonts } from "@/constants/fonts";
import { colord } from "colord";
import React, { useEffect, useRef, useState } from "react";
import type { DeliveryLike } from "@/types/presentation/card";
import {
  KeyboardController,
  useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";

export type { Delivery, DeliveryLike } from "@/types/presentation/card";

interface CardProps {
  text: string;
  reveal: string;
  color: string;
  impact: number;
  delivery: DeliveryLike;
  zIndex: number;
  index: number;
  currentIndexSV: SharedValue<number>;
  drag: {
    translateX: SharedValue<number>;
    translateY: SharedValue<number>;
    swipeDirection: SharedValue<"left" | "right" | null>;
  };
  prevDrag?: {
    translateX: SharedValue<number>;
    translateY: SharedValue<number>;
    opacity: SharedValue<number>;
  };
  introRotation?: SharedValue<number>;
  introScale?: SharedValue<number>;
  introOpacity?: SharedValue<number>;
  onChangeText?: (newText: string) => void;
}

/**
 * This is only used for the off-screen
 * "previous card" position.
 */
const RETURN_START_X = 1000;

/**
 * Small zoom while editing.
 *
 * Keep this small. A large scale makes
 * keyboard overlap much worse.
 */
const EDIT_ZOOM_SCALE = 1.08;

/**
 * How much breathing room we want between
 * the editable text and the keyboard.
 */
const KEYBOARD_TEXT_GAP = 24;

/**
 * How much breathing room we want between
 * the edit button and the keyboard.
 */
const BUTTON_KEYBOARD_GAP = 20;

/**
 * Minimum downward swipe required
 * to dismiss the keyboard.
 */
const KEYBOARD_DISMISS_SWIPE_DISTANCE = 40;

const Card = React.memo(
  ({
    text,
    color,
    index,
    currentIndexSV,
    drag,
    prevDrag,
    zIndex,
    introRotation,
    introScale,
    introOpacity,
    onChangeText,
  }: CardProps) => {
    const styles = useStyles();

    const [isEditing, setIsEditing] = useState(false);
    const [localText, setLocalText] = useState(text);
    const [draftText, setDraftText] = useState(text);

    useEffect(() => {
      setLocalText(text);
    }, [text]);

    /**
     * Normal ref is used for focus/blur
     * on the JS thread.
     */
    const inputRef = useRef<TextInput>(null);

    /**
     * Animated ref is used by Reanimated
     * measure() on the UI thread.
     */
    const animatedInputRef = useAnimatedRef<TextInput>();

    /**
     * Animated ref for the edit button wrapper.
     *
     * We measure the wrapper rather than the
     * AnimatedPressable itself.
     */
    const editButtonRef = useAnimatedRef<Animated.View>();

    const editScale = useSharedValue(1);

    /**
     * Keyboard animation shared value.
     *
     * IMPORTANT: `keyboardHeight.value` from
     * react-native-keyboard-controller is NOT
     * a plain positive height.
     *
     * It is 0 when the keyboard is closed and
     * goes NEGATIVE (e.g. -300) as it opens —
     * that's what makes `transform: [{ translateY: height.value }]`
     * slide something upward "for free" elsewhere in the app.
     *
     * So everywhere below:
     *   - "keyboard is open"   => keyboardHeight.value < 0
     *   - "keyboard is closed" => keyboardHeight.value >= 0
     *   - actual pixel height  => -keyboardHeight.value
     */
    const { height: keyboardHeight } = useReanimatedKeyboardAnimation();

    const { height: screenHeight } = useWindowDimensions();

    useEffect(() => {
      editScale.value = withSpring(isEditing ? EDIT_ZOOM_SCALE : 1, {
        damping: 70,
        stiffness: 500,
      });
    }, [editScale, isEditing]);

    /**
     * Start editing.
     */
    const startEditing = () => {
      setDraftText(localText);
      setIsEditing(true);

      /**
       * Wait until TextInput has mounted.
       */
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    };

    /**
     * Commit editing.
     */
    const commitEditing = () => {
      inputRef.current?.blur();
      setIsEditing(false);

      if (draftText.trim().length > 0 && draftText !== localText) {
        setLocalText(draftText);
        onChangeText?.(draftText);
      }
    };

    /**
     * ----------------------------------------------------
     * EDIT BUTTON KEYBOARD COLLISION
     * ----------------------------------------------------
     *
     * Only move the button if the button itself
     * is covered by the keyboard.
     *
     * If:
     *
     *     buttonBottom <= keyboardTop
     *
     * then:
     *
     *     translateY = 0
     *
     * Otherwise move it upward only by the
     * amount required to clear the keyboard.
     */
    const editButtonKeyboardStyle = useAnimatedStyle(() => {
      /**
       * keyboardHeight.value is 0 (closed) or
       * negative (open) — NOT positive. So "closed"
       * is >= 0, and "open" is < 0.
       */
      if (!isEditing || keyboardHeight.value >= 0) {
        return {
          transform: [{ translateY: 0 }],
        };
      }

      const button = measure(editButtonRef);

      if (!button) {
        return {
          transform: [{ translateY: 0 }],
        };
      }

      /**
       * Top edge of the keyboard in screen coordinates.
       *
       * keyboardHeight.value is already negative here,
       * so adding it is the same as subtracting the
       * actual (positive) keyboard height.
       */
      const keyboardTop = screenHeight + keyboardHeight.value;

      /**
       * Bottom edge of the button in screen coordinates.
       */
      const buttonBottom = button.pageY + button.height;

      /**
       * Keep a small gap between the button
       * and keyboard.
       */
      const safeBottom = keyboardTop - BUTTON_KEYBOARD_GAP;

      /**
       * Positive = button is covered.
       * Zero/negative = button is already safe.
       */
      const overlap = buttonBottom - safeBottom;

      return {
        transform: [
          {
            translateY: overlap > 0 ? -overlap : 0,
          },
        ],
      };
    });

    /**
     * ----------------------------------------------------
     * MAIN CARD ANIMATION
     * ----------------------------------------------------
     */
    const animatedStyle = useAnimatedStyle(() => {
      const depth = index - currentIndexSV.value;

      const introOffset = introRotation ? introRotation.value : 0;
      const baseScale = introScale ? introScale.value : 1;

      let opacity = introOpacity ? introOpacity.value : 1;

      let translateX = 0;
      let translateY = 0;
      let rotate = 0;

      /* -------------------------------- */
      /* Swiped-away cards */
      /* -------------------------------- */

      if (depth < 0) {
        const isPrev = depth === -1 && prevDrag !== undefined;

        translateX = isPrev ? prevDrag!.translateX.value : RETURN_START_X;

        translateY = isPrev ? prevDrag!.translateY.value : 0;

        const progress = interpolate(
          translateX,
          [0, RETURN_START_X],
          [0, 1],
          Extrapolation.CLAMP,
        );

        rotate = progress * MAX_ROTATION;

        if (!isPrev) {
          opacity = 0;
        }
      }

      /* -------------------------------- */
      /* Normal cards */
      /* -------------------------------- */
      else {
        const transform = getNormalCardTransform({
          currIndex: depth,
          dragTranslateX: drag.translateX.value,
          prevCardTranslateX: prevDrag?.translateX.value,
          returnStartX: RETURN_START_X,
        });

        translateX = transform.translateX;
        translateY = transform.translateY;
        rotate = transform.rotate;

        /**
         * --------------------------------
         * KEYBOARD → TEXT COLLISION
         * --------------------------------
         *
         * Do NOT do:
         *
         * translateY -= keyboardHeight
         *
         * because that moves the entire card
         * whenever the keyboard opens.
         *
         * Instead:
         *
         * 1. Measure the TextInput.
         * 2. Find the keyboard top.
         * 3. Check whether the TextInput is covered.
         * 4. Move only enough to reveal it.
         *
         * Same negative-height convention as above:
         * keyboard is open when keyboardHeight.value < 0.
         */
        if (isEditing && keyboardHeight.value < 0) {
          const input = measure(animatedInputRef);

          if (input) {
            /**
             * Keyboard top in screen coordinates.
             */
            const keyboardTop = screenHeight + keyboardHeight.value;

            /**
             * Bottom of the actual TextInput.
             */
            const inputBottom = input.pageY + input.height;

            /**
             * Desired safe bottom position
             * for the TextInput.
             */
            const safeBottom = keyboardTop - KEYBOARD_TEXT_GAP;

            /**
             * Positive = TextInput is underneath
             * the keyboard.
             */
            const overlap = inputBottom - safeBottom;

            if (overlap > 0) {
              /**
               * Move only enough to make the
               * TextInput visible.
               */
              translateY -= overlap;
            }
          }
        }
      }

      return {
        transform: [
          {
            translateX,
          },
          {
            translateY,
          },
          {
            rotate: `${rotate + introOffset}deg`,
          },
          {
            scale: baseScale * editScale.value,
          },
        ],
        opacity,
      };
    });

    /**
     * ----------------------------------------------------
     * EDIT BUTTON PRESS ANIMATION
     * ----------------------------------------------------
     */
    const pressed = useSharedValue(0);

    const pressedStyle = useAnimatedStyle(() => ({
      transform: [
        {
          scale: withTiming(pressed.value ? 0.97 : 1, {
            duration: 100,
          }),
        },
      ],
    }));

    const inputTextColor = colord(color).darken(0.4).desaturate(0.3).toHex();

    /**
     * Downward swipe on the input.
     *
     * This remains as a local fallback,
     * while ScriptPracticeScreen also has
     * the full-screen gesture.
     */
    const dismissKeyboardGesture = Gesture.Pan()
      .enabled(isEditing)
      .minDistance(10)
      .activeOffsetY(10)
      .failOffsetX([-20, 20])
      .onEnd((event) => {
        if (event.translationY > KEYBOARD_DISMISS_SWIPE_DISTANCE) {
          scheduleOnRN(KeyboardController.dismiss);
        }
      });

    return (
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: color,
            zIndex,
          },
          animatedStyle,
        ]}
      >
        {isEditing ? (
          <GestureDetector gesture={dismissKeyboardGesture}>
            <TextInput
              ref={(node) => {
                inputRef.current = node;

                /**
                 * Attach the same native TextInput
                 * to Reanimated's animated ref so
                 * measure(animatedInputRef) works.
                 */
                if (node) {
                  animatedInputRef(node);
                }
              }}
              collapsable={false}
              style={[
                styles.input,
                {
                  color: inputTextColor,
                },
              ]}
              value={draftText}
              onChangeText={setDraftText}
              onBlur={commitEditing}
              onSubmitEditing={commitEditing}
              multiline
              autoFocus
              selectionColor={inputTextColor}
              returnKeyType="done"
              blurOnSubmit
            />
          </GestureDetector>
        ) : (
          <ScriptLine line={localText} color={color} />
        )}

        {/*
         * ------------------------------------------------
         * EDIT / CHECK BUTTON
         * ------------------------------------------------
         *
         * This wrapper is what we measure.
         *
         * It only moves if it actually overlaps
         * the keyboard.
         *
         * collapsable={false} is required on Android:
         * without it, the view can get flattened away
         * by the native renderer and measure() returns
         * stale/incorrect coordinates.
         */}
        <Animated.View
          ref={editButtonRef}
          collapsable={false}
          style={[styles.editButtonContainer, editButtonKeyboardStyle]}
        >
          <AnimatedPressable
            style={[styles.editButton, pressedStyle]}
            onPressIn={() => {
              pressed.value = 1;
            }}
            onPressOut={() => {
              pressed.value = 0;
            }}
            onPress={() => (isEditing ? commitEditing() : startEditing())}
          >
            <Lucide
              name={isEditing ? "check" : "pen-line"}
              size={32}
              color="white"
            />
          </AnimatedPressable>
        </Animated.View>
      </Animated.View>
    );
  },
);

Card.displayName = "Card";

export default Card;

const useStyles = () => {
  const { width } = useWindowDimensions();

  /**
   * Keep your existing card dimensions.
   */
  const CARD_WIDTH = width - 48 * 2;

  return StyleSheet.create({
    card: {
      width: CARD_WIDTH,
      position: "absolute",
      aspectRatio: 0.75,
      borderRadius: 77,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },

    input: {
      width: "100%",
      fontFamily: fonts.amarna.regular,
      fontSize: 30,
      textAlign: "center",
    },

    /**
     * The wrapper owns the absolute position.
     *
     * The wrapper is also the element measured
     * for keyboard collision detection.
     */
    editButtonContainer: {
      position: "absolute",
      bottom: 30,
      right: 30,
    },

    editButton: {
      backgroundColor: "#414141",
      padding: 20,
      borderRadius: 24,
    },
  });
};
