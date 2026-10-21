#!/usr/bin/env bash
# Copies the game's models the prototype uses from app/assets into godot/assets,
# so the two projects share one set of source files. Run before opening the
# project in the editor or exporting (CI does it for you).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
src="$here/../app/assets/models"
dst="$here/assets/models"
mkdir -p "$dst/wardrobe"
for f in human dwarf elf skeleton battlefield \
  decor-brazier decor-pillar decor-banner decor-bones decor-grave decor-weapons \
  weapon-mace weapon-hand-axe weapon-flask weapon-bow weapon-longsword weapon-bone-sword weapon-staff \
  shield-round shield-skull; do
  cp -u "$src/$f.glb" "$dst/$f.glb"
done
for f in knight-human templar-dwarf arcane-human leather-elf; do
  cp -u "$src/wardrobe/$f.glb" "$dst/wardrobe/$f.glb"
done
echo "models synced to $dst"
