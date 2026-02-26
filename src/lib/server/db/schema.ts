import { integer, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ── Projects ────────────────────────────────────────────────────────────────

export const projects = sqliteTable(
	'projects',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		path: text('path').notNull(),
		name: text('name').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
	},
	(t) => [uniqueIndex('projects_path_idx').on(t.path)]
);

export const projectsRelations = relations(projects, ({ many }) => ({
	sessions: many(sessions)
}));

// ── Sessions ────────────────────────────────────────────────────────────────

export const sessions = sqliteTable(
	'sessions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		sessionId: text('session_id').notNull(),
		projectId: integer('project_id')
			.references(() => projects.id)
			.notNull(),
		slug: text('slug'),
		summary: text('summary'),
		gitBranch: text('git_branch'),
		cwd: text('cwd'),
		version: text('version'),
		isSubagent: integer('is_subagent', { mode: 'boolean' }).default(false).notNull(),
		agentId: text('agent_id'),
		parentSessionId: text('parent_session_id'),
		startedAt: integer('started_at', { mode: 'timestamp' }),
		endedAt: integer('ended_at', { mode: 'timestamp' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
	},
	(t) => [
		uniqueIndex('sessions_session_id_agent_id_idx').on(t.sessionId, t.agentId),
		index('sessions_project_id_idx').on(t.projectId),
		index('sessions_started_at_idx').on(t.startedAt)
	]
);

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
	project: one(projects, {
		fields: [sessions.projectId],
		references: [projects.id]
	}),
	messages: many(messages)
}));

// ── Messages ────────────────────────────────────────────────────────────────

export const messages = sqliteTable(
	'messages',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		sessionId: integer('session_id')
			.references(() => sessions.id)
			.notNull(),
		uuid: text('uuid').notNull(),
		parentUuid: text('parent_uuid'),
		role: text('role').notNull(),
		content: text('content'),
		rawContent: text('raw_content'),
		model: text('model'),
		stopReason: text('stop_reason'),
		inputTokens: integer('input_tokens'),
		outputTokens: integer('output_tokens'),
		cacheCreationTokens: integer('cache_creation_tokens'),
		cacheReadTokens: integer('cache_read_tokens'),
		userType: text('user_type'),
		isSidechain: integer('is_sidechain', { mode: 'boolean' }).default(false).notNull(),
		cwd: text('cwd'),
		gitBranch: text('git_branch'),
		timestamp: integer('timestamp', { mode: 'timestamp' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
	},
	(t) => [
		uniqueIndex('messages_uuid_idx').on(t.uuid),
		index('messages_session_id_idx').on(t.sessionId),
		index('messages_role_idx').on(t.role),
		index('messages_timestamp_idx').on(t.timestamp)
	]
);

export const messagesRelations = relations(messages, ({ one, many }) => ({
	session: one(sessions, {
		fields: [messages.sessionId],
		references: [sessions.id]
	}),
	toolUses: many(toolUses)
}));

// ── Tool Uses ───────────────────────────────────────────────────────────────

export const toolUses = sqliteTable(
	'tool_uses',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		messageId: integer('message_id')
			.references(() => messages.id)
			.notNull(),
		toolUseId: text('tool_use_id').notNull(),
		toolName: text('tool_name').notNull(),
		input: text('input'),
		inputText: text('input_text'),
		result: text('result'),
		createdAt: integer('created_at', { mode: 'timestamp' })
	},
	(t) => [
		index('tool_uses_message_id_idx').on(t.messageId),
		index('tool_uses_tool_name_idx').on(t.toolName)
	]
);

export const toolUsesRelations = relations(toolUses, ({ one }) => ({
	message: one(messages, {
		fields: [toolUses.messageId],
		references: [messages.id]
	})
}));

// ── Global History ──────────────────────────────────────────────────────────

export const globalHistory = sqliteTable(
	'global_history',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		display: text('display').notNull(),
		projectPath: text('project_path'),
		sessionId: text('session_id'),
		pastedContents: text('pasted_contents'),
		timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
	},
	(t) => [
		index('global_history_session_id_idx').on(t.sessionId),
		index('global_history_project_path_idx').on(t.projectPath),
		index('global_history_timestamp_idx').on(t.timestamp)
	]
);

// ── Tasks ───────────────────────────────────────────────────────────────────

export const tasks = sqliteTable(
	'tasks',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		taskNumber: text('task_number').notNull(),
		sourceSessionId: text('source_session_id').notNull(),
		subject: text('subject').notNull(),
		description: text('description'),
		activeForm: text('active_form'),
		status: text('status').notNull(),
		blocks: text('blocks'),
		blockedBy: text('blocked_by'),
		createdAt: integer('created_at', { mode: 'timestamp' })
	},
	(t) => [
		index('tasks_source_session_id_idx').on(t.sourceSessionId),
		index('tasks_status_idx').on(t.status)
	]
);

// ── Plans ───────────────────────────────────────────────────────────────────

export const plans = sqliteTable(
	'plans',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		slug: text('slug').notNull(),
		title: text('title'),
		content: text('content').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
	},
	(t) => [uniqueIndex('plans_slug_idx').on(t.slug)]
);

// ── Meta ────────────────────────────────────────────────────────────────────

export const meta = sqliteTable('meta', {
	key: text('key').primaryKey(),
	value: text('value')
});
