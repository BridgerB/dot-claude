import { db } from '$lib/server/db';
import * as s from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';

const CLAUDE_DIR = join(homedir(), '.claude');

interface ContentBlock {
	type: string;
	text?: string;
	id?: string;
	name?: string;
	input?: Record<string, unknown>;
	tool_use_id?: string;
	content?: string | ContentBlock[];
}

interface SessionRecord {
	type?: string;
	sessionId?: string;
	slug?: string;
	version?: string;
	cwd?: string;
	gitBranch?: string;
	message?: {
		id?: string;
		content?: string | ContentBlock[];
		model?: string;
		stop_reason?: string;
		usage?: {
			input_tokens?: number;
			output_tokens?: number;
			cache_creation_input_tokens?: number;
			cache_read_input_tokens?: number;
		};
	};
	uuid?: string;
	parentUuid?: string;
	userType?: string;
	isSidechain?: boolean;
	timestamp?: string;
	summary?: string;
}

interface HistoryRecord {
	display: string;
	project?: string;
	sessionId?: string;
	pastedContents?: unknown;
	timestamp: string;
}

export interface SyncStats {
	projects: number;
	sessions: number;
	messages: number;
	toolUses: number;
	globalHistory: number;
	tasks: number;
	plans: number;
	durationMs: number;
}

const extractTextContent = (blocks: ContentBlock[]) =>
	blocks
		.filter((b) => b.type === 'text')
		.map((b) => b.text)
		.join('\n\n');

const extractUserContent = (content: string | ContentBlock[]) =>
	typeof content === 'string'
		? content
		: content
				.filter((b) => b.type === 'text')
				.map((b) => b.text)
				.join('\n\n');

const flattenToolInput = (toolName: string, input: Record<string, unknown>): string => {
	switch (toolName) {
		case 'Bash':
			return (input.command as string) ?? '';
		case 'Read':
		case 'Write':
		case 'Edit':
			return (input.file_path as string) ?? '';
		case 'Grep':
		case 'Glob':
			return `${(input.pattern as string) ?? ''} ${(input.path as string) ?? ''}`.trim();
		case 'WebSearch':
			return (input.query as string) ?? '';
		case 'WebFetch':
			return (input.url as string) ?? '';
		case 'Task':
			return (input.prompt as string) ?? (input.description as string) ?? '';
		default:
			return Object.values(input)
				.filter((v): v is string => typeof v === 'string')
				.join(' ');
	}
};

