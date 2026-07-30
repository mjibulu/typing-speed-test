import {
  calculateTypingStats,
  isBetterTypingResult,
  typingErrorDistance,
  type TypingBest,
} from "../typing-speed";

describe("public typing-speed utilities", () => {
  it("calculates WPM, accuracy, and character errors", () => {
    expect(calculateTypingStats("hello world", "hello worlx", 60_000)).toEqual({
      typedCharacters: 11,
      correctCharacters: 10,
      errors: 1,
      accuracy: 91,
      wpm: 2,
      rawWpm: 2,
    });
  });

  it("does not cascade insertion and omission errors", () => {
    expect(typingErrorDistance("hello world again", "helo world again")).toBe(
      1,
    );
    expect(typingErrorDistance("hello world again", "helllo world again")).toBe(
      1,
    );
  });

  it("handles empty and Unicode input by code point", () => {
    expect(calculateTypingStats("hello", "", 0)).toMatchObject({
      typedCharacters: 0,
      errors: 0,
      accuracy: 100,
      wpm: 0,
    });
    expect(calculateTypingStats("🙂a", "🙂a", 60_000)).toMatchObject({
      typedCharacters: 2,
      correctCharacters: 2,
      errors: 0,
      accuracy: 100,
    });
  });

  it("breaks personal-best ties by accuracy and then errors", () => {
    const current: TypingBest = {
      duration: 30,
      wpm: 50,
      accuracy: 95,
      errors: 3,
      typedCharacters: 130,
      correctCharacters: 124,
      rawWpm: 52,
      completedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(isBetterTypingResult({ ...current, accuracy: 97 }, current)).toBe(
      true,
    );
    expect(
      isBetterTypingResult(
        { ...current, accuracy: 94, errors: 1 },
        current,
      ),
    ).toBe(false);
  });
});
