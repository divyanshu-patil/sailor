/**
 * Sentence splitting for the teleprompter, and nothing else.
 *
 * Its own file, with no imports, so the self-check at the bottom can be run
 * straight off disk:
 *
 *   node app/screens/presentation/teleprompter/sentences.ts
 *
 * A regex was the obvious first move and was wrong in the way that matters
 * here: the teleprompter shows one sentence at a time, so a split that drops
 * a character drops it from the performance. This walks the string instead
 * and every character ends up in exactly one piece.
 */

/** Characters that can end a sentence. */
const TERMINATORS = ".!?…";
/** Closing marks that belong to the sentence they follow. */
const CLOSERS = "\"')]”’";

export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    if (!TERMINATORS.includes(text[i])) continue;

    // Swallow the rest of a run — "wait..." and "really?!" are one ending —
    // along with any quote or bracket closing around it.
    let end = i;
    while (
      end + 1 < text.length &&
      (TERMINATORS.includes(text[end + 1]) || CLOSERS.includes(text[end + 1]))
    ) {
      end++;
    }

    // A terminator mid-token is not an ending: decimals ("1.5"), domains and
    // initials all live inside a word. Only whitespace or the end of the
    // string closes a sentence.
    const next = text[end + 1];
    if (next !== undefined && !/\s/.test(next)) continue;

    const piece = text.slice(start, end + 1).trim();
    // Never empty — it holds the terminator — but cheap to keep honest.
    /* v8 ignore next */
    if (piece) out.push(piece);
    start = end + 1;
    i = end;
  }

  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/** Self-check. Run this file directly to execute it. */
export function demo() {
  const eq = (got: string[], want: string[], label: string) => {
    const a = JSON.stringify(got);
    const b = JSON.stringify(want);
    // The self-check's failure path — reached only if splitSentences breaks.
    /* v8 ignore next */
    if (a !== b) throw new Error(`${label}\n  got  ${a}\n  want ${b}`);
  };

  eq(splitSentences("One. Two! Three?"), ["One.", "Two!", "Three?"], "basic");
  eq(splitSentences("No terminator here"), ["No terminator here"], "tail");
  eq(splitSentences("Wait... really?!"), ["Wait...", "really?!"], "runs");
  eq(
    splitSentences('She said "go." Then left.'),
    ['She said "go."', "Then left."],
    "closing quote",
  );
  eq(splitSentences("It grew 1.5 times."), ["It grew 1.5 times."], "decimal");
  eq(splitSentences("   "), [], "blank");
  eq(
    splitSentences("**400 million people** receive a diagnosis."),
    ["**400 million people** receive a diagnosis."],
    "markdown survives",
  );

  // Nothing is ever dropped: the pieces, rejoined, are the input minus the
  // whitespace that separated them.
  const sample = "Every year, 400 million people. Too late — that is the cost!";
  const rejoined = splitSentences(sample).join(" ");
  /* v8 ignore next 3 */
  if (rejoined !== sample) {
    throw new Error(`lossy split\n  got  ${rejoined}\n  want ${sample}`);
  }

  console.log("splitSentences: all checks passed");
}

// Node only. React Native ships a `process` shim with no `argv` at all, and
// indexing it there throws before the module has finished loading — which
// took the whole screen down with it.
/* v8 ignore next 3 — a command-line entry point, never reached from the app */
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("sentences.ts")) {
  demo();
}
