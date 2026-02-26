<script lang="ts">
	import { page } from '$app/state';
</script>

<nav class="navbar">
	<a class="brand" href="/">Claude Code</a>
	<div class="tabs">
		<a class="tab" href="/" aria-current={page.url.pathname === '/' ? 'page' : undefined}>Search</a>
		<a
			class="tab"
			href="/sessions"
			aria-current={page.url.pathname.startsWith('/sessions') ? 'page' : undefined}>Sessions</a
		>
		<a
			class="tab"
			href="/projects"
			aria-current={page.url.pathname.startsWith('/projects') ? 'page' : undefined}>Projects</a
		>
		<a
			class="tab"
			href="/reports"
			aria-current={page.url.pathname.startsWith('/reports') ? 'page' : undefined}>Reports</a
		>
	</div>
</nav>

<style>
	.navbar {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 0.5rem 0;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--border);
	}
	.brand {
		font-weight: 700;
		font-size: 1.125rem;
		text-decoration: none;
		color: var(--text);
		white-space: nowrap;
	}
	.tabs {
		display: flex;
		gap: 0.25rem;
	}
	.tab {
		padding: 0.375rem 0.75rem;
		border-radius: 4px;
		text-decoration: none;
		font-size: 0.875rem;
		color: var(--text-muted);
	}
	.tab:hover {
		background: var(--hover);
		color: var(--text);
	}
	.tab[aria-current='page'] {
		background: var(--bg-subtle);
		color: var(--text);
		font-weight: 600;
	}
</style>