const safeReaddir = (dir: string): string[] => {
	try {
		return readdirSync(dir);
	} catch {
		return [];
	}
};

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const processSessionFile = (
	tx: DbTx,
	filePath: string,
	projectId: number,
	isSubagent: boolean,
	parentSessionId: string | null,
	agentId: string | null,
	stats: SyncStats
) => {
	let content: string;
	try {
		content = readFileSync(filePath, 'utf-8');
	} catch {
		return;
	}

	const lines = content.split('\n').filter(Boolean);

	const userRecords: SessionRecord[] = [];
	const assistantLinesByMsgId = new Map<string, SessionRecord[]>();
	let summaryText: string | null = null;
	let sessionId: string | null = null;
	let slug: string | null = null;
	let version: string | null = null;
	let cwd: string | null = null;
	let gitBranch: string | null = null;

	for (const line of lines) {
		let record: SessionRecord;
		try {
			record = JSON.parse(line);
		} catch {
			continue;
		}

		if (record.type === 'file-history-snapshot' || record.type === 'progress') continue;

		if (record.type === 'summary') {
			summaryText = record.summary ?? null;
			continue;
		}

		if (!sessionId && record.sessionId) {
			sessionId = record.sessionId;
			slug = record.slug ?? null;
			version = record.version ?? null;
			cwd = record.cwd ?? null;
			gitBranch = record.gitBranch ?? null;
		}

		if (record.type === 'user') {
			userRecords.push(record);
		} else if (record.type === 'assistant') {
			const msgId = record.message?.id;
			if (!msgId) continue;
			if (!assistantLinesByMsgId.has(msgId)) assistantLinesByMsgId.set(msgId, []);
			assistantLinesByMsgId.get(msgId)!.push(record);
		}
	}

	if (!sessionId) return;

	const toolResultMap = new Map<string, string>();
	for (const rec of userRecords) {
		const msgContent = rec.message?.content;
		if (Array.isArray(msgContent)) {
			for (const block of msgContent) {
				if (block.type === 'tool_result' && block.tool_use_id) {
					toolResultMap.set(
						block.tool_use_id,
						typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
					);
				}
			}
		}
	}

	const allTimestamps: number[] = [];
	for (const r of userRecords) {
		if (r.timestamp) allTimestamps.push(new Date(r.timestamp).getTime());
	}
	for (const [, recs] of assistantLinesByMsgId) {
		if (recs[0]?.timestamp) allTimestamps.push(new Date(recs[0].timestamp).getTime());
	}
	allTimestamps.sort((a, b) => a - b);

	const session = tx
		.insert(s.sessions)
		.values({
			sessionId,
			projectId,
			slug,
			summary: summaryText,
			gitBranch,
			cwd,
			version,
			isSubagent,
			agentId,
			parentSessionId,
			startedAt: allTimestamps.length ? new Date(allTimestamps[0]) : null,
			endedAt: allTimestamps.length ? new Date(allTimestamps.at(-1)!) : null,
			createdAt: new Date()
		})
		.returning({ id: s.sessions.id })
		.get();

	stats.sessions++;

	const now = new Date();

	for (const rec of userRecords) {
		const msg = rec.message;
		if (!msg?.content || !rec.uuid) continue;
		const textContent = extractUserContent(msg.content);
		const rawContent = typeof msg.content === 'string' ? null : JSON.stringify(msg.content);

		tx.insert(s.messages)
			.values({
				sessionId: session.id,
				uuid: rec.uuid,
				parentUuid: rec.parentUuid ?? null,
				role: 'user',
				content: textContent,
				rawContent,
				model: null,
				stopReason: null,
				inputTokens: null,
				outputTokens: null,
				cacheCreationTokens: null,
				cacheReadTokens: null,
				userType: rec.userType ?? null,
				isSidechain: rec.isSidechain ?? false,
				cwd: rec.cwd ?? null,
				gitBranch: rec.gitBranch ?? null,
				timestamp: rec.timestamp ? new Date(rec.timestamp) : null,
				createdAt: now
			})
			.onConflictDoNothing()
			.run();
		stats.messages++;
	}

	for (const [, recs] of assistantLinesByMsgId) {
		const first = recs[0];
		const allBlocks: ContentBlock[] = [];
		for (const rec of recs) {
			const msgContent = rec.message?.content;
			if (Array.isArray(msgContent)) allBlocks.push(...msgContent);
		}

		const textContent = extractTextContent(allBlocks);
		const usage = first.message?.usage;
		const uuid = first.uuid;
		if (!uuid) continue;

		const msgRow = tx
			.insert(s.messages)
			.values({
				sessionId: session.id,
				uuid,
				parentUuid: first.parentUuid ?? null,
				role: 'assistant',
				content: textContent,
				rawContent: JSON.stringify(allBlocks),
				model: first.message?.model ?? null,
				stopReason: first.message?.stop_reason ?? null,
				inputTokens: usage?.input_tokens ?? null,
				outputTokens: usage?.output_tokens ?? null,
				cacheCreationTokens: usage?.cache_creation_input_tokens ?? null,
				cacheReadTokens: usage?.cache_read_input_tokens ?? null,
				userType: first.userType ?? null,
				isSidechain: first.isSidechain ?? false,
				cwd: first.cwd ?? null,
				gitBranch: first.gitBranch ?? null,
				timestamp: first.timestamp ? new Date(first.timestamp) : null,
				createdAt: now
			})
			.onConflictDoNothing()
			.returning({ id: s.messages.id })
			.get();

		if (!msgRow) continue;
		stats.messages++;

		const toolBlocks = allBlocks.filter((b) => b.type === 'tool_use');
		for (const tool of toolBlocks) {
			if (!tool.id || !tool.name) continue;
			tx.insert(s.toolUses)
				.values({
					messageId: msgRow.id,
					toolUseId: tool.id,
					toolName: tool.name,
					input: JSON.stringify(tool.input ?? {}),
					inputText: flattenToolInput(tool.name, tool.input ?? {}),
					result: toolResultMap.get(tool.id) ?? null,
					createdAt: now
				})
				.run();
			stats.toolUses++;
		}
	}
};

