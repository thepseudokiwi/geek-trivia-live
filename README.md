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

## Phase 4A D20 system

The D20 is a server-authoritative extension of the existing live command system. It does not use browser randomness and it does not create a parallel socket protocol. Host commands retain command IDs and expected episode revisions; accepted rolls are written before their result is broadcast. Refreshes and reconnects therefore receive the same persisted result.

### Modes and fairness

**Question Selector** builds an ordered pool of eligible episode-question rows on the server. Completed and active questions are excluded; skipped questions are included only when configured. The server chooses one direct uniform index with `crypto.randomInt(pool.length)`, then independently generates the theatrical D20 face with `crypto.randomInt(20) + 1`. The visible number is associated with that roll record rather than permanently mapped to a square. This gives every eligible square exactly one equal slot on both 4×5 and 5×5 boards without category or difficulty weighting.

**Event Die** requires an active eligible question and resolves the result against the validated rule table. The default table is:

| Roll | Effect | Correct award | Other behavior |
|---|---|---|---|
| 1 | Critical Failure | Base XP | Host may explicitly confirm a base-XP wrong-answer deduction |
| 2–9 | Normal Question | Base XP | Normal timer |
| 10–13 | Speed Challenge | Base XP | 10-second timer override; never starts automatically |
| 14–16 | Bonus 100 XP | Base + 100 | Deductions remain base by default |
| 17–18 | Steal Enabled | Base XP | Host records an initial miss and one final stealing award |
| 19 | Double XP | Base × 2 | Deductions remain base by default |
| 20 | Critical Hit: Triple XP | Base × 3 | Natural 20 presentation |

Every active effect includes a name, inclusive range, type, multiplier, flat bonus, timer override, steal flag, scope, public description, private instructions, active flag, and display priority. Saving is rejected unless active ranges cover 1–20 exactly once with no gap or overlap.

### Configuration

The Host Console D20 panel provides mode selection, enable/disable, animation timing, reduced-motion timing, deduction behavior, skipped-question eligibility, generated sound cues, volume, three visual themes, and an editable rule range table. Settings are global defaults with per-episode overrides. The default themes are Neon Arcane, Classic Polyhedral, and Holographic Sci-Fi.

Configuration endpoints:

- `GET/PUT /api/settings/d20`
- `GET/PUT /api/episodes/:id/d20`
- `GET /api/episodes/:id/d20/rolls`

Durable live commands are `d20.roll`, `d20.acknowledge`, `d20.apply`, `d20.cancel`, `d20.reroll`, and `d20.undo`. They use the existing HTTP command fallback and WebSocket controller lease. A deterministic `D20_TEST_RESULT` facility is honored only when `NODE_ENV=test`; production hosts cannot send a chosen result.

### Modifier application and undo

Applied modifiers are stored on the episode question with roll ID, base XP, effective award, effective deduction, timer override, steal flag, and status. Host Award/Deduct controls send only a direction and participant ID. The server reads the persisted modifier and computes the delta; it ignores client-calculated modified values. Duplicate correct awards are rejected.

D20 undo preserves the original roll and adds a compensating action. An unapplied roll restores the prior selection and public mode. An applied modifier can be undone only after any dependent score action has itself been undone. Completed episodes and already-undone rolls remain immutable. The Host Console warns that a public visual result cannot be unseen.

### Public projection, animation, and sound

The audience receives result, public effect text, selected category/value, effective potential award, timer override, steal flag, timestamp, animation duration, theme, and optional sound preference. It never receives a question ID, unopened question text, private instructions, internal effect key, configuration snapshot, command metadata, or random-generator state.

The presentation is a lightweight CSS 3D-styled polyhedral die that tumbles for the persisted duration and always displays the persisted final number. Natural 1 and Natural 20 have text and visual treatments. Reduced-motion replaces tumbling with a short scale transition. Refreshing mid-animation derives whether the result has landed from the stored roll timestamp.

Sound cues use short Web Audio oscillator tones generated at runtime. There are no downloaded or third-party audio assets and therefore no external license obligation. Sound defaults off, respects the configured volume, and silently degrades when OBS or Chromium blocks audio autoplay.

### Persistence and backup

`005_d20_system.sql` adds global settings, validated effects, episode overrides, durable roll history, active-roll references, modifier fields, configuration snapshots, reroll references, and undo state. Migration tests preserve Phase 3 revision, display, timer, score, and action data. JSON backups add a `d20` section containing settings, effects, and rolls. Old backups without that section continue with defaults; restored effect ranges are validated before insertion.

### Phase 4A OBS rehearsal

