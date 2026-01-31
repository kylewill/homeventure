import type { PageServerLoad } from './$types';
import type { PropertyStatus } from '$lib/data/properties';

export const load: PageServerLoad = async ({ platform }) => {
	const statuses: Record<number, PropertyStatus> = {};

	if (platform?.env?.KNOCK_DATA) {
		const keys = await platform.env.KNOCK_DATA.list({ prefix: 'status:' });
		for (const key of keys.keys) {
			const value = await platform.env.KNOCK_DATA.get(key.name);
			if (value) {
				const propertyId = parseInt(key.name.replace('status:', ''));
				statuses[propertyId] = JSON.parse(value);
			}
		}
	}

	return { statuses };
};
