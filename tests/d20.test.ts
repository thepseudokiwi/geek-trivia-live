import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import type {
  D20Effect,
  EpisodeRecord,
  LiveCommand,
  Question,
} from "../shared/types.js";
const dbPath = path.resolve(`data/test-d20-${process.pid}.db`);
let episodes: typeof import("../server/episodesRepository.js"),
  d20: typeof import("../server/d20Repository.js"),
  live: typeof import("../server/liveRepository.js"),
  db: any,
  revision = 0;
const id = "D20";
const question = (c: number, d: number): Question => ({
  id: `D20-C${c}-D${d}`,
  category: `D20 Category ${c}`,
  subcategory: "TEST",
  difficulty: d as any,
  pointValue: d * 100,
  questionText: `Hidden D20 question ${c}/${d}`,
  correctAnswer: "Secret",
  alternateAnswers: ["Private alt"],
  questionType: "text",
  mediaPath: null,
  hostNotes: "PRIVATE",
  source: "PRIVATE",
  active: true,
  usedCount: 0,
  dateLastUsed: null,
  episodeLastUsed: null,
});
const record: EpisodeRecord = {
  id,
  title: "D20 Test",
  episodeNumber: null,
  scheduledDate: null,
  status: "draft",
  seed: id,
  options: {
    categoryCount: 4,
    seed: id,
    recentUsePolicy: { mode: "allow-all" },
  },
  categories: [1, 2, 3, 4].map((c) => ({
    name: `D20 Category ${c}`,
    questions: [1, 2, 3, 4, 5].map((d) => question(c, d)),
  })),
};
const cmd = (
  type: LiveCommand["type"],
  payload: Record<string, unknown>,
  random: (max: number) => number,
  commandId = crypto.randomUUID(),
) => {
  const result = d20.executeD20Command(
    { episodeId: id, commandId, expectedRevision: revision, type, payload },
    random,
  );
  revision = result.revision;
  return result;
};
beforeAll(async () => {
  execFileSync(process.execPath, ["--import", "tsx", "server/db/migrate.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: dbPath },
  });
  process.env.DATABASE_PATH = dbPath;
  episodes = await import("../server/episodesRepository.js");
  d20 = await import("../server/d20Repository.js");
  live = await import("../server/liveRepository.js");
  db = (await import("../server/db/database.js")).db;
  const add = db.prepare(
    `INSERT INTO questions(id,category,subcategory,difficulty,point_value,question_text,correct_answer,alternate_answers,host_notes,source,active,used_count) VALUES(?,?,?,?,?,?,?,?,'PRIVATE','PRIVATE',1,0)`,
  );
  for (const c of record.categories)
    for (const q of c.questions)
      add.run(
        q.id,
        q.category,
        q.subcategory,
        q.difficulty,
        q.pointValue,
        q.questionText,
        q.correctAnswer,
        JSON.stringify(q.alternateAnswers),
      );
  episodes.saveEpisode(record);
  episodes.transition(id, "locked");
  episodes.startEpisode(id);
});
afterAll(() => db.close());
describe("D20 configuration", () => {
  it("loads the seven defaults covering 1–20 exactly once", () => {
    const settings = d20.getD20Settings();
    expect(settings.effects).toHaveLength(7);
    expect(
      settings.effects
        .flatMap((e) =>
          Array.from(
            { length: e.maxRoll - e.minRoll + 1 },
            (_, i) => e.minRoll + i,
          ),
        )
        .sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
  it("rejects gaps, overlaps, and invalid effects", () => {
    const effects = d20.getD20Settings().effects;
    expect(() =>
      d20.validateEffectTable(
        effects.map((e) => (e.key === "normal" ? { ...e, minRoll: 3 } : e)),
      ),
    ).toThrow(/exactly once/);
    expect(() =>
      d20.validateEffectTable(
        effects.map((e) => (e.key === "normal" ? { ...e, maxRoll: 10 } : e)),
      ),
    ).toThrow(/exactly once/);
    expect(() =>
      d20.validateEffectTable([
        { ...effects[0], minRoll: 4, maxRoll: 2 },
      ] as D20Effect[]),
    ).toThrow(/valid/);
  });
});
describe("selector fairness and authority", () => {
  it("makes every position reachable without category or difficulty weighting", () => {
    for (const size of [20, 25]) {
      const pool = Array.from({ length: size }, (_, i) => i),
        counts = Array(size).fill(0);
      for (let i = 0; i < size * 100; i++)
        counts[d20.selectEligible(pool, () => i % size)]++;
      expect(new Set(counts)).toEqual(new Set([100]));
    }
  });
  it("selects on the server, hides unopened text, persists refresh state, and deduplicates", () => {
    let calls = 0;
    const random = (max: number) => [7, 19][calls++] % max;
    const cid = crypto.randomUUID(),
      result = cmd("d20.roll", { mode: "question_selector" }, random, cid);
    expect(result.result).toBe(20);
    const privateState = d20.getPrivateD20(id)!;
    expect(privateState.selectedQuestionId).toBe("D20-C2-D3");
    const publicState = live.getPublicLiveState(id);
    expect(publicState.d20?.result).toBe(20);
    expect(JSON.stringify(publicState.d20)).not.toContain("D20-C2-D3");
    expect(JSON.stringify(publicState)).not.toContain(
      "Hidden D20 question 2/3",
    );
    const duplicate = d20.executeD20Command(
      {
        episodeId: id,
        commandId: cid,
        expectedRevision: 0,
        type: "d20.roll",
        payload: { mode: "question_selector" },
      },
      () => 0,
    );
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.rollId).toBe(result.rollId);
  });
  it("excludes completed positions and current questions and reports empty inventory", () => {
    cmd("d20.acknowledge", {}, () => 0);
    db.prepare(
      "UPDATE episode_questions SET state='completed' WHERE episode_id=? AND question_id='D20-C1-D1'",
    ).run(id);
    db.prepare("UPDATE episodes SET active_question_id=NULL WHERE id=?").run(
      id,
    );
    revision = (
      db.prepare("SELECT revision FROM episodes WHERE id=?").get(id) as any
    ).revision;
    cmd("d20.roll", { mode: "question_selector" }, () => 0);
    expect(d20.getPrivateD20(id)?.selectedQuestionId).not.toBe("D20-C1-D1");
    cmd("d20.cancel", {}, () => 0);
    db.prepare(
      "UPDATE episode_questions SET state='completed' WHERE episode_id=?",
    ).run(id);
    db.prepare("UPDATE episodes SET active_question_id=NULL WHERE id=?").run(
      id,
    );
    expect(() =>
      cmd("d20.roll", { mode: "question_selector" }, () => 0),
    ).toThrow(/eligible/i);
  });
});
describe("event effects and scoring", () => {
  it("resolves every default range and computes modifiers", () => {
    const settings = d20.getD20Settings();
    const expected: Array<[number, string]> = [
      [1, "Critical Failure"],
      [2, "Normal Question"],
      [9, "Normal Question"],
      [10, "Speed Challenge"],
      [13, "Speed Challenge"],
      [14, "Bonus 100 XP"],
      [16, "Bonus 100 XP"],
      [17, "Steal Enabled"],
      [18, "Steal Enabled"],
      [19, "Double XP"],
      [20, "Critical Hit: Triple XP"],
    ];
    for (const [n, name] of expected)
      expect(
        settings.effects.find((e) => n >= e.minRoll && n <= e.maxRoll)?.name,
      ).toBe(name);
  });
  it("applies Double XP and prevents a second correct award", () => {
    db.prepare(
      "UPDATE episode_questions SET state=CASE WHEN question_id='D20-C1-D3' THEN 'opened' ELSE 'completed' END WHERE episode_id=?",
    ).run(id);
    db.prepare(
      "UPDATE episodes SET active_question_id='D20-C1-D3',d20_override_json=?,active_d20_roll_id=NULL WHERE id=?",
    ).run(JSON.stringify({ mode: "event_die" }), id);
    revision = (
      db.prepare("SELECT revision FROM episodes WHERE id=?").get(id) as any
    ).revision;
    cmd("d20.roll", { mode: "event_die" }, () => 18);
    expect(d20.getPrivateD20(id)?.effectName).toBe("Double XP");
    cmd("d20.apply", {}, () => 0);
    const p = episodes.addParticipant(id, { displayName: "Roller" })
      .participants[0];
    revision = (
      db.prepare("SELECT revision FROM episodes WHERE id=?").get(id) as any
    ).revision;
    let scored = live.executeLiveCommand({
      episodeId: id,
      commandId: crypto.randomUUID(),
      expectedRevision: revision,
      type: "score.question",
      payload: { participantId: p.id, direction: "award" },
    });
    revision = scored.revision;
    expect(
      episodes.getEpisode(id).participants.find((x) => x.id === p.id)?.score,
    ).toBe(600);
    expect(() =>
      live.executeLiveCommand({
        episodeId: id,
        commandId: crypto.randomUUID(),
        expectedRevision: revision,
        type: "score.question",
        payload: { participantId: p.id, direction: "award" },
      }),
    ).toThrow(/already has/);
  });
  it("sets Speed Challenge timer without starting it", () => {
    db.prepare(
      "UPDATE episode_questions SET state='opened' WHERE episode_id=? AND question_id='D20-C1-D3'",
    ).run(id);
    db.prepare(
      "UPDATE episodes SET d20_override_json=?,active_d20_roll_id=NULL WHERE id=?",
    ).run(JSON.stringify({ mode: "event_die" }), id);
    revision = (
      db.prepare("SELECT revision FROM episodes WHERE id=?").get(id) as any
    ).revision;
    cmd("d20.roll", { mode: "event_die" }, () => 9);
    cmd("d20.apply", {}, () => 0);
    const timer: any = db
      .prepare("SELECT timer_duration_ms,timer_status FROM episodes WHERE id=?")
      .get(id);
    expect(timer.timer_duration_ms).toBe(10000);
    expect(timer.timer_status).toBe("idle");
  });
});
describe("D20 undo and backup", () => {
  it("keeps private fields out of the public projection", () => {
    const publicText = JSON.stringify(live.getPublicLiveState(id).d20);
    for (const value of [
      "privateInstructions",
      "selectedQuestionId",
      "effectKey",
      "configRevision",
      "PRIVATE",
    ])
      expect(publicText).not.toContain(value);
  });
  it("preserves D20 settings and roll history in backup", () => {
    const backup = d20.exportD20Backup();
    expect(backup.settings).toHaveLength(1);
    expect(backup.effects).toHaveLength(7);
    expect(backup.rolls.length).toBeGreaterThan(0);
  });
  it("rejects roll undo while dependent scoring exists, then preserves the undone record", () => {
    db.prepare(
      "UPDATE episodes SET active_d20_roll_id=NULL,d20_override_json=? WHERE id=?",
    ).run(JSON.stringify({ mode: "event_die" }), id);
    db.prepare(
      "UPDATE episode_questions SET state='opened' WHERE episode_id=? AND question_id='D20-C1-D3'",
    ).run(id);
    revision = (
      db.prepare("SELECT revision FROM episodes WHERE id=?").get(id) as any
    ).revision;
    cmd("d20.roll", { mode: "event_die" }, () => 18);
    cmd("d20.apply", {}, () => 0);
    expect(() => cmd("d20.undo", {}, () => 0)).toThrow(/dependent score/);
    db.prepare(
      "UPDATE game_actions SET undone_at=CURRENT_TIMESTAMP WHERE episode_id=? AND action_type='question_scored'",
    ).run(id);
    revision = (
      db.prepare("SELECT revision FROM episodes WHERE id=?").get(id) as any
    ).revision;
    cmd("d20.undo", {}, () => 0);
    expect(
      (
        db
          .prepare(
            "SELECT status FROM d20_rolls WHERE episode_id=? ORDER BY rowid DESC LIMIT 1",
          )
          .get(id) as any
      ).status,
    ).toBe("undone");
  });
});
