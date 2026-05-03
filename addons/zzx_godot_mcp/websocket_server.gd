@tool
extends Node

var server: TCPServer
var peers: Dictionary = {}
var editor_plugin: EditorPlugin
var command_router: CommandRouter

func _ready():
	command_router = preload("command_router.gd").new()
	command_router.editor_plugin = editor_plugin

func start(port: int = 9678):
	server = TCPServer.new()
	var err = server.listen(port, "127.0.0.1")
	if err != OK:
		push_error("ZZX MCP WebSocket failed to bind to port ", port)
	else:
		print("ZZX MCP WebSocket server listening on port ", port)

func stop():
	if server:
		server.stop()
		server = null
	for peer in peers.values():
		peer.close()
	peers.clear()

func _process(_delta):
	if not server:
		return
	
	# Accept new connections
	if server.is_connection_available():
		var conn = server.take_connection()
		var peer = WebSocketPeer.new()
		peer.accept_stream(conn)
		peers[conn] = peer
		print("ZZX MCP: WebSocket client connected")
	
	# Process peers
	for conn in peers.keys():
		var peer = peers[conn]
		peer.poll()
		var state = peer.get_ready_state()
		
		if state == WebSocketPeer.STATE_CLOSED:
			peer.close()
			peers.erase(conn)
			print("ZZX MCP: WebSocket client disconnected")
			continue
		
		if state == WebSocketPeer.STATE_OPEN:
			while peer.get_available_packet_count() > 0:
				var packet = peer.get_packet().get_string_from_utf8()
				_handle_message(peer, packet)

func _handle_message(peer: WebSocketPeer, data: String):
	var json = JSON.new()
	var err = json.parse(data)
	if err != OK:
		_send_error(peer, "", "Invalid JSON: " + json.get_error_message())
		return
	
	var msg = json.data
	if not msg is Dictionary:
		_send_error(peer, "", "Expected JSON object")
		return
	
	var id = msg.get("id", "")
	var method = msg.get("method", "")
	var params = msg.get("params", {})
	
	if method == "":
		_send_error(peer, id, "Missing method")
		return
	
	var result = command_router.handle_command(method, params)
	_send_response(peer, id, result)

func _send_response(peer: WebSocketPeer, id: String, result: Variant):
	var msg = { "id": id, "result": result }
	peer.send_text(JSON.stringify(msg))

func _send_error(peer: WebSocketPeer, id: String, error_msg: String):
	var msg = { "id": id, "error": { "code": 1, "message": error_msg } }
	peer.send_text(JSON.stringify(msg))