export const sync = (): SyncStats => {
	const start = performance.now();
	const stats: SyncStats = {
		projects: 0,
		sessions: 0,
		messages: 0,
		toolUses: 0,
		globalHistory: 0,
		tasks: 0,
		plans: 0,
		durationMs: 0
	};

	const historyPath = join(CLAUDE_DIR, 'history.jsonl');
	const historyRecords: HistoryRecord[] = [];
	const pathMap = new Map<string, string>();

	if (existsSync(historyPath)) {
		for (const line of readFileSync(historyPath, 'utf-8').split('\n')) {
			if (!line) continue;
			try {
				const r = JSON.parse(line);
				historyRecords.push(r);
				if (r.project) {
					const encoded = r.project.replace(/[^a-zA-Z0-9_-]/g, '-');
					if (!pathMap.has(encoded)) pathMap.set(encoded, r.project);
				}
			} catch {
				continue;
			}
		}
	}

	db.transaction((tx) => {
		tx.delete(s.toolUses).run();
		tx.delete(s.messages).run();
		tx.delete(s.sessions).run();
		tx.delete(s.projects).run();
		tx.delete(s.globalHistory).run();
		tx.delete(s.tasks).run();
		tx.delete(s.plans).run();

		const projectsDir = join(CLAUDE_DIR, 'projects');
		const projectMap = new Map<string, number>();

		if (existsSync(projectsDir)) {
			for (const dir of safeReaddir(projectsDir)) {
				const dirPath = join(projectsDir, dir);
				try {
					if (!statSync(dirPath).isDirectory()) continue;
				} catch {
					continue;
				}
				const projectPath = pathMap.get(dir) ?? dir.replace(/^-/, '/').replace(/-/g, '/');
				const name = basename(projectPath);
				const row = tx
					.insert(s.projects)
					.values({ path: projectPath, name, createdAt: new Date() })
					.returning({ id: s.projects.id })
					.get();
				projectMap.set(dir, row.id);
				stats.projects++;
			}
		}

		for (const [dir, projectId] of projectMap) {
			const dirPath = join(projectsDir, dir);
			for (const entry of safeReaddir(dirPath)) {
				if (!entry.endsWith('.jsonl')) continue;

				const sessionUuid = entry.replace('.jsonl', '');
				processSessionFile(tx, join(dirPath, entry), projectId, false, null, null, stats);

				const subagentDir = join(dirPath, sessionUuid, 'subagents');
				if (existsSync(subagentDir)) {
					for (const subFile of safeReaddir(subagentDir)) {
						if (!subFile.endsWith('.jsonl')) continue;
						const agentId = subFile.replace(/^agent-/, '').replace('.jsonl', '');
						processSessionFile(
							tx,
							join(subagentDir, subFile),
							projectId,
							true,
							sessionUuid,
							agentId,
							stats
						);
					}
				}
			}
		}

		const CHUNK = 100;
		for (let i = 0; i < historyRecords.length; i += CHUNK) {
			const chunk = historyRecords.slice(i, i + CHUNK);
			tx.insert(s.globalHistory)
				.values(
					chunk.map((r) => ({
						display: r.display,
						projectPath: r.project ?? null,
						sessionId: r.sessionId ?? null,
						pastedContents: r.pastedContents ? JSON.stringify(r.pastedContents) : null,
						timestamp: new Date(r.timestamp),
						createdAt: new Date()
					}))
				)
				.run();
		}
		stats.globalHistory = historyRecords.length;

		const tasksDir = join(CLAUDE_DIR, 'tasks');
		if (existsSync(tasksDir)) {
			for (const sessionDir of safeReaddir(tasksDir)) {
				const sessionPath = join(tasksDir, sessionDir);
				try {
					if (!statSync(sessionPath).isDirectory()) continue;
				} catch {
					continue;
				}
				for (const taskFile of safeReaddir(sessionPath)) {
					if (!taskFile.endsWith('.json')) continue;
					try {
						const t = JSON.parse(readFileSync(join(sessionPath, taskFile), 'utf-8'));
						tx.insert(s.tasks)
							.values({
								taskNumber: String(t.id),
								sourceSessionId: sessionDir,
								subject: t.subject,
								description: t.description ?? null,
								activeForm: t.activeForm ?? null,
								status: t.status,
								blocks: JSON.stringify(t.blocks ?? []),
								blockedBy: JSON.stringify(t.blockedBy ?? []),
								createdAt: new Date()
							})
							.run();
						stats.tasks++;
					} catch {
						continue;
					}
				}
			}
		}

		const plansDir = join(CLAUDE_DIR, 'plans');
		if (existsSync(plansDir)) {
			for (const file of safeReaddir(plansDir)) {
				if (!file.endsWith('.md')) continue;
				try {
					const slug = file.replace('.md', '');
					const planContent = readFileSync(join(plansDir, file), 'utf-8');
					const titleMatch = planContent.match(/^#\s+(.+)$/m);
					const title = titleMatch ? titleMatch[1] : slug;
					tx.insert(s.plans)
						.values({
							slug,
							title,
							content: planContent,
							createdAt: new Date()
						})
						.run();
					stats.plans++;
				} catch {
					continue;
				}
			}
		}
	});

	stats.durationMs = Math.round(performance.now() - start);

	const upsertMeta = (key: string, value: string) =>
		db
			.insert(s.meta)
			.values({ key, value })
			.onConflictDoUpdate({ target: s.meta.key, set: { value } })
			.run();

	upsertMeta('lastSyncAt', new Date().toISOString());
	upsertMeta('lastSyncStats', JSON.stringify(stats));

	return stats;
};

export const getLastSyncAt = (): Date | null => {
	const row = db
		.select({ value: s.meta.value })
		.from(s.meta)
		.where(eq(s.meta.key, 'lastSyncAt'))
		.get();
	return row?.value ? new Date(row.value) : null;
};

export const isSyncStale = (maxAgeMs = 60 * 60 * 1000) => {
	const lastSync = getLastSyncAt();
	if (!lastSync) return true;
	return Date.now() - lastSync.getTime() > maxAgeMs;
};
