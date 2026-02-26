import { sql } from 'drizzle-orm';
import { sessions, messages } from './schema';

export const summaryFallback = sql<string | null>`COALESCE(${sessions.summary}, (
	SELECT substr(${messages.content}, 1, 200) FROM ${messages}
	WHERE ${messages.sessionId} = ${sessions.id}
		AND ${messages.role} = 'user' AND ${messages.content} IS NOT NULL
	ORDER BY ${messages.timestamp} ASC LIMIT 1
))`.as('summary');

export const sessionMessageCount = sql<number>`(
	SELECT count(*) FROM ${messages} WHERE ${messages.sessionId} = ${sessions.id}
)`.as('messageCount');

export const dateDay = (col: ReturnType<typeof sql>) => sql<string>`date(${col}, 'unixepoch')`;
