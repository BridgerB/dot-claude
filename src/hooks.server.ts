import { building } from '$app/environment';
import { isSyncStale, sync } from '$lib/server/etl';

if (!building) {
	if (isSyncStale()) {
		console.log('[etl] Data is stale, syncing...');
		const stats = sync();
		console.log(
			`[etl] Synced in ${stats.durationMs}ms — ${stats.messages} messages, ${stats.toolUses} tool uses`
		);
	} else {
		console.log('[etl] Data is fresh, skipping sync');
	}
}
