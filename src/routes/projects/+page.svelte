<script lang="ts">
	let { data } = $props();
</script>

<p class="total">{data.projects.length} projects</p>

<table>
	<thead>
		<tr>
			<th>Project</th>
			<th>Path</th>
			<th>Sessions</th>
			<th>Messages</th>
			<th>First</th>
			<th>Last</th>
		</tr>
	</thead>
	<tbody>
		{#each data.projects as p (p.id)}
			<tr>
				<td><a href="/projects/{p.id}">{p.name}</a></td>
				<td class="path">{p.path}</td>
				<td class="num">{p.sessionCount}</td>
				<td class="num">{p.messageCount}</td>
				<td class="time">
					{#if p.firstSession}
						{new Date(p.firstSession * 1000).toLocaleDateString()}
					{/if}
				</td>
				<td class="time">
					{#if p.lastSession}
						{new Date(p.lastSession * 1000).toLocaleDateString()}
					{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>

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
	.path {
		font-family: monospace;
		font-size: 0.8125rem;
		color: var(--text-muted);
	}
	.num {
		text-align: right;
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
