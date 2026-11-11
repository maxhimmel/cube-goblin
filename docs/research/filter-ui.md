# Filter-building UI

Researched 2026-11-11 for a less clunky [filter](../GLOSSARY.md#filter) editor than one chip per value ([T-027](../tickets/T-027-filter-widgets.md)), and for how it could share a model with the text query ([T-028](../tickets/T-028-filter-query-syntax.md)). Today's editor is in `apps/web/src/insights/filter-widgets.tsx`; the model is `packages/cube/src/filters.ts`.

## Products

### Linear: field, operator, value

- **Token**: each filter has a property, an operator, and a value. The property is fixed once the filter is added; clicking the operator or value part opens options to change it ([filters](https://linear.app/docs/filters)).
- **Operators**: `is` / `is not` for one option, `is either of` / `is not` for several, `includes any, all, neither, either, none` for labels, `before` / `after` for dates. No numeric operators are documented ([filters](https://linear.app/docs/filters)).
- **Keyboard**: `F` opens the filter menu, and typing a value name (a status, a priority like "High") offers it directly, skipping the property step ([filters](https://linear.app/docs/filters)).
- **Logic**: plain filters AND together; "Advanced filters" group conditions with AND/OR, nested. Filters live in the URL ([filters](https://linear.app/docs/filters)).
- **Text**: no typed query language; an AI filter takes natural language instead ([filters](https://linear.app/docs/filters)).

### GitHub issues and Projects: typed qualifiers with suggestions

- **Token**: `key:value` qualifiers; a space is AND, a comma inside one qualifier is OR (`label:bug,support`), `-` negates any filter ([Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/filtering-projects)).
- **Numbers**: `>`, `>=`, `<`, `<=` on number and date fields (`priority:>1`), inclusive ranges with `..` (`priority:1..3`), open ends with `*` (`points:*..10`) ([Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/filtering-projects)).
- **Suggestions**: the issues bar "will show available qualifiers, suggest values, and warn when there is a problem with your filter"; it supports explicit `AND`/`OR` and parentheses up to five levels deep. The Sort dropdown writes into the query (`sort:created-asc`), so a menu and the text stay in sync ([issues search](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/filtering-and-searching-issues-and-pull-requests)).
- **Keyboard**: Cmd/Ctrl+K, then "Filter by", picks a filter from the command palette ([Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/filtering-projects)).
- **Design system**: Primer's filter guidance pairs the text input with an advanced dialog button, puts filters in the URL, validates invalid queries inline, and warns against fetching on every keystroke ([Primer filter pattern](https://primer.style/product/scenario-patterns/filter)). Its filter-input component is a draft: default suggestions after a bare qualifier, narrowed as the value is typed, and highlighting dropped from invalid values ([draft](https://primer-23eb43332d-26441320.drafts.github.io/components/filter-input)).

### GitLab: tokens inside a text box

- **Token**: key (`assignee`), operator (`is`, `is not`), value. Clicking any part opens a dropdown for that part. Changing the key clears operator and value unless compatible; changing the operator clears the value ([filter component](https://design.gitlab.com/components/filter)).
- **Typing**: focusing the box lists keys; you pick key, then operator, then value from a list or by typing. Typed text that matches a value becomes a token; anything else stays raw text, turned into a token on Tab or blur ([filter component](https://design.gitlab.com/components/filter)).
- **Keyboard**: Esc hides the dropdown, Down reopens it and arrows move through suggestions, Backspace on an empty term steps back into the previous token, deleting a token keeps focus and opens a new dropdown ([filter component](https://design.gitlab.com/components/filter)).

### Notion and Airtable: condition rows

- **Notion**: a simple filter is picked from View settings → Filter; "Add to advanced filter" moves it into groups that mix AND and OR, nested up to three layers ([help](https://www.notion.com/help/views-filters-and-sorts)). Number conditions are `equals`, `does_not_equal`, `greater_than`, `greater_than_or_equal_to`, `less_than`, `less_than_or_equal_to`, `is_empty`, `is_not_empty`; no "between", so a range is two conditions ([API](https://developers.notion.com/reference/post-database-query-filter)).
- **Airtable**: each condition is field, operator, value, and "Conditions read much like sentences". Operators depend on the field type (numbers get "is greater than", "is less than"); "is empty" needs no value. A group uses AND or OR, not both; groups nest three levels ([help](https://support.airtable.com/docs/filtering-records-using-conditions)).
- **Text**: neither offers a typed query.

### Scryfall: query language plus a form that writes it

- **Numbers**: `pow`, `tou`, `pt` (power plus toughness), `loy` take `>`, `<`, `=`, `>=`, `<=`, `!=` against a number or each other: `pow>=8`, `pow>tou c:w t:creature`, `t:planeswalker loy=3`. `mv` takes the same set, plus `mv:even` / `mv:odd` ([syntax](https://scryfall.com/docs/syntax)).
- **Colors**: `c:` and `id:` take color letters, names, and guild/shard/wedge nicknames, with `>`, `<`, `>=`, `<=`, `!=` for subset and superset, or a number for color count ([syntax](https://scryfall.com/docs/syntax)).
- **Logic**: space is AND, `or` and parentheses group (`t:legendary (t:goblin or t:elf)`), `-` negates any keyword, `not:` is `-is:` ([syntax](https://scryfall.com/docs/syntax)).
- **Advanced form**: colors are six checkboxes plus a comparison select ("Exactly these colors", "Including these colors", "At most these colors"). Stats is one row: a stat select (Mana Value, Power, Toughness, Loyalty), an operator select (equal to, less than, greater than, less than or equal to, greater than or equal to, not equal to), and a number box. Types, sets, and "is" criteria are autocomplete multi-selects; criteria toggle between "IS" and "NOT" ([advanced](https://scryfall.com/advanced), read from the page HTML). The form posts to `/advanced`, which builds the search; the form is not re-filled from a typed query.

### Cube Cobra: same syntax, one-way form

- **Syntax**: Scryfall-like. `pow`/`power`, `tou`/`toughness`, `loy`/`loyalty` take `:`, `=`, `<`, `>`, `<=`, `>=`, `!=`, `<>`, and compare to each other (`pow>toughness`, `tou!=power`). `mv` takes `:`, `=`, `<`, `>`, `<=`, `>=`. `tag:` is a substring match and `tag=` exact; a number compares tag count. `AND`/`OR`, parentheses, `-` negation; bare words match names ([filter syntax](https://github.com/dekkerglen/CubeCobra/blob/master/packages/server/content/wiki/reference/filter-syntax.md)).
- **Parse**: each term is category, operator, argument; the parser turns the terms into a filter object checked against each card ([parser](https://github.com/dekkerglen/CubeCobra/blob/master/packages/docs/parser.md)).
- **UI**: one text box with an "Advanced" button. The advanced modal uses a `NumericField` (operator select with the six Scryfall labels, plus a value) for mv, power, toughness, loyalty, prices, and Elo, and color checkboxes with the same three comparisons as Scryfall ([AdvancedFilterModal.tsx](https://github.com/dekkerglen/CubeCobra/blob/master/packages/client/src/components/modals/AdvancedFilterModal.tsx), [NumericField.tsx](https://github.com/dekkerglen/CubeCobra/blob/master/packages/client/src/components/NumericField.tsx)). Applying joins one `name+op+value` token per field into the text box; the modal is not filled back from the text ([FilterCollapse.tsx](https://github.com/dekkerglen/CubeCobra/blob/master/packages/client/src/components/FilterCollapse.tsx)).

### Moxfield and Archidekt

- **Archidekt**: its card search links "Syntax guide" to Scryfall's syntax page ([card search](https://archidekt.com/search/cards), read from the page HTML).
- **Moxfield**: no public filter docs reachable; `moxfield.com/help/syntax` returned 403 to scripted fetches (2026-11-11). Not covered.

### Numeric ranges in a small space

- **Range slider**: two thumbs on one rail; each thumb is its own tab stop with the single-slider keys, and in most range sliders the thumbs cannot pass each other ([WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/)).
- **Pair with inputs**: Baymard says sliders "should always be accompanied by text input fields acting as a fallback", since sliders are imprecise; more than half of test subjects misread a dual-thumb slider as single-thumb ([Baymard](https://baymard.com/blog/slider-interfaces)).
- **Operator plus number**: what Scryfall, Cube Cobra, Notion, and Airtable use (above). GitHub's `1..3` and `*..10` cover ranges in one token.

## Patterns

- **Token = field, operator, value** everywhere structured (Linear, GitLab, Airtable, Notion, Scryfall's Stats row). Operator sets depend on field type.
- **Numbers** use an operator select and a number, never one toggle per value. Ranges are either two conditions (Notion, Scryfall) or one range token (GitHub `a..b`). MTG tools add field-to-field comparison (`pow>tou`).
- **Text and structure**: GitHub and GitLab keep one text box where typing makes tokens and menus write into the text. Scryfall and Cube Cobra keep a separate form that writes the query one way only. Linear, Notion, and Airtable have no query text.
- **Keyboard**: one key to open (`F`, Cmd+K), type to jump to a value, arrows through suggestions, Backspace into the previous token.

## Options for this app

Each keeps `matchesFilter` as the one matcher; they differ in what the editor writes. No choice made.

1. **Per-field compact controls (Scryfall/Cube Cobra form).** Keep chips for small enums (status, color, card type) but give numeric fields an operator select and a number (or a min/max pair), and tags a multi-select. Needs new chip kinds such as `{ field: "power", op: ">=", value: 4 }` beside buckets. Pros: closest to today, learnable, no parser needed. Cons: still a tall dialog, no `pow>tou`, and T-028's text stays separate.
2. **Condition rows (Linear/Airtable).** "+ Add condition" picks a field, then an operator (shaped by type), then a value; rows AND together; chart buckets become rows too. Pros: shows only what's used, handles numbers and ranges the same way, scales to new fields. Cons: more clicks for multi-value color picks; "any of" within a field must be its own operator.
3. **Query text as the source of truth, chips as views of it (GitHub/GitLab).** One input holds `t:creature pow>=4 c:r`; each parsed term renders as a removable pill with a click-to-edit operator and value, and autocomplete suggests fields and values. Saving stores the text (or the parsed terms). Pros: one model for T-027 and T-028, compact, keyboard-first, matches Scryfall muscle memory. Cons: needs a parser, error display, and a canonical printer so editing a pill rewrites the text cleanly; chart buckets need query spellings.
4. **Hybrid: structured rows that print a live query.** Option 2's rows, with a read-only (or editable, parsed on blur) query line under them that mirrors the rows. Pros: beginners use rows, the query teaches the syntax, T-028 can grow into it. Cons: two-way sync is the hardest part; a typed query the rows can't show (OR, parentheses) needs a fallback such as "edit as text only".

Range slider fits mana value and power/toughness (0 to 6+), but per Baymard it needs number inputs beside it, which takes about the room of an operator select.
