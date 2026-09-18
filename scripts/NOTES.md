
NOTE (2026-09-18): re.findall returns '' for a non-participating optional group,
not None. The link-merge helper treated '' as "explicit empty display text" and
produced [[]]. Use `d if d else pretty(t)`.
