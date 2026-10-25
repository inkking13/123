extends SceneTree
## Picks the villagers' and heroes' clips out of the Universal Animation Library (Quaternius,
## CC0) into one small AnimationLibrary. Copy UAL1_Standard.glb and
## UAL2_Standard.glb into godot/tmp_ual/, import, then run:
## godot --headless --path godot -s ../tools/villagers/anims.gd

const CLIPS := ["Idle", "Walk", "Idle_Talking", "Idle_FoldArms", "Farm_Harvest", "Farm_Watering", "Sitting_Idle",
	"TreeChopping", "Walk_Carry", "Yes",
	# The heroes' fight: stances, blows, shield work, spells, throws, hits, a roll, falls.
	"Sword_Idle", "Idle_Shield", "Spell_Simple_Idle", "Jog_Fwd", "Sword_Attack", "Sword_Regular_A", "Sword_Regular_B",
	"Sword_Regular_Combo", "Sword_Heavy_Combo", "Sword_Dash", "Shield_OneShot", "Shield_Dash", "Spell_Simple_Shoot",
	"OverhandThrow", "Punch_Jab", "Punch_Cross", "Melee_Hook", "Consume", "Jump", "Hit_Chest", "Hit_Head", "Roll",
	"Death01"]
## The importer drops the clips' "_Loop" suffix; these all loop.
const LOOPS := ["Idle", "Walk", "Idle_Talking", "Idle_FoldArms", "Farm_Harvest", "Farm_Watering", "Sitting_Idle",
	"TreeChopping", "Walk_Carry", "Yes", "Sword_Idle", "Idle_Shield", "Spell_Simple_Idle", "Jog_Fwd"]

func _initialize() -> void:
	var lib = AnimationLibrary.new()
	for f in ["res://tmp_ual/UAL1_Standard.glb", "res://tmp_ual/UAL2_Standard.glb"]:
		var scene: Node = load(f).instantiate()
		var ap: AnimationPlayer = scene.find_child("AnimationPlayer", true, false)
		for name in ap.get_animation_list():
			if not name in CLIPS: continue
			var a: Animation = ap.get_animation(name).duplicate(true)
			if name in LOOPS: a.loop_mode = Animation.LOOP_LINEAR
			# Only the bones; no scale tracks, which the clips do not change.
			for t in range(a.get_track_count() - 1, -1, -1):
				if a.track_get_type(t) == Animation.TYPE_SCALE_3D: a.remove_track(t)
			lib.add_animation(name, a)
		scene.free()
	print("clips: ", lib.get_animation_list())
	ResourceSaver.save(lib, "res://assets/models/villagers/anims.res", ResourceSaver.FLAG_COMPRESS)
	quit()
