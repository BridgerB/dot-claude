<script lang="ts">
	import EChart from '$lib/components/EChart.svelte';

	let { data } = $props();

	const formatNumber = (n: number) => {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
		return String(n);
	};

	const formatDollars = (n: number) => {
		if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
		if (n >= 1) return `$${n.toFixed(2)}`;
		return `$${n.toFixed(3)}`;
	};

	const darkMode =
		typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
	const textColor = darkMode ? '#e0e0e0' : '#111';
	const mutedColor = darkMode ? '#999' : '#666';
	const gridBorderColor = darkMode ? '#333' : '#ddd';

	const tokenChartOptions = $derived({
		tooltip: { trigger: 'axis' as const },
		legend: {
			data: ['Input', 'Output', 'Cache Create', 'Cache Read'],
			top: 0,
			textStyle: { color: textColor }
		},
		grid: { left: 60, right: 20, bottom: 80, top: 40 },
		xAxis: {
			type: 'category' as const,
			data: data.dailyTokens.map((d) => d.day),
			axisLabel: { color: mutedColor, rotate: 45, fontSize: 10 },
			axisLine: { lineStyle: { color: gridBorderColor } }
		},
		yAxis: {
			type: 'value' as const,
			axisLabel: {
				color: mutedColor,
				formatter: (v: number) => formatNumber(v)
			},
			splitLine: { lineStyle: { color: gridBorderColor } }
		},
		series: [
			{
				name: 'Input',
				type: 'bar' as const,
				stack: 'tokens',
				data: data.dailyTokens.map((d) => d.inputTokens),
				itemStyle: { color: '#5470c6' }
			},
			{
				name: 'Output',
				type: 'bar' as const,
				stack: 'tokens',
				data: data.dailyTokens.map((d) => d.outputTokens),
				itemStyle: { color: '#91cc75' }
			},
			{
				name: 'Cache Create',
				type: 'bar' as const,
				stack: 'tokens',
				data: data.dailyTokens.map((d) => d.cacheCreationTokens),
				itemStyle: { color: '#fac858' }
			},
			{
				name: 'Cache Read',
				type: 'bar' as const,
				stack: 'tokens',
				data: data.dailyTokens.map((d) => d.cacheReadTokens),
				itemStyle: { color: '#ee6666' }
			}
		]
	});

	const sessionChartOptions = $derived({
		tooltip: { trigger: 'axis' as const },
		grid: { left: 50, right: 20, bottom: 80, top: 10 },
		xAxis: {
			type: 'category' as const,
			data: data.dailySessions.map((d) => d.day),
			axisLabel: { color: mutedColor, rotate: 45, fontSize: 10 },
			axisLine: { lineStyle: { color: gridBorderColor } }
		},
		yAxis: {
			type: 'value' as const,
			axisLabel: { color: mutedColor },
			splitLine: { lineStyle: { color: gridBorderColor } }
		},
		series: [
			{
				type: 'bar' as const,
				data: data.dailySessions.map((d) => d.count),
				itemStyle: { color: '#5470c6' }
			}
		]
	});

	const promptsChartOptions = $derived({
		tooltip: { trigger: 'axis' as const },
		grid: { left: 50, right: 20, bottom: 80, top: 10 },
		xAxis: {
			type: 'category' as const,
			data: data.dailyPrompts.map((d) => d.day),
			axisLabel: { color: mutedColor, rotate: 45, fontSize: 10 },
			axisLine: { lineStyle: { color: gridBorderColor } }
		},
		yAxis: {
			type: 'value' as const,
			axisLabel: { color: mutedColor },
			splitLine: { lineStyle: { color: gridBorderColor } }
		},
		series: [
			{
				type: 'bar' as const,
				data: data.dailyPrompts.map((d) => d.count),
				itemStyle: { color: '#5470c6' }
			}
		]
	});

	const responsesChartOptions = $derived({
		tooltip: { trigger: 'axis' as const },
		grid: { left: 50, right: 20, bottom: 80, top: 10 },
		xAxis: {
			type: 'category' as const,
			data: data.dailyResponses.map((d) => d.day),
			axisLabel: { color: mutedColor, rotate: 45, fontSize: 10 },
			axisLine: { lineStyle: { color: gridBorderColor } }
		},
		yAxis: {
			type: 'value' as const,
			axisLabel: { color: mutedColor },
			splitLine: { lineStyle: { color: gridBorderColor } }
		},
		series: [
			{
				type: 'bar' as const,
				data: data.dailyResponses.map((d) => d.count),
				itemStyle: { color: '#91cc75' }
			}
		]
	});

	const toolChartOptions = $derived({
		tooltip: { trigger: 'item' as const },
		grid: { left: 120, right: 20, bottom: 10, top: 10 },
		xAxis: {
			type: 'value' as const,
			axisLabel: { color: mutedColor, formatter: (v: number) => formatNumber(v) },
			splitLine: { lineStyle: { color: gridBorderColor } }
		},
		yAxis: {
			type: 'category' as const,
			data: data.toolUsage
				.slice(0, 15)
				.map((d) => d.toolName)
				.reverse(),
			axisLabel: { color: mutedColor }
		},
		series: [
			{
				type: 'bar' as const,
				data: data.toolUsage
					.slice(0, 15)
					.map((d) => d.count)
					.reverse(),
				itemStyle: { color: '#91cc75' }
			}
		]
	});

	const modelChartOptions = $derived({
		tooltip: { trigger: 'item' as const },
		series: [
			{
				type: 'pie' as const,
				radius: ['40%', '70%'],
				avoidLabelOverlap: true,
				label: { color: textColor },
				data: data.modelUsage.map((d) => ({
					value: d.count,
					name: d.model.replace('claude-', '').replace('-20250514', '')
				}))
			}
		]
	});

	const hourlyChartOptions = $derived({
		tooltip: { trigger: 'axis' as const },
		grid: { left: 50, right: 20, bottom: 30, top: 10 },
		xAxis: {
			type: 'category' as const,
			data: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')),
			axisLabel: { color: mutedColor },
			axisLine: { lineStyle: { color: gridBorderColor } }
		},
		yAxis: {
			type: 'value' as const,
			axisLabel: { color: mutedColor },
			splitLine: { lineStyle: { color: gridBorderColor } }
		},
		series: [
			{
				type: 'bar' as const,
				data: (() => {
					const map = new Map(data.hourlyActivity.map((d) => [d.hour, d.count]));
					return Array.from({ length: 24 }, (_, i) => map.get(String(i).padStart(2, '0')) ?? 0);
				})(),
				itemStyle: { color: '#fac858' }
			}
		]
	});

	// ── Pricing charts ────────────────────────────────────────────────────────

	const dailyCostOptions = $derived({
		tooltip: {
			trigger: 'axis' as const,
			valueFormatter: ((v: number) => `$${v.toFixed(2)}`) as never
		},
		grid: { left: 60, right: 20, bottom: 80, top: 10 },
		xAxis: {
			type: 'category' as const,
			data: data.dailyCost.map((d) => d.day),
			axisLabel: { color: mutedColor, rotate: 45, fontSize: 10 },
			axisLine: { lineStyle: { color: gridBorderColor } }
		},
		yAxis: {
			type: 'value' as const,
			axisLabel: {
				color: mutedColor,
				formatter: (v: number) => `$${v}`
			},
			splitLine: { lineStyle: { color: gridBorderColor } }
		},
		series: [
			{
				type: 'bar' as const,
				data: data.dailyCost.map((d) => d.cost),
				itemStyle: { color: '#ee6666' }
			}
		]
	});

	const cumulativeCostOptions = $derived(() => {
		let running = 0;
		const cumulative = data.dailyCost.map((d) => {
			running += d.cost;
			return { day: d.day, cost: Math.round(running * 100) / 100 };
		});
		return {
			tooltip: {
				trigger: 'axis' as const,
				valueFormatter: ((v: number) => `$${v.toFixed(2)}`) as never
			},
			grid: { left: 60, right: 20, bottom: 80, top: 10 },
			xAxis: {
				type: 'category' as const,
				data: cumulative.map((d) => d.day),
				axisLabel: { color: mutedColor, rotate: 45, fontSize: 10 },
				axisLine: { lineStyle: { color: gridBorderColor } }
			},
			yAxis: {
				type: 'value' as const,
				axisLabel: {
					color: mutedColor,
					formatter: (v: number) => formatDollars(v)
				},
				splitLine: { lineStyle: { color: gridBorderColor } }
			},
			series: [
				{
					type: 'line' as const,
					data: cumulative.map((d) => d.cost),
					areaStyle: { opacity: 0.15 },
					itemStyle: { color: '#ee6666' },
					smooth: true
				}
			]
		};
	});

	const costByModelOptions = $derived({
		tooltip: { trigger: 'item' as const, valueFormatter: ((v: number) => `$${v.toFixed(2)}`) as never },
		series: [
			{
				type: 'pie' as const,
				radius: ['40%', '70%'],
				avoidLabelOverlap: true,
				label: { color: textColor },
				data: data.costByModel.map((d) => ({
					value: d.cost,
					name: d.model.replace('claude-', '').replace(/-20\d{6}$/, '')
				}))
			}
		]
	});

	const costByCategoryOptions = $derived({
		tooltip: { trigger: 'item' as const, valueFormatter: ((v: number) => `$${v.toFixed(2)}`) as never },
		series: [
			{
				type: 'pie' as const,
				radius: ['40%', '70%'],
				avoidLabelOverlap: true,
				label: { color: textColor },
				data: [
					{ value: data.costByCategory.input, name: 'Input', itemStyle: { color: '#5470c6' } },
					{ value: data.costByCategory.output, name: 'Output', itemStyle: { color: '#91cc75' } },
					{ value: data.costByCategory.cacheWrite, name: 'Cache Write', itemStyle: { color: '#fac858' } },
					{ value: data.costByCategory.cacheRead, name: 'Cache Read', itemStyle: { color: '#ee6666' } }
				].filter((d) => d.value > 0)
			}
		]
	});

	const projectCostOptions = $derived({
		tooltip: {
			trigger: 'axis' as const,
			valueFormatter: ((v: number) => `$${v.toFixed(2)}`) as never
		},
		grid: { left: 120, right: 20, bottom: 10, top: 10 },
		xAxis: {
			type: 'value' as const,
			axisLabel: {
				color: mutedColor,
				formatter: (v: number) => formatDollars(v)
			},
			splitLine: { lineStyle: { color: gridBorderColor } }
		},
		yAxis: {
			type: 'category' as const,
			data: data.topProjectsByCost.map((d) => d.name).reverse(),
			axisLabel: { color: mutedColor }
		},
		series: [
			{
				type: 'bar' as const,
				data: data.topProjectsByCost.map((d) => d.cost).reverse(),
				itemStyle: { color: '#ee6666' }
			}
		]
	});

	const projectChartOptions = $derived({
		tooltip: { trigger: 'axis' as const },
		legend: { data: ['Input', 'Output'], textStyle: { color: textColor } },
		grid: { left: 120, right: 20, bottom: 10, top: 30 },
		xAxis: {
			type: 'value' as const,
			axisLabel: {
				color: mutedColor,
				formatter: (v: number) => formatNumber(v)
			},
			splitLine: { lineStyle: { color: gridBorderColor } }
		},
		yAxis: {
			type: 'category' as const,
			data: data.topProjects.map((d) => d.name).reverse(),
			axisLabel: { color: mutedColor }
		},
		series: [
			{
				name: 'Input',
				type: 'bar' as const,
				stack: 'tokens',
				data: data.topProjects.map((d) => d.inputTokens).reverse(),
				itemStyle: { color: '#5470c6' }
			},
			{
				name: 'Output',
				type: 'bar' as const,
				stack: 'tokens',
				data: data.topProjects.map((d) => d.outputTokens).reverse(),
				itemStyle: { color: '#91cc75' }
			}
		]
	});
