<script lang="ts">
	let { form } = $props();
</script>

<h1>Sync Claude Code Data</h1>

<form method="POST">
	<button type="submit">Sync Now</button>
</form>

{#if form?.stats}
	{@const s = form.stats}
	<h2>Done in {s.durationMs}ms</h2>
	<table>
		<tbody>
			<tr><td>Projects</td><td>{s.projects}</td></tr>
			<tr><td>Sessions</td><td>{s.sessions}</td></tr>
			<tr><td>Messages</td><td>{s.messages}</td></tr>
			<tr><td>Tool Uses</td><td>{s.toolUses}</td></tr>
			<tr><td>Global History</td><td>{s.globalHistory}</td></tr>
			<tr><td>Tasks</td><td>{s.tasks}</td></tr>
			<tr><td>Plans</td><td>{s.plans}</td></tr>
		</tbody>
	</table>
{/if}
