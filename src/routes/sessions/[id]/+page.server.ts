import { db } from '$lib/server/db';
import { asc, eq, and, isNotNull, sql } from 'drizzle-orm';
import { sessions, messages, projects } from '$lib/server/db/schema';
import { summaryFallback } from '$lib/server/db/helpers';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ params, url }) => {
	const sessionDbId = parseInt(params.id, 10);
	if (isNaN(sessionDbId)) error(404, 'Session not found');

	const session = db
		.select({
			id: sessions.id,
			sessionId: sessions.sessionId,
			project: projects.name,
			summary: summaryFallback,
			startedAt: sql<number | null>`${sessions.startedAt}`,
			endedAt: sql<number | null>`${sessions.endedAt}`,
			cwd: sessions.cwd,
			gitBranch: sessions.gitBranch
		})
		.from(sessions)
		.innerJoin(projects, eq(projects.id, sessions.projectId))
		.where(eq(sessions.id, sessionDbId))
		.get();

	if (!session) error(404, 'Session not found');

	const q = url.searchParams.get('q')?.trim();
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const showAll = url.searchParams.get('all') === '1';

	if (!q) {
		const results = db
			.select({
				source: sql<string>`'message'`,
				id: messages.id,
				content: messages.content,
				role: messages.role,
				timestamp: sql<number | null>`${messages.timestamp}`,
				tool_name: sql<string | null>`null`
			})
			.from(messages)
			.where(and(eq(messages.sessionId, sessionDbId), isNotNull(messages.timestamp)))
			.orderBy(asc(messages.timestamp))
			.all();

		return {
			session,
			query: '',
			results,
			total: results.length,
			page: 1,
			pageSize: PAGE_SIZE,
			totalPages: 1,
			showAll: true
		};
	}

	const ftsQuery = q
		.replace(/['"():^~*]/g, '')
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => `"${w}"*`)
		.join(' ');

	if (!ftsQuery)
		return {
			session,
			query: q,
			results: [],
			total: 0,
			page: 1,
			pageSize: PAGE_SIZE,
			totalPages: 0,
			showAll: false
		};

	// FTS queries must stay raw SQL — Drizzle has no virtual table support
	const countResult = db.get<{ total: number }>(sql`
		SELECT (
			(SELECT count(*) FROM messages_fts fts JOIN messages m ON m.id = fts.rowid
			 WHERE messages_fts MATCH ${ftsQuery} AND m.session_id = ${sessionDbId}) +
			(SELECT count(*) FROM tool_uses_fts fts JOIN tool_uses t ON t.id = fts.rowid
			 JOIN messages m ON m.id = t.message_id
			 WHERE tool_uses_fts MATCH ${ftsQuery} AND m.session_id = ${sessionDbId})
		) as total
	`);
	const total = countResult?.total ?? 0;
	const limit = showAll ? total : PAGE_SIZE;
	const totalPages = showAll ? 1 : Math.ceil(total / PAGE_SIZE);
	const offset = showAll ? 0 : (page - 1) * PAGE_SIZE;

	const results = db.all<{
		source: string;
		id: number;
		content: string;
		role: string | null;
		timestamp: number | null;
		tool_name: string | null;
	}>(sql`
		SELECT * FROM (
			SELECT
				'message' as source,
				m.id,
				m.content,
				m.role,
				m.timestamp,
				null as tool_name
			FROM messages_fts fts
			JOIN messages m ON m.id = fts.rowid
			WHERE messages_fts MATCH ${ftsQuery} AND m.session_id = ${sessionDbId}

			UNION ALL

			SELECT
				'tool_use' as source,
				t.id,
				t.input_text as content,
				null as role,
				m.timestamp,
				t.tool_name
			FROM tool_uses_fts fts
			JOIN tool_uses t ON t.id = fts.rowid
			JOIN messages m ON m.id = t.message_id
			WHERE tool_uses_fts MATCH ${ftsQuery} AND m.session_id = ${sessionDbId}
		)
		ORDER BY timestamp DESC
		LIMIT ${limit}
		OFFSET ${offset}
	`);

	return {
		session,
		query: q,
		results,
		total,
		page: showAll ? 1 : page,
		pageSize: PAGE_SIZE,
		totalPages,
		showAll
	};
};
