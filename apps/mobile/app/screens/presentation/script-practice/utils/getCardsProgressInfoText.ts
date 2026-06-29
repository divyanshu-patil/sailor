interface CardsProgressInfoTextArgs {
  currentIndex: number;
  totalCards: number;
}
export const getCardsProgressInfoText = ({
  currentIndex,
  totalCards,
}: CardsProgressInfoTextArgs) => {
  if (currentIndex === totalCards) {
    return "End";
  }
  return `${currentIndex + 1}/${totalCards}`;
};
