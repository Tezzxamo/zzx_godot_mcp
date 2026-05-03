@tool
extends SceneTree

func _initialize():
	var args = OS.get_cmdline_user_args()
	if args.size() < 1:
		push_error("No operation arguments provided")
		quit(1)
		return
	
	var params_json = args[0]
	var json = JSON.new()
	var err = json.parse(params_json)
	if err != OK:
		push_error("Invalid JSON params: " + json.get_error_message())
		quit(1)
		return
	
	var params = json.data
	var method = params.get("method", "")
	var method_params = params.get("params", {})
	
	var result = _handle_operation(method, method_params)
	print(JSON.stringify(result))
	quit(0)

func _handle_operation(method: String, params: Dictionary) -> Dictionary:
	match method:
		"validate_script":
			var path = params.get("path", "")
			var script = load(path)
			if not script is GDScript:
				return { "error": "Not a GDScript" }
			var err = script.reload()
			if err != OK:
				return { "error": "Script has errors" }
			return { "valid": true }
		
		"get_project_info":
			var project = ProjectSettings
			return {
				"name": project.get_setting("application/config/name"),
				"main_scene": project.get_setting("application/run/main_scene"),
				"features": project.get_setting("application/config/features"),
			}
		
		"export_mesh_library":
			return _export_mesh_library(params)
		
		"get_uid":
			return _get_uid(params)
		
		"update_project_uids":
			return _update_project_uids(params)
		
		_:
			return { "error": "Unknown headless operation: " + method }

func _export_mesh_library(params: Dictionary) -> Dictionary:
	var scene_path = params.get("scene_path", "")
	var output_path = params.get("output_path", "")
	var mesh_item_names = params.get("mesh_item_names", [])
	
	if not scene_path.begins_with("res://"):
		scene_path = "res://" + scene_path
	if not output_path.begins_with("res://"):
		output_path = "res://" + output_path
	
	var scene = load(scene_path)
	if not scene:
		return { "error": "Failed to load scene: " + scene_path }
	
	var scene_root = scene.instantiate()
	var mesh_library = MeshLibrary.new()
	var item_id = 0
	var use_specific = mesh_item_names.size() > 0
	
	for child in scene_root.get_children():
		if use_specific and not (child.name in mesh_item_names):
			continue
		var mesh_instance = null
		if child is MeshInstance3D:
			mesh_instance = child
		else:
			for descendant in child.get_children():
				if descendant is MeshInstance3D:
					mesh_instance = descendant
					break
		if mesh_instance and mesh_instance.mesh:
			mesh_library.create_item(item_id)
			mesh_library.set_item_name(item_id, child.name)
			mesh_library.set_item_mesh(item_id, mesh_instance.mesh)
			for collision_child in child.get_children():
				if collision_child is CollisionShape3D and collision_child.shape:
					mesh_library.set_item_shapes(item_id, [collision_child.shape])
					break
			item_id += 1
	
	if item_id == 0:
		return { "error": "No valid meshes found in scene" }
	
	var error = ResourceSaver.save(mesh_library, output_path)
	if error != OK:
		return { "error": "Failed to save MeshLibrary: " + str(error) }
	
	return { "success": true, "items": item_id, "output_path": output_path }

func _get_uid(params: Dictionary) -> Dictionary:
	var file_path = params.get("file_path", "")
	if not file_path.begins_with("res://"):
		file_path = "res://" + file_path
	
	if not FileAccess.file_exists(file_path):
		return { "error": "File does not exist: " + file_path }
	
	var uid_path = file_path + ".uid"
	if FileAccess.file_exists(uid_path):
		var f = FileAccess.open(uid_path, FileAccess.READ)
		var uid = f.get_as_text().strip_edges()
		f.close()
		return { "file": file_path, "uid": uid, "exists": true }
	else:
		return { "file": file_path, "exists": false, "message": "UID file does not exist. Use update_project_uids to generate." }

func _update_project_uids(params: Dictionary) -> Dictionary:
	var project_path = params.get("project_path", "res://")
	if not project_path.begins_with("res://"):
		project_path = "res://" + project_path
	if not project_path.ends_with("/"):
		project_path += "/"
	
	var success_count = 0
	var error_count = 0
	var generated_uids = 0
	
	# Resave scenes
	var scenes = _find_files(project_path, ".tscn")
	for scene_path in scenes:
		var s = load(scene_path)
		if s:
			var err = ResourceSaver.save(s, scene_path)
			if err == OK:
				success_count += 1
			else:
				error_count += 1
		else:
			error_count += 1
	
	# Generate missing UIDs for scripts
	var scripts = _find_files(project_path, ".gd")
	scripts.append_array(_find_files(project_path, ".gdshader"))
	for script_path in scripts:
		var uid_path = script_path + ".uid"
		if not FileAccess.file_exists(uid_path):
			var res = load(script_path)
			if res:
				var err = ResourceSaver.save(res, script_path)
				if err == OK:
					generated_uids += 1
	
	return {
		"scenes_processed": scenes.size(),
		"scenes_saved": success_count,
		"errors": error_count,
		"uids_generated": generated_uids,
	}

func _find_files(dir_path: String, extension: String) -> Array:
	var files = []
	var dir = DirAccess.open(dir_path)
	if dir:
		dir.list_dir_begin()
		var file_name = dir.get_next()
		while file_name != "":
			if dir.current_is_dir() and not file_name.begins_with("."):
				files.append_array(_find_files(dir_path + file_name + "/", extension))
			elif file_name.ends_with(extension):
				files.append(dir_path + file_name)
			file_name = dir.get_next()
	return files
