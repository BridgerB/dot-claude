<script lang="ts">
	let { data } = $props();

	const pageUrl = (p: number) => `?page=${p}`;

	const pageNumbers = $derived.by(() => {
		const { page, totalPages } = data;
		const pages: (number | '...')[] = [];
		if (totalPages <= 7) {
			for (let i = 1; i <= totalPages; i++) pages.push(i);
			return pages;
		}
		pages.push(1);
		if (page > 3) pages.push('...');
		const start = Math.max(2, page - 1);
		const end = Math.min(totalPages - 1, page + 1);
		for (let i = start; i <= end; i++) pages.push(i);
		if (page < totalPages - 2) pages.push('...');
		pages.push(totalPages);
		return pages;
	});

	const formatDuration = (startTs: number | null, endTs: number | null) => {
		if (!startTs || !endTs) return '';
		const hours = (endTs - startTs) / 3600;
		if (hours < 24) return `${hours.toFixed(1)}h`;
		const days = Math.floor(hours / 24);
		return `${days}d ${(hours % 24).toFixed(1)}h`;
	};
</script>

<p class="total">{data.total} sessions</p>

<table>
	<thead>
		<tr>
			<th>Project</th>
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
				<td><a href="/sessions/{s.id}">{s.project}</a></td>
				<td class="content" onclick={(e) => e.currentTarget.classList.toggle('expanded')}
					>{s.summary ?? ''}</td
				>
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

{#if data.totalPages > 1}
	<nav aria-label="Pagination">
		<a class="nav-btn" href={pageUrl(1)} aria-disabled={data.page <= 1}>&laquo;</a>
		<a class="nav-btn" href={pageUrl(data.page - 1)} aria-disabled={data.page <= 1}>&lsaquo;</a>
		{#each pageNumbers as p (p)}
			{#if p === '...'}
				<span class="ellipsis">&hellip;</span>
			{:else}
				<a class="nav-btn" href={pageUrl(p)} aria-current={p === data.page ? 'page' : undefined}
					>{p}</a
				>
			{/if}
		{/each}
		<a class="nav-btn" href={pageUrl(data.page + 1)} aria-disabled={data.page >= data.totalPages}
			>&rsaquo;</a
		>
		<a class="nav-btn" href={pageUrl(data.totalPages)} aria-disabled={data.page >= data.totalPages}
			>&raquo;</a
		>
	</nav>
{/if}

<style>
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
		max-width: 400px;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 4.5em;
		overflow: hidden;
		cursor: pointer;
	}
	.content:global(.expanded) {
		max-height: none;
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
	nav {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.25rem;
		padding: 0.75rem 0;
	}
	.nav-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 2rem;
		padding: 0.25rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		text-decoration: none;
		color: var(--text);
	}
	.nav-btn:hover:not([aria-disabled='true']):not([aria-current='page']) {
		background: var(--hover);
	}
	.nav-btn[aria-current='page'] {
		background: var(--accent);
		color: var(--accent-text);
		border-color: var(--accent);
		font-weight: bold;
	}
	.nav-btn[aria-disabled='true'] {
		opacity: 0.3;
		pointer-events: none;
	}
	.ellipsis {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.25rem;
		color: var(--text-muted);
	}
</style>
