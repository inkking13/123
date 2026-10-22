extends SceneTree
## Compiles every game script; exits non-zero if any fails to load.
func _initialize() -> void:
	var failed = 0
	for d in ["res://scripts/", "res://scripts/core/", "res://scripts/screens/", "res://scripts/ui/"]:
		for f in DirAccess.get_files_at(d):
			if f.ends_with(".gd") and load(d + f) == null:
				print("FAILED ", d + f)
				failed += 1
	print("loaded all scripts, %d failed" % failed)
	quit(1 if failed else 0)
