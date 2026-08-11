# Typing Speed Test

Measure typing speed, accuracy, and errors with configurable timed passages, display controls, local personal bests, and downloadable results.

[Features](#features) · [Usage](#usage) · [Run locally](#run-locally) · [Contributing](./.github/CONTRIBUTING.md) · [Licence](./LICENSE)

## Features

- Timed 15, 30, 60, and 120-second tests that begin with the first typed character
- Easy, standard, and advanced passages with a new-passage control
- Live timer, progress, word count, WPM, accuracy, corrected errors, and uncorrected errors
- Character-level feedback while typing with paste prevention for fairer results
- Adjustable font size and reading-area height plus an optional focus mode
- Personal bests by duration and bounded recent-attempt history stored in the browser
- Restart, clear-history, and downloadable result-summary controls

## Screenshot

![Typing Speed Test screenshot](./public/tool-preview.webp)

## Usage

1. Choose a duration and difficulty, then keep the current passage or request a new one.
2. Adjust the passage font size, reading-area height, and focus mode before starting.
3. Focus the typing field and reproduce the displayed passage; the timer starts with the first character.
4. Follow the live character feedback, time, WPM, accuracy, and error counts while typing.
5. When the test ends, review personal-best and history updates, then restart, download the summary, or clear saved results.

## Browser support

Works with current versions of Chrome/Chromium, Firefox, and Safari.

- Personal bests and history require localStorage; timed tests remain usable when storage is unavailable.
- Download behaviour follows the browser's normal file-download settings.

## Run locally

You’ll need Git, Corepack, and Node.js 22.13.x or 24.x.

```bash
git clone https://github.com/mjibulu/typing-speed-test.git
cd typing-speed-test
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

Open the local URL shown in the terminal.

## Checks

```bash
pnpm run check
pnpm run verify
```

## Build

```bash
pnpm run build
```

The production files are created in `dist/` and can be hosted on GitHub Pages, Netlify, Cloudflare Pages, Vercel, or any static host.

## Privacy

The app runs in your browser and does not include analytics, ads, or telemetry.

This tool may store the following tool-specific keys locally: `typing-speed-test:bests:v1`, `typing-speed-test:history:v1`.

This tool uses: localStorage, Blob downloads. Availability may vary by browser.

## Contributing

Issues and pull requests are welcome. See the [contribution guide](./.github/CONTRIBUTING.md) before submitting changes.

## Credits

Created by Mujeeb for [eBURP](https://eburp.com/).

## Licence

Licensed under the [MIT Licence](./LICENSE). Third-party dependencies keep their respective licences.
