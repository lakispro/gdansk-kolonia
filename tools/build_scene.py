#!/usr/bin/env python3
"""Builds data/scene.json from data/osm.json (Overpass, 190 m around Sucharskiego 9)
and data/lod1_near.json (GUGiK LOD1 2024 building solids, LIDAR-measured heights).
Local frame: metres, +x east, +y north, origin = Sucharskiego 9 footprint centroid."""
import json, math, sys, os
sys.path.insert(0, os.path.dirname(__file__)); import geo

osm = json.load(open('public/data/osm.json'))['elements']
lod = json.load(open('public/data/lod1_near.json'))
R_WORLD = 100.0     # playable radius
R_CONTEXT = 175.0   # backdrop radius

def ring_of(geom):
    pts = [geo.enu(p['lat'], p['lon']) for p in geom]
    pts = [[round(x, 2), round(y, 2)] for x, y in pts]
    if len(pts) > 1 and pts[0] == pts[-1]: pts.pop()
    return pts

def centroid(r):
    a = 0; cx = 0; cy = 0
    for i in range(len(r)):
        x0, y0 = r[i]; x1, y1 = r[(i + 1) % len(r)]
        c = x0 * y1 - x1 * y0; a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c
    if abs(a) < 1e-9: return (sum(p[0] for p in r) / len(r), sum(p[1] for p in r) / len(r))
    return (cx / (3 * a), cy / (3 * a))

def area(r):
    return abs(sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r))) / 2)

def inside(pt, r):
    x, y = pt; ins = False
    for i in range(len(r)):
        x0, y0 = r[i]; x1, y1 = r[(i + 1) % len(r)]
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0: ins = not ins
    return ins

# ---------------------------------------------------------------- buildings
buildings = []
used_lod = set()
for e in osm:
    t = e.get('tags', {})
    if e['type'] != 'way' or 'building' not in t: continue
    ring = ring_of(e['geometry'])
    c = centroid(ring)
    if math.hypot(*c) > R_CONTEXT: continue
    # LOD1 match: the LOD1 solid whose floor centroid falls inside this footprint,
    # else the nearest within 3 m
    best = None; bd = 1e9
    for i, b in enumerate(lod):
        bc = centroid(b['ring']); d = math.hypot(bc[0] - c[0], bc[1] - c[1])
        if inside(bc, ring) and d < bd: best, bd = i, d
    if best is None:
        for i, b in enumerate(lod):
            bc = centroid(b['ring']); d = math.hypot(bc[0] - c[0], bc[1] - c[1])
            if d < 3 and d < bd: best, bd = i, d
    h = None; ground = None; lod_ring = None
    if best is not None:
        used_lod.add(best); h = lod[best]['h']; ground = lod[best]['zmin']; lod_ring = lod[best]['ring']
    lv = t.get('building:levels')
    buildings.append({
        'id': e['id'], 'ring': ring, 'area': round(area(ring), 1), 'c': [round(c[0], 2), round(c[1], 2)],
        'type': t.get('building'), 'levels': int(lv) if lv and lv.isdigit() else None,
        'h': h, 'ground': ground, 'lod': lod[best]['id'] if best is not None else None,
        'addr': {k[5:]: v for k, v in t.items() if k.startswith('addr:')},
        'name': t.get('name'), 'tourism': t.get('tourism'), 'shop': t.get('shop'), 'amenity': t.get('amenity'),
        'roof': t.get('roof:shape'), 'dist': round(math.hypot(*c), 1),
    })
# LOD1 solids with no OSM footprint (sheds, garages): keep them, the survey saw them
for i, b in enumerate(lod):
    if i in used_lod: continue
    c = centroid(b['ring'])
    if math.hypot(*c) > R_CONTEXT or area(b['ring']) < 6: continue
    buildings.append({'id': 'lod-' + b['id'][:8], 'ring': [[round(x, 2), round(y, 2)] for x, y in b['ring']],
                      'area': round(area(b['ring']), 1), 'c': [round(c[0], 2), round(c[1], 2)],
                      'type': 'lod1', 'levels': None, 'h': b['h'], 'ground': b['zmin'], 'lod': b['id'],
                      'addr': {}, 'name': None, 'dist': round(math.hypot(*c), 1)})

# ---------------------------------------------------------------- streets
WIDTH = {'tertiary': 6.5, 'residential': 5.0, 'living_street': 4.5, 'service': 3.2, 'footway': 1.6, 'path': 1.2}
streets = []
for e in osm:
    t = e.get('tags', {})
    if e['type'] != 'way' or 'highway' not in t: continue
    pts = [list(geo.enu(p['lat'], p['lon'])) for p in e['geometry']]
    pts = [[round(x, 2), round(y, 2)] for x, y in pts]
    if all(math.hypot(*p) > R_CONTEXT + 40 for p in pts): continue
    streets.append({'id': e['id'], 'pts': pts, 'kind': t['highway'], 'name': t.get('name'),
                    'surface': t.get('surface'), 'width': WIDTH.get(t['highway'], 4), 'oneway': t.get('oneway'),
                    'maxspeed': t.get('maxspeed')})

# ---------------------------------------------------------------- areas, lines, points
areas = []; lines = []; points = []
for e in osm:
    t = e.get('tags', {})
    if not t: continue
    if e['type'] == 'way' and 'building' not in t and 'highway' not in t:
        pts = ring_of(e['geometry'])
        closed = e['geometry'][0] == e['geometry'][-1]
        kind = t.get('landuse') or t.get('leisure') or t.get('amenity') or t.get('barrier') or t.get('natural')
        rec = {'id': e['id'], 'kind': kind, 'name': t.get('name'), 'pts': pts, 'tags': t}
        (areas if closed else lines).append(rec)
    if e['type'] == 'node':
        x, y = geo.enu(e['lat'], e['lon'])
        if math.hypot(x, y) > R_CONTEXT + 20: continue
        kind = (t.get('emergency') or t.get('amenity') or t.get('highway') or t.get('natural') or t.get('shop')
                or t.get('tourism') or t.get('barrier') or t.get('historic') or t.get('traffic_calming')
                or ('address' if 'addr:housenumber' in t else None) or ('noexit' if 'noexit' in t else None))
        points.append({'id': e['id'], 'x': round(x, 2), 'y': round(y, 2), 'kind': kind, 'tags': t})

scene = {
    'origin': {'lat': geo.LAT0, 'lon': geo.LON0, 'osm_way': 300878269, 'address': 'ul. Majora Henryka Sucharskiego 9, 84-360 Łeba'},
    'radius': R_WORLD, 'context': R_CONTEXT, 'ground_asl': 2.0,
    'buildings': sorted(buildings, key=lambda b: b['dist']),
    'streets': streets, 'areas': areas, 'lines': lines, 'points': points,
}
os.makedirs('data', exist_ok=True)
json.dump(scene, open('public/data/scene.json', 'w'), ensure_ascii=False, separators=(',', ':'))
n_h = sum(1 for b in buildings if b['h'])
print(f"{len(buildings)} buildings ({n_h} with LIDAR height), {len(streets)} streets, {len(areas)} areas, {len(lines)} lines, {len(points)} points")
for b in scene['buildings'][:16]:
    print(b['id'], b['c'], b['type'], 'h=', b['h'], 'g=', b['ground'], b['addr'].get('street', '')[-14:], b['addr'].get('housenumber', ''), 'A=', b['area'])
