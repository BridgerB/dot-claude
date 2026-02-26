import { db } from '$lib/server/db';
import { count, desc, eq, sql } from 'drizzle-orm';
import { sessions, projects } from '$lib/server/db/schema';
import { summaryFallback, sessionMessageCount } from '$lib/server/db/helpers';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url }) => {
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

	const [countResult] = db
		.select({ total: count() })
		.from(sessions)
		.where(eq(sessions.isSubagent, false))
		.all();
	const total = countResult?.total ?? 0;
	const totalPages = Math.ceil(total / PAGE_SIZE);
	const offset = (page - 1) * PAGE_SIZE;

	const sessionList = db
		.select({
			id: sessions.id,
			sessionId: sessions.sessionId,
			project: projects.name,
			summary: summaryFallback,
			messageCount: sessionMessageCount,
			startedAt: sql<number | null>`${sessions.startedAt}`,
			endedAt: sql<number | null>`${sessions.endedAt}`,
			cwd: sessions.cwd,
			gitBranch: sessions.gitBranch
		})
		.from(sessions)
		.innerJoin(projects, eq(projects.id, sessions.projectId))
		.where(eq(sessions.isSubagent, false))
		.orderBy(desc(sessions.startedAt))
		.limit(PAGE_SIZE)
		.offset(offset)
		.all();

	return { sessions: sessionList, total, page, totalPages, pageSize: PAGE_SIZE };
};
