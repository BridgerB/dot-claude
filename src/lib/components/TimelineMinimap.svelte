<script lang="ts">
	interface Props {
		timeRange: { min: number | null; max: number | null };
		matchTimestamps: number[];
	}

	let { timeRange, matchTimestamps }: Props = $props();

	let canvas: HTMLCanvasElement | undefined = $state();
	let containerHeight = $state(0);

	const CANVAS_WIDTH = 48;
	const MARK_COLOR = '#f59e0b';

	const ticks = $derived.by(() => {
		if (timeRange.min == null || timeRange.max == null) return [];
		const result: { ts: number; label: string; isYear: boolean }[] = [];
		const minDate = new Date(timeRange.min * 1000);
		const maxDate = new Date(timeRange.max * 1000);
		let current = new Date(minDate.getFullYear(), minDate.getMonth() + 1, 1);
		while (current <= maxDate) {
			const isYear = current.getMonth() === 0;
			const label = isYear
				? current.getFullYear().toString()
				: current.toLocaleDateString('en', { month: 'short' });
			result.push({ ts: Math.floor(current.getTime() / 1000), label, isYear });
			current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
		}
		return result;
	});

	$effect(() => {
		void timeRange;
		void matchTimestamps;
		void containerHeight;
		void ticks;
		draw();
	});

	const draw = () => {
		if (!canvas || timeRange.min == null || timeRange.max == null || containerHeight <= 0) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		const h = containerHeight;
		const w = CANVAS_WIDTH;
		canvas.width = w * dpr;
		canvas.height = h * dpr;
		canvas.style.width = `${w}px`;
		canvas.style.height = `${h}px`;
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, w, h);

		const span = timeRange.max - timeRange.min;
		if (span <= 0) return;

		const style = getComputedStyle(canvas);
		const mutedColor = style.getPropertyValue('--text-muted').trim() || '#666';
		const textColor = style.getPropertyValue('--text').trim() || '#111';

		for (const tick of ticks) {
			const y = ((timeRange.max! - tick.ts) / span) * h;
			ctx.strokeStyle = tick.isYear ? textColor : mutedColor;
			ctx.lineWidth = tick.isYear ? 1.5 : 0.5;
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(tick.isYear ? 14 : 8, y);
			ctx.stroke();

			ctx.fillStyle = tick.isYear ? textColor : mutedColor;
			ctx.font = tick.isYear ? 'bold 9px system-ui' : '8px system-ui';
			ctx.textBaseline = 'middle';
			ctx.fillText(tick.label, tick.isYear ? 16 : 10, y);
		}

		ctx.fillStyle = MARK_COLOR;
		ctx.globalAlpha = 0.7;
		for (const ts of matchTimestamps) {
			const y = ((timeRange.max! - ts) / span) * h;
			ctx.fillRect(w - 6, Math.round(y) - 1, 6, 2);
		}
		ctx.globalAlpha = 1;
	};
</script>

<div class="minimap" bind:clientHeight={containerHeight}>
	<canvas bind:this={canvas}></canvas>
</div>

<style>
	.minimap {
		position: sticky;
		top: 1rem;
		align-self: start;
		width: 48px;
		min-height: 300px;
		height: calc(100vh - 2rem);
	}
	canvas {
		display: block;
	}
	@media (max-width: 768px) {
		.minimap {
			display: none;
		}
	}
</style>
