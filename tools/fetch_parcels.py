#!/usr/bin/env python3
"""Cadastral parcels (EGiB, via GUGiK ULDK GetParcelByXY) for the 200 m square around the origin.
A 10 m query grid; any point already inside a fetched parcel is skipped. Writes data/parcels.json (ENU metres)."""
import sys, os, json, math, re, time, urllib.request
sys.path.insert(0, os.path.dirname(__file__)); import geo
R = 200; STEP = 9
cx, cy = geo.wgs_to_2180(geo.LAT0, geo.LON0)
parcels = {}
def inside(pt, r):
    x, y = pt; ins = False
    for i in range(len(r)):
        x0, y0 = r[i]; x1, y1 = r[(i + 1) % len(r)]
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0: ins = not ins
    return ins
pts = [(cx + i, cy + j) for i in range(-R, R + 1, STEP) for j in range(-R, R + 1, STEP) if math.hypot(i, j) <= R]
n_req = 0
for (x, y) in pts:
    if any(inside((x, y), p['xy']) for p in parcels.values()): continue
    u = f"https://uldk.gugik.gov.pl/?request=GetParcelByXY&xy={x:.2f},{y:.2f}&result=geom_wkt,id,region,parcel"
    for attempt in range(3):
        try:
            r = urllib.request.urlopen(u, timeout=30).read().decode(); n_req += 1; break
        except Exception as e:
            time.sleep(1.5); r = ''
    lines = r.strip().split('\n')
    if not lines or lines[0].strip() != '0' or len(lines) < 2: continue
    for ln in lines[1:]:
        parts = ln.split('|')
        m = re.search(r'POLYGON\(\(([^)]*)\)', parts[0])
        if not m: continue
        ring = [tuple(map(float, q.split())) for q in m.group(1).split(',')]
        if ring[0] == ring[-1]: ring = ring[:-1]
        pid = parts[1]
        if pid in parcels: continue
        parcels[pid] = {'id': pid, 'xy': ring, 'region': parts[2] if len(parts) > 2 else '', 'no': parts[3] if len(parts) > 3 else ''}
out = []
for p in parcels.values():
    ring = []
    for (X, Y) in p['xy']:
        la, lo = geo.p2180_to_wgs(X, Y); e, n = geo.enu(la, lo); ring.append([round(e, 2), round(n, 2)])
    out.append({'id': p['id'], 'no': p['no'], 'ring': ring})
json.dump(out, open('public/data/parcels.json', 'w'))
print(len(out), 'parcels from', n_req, 'requests')
