import type Database from 'better-sqlite3';

/** Create FTS5 virtual tables and sync triggers. Safe to call repeatedly. */
export function initFts(client: Database.Database) {
	client.exec(`
		-- ── Messages FTS ────────────────────────────────────────────────────
		CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
			content,
			content=messages,
			content_rowid=id
		);

		CREATE TRIGGER IF NOT EXISTS messages_fts_i AFTER INSERT ON messages BEGIN
			INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
		END;

		CREATE TRIGGER IF NOT EXISTS messages_fts_d AFTER DELETE ON messages BEGIN
			INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
		END;

		CREATE TRIGGER IF NOT EXISTS messages_fts_u AFTER UPDATE ON messages BEGIN
			INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
			INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
		END;

		-- ── Tool Uses FTS ───────────────────────────────────────────────────
		CREATE VIRTUAL TABLE IF NOT EXISTS tool_uses_fts USING fts5(
			input_text,
			tool_name UNINDEXED,
			content=tool_uses,
			content_rowid=id
		);

		CREATE TRIGGER IF NOT EXISTS tool_uses_fts_i AFTER INSERT ON tool_uses BEGIN
			INSERT INTO tool_uses_fts(rowid, input_text, tool_name) VALUES (new.id, new.input_text, new.tool_name);
		END;

		CREATE TRIGGER IF NOT EXISTS tool_uses_fts_d AFTER DELETE ON tool_uses BEGIN
			INSERT INTO tool_uses_fts(tool_uses_fts, rowid, input_text, tool_name) VALUES('delete', old.id, old.input_text, old.tool_name);
		END;

		CREATE TRIGGER IF NOT EXISTS tool_uses_fts_u AFTER UPDATE ON tool_uses BEGIN
			INSERT INTO tool_uses_fts(tool_uses_fts, rowid, input_text, tool_name) VALUES('delete', old.id, old.input_text, old.tool_name);
			INSERT INTO tool_uses_fts(rowid, input_text, tool_name) VALUES (new.id, new.input_text, new.tool_name);
		END;

		-- ── Global History FTS ──────────────────────────────────────────────
		CREATE VIRTUAL TABLE IF NOT EXISTS global_history_fts USING fts5(
			display,
			content=global_history,
			content_rowid=id
		);

		CREATE TRIGGER IF NOT EXISTS global_history_fts_i AFTER INSERT ON global_history BEGIN
			INSERT INTO global_history_fts(rowid, display) VALUES (new.id, new.display);
		END;

		CREATE TRIGGER IF NOT EXISTS global_history_fts_d AFTER DELETE ON global_history BEGIN
			INSERT INTO global_history_fts(global_history_fts, rowid, display) VALUES('delete', old.id, old.display);
		END;

		CREATE TRIGGER IF NOT EXISTS global_history_fts_u AFTER UPDATE ON global_history BEGIN
			INSERT INTO global_history_fts(global_history_fts, rowid, display) VALUES('delete', old.id, old.display);
			INSERT INTO global_history_fts(rowid, display) VALUES (new.id, new.display);
		END;

		-- ── Tasks FTS ───────────────────────────────────────────────────────
		CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
			subject,
			description,
			content=tasks,
			content_rowid=id
		);

		CREATE TRIGGER IF NOT EXISTS tasks_fts_i AFTER INSERT ON tasks BEGIN
			INSERT INTO tasks_fts(rowid, subject, description) VALUES (new.id, new.subject, new.description);
		END;

		CREATE TRIGGER IF NOT EXISTS tasks_fts_d AFTER DELETE ON tasks BEGIN
			INSERT INTO tasks_fts(tasks_fts, rowid, subject, description) VALUES('delete', old.id, old.subject, old.description);
		END;

		CREATE TRIGGER IF NOT EXISTS tasks_fts_u AFTER UPDATE ON tasks BEGIN
			INSERT INTO tasks_fts(tasks_fts, rowid, subject, description) VALUES('delete', old.id, old.subject, old.description);
			INSERT INTO tasks_fts(rowid, subject, description) VALUES (new.id, new.subject, new.description);
		END;

		-- ── Plans FTS ───────────────────────────────────────────────────────
		CREATE VIRTUAL TABLE IF NOT EXISTS plans_fts USING fts5(
			title,
			content,
			content=plans,
			content_rowid=id
		);

		CREATE TRIGGER IF NOT EXISTS plans_fts_i AFTER INSERT ON plans BEGIN
			INSERT INTO plans_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
		END;

		CREATE TRIGGER IF NOT EXISTS plans_fts_d AFTER DELETE ON plans BEGIN
			INSERT INTO plans_fts(plans_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
		END;

		CREATE TRIGGER IF NOT EXISTS plans_fts_u AFTER UPDATE ON plans BEGIN
			INSERT INTO plans_fts(plans_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
			INSERT INTO plans_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
		END;

		-- ── Meta (created here since drizzle-kit can't push alongside FTS tables)
		CREATE TABLE IF NOT EXISTS meta (
			key TEXT PRIMARY KEY,
			value TEXT
		);
	`);
}
