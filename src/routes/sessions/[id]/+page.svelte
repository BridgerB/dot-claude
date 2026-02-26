<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { data } = $props();

	const onSearchInput = (e: Event) => {
		const value = (e.target as HTMLInputElement).value.trim();
		const url = new URL(page.url);
		if (value) url.searchParams.set('q', value);
		else url.searchParams.delete('q');
		url.searchParams.delete('page');
		goto(url.pathname + url.search, { keepFocus: true });
	};

	const pageUrl = (p: number) => `?q=${encodeURIComponent(data.query)}&page=${p}`;

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
</script>

<div class="session-header">
	<h2>{data.session.project}</h2>
	{#if data.session.summary}
		<p class="summary">{data.session.summary}</p>
	{/if}
	<div class="meta">
		{#if data.session.gitBranch}
			<span class="branch">{data.session.gitBranch}</span>
		{/if}
		{#if data.session.startedAt}
			<span class="time">{new Date(data.session.startedAt * 1000).toLocaleDateString()}</span>
		{/if}
	</div>
</div>

<input
	type="text"
	value={data.query}
	placeholder="Search within this session..."
	oninput={onSearchInput}
/>

{#if data.query}
	<p class="results-info">{data.total} results for "{data.query}"</p>
{/if}

{#if data.results.length > 0}
	<table>
		<thead>
			<tr>
				<th>Source</th>
				<th>Content</th>
				<th>Time</th>
			</tr>
		</thead>
		<tbody>
			{#each data.results as r (r.id)}
				<tr>
					<td>
						{#if r.source === 'message' && r.role === 'user'}
							<span class="badge badge-user">you</span>
						{:else if r.source === 'message' && r.role === 'assistant'}
							<span class="badge badge-assistant">claude</span>
						{:else if r.source === 'tool_use'}
							<span class="badge badge-tool">{r.tool_name}</span>
						{/if}
					</td>
					<td class="content" onclick={(e) => e.currentTarget.classList.toggle('expanded')}
						>{r.content}</td
					>
					<td class="time">
						{#if r.timestamp}
							{new Date(r.timestamp * 1000).toLocaleString()}
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	{#if data.totalPages > 1}
		<div class="pagination-row">
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
				<a
					class="nav-btn"
					href={pageUrl(data.page + 1)}
					aria-disabled={data.page >= data.totalPages}>&rsaquo;</a
				>
				<a
					class="nav-btn"
					href={pageUrl(data.totalPages)}
					aria-disabled={data.page >= data.totalPages}>&raquo;</a
				>
			</nav>
			{#if data.showAll}
				<a class="nav-btn show-all" href="?q={encodeURIComponent(data.query)}">Show less</a>
			{:else}
				<a class="nav-btn show-all" href="?q={encodeURIComponent(data.query)}&all=1">Show all</a>
			{/if}
		</div>
	{/if}
{/if}

<style>
	.session-header {
		margin-bottom: 1rem;
	}
	.session-header h2 {
		margin: 0 0 0.25rem;
	}
	.summary {
		color: var(--text-muted);
		margin: 0 0 0.25rem;
		font-size: 0.875rem;
	}
	.meta {
		display: flex;
		gap: 1rem;
		font-size: 0.8125rem;
		color: var(--text-muted);
	}
	.branch {
		font-family: monospace;
	}
	input {
		width: 100%;
		padding: 0.5rem;
		font-size: 1rem;
		margin-bottom: 1rem;
		background: var(--input-bg);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 4px;
	}
	.results-info {
		font-size: 0.875rem;
		color: var(--text-muted);
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
	.badge {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.badge-user {
		background: #dbeafe;
		color: #1e40af;
	}
	.badge-assistant {
		background: #fce7f3;
		color: #9d174d;
	}
	.badge-tool {
		background: #e0e7ff;
		color: #3730a3;
	}
	@media (prefers-color-scheme: dark) {
		.badge-user {
			background: #1e3a5f;
			color: #93c5fd;
		}
		.badge-assistant {
			background: #4a1942;
			color: #f9a8d4;
		}
		.badge-tool {
			background: #312e81;
			color: #a5b4fc;
		}
	}
	.content {
		max-width: 600px;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 4.5em;
		overflow: hidden;
		cursor: pointer;
	}
	.content:global(.expanded) {
		max-height: none;
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
	.pagination-row {
		display: flex;
		align-items: center;
		padding: 0.75rem 0;
	}
	.pagination-row nav {
		flex: 1;
	}
	.show-all {
		flex-shrink: 0;
		margin-left: auto;
	}
	.ellipsis {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.25rem;
		color: var(--text-muted);
	}
</style>
