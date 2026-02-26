import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const projects = db.all<{
		id: number;
		name: string;
		path: string;
		sessionCount: number;
		messageCount: number;
		firstSession: number | null;
		lastSession: number | null;
	}>(sql`
		SELECT
			p.id,
			p.name,
			p.path,
			(SELECT count(*) FROM sessions s WHERE s.project_id = p.id AND s.is_subagent = 0) as sessionCount,
			(SELECT count(*) FROM messages m JOIN sessions s ON s.id = m.session_id WHERE s.project_id = p.id) as messageCount,
			(SELECT MIN(s.started_at) FROM sessions s WHERE s.project_id = p.id AND s.is_subagent = 0) as firstSession,
			(SELECT MAX(s.started_at) FROM sessions s WHERE s.project_id = p.id AND s.is_subagent = 0) as lastSession
		FROM projects p
		ORDER BY lastSession DESC
	`);

	return { projects };
};
