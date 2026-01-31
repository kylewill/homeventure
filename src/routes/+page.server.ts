import type { PageServerLoad } from './$types';
import type { PropertyStatus, UserProperty } from '$lib/data/properties';

export const load: PageServerLoad = async ({ platform }) => {
	const statuses: Record<string | number, PropertyStatus> = {};
	const userProperties: UserProperty[] = [];

	if (platform?.env?.KNOCK_DATA) {
		// Fetch all statuses
		const statusKeys = await platform.env.KNOCK_DATA.list({ prefix: 'status:' });
		for (const key of statusKeys.keys) {
			const value = await platform.env.KNOCK_DATA.get(key.name);
			if (value) {
				const propertyId = key.name.replace('status:', '');
				// Keep as string if it starts with 'u' (user-added), otherwise parse as number
				const id = propertyId.startsWith('u') ? propertyId : parseInt(propertyId);
				statuses[id] = JSON.parse(value);
			}
		}

		// Fetch all user-added properties
		const propertyKeys = await platform.env.KNOCK_DATA.list({ prefix: 'property:' });
		for (const key of propertyKeys.keys) {
			const value = await platform.env.KNOCK_DATA.get(key.name);
			if (value) {
				userProperties.push(JSON.parse(value));
			}
		}
	}

	return { statuses, userProperties };
};
