<script lang="ts">
	import { onMount } from 'svelte';
	import { PROPERTIES, type Property, type PropertyStatus } from '$lib/data/properties';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let map: L.Map;
	let userMarker: L.Marker;
	let userLocation: { lat: number; lon: number } | null = $state(null);
	let watchId: number;
	let propertyStatuses: Record<number, PropertyStatus> = $state(data.statuses || {});
	let selectedProperty: Property | null = $state(null);
	let showStatusModal = $state(false);
	let filterStatus = $state<string>('active');

	const statusColors: Record<string, string> = {
		active: '#3388ff',
		knocked: '#ff9800',
		interested: '#4caf50',
		'not-interested': '#f44336',
		hidden: '#9e9e9e'
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
		const R = 3959; // miles
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

	async function updateStatus(propertyId: number, newStatus: PropertyStatus) {
		propertyStatuses[propertyId] = newStatus;
		try {
			await fetch('/api/status', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ propertyId, status: newStatus })
			});
		} catch (e) {
			console.error('Failed to save status:', e);
		}
	}

	function openStatusModal(property: Property) {
		selectedProperty = property;
		showStatusModal = true;
	}

	function closeStatusModal() {
		showStatusModal = false;
		selectedProperty = null;
	}

	async function saveStatus(newStatusValue: PropertyStatus['status'], notes: string) {
		if (!selectedProperty) return;
		const newStatus: PropertyStatus = {
			status: newStatusValue,
			notes,
			knockedDate: newStatusValue === 'knocked' ? new Date().toISOString() : getStatus(selectedProperty.id).knockedDate,
			updatedAt: new Date().toISOString()
		};
		await updateStatus(selectedProperty.id, newStatus);
		updateMarkerColor(selectedProperty.id, newStatusValue);
		closeStatusModal();
	}

	let markers: Record<number, L.Marker> = {};

	function updateMarkerColor(propertyId: number, status: string) {
		const marker = markers[propertyId];
		if (marker) {
			const color = statusColors[status] || statusColors.active;
			marker.setIcon(
				L.divIcon({
					className: 'custom-marker',
					html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>`,
					iconSize: [24, 24],
					iconAnchor: [12, 12]
				})
			);
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

		// Add property markers
		PROPERTIES.forEach((p) => {
			const status = getStatus(p.id).status;
			const color = statusColors[status] || statusColors.active;
			const marker = L.marker([p.lat, p.lon], {
				icon: L.divIcon({
					className: 'custom-marker',
					html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>`,
					iconSize: [24, 24],
					iconAnchor: [12, 12]
				})
			}).addTo(map);

			marker.bindPopup(`
				<b>${p.address}</b><br>
				${p.beds}bd/${p.baths}ba | ${p.sqFt.toLocaleString()} sqft<br>
				${p.price ? '$' + p.price.toLocaleString() : 'Price N/A'}<br>
				<small>${p.notes}</small>
			`);

			marker.on('click', () => {
				map.setView([p.lat, p.lon], 20);
			});

			markers[p.id] = marker;
		});

		// Watch user location
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
								html: '<div style="background:#2196f3;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(33,150,243,0.5);"></div>',
								iconSize: [16, 16],
								iconAnchor: [8, 8]
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
</script>

