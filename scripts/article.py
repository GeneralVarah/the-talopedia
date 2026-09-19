import zipfile, re, os, unicodedata
from xml.etree import ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
SMALL = {'of','the','and','in','on','at','to','a','an','for','from','by','de','von'}
JUNK = re.compile(
    r'^(tba|tbd|tbc|wip|n/?a|none|names?|names?\s*\(.*\)|anthem\s*name|song\s*name|'
    r'day\s*month\s*year|dd?/mm?/yyyy|insert.*|example.*|placeholder.*|unknown|lorem.*|'
    r'\-+|_+|\?+|\.+|0)$', re.I)

def plain(t):
    """Drop the emphasis markup the template uses for styling, not meaning."""
    return re.sub(r'\*+', '', str(t)).replace('“', '"').replace('”', '"').strip()

def slugify(t):
    t = unicodedata.normalize('NFKD', t)
    t = ''.join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"['’‘]", '', t)
    return re.sub(r'[^A-Za-z0-9]+', '-', t).strip('-').lower()

def pretty(s):
    return ' '.join(w if i and w in SMALL else (w[:1].upper() + w[1:]) for i, w in enumerate(s.split('-')))

# A placeholder anywhere in a short value poisons the whole value: "TBD km²",
# "TBA here", "WIP (administrative divisions)".
MARKED = re.compile(r'\b(tba|tbd|tbc|wip|under construction)\b', re.I)

def junk(t):
    t = plain(t).strip(' "\'')
    if not t:
        return True
    if MARKED.search(t):
        return True
    # "Anthem Name“Anthem Name"" and friends: the same placeholder run together.
    half = t[:len(t) // 2].strip(' "')
    if half and len(t) % 2 <= 1 and t.strip(' "').lower().replace('"', '') == (half + half).lower().replace('"', ''):
        t = half
    return bool(JUNK.match(t))

class Doc:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        self.rels = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"',
                                    self.z.read('word/_rels/document.xml.rels').decode()))
        self.body = ET.fromstring(self.z.read('word/document.xml')).find(W + 'body')
        self.used = {}

    def blips(self, node):
        return [m for m in (b.get(R + 'embed') for b in node.iter(
            '{http://schemas.openxmlformats.org/drawingml/2006/main}blip')) if m]

    def image_bytes(self, rid):
        t = self.rels.get(rid)
        if not t:
            return None, None
        try:
            return self.z.read('word/' + t), os.path.splitext(t)[1] or '.png'
        except KeyError:
            return None, None

    def para(self, p):
        """One paragraph as markdown, keeping bold, italics and links."""
        out = []
        for ch in p:
            if ch.tag == W + 'hyperlink':
                text = ''.join(t.text or '' for t in ch.iter(W + 't'))
                if not text.strip():
                    continue
                target = self.rels.get(ch.get(R + 'id'), '')
                lead = text[:len(text) - len(text.lstrip())]
                tail = text[len(text.rstrip()):]
                body = text.strip()
                if 'google.com' in target or not target:
                    s = slugify(body)
                    link = f'[[{s}]]' if pretty(s) == body else f'[[{s}|{body}]]'
                else:
                    link = f'[{body}]({target})'
                out.append(lead + link + tail)
            elif ch.tag == W + 'r':
                # A break inside a run is a real line break. Dropping it welded an
                # office heading to the term under it: "Senior Prosecutor19 October".
                t = ''.join('\n' if x.tag == W + 'br' else (x.text or '')
                            for x in ch.iter() if x.tag in (W + 't', W + 'br'))
                if not t:
                    continue
                pr = ch.find(W + 'rPr')
                mark = ('*' if pr is not None and pr.find(W + 'i') is not None
                        else '**' if pr is not None and pr.find(W + 'b') is not None else '')
                if mark and t.strip():
                    # Keep the surrounding spaces outside the markers, or two adjacent
                    # bold runs weld together: "Dashtestan " + "Province".
                    lead = t[:len(t) - len(t.lstrip())]
                    tail = t[len(t.rstrip()):]
                    t = f'{lead}{mark}{t.strip()}{mark}{tail}'
                out.append(t)
        return re.sub(r'\*\*\*\*|\*\*(?=\*\*)', '', ''.join(out)).strip()

    def style(self, p):
        pr = p.find(W + 'pPr')
        if pr is None:
            return ''
        st = pr.find(W + 'pStyle')
        return st.get(W + 'val') if st is not None else ''

