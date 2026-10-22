import crypto from 'node:crypto';
import { z } from 'zod';
import type { ProductionVideoFeed } from '../../../shared/types.js';
import { LifecycleError } from '../../lifecycleError.js';
import { gameEpisodeTransaction, gameQuery } from './gameStore.js';

const inputSchema = z.object({ label: z.string().trim().min(1).max(80), viewUrl: z.string().url().max(1000), position: z.enum(['top-left','top-right','bottom-left','bottom-right']).default('top-right'), visible: z.boolean().default(false), participantId: z.string().min(1).max(100).nullable().default(null), teamSide: z.enum(['left','right']).nullable().default(null) });
function viewUrl(raw: string) {
  const url = new URL(raw), host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || !(host === 'vdo.ninja' || host.endsWith('.vdo.ninja'))) throw new LifecycleError('INVALID_VIDEO_URL', 'Use an HTTPS VDO.Ninja view link.');
  if (!url.searchParams.get('view') || url.searchParams.has('push')) throw new LifecycleError('INVALID_VIDEO_URL', 'Use a VDO.Ninja view link containing ?view=.');
  url.searchParams.set('cleanoutput', ''); url.searchParams.delete('noaudio'); url.searchParams.set('autoplay', '');
  return url.toString();
}
async function requireEpisode(id: string) {
  if (!(await gameQuery('SELECT 1 FROM episodes WHERE id=$1', [id])).length) throw new LifecycleError('EPISODE_NOT_FOUND', 'Episode not found.');
}
export async function listVideoFeeds(episodeId: string): Promise<ProductionVideoFeed[]> {
  await requireEpisode(episodeId);
  const rows = await gameQuery('SELECT vf.*,ep.display_name participant_name FROM episode_video_feeds vf LEFT JOIN episode_participants ep ON ep.id=vf.participant_id WHERE vf.episode_id=$1 ORDER BY CASE WHEN vf.participant_id IS NULL THEN 1 ELSE 0 END,ep.created_at,vf.created_at,vf.id', [episodeId]);
  return rows.map(row => ({ id: row.id, label: row.label, viewUrl: row.view_url, position: row.position, visible: Boolean(row.visible), participantId: row.participant_id ?? null, participantName: row.participant_name ?? null, teamSide: row.team_side ?? null }));
}
export async function saveVideoFeed(episodeId: string, input: unknown, id?: string) {
  const parsed = inputSchema.parse(input), url = viewUrl(parsed.viewUrl);
  return gameEpisodeTransaction(episodeId, async () => {
    await requireEpisode(episodeId);
    if (parsed.participantId && !(await gameQuery('SELECT 1 FROM episode_participants WHERE id=$1 AND episode_id=$2', [parsed.participantId, episodeId])).length) throw new LifecycleError('PARTICIPANT_NOT_FOUND', 'The selected contestant or team is not part of this episode.');
    const values = [parsed.label, url, parsed.position, Number(parsed.visible), parsed.participantId, parsed.teamSide];
    if (id) {
      const rows = await gameQuery('UPDATE episode_video_feeds SET label=$1,view_url=$2,position=$3,visible=$4,participant_id=$5,team_side=$6,updated_at=CURRENT_TIMESTAMP::text WHERE id=$7 AND episode_id=$8 RETURNING id', [...values,id,episodeId]);
      if (!rows.length) throw new LifecycleError('VIDEO_FEED_NOT_FOUND', 'Video feed not found.');
    } else {
      await gameQuery('INSERT INTO episode_video_feeds(label,view_url,position,visible,participant_id,team_side,id,episode_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [...values,crypto.randomUUID(),episodeId]);
    }
    return listVideoFeeds(episodeId);
  });
}
export async function deleteVideoFeed(episodeId: string, id: string) {
  return gameEpisodeTransaction(episodeId, async () => {
    const rows = await gameQuery('DELETE FROM episode_video_feeds WHERE episode_id=$1 AND id=$2 RETURNING id', [episodeId,id]);
    if (!rows.length) throw new LifecycleError('VIDEO_FEED_NOT_FOUND', 'Video feed not found.');
    return listVideoFeeds(episodeId);
  });
}
