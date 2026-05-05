extends Node

var server: TCPServer
var clients: Dictionary = {}
var port: int = 9679

func start(p: int = 9679):
	port = p
	server = TCPServer.new()
	var err = server.listen(port, "127.0.0.1")
	if err != OK:
		push_error("ZZX MCP TCP server failed to bind to port ", port)
	else:
		print("ZZX MCP TCP server listening on port ", port)

func stop():
	if server:
		server.stop()
		server = null
	for client in clients.values():
		client.disconnect_from_host()
	clients.clear()

func _process(_delta):
	if not server:
		return
	
	if server.is_connection_available():
		var conn = server.take_connection()
		clients[conn] = conn
		print("ZZX MCP: TCP client connected")
	
	for conn in clients.keys():
		var client = clients[conn]
		if client.get_status() == StreamPeerTCP.STATUS_CONNECTED:
			var available = client.get_available_bytes()
			if available > 0:
				var data = client.get_utf8_string(available)
				_handle_data(client, data)
		elif client.get_status() == StreamPeerTCP.STATUS_NONE or client.get_status() == StreamPeerTCP.STATUS_ERROR:
			client.disconnect_from_host()
			clients.erase(conn)

func _handle_data(client: StreamPeerTCP, data: String):
	var lines = data.split("\n")
	for line in lines:
		line = line.strip_edges()
		if line.is_empty():
			continue
		
		var json = JSON.new()
		var err = json.parse(line)
		if err != OK:
			_send_error(client, "", "Invalid JSON")
			continue
		
		var msg = json.data
		if not msg is Dictionary:
			_send_error(client, "", "Expected JSON object")
			continue
		
		var id = msg.get("id", "")
		var method = msg.get("method", "")
		var params = msg.get("params", {})
		
		var result = _handle_runtime_command(method, params)
		_send_response(client, id, result)

