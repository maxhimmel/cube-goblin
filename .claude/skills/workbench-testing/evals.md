# Evals: workbench-testing

Give an agent the skill and one scenario; it answers with the commands and steps it would run. Pass when every listed point holds.

1. "Check that the new Lab chart renders with two cards cut."
   - Starts a dev server on a copy of `cube/` via `CUBE_REPO_ROOT`, on a port other than 5173.
   - Cuts the two cards through `PATCH /api/cards`, not by editing files.
   - Turns every Lab block on before judging the chart.
   - Stops the server and removes the copy at the end.
2. "Add an e2e test that the board shows a section's tags."
   - Seeds the section in the test itself through the API (or `seedBurn`), not by relying on another test.
   - Runs the new test alone with `-g`.

Last run 2026-11-12: pass (fresh agent given only the skill and the scenarios).
