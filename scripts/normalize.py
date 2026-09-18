"""One pass over the generated content to make formatting consistent."""
import glob, os, re

ROOT = '/Users/zli/Documents/NICHIRIN/Programs/The Talopedia'
SMALL = {'of','the','and','in','on','at','to','a','an','for','from','by','de','von','with','per'}

NATION_NAME = {}
for line in open(f'{ROOT}/src/content/data/nations.yaml', encoding='utf-8'):
    m = re.search(r'id:\s*([a-z0-9-]+)[,\s]', line + ' ')
    if m:
        NATION_NAME[m.group(1)] = (re.search(r'name:\s*"?([^",}]+)', line) or [None, ''])[1].strip()

HEADINGS = {
    'government and politics': 'Government', 'politics and government': 'Government',
    'politics': 'Government', 'administration': 'Government', 'governance': 'Government',
    'defence': 'Military', 'defense': 'Military', 'armed forces': 'Military',
    'economy and administration': 'Economy',
    'culture and symbols': 'Culture', 'culture and society': 'Culture',
}
BANDS = {'government': 'Administration', 'governance': 'Administration',
         'personal details': 'Personal Details', 'misc info': 'Miscellaneous Info',
         'miscellaneous': 'Miscellaneous Info'}
# Section bands that are really a field whose value went missing.
NOT_A_BAND = re.compile(
    r'^(•|alpha-[23] code|water area|land area|budget|density|per capita|total|water %|'
    r'.*\bincumbent\b|.*\btenure\b|.*\|)', re.I)

def cap(w, first):
    if not w or w[1:] != w[1:].lower():          # GDP, CEO, E.S.U., McX - leave alone
        return w
    if not first and w.lower() in SMALL:
        return w.lower()
    return w[:1].upper() + w[1:]

def titlecase(s):
    out = []
    for i, word in enumerate(s.split(' ')):
        # Hyphenated compounds follow the same rule inside: Commander-in-Chief.
        parts = word.split('-')
        out.append('-'.join(cap(p, i == 0 and j == 0) for j, p in enumerate(parts)))
    return ' '.join(out)

def fix_bold(line):
    """Balance ** on a line and keep a space around each marker.

    Markers alternate opener, closer, so their parity says which is which. An
    opener glued to the previous word, or a closer glued to the next, is the
    import having eaten the space. An odd count means one marker has no partner,
    and the safest repair is to drop the last one rather than guess where its
    partner belonged.
    """
    if '**' not in line:
        return line
    if line.lstrip().startswith('|'):
        # Repair each cell on its own; a table row's pipes are not emphasis.
        return '|'.join(fix_bold(c) if '**' in c else c for c in line.split('|'))
    parts = line.split('**')
    if len(parts) % 2 == 0:                       # odd number of markers
        parts[-2] = parts[-2] + parts[-1]
        parts.pop()
    out = parts[0]
    for i in range(1, len(parts)):
        opener = i % 2 == 1
        if opener and out and out[-1].isalnum():
            out += ' '
        out += '**' + parts[i]
        if not opener and parts[i][:1].isalnum() is False:
            pass
    # a closer welded to the next word
    out = re.sub(r'(\*\*)([(\w])', lambda m: m.group(1) + ' ' + m.group(2)
                 if m.start() and out[:m.start()].count('**') % 2 == 1 else m.group(0), out)
    return out

def unweld(s):
    return re.sub(r'([a-z]{3,})([A-Z][a-z]{3,})', r'\1 \2', s)

