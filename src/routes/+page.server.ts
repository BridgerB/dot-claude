import { db } from '$lib/server/db';
import { desc, eq, isNotNull, min, max, sql } from 'drizzle-orm';
import { messages, sessions, projects, globalHistory } from '$lib/server/db/schema';
import { sync } from '$lib/server/etl';
import type { Actions, PageServerLoad } from './$types';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim();
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const showAll = url.searchParams.get('all') === '1';

	const msgRange = db
		.select({ minTs: min(messages.timestamp), maxTs: max(messages.timestamp) })
		.from(messages)
		.where(isNotNull(messages.timestamp));
	const histRange = db
		.select({ minTs: min(globalHistory.timestamp), maxTs: max(globalHistory.timestamp) })
		.from(globalHistory)
		.where(isNotNull(globalHistory.timestamp));
	const timeRangeResult = msgRange.unionAll(histRange).all();
	const minTs = timeRangeResult.reduce(
		(m, r) => {
			const v = r.minTs ? Math.floor(r.minTs.getTime() / 1000) : null;
			return v != null && (m == null || v < m) ? v : m;
		},
		null as number | null
	);
	const maxTs = timeRangeResult.reduce(
		(m, r) => {
			const v = r.maxTs ? Math.floor(r.maxTs.getTime() / 1000) : null;
			return v != null && (m == null || v > m) ? v : m;
		},
		null as number | null
	);

	if (!q) {
		const results = db
			.select({
				source: sql<string>`'message'`,
				id: messages.id,
				content: messages.content,
				role: messages.role,
				project: projects.name,
				session_summary: sessions.summary,
				timestamp: sql<number | null>`${messages.timestamp}`,
				tool_name: sql<string | null>`null`
			})
			.from(messages)
			.innerJoin(sessions, eq(sessions.id, messages.sessionId))
			.innerJoin(projects, eq(projects.id, sessions.projectId))
			.where(isNotNull(messages.timestamp))
			.orderBy(desc(messages.timestamp))
			.limit(PAGE_SIZE)
			.all();

		return {
			query: '',
			results,
			total: 0,
			page: 1,
			pageSize: PAGE_SIZE,
			totalPages: 0,
			showAll: false,
			timeRange: { min: minTs, max: maxTs },
			matchTimestamps: [] as number[]
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
			query: q,
			results: [],
			total: 0,
			page: 1,
			pageSize: PAGE_SIZE,
			totalPages: 0,
			showAll: false,
			timeRange: { min: minTs, max: maxTs },
			matchTimestamps: [] as number[]
		};

	// FTS queries must stay raw SQL — Drizzle has no virtual table support
	const countResult = db.get<{ total: number }>(sql`
		SELECT (
			(SELECT count(*) FROM messages_fts WHERE messages_fts MATCH ${ftsQuery}) +
			(SELECT count(*) FROM tool_uses_fts WHERE tool_uses_fts MATCH ${ftsQuery}) +
			(SELECT count(*) FROM global_history_fts WHERE global_history_fts MATCH ${ftsQuery})
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
		project: string | null;
		session_summary: string | null;
		timestamp: number | null;
		tool_name: string | null;
		rank: number;
	}>(sql`
		SELECT * FROM (
			SELECT
				'message' as source,
				m.id,
				m.content,
				m.role,
				p.name as project,
				s.summary as session_summary,
				m.timestamp,
				null as tool_name,
				fts.rank
			FROM messages_fts fts
			JOIN messages m ON m.id = fts.rowid
			JOIN sessions s ON s.id = m.session_id
			JOIN projects p ON p.id = s.project_id
			WHERE messages_fts MATCH ${ftsQuery}

			UNION ALL

			SELECT
				'tool_use' as source,
				t.id,
				t.input_text as content,
				null as role,
				p.name as project,
				s.summary as session_summary,
				m.timestamp,
				t.tool_name,
				fts.rank
			FROM tool_uses_fts fts
			JOIN tool_uses t ON t.id = fts.rowid
			JOIN messages m ON m.id = t.message_id
			JOIN sessions s ON s.id = m.session_id
			JOIN projects p ON p.id = s.project_id
			WHERE tool_uses_fts MATCH ${ftsQuery}

			UNION ALL

			SELECT
				'history' as source,
				g.id,
				g.display as content,
				'user' as role,
				g.project_path as project,
				null as session_summary,
				g.timestamp,
				null as tool_name,
				fts.rank
			FROM global_history_fts fts
			JOIN global_history g ON g.id = fts.rowid
			WHERE global_history_fts MATCH ${ftsQuery}
		)
		ORDER BY timestamp DESC
		LIMIT ${limit}
		OFFSET ${offset}
	`);

	const matchTimestamps = db
		.all<{ timestamp: number }>(
			sql`
		SELECT timestamp FROM (
			SELECT m.timestamp
			FROM messages_fts fts
			JOIN messages m ON m.id = fts.rowid
			WHERE messages_fts MATCH ${ftsQuery} AND m.timestamp IS NOT NULL

			UNION ALL

			SELECT m.timestamp
			FROM tool_uses_fts fts
			JOIN tool_uses t ON t.id = fts.rowid
			JOIN messages m ON m.id = t.message_id
			WHERE tool_uses_fts MATCH ${ftsQuery} AND m.timestamp IS NOT NULL

			UNION ALL

			SELECT g.timestamp
			FROM global_history_fts fts
			JOIN global_history g ON g.id = fts.rowid
			WHERE global_history_fts MATCH ${ftsQuery} AND g.timestamp IS NOT NULL
		)
	`
		)
		.map((r) => r.timestamp);

	return {
		query: q,
		results,
		total,
		page: showAll ? 1 : page,
		pageSize: PAGE_SIZE,
		totalPages,
		showAll,
		timeRange: { min: minTs, max: maxTs },
		matchTimestamps
	};
};

export const actions: Actions = {
	sync: async () => {
		const stats = sync();
		return { stats };
	}
};
