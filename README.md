# Typing Speed Test

Measure typing speed, accuracy, and errors with configurable timed passages, display controls, local personal bests, and downloadable results.

## Features

- Timed 15, 30, 60, and 120-second tests that begin with the first typed character
- Easy, standard, and advanced passages with a new-passage control
- Live timer, progress, word count, WPM, accuracy, corrected errors, and uncorrected errors
- Character-level feedback while typing with paste prevention for fairer results
- Adjustable font size and reading-area height plus an optional focus mode
- Personal bests by duration and bounded recent-attempt history stored in the browser
- Restart, clear-history, and downloadable result-summary controls

## Screenshot

![Typing Speed Test interface](./public/tool-preview.webp)

## How to use

1. Choose a duration and difficulty, then keep the current passage or request a new one.
2. Adjust the passage font size, reading-area height, and focus mode before starting.
3. Focus the typing field and reproduce the displayed passage; the timer starts with the first character.
4. Follow the live character feedback, time, WPM, accuracy, and error counts while typing.
5. When the test ends, review personal-best and history updates, then restart, download the summary, or clear saved results.

## Browser support and limitations

The current stable releases of Chromium, Firefox, and Safari are supported.

- Personal bests and history require localStorage; timed tests remain usable when storage is unavailable.
- Download behaviour follows the browser's normal file-download settings.

## Run locally

Requirements:

- Node.js 24.x
- Corepack

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

## Verify

Fast checks:

```bash
pnpm run check
```

Complete browser verification:

```bash
pnpm run verify
```

## Build and host

```bash
pnpm run build
```

Upload the contents of `dist/` to a static host. The application supports both
root and subdirectory hosting and needs no environment variables.

The same output can be deployed with GitHub Pages, Netlify, Cloudflare Pages,
Vercel static hosting, or an ordinary file upload.

## Data and network behaviour

The application ships without analytics or telemetry. Tool processing occurs
in the browser, and the primary browser tests fail unexpected external
requests. See [PRIVACY.md](./PRIVACY.md) for the storage and browser API
inventory.

## Contributing

Issues and pull requests are welcome. Read
[CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a change.

## Credits

Created by M. Jibulu for [eBURP](https://eburp.com/).

## Licence

Original code is available under the [MIT Licence](./LICENSE). Dependencies and
assets retain their own licences; see
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
