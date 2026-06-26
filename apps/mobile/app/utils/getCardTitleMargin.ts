export const getCardTitleMargin = (
  cardLength: number,
  marginFactor = 6,
): number => {
  return cardLength * marginFactor;
};