<div class="app">
	<header>
		<h1>HomeVenture</h1>
		<select bind:value={filterStatus}>
			<option value="active">Active ({PROPERTIES.filter(p => getStatus(p.id).status === 'active').length})</option>
			<option value="knocked">Knocked ({PROPERTIES.filter(p => getStatus(p.id).status === 'knocked').length})</option>
			<option value="interested">Interested ({PROPERTIES.filter(p => getStatus(p.id).status === 'interested').length})</option>
			<option value="not-interested">Not Interested ({PROPERTIES.filter(p => getStatus(p.id).status === 'not-interested').length})</option>
			<option value="hidden">Hidden ({PROPERTIES.filter(p => getStatus(p.id).status === 'hidden').length})</option>
			<option value="all">All Visible</option>
		</select>
	</header>

	<div id="map"></div>

	<div class="property-list">
		{#each sortedProperties as property (property.id)}
			{@const status = getStatus(property.id)}
			{@const distance = userLocation ? haversineDistance(userLocation.lat, userLocation.lon, property.lat, property.lon) : null}
			<div class="property-card" style="border-left: 4px solid {statusColors[status.status]}">
				<div class="property-info" onclick={() => panToProperty(property)}>
					<div class="address">{property.address}</div>
					<div class="details">
						{property.beds}bd/{property.baths}ba | {property.sqFt.toLocaleString()} sqft | {property.yearBuilt}
						{#if property.hasPool}<span class="pool">Pool</span>{/if}
					</div>
					<div class="price-distance">
						<span class="price">{property.price ? '$' + property.price.toLocaleString() : 'Price N/A'}</span>
						{#if distance !== null}
							<span class="distance">{distance.toFixed(2)} mi</span>
						{/if}
					</div>
					<div class="notes">{property.notes}</div>
				</div>
				<button class="status-btn" onclick={() => openStatusModal(property)}>
					{status.status === 'active' ? 'Update' : status.status}
				</button>
			</div>
		{/each}
	</div>
</div>

{#if showStatusModal && selectedProperty}
	<div class="modal-overlay" onclick={closeStatusModal}>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<h2>{selectedProperty.address}</h2>
			<p class="modal-notes">{selectedProperty.notes}</p>

			{@const currentStatus = getStatus(selectedProperty.id)}
			<textarea
				id="status-notes"
				placeholder="Add notes..."
				value={currentStatus.notes}
			></textarea>

			<div class="status-buttons">
				<button class="btn knocked" onclick={() => saveStatus('knocked', (document.getElementById('status-notes') as HTMLTextAreaElement).value)}>
					Knocked
				</button>
				<button class="btn interested" onclick={() => saveStatus('interested', (document.getElementById('status-notes') as HTMLTextAreaElement).value)}>
					Interested
				</button>
				<button class="btn not-interested" onclick={() => saveStatus('not-interested', (document.getElementById('status-notes') as HTMLTextAreaElement).value)}>
					Not Interested
				</button>
				<button class="btn hidden" onclick={() => saveStatus('hidden', (document.getElementById('status-notes') as HTMLTextAreaElement).value)}>
					Hide
				</button>
				<button class="btn active" onclick={() => saveStatus('active', (document.getElementById('status-notes') as HTMLTextAreaElement).value)}>
					Reset to Active
				</button>
			</div>

			<button class="close-btn" onclick={closeStatusModal}>Cancel</button>
		</div>
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #1a1a2e;
		color: #eee;
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
		padding: 8px 12px;
		background: #16213e;
		border-bottom: 1px solid #0f3460;
	}

	h1 {
		margin: 0;
		font-size: 1.2rem;
		color: #e94560;
	}

	select {
		padding: 6px 10px;
		border-radius: 6px;
		border: 1px solid #0f3460;
		background: #1a1a2e;
		color: #eee;
		font-size: 0.9rem;
	}

	#map {
		height: 40vh;
		min-height: 250px;
	}

	.property-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.property-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: #16213e;
		border-radius: 8px;
		margin-bottom: 8px;
		padding: 10px;
	}

	.property-info {
		flex: 1;
		cursor: pointer;
	}

	.address {
		font-weight: 600;
		font-size: 0.95rem;
	}

	.details {
		font-size: 0.8rem;
		color: #aaa;
		margin-top: 2px;
	}

	.pool {
		background: #0f3460;
		padding: 1px 6px;
		border-radius: 4px;
		margin-left: 4px;
	}

	.price-distance {
		display: flex;
		gap: 12px;
		margin-top: 4px;
		font-size: 0.85rem;
	}

	.price {
		color: #4caf50;
		font-weight: 600;
	}

	.distance {
		color: #2196f3;
	}

	.notes {
		font-size: 0.75rem;
		color: #888;
		margin-top: 4px;
		font-style: italic;
	}

	.status-btn {
		padding: 8px 12px;
		border: none;
		border-radius: 6px;
		background: #0f3460;
		color: #eee;
		font-size: 0.8rem;
		cursor: pointer;
		text-transform: capitalize;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 20px;
	}

	.modal {
		background: #16213e;
		border-radius: 12px;
		padding: 20px;
		width: 100%;
		max-width: 400px;
	}

	.modal h2 {
		margin: 0 0 8px;
		font-size: 1.1rem;
		color: #e94560;
	}

	.modal-notes {
		font-size: 0.85rem;
		color: #aaa;
		margin: 0 0 12px;
	}

	textarea {
		width: 100%;
		height: 80px;
		border: 1px solid #0f3460;
		border-radius: 6px;
		background: #1a1a2e;
		color: #eee;
		padding: 10px;
		font-size: 0.9rem;
		resize: none;
		box-sizing: border-box;
	}

	.status-buttons {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-top: 12px;
	}

	.btn {
		padding: 12px;
		border: none;
		border-radius: 6px;
		font-size: 0.9rem;
		cursor: pointer;
		color: white;
	}

	.btn.knocked { background: #ff9800; }
	.btn.interested { background: #4caf50; }
	.btn.not-interested { background: #f44336; }
	.btn.hidden { background: #9e9e9e; }
	.btn.active { background: #3388ff; grid-column: span 2; }

	.close-btn {
		width: 100%;
		margin-top: 12px;
		padding: 12px;
		border: 1px solid #0f3460;
		border-radius: 6px;
		background: transparent;
		color: #aaa;
		font-size: 0.9rem;
		cursor: pointer;
	}
</style>
