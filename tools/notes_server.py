#!/usr/bin/env python3
"""Tiny notes API for the building panel: POST /notes {id, addr, note, style} appends to
/data/notes.json; GET /notes?id=<id> lists the notes for one building (or all). Stdlib only."""
import json, os, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PATH = os.environ.get('NOTES_FILE', '/data/notes.json')

def load():
    try: return json.load(open(PATH, encoding='utf-8'))
    except Exception: return []

def save(notes):
    tmp = PATH + '.tmp'; json.dump(notes, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); os.replace(tmp, PATH)

class H(BaseHTTPRequestHandler):
    def _send(self, code, body):
        data = json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(code); self.send_header('Content-Type', 'application/json; charset=utf-8'); self.send_header('Content-Length', str(len(data))); self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(data)
    def do_GET(self):
        if not self.path.startswith('/notes'): return self._send(404, {'error': 'not found'})
        q = self.path.split('?', 1)[1] if '?' in self.path else ''
        want = dict(p.split('=', 1) for p in q.split('&') if '=' in p).get('id')
        notes = load()
        if want: notes = [n for n in notes if str(n.get('id')) == want]
        self._send(200, notes)
    def do_POST(self):
        if self.path != '/notes': return self._send(404, {'error': 'not found'})
        n = int(self.headers.get('Content-Length') or 0)
        if n > 20000: return self._send(413, {'error': 'too long'})
        try: body = json.loads(self.rfile.read(n).decode('utf-8'))
        except Exception: return self._send(400, {'error': 'bad json'})
        note = str(body.get('note', '')).strip()
        if not note: return self._send(400, {'error': 'empty'})
        notes = load()
        notes.append({'t': int(time.time() * 1000), 'id': body.get('id'), 'addr': str(body.get('addr', ''))[:200], 'note': note[:5000], 'style': body.get('style'), 'done': False})
        save(notes); self._send(200, {'ok': True, 'count': len(notes)})
    def log_message(self, *a): pass

if __name__ == '__main__':
    os.makedirs(os.path.dirname(PATH), exist_ok=True)
    ThreadingHTTPServer(('0.0.0.0', 8080), H).serve_forever()
