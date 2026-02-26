import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const projectId = parseInt(params.id, 10);
	if (isNaN(projectId)) error(404, 'Project not found');

	const project = db.get<{
		id: number;
		name: string;
		path: string;
	}>(sql`SELECT id, name, path FROM projects WHERE id = ${projectId}`);

	if (!project) error(404, 'Project not found');

	const sessions = db.all<{
		id: number;
		sessionId: string;
		summary: string | null;
		messageCount: number;
		startedAt: number | null;
		endedAt: number | null;
		gitBranch: string | null;
	}>(sql`
		SELECT
			s.id,
			s.session_id as sessionId,
			COALESCE(s.summary, (
				SELECT substr(m2.content, 1, 200) FROM messages m2
				WHERE m2.session_id = s.id AND m2.role = 'user' AND m2.content IS NOT NULL
				ORDER BY m2.timestamp ASC LIMIT 1
			)) as summary,
			(SELECT count(*) FROM messages m WHERE m.session_id = s.id) as messageCount,
			s.started_at as startedAt,
			s.ended_at as endedAt,
			s.git_branch as gitBranch
		FROM sessions s
		WHERE s.project_id = ${projectId} AND s.is_subagent = 0
		ORDER BY s.started_at DESC
	`);

	return { project, sessions };
};
