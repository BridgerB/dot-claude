import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url }) => {
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

	const countResult = db.get<{ total: number }>(sql`
		SELECT count(*) as total FROM sessions WHERE is_subagent = 0
	`);
	const total = countResult?.total ?? 0;
	const totalPages = Math.ceil(total / PAGE_SIZE);
	const offset = (page - 1) * PAGE_SIZE;

	const sessions = db.all<{
		id: number;
		sessionId: string;
		project: string;
		summary: string | null;
		messageCount: number;
		startedAt: number | null;
		endedAt: number | null;
		cwd: string | null;
		gitBranch: string | null;
	}>(sql`
		SELECT
			s.id,
			s.session_id as sessionId,
			p.name as project,
			COALESCE(s.summary, (
				SELECT substr(m2.content, 1, 200) FROM messages m2
				WHERE m2.session_id = s.id AND m2.role = 'user' AND m2.content IS NOT NULL
				ORDER BY m2.timestamp ASC LIMIT 1
			)) as summary,
			(SELECT count(*) FROM messages m WHERE m.session_id = s.id) as messageCount,
			s.started_at as startedAt,
			s.ended_at as endedAt,
			s.cwd,
			s.git_branch as gitBranch
		FROM sessions s
		JOIN projects p ON p.id = s.project_id
		WHERE s.is_subagent = 0
		ORDER BY s.started_at DESC
		LIMIT ${PAGE_SIZE}
		OFFSET ${offset}
	`);

	return { sessions, total, page, totalPages, pageSize: PAGE_SIZE };
};
