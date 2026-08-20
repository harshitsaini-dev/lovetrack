/**
 * Per-capture challenge phrase.
 *
 * A prerecorded clip cannot know today's words, so holding up or saying the
 * phrase raises the cost of replaying old footage. It is a deterrent, not
 * proof — nothing here verifies that the phrase was actually shown; that
 * would need liveness detection, which is out of scope.
 *
 * Deterministic per user per day, so the phrase does not change if the page
 * is refreshed mid-capture.
 */

const COLOURS = [
  "BLUE",
  "ROSE",
  "GREEN",
  "AMBER",
  "VIOLET",
  "CORAL",
  "TEAL",
  "INDIGO",
];

const NOUNS = [
  "ROSE",
  "MOON",
  "RIVER",
  "STAR",
  "CLOUD",
  "FLAME",
  "STONE",
  "WAVE",
];

/** Small, stable string hash — not cryptographic, just for picking words. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function getChallengePhrase(userId: string, date: string): string {
  const h = hash(`${userId}:${date}`);

  const colour = COLOURS[h % COLOURS.length];
  const noun = NOUNS[Math.floor(h / COLOURS.length) % NOUNS.length];
  const number = (h % 90) + 10;

  return `${colour} ${noun} ${number}`;
}