def cell_lines(doc, tc):
    out = []
    for p in tc.findall(W + 'p'):
        t = doc.para(p)
        if t:
            out.append(t)
    return out

def parse_article(path):
    doc = Doc(path)
    tables = [c for c in doc.body if c.tag == W + 'tbl']
    if not tables:
        return None
    rows = tables[0].findall(W + 'tr')

    header, infobox, body_parts = [], [], []
    for tr in rows:
        tcs = tr.findall(W + 'tc')
        cs = [cell_lines(doc, x) for x in tcs]
        imgs = [doc.blips(x) for x in tcs]

        # The widest cell with prose is a slice of the article body.
        if cs and cs[0] and len(' '.join(cs[0])) > 40:
            body_parts.append(tcs[0])
            if len(cs) >= 3 and cs[2] and not header:
                header = cs[2]
            continue
        if len(cs) < 3:
            continue

        # A cell holding several pictures is either the sidebar's own header set
        # (flag, arms, location) or a strip of article figures. The header set is
        # known by its captions; anything else belongs in the body.
        HEADER = r'^(location|flag|emblem|coat of arms|map|seal|logo|insignia)\b'
        if len(imgs) >= 3 and len(imgs[2]) > 1:
            caps = [c for c in cs[2] if c.strip()]
            if caps and re.match(HEADER, plain(caps[0]).strip(), re.I):
                for rid, cap in zip(imgs[2], caps + [''] * len(imgs[2])):
                    infobox.append({'image': rid, 'caption': '' if junk(cap) else plain(cap)})
            else:
                body_parts.append(tcs[2])
            continue

        label = cs[2][0] if cs[2] else ''
        # Four cells means label + value. If the value is empty the row is a blank
        # field, not a section band, so it is dropped rather than promoted.
        if len(cs) >= 4 and not cs[3] and not imgs[2]:
            continue
        if len(cs) >= 4 and cs[3]:
            value = [v for v in cs[3] if not junk(v)]
            if value and not junk(label):
                lab = plain(label)
                infobox.append({'label': lab.lstrip('• ').strip(),
                                'sub': lab.startswith('•'),
                                'value': value})
        elif imgs[2]:
            infobox.append({'image': imgs[2][0], 'caption': '' if junk(label) else plain(label)})
        elif label and not junk(label):
            lab = plain(label)
            # A caption whose picture is missing is not a section heading. Matching
            # " of " anywhere as well used to stand in for "Coat of Arms", and took
            # Minister of Justice, Director of Intelligence and every other office
            # with it. The names below are anchored, which is enough on its own.
            if re.match(r'^(location|flag|emblem|coat of arms|map|seal|logo|portrait|insignia)\b',
                        lab, re.I):
                continue
            # An office block is the office on one line and the term served on the
            # next. The office names the band and the term is a line under it.
            head, *term = [x.strip() for x in lab.split('\n') if x.strip()]
            infobox.append({'section': head})
            for line in term:
                infobox.append({'band': line})

    return doc, header, infobox, body_parts

def is_caption(doc, node):
    """A short, unpunctuated line right after a picture is that picture's caption."""
    if node is None or node.tag != W + 'p':
        return False
    if doc.blips(node) or doc.style(node).startswith(('Title', 'Heading')):
        return False
    t = doc.para(node).strip()
    return bool(t) and len(t) < 130 and not re.search(r'[.!?]$', t)


