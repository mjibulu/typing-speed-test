import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Shuffle } from "lucide-react";
import { useLocale, useTranslations } from "use-intl";
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
const PASSAGE_HEIGHTS = ["0", "1", "2"] as const;
const DIFFICULTIES = ["beginner", "standard", "advanced"] as const;
type TestPhase = "idle" | "running" | "finished";
type Difficulty = (typeof DIFFICULTIES)[number];
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
        (DIFFICULTIES as readonly string[]).includes(attempt.difficulty) &&
        typeof attempt.corrections === "number" &&
        Number.isFinite(attempt.corrections) &&
        typeof attempt.rawWpm === "number" &&
        Number.isFinite(attempt.rawWpm) &&
        typeof attempt.completedPassage === "boolean");
}
function buildPassage(sentences: readonly string[], duration: number, offset: number): string {
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
function historyCsv(attempts: TypingAttempt[], difficultyLabel: (value: Difficulty) => string): string {
    const rows = attempts.map((attempt) => [
        attempt.completedAt,
        attempt.duration,
        difficultyLabel(attempt.difficulty),
        attempt.wpm,
        attempt.rawWpm,
        attempt.accuracy,
        attempt.errors,
        attempt.corrections,
        attempt.completedPassage ? "true" : "false",
    ].join(","));
    return [
        "completed_at,duration_seconds,difficulty,net_wpm,raw_wpm,accuracy_percent,errors,corrections,completed_passage",
        ...rows,
    ].join("\n");
}
export function TypingSpeedTestTool() {
    const locale = useLocale();
    const t = useTranslations("tools.text.typing-speed-test.tool");
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
    const passageSentences = useMemo(() => t.raw(`passages.${difficulty}`) as string[], [difficulty, t]);
    const passage = useMemo(() => buildPassage(passageSentences, duration, passageIndex), [duration, passageIndex, passageSentences]);
    const activeStats = useMemo(() => calculateTypingStats(passage, input, elapsedMs), [elapsedMs, input, passage]);
    const difficultyLabel = useCallback((value: Difficulty) => t(`difficulty.${value}.label`), [t]);
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
            <h2 id="typing-setup-title">{t("setup.heading")}</h2>
            <p>{t("setup.description")}</p>
          </div>
          <button type="button" className="secondary-button" onClick={() => reset(true)} disabled={phase === "running"}>
            <Shuffle size={16} aria-hidden="true"/> {t("newPassage")}
          </button>
        </div>
        <div className="typing-toolbar">
          <div>
            <span className="control-label">{t("durationLabel")}</span>
            <div className="segmented-control" role="group" aria-label={t("durationAriaLabel")}>
              {DURATIONS.map((value) => (<button key={value} type="button" className={duration === value ? "active" : ""} aria-pressed={duration === value} disabled={phase === "running"} onClick={() => {
                setDuration(value);
                reset();
            }}>
                  {t("durationOptionLabel", { value })}
                </button>))}
            </div>
          </div>
          <div>
            <span className="control-label">{t("difficultyLabel")}</span>
            <div className="segmented-control" role="group" aria-label={t("difficultyAriaLabel")}>
              {DIFFICULTIES.map((value) => (<button key={value} type="button" className={difficulty === value ? "active" : ""} aria-pressed={difficulty === value} disabled={phase === "running"} title={t(`difficulty.${value}.description`)} onClick={() => {
                setDifficulty(value);
                reset();
            }}>
                  {t(`difficulty.${value}.label`)}
                </button>))}
            </div>
          </div>
          <label className="checkbox-option typing-focus-toggle">
            <input type="checkbox" checked={focusMode} onChange={(event) => setFocusMode(event.target.checked)}/>
            <span>
              <strong>{t("focusModeTitle")}</strong>
              <small>{t("focusModeHint")}</small>
            </span>
          </label>
        </div>
      </section>

      <div className="typing-progress" role="progressbar" aria-label={t("secondsRemainingAriaLabel", {
            seconds: remainingSeconds,
        })} aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.round(elapsedMs / 1000)}>
        <div>
          <span>
            {phase === "finished"
            ? t("statusComplete")
            : phase === "idle"
                ? t("statusReady")
                : t("statusTimeLeft")}
          </span>
          <strong>
            {t("remainingSecondsLabel", { value: remainingSeconds })}
          </strong>
        </div>
        <div className="typing-progress-track" aria-hidden="true">
          <span style={{ width: `${progress}%` }}/>
        </div>
        <span className="typing-passage-size">
          {t("wordsPrepared", { count: passageWords })}
        </span>
      </div>

      <div className="typing-passage-panel">
        <div className="typing-passage-toolbar">
          <div>
            <strong>{t("passageLabel")}</strong>
            <span>{t("passageScrollHint")}</span>
          </div>
          <div className="typing-display-controls">
            <div className="typing-display-control">
              <label htmlFor="typing-font-size">{t("fontSizeLabel")}</label>
              <select id="typing-font-size" value={passageFontSize} onChange={(event) => setPassageFontSize(Number(event.target.value))} aria-describedby="typing-font-size-help">
                {PASSAGE_FONT_SIZES.map((size, index) => (<option value={index} key={size.label}>
                    {size.label}
                  </option>))}
              </select>
              <span id="typing-font-size-help" className="sr-only">
                {t("fontSizeHelp")}
              </span>
            </div>
            <div className="typing-display-control">
              <label htmlFor="typing-reading-height">
                {t("readingHeightLabel")}
              </label>
              <select id="typing-reading-height" value={passageHeight} onChange={(event) => setPassageHeight(Number(event.target.value))}>
                {PASSAGE_HEIGHTS.map((height, index) => (<option value={index} key={height}>
                    {t(`passageHeight.${height}`)}
                  </option>))}
              </select>
            </div>
          </div>
        </div>
        <div className={`typing-passage passage-height-${passageHeight}`} style={{ fontSize: PASSAGE_FONT_SIZES[passageFontSize].value }} aria-label={t("textToTypeAriaLabel")} tabIndex={0}>
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
            ? t("startPrompt")
            : phase === "finished"
                ? t("completedPrompt")
                : t("typingPrompt")}
        </span>
        <textarea id="typing-input" value={input} style={{ fontSize: PASSAGE_FONT_SIZES[passageFontSize].value }} onChange={(event) => handleInput(event.target.value)} onKeyDown={(event) => {
            if (phase === "running" &&
                (event.key === "Backspace" || event.key === "Delete")) {
                setCorrections((current) => current + 1);
            }
        }} onPaste={(event) => {
            event.preventDefault();
            setNotice(t("pasteDisabledNotice"));
        }} disabled={phase === "finished"} rows={4} autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} placeholder={t("inputPlaceholder")}/>
      </label>
      {notice ? (<p className="typing-notice" role="status">
          {notice}
        </p>) : null}

      {!(focusMode && phase === "running") ? (<div className="typing-results" aria-label={t("resultsAriaLabel")}>
          <div>
            <span>{t("results.netWpm")}</span>
            <strong>{activeStats.wpm}</strong>
          </div>
          <div>
            <span>{t("results.rawWpm")}</span>
            <strong>{activeStats.rawWpm}</strong>
          </div>
          <div>
            <span>{t("results.accuracy")}</span>
            <strong>{activeStats.accuracy}%</strong>
          </div>
          <div>
            <span>{t("results.errors")}</span>
            <strong>{activeStats.errors}</strong>
          </div>
          <div>
            <span>{t("results.corrections")}</span>
            <strong>{corrections}</strong>
          </div>
        </div>) : (<p className="typing-focus-message">{t("focusMessage")}</p>)}

      <div className="typing-summary" aria-live={phase === "finished" ? "polite" : "off"}>
        <div>
          <h2>
            {phase === "finished"
            ? newBest
                ? t("newPersonalBest")
                : t("testComplete")
            : t("personalBestForSetup")}
          </h2>
          {currentBest ? (<p>
              {t.rich("bestSummary", {
                duration,
                difficulty: difficultyLabel(difficulty),
                wpm: currentBest.wpm,
                accuracy: currentBest.accuracy,
                strong: (chunks) => <strong>{chunks}</strong>,
            })}
            </p>) : (<p>{t("noBestYet")}</p>)}
        </div>
        <button type="button" className="secondary-button" onClick={() => reset()}>
          <RotateCcw size={16} aria-hidden="true"/> {t("restart")}
        </button>
      </div>

      <section className="typing-history" aria-labelledby="typing-history-title">
        <div className="typing-history-heading">
          <div>
            <h2 id="typing-history-title">{t("history.heading")}</h2>
            <p>{t("history.description")}</p>
          </div>
          <div className="button-group">
            <DownloadButton content={history.length
            ? historyCsv(history, difficultyLabel)
            : ""} filename="typing-test-history.csv" mimeType="text/csv;charset=utf-8" toolSlug="typing-speed-test">
              {t("downloadCsv")}
            </DownloadButton>
            <button type="button" className="secondary-button" onClick={clearLocalResults} disabled={!history.length && !Object.keys(bests).length}>
              {t("clearResults")}
            </button>
          </div>
        </div>
        {history.length ? (<div className="typing-history-table-wrap">
            <table className="typing-history-table">
              <thead>
                <tr>
                  <th>{t("table.date")}</th>
                  <th>{t("table.setup")}</th>
                  <th>{t("table.netWpm")}</th>
                  <th>{t("table.accuracy")}</th>
                  <th>{t("table.errors")}</th>
                  <th>{t("table.corrections")}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((attempt) => (<tr key={attempt.id}>
                    <td>
                      {new Date(attempt.completedAt).toLocaleDateString(locale)}
                    </td>
                    <td>
                      {t("setupCell", {
                    duration: attempt.duration,
                    difficulty: difficultyLabel(attempt.difficulty),
                })}
                    </td>
                    <td>{attempt.wpm}</td>
                    <td>{attempt.accuracy}%</td>
                    <td>{attempt.errors}</td>
                    <td>{attempt.corrections}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>) : (<p className="empty-state">{t("emptyHistory")}</p>)}
      </section>
    </div>);
}
