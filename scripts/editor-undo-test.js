// Drives the built editor headless: types, pauses, moves between boxes and pages,
// undoes and redoes, and writes a pass/fail list into #undo-results. Run through
// scripts/editor-undo-test.sh.
(async () => {
  const out = [];
  const ok = (name, cond, got) => out.push(`${cond ? 'ok  ' : 'FAIL'} ${name}${cond ? '' : `  got ${JSON.stringify(got)}`}`);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (s) => document.querySelector(s);
  const paras = () => [...document.querySelectorAll('#body .ce')];
  const txt = (i = 0) => paras()[i]?.textContent.replace(/\u00a0/g, ' ');
  const click = (el) => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  const focusEnd = (el) => {
    click(el);
    el.focus();
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  };
  const type = (text) => { for (const ch of text) document.execCommand('insertText', false, ch); };
  const undo = () => $('#undo').click();
  const redo = () => $('#redo').click();
  const caret = () => {
    const s = getSelection();
    if (!s.rangeCount) return null;
    const n = s.focusNode;
    const box = (n.nodeType === 1 ? n : n.parentElement).closest('[contenteditable="true"]');
    const r = document.createRange(); r.selectNodeContents(box); r.setEnd(n, s.focusOffset);
    return { box, at: r.toString().length };
  };
  window.confirm = () => true;
  try {
    await sleep(1500);

    // A word at a time.
    focusEnd(paras()[0]);
    type('hello world again');
    ok('typed a sentence', txt() === 'hello world again', txt());
    undo();
    ok('undo takes the last word only', txt() === 'hello world ', txt());
    const c1 = caret();
    ok('caret lands where that word was', c1?.box === paras()[0] && c1?.at === 12, c1?.at);
    undo();
    ok('the next undo takes the word before, keeping its space', txt() === 'hello ', txt());
    redo();
    ok('redo puts it back', txt() === 'hello world ', txt());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }));
    ok('ctrl+y redoes', txt() === 'hello world again', txt());
    const c2 = caret();
    ok('redo leaves the caret at the end of what came back', c2?.at === 17, c2?.at);

    // Typing straight after an undo keeps the state it undid to.
    undo();
    type('there');
    ok('typing after undo keeps the space', txt() === 'hello world there', txt());
    ok('and it is saved as an ordinary space', $('#preview').textContent.includes('hello world there') && !$('#preview').textContent.includes('\u00a0'), $('#preview').textContent.slice(-40));
    undo();
    ok('undo after that returns to the undone-to state', txt() === 'hello world ', txt());

    // A pause ends a step, even mid-word.
    focusEnd(paras()[0]);
    type('ab'); await sleep(1300); type('cd');
    undo();
    ok('a pause splits a step', txt() === 'hello world ab', txt());

    // Another box is another step, and undo goes there.
    focusEnd(paras()[0]);
    paras()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await sleep(50);
    const second = paras()[1];
    ok('enter made a second paragraph', !!second, paras().length);
    focusEnd(second);
    type('second');
    focusEnd(paras()[0]);
    type('X');
    undo();
    ok('undo in the first box takes only X', txt(0) === 'hello world ab' && txt(1) === 'second', [txt(0), txt(1)]);
    undo();
    ok('then the second box', txt(1) === '', txt(1));
    const c3 = caret();
    ok('caret moved to the second box', c3?.box === paras()[1], c3 && paras().indexOf(c3.box));
    undo();
    ok('then the new paragraph itself', paras().length === 1, paras().length);

    // A sidebar cell is a step of its own.
    const cell = [...document.querySelectorAll('.ib-edit td .ce')][0];
    const cellWas = cell.textContent;
    focusEnd(cell);
    type('Tokyo');
    focusEnd(paras()[0]);
    type('Y');
    undo(); undo();
    const cellNow = [...document.querySelectorAll('.ib-edit td .ce')][0].textContent;
    ok('undo reaches back into the sidebar, one step each', cellNow === cellWas && txt() === 'hello world ab', [cellNow, cellWas, txt()]);

    // A link added mid-sentence leaves ordinary spaces either side, so the words
    // around it still wrap one at a time.
    focusEnd(paras()[0]);
    paras()[0].textContent = '';
    type('The quick brown fox jumps over the lazy dog.');
    const tn = paras()[0].firstChild;
    const at = tn.nodeValue.indexOf('brown');
    const sr = document.createRange(); sr.setStart(tn, at); sr.setEnd(tn, at + 9);
    getSelection().removeAllRanges(); getSelection().addRange(sr);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    $('#lp-target').value = 'brown-fox';
    $('#lp-apply').click();
    const linked = paras()[0];
    ok('link inserted', !!linked.querySelector('a[data-slug="brown-fox"]'), linked.innerHTML);
    ok('no glued spaces around the link', !linked.innerHTML.includes('&nbsp;') && !linked.textContent.includes('\u00a0'), linked.innerHTML);

    // An empty table cell takes the caret where it is clicked. With no height it was
    // no place for one, so the click, and the typing, went to the cell beside it.
    focusEnd(paras()[0]);
    document.querySelector('.tbl-cell[data-r="3"][data-c="2"]').click();
    await sleep(100);
    const cellBox = (r, c) => [...document.querySelectorAll('.ed-tbl tr')][r].querySelectorAll('td, th')[c].querySelector('.ce');
    const blankCell = cellBox(1, 0);
    ok('an empty cell is a line tall', blankCell.getBoundingClientRect().height > 10, blankCell.getBoundingClientRect().height);
    blankCell.scrollIntoView({ block: 'center' });
    const rc = blankCell.closest('td').getBoundingClientRect();
    // Where a click in the middle of the cell puts the caret, then typing there. The
    // hit test alone reports the right cell even when the bug is live; it is the
    // typing that shows where the caret really was.
    const hit = document.caretRangeFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2);
    getSelection().removeAllRanges(); getSelection().addRange(hit);
    document.execCommand('insertText', false, 'Club');
    const rowText = [...blankCell.closest('tr').querySelectorAll('td:not(.row-x)')].map((c) => c.textContent);
    ok('typing where it was clicked goes into it', rowText[0] === 'Club' && rowText[1] === '', rowText);
    blankCell.textContent = '';
    // What a cell holds once its last letter is deleted is a lone <br>: a blank cell.
    blankCell.innerHTML = '<br>';
    blankCell.dispatchEvent(new Event('input', { bubbles: true }));
    const tableMd = $('#preview').textContent.split('\n').filter((l) => l.startsWith('|'));
    ok('a cell emptied by deleting saves blank', tableMd.length > 0 && !tableMd.join('\n').includes('<br>'), tableMd);

    // A new page cannot be undone into the old one.
    $('#new').click();
    await sleep(50);
    ok('new page: nothing to undo', $('#undo').disabled === true, $('#undo').disabled);
    focusEnd(paras()[0]);
    type('fresh');
    undo(); undo(); undo();
    ok('undo stops at the new page', txt() === '' && !document.body.textContent.includes('hello world'), txt());

    // An arrow straight before a digit (:down1) is an arrow, before and after an undo.
    $('#file-q').value = 'nichirin national football';
    $('#file-q').dispatchEvent(new Event('input'));
    [...document.querySelectorAll('#file-list button')].find((b) => /Nichirin national football team/i.test(b.textContent)).click();
    await sleep(800);
    const rankCell = () => [...document.querySelectorAll('.ib-edit tr')].find((tr) => /Current \(1934\)/.test(tr.textContent))?.querySelector('td .ce');
    ok('opened with the ranking arrow as an arrow', rankCell()?.querySelector('[data-tok="down"]') && !rankCell().textContent.includes(':down'), rankCell()?.innerHTML);
    focusEnd(paras()[0]);
    type(' zz');
    undo();
    ok('still an arrow after undo', rankCell()?.querySelector('[data-tok="down"]') && !rankCell().textContent.includes(':down'), rankCell()?.innerHTML);
    ok('and saved as :down1', $('#preview').textContent.includes('3 (:down1)'), ($('#preview').textContent.match(/Current \(1934\).*/) || [''])[0]);

    // Date panel: Age asks for Born, and Died only if dead.
    document.querySelector('#dt-mode button[data-mode="age"]').click();
    ok('age relabels the date as Born', $('#dt-date-label').textContent === 'Born', $('#dt-date-label').textContent);
    ok('died shows, marked optional', !$('#dt-died-row').hidden && /optional/.test($('#dt-died-row').textContent), $('#dt-died-row').hidden);
    $('#dt-date').value = '1888-06-09'; $('#dt-date').dispatchEvent(new Event('input'));
    ok('born only: age now', /^June 9, 1888 \(aged \d+\)$/.test($('#dt-preview').textContent), $('#dt-preview').textContent);
    $('#dt-died').value = '1933-05-11'; $('#dt-died').dispatchEvent(new Event('input'));
    ok('with died: that date, age at death', $('#dt-preview').textContent === 'May 11, 1933 (aged 44)', $('#dt-preview').textContent);
    document.querySelector('#dt-mode button[data-mode=""]').click();
    ok('plain puts the label back and hides died', $('#dt-date-label').textContent === 'Date' && $('#dt-died-row').hidden, $('#dt-date-label').textContent);
  } catch (err) {
    out.push('FAIL threw: ' + err.message);
  }
  const pre = document.createElement('pre');
  pre.id = 'undo-results';
  pre.textContent = out.join('\n');
  document.body.append(pre);
})();
