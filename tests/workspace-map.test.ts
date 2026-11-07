import test from 'node:test';
import assert from 'node:assert/strict';
import { mountGoogleMap } from '../src/web/workspace-map.js';
import { createWorkspace, routePlan, sites } from '../src/web/workspace-model.js';

test('Google adapter uses road geometry, returned stop order and measured totals; disposal releases overlays', async () => {
  // Contract test only: the live Google account must still be verified separately.
  const markers: any[] = [], lines: any[] = [], requests: any[] = [];
  let removed = 0, cleared = 0;
  class Bounds { extend() { return this; } }
  class GoogleMap {
    constructor(element: any) { assert.ok(element, 'Google Map requires its DOM element'); }
    fitBounds() {}
  }
  class Pin { glyphText: string; element = {}; constructor(options: any) { Object.assign(this, options); } }
  class Marker {
    map: any;
    constructor(options: any) { Object.assign(this, options); markers.push(this); }
    addListener(_event: string, _fn: any) { return { remove() { removed++; } }; }
  }
  const api: any = { Map: GoogleMap, AdvancedMarkerElement: Marker, PinElement: Pin,
    Route: { async computeRoutes(request: any) {
      requests.push(request);
      return { routes: [{ path: [{ lat: 33.1, lng: 35.5 }, { lat: 33.11, lng: 35.51 }], distanceMeters: 12345, durationMillis: 900000,
        optimizedIntermediateWaypointIndices: request.intermediates.length === 1 ? [-1] : [1, 0], createPolylines() {
          const line: any = { map: null, options: null, setOptions(options: any) { this.options = options; }, setMap(map: any) { this.map = map; } };
          lines.push(line); return [line];
        } }] };
    } },
  };
  const google = { maps: { importLibrary: async () => api, LatLngBounds: Bounds, event: { clearInstanceListeners() { cleared++; } } } };
  const originalWindow = globalThis.window, originalGoogle = globalThis.google;
  Object.assign(globalThis, { window: { google }, google });
  try {
    const model = createWorkspace();
    const points = sites(model).slice(0, 2).map(s => model.entities[s.pointId]);
    const runs = routePlan(points).tours;
    let result: any;
    const controller = await mountGoogleMap({ isConnected: true } as any, {
      config: { googleMapsBrowserKey: 'contract-test', googleMapsMapId: 'test' }, runs, points,
      improve: true, select() {}, titleFor: p => p.title, onRoutes: r => { result = r; },
    });
    assert.equal(result.status, 'ready');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].travelMode, 'DRIVING');
    assert.equal(requests[0].optimizeWaypointOrder, true);
    assert.equal(requests[0].intermediates.length, 2);
    assert.deepEqual(result.runs[0].stops.map((p: any) => p.id), [points[1].id, points[0].id]);
    assert.equal(result.distanceMeters, 12345);
    assert.equal(result.durationMillis, 900000);
    assert.equal(lines.length, 1, 'only the route API creates a road line');
    assert.ok(lines[0].map);
    controller.destroy();
    // The live provider returned [-1] for a one-stop optimization request.
    // There is no order to improve: request an ordinary route and retain it.
    const single = points.slice(0, 1);
    const singleController = await mountGoogleMap({ isConnected: true } as any, {
      config: { googleMapsBrowserKey: 'contract-test', googleMapsMapId: 'test' },
      runs: routePlan(single).tours, points: single, improve: true,
      select() {}, titleFor: p => p.title, onRoutes: r => { result = r; },
    });
    assert.equal(requests[1].optimizeWaypointOrder, false);
    assert.equal(result.status, 'ready');
    assert.deepEqual(result.runs[0].stops.map((p: any) => p.id), single.map(p => p.id));
    singleController.destroy();
    assert.ok(markers.every(m => m.map === null));
    assert.equal(lines[0].map, null);
    assert.equal(removed, points.length + single.length);
    assert.equal(cleared, 2);
  } finally {
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    if (originalGoogle === undefined) delete globalThis.google; else globalThis.google = originalGoogle;
  }
});
