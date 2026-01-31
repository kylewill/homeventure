import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export interface UserProperty {
	id: string; // UUID for user-added properties
	address: string;
	notes: string;
	beds: number | null;
	baths: number | null;
	sqFt: number | null;
	yearBuilt: number | null;
	construction: string;
	hasPool: boolean;
	poolType: string;
	price: number | null;
	lat: number;
	lon: number;
	createdAt: string;
	updatedAt: string;
	source?: string; // Where the enrichment data came from
}

// Save a new user-added property
export const POST: RequestHandler = async ({ request, platform }) => {
	const body = (await request.json()) as Omit<UserProperty, 'id' | 'createdAt' | 'updatedAt'> & { initialStatus?: string };
	const { initialStatus, ...property } = body;

	if (!platform?.env?.KNOCK_DATA) {
		return json({ error: 'KV not available' }, { status: 500 });
	}

	// Generate a unique ID for user properties (prefixed with 'u' to distinguish from hardcoded)
	const id = `u${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

	const fullProperty: UserProperty = {
		...property,
		id,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};

	// Store in KV with prefix 'property:'
	await platform.env.KNOCK_DATA.put(`property:${id}`, JSON.stringify(fullProperty));

	// Set initial status (default to 'active' if not provided)
	await platform.env.KNOCK_DATA.put(`status:${id}`, JSON.stringify({
		status: initialStatus || 'active',
		notes: property.notes || '',
		knockedDate: null,
		updatedAt: new Date().toISOString()
	}));

	return json({ success: true, property: fullProperty });
};

// Get all user-added properties
export const GET: RequestHandler = async ({ platform }) => {
	if (!platform?.env?.KNOCK_DATA) {
		return json({ error: 'KV not available' }, { status: 500 });
	}

	const properties: UserProperty[] = [];
	const keys = await platform.env.KNOCK_DATA.list({ prefix: 'property:' });

	for (const key of keys.keys) {
		const value = await platform.env.KNOCK_DATA.get(key.name);
		if (value) {
			properties.push(JSON.parse(value));
		}
	}

	return json({ properties });
};

// Delete a user-added property
export const DELETE: RequestHandler = async ({ request, platform }) => {
	const { id } = (await request.json()) as { id: string };

	if (!platform?.env?.KNOCK_DATA) {
		return json({ error: 'KV not available' }, { status: 500 });
	}

	// Only allow deleting user-added properties (id starts with 'u')
	if (!id.startsWith('u')) {
		return json({ error: 'Cannot delete hardcoded properties' }, { status: 400 });
	}

	await platform.env.KNOCK_DATA.delete(`property:${id}`);
	await platform.env.KNOCK_DATA.delete(`status:${id}`);

	return json({ success: true });
};
