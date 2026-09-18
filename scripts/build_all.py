import os, re, sys, glob, hashlib, struct, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from article import (Doc, W, parse_article, render_body, plain, junk, slugify, pretty)
from convert import parse as parse_portal

ROOT = '/Users/zli/Documents/NICHIRIN/Programs/The Talopedia'
SRC = os.path.join(ROOT, 'old portals')
MEDIA = os.path.join(ROOT, 'public/assets/media')

NATIONS = {}
for line in open(f'{ROOT}/src/content/data/nations.yaml', encoding='utf-8'):
    m = re.search(r'id:\s*([a-z0-9-]+)[,\s]', line + ' ')
    if not m:
        continue
    nid = m.group(1)
    name = (re.search(r'name:\s*"?([^",}]+)', line) or [None, nid.title()])[1].strip()
    adj = (re.search(r'adjective:\s*"?([^",}]+)', line) or [None, ''])[1].strip()
    NATIONS[nid] = (name, adj)

def find_nation(*texts):
    blob = ' '.join(t for t in texts if t).lower()
    for nid, (name, adj) in NATIONS.items():
        for probe in (name, adj, nid):
            if probe and re.search(r'\b' + re.escape(probe.lower()) + r'\b', blob):
                return nid
    return ''

def dims(b):
    if b[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack('>II', b[16:24])
    if b[:2] == b'\xff\xd8':
        i = 2
        while i < len(b) - 9:
            if b[i] != 0xFF:
                i += 1; continue
            if b[i + 1] in (0xC0, 0xC1, 0xC2):
                h, w = struct.unpack('>HH', b[i + 5:i + 9]); return w, h
            i += 2 + struct.unpack('>H', b[i + 2:i + 4])[0]
    return 0, 0

LOGO = set()

def typeof(labels, header, title=''):
    L = {l.lower().rstrip(':') for l in labels}
    hdr = (' '.join(header) + ' ' + title).lower()
    if {'born'} & L and ({'ethnicity', 'nationality', 'died', 'spouse', 'children', 'alma mater'} & L):
        return 'character'
    if {'theology', 'primary text', 'orientation'} & L:
        return 'religion'
    if {'date', 'result'} <= L or ({'result', 'territorial changes', 'belligerents', 'casualties'} & L):
        return 'event'
    if {'industries', 'industry'} & L and {'revenue', 'net income', 'total assets', 'founder'} & L:
        return 'company'
    if {'service branches', 'service branch', 'commander-in-chief', 'commander general'} & L \
       or re.search(r'\b(armed forces|army|navy|air force|military)\b', hdr):
        return 'military'
    # A body with a headquarters and its own personnel but no branches is an
    # organisation, not a military.
    if {'headquarters'} & L and {'active personnel', 'reserve personnel', 'conscription', 'budget'} & L:
        return 'organization'
    if {'central body', 'orbital period', 'axial tilt', 'stellar objects'} & L or \
       ({'land area', 'entities'} <= L):
        return 'geography'
    if {'ostāndār', 'delegates', 'water %', 'highest elevation'} & L and 'country' in L:
        return 'geography'
    if {'mayor', 'districts', 'governor'} & L or ('body' in L and {'formation', 'population', 'area'} & L):
        return 'city'
    if ({'capital', 'largest city'} <= L or 'capital and largest city' in L) and \
       {'government', 'type', 'legislature'} & L:
        return 'overview'
    if {'origin', 'key figures', 'ideology', 'founder'} & L or (not L and re.search(r'ism$', title, re.I)):
        return 'ideology'
    return 'list'

def yq(s):
    return '"' + str(s).replace('\\', '\\\\').replace('"', '\\"') + '"'

def build(path):
    base = os.path.basename(path)[12:-5]
    slug = slugify(base)
    parsed = parse_article(path)
    if not parsed:
        return None
    doc, header, infobox, parts = parsed
    seen = {}

    def save(rid, caption=''):
        b, ext = doc.image_bytes(rid)
        if not b:
            return ''
        h = hashlib.sha1(b).hexdigest()
        if h in LOGO:
            return ''
        w, hh = dims(b)
        if (w, hh) == (1800, 360):
            LOGO.add(h); return ''
        if h in seen:
            return seen[h]
        name = f'{slug}-{len(seen) + 1}{ext}'
        dest = os.path.join(MEDIA, name)
        open(dest, 'wb').write(b)
        # Photographs arrive as multi-megabyte PNGs; flags and emblems stay PNG
        # because flat colour compresses better losslessly and JPEG rings on edges.
        if ext.lower() == '.png' and len(b) > 300_000:
            alt = dest[:-4] + '.jpg'
            r = subprocess.run(['sips', '-Z', '1600', '-s', 'format', 'jpeg',
                                '-s', 'formatOptions', '82', dest, '--out', alt],
                               capture_output=True)
            if r.returncode == 0 and os.path.exists(alt) and os.path.getsize(alt) < len(b):
                os.remove(dest)
                name = os.path.basename(alt)
            elif os.path.exists(alt):
                os.remove(alt)
        seen[h] = f'/assets/media/{name}'
        return seen[h]

    labels = [r['label'] for r in infobox if 'label' in r]
    kind = typeof(labels, header, base)
    country = ''
    for r in infobox:
        if r.get('label', '').lower() in ('country', 'nationality'):
            country = ' '.join(r['value'])
    body_head = ' '.join(x for x in render_body(doc, parts[:1], slug, lambda *_: '')[:2])
    nation = (find_nation(country) or find_nation(base) or find_nation(' '.join(header))
              or find_nation(body_head))

    title = plain(header[0]) if header else pretty(slug)
    # Some documents have no infobox header, so the first cell is an image
    # caption. A sentence is never a title.
    first_band = next((r['section'] for r in infobox if 'section' in r), None)
    if len(title) > 60 or re.search(r'[.!?]\s', title) or title.endswith('.') \
       or (first_band and plain(title) == plain(first_band)):
        title = pretty(slug)
    native = plain(header[1]) if len(header) > 1 and not junk(header[1]) else ''
    romaji = plain(header[2]) if len(header) > 2 and not junk(header[2]) else ''

    rows = []
    for r in infobox:
        if 'pair' in r:
            rows.append('  - pair:')
            for col in r['pair']:
                head = next((t for _, t in col if t), '')
                rows.append(f'      - heading: {yq(plain(head))}')
                rows.append('        items:')
                for blips, text in col:
                    text = plain(text).strip()
                    if not text or text == plain(head).strip() or junk(text):
                        continue
                    bullet = '• ' if text.startswith('•') else ''
                    text = text.lstrip('•').strip()
                    img = save(blips[0]) if blips else ''
                    if text.startswith('[['):
                        link = text                 # the document already linked it
                    else:
                        target = slugify(text)      # not `slug`: that names the file
                        link = f'[[{target}]]' if pretty(target) == text else f'[[{target}|{text}]]'
                    prefix = f':img[{img}] ' if img else ''
                    rows.append(f'          - {yq(bullet + prefix + link)}')
            continue
        if 'image' in r:
            p = save(r['image'], r.get('caption', ''))
            if p:
                rows.append(f'  - {{ image: {yq(p)}, caption: {yq(r.get("caption", ""))} }}')
        elif 'section' in r:
            rows.append(f'  - {{ section: {yq(r["section"])} }}')
        else:
            vals = [plain(v) for v in r['value']]
            sub = ', sub: true' if r['sub'] else ''
            if len(vals) == 1:
                rows.append(f'  - {{ label: {yq(r["label"])}{sub}, value: {yq(vals[0])} }}')
            else:
                rows.append(f'  - label: {yq(r["label"])}')
                if r['sub']:
                    rows.append('    sub: true')
                rows.append('    value:')
                rows += [f'      - {yq(v)}' for v in vals]
    # a section heading with nothing under it is an empty band
    out_rows = []
    for i, line in enumerate(rows):
        if line.strip().startswith('- { section:') and (i + 1 >= len(rows) or rows[i + 1].strip().startswith('- { section:')):
            continue
        out_rows.append(line)

    fm = [f'title: {yq(title)}']
    if native: fm.append(f'nativeTitle: {yq(native)}')
    if romaji: fm.append(f'romaji: {yq(romaji)}')
    fm.append(f'type: {kind}')
    if nation: fm.append(f'nation: {nation}')
    if out_rows:
        fm.append('infobox:')
        fm += out_rows

    body = render_body(doc, parts, slug, save)
    body = [b for b in body if not junk(b)]
    open(f'{ROOT}/src/content/articles/{slug}.md', 'w', encoding='utf-8').write(
        '---\n' + '\n'.join(fm) + '\n---\n\n' + '\n\n'.join(body) + '\n')
    return slug, kind, nation, len(out_rows), len(body), len(seen)

if __name__ == '__main__':
    os.chdir(SRC)
    # learn the Talopedia logo first: it is the image every document shares
    counts = {}
    for f in glob.glob('TALOPEDIA _ *.docx'):
        d = Doc(f)
        for rid in {b for b in d.blips(d.body)}:
            b, _ = d.image_bytes(rid)
            if b:
                counts[hashlib.sha1(b).hexdigest()] = counts.get(hashlib.sha1(b).hexdigest(), 0) + 1
    LOGO.update(h for h, n in counts.items() if n >= 8)

    for f in sorted(glob.glob('TALOPEDIA _ *.docx')):
        if '_Portal_' in f or 'Portal_' in f:
            continue
        r = build(f)
        if r:
            print(f'{r[0]:<28} type={r[1]:<10} nation={r[2] or "-":<12} ibrows={r[3]:<3} blocks={r[4]:<4} images={r[5]}')