</script>

<div class="stats-grid">
	<div class="stat-card">
		<div class="stat-value">{formatNumber(data.summary.totalSessions)}</div>
		<div class="stat-label">Sessions</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">{formatNumber(data.summary.promptsSent)}</div>
		<div class="stat-label">Prompts Sent</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">{formatNumber(data.summary.responsesReceived)}</div>
		<div class="stat-label">Responses</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">{formatNumber(data.summary.totalToolUses)}</div>
		<div class="stat-label">Tool Uses</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">
			{formatNumber(data.summary.totalInputTokens + data.summary.totalOutputTokens)}
		</div>
		<div class="stat-label">Total Tokens</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">{formatNumber(data.summary.totalProjects)}</div>
		<div class="stat-label">Projects</div>
	</div>
</div>

<div class="charts-grid">
	<div class="chart-card full">
		<h3>Token Usage by Day</h3>
		<EChart options={tokenChartOptions} height="350px" />
	</div>

	<div class="chart-card">
		<h3>Sessions per Day</h3>
		<EChart options={sessionChartOptions} height="300px" />
	</div>

	<div class="chart-card">
		<h3>Activity by Hour</h3>
		<EChart options={hourlyChartOptions} height="300px" />
	</div>

	<div class="chart-card">
		<h3>Prompts Sent per Day</h3>
		<EChart options={promptsChartOptions} height="300px" />
	</div>

	<div class="chart-card">
		<h3>Responses Received per Day</h3>
		<EChart options={responsesChartOptions} height="300px" />
	</div>

	<div class="chart-card">
		<h3>Tool Usage</h3>
		<EChart options={toolChartOptions} height="400px" />
	</div>

	<div class="chart-card">
		<h3>Model Distribution</h3>
		<EChart options={modelChartOptions} height="400px" />
	</div>

	<div class="chart-card full">
		<h3>Top Projects by Tokens</h3>
		<EChart options={projectChartOptions} height="350px" />
	</div>
