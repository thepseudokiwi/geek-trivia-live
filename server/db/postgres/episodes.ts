import crypto from 'node:crypto';
import type { EpisodeDetail, EpisodeRecord, EpisodeStatus, EpisodeSummary, Participant } from '../../../shared/types.js';
import { validateEpisodeRecord } from '../../../shared/episodeValidation.js';
import { LifecycleError } from '../../lifecycleError.js';
import { gameQuery, gameTransaction, gameEpisodeTransaction } from './gameStore.js';
import { questionFromRow } from './questions.js';

export async function requireEpisode(id: string) {
  const [episode] = await gameQuery('SELECT * FROM episodes WHERE id=$1', [id]);
  if (!episode) throw new LifecycleError('EPISODE_NOT_FOUND', 'Episode not found.');
  return episode;
}
export async function listEpisodes(q: { search?: string; status?: string; sort?: string; page?: number; pageSize?: number } = {}): Promise<{ items: EpisodeSummary[]; total: number }> {
  return gameTransaction(async () => {
    const clauses: string[] = [], values: unknown[] = [];
    if (q.search) { values.push(`%${q.search}%`); clauses.push(`e.title ILIKE $${values.length}`); }
    if (q.status) { values.push(q.status); clauses.push(`e.status=$${values.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const sort = ({ created: 'e.created_at', scheduled: 'e.scheduled_date', updated: 'e.updated_at' } as Record<string, string>)[q.sort ?? 'updated'] ?? 'e.updated_at';
    const page = Number.isFinite(q.page) ? Math.max(1, Math.floor(q.page!)) : 1;
    const size = Number.isFinite(q.pageSize) ? Math.min(100, Math.max(1, Math.floor(q.pageSize!))) : 20;
    const [count] = await gameQuery(`SELECT count(*) AS n FROM episodes e ${where}`, values);
    const rows = await gameQuery(`SELECT e.*,count(eq.question_id) question_count,sum(CASE WHEN eq.state IN ('completed','skipped') THEN 1 ELSE 0 END) progress_count FROM episodes e LEFT JOIN episode_questions eq ON eq.episode_id=e.id ${where} GROUP BY e.id ORDER BY ${sort} DESC,e.id LIMIT $${values.length+1} OFFSET $${values.length+2}`, [...values,size,(page-1)*size]);
    return { total: Number(count.n), items: rows.map(r => ({ id:r.id,title:r.title,episodeNumber:r.episode_number,scheduledDate:r.scheduled_date,status:r.status,categoryCount:r.category_count,questionCount:Number(r.question_count),progressCount:Number(r.progress_count ?? 0),finalWinner:r.final_winner,createdAt:r.created_at,updatedAt:r.updated_at })) };
  });
}

export async function recentEpisodeIds(count: number): Promise<string[]> {
  const rows = await gameQuery("SELECT id FROM episodes WHERE status IN ('locked','in_progress','completed','archived') ORDER BY COALESCE(scheduled_date,created_at) DESC LIMIT $1", [Math.max(0, Math.floor(count))]);
  return rows.map(r => r.id);
}
export function requireStatus(episode: any, ...allowed: EpisodeStatus[]) {
  if (!allowed.includes(episode.status)) throw new LifecycleError('INVALID_TRANSITION', `Action is not allowed while episode status is ${episode.status}.`, { status: episode.status, allowed });
}
export function participantFromRow(row: any): Participant {
  return { id: row.id, episodeId: row.episode_id, displayName: row.display_name, color: row.color, score: row.score, placement: row.placement, createdAt: row.created_at };
}
export async function getEpisode(id: string): Promise<EpisodeDetail> {
  return gameTransaction(async () => {
    const e = await requireEpisode(id);
    const rows = await gameQuery('SELECT eq.*,q.* FROM episode_questions eq JOIN questions q ON q.id=eq.question_id WHERE eq.episode_id=$1 ORDER BY eq.category_position,eq.difficulty', [id]);
    const names = new Map<number, string>();
    for (const row of rows) if (!names.has(row.category_position)) names.set(row.category_position, row.category);
    const gameplay = await gameQuery('SELECT * FROM episode_questions WHERE episode_id=$1 ORDER BY category_position,difficulty', [id]);
    const participants = await gameQuery('SELECT * FROM episode_participants WHERE episode_id=$1 ORDER BY CASE WHEN placement IS NULL THEN 999 ELSE placement END,created_at,id', [id]);
    const actions = await gameQuery('SELECT * FROM game_actions WHERE episode_id=$1 ORDER BY created_at,id', [id]);
    return {
      id: e.id, title: e.title, episodeNumber: e.episode_number, scheduledDate: e.scheduled_date,
      status: e.status, seed: e.seed, options: JSON.parse(e.options_json),
      categories: [...names].map(([position, name]) => ({ name, questions: rows.filter(r => r.category_position === position).map(questionFromRow) })),
      sourceEpisodeId: e.source_episode_id, finalWinner: e.final_winner, createdAt: e.created_at,
      updatedAt: e.updated_at, startedAt: e.started_at, completedAt: e.completed_at, archivedAt: e.archived_at,
      gameplay: gameplay.map(r => ({ questionId: r.question_id, state: r.state, openedAt: r.opened_at, completedAt: r.completed_at, outcome: r.outcome, awardedParticipantId: r.awarded_participant_id, awardedPoints: r.awarded_points, notes: r.notes })),
      participants: participants.map(participantFromRow),
      actions: actions.map(r => ({ id: r.id, episodeId: r.episode_id, actionType: r.action_type, createdAt: r.created_at, questionId: r.question_id, participantId: r.participant_id, pointDelta: r.point_delta, reason: r.reason, metadata: JSON.parse(r.metadata_json) })),
    };
  });
}

export async function recordAction(episodeId: string, type: string, data: { participantId?: string; questionId?: string; pointDelta?: number; reason?: string; metadata?: unknown } = {}) {
  await gameQuery('INSERT INTO game_actions(id,episode_id,action_type,question_id,participant_id,point_delta,reason,metadata_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [crypto.randomUUID(),episodeId,type,data.questionId ?? null,data.participantId ?? null,data.pointDelta ?? 0,data.reason ?? null,JSON.stringify(data.metadata ?? {})]);
}

export async function saveEpisode(e: EpisodeRecord) {
  validateEpisodeRecord(e);
  return gameEpisodeTransaction(e.id, async () => {
    const [existing] = await gameQuery('SELECT * FROM episodes WHERE id=$1', [e.id]);
    if (existing) requireStatus(existing, 'draft');
    if (e.status !== 'draft') throw new LifecycleError('INVALID_TRANSITION', 'Episodes must be saved as drafts before locking.');
    await gameQuery(`INSERT INTO episodes(id,title,episode_number,scheduled_date,seed,category_count,status,options_json,source_episode_id,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,'draft',$7,$8,CURRENT_TIMESTAMP::text)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,episode_number=excluded.episode_number,scheduled_date=excluded.scheduled_date,seed=excluded.seed,category_count=excluded.category_count,options_json=excluded.options_json,updated_at=CURRENT_TIMESTAMP::text`,
    [e.id,e.title,e.episodeNumber,e.scheduledDate,e.seed,e.categories.length,JSON.stringify(e.options),e.sourceEpisodeId ?? null]);
    await gameQuery('DELETE FROM episode_questions WHERE episode_id=$1', [e.id]);
    for (const [position, category] of e.categories.entries()) {
      for (const question of category.questions) await gameQuery('INSERT INTO episode_questions(episode_id,question_id,category_position,difficulty) VALUES($1,$2,$3,$4)', [e.id,question.id,position,question.difficulty]);
    }
    return getEpisode(e.id);
  });
}

export async function addParticipant(id: string, input: { displayName: string; color?: string }) {
  if (!input.displayName?.trim()) throw new LifecycleError('INVALID_PARTICIPANT', 'Display name is required.');
  return gameEpisodeTransaction(id, async () => {
    requireStatus(await requireEpisode(id), 'locked', 'in_progress');
    const [count] = await gameQuery('SELECT count(*) AS n FROM episode_participants WHERE episode_id=$1', [id]);
    if (Number(count.n) >= 8) throw new LifecycleError('PARTICIPANT_LIMIT', 'An episode supports at most eight participants.');
    const participantId = crypto.randomUUID();
    await gameQuery('INSERT INTO episode_participants(id,episode_id,display_name,color) VALUES($1,$2,$3,$4)', [participantId,id,input.displayName.trim(),input.color ?? null]);
    await recordAction(id, 'participant_added', { participantId, metadata: { displayName: input.displayName.trim() } });
    return getEpisode(id);
  });
}

export async function renameParticipant(id: string, participantId: string, name: string) {
  if (!name?.trim()) throw new LifecycleError('INVALID_PARTICIPANT', 'Display name is required.');
  return gameEpisodeTransaction(id, async () => {
    requireStatus(await requireEpisode(id), 'locked', 'in_progress');
    const rows = await gameQuery('UPDATE episode_participants SET display_name=$1 WHERE id=$2 AND episode_id=$3 RETURNING id', [name.trim(),participantId,id]);
    if (!rows.length) throw new LifecycleError('PARTICIPANT_NOT_FOUND', 'Participant not found.');
    await recordAction(id, 'participant_renamed', { participantId, metadata: { displayName: name.trim() } });
    return getEpisode(id);
  });
}

export async function adjustScore(id: string, participantId: string, delta: number, reason: string) {
  if (!Number.isInteger(delta) || delta === 0) throw new LifecycleError('INVALID_SCORE', 'Score adjustment must be a non-zero integer.');
  if (!reason?.trim()) throw new LifecycleError('REASON_REQUIRED', 'Manual score adjustments require a reason.');
  return gameEpisodeTransaction(id, async () => {
    requireStatus(await requireEpisode(id), 'in_progress');
    const rows = await gameQuery('UPDATE episode_participants SET score=score+$1 WHERE id=$2 AND episode_id=$3 RETURNING id', [delta,participantId,id]);
    if (!rows.length) throw new LifecycleError('PARTICIPANT_NOT_FOUND', 'Participant not found.');
    await recordAction(id, 'manual_score_adjustment', { participantId, pointDelta: delta, reason: reason.trim() });
    return getEpisode(id);
  });
}

export async function resetScores(id: string) {
  return gameEpisodeTransaction(id, async () => {
    requireStatus(await requireEpisode(id), 'locked');
    await gameQuery('UPDATE episode_participants SET score=0,placement=NULL WHERE episode_id=$1', [id]);
    await recordAction(id, 'scores_reset');
    return getEpisode(id);
  });
}

export async function removeParticipant(id: string, participantId: string) {
  return gameEpisodeTransaction(id, async () => {
    requireStatus(await requireEpisode(id), 'locked', 'in_progress');
    const [participant] = await gameQuery('SELECT display_name,score FROM episode_participants WHERE id=$1 AND episode_id=$2', [participantId,id]);
    if (!participant) throw new LifecycleError('PARTICIPANT_NOT_FOUND', 'Participant not found.');
    await gameQuery("UPDATE buzzer_sessions SET state='cancelled',winner_session_id=NULL,winner_participant_id=NULL,response_status='idle',response_resumed_at=NULL WHERE episode_id=$1 AND winner_participant_id=$2", [id,participantId]);
    await gameQuery('DELETE FROM buzz_attempts WHERE episode_id=$1 AND participant_id=$2', [id,participantId]);
    await gameQuery('DELETE FROM episode_participants WHERE id=$1 AND episode_id=$2', [participantId,id]);
    await recordAction(id, 'participant_removed', { participantId, metadata: { displayName: participant.display_name, finalScore: participant.score } });
    return getEpisode(id);
  });
}

export async function startEpisode(id: string) {
  return gameEpisodeTransaction(id, async () => {
    requireStatus(await requireEpisode(id), 'locked');
    await gameQuery("UPDATE episodes SET status='in_progress',started_at=$1,timer_duration_ms=10000,timer_remaining_ms=10000,timer_status='idle',updated_at=CURRENT_TIMESTAMP::text WHERE id=$2", [new Date().toISOString(),id]);
    await recordAction(id, 'episode_started');
    return getEpisode(id);
  });
}

export async function deleteDraft(id: string) {
  return gameEpisodeTransaction(id, async () => {
    requireStatus(await requireEpisode(id), 'draft');
    await gameQuery('DELETE FROM episodes WHERE id=$1', [id]);
  });
}

export async function transition(id: string, to: EpisodeStatus) {
  return gameEpisodeTransaction(id, async () => {
    const e = await requireEpisode(id);
    const allowed: Record<string, EpisodeStatus[]> = { draft: ['locked'], locked: ['draft','in_progress'], in_progress: ['completed'], completed: ['archived'], archived: ['completed'] };
    if (!allowed[e.status]?.includes(to)) throw new LifecycleError('INVALID_TRANSITION', `Cannot transition ${e.status} to ${to}.`, { from: e.status, to });
    if (to === 'locked') {
      const detail = await getEpisode(id);
      validateEpisodeRecord(detail);
      for (const question of detail.categories.flatMap(c => c.questions)) {
        if (!question.active) throw new LifecycleError('QUESTION_INACTIVE', `Question ${question.id} is inactive.`);
      }
    }
    if (to === 'in_progress') return startEpisode(id);
    if (to === 'completed' && e.status === 'in_progress') return completeEpisode(id);
    await gameQuery('UPDATE episodes SET status=$1,updated_at=CURRENT_TIMESTAMP::text,archived_at=$2 WHERE id=$3', [to,to === 'archived' ? new Date().toISOString() : null,id]);
    await recordAction(id, to === 'draft' ? 'episode_unlocked' : to === 'locked' ? 'episode_locked' : to === 'archived' ? 'episode_archived' : 'episode_restored');
    return getEpisode(id);
  });
}

export async function completeEpisode(id: string, confirmIncomplete = false) {
  return gameEpisodeTransaction(id, async () => {
    const e = await requireEpisode(id);
    if (e.status === 'completed' && e.usage_accounted_at) return getEpisode(id);
    requireStatus(e, 'in_progress');
    const [count] = await gameQuery("SELECT count(*) AS n FROM episode_questions WHERE episode_id=$1 AND state IN ('unopened','opened')", [id]);
    const incomplete = Number(count.n);
    if (incomplete && !confirmIncomplete) throw new LifecycleError('INCOMPLETE_BOARD_CONFIRMATION_REQUIRED', `${incomplete} questions are unfinished. Confirm completion to continue.`, { incomplete });
    const participants = await gameQuery('SELECT * FROM episode_participants WHERE episode_id=$1 ORDER BY score DESC,created_at,id', [id]);
    const best = participants[0]?.score;
    const winner = participants.filter(p => p.score === best).map(p => p.display_name).join(' & ') || null;
    let previousScore: number | undefined, previousPlace = 0;
    for (const [index, p] of participants.entries()) {
      const place = p.score === previousScore ? previousPlace : index + 1;
      await gameQuery('UPDATE episode_participants SET placement=$1 WHERE id=$2', [place,p.id]);
      previousScore = p.score; previousPlace = place;
    }
    const timestamp = new Date().toISOString();
    const updated = await gameQuery("UPDATE episodes SET status='completed',completed_at=$1,usage_accounted_at=$1,final_winner=$2,updated_at=CURRENT_TIMESTAMP::text WHERE id=$3 AND usage_accounted_at IS NULL RETURNING id", [timestamp,winner,id]);
    if (!updated.length) throw new LifecycleError('ALREADY_COMPLETED', 'Episode usage was already accounted.');
    await gameQuery('UPDATE questions SET used_count=used_count+1,used=1,date_last_used=$1,episode_last_used=$2,updated_at=CURRENT_TIMESTAMP::text WHERE id IN (SELECT question_id FROM episode_questions WHERE episode_id=$2)', [e.scheduled_date || timestamp,id]);
    await recordAction(id, 'episode_completed', { metadata: { winner } });
    return getEpisode(id);
  });
}
