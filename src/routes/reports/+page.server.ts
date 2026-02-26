import { db } from '$lib/server/db';
import { count, desc, eq, and, isNotNull, sql } from 'drizzle-orm';
import { sessions, messages, toolUses, projects } from '$lib/server/db/schema';
import { dateDay } from '$lib/server/db/helpers';
import type { PageServerLoad } from './$types';

// Pricing per million tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
	'claude-opus-4-6': { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
	'claude-opus-4-5-20251101': { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
	'claude-opus-4-1-20250414': { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
	'claude-opus-4-0-20250514': { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
	'claude-sonnet-4-6': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
	'claude-sonnet-4-5-20241022': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
	'claude-sonnet-4-0-20250514': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
	'claude-sonnet-3-7-20250219': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
	'claude-haiku-4-5-20251001': { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
	'claude-haiku-3-5-20241022': { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 }
};

const DEFAULT_PRICING = { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 };

const computeCost = (
	model: string | null,
	input: number,
	output: number,
	cacheWrite: number,
	cacheRead: number
) => {
	const p = (model && MODEL_PRICING[model]) || DEFAULT_PRICING;
	return (
		(input / 1_000_000) * p.input +
		(output / 1_000_000) * p.output +
		(cacheWrite / 1_000_000) * p.cacheWrite +
		(cacheRead / 1_000_000) * p.cacheRead
	);
};

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

	// ── Pricing data ──────────────────────────────────────────────────────────

	const dailyCostRaw = db
		.select({
			day,
			model: sql<string>`${messages.model}`,
			inputTokens: sql<number>`COALESCE(SUM(${messages.inputTokens}), 0)`,
			outputTokens: sql<number>`COALESCE(SUM(${messages.outputTokens}), 0)`,
			cacheCreationTokens: sql<number>`COALESCE(SUM(${messages.cacheCreationTokens}), 0)`,
			cacheReadTokens: sql<number>`COALESCE(SUM(${messages.cacheReadTokens}), 0)`
		})
		.from(messages)
		.where(and(eq(messages.role, 'assistant'), isNotNull(messages.timestamp), isNotNull(messages.model)))
		.groupBy(day, messages.model)
		.orderBy(day)
		.all();

	// Aggregate daily costs by day (sum across models)
	const dailyCostMap = new Map<string, number>();
	for (const row of dailyCostRaw) {
		const cost = computeCost(row.model, row.inputTokens, row.outputTokens, row.cacheCreationTokens, row.cacheReadTokens);
		dailyCostMap.set(row.day, (dailyCostMap.get(row.day) ?? 0) + cost);
	}
	const dailyCost = [...dailyCostMap.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([day, cost]) => ({ day, cost: Math.round(cost * 100) / 100 }));

	// Cost by model
	const costByModelRaw = db
		.select({
			model: sql<string>`${messages.model}`,
			inputTokens: sql<number>`COALESCE(SUM(${messages.inputTokens}), 0)`,
			outputTokens: sql<number>`COALESCE(SUM(${messages.outputTokens}), 0)`,
			cacheCreationTokens: sql<number>`COALESCE(SUM(${messages.cacheCreationTokens}), 0)`,
			cacheReadTokens: sql<number>`COALESCE(SUM(${messages.cacheReadTokens}), 0)`
		})
		.from(messages)
		.where(and(eq(messages.role, 'assistant'), isNotNull(messages.model)))
		.groupBy(messages.model)
		.all();

	const costByModel = costByModelRaw
		.map((r) => ({
			model: r.model,
			cost: Math.round(computeCost(r.model, r.inputTokens, r.outputTokens, r.cacheCreationTokens, r.cacheReadTokens) * 100) / 100
		}))
		.filter((r) => r.cost > 0)
		.sort((a, b) => b.cost - a.cost);

	// Cost breakdown by category (for the total stat card)
	const totalCost = costByModel.reduce((sum, r) => sum + r.cost, 0);

	// Cost by category across all models
	const costByCategory = costByModelRaw.reduce(
		(acc, r) => {
			const p = (r.model && MODEL_PRICING[r.model]) || DEFAULT_PRICING;
			acc.input += (r.inputTokens / 1_000_000) * p.input;
			acc.output += (r.outputTokens / 1_000_000) * p.output;
			acc.cacheWrite += (r.cacheCreationTokens / 1_000_000) * p.cacheWrite;
			acc.cacheRead += (r.cacheReadTokens / 1_000_000) * p.cacheRead;
			return acc;
		},
		{ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }
	);

	// Top projects by cost
	const projectCostRaw = db
		.select({
			name: projects.name,
			model: sql<string>`${messages.model}`,
			inputTokens: sql<number>`COALESCE(SUM(${messages.inputTokens}), 0)`,
			outputTokens: sql<number>`COALESCE(SUM(${messages.outputTokens}), 0)`,
			cacheCreationTokens: sql<number>`COALESCE(SUM(${messages.cacheCreationTokens}), 0)`,
			cacheReadTokens: sql<number>`COALESCE(SUM(${messages.cacheReadTokens}), 0)`
		})
		.from(messages)
		.innerJoin(sessions, eq(sessions.id, messages.sessionId))
		.innerJoin(projects, eq(projects.id, sessions.projectId))
		.where(and(eq(messages.role, 'assistant'), isNotNull(messages.model)))
		.groupBy(projects.id, messages.model)
		.all();

	const projectCostMap = new Map<string, number>();
	for (const row of projectCostRaw) {
		const cost = computeCost(row.model, row.inputTokens, row.outputTokens, row.cacheCreationTokens, row.cacheReadTokens);
		projectCostMap.set(row.name, (projectCostMap.get(row.name) ?? 0) + cost);
	}
	const topProjectsByCost = [...projectCostMap.entries()]
		.sort(([, a], [, b]) => b - a)
		.slice(0, 10)
		.map(([name, cost]) => ({ name, cost: Math.round(cost * 100) / 100 }));

	return {
		summary,
		dailyTokens,
		toolUsage,
		dailySessions,
		dailyPrompts,
		dailyResponses,
		modelUsage,
		hourlyActivity,
		topProjects,
		dailyCost,
		costByModel,
		totalCost: Math.round(totalCost * 100) / 100,
		costByCategory: {
			input: Math.round(costByCategory.input * 100) / 100,
			output: Math.round(costByCategory.output * 100) / 100,
			cacheWrite: Math.round(costByCategory.cacheWrite * 100) / 100,
			cacheRead: Math.round(costByCategory.cacheRead * 100) / 100
		},
		topProjectsByCost
	};
};
