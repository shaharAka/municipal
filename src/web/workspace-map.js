// Google road geometry is the only source of route lines, times and distances.
// Synthetic points may be inspected before the browser key is configured.
import { DEPOT } from './workspace-model.js';
import { tokens } from './aka-kit/tokens.js';

let loading;
const routeCache = new Map();
const coord = p => ({ lat: p.lat, lng: p.lng });
export function googleDirectionsUrl(stops) {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', `${DEPOT.lat},${DEPOT.lng}`);
  url.searchParams.set('destination', `${DEPOT.lat},${DEPOT.lng}`);
  url.searchParams.set('travelmode', 'driving');
  url.searchParams.set('waypoints', stops.map(p => `${p.lat},${p.lng}`).join('|'));
  return url.href;
}
export async function loadGoogle(key) {
  if (window.google?.maps?.importLibrary) return;
  if (!loading) loading = new Promise((resolve, reject) => {
    const callback = '__municipalMapsReady';
    window[callback] = () => { delete window[callback]; resolve(); };
    const script = document.createElement('script');
    const url = new URL('https://maps.googleapis.com/maps/api/js');
    url.search = new URLSearchParams({ key, v: 'weekly', loading: 'async', callback, language: 'he', region: 'IL', auth_referrer_policy: 'origin' });
    script.src = url.href;
    script.async = true;
    script.onerror = () => { loading = null; delete window[callback]; script.remove(); reject(new Error('טעינת Google Maps נכשלה. בדקו את החיבור ואת הגדרת המפתח.')); };
    document.head.append(script);
  });
  return loading;
}

export async function mountGoogleMap(element, { config, runs, points, improve, select, titleFor, onRoutes }) {
  let disposed = false;
  const overlays = [];
  const listeners = [];
  let map;
  const fit = () => {
    if (!map) return;
    const bounds = new google.maps.LatLngBounds();
    [DEPOT, ...points].forEach(p => bounds.extend(coord(p)));
    map.fitBounds(bounds, 50);
  };
  const controller = { fit, destroy() { disposed = true; overlays.forEach(o => { if (o.setMap) o.setMap(null); else o.map = null; }); listeners.forEach(l => l.remove()); if (map) google.maps.event.clearInstanceListeners(map); } };
  if (!config.googleMapsBrowserKey) {
    const frame = document.createElement('iframe');
    frame.title = 'Google Maps — אזור הפינוי לדוגמה';
    frame.src = 'https://maps.google.com/maps?hl=he&q=33.183,35.613&z=12&output=embed';
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer-when-downgrade';
    frame.className = 'google-map-frame';
    element.replaceChildren(frame);
    onRoutes({ status: 'setup' });
    return controller;
  }
  try {
    await loadGoogle(config.googleMapsBrowserKey);
    if (!element.isConnected || disposed) return controller;
    const [{ Map: GoogleMap }, { AdvancedMarkerElement, PinElement }, { Route }] = await Promise.all([
      google.maps.importLibrary('maps'), google.maps.importLibrary('marker'), google.maps.importLibrary('routes'),
    ]);
    if (!element.isConnected || disposed) return controller;
    map = new GoogleMap(element, { center: coord(DEPOT), zoom: 12, mapId: config.googleMapsMapId, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: 'cooperative' });
    fit();
    let markerIndex = 0;
    const pins = new Map();
    runs.forEach(run => run.stops.forEach(p => {
      const pin = new PinElement({ background: tokens.colors.accent.main, borderColor: tokens.colors.surface.card, glyphText: String(++markerIndex), glyphColor: tokens.colors.text.inverse, scale: .9 });
      pins.set(p.id, pin);
      const marker = new AdvancedMarkerElement({ map, position: coord(p), title: titleFor(p), content: pin.element });
      listeners.push(marker.addListener('click', () => select(p.id)));
      overlays.push(marker);
    }));
    const depot = new AdvancedMarkerElement({ map, position: coord(DEPOT), title: DEPOT.title });
    overlays.push(depot);
    const result = await Promise.all(runs.map(async run => {
      // A single stop has no ordering to optimize; keep its identity unchanged.
      const optimize = improve && run.stops.length > 1;
      const request = { origin: coord(DEPOT), destination: coord(DEPOT), intermediates: run.stops.map(p => ({ location: coord(p) })), travelMode: 'DRIVING', routingPreference: 'TRAFFIC_UNAWARE', optimizeWaypointOrder: optimize, fields: ['path', 'distanceMeters', 'durationMillis', 'optimizedIntermediateWaypointIndices'] };
      const key = JSON.stringify(request);
      if (!routeCache.has(key)) routeCache.set(key, Route.computeRoutes(request).catch(error => { routeCache.delete(key); throw error; }));
      const response = await routeCache.get(key);
      const route = response.routes?.[0];
      if (!route?.path?.length) throw new Error('לא נמצא מסלול נסיעה לכל הנקודות. בדקו את מיקומי הפינוי.');
      const indices = Array.from(route.optimizedIntermediateWaypointIndices || []);
      if (optimize && (indices.length !== run.stops.length || indices.some(i => !Number.isInteger(i) || i < 0 || i >= run.stops.length) || new Set(indices).size !== run.stops.length)) {
        throw new Error('לא התקבל סדר עצירות תקין מ־Google. אפשר לחזור לסדר המקורי ולנסות שוב.');
      }
      const ordered = optimize ? indices.map(i => run.stops[i]) : run.stops;
      return { route, stops: ordered, load: run.load, distanceMeters: route.distanceMeters, durationMillis: route.durationMillis };
    }));
    if (!element.isConnected || disposed) { controller.destroy(); return controller; }
    const bounds = new google.maps.LatLngBounds();
    markerIndex = 0;
    result.forEach(({ route, stops }, i) => {
      stops.forEach(p => { pins.get(p.id).glyphText = String(++markerIndex); });
      const polylines = route.createPolylines();
      polylines.forEach(line => { line.setOptions({ strokeColor: i ? tokens.colors.text.secondary : tokens.colors.accent.main, strokeOpacity: .85, strokeWeight: 5 }); line.setMap(map); overlays.push(line); });
      route.path.forEach(p => bounds.extend(p));
    });
    if (result.length) map.fitBounds(bounds, 45);
    onRoutes({ status: 'ready', runs: result, distanceMeters: result.reduce((sum, r) => sum + (r.distanceMeters || 0), 0), durationMillis: result.reduce((sum, r) => sum + (r.durationMillis || 0), 0) });
  } catch (error) {
    if (element.isConnected && !disposed) onRoutes({ status: 'error', message: error.message || 'לא ניתן לחשב מסלול. בדקו את הרשאות Google Maps ו־Routes.' });
  }
  return controller;
}