func _handle_runtime_command(method: String, params: Dictionary) -> Variant:
	var tree = get_tree()
	if not tree:
		return { "error": "No scene tree available" }
	
	match method:
		"game.pause":
			tree.paused = params.get("paused", true)
			return { "paused": tree.paused }
		
		"game.eval":
			var code = params.get("code", "")
			
			# Mode A: Expression (simple expressions, no control flow)
			var expr = Expression.new()
			var parse_err = expr.parse(code)
			if parse_err == OK:
				var expr_result = expr.execute([], tree.current_scene)
				if not expr.has_execute_failed():
					return expr_result if expr_result != null else null
			
			# Mode B: Temporary GDScript node (full GDScript support)
			var script = GDScript.new()
			script.source_code = "extends Node\nfunc zzx_mcp_eval(context):\n\t" + code.replace("\n", "\n\t") + "\n"
			var reload_err = script.reload()
			if reload_err != OK:
				return { "error": "Compile error: " + script.get_error_text() }
			
			var temp = Node.new()
			temp.name = "ZZXMCP_Eval_" + str(randi())
			temp.set_script(script)
			tree.current_scene.add_child(temp)
			var eval_result = temp.call("zzx_mcp_eval", tree.current_scene)
			temp.queue_free()
			return eval_result if eval_result != null else null
		
		"game.get_tree":
			return _serialize_node(tree.current_scene)
		
		"game.get_property":
			var node = tree.current_scene.get_node_or_null(params.get("path", ""))
			if not node:
				return { "error": "Node not found" }
			return node.get(params.get("property", ""))
		
		"game.set_property":
			var node = tree.current_scene.get_node_or_null(params.get("path", ""))
			if not node:
				return { "error": "Node not found" }
			node.set(params.get("property", ""), params.get("value"))
			return { "success": true }
		
		"game.call_method":
			var node = tree.current_scene.get_node_or_null(params.get("path", ""))
			if not node:
				return { "error": "Node not found" }
			var args = params.get("args", [])
			return node.callv(params.get("method", ""), args)
		
		"game.screenshot":
			var viewport = tree.root.get_viewport()
			var img = viewport.get_texture().get_image()
			return Marshalls.raw_to_base64(img.save_png_to_buffer())
		
		"game.performance":
			return {
				"fps": Engine.get_frames_per_second(),
				"frame_time": Engine.get_frame_time(),
				"process_time": Engine.get_process_time(),
				"physics_time": Engine.get_physics_time(),
				"memory": OS.get_static_memory_usage(),
				"memory_peak": OS.get_static_memory_peak_usage(),
				"draw_calls": RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME),
			}
		
		"game.instantiate":
			var scene_path = params.get("scene", "")
			var packed = load(scene_path)
			if not packed is PackedScene:
				return { "error": "Invalid scene path" }
			var instance = packed.instantiate()
			instance.name = params.get("name", instance.name)
			var parent = tree.current_scene.get_node_or_null(params.get("parent", "/root"))
			if parent:
				parent.add_child(instance)
			return { "success": true, "name": instance.name }
		
		"game.remove_node":
			var node = tree.current_scene.get_node_or_null(params.get("path", ""))
			if node:
				node.queue_free()
			return { "success": node != null }
		
		"game.change_scene":
			tree.change_scene_to_file(params.get("scene", ""))
			return { "success": true }
		
		"game.connect_signal":
			var emitter = tree.current_scene.get_node_or_null(params.get("emitter", ""))
			var receiver = tree.current_scene.get_node_or_null(params.get("receiver", ""))
			if emitter and receiver:
				emitter.connect(params.get("signal", ""), Callable(receiver, params.get("method", "")))
			return { "success": emitter != null and receiver != null }
		
		"game.emit_signal":
			var node = tree.current_scene.get_node_or_null(params.get("path", ""))
			var sig_name = params.get("signal", "")
			var sig_args = params.get("args", [])
			if not node:
				return { "success": false }
			var all_args = [sig_name]
			all_args.append_array(sig_args)
			node.callv("emit_signal", all_args)
			return { "success": true }
		
		"game.get_camera":
			var cam = tree.root.get_camera_3d() if tree.root.get_camera_3d() else tree.root.get_camera_2d()
			if cam:
				return { "position": cam.position, "rotation": cam.rotation, "zoom": cam.zoom if cam is Camera2D else null }
			return { "error": "No active camera" }
		
		"game.set_camera":
			var cam = tree.root.get_camera_3d() if tree.root.get_camera_3d() else tree.root.get_camera_2d()
			if cam:
				if params.has("position"):
					cam.position = _dict_to_vector(params["position"])
				if params.has("rotation"):
					cam.rotation = _dict_to_vector(params["rotation"])
				if params.has("zoom") and cam is Camera2D:
					cam.zoom = Vector2(params["zoom"].get("x", 1), params["zoom"].get("y", 1))
			return { "success": cam != null }
		
		"game.wait":
			var frames = params.get("frames", 1)
			await tree.create_timer(frames / Engine.get_frames_per_second()).timeout
			return { "waited": frames }
		
		"game.get_errors":
			var log_path = OS.get_user_data_dir() + "/logs/godot.log"
			var lines = _read_log_file(log_path)
			var errors = lines.filter(func(l): return l.contains("ERROR") or l.contains("SCRIPT ERROR"))
			return { "errors": errors }
		
		"game.get_logs":
			var log_path = OS.get_user_data_dir() + "/logs/godot.log"
			return { "logs": _read_log_file(log_path) }
		
		_:
			return { "error": "Unknown method: " + method }

func _serialize_node(node: Node) -> Dictionary:
	if not is_instance_valid(node) or node == null:
		return { "name": "<invalid>", "type": "null", "path": "", "children": [] }
	var result = {
		"name": node.name,
		"type": node.get_class(),
		"path": node.get_path(),
		"children": []
	}
	for child in node.get_children():
		if is_instance_valid(child):
			result.children.append(_serialize_node(child))
	return result

func _read_log_file(log_path: String, max_lines: int = 100) -> Array:
	if not FileAccess.file_exists(log_path):
		return []
	var file = FileAccess.open(log_path, FileAccess.READ)
	var lines = []
	while not file.eof_reached():
		lines.append(file.get_line())
	file.close()
	if lines.size() > max_lines:
		lines = lines.slice(lines.size() - max_lines, lines.size())
	return lines

func _dict_to_vector(d: Dictionary) -> Variant:
	if d.has("z"):
		return Vector3(d.get("x", 0), d.get("y", 0), d.get("z", 0))
	return Vector2(d.get("x", 0), d.get("y", 0))

func _send_response(client: StreamPeerTCP, id: String, result: Variant):
	var msg = JSON.stringify({ "id": id, "result": result }) + "\n"
	client.put_data(msg.to_utf8_buffer())

func _send_error(client: StreamPeerTCP, id: String, error_msg: String):
	var msg = JSON.stringify({ "id": id, "error": { "code": 1, "message": error_msg } }) + "\n"
	client.put_data(msg.to_utf8_buffer())
