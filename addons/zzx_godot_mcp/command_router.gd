@tool
extends RefCounted

var editor_plugin: EditorPlugin

func handle_command(method: String, params: Dictionary) -> Variant:
	var editor = EditorInterface if editor_plugin else null
	
	match method:
		"editor.open_scene":
			var path = params.get("path", "")
			if editor:
				editor.open_scene_from_path(path)
			return { "opened": path }
		
		"editor.save_scene":
			if editor:
				editor.save_scene()
			return { "saved": true }
		
		"editor.get_open_script":
			if editor:
				var script_editor = editor.get_script_editor()
				var current = script_editor.get_current_script()
				return { "script": current.resource_path if current else null }
			return { "script": null }
		
		"editor.take_screenshot":
			if editor:
				var viewport = editor.get_editor_viewport_3d() if editor.get_editor_viewport_3d() else editor.get_editor_viewport_2d()
				var img = viewport.get_texture().get_image()
				var output_path = params.get("output_path", "")
				var err = img.save_png(output_path)
				if err == OK:
					return { "saved": output_path }
				else:
					return { "error": "Failed to save screenshot: " + str(err) }
			return { "error": "No editor" }
		
		"runtime.play":
			if editor:
				if params.has("scene"):
					editor.play_custom_scene(params.get("scene", ""))
				else:
					editor.play_current_scene()
				return { "playing": true }
			return { "error": "No editor" }
		
		"runtime.stop":
			if editor:
				editor.stop_playing_scene()
				return { "stopped": true }
			return { "error": "No editor" }
		
		"node.get_info":
			var scene = editor.get_edited_scene_root() if editor else null
			if not scene:
				return { "error": "No scene open" }
			var node = scene.get_node_or_null(params.get("path", ""))
			if not node:
				return { "error": "Node not found" }
			return {
				"name": node.name,
				"type": node.get_class(),
				"path": node.get_path(),
				"properties": _get_properties(node),
				"signals": _get_signals(node),
				"methods": _get_methods(node),
			}
		
		_:
			return { "error": "Unknown editor command: " + method }

func _get_properties(node: Node) -> Dictionary:
	var result = {}
	for prop in node.get_property_list():
		if prop["usage"] & PROPERTY_USAGE_EDITOR:
			result[prop["name"]] = node.get(prop["name"])
	return result

func _get_signals(node: Node) -> Array:
	var result = []
	for sig in node.get_signal_list():
		var connections = node.get_signal_connection_list(sig["name"])
		result.append({
			"name": sig["name"],
			"connections": connections.map(func(c): return { "target": c["callable"].get_object().get_path(), "method": c["callable"].get_method() })
		})
	return result

func _get_methods(node: Node) -> Array:
	return node.get_method_list().map(func(m): return m["name"])
