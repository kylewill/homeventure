<script lang="ts">
	import { onMount } from 'svelte';
	import { PROPERTIES, type Property, type PropertyStatus } from '$lib/data/properties';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let map: L.Map;
	let userMarker: L.Marker;
	let userLocation: { lat: number; lon: number } | null = $state(null);
	let watchId: number;
	let propertyStatuses: Record<number, PropertyStatus> = $state({...data.statuses});
	let selectedProperty: Property | null = $state(null);
	let showStatusModal = $state(false);
	let filterStatus = $state<string>('active');
	let notesValue = $state('');
	let saveTimeout: ReturnType<typeof setTimeout>;

	// Hobbit-themed status labels
	const statusLabels: Record<string, string> = {
		active: 'Unexplored',
		knocked: 'Visited',
		interested: 'Promising',
		'not-interested': 'Passed',
		hidden: 'Off the Map'
	};

	// Earth tone colors
	const statusColors: Record<string, string> = {
		active: '#6B8E23',      // olive - unexplored
		knocked: '#DAA520',     // goldenrod - visited
		interested: '#228B22',  // forest green - promising
		'not-interested': '#A0522D', // sienna - passed
		hidden: '#808080'       // gray - off the map
	};

	function getStatus(propertyId: number): PropertyStatus {
		return propertyStatuses[propertyId] || {
			status: 'active',
			notes: '',
			knockedDate: null,
			updatedAt: new Date().toISOString()
		};
	}

	function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
		const R = 3959;
		const dLat = ((lat2 - lat1) * Math.PI) / 180;
		const dLon = ((lon2 - lon1) * Math.PI) / 180;
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos((lat1 * Math.PI) / 180) *
				Math.cos((lat2 * Math.PI) / 180) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c;
	}

	let sortedProperties = $derived.by(() => {
		let props = PROPERTIES.filter((p) => {
			const status = getStatus(p.id).status;
			if (filterStatus === 'all') return status !== 'hidden';
			if (filterStatus === 'hidden') return status === 'hidden';
			return status === filterStatus;
		});

		if (userLocation) {
			props = props.sort(
				(a, b) =>
					haversineDistance(userLocation!.lat, userLocation!.lon, a.lat, a.lon) -
					haversineDistance(userLocation!.lat, userLocation!.lon, b.lat, b.lon)
			);
		}
		return props;
	});

	async function saveToServer(propertyId: number, status: PropertyStatus) {
		try {
			await fetch('/api/status', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ propertyId, status })
			});
		} catch (e) {
			console.error('Failed to save:', e);
		}
	}

	async function updateStatus(propertyId: number, newStatus: PropertyStatus) {
		propertyStatuses[propertyId] = newStatus;
		await saveToServer(propertyId, newStatus);
	}

	function handleNotesChange(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		notesValue = target.value;

		// Debounced auto-save
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			if (selectedProperty) {
				const current = getStatus(selectedProperty.id);
				const updated: PropertyStatus = {
					...current,
					notes: notesValue,
					updatedAt: new Date().toISOString()
				};
				updateStatus(selectedProperty.id, updated);
			}
		}, 500);
	}

	function openStatusModal(property: Property) {
		selectedProperty = property;
		notesValue = getStatus(property.id).notes;
		showStatusModal = true;
	}

	function closeStatusModal() {
		clearTimeout(saveTimeout);
		showStatusModal = false;
		selectedProperty = null;
	}

	async function setStatus(newStatusValue: PropertyStatus['status']) {
		if (!selectedProperty) return;
		const current = getStatus(selectedProperty.id);
		const newStatus: PropertyStatus = {
			status: newStatusValue,
			notes: notesValue,
			knockedDate: newStatusValue === 'knocked' ? new Date().toISOString() : current.knockedDate,
			updatedAt: new Date().toISOString()
		};
		await updateStatus(selectedProperty.id, newStatus);
		updateMarkerColor(selectedProperty.id, newStatusValue);
		closeStatusModal();
	}

	let markers: Record<number, L.Marker> = {};

	function createMarkerIcon(color: string) {
		return L.divIcon({
			className: 'custom-marker',
			html: `<div style="
				background: ${color};
				width: 28px;
				height: 28px;
				border-radius: 50%;
				border: 3px solid #FAF6F0;
				box-shadow: 0 2px 8px rgba(0,0,0,0.3);
				display: flex;
				align-items: center;
				justify-content: center;
			">
				<div style="
					width: 8px;
					height: 8px;
					background: #FAF6F0;
					border-radius: 50%;
				"></div>
			</div>`,
			iconSize: [28, 28],
			iconAnchor: [14, 14]
		});
	}

	function updateMarkerColor(propertyId: number, status: string) {
		const marker = markers[propertyId];
		if (marker) {
			marker.setIcon(createMarkerIcon(statusColors[status] || statusColors.active));
		}
	}

	function panToProperty(property: Property) {
		map.setView([property.lat, property.lon], 20);
	}

	onMount(async () => {
		const L = await import('leaflet');

		map = L.map('map').setView([26.92, -80.21], 13);

		const satellite = L.tileLayer(
			'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
			{ attribution: 'Esri', maxZoom: 23 }
		);

		const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; OpenStreetMap',
			maxZoom: 19
		});

		satellite.addTo(map);
		L.control.layers({ Satellite: satellite, Streets: streets }).addTo(map);

		PROPERTIES.forEach((p) => {
			const status = getStatus(p.id).status;
			const color = statusColors[status] || statusColors.active;
			const marker = L.marker([p.lat, p.lon], {
				icon: createMarkerIcon(color)
			}).addTo(map);

			marker.bindPopup(`
				<div style="font-family: -apple-system, system-ui, sans-serif; min-width: 200px;">
					<div style="font-weight: 600; font-size: 14px; color: #3D3D3D; margin-bottom: 4px;">${p.address}</div>
					<div style="color: #8B4513; font-weight: 700; font-size: 16px; margin-bottom: 4px;">${p.price ? '$' + p.price.toLocaleString() : 'Price N/A'}</div>
					<div style="color: #666; font-size: 13px;">${p.beds} bd · ${p.baths} ba · ${p.sqFt.toLocaleString()} sqft</div>
					<div style="color: #888; font-size: 12px; font-style: italic; margin-top: 4px;">${p.notes}</div>
				</div>
			`);

			marker.on('click', () => {
				map.setView([p.lat, p.lon], 20);
			});

			markers[p.id] = marker;
		});

		if (navigator.geolocation) {
			watchId = navigator.geolocation.watchPosition(
				(pos) => {
					userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
					if (userMarker) {
						userMarker.setLatLng([pos.coords.latitude, pos.coords.longitude]);
					} else {
						userMarker = L.marker([pos.coords.latitude, pos.coords.longitude], {
							icon: L.divIcon({
								className: 'user-marker',
								html: `<div style="
									background: #4A90D9;
									width: 18px;
									height: 18px;
									border-radius: 50%;
									border: 3px solid white;
									box-shadow: 0 0 12px rgba(74,144,217,0.6);
								"></div>`,
								iconSize: [18, 18],
								iconAnchor: [9, 9]
							})
						}).addTo(map);
						userMarker.bindPopup('You are here');
					}
				},
				(err) => console.error('Geolocation error:', err),
				{ enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
			);
		}

		return () => {
			if (watchId) navigator.geolocation.clearWatch(watchId);
			map.remove();
		};
	});

	function getStatusCounts() {
		return {
			active: PROPERTIES.filter(p => getStatus(p.id).status === 'active').length,
			knocked: PROPERTIES.filter(p => getStatus(p.id).status === 'knocked').length,
			interested: PROPERTIES.filter(p => getStatus(p.id).status === 'interested').length,
			'not-interested': PROPERTIES.filter(p => getStatus(p.id).status === 'not-interested').length,
			hidden: PROPERTIES.filter(p => getStatus(p.id).status === 'hidden').length
		};
	}

	let counts = $derived(getStatusCounts());
