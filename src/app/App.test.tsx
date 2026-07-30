import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import { App } from "./App";

describe("Typing Speed Test", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts from typing and exposes reading controls", async () => {
    const user = userEvent.setup();
    render(<App />);

    const passage = screen.getByLabelText("Text to type");
    const input = screen.getByRole("textbox", {
      name: "Start typing to begin the timer",
    });
    passage.scrollTop = 40;

    await user.selectOptions(screen.getByLabelText("Font size"), "2");
    await user.selectOptions(screen.getByLabelText("Reading area height"), "2");
    fireEvent.change(input, { target: { value: "The " } });

    expect(input).toHaveStyle({ fontSize: "1.25rem" });
    expect(passage).toHaveClass("passage-height-2");
    expect(passage.scrollTop).toBe(40);
    expect(screen.getByText("Time left")).toBeInTheDocument();
  });

  it("changes setup and blocks pasted results", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "15s" }));
    await user.click(screen.getByRole("button", { name: "Advanced" }));
    const input = screen.getByRole("textbox", {
      name: "Start typing to begin the timer",
    });
    fireEvent.paste(input, {
      clipboardData: { getData: () => "pasted text" },
    });

    expect(
      screen.getByText(/Pasting is disabled/u),
    ).toBeInTheDocument();
  });

  it("finishes at the selected deadline and records the attempt", () => {
    vi.useFakeTimers();
    render(<App />);
    act(() => {
      vi.advanceTimersByTime(20);
    });

    fireEvent.click(screen.getByRole("button", { name: "15s" }));
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Start typing to begin the timer",
      }),
      { target: { value: "The quick" } },
    );
    act(() => {
      vi.advanceTimersByTime(15_100);
    });

    expect(screen.getByText(/Test complete|New personal best/u)).toBeInTheDocument();
    expect(
      JSON.parse(
        window.localStorage.getItem(
          "typing-speed-test:history:v1",
        ) ?? "[]",
      ),
    ).toHaveLength(1);
  });

  it("recovers only the latest ten valid history entries", async () => {
    const history = Array.from({ length: 12 }, (_, index) => ({
      id: `attempt-${index}`,
      duration: 30,
      completedAt: new Date(2026, 0, index + 1).toISOString(),
      difficulty: "standard",
      corrections: index,
      completedPassage: false,
      typedCharacters: 100,
      correctCharacters: 95,
      errors: 5,
      accuracy: 95,
      wpm: 40 + index,
      rawWpm: 45 + index,
    }));
    window.localStorage.setItem(
      "typing-speed-test:history:v1",
      JSON.stringify([...history, { broken: true }]),
    );
    render(<App />);

    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(11);
  });
});
