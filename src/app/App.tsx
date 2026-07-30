import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Tool } from "../tool/Tool";

type Theme = "light" | "dark";

function preferredTheme(): Theme {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function App() {
  const [theme, setTheme] = useState<Theme>(preferredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="site-title" href="./" aria-label="Typing Speed Test home">
          Typing Speed Test
        </a>
        <button
          className="icon-button"
          type="button"
          aria-label={`Use ${theme === "light" ? "dark" : "light"} theme`}
          onClick={() =>
            setTheme((current) => (current === "light" ? "dark" : "light"))
          }
        >
          {theme === "light" ? <Moon aria-hidden /> : <Sun aria-hidden />}
        </button>
      </header>

      <main>
        <section className="tool-introduction" aria-labelledby="tool-title">
          <p className="eyebrow">Browser-local utility</p>
          <h1 id="tool-title">Typing Speed Test</h1>
          <p>Measure typing speed, accuracy, and errors with configurable timed passages, display controls, local personal bests, and downloadable results.</p>
        </section>

        <section className="tool-workspace" aria-label="Tool workspace">
          <Tool />
        </section>

        <details className="information-section">
          <summary>How to use this tool</summary>
          <div className="information-content">
            <ol>
            <li>{"Choose a duration and difficulty, then select a passage or keep the current one."}</li>
            <li>{"Focus the typing field and reproduce the displayed passage as accurately as possible."}</li>
            <li>{"Review the result, restart the test, or download the summary when the timer finishes."}</li>
            </ol>
          </div>
        </details>
      </main>

      <footer className="site-footer">
        <span>Open-source software under the MIT Licence.</span>
        <span>
          Created by M. Jibulu for{" "}
          <a href="https://eburp.com/">eBURP</a>.
        </span>
      </footer>
    </div>
  );
}
