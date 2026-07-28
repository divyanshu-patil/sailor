import { Delivery, DeliveryLike } from "@/types/presentation/card";

/**
 * One emoji per delivery style, covering every value the API can send.
 *
 * The previous map had eight of the thirty-two and was typed against an equally
 * short local union — so a card with any other delivery indexed to `undefined`
 * and rendered the literal string "undefined" beside the label. Both were the
 * same problem: the client's idea of the enum had drifted from the server's.
 * Typing this `Record<Delivery, string>` against the real union is what keeps
 * it from drifting again — adding a value to the enum now fails the build here
 * until it has an emoji.
 */
const DELIVERY_EMOJIS: Record<Delivery, string> = {
  // core
  dramatic: "🎭",
  confident: "💪",
  explaining: "🧠",
  curious: "🤔",
  storytelling: "📖",
  energetic: "⚡",
  pause: "⏸️",
  // teaching
  educational: "🎓",
  analytical: "📊",
  step_by_step: "🪜",
  technical: "⚙️",
  // presentation
  introduction: "👋",
  summary: "📝",
  conclusion: "🏁",
  transition: "🔀",
  emphasis: "❗",
  // tone
  friendly: "😊",
  casual: "🙂",
  formal: "🎩",
  professional: "💼",
  inspirational: "✨",
  motivational: "🔥",
  persuasive: "🎯",
  humorous: "😄",
  // pace
  calm: "🌿",
  serious: "🧿",
  excited: "🎉",
  urgent: "🚨",
  reflective: "🪞",
  // interaction
  questioning: "❓",
  interactive: "🙌",
  thought_provoking: "💡",
};

/** Shown for a delivery this build doesn't know — a value added server-side
 *  since it shipped. A generic marker beats "undefined" on screen. */
const FALLBACK_EMOJI = "🎙️";

export const getDeliveryEmoji = (delivery: DeliveryLike): string =>
  DELIVERY_EMOJIS[delivery as Delivery] ?? FALLBACK_EMOJI;

/** `step_by_step` → `step by step`. The stored value is snake_case; rendering it
 *  raw beside the emoji leaks the wire format into the UI. */
export const formatDelivery = (delivery: DeliveryLike): string =>
  String(delivery).replace(/_/g, " ");
