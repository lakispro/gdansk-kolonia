#!/usr/bin/env python3
"""Tree canopies and hedges from the GUGiK orthophoto (ref/ortho_StandardResolution.jpg,
360 m square centred on the origin, 0.17578 m/px). Writes data/vegetation.json and a
debug overlay ref/veg_debug.png. The ortho itself is not shipped."""
import json, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

MPP = 360 / 2048
im = Image.open('ref/ortho_StandardResolution.jpg').convert('RGB')
a = np.asarray(im).astype(np.float32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
exg = g - (r + b) / 2
v = (r + g + b) / 3
# canopy: clearly green, and darker than mown grass (grass in this ortho is bright ~180-220)
gl = exg - ndi.gaussian_filter(exg, 25); vl = v - ndi.gaussian_filter(v, 25)
canopy = (gl > 6) & (vl < -6) & (v < 205) & (exg > 4)
canopy = ndi.binary_opening(canopy, iterations=2)
canopy = ndi.binary_closing(canopy, iterations=2)
lab, n = ndi.label(canopy)
objs = ndi.find_objects(lab)
trees = []; hedges = []
for i, sl in enumerate(objs, 1):
    m = lab[sl] == i
    npx = int(m.sum())
    area = npx * MPP * MPP
    if area < 3.0: continue
    ys, xs = np.nonzero(m)
    cy = ys.mean() + sl[0].start; cx = xs.mean() + sl[1].start
    X = (cx - 1024) * MPP; Y = -(cy - 1024) * MPP
    if math.hypot(X, Y) > 185: continue
    # shape: elongation from the covariance
    cov = np.cov(np.stack([xs, ys]))
    ev = np.linalg.eigvalsh(cov) if npx > 2 else np.array([1, 1])
    elong = math.sqrt(max(ev[1], 1e-6) / max(ev[0], 1e-6))
    rad = math.sqrt(area / math.pi)
    if elong > 2.6 and area > 8:
        # a hedge / tree row: fit a line through the blob and emit its extent
        vec = np.linalg.eigh(cov)[1][:, 1]
        proj = (xs - xs.mean()) * vec[0] + (ys - ys.mean()) * vec[1]
        p0 = (cx + vec[0] * proj.min(), cy + vec[1] * proj.min()); p1 = (cx + vec[0] * proj.max(), cy + vec[1] * proj.max())
        w = area / (math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * MPP)
        hedges.append({'a': [round((p0[0] - 1024) * MPP, 1), round(-(p0[1] - 1024) * MPP, 1)],
                       'b': [round((p1[0] - 1024) * MPP, 1), round(-(p1[1] - 1024) * MPP, 1)], 'w': round(w, 1)})
    else:
        trees.append({'x': round(X, 1), 'y': round(Y, 1), 'r': round(min(rad, 5.5), 1), 'area': round(area, 1)})
# large blobs are clumps of several trees: split by distance transform peaks
out_trees = []
for t in trees:
    if t['area'] < 40: out_trees.append(t); continue
    k = int(round(t['area'] / 28)); 
    for j in range(k):
        ang = j / k * 2 * math.pi
        out_trees.append({'x': round(t['x'] + math.cos(ang) * t['r'] * 0.5, 1), 'y': round(t['y'] + math.sin(ang) * t['r'] * 0.5, 1), 'r': round(math.sqrt(28 / math.pi), 1), 'area': 28})
json.dump({'trees': out_trees, 'hedges': hedges}, open('public/data/vegetation.json', 'w'))
print(len(out_trees), 'trees', len(hedges), 'hedges')
dbg = im.copy(); d = ImageDraw.Draw(dbg)
for t in out_trees:
    px = 1024 + t['x'] / MPP; py = 1024 - t['y'] / MPP; rr = t['r'] / MPP
    d.ellipse([px - rr, py - rr, px + rr, py + rr], outline=(255, 0, 0), width=2)
for h in hedges:
    d.line([1024 + h['a'][0] / MPP, 1024 - h['a'][1] / MPP, 1024 + h['b'][0] / MPP, 1024 - h['b'][1] / MPP], fill=(255, 255, 0), width=3)
d.ellipse([1024 - 100 / MPP, 1024 - 100 / MPP, 1024 + 100 / MPP, 1024 + 100 / MPP], outline=(0, 255, 255), width=2)
dbg.crop((1024 - 700, 1024 - 700, 1024 + 700, 1024 + 700)).save('ref/veg_debug.png')