1. Add the Audience Display as a 1920×1080 OBS Browser Source and test at both 30 and 60 FPS.
2. Roll Question Selector on four- and five-category boards. Confirm the square highlights and its question text remains private.
3. Exercise each default Event Die range, especially Natural 1, Speed Challenge, Double XP, and Natural 20.
4. Test all three themes and the operating-system reduced-motion preference.
5. Refresh the browser source during the tumble and after landing; the final face must remain identical.
6. Restart the server after a result lands and verify the roll and modifier recover.
7. Open three audience clients and verify synchronized result, effect, and selected square.
8. Test sound disabled and enabled. In OBS, enable **Control audio via OBS** only when routing browser audio through the mixer.
9. Watch CPU/GPU load at 30 and 60 FPS and test long category names.
10. Record a short clip and verify the final number and effect remain readable at normal livestream size.

The automated acceptance flow uses a test-only deterministic 19 to verify Selector persistence and Event Die Double XP, server-computed scoring, score undo, and modifier undo.

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
id,category,subcategory,difficulty,pointValue,questionText,correctAnswer,alternateAnswers,questionType,mediaPath,hostNotes,source,active,usedCount,dateLastUsed,episodeLastUsed
```

- `difficulty` must be 1–5. XP is always derived as difficulty × 100; imported `pointValue` is ignored.
- `subcategory` is optional.
- `alternateAnswers` uses `|` between answers.
- `questionType` is optional and defaults to `text`; supported values are `text`, `image`, `audio`, `video`, and `multiple-choice`.
- `mediaPath` is optional for text and multiple-choice questions and required for image, audio, and video questions. Use a safe application-relative path or an `http(s)` URL.
- `active` is `true` or `false`; `usedCount` is zero or greater.
- Dates should use ISO 8601 format.
- Invalid imports are rejected transactionally with spreadsheet row numbers and field errors.

### Production question-bank import

Back up the database before a production import. Stop the development server, then use either SQLite's online backup command or a file copy while the application is stopped:

```bash
sqlite3 data/geek-trivia.db ".backup 'data/geek-trivia-before-import.db'"
# Or, with the server stopped:
cp data/geek-trivia.db data/geek-trivia-before-import.db
```

Always rehearse the file first. A dry run performs all validation and duplicate/distribution analysis without changing SQLite:

```bash
npm run questions:import -- questions.csv --dry-run --report reports/questions-import.json
```

For the real import, existing IDs are rejected unless one explicit policy is selected:

```bash
# Keep existing rows unchanged and import only new IDs
npm run questions:import -- questions.csv --skip-existing --report reports/questions-import.json

# Replace matching rows, including their usage fields, with CSV values
npm run questions:import -- questions.csv --replace-existing --report reports/questions-import.json

