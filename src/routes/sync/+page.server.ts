import { sync } from '$lib/server/etl';
import type { Actions } from './$types';

export const actions = {
	default: async () => {
		const stats = sync();
		return { stats };
	}
} satisfies Actions;
