# Geek Trivia Live

A local-first React application for maintaining a trivia library, building balanced episode boards, and managing a persisted host-side episode lifecycle. Phase 2 adds saved episodes, participants, gameplay state, scoring, completion accounting, and read-only review. Audience synchronization, broadcast animation, and D20 presentation remain intentionally deferred.

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

Tests cover the Phase 1 generator/library rules plus saved episode listing, editing, duplication, deletion, transitions, participants, score persistence, question state, ties, completion rollback, exactly-once usage accounting, backup compatibility, and browser lifecycle workflows.

## Phase 2 episode lifecycle

| Current status | Allowed action | Next status |
|---|---|---|
| Draft | Lock | Locked |
| Locked | Unlock | Draft |
| Locked | Start | In progress |
| In progress | Complete | Completed |
| Completed | Archive | Archived |
| Archived | Restore | Completed |

Status changes use dedicated action endpoints; episode status cannot be assigned arbitrarily. Drafts alone can be edited or deleted. Locked episodes preserve their exact board. Completed and archived episodes reopen as read-only reviews.

The Episodes screen supports title search, status filtering, date sorting, progress summaries, duplication, and status-appropriate actions. Hash routes preserve an opened builder, run, or review screen across browser reloads.

### Participants and scoring

- Up to eight participants per episode
- Participants may be added or renamed before completion
- Participants with score-ledger references cannot be removed
- Active-question XP can be awarded or deducted
- Manual adjustments require a reason
- Every score and gameplay operation is persisted immediately
- Final placements use competition ranking, so tied leaders both receive first place
- The action ledger records lifecycle, participant, question, and score events for future undo support

### Completion accounting

Completion is allowed only from `in_progress`. Unfinished questions require an additional confirmation. Completion, final placements, winner calculation, and usage updates occur in one SQLite transaction. Every board question—including skipped or unopened questions—increments `usedCount` exactly once. Repeated completion requests are idempotent.

## Phase 2 migration

`003_episode_lifecycle.sql` rebuilds the Phase 1 episode tables without losing existing data and adds:

- `archived`, lifecycle timestamps, source episode, winner, and accounting guard fields
- Persisted question states and outcomes
- `episode_participants`
- `game_actions`

The seed command adds four clearly labeled demonstration episodes: draft, locked, in progress, and completed.

## Episode lifecycle API

- `GET /api/episodes`, `GET /api/episodes/:id`
- `POST/PUT /api/episodes`, `DELETE /api/episodes/:id`
- `POST /api/episodes/:id/duplicate`
- `POST /api/episodes/:id/lock|unlock|start|complete|archive|restore`
- Participant create, rename, remove, and score-reset endpoints
- Question open, complete, and skip endpoints
- Manual score-adjustment endpoint

Invalid transitions return structured `code`, `error`, and optional `details` fields.

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

## Manual lifecycle test

1. Seed and start the app, then open **Episodes**.
2. Open the demonstration draft and confirm its board is preserved.
3. Edit metadata or reroll one position, save, then lock it.
4. Start the locked episode and add two participants.
5. Open a question, award or deduct its XP, and skip another question.
6. Reload the browser and confirm the run, scores, question states, and history return.
7. Complete the episode and confirm the unfinished-question warning.
8. Verify placements and the winner in read-only review.
9. Reload review mode and export a backup; verify lifecycle tables are included.

## Known limitations

- Text questions only in Phase 1.
- CSV duplicate-ID database errors identify the ID, while field-validation failures provide row numbers.
- Node currently labels its built-in SQLite API experimental even though it is available in the supported runtime.
- The run screen is a functional host workflow, not the final polished Host Console.
- There is no multi-action undo, game timer, Audience Display, WebSockets, OBS styling, remote buzzer, or D20 yet.
- Episode list pagination is implemented through the API; the current UI displays the first scalable page of results.

## Recommended Phase 3

Build a dedicated private Host Console and a strictly sanitized OBS-ready Audience Display with WebSocket synchronization. Add action undo and timer behavior before remote buzzers or advanced D20 presentation.
