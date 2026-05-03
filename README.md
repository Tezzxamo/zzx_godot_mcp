# zzx-godot-mcp

Full-featured MCP server for Godot 4.6.x game development. Supports 2D, HD-2D, and 3D games.

**157 tools** across 15 categories for AI-driven game development via [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

## Features

- **2D / HD-2D / 3D Full Coverage** — Dedicated toolsets for each game type
- **Dual-Mode Architecture** — Editor real-time control + Headless file operations
- **Runtime Game Control** — Debug, inspect, and manipulate running games via TCP
- **Kimi Code CLI Optimized** — One-command setup, Chinese-friendly descriptions
- **157 MCP Tools** — Scene, node, script, project, rendering, physics, audio, UI, networking, and more

## Architecture

```
Kimi Code CLI (MCP Client)
    |
    | stdio
    v
zzx-godot-mcp Server (TypeScript/Node.js)
    |-----------|----------------
    |           |                |
    | WebSocket | Headless CLI   | TCP Socket
    | (:9678)   | (godot --headless) | (:9679)
    |           |                |
    v           v                v
Godot Editor  Godot Headless   Running Game
Plugin        (file ops)       (runtime debug)
```

## Installation

```bash
# Clone and build
git clone https://github.com/zzx/zzx-godot-mcp.git
cd zzx-godot-mcp
npm install
npm run build

# Add to Kimi CLI
kimi mcp add zzx-godot-mcp \
  --command "node" \
  --args "/absolute/path/to/zzx-godot-mcp/dist/index.js" \
  --env GODOT_PATH="/path/to/godot"

# Test connection
kimi mcp test zzx-godot-mcp
```

## Godot Editor Plugin Setup (Optional, for real-time control)

1. Copy `addons/zzx_godot_mcp/` to your Godot project's `addons/` folder
2. Enable **ZZX Godot MCP** in Project Settings → Plugins
3. The WebSocket server auto-starts on port 9678

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `GODOT_PATH` | auto-detect | Path to Godot executable |
| `ZZX_WEBSOCKET_PORT` | 9678 | WebSocket port (Editor) |
| `ZZX_TCP_PORT` | 9679 | TCP port (Runtime) |
| `ZZX_LOG_LEVEL` | info | Log level: silent/error/warn/info/debug |
| `ZZX_PROJECT_PATH` | cwd | Godot project root path |

## Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| Scene | 12 | Create, open, save, analyze scenes |
| Node | 15 | Add, delete, rename, reparent, batch update |
| Script | 10 | Create, edit, attach, validate, templates |
| Project | 8 | Create project, autoloads, input map, layers |
| Runtime | 20 | Play, pause, eval, screenshot, performance |
| 2D Rendering | 12 | Sprite, TileMap, particles, lights, camera |
| 3D Rendering | 15 | Mesh, camera, lights, environment, fog |
| HD-2D | 8 | Pixel-perfect, atlas, lighting, palette |
| Animation | 8 | Player, tracks, tween, blend space, IK |
| Physics | 8 | Bodies, shapes, materials, raycast, joints |
| Audio | 6 | Players, play/stop, bus, effects, spatial |
| Input | 6 | Key, mouse, gamepad, touch simulation |
| UI | 8 | Control, button, label, theme, containers |
| Network | 6 | HTTP, WebSocket, multiplayer, RPC |
| Resource | 10 | Materials, shaders, textures, gradients |
| File I/O | 5 | Read, write, delete, rename, search |

## Example Prompts

```
"Create a new 2D platformer project called MyGame"
"Add a CharacterBody2D player with movement script"
"Create a TileMap with a Ground layer"
"Set up pixel-perfect rendering for HD-2D look"
"Play the main scene and take a screenshot"
"Get the player's position in the running game"
"Add a PointLight2D for HD-2D lighting"
"Create a 3D scene with MeshInstance3D and Camera3D"
"Connect the player's death signal to the game manager"
"List all .gd scripts in the project"
```

## License

MIT
