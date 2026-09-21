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
import { haptics } from "@/lib/haptics";
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

/**
 * FLIP ANIMATION CONSTANTS
 */
const FLIP_ROTATION = 180;
const FLIP_SPRING_CONFIG = {
  damping: 70,
};
const PERSPECTIVE = 1000;

/**
 * Long-press timing for the flip gesture.
 */
const FLIP_MIN_DURATION_MS = 350;

/**
 * How far the finger can drift during the hold
 * before we treat it as a swipe instead of a
 * long press, and bail out.
 *
 * Keep this SMALL and this must stay a single
 * gesture.
 */
const FLIP_MAX_DISTANCE = 10;

const Card = React.memo(
  ({
    text,
    reveal,
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

    /**
     * Derived-state sync of `text` prop -> `localText`.
     */
    const [prevText, setPrevText] = useState(text);

    if (text !== prevText) {
      setPrevText(text);
      setLocalText(text);
    }

    /**
     * Normal ref used for focus/blur
     * on the JS thread.
     */
    const inputRef = useRef<TextInput>(null);

    /**
     * Animated ref used by Reanimated
     * measure() on the UI thread.
     */
    const animatedInputRef = useAnimatedRef<TextInput>();

    /**
     * Animated ref for the edit button wrapper.
     */
    const editButtonRef = useAnimatedRef<Animated.View>();

    const editScale = useSharedValue(1);

    /**
     * One shared rotation controls both
     * complete card surfaces.
     */
    const flipRotation = useSharedValue(0);

    /** Whether the long press actually activated — see `onFinalize` below. */
    const didFlip = useSharedValue(false);

    /**
     * Keyboard animation shared value.
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
     * ----------------------------------------------------
     * START EDITING
     * ----------------------------------------------------
     */
    const startEditing = () => {
      haptics.editStart();
      setDraftText(localText);
      setIsEditing(true);

      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    };

    /**
     * ----------------------------------------------------
     * COMMIT EDITING
     * ----------------------------------------------------
     */
    const commitEditing = () => {
      inputRef.current?.blur();
      setIsEditing(false);

      if (draftText.trim().length > 0 && draftText !== localText) {
        // Only when something actually changed. Blurring out of an untouched
        // field is a dismissal, and acknowledging a save that did not happen
        // is worse than staying quiet.
        haptics.editCommit();
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
     */
    const editButtonKeyboardStyle = useAnimatedStyle(() => {
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

      const keyboardTop = screenHeight + keyboardHeight.value;

      const buttonBottom = button.pageY + button.height;

      const safeBottom = keyboardTop - BUTTON_KEYBOARD_GAP;

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
     * MAIN CARD POSITION / SWIPE ANIMATION
     * ----------------------------------------------------
     *
     * IMPORTANT:
     *
     * This animation controls the CARD POSITION,
     * not the flip itself.
     *
     * The flip is handled by frontCardStyle
     * and backCardStyle below.
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
         */
        if (isEditing && keyboardHeight.value < 0) {
          const input = measure(animatedInputRef);

          if (input) {
            const keyboardTop = screenHeight + keyboardHeight.value;

            const inputBottom = input.pageY + input.height;

            const safeBottom = keyboardTop - KEYBOARD_TEXT_GAP;

            const overlap = inputBottom - safeBottom;

            if (overlap > 0) {
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

    /**
     * ----------------------------------------------------
     * WHOLE FRONT CARD FLIP
     * ----------------------------------------------------
     *
     * The FRONT surface contains:
     *
     * - colored background
     * - text
     * - edit button
     *
     * Everything rotates together.
     *
     * 0deg -> 180deg
     */
    const frontCardStyle = useAnimatedStyle(() => {
      const isBackHalf = flipRotation.value > 90;

      return {
        transform: [
          {
            perspective: PERSPECTIVE,
          },
          {
            rotateY: `${flipRotation.value}deg`,
          },
        ],
        opacity: isBackHalf ? 0 : 1,
        zIndex: isBackHalf ? 0 : 1,
      };
    });

    /**
     * ----------------------------------------------------
     * WHOLE BACK CARD FLIP
     * ----------------------------------------------------
     *
     * The BACK surface is already conceptually
     * facing the opposite direction.
     *
     * At:
     *
     * flipRotation = 0
     *     rotateY = -180deg
     *
     * At:
     *
     * flipRotation = 180
     *     rotateY = 0deg
     *
     * This means the reveal is right-side-up
     * when the card finishes flipping.
     */
    const backCardStyle = useAnimatedStyle(() => {
      const isBackHalf = flipRotation.value > 90;

      return {
        transform: [
          {
            perspective: PERSPECTIVE,
          },
          {
            rotateY: `${flipRotation.value - 180}deg`,
          },
        ],
        opacity: isBackHalf ? 1 : 0,
        zIndex: isBackHalf ? 1 : 0,
      };
    });

    const inputTextColor = colord(color).darken(0.4).desaturate(0.3).toHex();

    /**
     * ----------------------------------------------------
     * KEYBOARD DISMISS GESTURE
     * ----------------------------------------------------
     *
     * UNCHANGED.
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

    /**
     * ----------------------------------------------------
     * HOLD-TO-REVEAL FLIP GESTURE
     * ----------------------------------------------------
     *
     * UNCHANGED.
     *
     * This remains a SINGLE LongPress gesture so it
     * doesn't interfere with the parent's swipe gesture.
     */
    const flipGesture = Gesture.LongPress()
      .minDuration(FLIP_MIN_DURATION_MS)
      .maxDistance(FLIP_MAX_DISTANCE)
      .onStart(() => {
        didFlip.value = true;
        // An opening rather than a hit — the card is unfolding, not landing.
        haptics.reveal();
        flipRotation.value = withSpring(FLIP_ROTATION, FLIP_SPRING_CONFIG);
      })
      .onFinalize(() => {
        // onFinalize runs whether or not the long press ever activated, so a
        // plain tap or a swipe that started on the card lands here too. Without
        // this latch every one of those would play the closing cue for a card
        // that never opened.
        if (!didFlip.value) return;
        didFlip.value = false;
        haptics.conceal();
        flipRotation.value = withSpring(0, FLIP_SPRING_CONFIG);
      });

    return (
      <Animated.View
        style={[
          /**
           * The outer view is now ONLY the positioning
           * and swipe layer.
           *
           * There is intentionally NO backgroundColor here.
           */
          styles.card,
          {
            zIndex,
          },
          animatedStyle,
        ]}
      >
        <GestureDetector gesture={flipGesture}>
          <Animated.View collapsable={false} style={styles.flipContainer}>
            {/* ================================================= */}
            {/* FRONT — ENTIRE COLORED CARD */}
            {/* ================================================= */}

            <Animated.View
              collapsable={false}
              style={[
                styles.cardFace,
                {
                  backgroundColor: color,
                },
                frontCardStyle,
              ]}
            >
              {isEditing ? (
                <GestureDetector gesture={dismissKeyboardGesture}>
                  <TextInput
                    ref={(node) => {
                      inputRef.current = node;

                      /**
                       * Attach the same native TextInput
                       * to Reanimated's animated ref.
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

            {/* ================================================= */}
            {/* BACK — ENTIRE COLORED CARD */}
            {/* ================================================= */}

            <Animated.View
              collapsable={false}
              style={[
                styles.cardFace,
                {
                  backgroundColor: color,
                },
                backCardStyle,
              ]}
            >
              <ScriptLine line={reveal} color={color} />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
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
    /**
     * OUTER POSITIONING CONTAINER
     *
     * This is deliberately transparent.
     *
     * Swipe / stack transforms are applied here.
     */
    card: {
      width: CARD_WIDTH,
      position: "absolute",
      aspectRatio: 0.75,
      justifyContent: "center",
      alignItems: "center",
    },

    /**
     * Container holding the two opposite-facing
     * complete card surfaces.
     */
    flipContainer: {
      width: "100%",
      height: "100%",
    },

    /**
     * COMPLETE CARD SURFACE
     *
     * The background color lives here now.
     *
     * Therefore:
     *
     * ┌─────────────────────┐
     * │                     │
     * │       TEXT          │
     * │                     │
     * │              EDIT   │
     * │                     │
     * └─────────────────────┘
     *
     * rotates as ONE object.
     */
    cardFace: {
      position: "absolute",
      width: "100%",
      height: "100%",

      borderRadius: 77,

      justifyContent: "center",
      alignItems: "center",

      paddingHorizontal: 24,

      backfaceVisibility: "hidden",
    },

    input: {
      width: "100%",
      fontFamily: fonts.amarna.regular,
      fontSize: 30,
      textAlign: "center",
    },

    /**
     * Edit button wrapper owns the absolute position.
     *
     * This is still measured for keyboard collision.
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
