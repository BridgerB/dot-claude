<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { ECharts, EChartsOption } from 'echarts';

	interface Props {
		options: EChartsOption;
		height?: string;
	}

	let { options, height = '400px' }: Props = $props();

	let container: HTMLDivElement | undefined = $state();
	let chart: ECharts | undefined = $state();
	let ro: ResizeObserver | undefined;

	onMount(() => {
		import('echarts').then((echarts) => {
			if (!container) return;
			chart = echarts.init(container, undefined, { renderer: 'canvas' });
			chart.setOption(options);
			ro = new ResizeObserver(() => chart?.resize());
			ro.observe(container);
		});
	});

	onDestroy(() => {
		ro?.disconnect();
		chart?.dispose();
	});

	$effect(() => {
		if (chart && options) chart.setOption(options, { notMerge: true });
	});
</script>

<div bind:this={container} style:height style:width="100%"></div>