</script>

<div class="app">
	<header>
		<div class="logo">
			<span class="door-icon">⌂</span>
			<span class="logo-text">HomeVenture</span>
		</div>
		<div class="filter-wrapper">
			<span class="filter-label">Your Quest</span>
			<select bind:value={filterStatus}>
				<option value="active">Unexplored ({counts.active})</option>
				<option value="knocked">Visited ({counts.knocked})</option>
				<option value="interested">Promising ({counts.interested})</option>
				<option value="not-interested">Passed ({counts['not-interested']})</option>
				<option value="hidden">Off the Map ({counts.hidden})</option>
				<option value="all">All Homes</option>
			</select>
		</div>
	</header>

	<div id="map"></div>

	<div class="property-list">
		{#each sortedProperties as property (property.id)}
			{@const status = getStatus(property.id)}
			{@const distance = userLocation ? haversineDistance(userLocation.lat, userLocation.lon, property.lat, property.lon) : null}
			<div class="property-card" role="button" tabindex="0" onclick={() => panToProperty(property)} onkeydown={(e) => e.key === 'Enter' && panToProperty(property)}>
				<div class="card-header">
					<span class="price">{property.price ? '$' + property.price.toLocaleString() : 'Price N/A'}</span>
					{#if distance !== null}
						<span class="distance">{distance.toFixed(2)} mi away</span>
					{/if}
				</div>
				<div class="address">{property.address}</div>
				<div class="details">
					{property.beds} bd · {property.baths} ba · {property.sqFt.toLocaleString()} sqft · {property.yearBuilt}
					{#if property.hasPool}<span class="pool-badge">Pool</span>{/if}
				</div>
				{#if property.notes}
					<div class="notes">"{property.notes}"</div>
				{/if}
				<div class="card-footer">
					<span class="status-badge" style="background: {statusColors[status.status]}">{statusLabels[status.status]}</span>
					<button class="knock-btn" onclick={(e) => { e.stopPropagation(); openStatusModal(property); }}>
						🚪 Knock
					</button>
				</div>
			</div>
		{/each}

		{#if sortedProperties.length === 0}
			<div class="empty-state">
				<div class="empty-icon">🏠</div>
				<div class="empty-text">No homes in this corner of the Shire</div>
			</div>
		{/if}
	</div>
</div>

{#if showStatusModal && selectedProperty}
	<div class="modal-overlay" role="dialog" aria-modal="true" onclick={closeStatusModal} onkeydown={(e) => e.key === 'Escape' && closeStatusModal()}>
		<div class="modal" role="document" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<span class="door-icon modal-icon">⌂</span>
				<h2>{selectedProperty.address}</h2>
			</div>

			<div class="modal-price">{selectedProperty.price ? '$' + selectedProperty.price.toLocaleString() : 'Price N/A'}</div>
			<div class="modal-details">{selectedProperty.beds} bd · {selectedProperty.baths} ba · {selectedProperty.sqFt.toLocaleString()} sqft</div>

			{#if selectedProperty.notes}
				<div class="modal-original-notes">"{selectedProperty.notes}"</div>
			{/if}

			<label class="notes-label" for="status-notes">Your Notes</label>
			<textarea
				id="status-notes"
				placeholder="Add notes about your visit..."
				value={notesValue}
				oninput={handleNotesChange}
			></textarea>
			<div class="notes-hint">Notes save automatically</div>

			<div class="status-buttons">
				<button class="btn visited" onclick={() => setStatus('knocked')}>
					🚪 Visited
				</button>
				<button class="btn promising" onclick={() => setStatus('interested')}>
					⭐ Promising
				</button>
				<button class="btn passed" onclick={() => setStatus('not-interested')}>
					👋 Passed
				</button>
				<button class="btn off-map" onclick={() => setStatus('hidden')}>
					🗺️ Off the Map
				</button>
			</div>

			<button class="reset-btn" onclick={() => setStatus('active')}>
				Reset to Unexplored
			</button>

			<button class="close-btn" onclick={closeStatusModal}>Close</button>
		</div>
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #FAF6F0;
		color: #3D3D3D;
	}

	:global(*) {
		box-sizing: border-box;
	}

	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
		height: 100dvh;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		background: linear-gradient(135deg, #F5EDE4 0%, #EDE5DA 100%);
		border-bottom: 1px solid #DDD5C9;
		box-shadow: 0 2px 8px rgba(139, 69, 19, 0.08);
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.door-icon {
		font-size: 1.5rem;
		color: #8B4513;
	}

	.logo-text {
		font-size: 1.25rem;
		font-weight: 700;
		color: #8B4513;
		letter-spacing: -0.5px;
	}

	.filter-wrapper {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
	}

	.filter-label {
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #8B7355;
	}

	select {
		padding: 8px 12px;
		border-radius: 20px;
		border: 1px solid #DDD5C9;
		background: white;
		color: #3D3D3D;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		box-shadow: 0 1px 3px rgba(0,0,0,0.08);
	}

	select:focus {
		outline: none;
		border-color: #8B4513;
	}

	#map {
		height: 50vh;
		min-height: 280px;
	}

	.property-list {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.property-card {
		background: white;
		border-radius: 12px;
		padding: 16px;
		box-shadow: 0 2px 12px rgba(139, 69, 19, 0.1);
		border: 1px solid #EDE5DA;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: left;
		width: 100%;
		font-family: inherit;
		font-size: inherit;
		color: inherit;
	}

	.property-card:hover {
		box-shadow: 0 4px 20px rgba(139, 69, 19, 0.15);
		transform: translateY(-1px);
	}

	.property-card:active {
		transform: translateY(0);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
	}

	.price {
		font-size: 1.2rem;
		font-weight: 700;
		color: #8B4513;
	}

	.distance {
		font-size: 0.8rem;
		color: #6B8E23;
		font-weight: 500;
	}

	.address {
		font-size: 1rem;
		font-weight: 600;
		color: #3D3D3D;
		margin-bottom: 4px;
	}

	.details {
		font-size: 0.85rem;
		color: #666;
		margin-bottom: 6px;
	}

	.pool-badge {
		display: inline-block;
		background: #E8F4EA;
		color: #2D5016;
		padding: 2px 8px;
		border-radius: 10px;
		font-size: 0.75rem;
		font-weight: 500;
		margin-left: 6px;
	}

	.notes {
		font-size: 0.8rem;
		color: #888;
		font-style: italic;
		margin-bottom: 10px;
		line-height: 1.4;
	}

	.card-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 10px;
		border-top: 1px solid #F0EBE3;
	}

	.status-badge {
		font-size: 0.75rem;
		font-weight: 600;
		color: white;
		padding: 4px 10px;
		border-radius: 12px;
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	.knock-btn {
		background: #8B4513;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 20px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.knock-btn:hover {
		background: #6B3410;
	}

	.empty-state {
		text-align: center;
		padding: 40px 20px;
		color: #8B7355;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 12px;
	}

	.empty-text {
		font-size: 1rem;
		font-style: italic;
	}

	/* Modal */
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
		box-shadow: 0 10px 40px rgba(0,0,0,0.2);
	}

	.modal-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 8px;
	}

	.modal-icon {
		font-size: 1.8rem;
	}

	.modal h2 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: #3D3D3D;
	}

	.modal-price {
		font-size: 1.4rem;
		font-weight: 700;
		color: #8B4513;
		margin-bottom: 4px;
	}

	.modal-details {
		font-size: 0.9rem;
		color: #666;
		margin-bottom: 12px;
	}

	.modal-original-notes {
		font-size: 0.85rem;
		color: #888;
		font-style: italic;
		padding: 10px 12px;
		background: #FAF6F0;
		border-radius: 8px;
		margin-bottom: 16px;
	}

	.notes-label {
		display: block;
		font-size: 0.8rem;
		font-weight: 600;
		color: #666;
		margin-bottom: 6px;
	}

	textarea {
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

	textarea:focus {
		outline: none;
		border-color: #8B4513;
		background: white;
	}

	.notes-hint {
		font-size: 0.7rem;
		color: #999;
		margin-top: 4px;
		margin-bottom: 16px;
	}

	.status-buttons {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-bottom: 12px;
	}

	.btn {
		padding: 14px 12px;
		border: none;
		border-radius: 10px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		color: white;
		transition: opacity 0.2s;
	}

	.btn:hover {
		opacity: 0.9;
	}

	.btn.visited { background: #DAA520; }
	.btn.promising { background: #228B22; }
	.btn.passed { background: #A0522D; }
	.btn.off-map { background: #808080; }

	.reset-btn {
		width: 100%;
		padding: 12px;
		border: 1px solid #DDD5C9;
		border-radius: 10px;
		background: white;
		color: #666;
		font-size: 0.85rem;
		cursor: pointer;
		margin-bottom: 10px;
	}

	.reset-btn:hover {
		background: #FAF6F0;
	}

	.close-btn {
		width: 100%;
		padding: 14px;
		border: none;
		border-radius: 10px;
		background: #8B4513;
		color: white;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
	}

	.close-btn:hover {
		background: #6B3410;
	}
</style>
