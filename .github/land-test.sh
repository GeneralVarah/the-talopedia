#!/bin/zsh
# Exercises land.mjs: branches made the way the editor makes them from a fork days
# behind main, landed on main as it stands. Run after touching the merge:
#
#   zsh .github/land-test.sh
#
# Everything happens in a throwaway worktree; the real checkout is never touched.
set -eu
REPO=$(cd "$(dirname "$0")/.." && pwd)
WT="${TMPDIR:-/tmp}/land-test-wt"
cd "$REPO"
git worktree remove --force "$WT" 2>/dev/null || true
git worktree add -q --detach "$WT" main
cd "$WT"

OLD=4edb6e1                       # a fork snapshot from before these pages existed
X=$(git rev-parse main)           # the copy of main the writer opened
P=src/content/articles/albinya.md
cfg=(-c user.email=t@t -c user.name=t)
fail=0
check() {   # check <label> <condition>
  if eval "$2"; then print -r -- "  ok    $1"; else print -r -- "  FAIL  $1"; fail=1; fi
}
# A pull request as the editor sends it: off the old fork, one commit per page with
# the page's whole text and the commit it was opened from.
pr() {   # pr <based-on or ""> <path> <content-file or "-" to delete>...
  local from=$1; shift
  git checkout -q --detach $OLD
  while (( $# )); do
    if [[ $2 == - ]]; then git rm -q -- $1 2>/dev/null || true
    else mkdir -p ${1:h}; cp $2 $1; git add -- $1; fi
    git $cfg commit -q --allow-empty -m "${1:t:r}: edit${from:+

Based-on: $from}"
    shift 2
  done
  PR=$(git rev-parse HEAD)
}
# Main as it stands when the pull request lands: the writer's copy, plus whatever
# the given script does to it.
onto() { git checkout -q --detach $X; [[ -n ${1:-} ]] && { eval "$1"; git $cfg commit -qam main; }; true; }
# The script from this checkout: the worktree sits on older commits that predate it.
land() { RESULT=$(ONTO=HEAD PR_HEAD=$PR node "$REPO/.github/land.mjs"); }
S=$(mktemp -d)

print "a page untouched on main since it was opened"
git show $X:$P > $S/p; print "Added by the writer." >> $S/p
pr $X $P $S/p; onto; land
check "lands"                       '[[ $RESULT == ready ]]'
check "exactly the writer's text"   'git show :$P | cmp -s - $S/p'

print "main changed another part of it since"
onto "sed -i '' '2s/.*/title: \"Albinya (renamed on main)\"/' $P"; land
check "lands"                       '[[ $RESULT == ready ]]'
check "keeps main's change"         'git show :$P | grep -q "renamed on main"'
check "and the writer's"            'git show :$P | grep -q "Added by the writer."'

print "main changed the same line since"
git show $X:$P | sed '2s/.*/title: "Albinya (the writer)"/' > $S/q
pr $X $P $S/q
onto "sed -i '' '2s/.*/title: \"Albinya (main)\"/' $P"; land
check "waits for a person"          '[[ $RESULT == wait* ]]'

print "sent by an older editor, with no Based-on"
pr "" $P $S/p; onto; land
check "hands it to GitHub's merge"  '[[ $RESULT == fallback ]]'

print "a new page"
print -- "---\ntitle: \"T\"\ntype: character\nnation: albinya\n---\n\nNew." > $S/n
pr $X src/content/articles/land-test-page.md $S/n; onto; land
check "lands"                       '[[ $RESULT == ready ]] && git show :src/content/articles/land-test-page.md | cmp -s - $S/n'

print "a new page at a name someone has taken since"
onto "cp $S/q src/content/articles/land-test-page.md; git add src/content/articles/land-test-page.md"; land
check "waits for a person"          '[[ $RESULT == wait* ]]'

print "deleting a page nobody has touched since"
D=src/content/articles/avium.md   # one the old fork already had
pr $X $D -; onto; land
check "lands, and the page is gone" '[[ $RESULT == ready ]] && ! git cat-file -e :$D 2>/dev/null'

print "pictures"
printf 'not really a png' > $S/img
pr $X public/assets/flags/land-test.png $S/img; onto; land
check "a new one lands"             '[[ $RESULT == ready ]]'
pr $X public/assets/flags/albinya.png $S/img; onto; land
check "one already on main waits"   '[[ $RESULT == wait* ]]'

print "bold that took a space along"
git reset -q --hard
git show $X:$P > $S/b; print "**Bold by the writer **and plain." >> $S/b
pr $X $P $S/b; onto; land
check "lands with the space outside" '[[ $RESULT == ready ]] && git show :$P | grep -qxF "**Bold by the writer** and plain."'

cd "$REPO"
git worktree remove --force "$WT"
rm -rf $S
print ""
[[ $fail == 0 ]] && print "every case holds" || print "SOME CASES DO NOT HOLD"
exit $fail
