@tool
extends Control

var ws_status: Label
var tcp_status: Label

func _ready():
	ws_status = $VBoxContainer/WebSocketStatus
	tcp_status = $VBoxContainer/TCPStatus

func update_status(text: String, color: Color = Color.WHITE):
	if text.begins_with("WebSocket"):
		if ws_status:
			ws_status.text = text
			ws_status.modulate = color
	elif text.begins_with("TCP"):
		if tcp_status:
			tcp_status.text = text
			tcp_status.modulate = color
