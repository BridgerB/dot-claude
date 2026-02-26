import { db } from '$lib/server/db';
import { desc, eq, and, sql } from 'drizzle-orm';
import { projects, sessions } from '$lib/server/db/schema';
import { summaryFallback, sessionMessageCount } from '$lib/server/db/helpers';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const projectId = parseInt(params.id, 10);
	if (isNaN(projectId)) error(404, 'Project not found');

	const project = db
		.select({ id: projects.id, name: projects.name, path: projects.path })
		.from(projects)
		.where(eq(projects.id, projectId))
		.get();

	if (!project) error(404, 'Project not found');

	const sessionList = db
		.select({
			id: sessions.id,
			sessionId: sessions.sessionId,
			summary: summaryFallback,
			messageCount: sessionMessageCount,
			startedAt: sql<number | null>`${sessions.startedAt}`,
			endedAt: sql<number | null>`${sessions.endedAt}`,
			gitBranch: sessions.gitBranch
		})
		.from(sessions)
		.where(and(eq(sessions.projectId, projectId), eq(sessions.isSubagent, false)))
		.orderBy(desc(sessions.startedAt))
		.all();

	return { project, sessions: sessionList };
};
