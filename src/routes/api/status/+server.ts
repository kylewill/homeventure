import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { PropertyStatus } from '$lib/data/properties';

export const POST: RequestHandler = async ({ request, platform }) => {
	const { propertyId, status } = (await request.json()) as {
		propertyId: number;
		status: PropertyStatus;
	};

	if (!platform?.env?.KNOCK_DATA) {
		return json({ error: 'KV not available' }, { status: 500 });
	}

	await platform.env.KNOCK_DATA.put(`status:${propertyId}`, JSON.stringify(status));

	return json({ success: true });
};

export const GET: RequestHandler = async ({ url, platform }) => {
	const propertyId = url.searchParams.get('propertyId');

	if (!platform?.env?.KNOCK_DATA) {
		return json({ error: 'KV not available' }, { status: 500 });
	}

	if (propertyId) {
		const value = await platform.env.KNOCK_DATA.get(`status:${propertyId}`);
		return json(value ? JSON.parse(value) : null);
	}

	// Return all statuses
	const statuses: Record<number, PropertyStatus> = {};
	const keys = await platform.env.KNOCK_DATA.list({ prefix: 'status:' });
	for (const key of keys.keys) {
		const value = await platform.env.KNOCK_DATA.get(key.name);
		if (value) {
			const id = parseInt(key.name.replace('status:', ''));
			statuses[id] = JSON.parse(value);
		}
	}

	return json(statuses);
};
