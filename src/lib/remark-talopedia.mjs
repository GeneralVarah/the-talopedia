import { CUSTOM, custom } from './inline.mjs';


/**
 * Turns [[wikilinks]], :icon[slug], :flag[slug], :up and :down into HTML.
 * Only visits text nodes, so code blocks and inline code are left alone.
 */
export default function remarkTalopedia() {
  return (tree) => walk(tree);
}

function walk(node, parent, index) {
  if (node.type === 'text' && parent && CUSTOM.test(node.value)) {
    CUSTOM.lastIndex = 0;
    const parts = [];
    let last = 0, m;
    while ((m = CUSTOM.exec(node.value))) {
      if (m.index > last) parts.push({ type: 'text', value: node.value.slice(last, m.index) });
      parts.push({ type: 'html', value: custom(m, true) });
      last = m.index + m[0].length;
    }
    if (last < node.value.length) parts.push({ type: 'text', value: node.value.slice(last) });
    parent.children.splice(index, 1, ...parts);
    return;
  }
  if (!node.children) return;
  for (let i = node.children.length - 1; i >= 0; i--) walk(node.children[i], node, i);
}
