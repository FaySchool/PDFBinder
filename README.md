# PDFBinder
A simple static web app to easily merge PDFs

## Use

Open `index.html` in a browser, or serve the folder from any static host (for example GitHub Pages).

1. Drop PDF files onto the page or choose them with the file picker.
2. Drag rows or use the arrows to set the merge order.
3. Name the output and press **Merge and save**.

Merging runs entirely in the browser with [pdf-lib](https://pdf-lib.js.org/). No files are uploaded.

## Privacy and security

The page makes no requests to other sites. Everything it loads is served from this repository, and a
Content-Security-Policy (`connect-src 'none'`, `'self'` only for scripts, styles and fonts) has the browser
block anything else.

## Third-party files

| File | Source |
| --- | --- |
| `vendor/pdf-lib.min.js` | [pdf-lib](https://github.com/Hopding/pdf-lib) 1.17.1, `dist/pdf-lib.min.js` from npm, unmodified (MIT, `vendor/pdf-lib.LICENSE.md`) |
| `fonts/inter-*.woff2` | Inter from [@fontsource/inter](https://fontsource.org/fonts/inter) 5.2.8 (SIL OFL 1.1, `fonts/Inter-OFL.txt`) |
| `fonts/space-grotesk-*.woff2` | Space Grotesk from [@fontsource/space-grotesk](https://fontsource.org/fonts/space-grotesk) 5.2.10 (SIL OFL 1.1, `fonts/SpaceGrotesk-OFL.txt`) |
