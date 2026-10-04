#!/usr/bin/env python3
"""Harvests fotopolska.eu photographs of the buildings around the origin and matches them to
the game's buildings.

  research/fotopolska/objects.json  (from the map-marker endpoint: fotopolska objects with coordinates)
      -> for every object within RADIUS: its photo list (id, year, caption, thumbnail)
      -> for every photo: the photo page (full-size file path, description, uploader)
      -> public/ref/fotopolska/<id>.jpg (resized copy for the panel)
      -> public/data/photos.json  { objects: [...], byBuilding: { osmId: [photoId...] } }

Polite: one request every ~0.7 s, a browser User-Agent, everything cached in research/fotopolska/cache.
Photographs remain © their uploaders on fotopolska.eu; the panel links every one to its page."""
import json, os, re, sys, time, math, html, urllib.request, io
sys.path.insert(0, os.path.dirname(__file__)); import geo
from PIL import Image

RADIUS = 240
ROOT = os.path.join(os.path.dirname(__file__), '..')
CACHE = os.path.join(ROOT, 'research', 'fotopolska', 'cache'); os.makedirs(CACHE, exist_ok=True)
OUT_IMG = os.path.join(ROOT, 'public', 'ref', 'fotopolska'); os.makedirs(OUT_IMG, exist_ok=True)
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

def get(url, binary=False):
    key = re.sub(r'[^A-Za-z0-9]+', '_', url)[-150:]
    path = os.path.join(CACHE, key + ('.bin' if binary else '.html'))
    if os.path.exists(path): return open(path, 'rb').read() if binary else open(path, encoding='utf-8', errors='ignore').read()
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Referer': 'https://fotopolska.eu/'})
    data = urllib.request.urlopen(req, timeout=60).read(); time.sleep(0.7)
    open(path, 'wb').write(data)
    return data if binary else data.decode('utf-8', 'ignore')

def entries(page):
    out = []
    for m in re.finditer(r'id="ft(\d+)".*?background-image:url\(\'([^\']+)\'\).*?class="MiniBar r12b">\s*([^<]*?)\s*</div><div class="s10 MiniaturaPodpis[^"]*">\s*<a href="([^"]+)">([^<]*)</a>', page, re.S):
        pid, thumb, year, href, cap = m.groups()
        out.append({'id': int(pid), 'thumb': thumb, 'year': year.strip(), 'page': 'https://fotopolska.eu' + href, 'caption': html.unescape(cap.strip())})
    return out

objs = json.load(open(os.path.join(ROOT, 'research', 'fotopolska', 'objects.json')))
objs = [o for o in objs if o['dist'] <= RADIUS]
photos = {}
for o in objs:
    slug = re.sub(r'[^A-Za-z0-9]+', '_', o['name']).strip('_')
    page = get(f"https://fotopolska.eu/Gdansk/WszystkieZdjecia/b{o['id']},{slug}.html")
    ents = entries(page)
    if not ents:
        page2 = get(f"https://fotopolska.eu/Gdansk/b{o['id']},{slug}.html"); ents = entries(page2)
        # an object with a single photograph embeds it by script instead of a gallery
        if not ents:
            for pid in dict.fromkeys(re.findall(r"insertFr\(\d+,'/(\d+),foto\.html", page2)):
                ents.append({'id': int(pid), 'thumb': f'/foto/m/{int(pid) // 1000}/{pid}.jpg', 'year': '', 'page': f'https://fotopolska.eu/{pid},foto.html', 'caption': ''})
    o['photos'] = [e['id'] for e in ents]
    for e in ents:
        e['object'] = o['id']; e['objectName'] = o['name']; photos.setdefault(e['id'], e)
    print(o['id'], o['name'], o['dist'], 'm ->', len(ents), 'photos')

