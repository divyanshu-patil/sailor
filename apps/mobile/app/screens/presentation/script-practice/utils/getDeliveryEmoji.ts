import { Delivery } from "../components/Card";

const DELIVERY_EMOJIS: Record<Delivery, string> = {
  energetic: "⚡",
  confident: "💪",
  explaining: "🧠",
  curious: "🤔",
  dramatic: "🎭",
  gentle: "🌿",
  storytelling: "📖",
  pause: "⏸️",
};

export const getDeliveryEmoji = (delivery: Delivery) =>
  DELIVERY_EMOJIS[delivery];
