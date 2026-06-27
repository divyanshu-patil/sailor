export function getRandomIntExclusive(start: number, end: number) {
  return Math.floor(Math.random() * (end - start)) + start;
}
export function getRandomIntInclusive(start: number, end: number) {
  return Math.floor(Math.random() * (end - start + 1)) + start;
}
