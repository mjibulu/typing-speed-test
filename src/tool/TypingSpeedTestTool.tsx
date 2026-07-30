import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Shuffle } from "lucide-react";
import { DownloadButton } from "../components/DownloadButton";
import { calculateTypingStats, isBetterTypingResult, type TypingBest, } from "../lib/public-tools/typing-speed";
const BESTS_STORAGE_KEY = "typing-speed-test:bests:v1";
const HISTORY_STORAGE_KEY = "typing-speed-test:history:v1";
const DURATIONS = [15, 30, 60, 120] as const;
const PASSAGE_FONT_SIZES = [
    { label: "16 px", value: "1rem" },
    { label: "18 px", value: "1.125rem" },
    { label: "20 px", value: "1.25rem" },
    { label: "24 px", value: "1.5rem" },
    { label: "28 px", value: "1.75rem" },
] as const;
const PASSAGE_HEIGHTS = ["Compact", "Comfortable", "Tall"] as const;
const DIFFICULTIES = {
    beginner: {
        label: "Beginner",
        description: "Common words and simple punctuation",
    },
    standard: {
        label: "Standard",
        description: "Natural prose with varied rhythm",
    },
    advanced: {
        label: "Advanced",
        description: "Numbers, symbols, and denser punctuation",
    },
} as const;
const SENTENCES: Record<Difficulty, readonly string[]> = {
    beginner: [
        "A calm start helps you find a steady pace.",
        "Keep your hands relaxed and look at the next word.",
        "Small steps can lead to strong results over time.",
        "Clear ideas are easier to read and remember.",
        "The warm sun moved slowly across the quiet room.",
        "Good habits grow when you practise them each day.",
        "Take a short breath and let accuracy guide you.",
        "Simple tools should make everyday work feel lighter.",
    ],
    standard: [
        "Clear writing begins with a simple idea, but careful revision gives that idea a useful shape.",
        "A quiet morning gives the mind room to work while small, consistent efforts build momentum.",
        "Technology is most useful when it removes friction and helps people finish the task at hand.",
        "The quickest route is not always a straight line; observation can reveal a better path.",
        "Practice builds confidence through repetition, patience, and attention to an even rhythm.",
        "Useful feedback explains what changed without distracting you from the next decision.",
        "A well-organized workspace reduces hesitation and makes complex projects easier to resume.",
        "Accuracy creates a foundation for speed because fewer corrections preserve your flow.",
    ],
    advanced: [
        "At 09:45, the project lead asked, “Can we ship version 2.7 by Friday?”",
        "Measure twice: a 12.5% variance across 48 samples may indicate a deeper issue.",
        "The API returned status 429; retry after 1.5 seconds, then record the response.",
        "Files named report_v3.csv, notes-final.md, and image@2x.webp require different handling.",
        "Although the forecast improved, costs rose from £1,240 to £1,387.50 in Q3.",
        "Use Ctrl+Shift+P, select “Format Document,” and verify each changed line.",
        "A precise summary distinguishes cause, correlation, and coincidence; it does not blur them.",
        "Before launch, test widths of 320px, 768px, and 1440px across supported browsers.",
    ],
};
type TestPhase = "idle" | "running" | "finished";
type Difficulty = keyof typeof DIFFICULTIES;
type PersonalBests = Partial<Record<string, TypingBest>>;
interface TypingAttempt extends TypingBest {
    id: string;
    difficulty: Difficulty;
    corrections: number;
    completedPassage: boolean;
}
function loadJsonObject<T>(key: string, fallback: T): T {
    try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "");
        return parsed && typeof parsed === "object" ? (parsed as T) : fallback;
    }
    catch {
        return fallback;
    }
}
function isTypingBest(value: unknown): value is TypingBest {
    if (!value || typeof value !== "object")
        return false;
    const result = value as Partial<TypingBest>;
    return ([result.wpm, result.accuracy, result.errors, result.duration].every((number) => typeof number === "number" && Number.isFinite(number)) && typeof result.completedAt === "string");
}
function sanitizeBests(value: PersonalBests): PersonalBests {
    const sanitized: PersonalBests = {};
    for (const [key, result] of Object.entries(value)) {
        if (!isTypingBest(result))
            continue;
        sanitized[key] = {
            ...result,
            rawWpm: typeof result.rawWpm === "number" && Number.isFinite(result.rawWpm)
                ? result.rawWpm
                : result.wpm,
        };
    }
    return sanitized;
}
function isTypingAttempt(value: unknown): value is TypingAttempt {
    if (!isTypingBest(value))
        return false;
    const attempt = value as Partial<TypingAttempt>;
    return (typeof attempt.id === "string" &&
        typeof attempt.difficulty === "string" &&
        attempt.difficulty in DIFFICULTIES &&
        typeof attempt.corrections === "number" &&
        Number.isFinite(attempt.corrections) &&
        typeof attempt.rawWpm === "number" &&
        Number.isFinite(attempt.rawWpm) &&
        typeof attempt.completedPassage === "boolean");
}
function buildPassage(difficulty: Difficulty, duration: number, offset: number): string {
    const sentences = SENTENCES[difficulty];
    const minimumWords = Math.ceil((duration / 60) * 160) + 35;
    const selected: string[] = [];
    let wordCount = 0;
    let index = offset;
    while (wordCount < minimumWords) {
        const sentence = sentences[index % sentences.length];
        selected.push(sentence);
        wordCount += sentence.split(/\s+/u).length;
        index += 1;
    }
    return selected.join(" ");
}
function historyCsv(attempts: TypingAttempt[]): string {
    const rows = attempts.map((attempt) => [
        attempt.completedAt,
        attempt.duration,
        DIFFICULTIES[attempt.difficulty].label,
        attempt.wpm,
        attempt.rawWpm,
        attempt.accuracy,
        attempt.errors,
        attempt.corrections,
        attempt.completedPassage ? "yes" : "no",
    ].join(","));
    return [
        "completed_at,duration_seconds,difficulty,net_wpm,raw_wpm,accuracy_percent,uncorrected_errors,corrections,passage_completed",
        ...rows,
    ].join("\n");
}
export function TypingSpeedTestTool() {
    const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(30);
    const [difficulty, setDifficulty] = useState<Difficulty>("standard");
    const [passageIndex, setPassageIndex] = useState(0);
    const [input, setInput] = useState("");
    const [phase, setPhase] = useState<TestPhase>("idle");
    const [elapsedMs, setElapsedMs] = useState(0);
    const [corrections, setCorrections] = useState(0);
    const [bests, setBests] = useState<PersonalBests>({});
    const [history, setHistory] = useState<TypingAttempt[]>([]);
    const [newBest, setNewBest] = useState(false);
    const [focusMode, setFocusMode] = useState(false);
    const [passageFontSize, setPassageFontSize] = useState(2);
    const [passageHeight, setPassageHeight] = useState(1);
    const [notice, setNotice] = useState("");
    const startedAtRef = useRef(0);
    const inputRef = useRef("");
    const phaseRef = useRef<TestPhase>("idle");
    const passage = useMemo(() => buildPassage(difficulty, duration, passageIndex), [difficulty, duration, passageIndex]);
    const activeStats = useMemo(() => calculateTypingStats(passage, input, elapsedMs), [elapsedMs, input, passage]);
    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            setBests(sanitizeBests(loadJsonObject<PersonalBests>(BESTS_STORAGE_KEY, {})));
            const storedHistory = loadJsonObject<unknown>(HISTORY_STORAGE_KEY, []);
            setHistory(Array.isArray(storedHistory)
                ? storedHistory.filter(isTypingAttempt).slice(0, 10)
                : []);
        });
        return () => window.cancelAnimationFrame(frame);
    }, []);
    const bestKey = `${duration}:${difficulty}`;
    const finishTest = useCallback((finalInput: string, finalElapsed: number) => {
        if (phaseRef.current === "finished")
            return;
        phaseRef.current = "finished";
        setPhase("finished");
        setElapsedMs(finalElapsed);
        const stats = calculateTypingStats(passage, finalInput, finalElapsed);
        const candidate: TypingBest = {
            ...stats,
            duration,
            completedAt: new Date().toISOString(),
        };
        const completedPassage = finalInput.length >= passage.length;
        const existing = bests[bestKey] ??
            (difficulty === "standard" ? bests[String(duration)] : undefined);
        const improved = isBetterTypingResult(candidate, existing);
        setNewBest(improved);
        if (improved) {
            setBests((current) => {
                const next = { ...current, [bestKey]: candidate };
                try {
                    window.localStorage.setItem(BESTS_STORAGE_KEY, JSON.stringify(next));
                }
                catch {
                    // A completed test remains usable when storage is unavailable.
                }
                return next;
            });
        }
        setHistory((current) => {
            const attempt: TypingAttempt = {
                ...candidate,
                id: `${candidate.completedAt}-${duration}-${difficulty}`,
                difficulty,
                corrections,
                completedPassage,
            };
            const next = [attempt, ...current].slice(0, 10);
            try {
                window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
            }
            catch {
                // History is optional and the result remains visible.
            }
            return next;
        });
    }, [bestKey, bests, corrections, difficulty, duration, passage]);
    useEffect(() => {
        if (phase !== "running")
            return;
        const timer = window.setInterval(() => {
            const nextElapsed = Math.min(Date.now() - startedAtRef.current, duration * 1000);
            setElapsedMs(nextElapsed);
            if (nextElapsed >= duration * 1000)
                finishTest(inputRef.current, duration * 1000);
        }, 100);
        return () => window.clearInterval(timer);
    }, [duration, finishTest, phase]);
    const reset = useCallback((newPassage = false) => {
        phaseRef.current = "idle";
        setPhase("idle");
        setInput("");
        inputRef.current = "";
        setElapsedMs(0);
        setCorrections(0);
        setNewBest(false);
        setNotice("");
        if (newPassage)
            setPassageIndex((current) => current + 1);
    }, []);
    const handleInput = (value: string) => {
        if (phase === "finished")
            return;
        const nextValue = value.slice(0, passage.length);
        if (phase === "idle" && nextValue.length > 0) {
            startedAtRef.current = Date.now();
            phaseRef.current = "running";
            setPhase("running");
        }
        setInput(nextValue);
        inputRef.current = nextValue;
        setNotice("");
        if (nextValue.length === passage.length) {
            const finalElapsed = Math.max(1000, Date.now() - startedAtRef.current);
            finishTest(nextValue, finalElapsed);
        }
    };
    const clearLocalResults = () => {
        setBests({});
        setHistory([]);
        setNewBest(false);
        try {
            window.localStorage.removeItem(BESTS_STORAGE_KEY);
            window.localStorage.removeItem(HISTORY_STORAGE_KEY);
        }
        catch {
            // The UI still clears when storage access is unavailable.
        }
    };
    const remainingSeconds = Math.max(0, Math.ceil(duration - elapsedMs / 1000));
    const progress = Math.min(100, (elapsedMs / (duration * 1000)) * 100);
    const currentBest = bests[bestKey] ??
        (difficulty === "standard" ? bests[String(duration)] : undefined);
    const passageWords = passage.split(/\s+/u).length;
    return (<div className="typing-test">
      <section className="typing-setup" aria-labelledby="typing-setup-title">
        <div className="typing-setup-heading">
          <div>
            <h2 id="typing-setup-title">Test setup</h2>
            <p>
              The passage is sized for the selected duration, so fast typists do
              not run out of text.
            </p>
          </div>
          <button type="button" className="secondary-button" onClick={() => reset(true)} disabled={phase === "running"}>
            <Shuffle size={16} aria-hidden="true"/> New passage
          </button>
        </div>
        <div className="typing-toolbar">
          <div>
            <span className="control-label">Duration</span>
            <div className="segmented-control" role="group" aria-label="Test duration">
              {DURATIONS.map((value) => (<button key={value} type="button" className={duration === value ? "active" : ""} aria-pressed={duration === value} disabled={phase === "running"} onClick={() => {
                setDuration(value);
                reset();
            }}>
                  {value}s
                </button>))}
            </div>
          </div>
          <div>
            <span className="control-label">Difficulty</span>
            <div className="segmented-control" role="group" aria-label="Passage difficulty">
              {(Object.entries(DIFFICULTIES) as [
            Difficulty,
            (typeof DIFFICULTIES)[Difficulty]
        ][]).map(([value, option]) => (<button key={value} type="button" className={difficulty === value ? "active" : ""} aria-pressed={difficulty === value} disabled={phase === "running"} title={option.description} onClick={() => {
                setDifficulty(value);
                reset();
            }}>
                  {option.label}
                </button>))}
            </div>
          </div>
          <label className="checkbox-option typing-focus-toggle">
            <input type="checkbox" checked={focusMode} onChange={(event) => setFocusMode(event.target.checked)}/>
            <span>
              <strong>Focus mode</strong>
              <small>Hide live scores while typing</small>
            </span>
          </label>
        </div>
      </section>

      <div className="typing-progress" role="progressbar" aria-label={`${remainingSeconds} seconds remaining`} aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.round(elapsedMs / 1000)}>
        <div>
          <span>
            {phase === "finished"
            ? "Complete"
            : phase === "idle"
                ? "Ready"
                : "Time left"}
          </span>
          <strong>{remainingSeconds}s</strong>
        </div>
        <div className="typing-progress-track" aria-hidden="true">
          <span style={{ width: `${progress}%` }}/>
        </div>
        <span className="typing-passage-size">
          {passageWords} words prepared
        </span>
      </div>

      <div className="typing-passage-panel">
        <div className="typing-passage-toolbar">
          <div>
            <strong>Passage</strong>
            <span>Scroll only when you choose to.</span>
          </div>
          <div className="typing-display-controls">
            <div className="typing-display-control">
              <label htmlFor="typing-font-size">Font size</label>
              <select id="typing-font-size" value={passageFontSize} onChange={(event) => setPassageFontSize(Number(event.target.value))} aria-describedby="typing-font-size-help">
                {PASSAGE_FONT_SIZES.map((size, index) => (<option value={index} key={size.label}>
                    {size.label}
                  </option>))}
              </select>
              <span id="typing-font-size-help" className="sr-only">
                Changes the text size in both typing areas.
              </span>
            </div>
            <div className="typing-display-control">
              <label htmlFor="typing-reading-height">
                Reading area height
              </label>
              <select id="typing-reading-height" value={passageHeight} onChange={(event) => setPassageHeight(Number(event.target.value))}>
                {PASSAGE_HEIGHTS.map((height, index) => (<option value={index} key={height}>
                    {height}
                  </option>))}
              </select>
            </div>
          </div>
        </div>
        <div className={`typing-passage passage-height-${passageHeight}`} style={{ fontSize: PASSAGE_FONT_SIZES[passageFontSize].value }} aria-label="Text to type" tabIndex={0}>
          {Array.from(passage).map((character, index) => {
            const className = index >= input.length
                ? index === input.length
                    ? "current"
                    : ""
                : input[index] === character
                    ? "correct"
                    : "incorrect";
            return (<span className={className} key={`${index}-${character}`}>
                {character}
              </span>);
        })}
        </div>
      </div>

      <label className="typing-input-label" htmlFor="typing-input">
        <span>
          {phase === "idle"
            ? "Start typing to begin the timer"
            : phase === "finished"
                ? "Completed typing"
                : "Your typing"}
        </span>
        <textarea id="typing-input" value={input} style={{ fontSize: PASSAGE_FONT_SIZES[passageFontSize].value }} onChange={(event) => handleInput(event.target.value)} onKeyDown={(event) => {
            if (phase === "running" &&
                (event.key === "Backspace" || event.key === "Delete")) {
                setCorrections((current) => current + 1);
            }
        }} onPaste={(event) => {
            event.preventDefault();
            setNotice("Pasting is disabled so the result reflects keyboard typing.");
        }} disabled={phase === "finished"} rows={4} autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="Start typing here…"/>
      </label>
      {notice ? (<p className="typing-notice" role="status">
          {notice}
        </p>) : null}

      {!(focusMode && phase === "running") ? (<div className="typing-results" aria-label="Typing results">
          <div>
            <span>Net WPM</span>
            <strong>{activeStats.wpm}</strong>
          </div>
          <div>
            <span>Raw WPM</span>
            <strong>{activeStats.rawWpm}</strong>
          </div>
          <div>
            <span>Accuracy</span>
            <strong>{activeStats.accuracy}%</strong>
          </div>
          <div>
            <span>Errors</span>
            <strong>{activeStats.errors}</strong>
          </div>
          <div>
            <span>Corrections</span>
            <strong>{corrections}</strong>
          </div>
        </div>) : (<p className="typing-focus-message">
          Live scores are hidden. Keep your attention on the passage.
        </p>)}

      <div className="typing-summary" aria-live={phase === "finished" ? "polite" : "off"}>
        <div>
          <h2>
            {phase === "finished"
            ? newBest
                ? "New personal best"
                : "Test complete"
            : "Personal best for this setup"}
          </h2>
          {currentBest ? (<p>
              Your best {duration}-second{" "}
              {DIFFICULTIES[difficulty].label.toLowerCase()} test is{" "}
              <strong>{currentBest.wpm} net WPM</strong> at{" "}
              <strong>{currentBest.accuracy}% accuracy</strong>. Stored only on
              this device.
            </p>) : (<p>
              Complete this setup to save your first personal best on this
              device.
            </p>)}
        </div>
        <button type="button" className="secondary-button" onClick={() => reset()}>
          <RotateCcw size={16} aria-hidden="true"/> Restart
        </button>
      </div>

      <section className="typing-history" aria-labelledby="typing-history-title">
        <div className="typing-history-heading">
          <div>
            <h2 id="typing-history-title">Recent attempts</h2>
            <p>
              Your latest 10 completed tests are stored only in this browser.
            </p>
          </div>
          <div className="button-group">
            <DownloadButton content={history.length ? historyCsv(history) : ""} filename="typing-test-history.csv" mimeType="text/csv;charset=utf-8" toolSlug="typing-speed-test">
              Download .csv
            </DownloadButton>
            <button type="button" className="secondary-button" onClick={clearLocalResults} disabled={!history.length && !Object.keys(bests).length}>
              Clear results
            </button>
          </div>
        </div>
        {history.length ? (<div className="typing-history-table-wrap">
            <table className="typing-history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Setup</th>
                  <th>Net WPM</th>
                  <th>Accuracy</th>
                  <th>Errors</th>
                  <th>Corrections</th>
                </tr>
              </thead>
              <tbody>
                {history.map((attempt) => (<tr key={attempt.id}>
                    <td>
                      {new Date(attempt.completedAt).toLocaleDateString()}
                    </td>
                    <td>
                      {attempt.duration}s ·{" "}
                      {DIFFICULTIES[attempt.difficulty]?.label ?? "Standard"}
                    </td>
                    <td>{attempt.wpm}</td>
                    <td>{attempt.accuracy}%</td>
                    <td>{attempt.errors}</td>
                    <td>{attempt.corrections}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>) : (<p className="empty-state">
            Complete a test to start your attempt history.
          </p>)}
      </section>
    </div>);
}
