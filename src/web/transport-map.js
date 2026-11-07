// The dispatcher's live map: buses by status, and the selected trip's road route.
// Bus positions come from the demo clock (simulation), never from GPS; road
// geometry comes from the Google Routes API through the workspace's loader.
// The base map is styled in-page (no cloud map ID) so it stays quiet: no POI pins,
// no road shields, cool greys under the charcoal / royal / tangerine markers.
import { loadGoogle } from './workspace-map.js';

const QUIET = [
  { elementType: 'geometry', stylers: [{ color: '#eef0f2' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b717a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f9fafb' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#e8ebee' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#d5d9df' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cfd8e8' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5b6b8c' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#b4bac2' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
];

/** A DOM marker on an OverlayView: AdvancedMarkerElement needs a cloud map ID, which would bring the default styling back. */
function markerClass() {
  return class HtmlMarker extends google.maps.OverlayView {
    constructor({ map, position, content, zIndex = 1, title = '', onClick = null }) {
      super();
      this.el = document.createElement('div');
      this.el.className = 't-mk';
      this.el.title = title;
      this.at = position;
      this.setContent(content);
      this.setZ(zIndex);
      if (onClick) this.el.addEventListener('click', e => { e.stopPropagation(); onClick(); });
      this.setMap(map);
    }
    onAdd() { this.getPanes().overlayMouseTarget.appendChild(this.el); }
    draw() {
      const proj = this.getProjection();
      if (!proj || !this.at) return;
      const p = proj.fromLatLngToDivPixel(new google.maps.LatLng(this.at.lat, this.at.lng));
      this.el.style.left = `${p.x}px`; this.el.style.top = `${p.y}px`;
    }
    onRemove() { this.el.remove(); }
    move(position) { if (position) { this.at = position; this.draw(); } }
    setContent(node) { this.el.replaceChildren(node); }
    setZ(z) { this.el.style.zIndex = String(z); }
    remove() { this.setMap(null); }
  };
}

const GOLAN = { lat: 33.0, lng: 35.74 };
const BUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M8 21v-3M16 21v-3"/><circle cx="8" cy="14.5" r=".6"/><circle cx="16" cy="14.5" r=".6"/></svg>';

const located = p => p.lat != null && p.lng != null;
const dist = (a, b) => Math.hypot(a.lat - b.lat, (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180));
function along(path, f) {
  if (!path?.length) return null;
  if (f <= 0 || path.length === 1) return path[0];
  const seg = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) { const d = dist(path[i - 1], path[i]); seg.push(d); total += d; }
  let goal = Math.min(1, f) * total;
  for (let i = 0; i < seg.length; i++) {
    if (goal <= seg[i]) { const t = seg[i] ? goal / seg[i] : 0; return { lat: path[i].lat + (path[i + 1].lat - path[i].lat) * t, lng: path[i].lng + (path[i + 1].lng - path[i].lng) * t }; }
    goal -= seg[i];
  }
  return path[path.length - 1];
}

export async function mountTransportMap(element, { config, onSelect }) {
  const noop = { update() {}, ready: false };
  if (!config.googleMapsBrowserKey) {
    element.innerHTML = '<iframe title="מפת רמת הגולן" class="t-map-canvas" style="border:0" src="https://maps.google.com/maps?hl=he&q=33.0,35.74&z=10&output=embed"></iframe>';
    return noop;
  }
  await loadGoogle(config.googleMapsBrowserKey);
  const [{ Map: GoogleMap, Polyline }, { Route }] = await Promise.all([
    google.maps.importLibrary('maps'), google.maps.importLibrary('routes'),
  ]);
  const Marker = markerClass();
  const map = new GoogleMap(element, {
    center: GOLAN, zoom: 11, styles: QUIET, backgroundColor: '#eef0f2', mapTypeControl: false, streetViewControl: false,
    fullscreenControl: false, clickableIcons: false, gestureHandling: 'greedy', keyboardShortcuts: false,
  });
  const buses = new Map();
  const legs = new Map(); // tripId -> Promise<array of leg paths, one per consecutive pair of points>
  let overlays = [];
  let shownRoute = '';
  let last = null;

  const legsFor = trip => {
    if (!legs.has(trip.id)) {
      const pts = trip.points;
      if (pts.length < 2 || !pts.every(located)) { legs.set(trip.id, Promise.resolve(null)); return legs.get(trip.id); }
      const c = p => ({ lat: p.lat, lng: p.lng });
      legs.set(trip.id, Route.computeRoutes({
        origin: c(pts[0]), destination: c(pts.at(-1)), intermediates: pts.slice(1, -1).map(p => ({ location: c(p) })),
        travelMode: 'DRIVING', routingPreference: 'TRAFFIC_UNAWARE', fields: ['path', 'legs'],
      }).then(r => r.routes?.[0]?.legs?.map(l => l.path.map(p => ({ lat: p.lat, lng: p.lng }))) ?? null).catch(() => null));
    }
    return legs.get(trip.id);
  };

  const placeBus = async (trip, marker) => {
    const { departedIndex: d, fraction: f } = trip.live;
    const paths = await legsFor(trip);
    const leg = paths?.[Math.max(0, d)];
    const on = leg && d >= 0 && d < paths.length ? along(leg, f) : leg && d < 0 ? leg[0] : null;
    marker.move(on ?? trip.live.position);
  };

  const busContent = (trip, selected) => {
    const el = document.createElement('div');
    el.className = `t-bus is-${trip.status}${trip.live.mode === 'manual' ? ' is-manual' : ''}${selected ? ' is-selected' : ''}`;
    el.innerHTML = `${BUS}<span>${trip.routeCode}</span>`;
    el.title = `${trip.number} · ${trip.school}`;
    return el;
  };

  const clearRoute = () => { overlays.forEach(o => o.setMap(null)); overlays = []; };

  const drawRoute = async trip => {
    clearRoute();
    shownRoute = trip ? `${trip.id}:${trip.live.departedIndex}` : '';
    if (!trip) return;
    const pts = trip.points;
    const paths = await legsFor(trip);
    if (!shownRoute.startsWith(trip.id)) return;
    const done = trip.live.departedIndex;
    const bounds = new google.maps.LatLngBounds();
    if (paths) paths.forEach((path, i) => {
      // Remaining road in electric blue with a white casing; driven legs fade to stone.
      if (i < done) overlays.push(new Polyline({ map, path, strokeColor: '#b4bac2', strokeOpacity: 0.9, strokeWeight: 5 }));
      else {
        overlays.push(new Polyline({ map, path, strokeColor: '#ffffff', strokeOpacity: 1, strokeWeight: 9, zIndex: 1 }));
        overlays.push(new Polyline({ map, path, strokeColor: '#3557d8', strokeOpacity: 1, strokeWeight: 5, zIndex: 2 }));
      }
      path.forEach(p => bounds.extend(p));
    });
    let n = 0;
    pts.forEach((p, i) => {
      if (!located(p)) return;
      const pin = document.createElement('div');
      pin.className = `t-pin${p.kind === 'school' ? ' is-school' : ''}${i <= done ? ' is-done' : ''}`;
      pin.textContent = p.kind === 'school' ? 'בי״ס' : String(++n);
      overlays.push(new Marker({ map, position: { lat: p.lat, lng: p.lng }, content: pin, title: p.name, zIndex: 1 }));
      bounds.extend({ lat: p.lat, lng: p.lng });
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
  };

  function update(state, selectedId) {
    last = state;
    const visible = state.trips.filter(t => t.live.position);
    const seen = new Set();
    for (const trip of visible) {
      seen.add(trip.id);
      let marker = buses.get(trip.id);
      const content = busContent(trip, trip.id === selectedId);
      if (!marker) {
        marker = new Marker({ map, position: trip.live.position, content, title: `${trip.number} · ${trip.school}`, onClick: () => onSelect(trip.id) });
        buses.set(trip.id, marker);
      } else marker.setContent(content);
      marker.setZ(trip.id === selectedId ? 30 : trip.live.mode === 'manual' ? 20 : 10);
      placeBus(trip, marker);
    }
    for (const [id, marker] of buses) if (!seen.has(id)) { marker.remove(); buses.delete(id); }
    const selected = state.trips.find(t => t.id === selectedId) ?? null;
    const key = selected ? `${selected.id}:${selected.live.departedIndex}` : '';
    if (key !== shownRoute) drawRoute(selected);
  }

  return { update, ready: true, overview() { map.panTo(GOLAN); map.setZoom(11); }, get last() { return last; } };
}
