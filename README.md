# Geek Trivia Live

A local-first React application for maintaining a trivia library, building balanced episode boards, and producing a synchronized live trivia show. Phase 3 adds a private Host Console, a server-sanitized OBS Audience Display, WebSocket rooms, a persistent authoritative timer, revision-safe commands, a host-control lease, and compensating safe undo.

## Architecture

- `src/`: React 19 + strict TypeScript + Vite interface. It contains the Question Library and minimal Episode Builder.
- `server/`: local Express API, WebSocket hub, public/private projection layer, and repositories.
- `server/db/migrations/`: ordered SQLite migrations. The database uses Node's built-in `node:sqlite` driver.
- `shared/`: UI-independent types, Zod validation, seeded RNG, import validation, and episode-generation/reroll rules.
- `tests/`: Vitest unit, integration, migration, sanitization, timer, undo, and WebSocket tests. `e2e/` contains Playwright show workflows.

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
npm run test:e2e
```

Tests cover the Phase 1 generator/library rules plus saved episode listing, editing, duplication, deletion, transitions, participants, score persistence, question state, ties, completion rollback, exactly-once usage accounting, backup compatibility, and browser lifecycle workflows.

## Phase 3 live-show architecture

Open an in-progress episode from **Episodes** to enter its private route, `/#host/:episodeId`. The full-screen OBS route is `/#audience/:episodeId`. The first connected Host Console receives the control lease; later host tabs are read-only observers until they explicitly take control. Audience sockets are always read-only.

SQLite remains authoritative. Every durable live command includes an episode ID, unique command ID, and expected revision. The server validates the transition, writes it transactionally, increments the revision, and broadcasts fresh projections to the episode's WebSocket room. Replayed command IDs return their original revision without applying twice; stale revisions are rejected with the current revision. Refreshes and reconnects receive a complete snapshot. Durable show state recovers after a server restart; transient socket leases do not.

### Private and public state

The private projection contains question IDs and text, correct and alternate answers, host notes, sources, participant IDs, recent actions, undo availability, audience count, and lease role. The separate public serializer contains only the title, safe board positions/statuses, current public question, explicitly revealed answer, timer timestamps, public participants/scores, and display mode.

The server never sends unopened question text, hidden answers, alternates, host notes, sources, action history, participant IDs, manual-adjustment reasons, database metadata, or host-control metadata to an audience socket or `GET /api/live/:id/public`. React does not receive a private object and hide fields.

### Display modes and question flow

Persisted modes are `standby`, `board`, `question`, `answer`, `scores`, and `final`. A host privately selects an unopened square, explicitly shows its question, runs the timer, explicitly reveals the answer, applies scoring or skips/completes it, and returns the audience to the board. Timer expiration never reveals an answer, changes a score, or skips a question.

### Timer and undo

The timer stores duration, remaining milliseconds at the last transition, status, resume timestamp, and expiration timestamp. Browsers derive the countdown from server timestamps instead of receiving one message per second. Start, pause, resume, reset, add, and subtract are supported; subtraction clamps at zero.

The latest eligible live action stores prior/resulting snapshots in `game_actions`. Undo restores that prior state transactionally, marks the original action undone, and adds a compensating `action_undone` row. It cannot cross episode completion, delete history, decrement usage accounting, or undo the same action twice. This is bounded safe undo, not arbitrary history editing.

### Live HTTP and WebSocket contract

- `GET /api/live/:id/public` — sanitized audience snapshot
- `GET /api/live/:id/private` — private bootstrap snapshot
- `POST /api/live/:id/commands` — validated durable command fallback
- `WS /ws?episodeId=:id&role=host|audience&clientId=:id` — episode room

Client messages: `host.claimControl`, `host.releaseControl`, `state.resync`, or `command` containing `episodeId`, `commandId`, `expectedRevision`, `type`, and `payload`. Command types are `question.select`, `question.show`, `answer.reveal`, `question.complete`, `question.skip`, `score.adjust`, `timer.start`, `timer.pause`, `timer.resume`, `timer.reset`, `timer.adjust`, `display.setMode`, and `action.undo`.

Server events are `state.private`, `state.public`, `command.accepted`, and `command.rejected`. Ping/pong heartbeats remove stale sockets. Rooms, audience counts, and broadcasts are isolated by episode ID.

## OBS browser-source setup

1. Run migrations, seed data, and start the app.
2. Start or resume an in-progress episode and open its Host Console.
3. Use **Open Audience Display** and copy that tab's URL.
4. In OBS, add a **Browser Source** with that URL.
5. Set width to **1920** and height to **1080**.
6. Leave browser interaction disabled during the show.
7. Enable **Refresh browser when scene becomes active** only if your scene workflow requires it; the display safely restores its current snapshot after refresh.
8. Verify standby, board, question, answer, scores, timer, and reconnect states.
9. Confirm no answer appears before reveal and no host note/source appears at any time.
10. Award and undo points, refresh the source, and confirm the score and display mode remain correct.

The audience composition uses broadcast-safe margins, large type, high contrast, no navigation, no scrolling at 1920×1080, and reduced-motion support. Opaque broadcast mode is the supported default.

## Phase 3 migration

`004_live_console.sql` adds public mode, active question, answer reveal, revision, timer persistence, undo metadata, and the idempotent `live_commands` table. It preserves all Phase 2 question states and game-action history. Tests apply the ordered migrations to clean/Phase 1 data and validate a Phase 2-to-Phase 3 upgrade.

## Manual two-window acceptance test

1. Seed the database, open `DEMO — In-Progress Episode` in the Host Console, and open its Audience Display in a second window.
2. Confirm the host is controller and the audience count is one.
3. Put the audience on the board and select an unopened square; confirm its text remains private.
4. Show the question, start/pause/resume the timer, and refresh the audience window.
5. Reveal the answer, award points, and confirm the public score changes.
6. Undo the award and confirm both windows return to the prior score.
7. Complete or skip the question, return to the board, and refresh both windows.
8. Open a second Host Console; confirm observer mode, then explicitly take control.
9. Stop and restart the server; confirm display mode, square state, score, reveal state, and timer recover.

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
- Host control is intentionally local and unauthenticated; anyone with local application access can request takeover.
- Undo is limited to recent eligible live actions and cannot erase what viewers already saw after an answer reveal.
- Timer expiration is reconciled by the server heartbeat while running and from timestamps in snapshots; no sound effect is included.
- Final mode and completed-episode production review remain intentionally conservative in this phase.
- There is no remote buzzer, audience voting, chat integration, media playback, advanced wagering, cloud account service, or 3D D20.
- Episode list pagination is implemented through the API; the current UI displays the first scalable page of results.

## Recommended Phase 4

Add optional authenticated LAN host access, contestant buzzers, richer production transitions/audio cues, a final-round workflow, and the separately specified D20 modes. Keep all new contestant/public inputs behind the existing command, revision, and projection boundaries.
