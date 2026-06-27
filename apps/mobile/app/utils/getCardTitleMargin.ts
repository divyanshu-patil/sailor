export const getCardTitleMargin = (
  cardLength: number,
  max?: number,
  marginFactor = 2,
): number => {
  return Math.min(cardLength * marginFactor, 150);
};
