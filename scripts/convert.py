import zipfile, re, sys, os, unicodedata, json
from xml.etree import ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'

SKIP = re.compile(r'^(tba|tbd|wip|n/?a|none|\-+|\?+)$', re.I)
SMALL = {'of','the','and','in','on','at','to','a','an','for','from','by','de','von'}

def slugify(t):
    t = unicodedata.normalize('NFKD', t)
    t = ''.join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"[''‘’]", '', t)
    t = re.sub(r'[^A-Za-z0-9]+', '-', t).strip('-').lower()
    return t

def pretty(slug):
    parts = slug.split('-')
    return ' '.join(w if i > 0 and w in SMALL else (w[:1].upper() + w[1:]) for i, w in enumerate(parts))

def entry(text):
    text = text.strip()
    if not text or SKIP.match(text):
        return None
    s = slugify(text)
    if not s:
        return None
    return s if pretty(s) == text else f'{s}|{text}'

def cell_text(tc):
    out = []
    for p in tc.findall(W + 'p'):
        t = ''.join(n.text or '' for n in p.iter(W + 't')).strip()
        if t:
            out.append(t)
    return out

def parse(path):
    z = zipfile.ZipFile(path)
    doc = ET.fromstring(z.read('word/document.xml'))
    body = doc.find(W + 'body')
    tables = [c for c in body if c.tag == W + 'tbl']

    # --- header table: welcome line and lede ---
    head_paras = []
    for p in tables[0].iter(W + 'p'):
        t = ''.join(n.text or '' for n in p.iter(W + 't')).strip()
        if t:
            head_paras.append(t)
    lede = max(head_paras, key=len) if head_paras else ''
    before = [t for t in head_paras[:head_paras.index(lede)] if t != lede] if lede in head_paras else []
    welcome = before[-1] if before else ''

    # --- navbox table ---
    groups, title, crumb = [], '', ''
    if len(tables) > 1:
        rows = tables[1].findall(W + 'tr')
        first = cell_text(rows[0].findall(W + 'tc')[0])
        title = first[0] if first else ''
        crumb = first[1] if len(first) > 1 else ''
        group = None
        for tr in rows[1:]:
            cells = [cell_text(tc) for tc in tr.findall(W + 'tc')]
            cells = [c for c in cells]
            flat = [' '.join(c) for c in cells]
            if not any(flat):
                continue
            if flat[0]:
                group = {'label': flat[0], 'rows': []}
                groups.append(group)
                rest = flat[1:]
            else:
                rest = flat[1:]
            if group is None:
                continue
            # Two trailing cells means (sub-label, links); one means links alone.
            # A sub-label with nothing beside it is an empty row and is dropped.
            if len(rest) >= 2:
                label, items = rest[0], rest[1]
            elif rest:
                label, items = '', rest[0]
            else:
                continue
            if not items.strip():
                continue
            entries = [e for e in (entry(x) for x in re.split(r'\s*•\s*', items)) if e]
            if entries:
                group['rows'].append({'label': label, 'items': entries})
    groups = [g for g in groups if g['rows']]

    # --- images in document order ---
    rels = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', z.read('word/_rels/document.xml.rels').decode()))
    raw = z.read('word/document.xml').decode()
    blips = [rels[m] for m in re.findall(r'r:embed="(rId\d+)"', raw) if m in rels]
    images = []
    for t in blips:
        name = 'word/' + t
        try:
            images.append((t.split('/')[-1], z.read(name)))
        except KeyError:
            pass
    return {'welcome': welcome, 'lede': lede, 'title': title, 'crumb': crumb,
            'groups': groups, 'images': images}

if __name__ == '__main__':
    d = parse(sys.argv[1])
    d.pop('images')
    print(json.dumps(d, ensure_ascii=False, indent=1)[:3000])
