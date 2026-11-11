---
id: T-028
title: Filter query syntax
status: todo
---

Phase 2 of [T-027](T-027-filter-widgets.md) (user, 2026-11-10), widened on 2026-11-11: the chips felt clunky (one chip per power value), so a query replaces them as the way to write every [filter](../GLOSSARY.md#filter). Research: [filter-ui.md](../research/filter-ui.md).

## Decisions (user, 2026-11-11)

- **Model**: the query text is the source of truth. Each term shows as a pill (GitHub style). Saved filters, the [Lab](T-031-lab-view.md)'s toolbar pills, and "Save as filter" all use it; the chip editor goes away.
- **Builder**: "+ Add" opens a picker: field, then an operator that fits the field (numbers get `= >= <= > <` and a number box), then a value. The picker shows the syntax it will write before inserting it. Clicking any part of a pill opens the same picker. Typing works too: autocomplete, Backspace into the previous pill, `/` to focus.
- **Feel** (user, 2026-11-11, after the spike): Tab accepts the autocomplete suggestion, and a typed term fades into its pill so you see the filter form as you type. The query bar has a button that saves what is typed (or the applied pills) as a named filter in the Filters block.
- **Spike**: `apps/web/src/lab/query.ts` (tested) is a starting point for the parser and keyword table.
- **Legend**: a "?" button opens every keyword with its operators and an example, built from the parser's keyword table.
- **Grammar**: terms AND together; `-` negates; `or` and parentheses group; fields compare with each other (`pow>tou`). A group in parentheses shows as one pill, edited as text.
- **Keywords**: `name`, `o:`, `t:`, `c:`, `mv`, `pow`, `tou`, `tag:`, `is:draft`, `is:prospect`, `is:cut`, plus one for each chart bucket that has none (`heavy:`, `body:`, `multi:`). Every chart click writes its query (`mv=2 c:r`). The legend doesn't say where a keyword comes from.
- **Migration**: a one-time script turns the saved chip filters in `cube/filters.json` into queries and drops the chip format; `pnpm cube validate` checks every saved query parses.

## Done when

- A filter is written as a query, typed or built with the picker, and it matches the same cards as the chart bucket it came from (unit-tested against `inBucket`).
- The legend lists every keyword the parser knows.
- `cube/filters.json` holds only queries.
