import os, re, sys, glob, json, hashlib, struct, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from convert import parse

ROOT = '/Users/zli/Documents/NICHIRIN/Programs/The Talopedia'
SRC = os.path.join(ROOT, 'old portals')
NAMES = {}
for line in open(os.path.join(ROOT, 'src/content/data/nations.yaml'), encoding='utf-8'):
    m = re.search(r'id:\s*([a-z0-9-]+),?\s*name:\s*([^,}]+)', line) or \
        re.search(r'^\s*-\s*id:\s*([a-z0-9-]+)', line)
    if m and m.lastindex == 2:
        NAMES[m.group(1)] = m.group(2).strip()
    elif m:
        cur = m.group(1)
        NAMES.setdefault(cur, cur.title())

def dims(b):
    if b[:8] == b'\x89PNG\r\n\x1a\n':
        w, h = struct.unpack('>II', b[16:24]); return w, h
    if b[:2] == b'\xff\xd8':
        i = 2
        while i < len(b) - 9:
            if b[i] != 0xFF: i += 1; continue
            m = b[i+1]
            if m in (0xC0, 0xC1, 0xC2):
                h, w = struct.unpack('>HH', b[i+5:i+9]); return w, h
            i += 2 + struct.unpack('>H', b[i+2:i+4])[0]
    return 0, 0

files = sorted(glob.glob(os.path.join(SRC, 'TALOPEDIA _ Portal_*.docx')))
parsed = {}
counts = collections.Counter()
for f in files:
    d = parse(f)
    parsed[f] = d
    for name, b in d['images']:
        counts[hashlib.sha1(b).hexdigest()] += 1
# The Talopedia logo is the one image that appears in every portal.
logo = {h for h, n in counts.items() if n >= len(files) - 1}

def yq(s):
    return '"' + str(s).replace('\\', '\\\\').replace('"', '\\"') + '"'

report = []
for f in files:
    d = parsed[f]
    nid = re.search(r'Portal_(.+)\.docx$', os.path.basename(f)).group(1)
    nid = nid.replace('.', '').lower()
    name = NAMES.get(nid, nid.title())

    banner = ''
    best = None
    for fn, b in d['images']:
        if hashlib.sha1(b).hexdigest() in logo:
            continue
        w, h = dims(b)
        # Banners vary from 5:1 to nearly 2:1; the CSS crops them to a common band.
        if w and h and w / h >= 1.4 and (best is None or w * h > best[2]):
            best = (fn, b, w * h)
    if best:
        ext = os.path.splitext(best[0])[1] or '.png'
        out = f'/assets/media/{nid}-portal-banner{ext}'
        open(ROOT + '/public' + out, 'wb').write(best[1])
        banner = out

    fm = [f'title: {yq("Portal:" + name)}', f'nation: {nid}']
    if banner: fm.append(f'banner: {banner}')
    if d['welcome']: fm.append(f'welcome: {yq(d["welcome"].strip())}')
    body = d['lede'].strip()
    open(f'{ROOT}/src/content/portals/{nid}.md', 'w', encoding='utf-8').write(
        '---\n' + '\n'.join(fm) + '\n---\n\n' + body + '\n')

    nb = [f'title: {yq(d["title"] or name + " Articles")}',
          f'crumb: {yq(f"[[portal:{nid}|Portal:{name}]] • [[{nid}|Overview]]")}',
          'groups:']
    for g in d['groups']:
        nb.append(f'  - label: {yq(g["label"])}')
        nb.append('    rows:')
        for r in g['rows']:
            if r['label']:
                nb.append(f'      - label: {yq(r["label"])}')
                nb.append('        items:')
                for it in r['items']: nb.append(f'          - {yq(it)}')
            else:
                nb.append('      - items:')
                for it in r['items']: nb.append(f'          - {yq(it)}')
    nb_path = f'{ROOT}/src/content/data/navboxes/{nid}.yaml'
    if d['groups']:
        open(nb_path, 'w', encoding='utf-8').write('\n'.join(nb) + '\n')
    elif os.path.exists(nb_path):
        os.remove(nb_path)   # every row was empty, so there is no navbox to show
    report.append((nid, name, bool(banner), bool(d['welcome']), len(d['groups']),
                   sum(len(r['items']) for g in d['groups'] for r in g['rows'])))

for r in report:
    print(f'{r[0]:<14} banner={"yes" if r[2] else "NO ":<3} welcome={"yes" if r[3] else "NO ":<3} groups={r[4]:<2} links={r[5]}')