# Optionally deactivate active database questions absent from the file
npm run questions:import -- questions.csv --replace-existing --deactivate-missing
```

The command derives XP from difficulty, stores alternate answers as JSON, rejects duplicate IDs and exact duplicate text, warns on normalized near-duplicates and missing sources, and reports category/difficulty coverage. Any invalid required row prevents the entire transaction. `--replace-existing` and `--skip-existing` are mutually exclusive.

To inspect whether the active library can fill complete boards, run:

```bash
npm run questions:stats
```

This prints the active total and a category-by-difficulty matrix. `Complete boards` is the lowest difficulty count in that category.

To restore the pre-import database, stop the server, preserve the current file for diagnosis, and restore the backup:

```bash
mv data/geek-trivia.db data/geek-trivia-after-failed-import.db
cp data/geek-trivia-before-import.db data/geek-trivia.db
npm run db:migrate
```

The CLI and Question Library use the same row normalization and Zod validation. The original CSV fields remain accepted; `questionType` and `mediaPath` are backward-compatible optional additions.

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
- Timer expiration is reconciled by the server heartbeat while running and from timestamps in snapshots; timer-specific sound remains deferred.
- Final mode and completed-episode production review remain intentionally conservative in this phase.
- The D20 uses a stylized CSS polyhedron rather than a physically accurate 20-face rigid-body simulation.
- Generated D20 tones depend on browser/OBS autoplay permission and intentionally default off.
- There is no remote buzzer, audience voting, chat integration, media playback, advanced wagering, or cloud account service.
- Episode list pagination is implemented through the API; the current UI displays the first scalable page of results.

## Phase 4B broadcast presentation

Phase 4B adds a server-authoritative Preview/Program layer without replacing live game state. The Host Console can privately preview any supported scene, select a transition, queue it, **Take** it to Program, or **Cut** immediately. Program, queued Preview, theme, profile, layout, audio state, safe areas, overlays, and transition end timestamps are persisted in SQLite and delivered through the existing revision-safe WebSocket room. The unqueued local Preview selection intentionally resets to Program on host refresh. Late Audience clients receive the final Program scene; elapsed transitions settle without replaying indefinitely.

Scenes include standby, intro, board, question, answer, scores, D20, intermission, round transition, winner, final, credits, and custom message. Transition duration is capped at five seconds, delay at two seconds, reduced-motion falls back to a cut, and essential text never depends on animation.

### Themes and branding profiles

Typed CSS-variable themes contain palettes, typography stacks, shapes, motion intensity, and transition defaults. Built-ins are original generic designs:

- **Nerd Wars Classic** — dark geometric game-show panels with vibrant accents
- **Neon Arcade** — energetic magenta/cyan grid treatment
- **Fantasy Codex** — restrained parchment, bronze, and forest palette

The default **Nerd Wars** profile and reusable **Geek Trivia Classic** profile select theme, show title, layout, D20 treatment, assets, audio profile, and safe areas. Profiles can be created or duplicated through the presentation API; the default cannot be deleted and referenced or missing assets are rejected.

### OBS layouts and routes

Use the Audience route as an OBS Browser Source at 1920×1080:

```text
http://localhost:5173/#audience/EPISODE_ID?layout=full
http://localhost:5173/#audience/EPISODE_ID?layout=overlay
http://localhost:5173/#audience/EPISODE_ID?layout=scorebug
http://localhost:5173/#audience/EPISODE_ID?layout=question
http://localhost:5173/#audience/EPISODE_ID?layout=lowerthird
```

Add `&audio=off` to disable Program audio, `&reducedMotion=true` for deterministic low-motion output. Invalid layouts safely fall back to the persisted profile layout. Overlay variants use a transparent page background. Title/action-safe guides and camera exclusion rectangles appear only when explicitly enabled for rehearsal.

### Assets and licensing

The Asset Manager accepts PNG, JPEG, WebP, MP3, WAV, OGG, MP4, and WOFF2 up to 25 MB. Server-owned filenames, path normalization, MIME allowlists, checksums, immutable public URLs, reference protection, and disabled SVG/HTML/executable uploads prevent active-content and traversal attacks. Files live in `data/presentation-assets/`, outside source control. Metadata is included in JSON backups; copy that directory separately for binary backup. Users are responsible for recording licensing and attribution and confirming broadcast rights. Bundled audio uses original WebAudio oscillator tones only; no commercial recordings or font files are included.

### Audio routing

Program audio has Master, Music, Stingers, UI, Timer, D20, Winner, and Ambient groups with bounded volumes and mute state. Audio cues carry unique IDs so refresh does not duplicate them. In OBS, enable **Control audio via OBS**, monitor through Advanced Audio Properties, and mute the local Browser Source monitor to prevent duplicate playback. Host Preview is silent unless explicitly previewed; Program defaults to audience-only audio. Browser autoplay policy may require one initial interaction.

### Phase 4B OBS rehearsal

1. Add full, overlay, score bug, question, and lower-third Browser Sources using the URLs above.
2. Test at 1920×1080 at both 30 and 60 FPS; confirm no scrollbars or layout shift.
3. Open Host and three Audience clients. Preview Intro and verify Program is unchanged, then Take it.
4. Exercise every transition, Cut, queue cancellation, resync, reduced motion, and animation disable.
5. Run board layouts with four and five categories, long category/question text, and two/eight players.
6. Show question, answer, score graphic, D20, scores, intermission, winner, and credits.
7. Test overlay transparency, safe guides, missing-asset fallbacks, Master mute, cue playback, and Browser Source audio monitoring.
8. Refresh each Audience client and restart the server; confirm Program/layout restore and no cue duplicates.
9. Record a sample at normal livestream viewing size and verify title/action safe areas and text readability.

Physical OBS capture, audio-device routing, and recorded playback remain operator-required checks because CI cannot access the local OBS installation.

### Backup and limitations

JSON backup includes themes, profiles, templates, Program states, audio profiles, cue mappings, safe areas, and asset metadata. Old backups restore with built-in defaults. Binary assets require a separate copy of `data/presentation-assets`.

The presentation editor intentionally is not a freeform motion-graphics designer. Generated tones are placeholders, automatic music crossfade is represented by persisted cue/group state rather than a multitrack mixer, image dimensions/video duration are not yet probed, and screenshot baselines may vary if operators install different local fonts.

## Recommended Phase 4C

Add authenticated LAN host access, remote buzzers, contestant responder state, richer licensed media probing/transcoding, optional hardware audio routing, and a final-round workflow while retaining the existing command/revision/projection boundaries.
