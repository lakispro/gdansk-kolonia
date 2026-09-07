#!/usr/bin/env python3
"""GUGiK LOD1 (CityGML) solids near the origin -> public/data/lod1_near.json (floor ring in ENU metres, LiDAR height)."""
import sys, re, glob, math, json, os
sys.path.insert(0, os.path.dirname(__file__)); import geo
cx, cy = geo.wgs_to_2180(geo.LAT0, geo.LON0)
out = []
for f in glob.glob(os.path.join(os.path.dirname(__file__), '..', 'ref', 'lod1', '*.gml')):
    s = open(f, encoding='utf-8').read()
    m = re.search(r'<gml:lowerCorner>([\d.]+) ([\d.]+)', s); M = re.search(r'<gml:upperCorner>([\d.]+) ([\d.]+)', s)
    if not m: continue
    x0, y0 = float(m.group(1)), float(m.group(2)); x1, y1 = float(M.group(1)), float(M.group(2))
    if not (x0 - 250 < cx < x1 + 250 and y0 - 250 < cy < y1 + 250): continue
    for b in re.finditer(r'<bldg:Building .*?</bldg:Building>', s, re.S):
        t = b.group(0)
        pos = re.findall(r'<gml:posList[^>]*>([^<]*)</gml:posList>', t)
        rings = []
        for p in pos:
            v = list(map(float, p.split())); rings.append([(v[i], v[i + 1], v[i + 2]) for i in range(0, len(v), 3)])
        if not rings: continue
        pts = [q for r in rings for q in r]
        bx = sum(p[0] for p in pts) / len(pts); by = sum(p[1] for p in pts) / len(pts)
        if math.hypot(bx - cx, by - cy) > 220: continue
        attrs = dict(re.findall(r'<gen:(?:string|int|double)Attribute name="([^"]+)">\s*<gen:value>([^<]*)', t))
        h = re.search(r'measuredHeight[^>]*>([\d.]+)', t); zs = [p[2] for p in pts]
        floor = min(rings, key=lambda r: sum(q[2] for q in r) / len(r))
        ring = []
        for (X, Y, Z) in floor:
            la, lo = geo.p2180_to_wgs(X, Y); e, n = geo.enu(la, lo); ring.append([round(e, 2), round(n, 2)])
        out.append({'id': attrs.get('buildingId'), 'h': float(h.group(1)) if h else None, 'zmin': min(zs), 'zmax': max(zs), 'attrs': attrs, 'ring': ring})
json.dump(out, open(os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'lod1_near.json'), 'w'), ensure_ascii=False)
print(len(out), 'LOD1 buildings near the origin')
