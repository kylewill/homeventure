import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface SerperResult {
	title: string;
	link: string;
	snippet: string;
}

interface SerperResponse {
	organic: SerperResult[];
}

interface EnrichedProperty {
	beds?: number;
	baths?: number;
	sqFt?: number;
	yearBuilt?: number;
	price?: number;
	hasPool?: boolean;
	construction?: string;
	source?: string;
	sourceUrl?: string;
}

// Use Gemini Flash to parse property details from search results
async function parseWithGemini(results: SerperResult[], geminiApiKey: string): Promise<EnrichedProperty> {
	const searchText = results.map(r => `Title: ${r.title}\nSnippet: ${r.snippet}\nURL: ${r.link}`).join('\n\n');

	const prompt = `Extract property details from these real estate search results. Return ONLY valid JSON with these fields (use null for unknown values):
{
  "beds": number or null,
  "baths": number or null,
  "sqFt": number or null,
  "yearBuilt": number or null,
  "price": number or null,
  "hasPool": boolean,
  "construction": string or null,
  "source": "zillow" or "redfin" or "realtor" or null
}

Search results:
${searchText}

JSON response:`;

	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
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
			return {};
		}

		const data = await response.json();
		const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

		// Extract JSON from response (handle markdown code blocks)
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]);
			// Clean up null values
			const enriched: EnrichedProperty = {};
			if (parsed.beds !== null) enriched.beds = parsed.beds;
			if (parsed.baths !== null) enriched.baths = parsed.baths;
			if (parsed.sqFt !== null) enriched.sqFt = parsed.sqFt;
			if (parsed.yearBuilt !== null) enriched.yearBuilt = parsed.yearBuilt;
			if (parsed.price !== null) enriched.price = parsed.price;
			if (parsed.hasPool) enriched.hasPool = parsed.hasPool;
			if (parsed.construction) enriched.construction = parsed.construction;
			if (parsed.source) enriched.source = parsed.source;
			return enriched;
		}
	} catch (error) {
		console.error('Gemini parse error:', error);
	}

	return {};
}

// Fallback regex parsing if Gemini is unavailable
function parsePropertyDetails(results: SerperResult[]): EnrichedProperty {
	const enriched: EnrichedProperty = {};
	const allText = results.map(r => `${r.title} ${r.snippet}`).join(' ').toLowerCase();

	const bedsMatch = allText.match(/(\d+)\s*(?:bed|bd|bedroom|br)\b/i);
	if (bedsMatch) enriched.beds = parseInt(bedsMatch[1]);

	const bathsMatch = allText.match(/(\d+(?:\.\d+)?)\s*(?:bath|ba|bathroom)\b/i);
	if (bathsMatch) enriched.baths = parseFloat(bathsMatch[1]);

	const sqftMatch = allText.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:sqft|sq\s*ft|square\s*feet)/i);
	if (sqftMatch) enriched.sqFt = parseInt(sqftMatch[1].replace(/,/g, ''));

	const yearMatch = allText.match(/(?:built\s*(?:in\s*)?|year\s*built[:\s]*)(19\d{2}|20\d{2})/i);
	if (yearMatch) enriched.yearBuilt = parseInt(yearMatch[1]);

	const priceMatch = allText.match(/\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*([kmb])?/i);
	if (priceMatch) {
		let price = parseFloat(priceMatch[1].replace(/,/g, ''));
		const suffix = priceMatch[2]?.toLowerCase();
		if (suffix === 'k') price *= 1000;
		else if (suffix === 'm') price *= 1000000;
		enriched.price = price;
	}

	if (allText.includes('pool')) enriched.hasPool = true;

	const zillowResult = results.find(r => r.link.includes('zillow.com'));
	const redfinResult = results.find(r => r.link.includes('redfin.com'));
	const realtorResult = results.find(r => r.link.includes('realtor.com'));

	if (zillowResult) {
		enriched.source = 'Zillow';
		enriched.sourceUrl = zillowResult.link;
	} else if (redfinResult) {
		enriched.source = 'Redfin';
		enriched.sourceUrl = redfinResult.link;
	} else if (realtorResult) {
		enriched.source = 'Realtor';
		enriched.sourceUrl = realtorResult.link;
	}

	return enriched;
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const { address } = (await request.json()) as { address: string };

	if (!address) {
		return json({ error: 'Address is required' }, { status: 400 });
	}

	// Get API keys from environment
	const serperApiKey = platform?.env?.SERPER_API_KEY;
	const geminiApiKey = platform?.env?.GEMINI_API_KEY;

	if (!serperApiKey) {
		// Return empty enrichment if no API key (user will fill in manually)
		return json({ enriched: {}, message: 'No Serper API key configured' });
	}

	try {
		// Search for property on real estate sites
		const query = `${address} zillow OR redfin beds baths sqft price`;

		const response = await fetch('https://google.serper.dev/search', {
			method: 'POST',
			headers: {
				'X-API-KEY': serperApiKey,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				q: query,
				num: 5
			})
		});

		if (!response.ok) {
			console.error('Serper API error:', response.status);
			return json({ enriched: {}, message: 'Serper API error' });
		}

		const data = await response.json() as SerperResponse;
		const results = data.organic || [];

		// Use Gemini for parsing if available, otherwise fall back to regex
		let enriched: EnrichedProperty;
		if (geminiApiKey && results.length > 0) {
			enriched = await parseWithGemini(results, geminiApiKey);
			// If Gemini didn't find much, try regex as backup
			if (Object.keys(enriched).length < 2) {
				const regexEnriched = parsePropertyDetails(results);
				enriched = { ...regexEnriched, ...enriched };
			}
		} else {
			enriched = parsePropertyDetails(results);
		}

		return json({ enriched, results: results.slice(0, 3) });
	} catch (error) {
		console.error('Enrichment error:', error);
		return json({ enriched: {}, message: 'Failed to enrich property' });
	}
};
