@tool
extends EditorPlugin

const WebSocketServer = preload("websocket_server.gd")
const TcpServer = preload("tcp_server.gd")

var ws_server: WebSocketServer
var tcp_server: TcpServer
var panel: Control

func _enter_tree():
	ws_server = WebSocketServer.new()
	ws_server.editor_plugin = self
	add_child(ws_server)
	ws_server.start(9678)
	
	# TCP server for runtime game (started when game runs)
	tcp_server = TcpServer.new()
	add_child(tcp_server)
	
	# Add dock panel
	panel = preload("ui/mcp_panel.tscn").instantiate() if ResourceLoader.exists("res://addons/zzx_godot_mcp/ui/mcp_panel.tscn") else null
	if panel:
		add_control_to_dock(DOCK_SLOT_RIGHT_BL, panel)
		panel.update_status("WebSocket: 9678", Color.GREEN)

func _exit_tree():
	if ws_server:
		ws_server.stop()
		ws_server.queue_free()
	if tcp_server:
		tcp_server.stop()
		tcp_server.queue_free()
	if panel:
		remove_control_from_docks(panel)
		panel.queue_free()
