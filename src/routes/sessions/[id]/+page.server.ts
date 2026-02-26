import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ params, url }) => {
	const sessionDbId = parseInt(params.id, 10);
	if (isNaN(sessionDbId)) error(404, 'Session not found');

	const session = db.get<{
		id: number;
		sessionId: string;
		project: string;
		summary: string | null;
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
			s.started_at as startedAt,
			s.ended_at as endedAt,
			s.cwd,
			s.git_branch as gitBranch
		FROM sessions s
		JOIN projects p ON p.id = s.project_id
		WHERE s.id = ${sessionDbId}
	`);

	if (!session) error(404, 'Session not found');

	const q = url.searchParams.get('q')?.trim();
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
	const showAll = url.searchParams.get('all') === '1';

	if (!q) {
		const results = db.all<{
			source: string;
			id: number;
			content: string;
			role: string | null;
			timestamp: number | null;
			tool_name: string | null;
		}>(sql`
			SELECT
				'message' as source,
				m.id,
				m.content,
				m.role,
				m.timestamp,
				null as tool_name
			FROM messages m
			WHERE m.session_id = ${sessionDbId} AND m.timestamp IS NOT NULL
			ORDER BY m.timestamp ASC
		`);

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