def render_body(doc, parts, nid, save_image):
    """Body cells to markdown: headings, prose, image grids and tables."""
    out = []
    for tc in parts:
        nodes = list(tc)
        i = 0
        while i < len(nodes):
            node = nodes[i]
            if node.tag == W + 'tbl':
                out.extend(render_table(doc, node, save_image))
                i += 1
                continue
            if node.tag != W + 'p':
                i += 1
                continue

            text = doc.para(node)
            blips = doc.blips(node)
            st = doc.style(node)

            # A picture and the line under it are one figure. Documents lay these
            # out as alternating paragraphs, and reading the picture alone left the
            # caption behind as a stray sentence with an empty figcaption.
            if blips and not text:
                # A run of pictures, each captioned by the line beneath it. Blank
                # spacers sit between pairs and do not end the run.
                figs = []
                while i < len(nodes):
                    n = nodes[i]
                    if n.tag == W + 'p' and not doc.para(n) and not doc.blips(n):
                        i += 1
                        continue
                    if n.tag != W + 'p' or doc.para(n) or not doc.blips(n):
                        break
                    cap = ''
                    if is_caption(doc, nodes[i + 1] if i + 1 < len(nodes) else None):
                        cap = plain(doc.para(nodes[i + 1]).strip())
                        i += 1
                    for b in doc.blips(n):
                        pth = save_image(b, cap)
                        if pth:
                            c = '' if junk(cap) else cap
                            a = c.replace('"', '&quot;')
                            figs.append(f'<figure><img src="{pth}" alt="{a}"><figcaption>{c}</figcaption></figure>')
                    i += 1
                if figs:
                    out.append('<div class="imgrid">\n' + '\n'.join(figs) + '\n</div>')
                continue

            i += 1
            if not text:
                continue
            if st == 'Title':
                out.append('## ' + text)
            elif st.startswith('Heading'):
                out.append('### ' + text)
            else:
                out.append(text)
    return [o for o in out if o.strip()]

def spans(tc):
    """A cell's colspan, and whether it starts or continues a vertical merge."""
    pr = tc.find(W + 'tcPr')
    if pr is None:
        return 1, None
    gs = pr.find(W + 'gridSpan')
    vm = pr.find(W + 'vMerge')
    merge = None
    if vm is not None:
        merge = 'start' if vm.get(W + 'val') == 'restart' else 'cont'
    return (int(gs.get(W + 'val')) if gs is not None else 1), merge


def render_table(doc, tbl, save_image):
    grid, rows = [], tbl.findall(W + 'tr')
    pending = []
    for tr in rows:
        tcs = tr.findall(W + 'tc')
        sp = [spans(x) for x in tcs]
        imgs = [doc.blips(x) for x in tcs]
        text = [' '.join(cell_lines(doc, x)) for x in tcs]
        # A row carrying images AND its own text is a data row whose cells happen
        # to hold a flag, not a strip of pictures awaiting captions. Treating the
        # two alike threw away every city in Alemannia's and Cortesia's tables.
        if any(imgs) and not any(t.strip() for t in text):
            pending = [(i[0] if i else None) for i in imgs]
            continue
        if any(imgs):
            cells = []
            for tc, im, t in zip(tcs, imgs, text):
                t = t.replace('|', r'\|')
                path = save_image(im[0], '') if im else ''
                cells.append(f':img[{path}] {t}'.strip() if path else t)
            grid.append(('row', [{'text': c, 'cs': sp[k][0], 'vm': sp[k][1]}
                                 for k, c in enumerate(cells)]))
            continue
        if pending:
            figs = []
            for rid, cap in zip(pending, text + [''] * len(pending)):
                if not rid:
                    continue
                p = save_image(rid, cap)
                if p:
                    # figcaption is raw HTML, so emphasis markers would show literally
                    c = '' if junk(cap) else plain(cap)
                    figs.append(f'<figure><img src="{p}" alt="{c}"><figcaption>{c}</figcaption></figure>')
            if figs:
                grid.append('<div class="imgrid">\n' + '\n'.join(figs) + '\n</div>')
            pending = []
            continue
        # A cell continuing a vertical merge is empty in the file and carries no text
        # of its own, so a row is kept when it has either text or a merge to record.
        if any(t.strip() for t in text) or any(m for _, m in sp):
            grid.append(('row', [{'text': t.replace('|', r'\|'), 'cs': sp[k][0], 'vm': sp[k][1]}
                                 for k, t in enumerate(text)]))
    # stray images with no caption row
    if pending:
        figs = [f'<figure><img src="{save_image(r, "")}" alt=""><figcaption></figcaption></figure>'
                for r in pending if r]
        if figs:
            grid.append('<div class="imgrid">\n' + '\n'.join(figs) + '\n</div>')

    out, buf = [], []
    for g in grid:
        if isinstance(g, tuple) and g[0] == 'row':
            buf.append(g[1])
        else:
            if buf:
                out.append(as_table(buf)); buf = []
            out.append(g)
    if buf:
        out.append(as_table(buf))
    return out

