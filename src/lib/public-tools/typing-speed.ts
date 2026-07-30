export interface TypingStats {
  typedCharacters: number;
  correctCharacters: number;
  errors: number;
  accuracy: number;
  wpm: number;
  rawWpm: number;
}

export interface TypingBest extends TypingStats {
  duration: number;
  completedAt: string;
}

export function typingErrorDistance(target: string, input: string): number {
  if (!input) return 0;

  const targetCharacters = Array.from(target);
  const inputCharacters = Array.from(input);
  const maximumShift = Math.min(
    12,
    Math.max(3, Math.ceil(inputCharacters.length * 0.08)),
  );
  const shortestPrefix = Math.max(1, inputCharacters.length - maximumShift);
  const longestPrefix = Math.min(
    targetCharacters.length,
    inputCharacters.length + maximumShift,
  );
  const expected = targetCharacters.slice(0, longestPrefix);
  let previous = Array.from({ length: expected.length + 1 }, (_, index) =>
    index <= maximumShift ? index : Number.POSITIVE_INFINITY,
  );

  for (
    let inputIndex = 1;
    inputIndex <= inputCharacters.length;
    inputIndex += 1
  ) {
    const current = Array<number>(expected.length + 1).fill(
      Number.POSITIVE_INFINITY,
    );
    if (inputIndex <= maximumShift) current[0] = inputIndex;

    const firstTargetIndex = Math.max(1, inputIndex - maximumShift);
    const lastTargetIndex = Math.min(
      expected.length,
      inputIndex + maximumShift,
    );

    for (
      let targetIndex = firstTargetIndex;
      targetIndex <= lastTargetIndex;
      targetIndex += 1
    ) {
      current[targetIndex] = Math.min(
        (current[targetIndex - 1] ?? Number.POSITIVE_INFINITY) + 1,
        (previous[targetIndex] ?? Number.POSITIVE_INFINITY) + 1,
        (previous[targetIndex - 1] ?? Number.POSITIVE_INFINITY) +
          (inputCharacters[inputIndex - 1] === expected[targetIndex - 1]
            ? 0
            : 1),
      );
    }

    previous = current;
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  for (
    let prefixLength = shortestPrefix;
    prefixLength <= longestPrefix;
    prefixLength += 1
  ) {
    bestDistance = Math.min(
      bestDistance,
      previous[prefixLength] ?? Number.POSITIVE_INFINITY,
    );
  }

  return Math.min(
    inputCharacters.length,
    Number.isFinite(bestDistance) ? bestDistance : inputCharacters.length,
  );
}

export function calculateTypingStats(
  target: string,
  input: string,
  elapsedMs: number,
): TypingStats {
  const typedCharacters = Array.from(input).length;
  const errors = typingErrorDistance(target, input);
  const correctCharacters = Math.max(0, typedCharacters - errors);
  const elapsedMinutes = Math.max(elapsedMs, 1000) / 60_000;

  return {
    typedCharacters,
    correctCharacters,
    errors,
    accuracy:
      typedCharacters === 0
        ? 100
        : Math.round((correctCharacters / typedCharacters) * 100),
    wpm: Math.max(
      0,
      Math.round(correctCharacters / 5 / elapsedMinutes),
    ),
    rawWpm: Math.max(0, Math.round(typedCharacters / 5 / elapsedMinutes)),
  };
}

export function isBetterTypingResult(
  candidate: TypingBest,
  current?: TypingBest,
): boolean {
  if (!current) return true;
  if (candidate.wpm !== current.wpm) return candidate.wpm > current.wpm;
  if (candidate.accuracy !== current.accuracy) {
    return candidate.accuracy > current.accuracy;
  }
  return candidate.errors < current.errors;
}
