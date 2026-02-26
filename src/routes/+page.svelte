<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { data, form } = $props();
	let syncing = $state(false);

	const onSearchInput = (e: Event) => {
		const value = (e.target as HTMLInputElement).value.trim();
		const url = new URL(page.url);
		if (value) {
			url.searchParams.set('q', value);
		} else {
			url.searchParams.delete('q');
		}
		url.searchParams.delete('page');
		goto(url.pathname + url.search, { keepFocus: true });
	};

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

	const pageUrl = (p: number) => `?q=${encodeURIComponent(data.query)}&page=${p}`;
</script>

<header>
	<h1>Claude Code Search</h1>
	<div class="sync-area">
		{#if form?.stats}
			<span class="sync-result">{form.stats.messages} msgs in {form.stats.durationMs}ms</span>
		{/if}
		<form
			method="POST"
			action="?/sync"
			use:enhance={() => {
				syncing = true;
				return async ({ update }) => {
					syncing = false;
					await update();
				};
			}}
		>
			<button class="sync-btn" disabled={syncing}>{syncing ? 'Syncing...' : 'Sync'}</button>
		</form>
	</div>
</header>

<input
	type="text"
	value={data.query}
	placeholder="Search messages, tools, history..."
	oninput={onSearchInput}
/>

{#if data.query}
	<p>{data.total} results for "{data.query}" — page {data.page} of {data.totalPages}</p>
{/if}

{#if data.results.length > 0}
	{#snippet pagination()}
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
		{/if}
	{/snippet}

	<table>
		<thead>
			<tr>
				<th>Source</th>
				<th>Project</th>
				<th>Content</th>
				<th>Time</th>
			</tr>
		</thead>
		<tbody>
			{#each data.results as r (r.id)}
				<tr>
					<td>
						{#if r.source === 'message'}
							{r.role}
						{:else if r.source === 'tool_use'}
							{r.tool_name}
						{:else}
							history
						{/if}
					</td>
					<td>{r.project ?? ''}</td>
					<td class="content" onclick={(e) => e.currentTarget.classList.toggle('expanded')}
						>{r.content}</td
					>
					<td class="time">
						{#if r.timestamp}
							{new Date(r.timestamp * 1000).toLocaleDateString()}
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<div class="pagination-row">
		{@render pagination()}
		<a class="nav-btn show-all" href="?q={encodeURIComponent(data.query)}&all=1">Show all</a>
	</div>
{/if}

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}
	header h1 {
		margin: 0;
	}
	.sync-area {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.sync-result {
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.sync-btn {
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg);
		color: var(--text);
		font-size: 0.875rem;
		cursor: pointer;
	}
	.sync-btn:hover:not(:disabled) {
		background: var(--hover);
	}
	.sync-btn:disabled {
		opacity: 0.5;
		cursor: default;
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
	.pagination-row {
		display: flex;
		align-items: center;
		padding: 0.75rem 0;
	}
	.pagination-row nav {
		flex: 1;
		padding: 0;
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
</style>
