<script lang="ts">
	let { data } = $props();

	const formatDuration = (startTs: number | null, endTs: number | null) => {
		if (!startTs || !endTs) return '';
		const hours = (endTs - startTs) / 3600;
		if (hours < 24) return `${hours.toFixed(1)}h`;
		const days = Math.floor(hours / 24);
		return `${days}d ${(hours % 24).toFixed(1)}h`;
	};
</script>

<div class="project-header">
	<h2>{data.project.name}</h2>
	<p class="path">{data.project.path}</p>
</div>

<p class="total">{data.sessions.length} sessions</p>

<table>
	<thead>
		<tr>
			<th>Summary</th>
			<th>Messages</th>
			<th>Duration</th>
			<th>Branch</th>
			<th>Started</th>
		</tr>
	</thead>
	<tbody>
		{#each data.sessions as s (s.id)}
			<tr>
				<td class="content">
					<a href="/sessions/{s.id}">{s.summary ?? '(no summary)'}</a>
				</td>
				<td class="num">{s.messageCount}</td>
				<td class="num">{formatDuration(s.startedAt, s.endedAt)}</td>
				<td class="branch">{s.gitBranch ?? ''}</td>
				<td class="time">
					{#if s.startedAt}
						{new Date(s.startedAt * 1000).toLocaleDateString()}
					{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	.project-header {
		margin-bottom: 1rem;
	}
	.project-header h2 {
		margin: 0 0 0.25rem;
	}
	.path {
		font-family: monospace;
		font-size: 0.8125rem;
		color: var(--text-muted);
		margin: 0;
	}
	.total {
		color: var(--text-muted);
		font-size: 0.875rem;
		margin: 0 0 0.75rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}
	th,
	td {
		border: 1px solid var(--border);
		padding: 0.5rem;
		text-align: left;
		vertical-align: top;
	}
	th {
		background: var(--bg-subtle);
	}
	.content {
		max-width: 500px;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.num {
		text-align: right;
		white-space: nowrap;
	}
	.branch {
		font-family: monospace;
		font-size: 0.8125rem;
		white-space: nowrap;
	}
	.time {
		white-space: nowrap;
		color: var(--text-muted);
	}
	a {
		text-decoration: none;
	}
	a:hover {
		text-decoration: underline;
	}
</style>
