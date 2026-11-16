# Vision

## What

A **cube** for Magic: The Gathering, built to be played by exactly two people. Primary draft format: **Winston**. Other two-player formats may come later. Every card is unique (**singleton**). Terms: [GLOSSARY.md](GLOSSARY.md).

## Goals

- **Tune the cube**: balance, tweak, improve, and analyze its cards.
- **See the data**: visualize statistics about the cube.
- **Discuss the design**: have deep conversations with Claude about the cube's synergies, combos, and archetypes, and what a draft can produce.
- **See the cards**: show card images.
- **Use APIs** wherever one fits (e.g. card data and images).
- **Save locally**: all edits persist on disk.

## Feel

- **UX**: fun, simple, juicy, elegant.
- **Speed**: fast loads, loading animations and skeletons, responsive UI.

## Apps

- **One workbench, two [hosts](GLOSSARY.md#host)**: the desktop app and the web app run the same views and offer the same features.
- **Differ only where a platform can't**: a host may lack a feature only when its platform can't support it (e.g. detachable windows per chart on the web). The other host gets the nearest equivalent, or the gap is declared in code, never left silent.
- **Web today**: a dev harness for checking features fast, served on this machine. It may become a hosted app later (accounts, a database); until then, nothing is built for that, but the UI reaches its host only through one boundary so a hosted host can be added.

## Output and sharing

- **Default**: pretty HTML doc exports, shared as one self-contained file.
- **Exception**: a zip, when the output is best organized as multiple files.