# photo pages: full-size file, description, uploader
for pid, e in photos.items():
    try:
        pg = get(f"https://fotopolska.eu/{pid},foto.html")
    except Exception as ex:
        print('photo page failed', pid, ex); continue
    m = re.search(r"plik:'([^']+)'", pg); e['file'] = ('https://fotopolska.eu/foto' + m.group(1).rsplit('/', 1)[0].rstrip('/') + '.jpg') if m else None
    m = re.search(r"var alt\s*=\s*'((?:[^'\\]|\\.)*)'", pg); e['description'] = html.unescape(m.group(1).replace("\\'", "'")) if m else ''
    m = re.search(r'<title>([^<]*)</title>', pg); e['title'] = html.unescape(m.group(1)).replace(', stare zdjęcia', '').strip() if m else ''
    m = re.search(r'/(\d+),user\.html[^>]*><strong>([^<]+)</strong>', pg); e['author'] = html.unescape(m.group(2)) if m else ''
    if not e['year']:
        m = re.search(r'-\s*((?:Lata\s+)?\d{4}(?:\s*-\s*\d{4})?)\s*$', e['description']); e['year'] = m.group(1).replace('Lata ', '') if m else ''
    if not e['caption']: e['caption'] = re.sub(r'\s*-\s*(?:Lata\s+)?\d{4}(?:\s*-\s*\d{4})?\s*$', '', e['description'])
    # a resized copy for the panel
    dst = os.path.join(OUT_IMG, f'{pid}.jpg')
    if not os.path.exists(dst):
        src = e['file'] or ('https://fotopolska.eu' + e['thumb'])
        try:
            im = Image.open(io.BytesIO(get(src, binary=True))).convert('RGB'); im.thumbnail((1400, 1400)); im.save(dst, quality=84)
            e['w'], e['h'] = im.size
        except Exception as ex:
            print('image failed', pid, ex)
    else:
        im = Image.open(dst); e['w'], e['h'] = im.size

# match objects to the game's buildings by street + number
scene = json.load(open(os.path.join(ROOT, 'public', 'data', 'scene.json')))
STREETS = {'Mickiewicza': 'Adama Mickiewicza', 'Adama Mickiewicza': 'Adama Mickiewicza', 'Kochanowskiego': 'Jana Kochanowskiego', 'Jana Kochanowskiego': 'Jana Kochanowskiego', 'Klonowicza': 'Sebastiana Klonowicza', 'Hallera': 'Józefa Hallera', 'Modrzewskiego': 'Andrzeja Frycza Modrzewskiego'}
def numbers(s):
    # "81-83-85" -> [81,83,85]; "32-36" -> [32,34,36]; "2C-F" -> ['2C','2D','2E','2F']; "74/76" -> [74,76]
    s = s.strip()
    m = re.match(r'^(\d+)([A-Z])-([A-Z])$', s)
    if m: return [m.group(1) + chr(c) for c in range(ord(m.group(2)), ord(m.group(3)) + 1)]
    parts = re.split(r'[-/]', s)
    if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit() and int(parts[1]) - int(parts[0]) in (2, 4) and len(parts) == 2:
        return [str(n) for n in range(int(parts[0]), int(parts[1]) + 1, 2)]
    return parts
byBuilding = {}
for o in objs:
    m = re.match(r'^(.*?)\s+([\dA-Z/\-]+)$', o['name'])
    if not m: continue
    st = STREETS.get(m.group(1).strip()); nos = numbers(m.group(2))
    if not st: continue
    for b in scene['buildings']:
        if b['addr'].get('street') == st and b['addr'].get('housenumber') in nos:
            byBuilding.setdefault(str(b['id']), []).extend(o['photos'])
            o.setdefault('osm', []).append(b['id'])
json.dump({'radius': RADIUS, 'objects': objs, 'photos': {str(k): v for k, v in photos.items()}, 'byBuilding': byBuilding},
          open(os.path.join(ROOT, 'public', 'data', 'photos.json'), 'w'), ensure_ascii=False, indent=1)
print(len(objs), 'objects,', len(photos), 'photos,', len(byBuilding), 'game buildings matched')
