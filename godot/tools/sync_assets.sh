#!/usr/bin/env bash
# Copies the game's models and pictures from app/assets into godot/assets,
# so the two projects share one set of source files. Run before opening the
# project in the editor or exporting (CI does it for you).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
src="$here/../app/assets/models"
dst="$here/assets/models"
mkdir -p "$dst/wardrobe"
for f in human dwarf elf elf-male orc skeleton necromancer vex battlefield-mobile \
  decor-brazier decor-pillar decor-banner decor-bones decor-grave decor-weapons \
  weapon-mace weapon-hand-axe weapon-flask weapon-bow weapon-longsword weapon-bone-sword weapon-staff \
  weapon-dagger weapon-greataxe weapon-warhammer weapon-orb rune-axe \
  shield-round shield-skull helm-knight helm-veil helm-viking helm-warden; do
  cp -u "$src/$f.glb" "$dst/$f.glb"
done
for body in human dwarf elf elf-male orc; do
  for kit in knight templar arcane leather; do
    f="$kit-$body"
    [ -f "$src/wardrobe/$f.glb" ] || continue
    cp -u "$src/wardrobe/$f.glb" "$dst/wardrobe/$f.glb"
  done
done
echo "models synced to $dst"
# The interface's pictures: portraits, items, skills, monsters, key art and textures.
for d in portraits items skills monsters title ui; do
  mkdir -p "$here/assets/$d"
  cp -ru "$here/../app/assets/$d/." "$here/assets/$d/"
done
echo "pictures synced"
