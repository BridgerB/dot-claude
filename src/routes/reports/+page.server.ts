import { db } from '$lib/server/db';
import { count, desc, eq, and, isNotNull, sql } from 'drizzle-orm';
import { sessions, messages, toolUses, projects } from '$lib/server/db/schema';
import { dateDay } from '$lib/server/db/helpers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Summary stats — kept as single raw query (7 scalar subqueries)
	const summary = db.get<{
		totalSessions: number;
		promptsSent: number;
		responsesReceived: number;
		totalToolUses: number;
		totalInputTokens: number;
		totalOutputTokens: number;
		totalProjects: number;
	}>(sql`
		SELECT
			(SELECT count(*) FROM sessions WHERE is_subagent = 0) as totalSessions,
			(SELECT count(*) FROM messages WHERE role = 'user' AND content IS NOT NULL AND length(content) > 0) as promptsSent,
			(SELECT count(*) FROM messages WHERE role = 'assistant') as responsesReceived,
			(SELECT count(*) FROM tool_uses) as totalToolUses,
			(SELECT COALESCE(SUM(input_tokens), 0) FROM messages WHERE role = 'assistant') as totalInputTokens,
			(SELECT COALESCE(SUM(output_tokens), 0) FROM messages WHERE role = 'assistant') as totalOutputTokens,
			(SELECT count(DISTINCT project_id) FROM sessions) as totalProjects
	`)!;

	const day = dateDay(sql`${messages.timestamp}`);

	const dailyTokens = db
		.select({
			day,
			inputTokens: sql<number>`COALESCE(SUM(${messages.inputTokens}), 0)`,
			outputTokens: sql<number>`COALESCE(SUM(${messages.outputTokens}), 0)`,
			cacheCreationTokens: sql<number>`COALESCE(SUM(${messages.cacheCreationTokens}), 0)`,
			cacheReadTokens: sql<number>`COALESCE(SUM(${messages.cacheReadTokens}), 0)`
		})
		.from(messages)
		.where(and(eq(messages.role, 'assistant'), isNotNull(messages.timestamp)))
		.groupBy(day)
		.orderBy(day)
		.all();

	const toolUsage = db
		.select({ toolName: toolUses.toolName, count: count() })
		.from(toolUses)
		.groupBy(toolUses.toolName)
		.orderBy(desc(count()))
		.all();

	const sessionDay = dateDay(sql`${sessions.startedAt}`);

	const dailySessions = db
		.select({ day: sessionDay, count: count() })
		.from(sessions)
		.where(and(eq(sessions.isSubagent, false), isNotNull(sessions.startedAt)))
		.groupBy(sessionDay)
		.orderBy(sessionDay)
		.all();

	const dailyPrompts = db
		.select({ day, count: count() })
		.from(messages)
		.where(
			and(
				eq(messages.role, 'user'),
				isNotNull(messages.timestamp),
				isNotNull(messages.content),
				sql`length(${messages.content}) > 0`
			)
		)
		.groupBy(day)
		.orderBy(day)
		.all();

	const dailyResponses = db
		.select({ day, count: count() })
		.from(messages)
		.where(and(eq(messages.role, 'assistant'), isNotNull(messages.timestamp)))
		.groupBy(day)
		.orderBy(day)
		.all();

	const modelUsage = db
		.select({ model: sql<string>`${messages.model}`, count: count() })
		.from(messages)
		.where(and(eq(messages.role, 'assistant'), isNotNull(messages.model)))
		.groupBy(messages.model)
		.orderBy(desc(count()))
		.all();

	const hour = sql<string>`strftime('%H', ${messages.timestamp}, 'unixepoch', 'localtime')`;

	const hourlyActivity = db
		.select({ hour, count: count() })
		.from(messages)
		.where(isNotNull(messages.timestamp))
		.groupBy(hour)
		.orderBy(hour)
		.all();

	const inputSum = sql<number>`COALESCE(SUM(${messages.inputTokens}), 0)`;
	const outputSum = sql<number>`COALESCE(SUM(${messages.outputTokens}), 0)`;

	const topProjects = db
		.select({
			name: projects.name,
			inputTokens: inputSum,
			outputTokens: outputSum
		})
		.from(messages)
		.innerJoin(sessions, eq(sessions.id, messages.sessionId))
		.innerJoin(projects, eq(projects.id, sessions.projectId))
		.where(eq(messages.role, 'assistant'))
		.groupBy(projects.id)
		.orderBy(desc(sql`(${inputSum} + ${outputSum})`))
		.limit(10)
		.all();

	return {
		summary,
		dailyTokens,
		toolUsage,
		dailySessions,
		dailyPrompts,
		dailyResponses,
		modelUsage,
		hourlyActivity,
		topProjects
	};
};
