import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface AddressSuggestion {
	address: string;
	fullAddress: string;
	lat: number;
	lon: number;
	source: 'nominatim' | 'serper';
}

interface SerperResponse {
	organic?: Array<{
		title: string;
		link: string;
		snippet: string;
	}>;
	knowledgeGraph?: {
		title?: string;
		address?: string;
	};
}

// Geocode an address using Nominatim
async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
	try {
		const params = new URLSearchParams({
			q: address,
			format: 'json',
			limit: '1',
			countrycodes: 'us'
		});

		const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
			headers: {
				'Accept': 'application/json',
				'User-Agent': 'HomeVenture/1.0'
			}
		});

		if (response.ok) {
			const results = await response.json();
			if (results.length > 0) {
				return {
					lat: parseFloat(results[0].lat),
					lon: parseFloat(results[0].lon)
				};
			}
		}
	} catch (e) {
		console.error('Geocode error:', e);
	}
	return null;
}

// Use Gemini to extract Florida addresses from search results
async function extractAddressesWithGemini(
	query: string,
	searchResults: SerperResponse,
	geminiApiKey: string
): Promise<string[]> {
	const organic = searchResults.organic || [];
	const searchText = organic.slice(0, 5).map(r =>
		`Title: ${r.title}\nSnippet: ${r.snippet}`
	).join('\n\n');

	const knowledgeGraph = searchResults.knowledgeGraph;
	const kgText = knowledgeGraph
		? `Knowledge Graph: ${knowledgeGraph.title || ''} - ${knowledgeGraph.address || ''}`
		: '';

	const prompt = `The user searched for: "${query}"

Here are Google search results:
${kgText}

${searchText}

Extract up to 3 Florida property addresses that match the user's search.
Return ONLY a JSON array of full street addresses in Florida, like:
["123 Main St, Jupiter, FL 33458", "456 Oak Ave, Palm Beach Gardens, FL 33410"]

If no valid Florida addresses found, return an empty array: []

Focus on addresses in Jupiter, Palm Beach Gardens, or nearby Palm Beach County areas.
Only include real street addresses, not business names or URLs.

JSON array:`;

	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiApiKey}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: {
						temperature: 0.1,
						maxOutputTokens: 256
					}
				})
			}
		);

		if (!response.ok) {
			console.error('Gemini API error:', response.status);
			return [];
		}

		const data = await response.json();
		const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

		// Extract JSON array from response
		const jsonMatch = text.match(/\[[\s\S]*\]/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);
			if (Array.isArray(parsed)) {
				return parsed.filter(a => typeof a === 'string' && a.length > 5);
			}
		}
	} catch (error) {
		console.error('Gemini extract error:', error);
	}

	return [];
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const { query } = (await request.json()) as { query: string };

	if (!query || query.length < 3) {
		return json({ suggestions: [] });
	}

	const suggestions: AddressSuggestion[] = [];

	// Step 1: Try Nominatim with Florida bias
	try {
		const searchQuery = query.toLowerCase().includes('fl') || query.toLowerCase().includes('florida')
			? query
			: `${query}, Florida`;

		const params = new URLSearchParams({
			q: searchQuery,
			format: 'json',
			addressdetails: '1',
			limit: '5',
			countrycodes: 'us',
			viewbox: '-87.6,24.5,-80.0,31.0',
			bounded: '1'
		});

		const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
			headers: {
				'Accept': 'application/json',
				'User-Agent': 'HomeVenture/1.0'
			}
		});

		if (response.ok) {
			const results = await response.json();
			for (const r of results) {
				if (r.address?.state === 'Florida' || r.display_name.includes('Florida')) {
					const addr = r.address;
					const shortAddr = addr.house_number && addr.road
						? `${addr.house_number} ${addr.road}`
						: addr.road || '';
					const city = addr.city || addr.town || addr.village || '';

					suggestions.push({
						address: shortAddr ? `${shortAddr}, ${city}` : r.display_name.split(',')[0],
						fullAddress: r.display_name,
						lat: parseFloat(r.lat),
						lon: parseFloat(r.lon),
						source: 'nominatim'
					});
				}
			}
		}
	} catch (e) {
		console.error('Nominatim error:', e);
	}

	// Step 2: If few results, try Serper + Gemini
	const serperApiKey = platform?.env?.SERPER_API_KEY;
	const geminiApiKey = platform?.env?.GEMINI_API_KEY;

	if (suggestions.length < 2 && serperApiKey && geminiApiKey) {
		try {
			const searchQuery = `${query} Florida address property`;

			const serperResponse = await fetch('https://google.serper.dev/search', {
				method: 'POST',
				headers: {
					'X-API-KEY': serperApiKey,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					q: searchQuery,
					num: 10,
					gl: 'us'
				})
			});

			if (serperResponse.ok) {
				const serperData = await serperResponse.json() as SerperResponse;

				// Use Gemini to extract addresses
				const extractedAddresses = await extractAddressesWithGemini(query, serperData, geminiApiKey);

				// Geocode each extracted address
				for (const addr of extractedAddresses) {
					// Skip if we already have this address
					if (suggestions.some(s => s.address.toLowerCase().includes(addr.toLowerCase().split(',')[0]))) {
						continue;
					}

					const coords = await geocodeAddress(addr);
					if (coords) {
						suggestions.push({
							address: addr.split(',').slice(0, 2).join(','),
							fullAddress: addr,
							lat: coords.lat,
							lon: coords.lon,
							source: 'serper'
						});
					}
				}
			}
		} catch (e) {
			console.error('Serper/Gemini error:', e);
		}
	}

	return json({ suggestions: suggestions.slice(0, 6) });
};
