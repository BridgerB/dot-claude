import { db } from '$lib/server/db';
import { desc, sql } from 'drizzle-orm';
import { projects } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const lastSession = sql<number | null>`(
		SELECT MAX(s.started_at) FROM sessions s WHERE s.project_id = "projects"."id" AND s.is_subagent = 0
	)`;

	const projectList = db
		.select({
			id: projects.id,
			name: projects.name,
			path: projects.path,
			sessionCount: sql<number>`(
				SELECT count(*) FROM sessions s WHERE s.project_id = "projects"."id" AND s.is_subagent = 0
			)`,
			messageCount: sql<number>`(
				SELECT count(*) FROM messages m JOIN sessions s ON s.id = m.session_id WHERE s.project_id = "projects"."id"
			)`,
			firstSession: sql<number | null>`(
				SELECT MIN(s.started_at) FROM sessions s WHERE s.project_id = "projects"."id" AND s.is_subagent = 0
			)`,
			lastSession
		})
		.from(projects)
		.orderBy(desc(lastSession))
		.all();

	return { projects: projectList };
};
