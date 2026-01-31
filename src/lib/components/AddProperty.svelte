<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		close: void;
		added: { property: any };
	}>();

	interface AddressSuggestion {
		address: string;
		fullAddress: string;
		lat: number;
		lon: number;
	}

	const RADAR_PUB_KEY = 'prj_live_pk_b3f47297c9abc2aa722aae5006258a27e85b51c3';
	// Jupiter, FL coordinates for biasing results
	const JUPITER_LAT = 26.9342;
	const JUPITER_LON = -80.0942;

	let searchQuery = $state('');
	let suggestions = $state<AddressSuggestion[]>([]);
	let selectedAddress = $state<AddressSuggestion | null>(null);
	let isSearching = $state(false);
	let isEnriching = $state(false);
	let isSaving = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout>;
	let showSuggestions = $state(false);

	// Form fields
	let beds = $state<number | null>(null);
	let baths = $state<number | null>(null);
	let sqFt = $state<number | null>(null);
	let yearBuilt = $state<number | null>(null);
	let price = $state<number | null>(null);
	let hasPool = $state(false);
	let notes = $state('');
	let enrichmentSource = $state('');
	let enrichmentUrl = $state('');
	let showManualCoords = $state(false);
	let manualLat = $state<number | null>(null);
	let manualLon = $state<number | null>(null);

	function clearSelection() {
		selectedAddress = null;
		showManualCoords = false;
		manualLat = null;
		manualLon = null;
		beds = null;
		baths = null;
		sqFt = null;
		yearBuilt = null;
		price = null;
		hasPool = false;
		enrichmentSource = '';
		enrichmentUrl = '';
	}

	function getEffectiveLat(): number {
		return manualLat ?? selectedAddress?.lat ?? 0;
	}

	function getEffectiveLon(): number {
		return manualLon ?? selectedAddress?.lon ?? 0;
	}

	async function searchAddress(query: string) {
		if (query.length < 3) {
			suggestions = [];
			return;
		}

		isSearching = true;
		try {
			const params = new URLSearchParams({
				query: query,
				near: `${JUPITER_LAT},${JUPITER_LON}`,
				layers: 'address',
				country: 'US',
				limit: '8'
			});

			const response = await fetch(`https://api.radar.io/v1/search/autocomplete?${params}`, {
				headers: {
					'Authorization': RADAR_PUB_KEY
				}
			});

			if (response.ok) {
				const data = await response.json();
				suggestions = (data.addresses || [])
					.filter((a: any) => a.state === 'FL' || a.stateCode === 'FL')
					.map((a: any) => ({
						address: a.addressLabel || a.formattedAddress,
						fullAddress: a.formattedAddress,
						lat: a.latitude,
						lon: a.longitude
					}));
			}
		} catch (error) {
			console.error('Address search failed:', error);
		}
		isSearching = false;
	}

	function handleSearchInput(e: Event) {
		const target = e.target as HTMLInputElement;
		searchQuery = target.value;
		showSuggestions = true;

		// Debounce to avoid too many API calls
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			searchAddress(searchQuery);
		}, 300);
	}

	async function selectAddress(result: AddressSuggestion) {
		selectedAddress = result;
		searchQuery = result.address;
		suggestions = [];
		showSuggestions = false;

		// Try to enrich with Serper
		isEnriching = true;
		try {
			const response = await fetch('/api/enrich', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ address: result.fullAddress })
			});

			if (response.ok) {
				const data = await response.json();
				const enriched = data.enriched || {};

				// Pre-fill form with enriched data
				if (enriched.beds) beds = enriched.beds;
				if (enriched.baths) baths = enriched.baths;
				if (enriched.sqFt) sqFt = enriched.sqFt;
				if (enriched.yearBuilt) yearBuilt = enriched.yearBuilt;
				if (enriched.price) price = enriched.price;
				if (enriched.hasPool) hasPool = enriched.hasPool;
				if (enriched.source) enrichmentSource = enriched.source;
				if (enriched.sourceUrl) enrichmentUrl = enriched.sourceUrl;
			}
		} catch (error) {
			console.error('Enrichment failed:', error);
		}
		isEnriching = false;
	}

	function formatShortAddress(result: AddressSuggestion): string {
		return result.address;
	}

	async function saveProperty() {
		if (!selectedAddress) return;

		isSaving = true;
		try {
			const property = {
				address: formatShortAddress(selectedAddress),
				notes,
				beds,
				baths,
				sqFt,
				yearBuilt,
				construction: '',
				hasPool,
				poolType: hasPool ? 'Unknown' : '',
				price,
				lat: getEffectiveLat(),
				lon: getEffectiveLon(),
				source: enrichmentSource
			};

			const response = await fetch('/api/property', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(property)
			});

			if (response.ok) {
				const data = await response.json();
				dispatch('added', { property: data.property });
				dispatch('close');
			} else {
				alert('Failed to save property');
			}
		} catch (error) {
			console.error('Save failed:', error);
			alert('Failed to save property');
		}
		isSaving = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			dispatch('close');
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="modal-overlay" role="dialog" aria-modal="true" onclick={() => dispatch('close')}>
	<div class="modal" role="document" onclick={(e) => e.stopPropagation()}>
		<div class="modal-header">
			<span class="add-icon">+</span>
			<h2>Add Property</h2>
		</div>

		<div class="search-container">
			<label for="address-search">Address</label>
			<div class="search-input-wrapper">
				<input
					id="address-search"
					type="text"
					placeholder="123 Main St, Jupiter..."
					value={searchQuery}
					oninput={handleSearchInput}
					onfocus={() => showSuggestions = true}
					autocomplete="off"
				/>
				{#if isSearching}
					<span class="search-spinner">...</span>
				{/if}
			</div>

			{#if showSuggestions && suggestions.length > 0}
				<ul class="suggestions">
					{#each suggestions as suggestion}
						<li>
							<button type="button" onclick={() => selectAddress(suggestion)}>
								{suggestion.address}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		{#if selectedAddress}
			<div class="selected-address">
				<div class="selected-header">
					<span>Selected: {formatShortAddress(selectedAddress)}</span>
					<a
						href="https://www.google.com/maps?q={getEffectiveLat()},{getEffectiveLon()}"
						target="_blank"
						class="preview-link"
					>
						📍 Verify
					</a>
				</div>
				<div class="selected-coords">
					{getEffectiveLat().toFixed(5)}, {getEffectiveLon().toFixed(5)}
					{#if manualLat}
						<span class="source-badge manual">Manual</span>
					{/if}
				</div>
				<div class="location-actions">
					{#if !showManualCoords}
						<button type="button" class="fix-btn" onclick={() => showManualCoords = true}>
							Wrong location? Fix coords
						</button>
					{/if}
					<button type="button" class="clear-btn" onclick={clearSelection}>
						Start over
					</button>
				</div>
				{#if showManualCoords}
					<div class="manual-coords">
						<p class="manual-hint">Paste coords from Google Maps (right-click → copy coordinates)</p>
						<div class="coord-inputs">
							<input
								type="number"
								step="any"
								placeholder="Latitude (e.g. 26.937)"
								bind:value={manualLat}
							/>
							<input
								type="number"
								step="any"
								placeholder="Longitude (e.g. -80.233)"
								bind:value={manualLon}
							/>
						</div>
					</div>
				{/if}
			</div>

			{#if isEnriching}
				<div class="enriching">Searching for property details...</div>
			{:else}
				{#if enrichmentSource}
					<div class="enrichment-source">
						Details from
						{#if enrichmentUrl}
							<a href={enrichmentUrl} target="_blank">{enrichmentSource}</a>
						{:else}
							{enrichmentSource}
						{/if}
					</div>
				{/if}

				<div class="form-grid">
					<div class="form-field">
						<label for="beds">Beds</label>
						<input
							id="beds"
							type="number"
							min="0"
							max="20"
							bind:value={beds}
							placeholder="—"
						/>
					</div>

					<div class="form-field">
						<label for="baths">Baths</label>
						<input
							id="baths"
							type="number"
							min="0"
							max="20"
							step="0.5"
							bind:value={baths}
							placeholder="—"
						/>
					</div>

					<div class="form-field">
						<label for="sqft">Sq Ft</label>
						<input
							id="sqft"
							type="number"
							min="0"
							bind:value={sqFt}
							placeholder="—"
						/>
					</div>

					<div class="form-field">
						<label for="year">Year Built</label>
						<input
							id="year"
							type="number"
							min="1800"
							max="2030"
							bind:value={yearBuilt}
							placeholder="—"
						/>
					</div>

					<div class="form-field">
						<label for="price">Price</label>
						<input
							id="price"
							type="number"
							min="0"
							bind:value={price}
							placeholder="—"
						/>
					</div>

					<div class="form-field checkbox-field">
						<label>
							<input type="checkbox" bind:checked={hasPool} />
							Has Pool
						</label>
					</div>
				</div>

				<div class="form-field notes-field">
					<label for="notes">Notes</label>
					<textarea
						id="notes"
						placeholder="Add notes about this property..."
						bind:value={notes}
					></textarea>
				</div>

				<button
					class="save-btn"
					onclick={saveProperty}
					disabled={isSaving}
				>
					{isSaving ? 'Saving...' : 'Add to List'}
				</button>
			{/if}
		{/if}

		<button class="close-btn" onclick={() => dispatch('close')}>Cancel</button>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(61, 61, 61, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 20px;
	}

	.modal {
		background: white;
		border-radius: 16px;
		padding: 24px;
		width: 100%;
		max-width: 400px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
	}

	.modal-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 16px;
	}

	.add-icon {
		font-size: 1.8rem;
		color: #8B4513;
		font-weight: bold;
	}

	.modal h2 {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 600;
		color: #3D3D3D;
	}

	.search-container {
		position: relative;
		margin-bottom: 16px;
	}

	.search-container label {
		display: block;
		font-size: 0.8rem;
		font-weight: 600;
		color: #666;
		margin-bottom: 6px;
	}

	.search-input-wrapper {
		position: relative;
	}

	.search-input-wrapper input {
		width: 100%;
		padding: 12px;
		border: 1px solid #DDD5C9;
		border-radius: 10px;
		font-size: 0.95rem;
		background: #FAF6F0;
	}

	.search-input-wrapper input:focus {
		outline: none;
		border-color: #8B4513;
		background: white;
	}

	.search-spinner {
		position: absolute;
		right: 12px;
		top: 50%;
		transform: translateY(-50%);
		color: #888;
	}

	.suggestions {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: white;
		border: 1px solid #DDD5C9;
		border-radius: 10px;
		margin-top: 4px;
		max-height: 200px;
		overflow-y: auto;
		z-index: 10;
		list-style: none;
		padding: 0;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.suggestions li button {
		width: 100%;
		padding: 10px 12px;
		text-align: left;
		background: none;
		border: none;
		font-size: 0.85rem;
		color: #3D3D3D;
		cursor: pointer;
	}

	.suggestions li button:hover {
		background: #FAF6F0;
	}

	.suggestions li:first-child button {
		border-radius: 10px 10px 0 0;
	}

	.suggestions li:last-child button {
		border-radius: 0 0 10px 10px;
	}

	.suggestions li button {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.suggestion-address {
		flex: 1;
	}

	.suggestion-badge {
		background: #8B4513;
		color: white;
		font-size: 0.65rem;
		padding: 2px 6px;
		border-radius: 4px;
		margin-left: 8px;
		font-weight: 600;
	}

	.selected-address {
		background: #E8F4EA;
		color: #2D5016;
		padding: 10px 12px;
		border-radius: 8px;
		font-size: 0.85rem;
		margin-bottom: 12px;
	}

	.selected-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}

	.preview-link {
		color: #2D5016;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}

	.preview-link:hover {
		text-decoration: underline;
	}

	.selected-coords {
		font-size: 0.75rem;
		color: #5a8a5a;
		margin-top: 4px;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.source-badge {
		background: #8B4513;
		color: white;
		font-size: 0.65rem;
		padding: 2px 6px;
		border-radius: 4px;
		font-weight: 600;
	}

	.source-badge.manual {
		background: #2D5016;
	}

	.location-actions {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}

	.fix-btn, .clear-btn {
		background: none;
		border: none;
		color: #666;
		font-size: 0.75rem;
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
	}

	.fix-btn:hover, .clear-btn:hover {
		color: #8B4513;
	}

	.manual-coords {
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px dashed #ccc;
	}

	.manual-hint {
		font-size: 0.7rem;
		color: #888;
		margin: 0 0 8px 0;
	}

	.coord-inputs {
		display: flex;
		gap: 8px;
	}

	.coord-inputs input {
		flex: 1;
		padding: 8px;
		border: 1px solid #DDD5C9;
		border-radius: 6px;
		font-size: 0.8rem;
	}

	.coord-inputs input:focus {
		outline: none;
		border-color: #8B4513;
	}

	.enriching {
		text-align: center;
		color: #888;
		font-style: italic;
		padding: 20px;
	}

	.enrichment-source {
		font-size: 0.75rem;
		color: #888;
		margin-bottom: 12px;
	}

	.enrichment-source a {
		color: #8B4513;
		font-weight: 600;
		text-decoration: none;
	}

	.enrichment-source a:hover {
		text-decoration: underline;
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 16px;
	}

	.form-field label {
		display: block;
		font-size: 0.75rem;
		font-weight: 600;
		color: #666;
		margin-bottom: 4px;
	}

	.form-field input[type='number'] {
		width: 100%;
		padding: 10px;
		border: 1px solid #DDD5C9;
		border-radius: 8px;
		font-size: 0.9rem;
		background: #FAF6F0;
	}

	.form-field input[type='number']:focus {
		outline: none;
		border-color: #8B4513;
		background: white;
	}

	.checkbox-field {
		display: flex;
		align-items: center;
	}

	.checkbox-field label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		margin-top: 16px;
	}

	.checkbox-field input[type='checkbox'] {
		width: 18px;
		height: 18px;
		accent-color: #8B4513;
	}

	.notes-field {
		margin-bottom: 16px;
	}

	.notes-field textarea {
		width: 100%;
		height: 80px;
		border: 1px solid #DDD5C9;
		border-radius: 10px;
		background: #FAF6F0;
		color: #3D3D3D;
		padding: 12px;
		font-size: 0.9rem;
		font-family: inherit;
		resize: none;
	}

	.notes-field textarea:focus {
		outline: none;
		border-color: #8B4513;
		background: white;
	}

	.save-btn {
		width: 100%;
		padding: 14px;
		border: none;
		border-radius: 10px;
		background: #228B22;
		color: white;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		margin-bottom: 10px;
	}

	.save-btn:hover:not(:disabled) {
		background: #1a6b1a;
	}

	.save-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.close-btn {
		width: 100%;
		padding: 12px;
		border: 1px solid #DDD5C9;
		border-radius: 10px;
		background: white;
		color: #666;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.close-btn:hover {
		background: #FAF6F0;
	}
</style>
