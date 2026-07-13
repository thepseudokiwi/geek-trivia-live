# Geek Trivia Live

A local-first React application for maintaining a trivia library and building balanced, reproducible episode boards. Phase 1 deliberately stops before live game operation, audience synchronization, broadcast animation, and D20 presentation.

## Architecture

- `src/`: React 19 + strict TypeScript + Vite interface. It contains the Question Library and minimal Episode Builder.
- `server/`: local Express API and repository layer.
- `server/db/migrations/`: ordered SQLite migrations. The database uses Node's built-in `node:sqlite` driver.
- `shared/`: UI-independent types, Zod validation, seeded RNG, import validation, and episode-generation/reroll rules.
- `tests/`: Vitest generator, schema, and import-validation tests.

Business rules do not live in React components or route handlers. SQLite is the source of truth in `data/geek-trivia.db`.

## Install and run

Requires Node.js 22.5+ (Node 24 recommended) and npm 10+.

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:5173`. The local API listens on `http://localhost:8787`.

## Tests and production build

```bash
npm test
npm run build
```

Tests cover 4×5 and 5×5 board size, uniqueness, difficulty placement, XP mapping, active status, category/franchise exclusions, all recent-use modes, seed determinism, different seeds, isolated question and category rerolls, reroll uniqueness, insufficient inventory, duplicate database IDs, and row-specific import validation.

## Database migrations

```bash
npm run db:migrate
```

Migrations are applied once in filename order and recorded in the `migrations` table. `npm run db:seed` is idempotent and provides 60 questions across six categories. Every seed record is marked as demonstration content and is not a verified production trivia database.

## Question CSV format

The CSV header is:

```text
id,category,subcategory,difficulty,pointValue,questionText,correctAnswer,alternateAnswers,hostNotes,source,active,usedCount,dateLastUsed,episodeLastUsed
```

- `difficulty` must be 1–5. XP is always derived as difficulty × 100; imported `pointValue` is ignored.
- `subcategory` is optional.
- `alternateAnswers` uses `|` between answers.
- `active` is `true` or `false`; `usedCount` is zero or greater.
- Dates should use ISO 8601 format.
- Invalid imports are rejected transactionally with spreadsheet row numbers and field errors.

## Backup and restore

Use **Backup JSON** in Question Library to export questions, episodes, board positions, and settings. Use **Restore JSON** to transactionally replace application data from a compatible backup.

For a file-level backup, stop the server and copy `data/geek-trivia.db`. You can also use SQLite's backup command:

```bash
sqlite3 data/geek-trivia.db ".backup 'geek-trivia-backup.db'"
```

## Seeded randomization

The generator accepts a `RandomSource`; the supplied implementation hashes a seed into a deterministic PRNG. The same initial library state, filters, recent-use policy, category choices, and seed reproduce the same initial board. Rerolls use separate derived seeds so they do not regenerate unrelated positions.

Recent-use modes are: never used, last X saved/locked episodes, last X days, and allow all. Inventory rules are never silently relaxed. A category is eligible only if all five difficulty levels remain available.

## Known limitations

- Text questions only in Phase 1.
- Saved episodes cannot yet be reopened from a list in the interface.
- Locking validates through the same complete-board generator and persistence constraints, but there is not yet an unlock workflow.
- CSV duplicate-ID database errors identify the ID, while field-validation failures provide row numbers.
- Node currently labels its built-in SQLite API experimental even though it is available in the supported runtime.
- No Host Console, Audience Display, WebSockets, scoring, gameplay timer, OBS styling, or D20 yet.

## Recommended next phase

Build saved-episode browsing/editing and completion accounting first, including incrementing `usedCount` and updating last-used fields atomically. Then implement a private Host Console and a strictly sanitized Audience Display with real-time synchronization and end-to-end gameplay tests. Advanced broadcast styling and D20 animation should follow those tests.