</div>

<h2 class="section-heading">Estimated Costs</h2>

<div class="stats-grid">
	<div class="stat-card">
		<div class="stat-value">${data.totalCost.toFixed(2)}</div>
		<div class="stat-label">Total Estimated Cost</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">${data.costByCategory.input.toFixed(2)}</div>
		<div class="stat-label">Input Tokens</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">${data.costByCategory.output.toFixed(2)}</div>
		<div class="stat-label">Output Tokens</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">${data.costByCategory.cacheWrite.toFixed(2)}</div>
		<div class="stat-label">Cache Writes</div>
	</div>
	<div class="stat-card">
		<div class="stat-value">${data.costByCategory.cacheRead.toFixed(2)}</div>
		<div class="stat-label">Cache Reads</div>
	</div>
</div>

<div class="charts-grid">
	<div class="chart-card full">
		<h3>Estimated Daily Cost</h3>
		<EChart options={dailyCostOptions} height="350px" />
	</div>

	<div class="chart-card full">
		<h3>Cumulative Cost</h3>
		<EChart options={cumulativeCostOptions()} height="350px" />
	</div>

	<div class="chart-card">
		<h3>Cost by Model</h3>
		<EChart options={costByModelOptions} height="350px" />
	</div>

	<div class="chart-card">
		<h3>Cost by Category</h3>
		<EChart options={costByCategoryOptions} height="350px" />
	</div>

	<div class="chart-card full">
		<h3>Top Projects by Cost</h3>
		<EChart options={projectCostOptions} height="350px" />
	</div>
</div>

<style>
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	.stat-card {
		background: var(--bg-subtle);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 1rem;
		text-align: center;
	}
	.stat-value {
		font-size: 1.75rem;
		font-weight: 700;
	}
	.stat-label {
		font-size: 0.8125rem;
		color: var(--text-muted);
		margin-top: 0.25rem;
	}
	.charts-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}
	.chart-card {
		background: var(--bg-subtle);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 1rem;
	}
	.chart-card.full {
		grid-column: 1 / -1;
	}
	.chart-card h3 {
		margin: 0 0 0.5rem;
		font-size: 0.9375rem;
		font-weight: 600;
	}
	.section-heading {
		margin: 2rem 0 1rem;
		font-size: 1.25rem;
		font-weight: 700;
		border-bottom: 1px solid var(--border);
		padding-bottom: 0.5rem;
	}
	@media (max-width: 768px) {
		.charts-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