def normalize(path):
    raw = open(path, encoding='utf-8').read()
    if not raw.startswith('---'):
        return 0
    _, fm, body = raw.split('---', 2)
    before = raw

    nation = (re.search(r'^nation:\s*(\S+)', fm, re.M) or [None, ''])[1]
    kind = (re.search(r'^type:\s*(\w+)', fm, re.M) or [None, ''])[1]

    lines, out = fm.split('\n'), []
    for i, line in enumerate(lines):
        m = re.match(r'^(\s*-\s*\{\s*section:\s*")([^"]+)(".*)$', line)
        if m:
            name = unweld(m.group(2)).strip()
            if NOT_A_BAND.match(name) or name.startswith('[['):
                continue                                  # empty field, not a band
            nxt = next((l for l in lines[i + 1:] if l.strip()), '')
            if re.match(r'^\s*-\s*\{\s*section:', nxt) or not nxt.startswith(' '):
                continue                                  # band with nothing under it
            # A band holding a link or emphasis is markup, not a heading to recase.
            if re.search(r'\[\[|\]\(|\*|:icon|:flag', name):
                out.append(m.group(1) + name + m.group(3))
            else:
                out.append(m.group(1) + titlecase(BANDS.get(name.lower(), name)) + m.group(3))
            continue
        line = re.sub(r'(label:\s*")([^"]+)(")',
                      lambda x: x.group(1) + titlecase(unweld(x.group(2))) + x.group(3), line)
        line = re.sub(r'(title:\s*")([^"]+)(")',
                      lambda x: x.group(1) + unweld(x.group(2)) + x.group(3), line)
        if not re.match(r'^\s*(nativeTitle|romaji):', line):
            line = re.sub(r'(value:\s*")([^"]+)(")',
                          lambda x: x.group(1) + unweld(x.group(2)) + x.group(3), line)
            line = re.sub(r'^(\s+- ")([^"]+)(")',
                          lambda x: x.group(1) + unweld(x.group(2)) + x.group(3), line)
        out.append(line)
    fm = '\n'.join(out)

    # A nation's article takes the registry's short name; the official form stays
    # in the infobox header and in the opening sentence.
    if kind == 'overview' and NATION_NAME.get(nation):
        fm = re.sub(r'^title:\s*"[^"]*"', f'title: "{NATION_NAME[nation]}"', fm, count=1, flags=re.M)

    def head(m):
        name = m.group(1).strip()
        return '## ' + HEADINGS.get(name.lower(), name)
    body = re.sub(r'^## (.+)$', head, body, flags=re.M)

    # Stacked emphasis from the import: ****X**** and ******X******.
    body = re.sub(r'\*{4,}', '**', body)
    body = re.sub(r'\*\*\s*\*\*', ' ', body)
    body = '\n'.join(fix_bold(l) for l in body.split('\n'))
    # A link whose trailing space was eaten: "[capital](...)of Nichirin".
    body = re.sub(r'(\]\([^)\s]+\))([A-Za-z])', r'\1 \2', body)
    body = re.sub(r'(\]\])([A-Za-z])', r'\1 \2', body)

    title = (re.search(r'^title:\s*"([^"]+)"', fm, re.M) or [None, ''])[1]
    paras = [p for p in body.strip().split('\n\n') if p.strip()]

    # The out-of-character disclaimer is a frontmatter flag here, not body text.
    if paras and re.match(r'^\*?This article contains out-of-character', paras[0].strip()):
        paras.pop(0)
        if not re.search(r'^ooc:', fm, re.M):
            fm = re.sub(r'^(type:.*)$', r'\1\nooc: true', fm, count=1, flags=re.M)

    # The Manual of Style bolds the subject where the article opens.
    if paras and title and '**' not in paras[0] and not paras[0].lstrip().startswith(('#', '<', '|', '[[#')):
        # The subject first, then shorter forms of it, and only then the nation:
        # "Ahanestan Province" must not fall back to bolding "Varahmehr".
        words = title.split()
        probes = [title] + [' '.join(words[:i]) for i in range(len(words) - 1, 0, -1)]
        probes.append(NATION_NAME.get(nation, ''))
        for probe in probes:
            if probe and probe in paras[0]:
                paras[0] = paras[0].replace(probe, f'**{probe}**', 1)
                break
    body = '\n' + '\n\n'.join(paras) + '\n'

    new = '---' + fm + '---' + body
    if new != before:
        open(path, 'w', encoding='utf-8').write(new)
        return 1
    return 0

if __name__ == '__main__':
    n = sum(normalize(f) for f in glob.glob(f'{ROOT}/src/content/articles/*.md')
            + glob.glob(f'{ROOT}/src/content/portals/*.md'))
    print('files changed:', n)