def as_table(rows):
    """A markdown table while the shape allows it, HTML once a cell is merged.

    Word writes a merged block as a run of cells: the first carries the content and
    a vMerge of "restart", the rest are empty continuations. Markdown has no way to
    say that, and flattening it is what turned every statistics table into a grid of
    blanks, so a table carrying merges is written as HTML instead.
    """
    width = max(sum(c['cs'] for c in r) for r in rows)
    merged = any(c['cs'] > 1 or c['vm'] for r in rows for c in r)

    # A header band is the run of bold rows at the top, which is how a document marks
    # one. The cell is a <th> and already bold, so the markers come off.
    heads = 0
    for r in rows:
        filled = [c['text'].strip() for c in r if c['text'].strip()]
        if filled and all(t.startswith('**') and t.endswith('**') for t in filled):
            heads += 1
        else:
            break
    heads = max(heads, 1)
    for r in rows[:heads]:
        for c in r:
            t = c['text'].strip()
            if t.startswith('**') and t.endswith('**'):
                c['text'] = t[2:-2].strip()

    if not merged:
        flat = [[c['text'] for c in r] for r in rows]
        flat = [r + [''] * (width - len(r)) for r in flat]
        head, rest = flat[0], flat[1:]
        lines = ['| ' + ' | '.join(head) + ' |', '| ' + ' | '.join(['---'] * width) + ' |']
        lines += ['| ' + ' | '.join(r) + ' |' for r in rest]
        return '\n'.join(lines)

    # How far down each vertical merge runs, counted by column.
    depth = [[0] * len(r) for r in rows]
    for i, row in enumerate(rows):
        col = 0
        for k, c in enumerate(row):
            if c['vm'] == 'start':
                n, j = 1, i + 1
                while j < len(rows):
                    at, seen = None, 0
                    for c2 in rows[j]:
                        if seen == col:
                            at = c2
                            break
                        seen += c2['cs']
                    if at is None or at['vm'] != 'cont':
                        break
                    n += 1
                    j += 1
                depth[i][k] = n
            col += c['cs']

    def esc(t):
        return t.replace(r'\|', '|').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

    out = ['<table>']
    for i, row in enumerate(rows):
        tag = 'th' if i < heads else 'td'
        cells = []
        for k, c in enumerate(row):
            if c['vm'] == 'cont':
                continue                      # the cell above covers this square
            a = f' colspan="{c["cs"]}"' if c['cs'] > 1 else ''
            b = f' rowspan="{depth[i][k]}"' if depth[i][k] > 1 else ''
            cells.append(f'<{tag}{a}{b}>{esc(c["text"])}</{tag}>')
        if cells:
            out.append('<tr>' + ''.join(cells) + '</tr>')
    out.append('</table>')
    return '\n'.join(out)
