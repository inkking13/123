class_name Villager
extends Node3D
## A villager on the map: the owner's Quaternius head (man or woman), one of
## the outfits in one of its colourings, a hairstyle and brows, all hung on one
## UE skeleton and played with the Universal Animation Library's clips.
## Parts are built by tools/villagers/build.py, the clips by anims.gd.

const DIR := "res://assets/models/villagers/"
const HEIGHT := 1.12 # as tall as a hero on the map
const MODEL_H := 1.8
const OUTFITS := ["peasant1", "peasant2", "ranger1", "ranger2"]
const HAIR := {"male": [["simpleparted"], ["buzzed", "beard"], ["long"], ["simpleparted", "beard"], ["buzzed"], ["long", "beard"]],
	"female": [["buns"], ["long"], ["buzzedfemale"]]}
const BROWS := {"male": "brows-regular", "female": "brows-female"}  # hair-<these>.glb
## The hair textures are grey; each villager's hair, beard and brows take one of these.
const HAIR_COLOURS := [Color(0.32, 0.2, 0.12), Color(0.16, 0.11, 0.08), Color(0.55, 0.38, 0.2), Color(0.5, 0.24, 0.12),
	Color(0.8, 0.65, 0.4), Color(0.75, 0.73, 0.7), Color(0.09, 0.08, 0.07)]
## Walking pace (m/s on the map) at which Walk's feet stay planted.
const PACE := 0.9

static var _lib: AnimationLibrary

var _anim: AnimationPlayer
var _skel: Skeleton3D
var _idle := "Idle"
var _tint: Color


## look: {sex, outfit, hair (index into HAIR[sex]), colour (into HAIR_COLOURS), idle}; anything left out is picked at random.
func setup(look: Dictionary = {}) -> void:
	var sex: String = look.get("sex", ["male", "female"].pick_random())
	var outfit: String = look.get("outfit", OUTFITS.pick_random())
	var hair: Array = HAIR[sex][look.get("hair", randi() % HAIR[sex].size())]
	_idle = look.get("idle", "Idle")
	_tint = HAIR_COLOURS[look.get("colour", randi() % HAIR_COLOURS.size())]
	var model := assemble(sex, [outfit + "-" + sex] + hair, _tint)
	model.scale = Vector3.ONE * HEIGHT / MODEL_H
	add_child(model)
	_skel = model.find_child("Skeleton3D", true, false)
	_anim = model.get_node("AnimationPlayer")
	play_idle()
	_anim.seek(randf() * _anim.current_animation_length, true)
	_anim.speed_scale = randf_range(0.9, 1.1)
	set_meta("pace", PACE)


## A Quaternius figure: the bare head of `sex` wearing `parts` (outfit, hair and
## beard files here), with brows, hair tinted `tint`, and an AnimationPlayer with
## every clip. Unit dresses its heroes the same way.
static func assemble(sex: String, parts: Array, tint: Color) -> Node3D:
	var model: Node3D = load(DIR + "head-%s.glb" % sex).instantiate()
	var skel: Skeleton3D = model.find_child("Skeleton3D", true, false)
	for part in parts + [BROWS[sex]]:
		var file: String = part if part.contains("-") and not part.begins_with("brows") else "hair-" + part
		var src: Node3D = load(DIR + file + ".glb").instantiate()
		for m in src.find_children("*", "MeshInstance3D", true, false):
			m.owner = null
			m.get_parent().remove_child(m)
			skel.add_child(m)
			m.skeleton = NodePath("..")
			if file.begins_with("hair-"):
				m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
				var mat: StandardMaterial3D = m.mesh.surface_get_material(0).duplicate()
				mat.albedo_color = tint
				m.material_override = mat
		src.free()
	if _lib == null: _lib = load(DIR + "anims.res")
	var anim = AnimationPlayer.new()
	anim.name = "AnimationPlayer"
	model.add_child(anim)
	anim.root_node = NodePath("..")
	anim.add_animation_library("", _lib)
	return model


func play(clip: String) -> void:
	if _anim.has_animation(clip): _anim.play(clip, 0.25)


func play_idle() -> void:
	play(_idle)


## Villagers walk; the name matches Unit's so the map's walkers drive both.
func play_run() -> void:
	play("Walk")


func face(target: Vector3) -> void:
	var d = target - global_position
	d.y = 0
	if d.length() > 0.001: rotation.y = atan2(d.x, d.z)


func set_bar_visible(_on: bool) -> void:
	pass
