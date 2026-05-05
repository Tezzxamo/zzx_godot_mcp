# zzx-godot-mcp

面向 Godot 4.6.x 的全功能 MCP 服务器，支持 2D、HD-2D、3D 游戏开发。

**167 个工具**，覆盖 17 个类别，通过 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 驱动 AI 游戏开发。

## 特性

- **2D / HD-2D / 3D 全覆盖** — 每种游戏类型都有独立工具集
- **双模式架构** — 编辑器实时操控 + Headless 文件操作
- **运行时游戏控制** — 通过 TCP 调试、检查、操控运行中的游戏
- **自动重连** — WebSocket 每 5 秒自动重试；TCP 在 `runtime_play` 后自动连接
- **Kimi Code CLI 优化** — 一键配置，中文友好的工具描述
- **167 个 MCP 工具** — 场景、节点、脚本、项目、渲染、物理、音频、UI、网络、文档等

## 架构

```
Kimi Code CLI (MCP 客户端)
    |
    | stdio
    v
zzx-godot-mcp 服务器 (TypeScript/Node.js)
    |-----------|----------------
    |           |                |
    | WebSocket | Headless CLI   | TCP Socket
    | (:9678)   | (godot --headless) | (:9679)
    |           |                |
    v           v                v
Godot 编辑器  Godot Headless   运行中的游戏
插件         (文件操作)        (运行时调试)
```

## 安装

```bash
# 克隆并构建
git clone https://github.com/zzx/zzx-godot-mcp.git
cd zzx-godot-mcp
npm install
npm run build

# 添加到 Kimi CLI
kimi mcp add zzx-godot-mcp \
  --command "node" \
  --args "/absolute/path/to/zzx-godot-mcp/dist/index.js" \
  --env GODOT_EXECUTABLE="/path/to/godot"

# 测试连接
kimi mcp test zzx-godot-mcp
```

## Godot 编辑器插件设置（编辑器/运行时工具必需）

1. 将 `addons/zzx_godot_mcp/` 复制到你的 Godot 项目的 `addons/` 文件夹
2. 在 项目设置 → 插件 中启用 **ZZX Godot MCP**
3. WebSocket 服务器自动在 9678 端口启动；TCP 服务器自动在 9679 端口启动

## 配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `GODOT_EXECUTABLE` | 自动检测 | Godot 可执行文件路径（优先） |
| `GODOT_PATH` | 自动检测 | `GODOT_EXECUTABLE` 的兼容别名 |
| `ZZX_WEBSOCKET_PORT` | 9678 | WebSocket 端口（编辑器） |
| `ZZX_TCP_PORT` | 9679 | TCP 端口（运行时） |
| `ZZX_LOG_LEVEL` | info | 日志级别 |
| `ZZX_PROJECT_PATH` | 当前目录 | Godot 项目根路径 |

## 工具分类

| 类别 | 工具数 | 说明 |
|------|--------|------|
| 场景 | 13 | 创建、打开、保存、分析场景、编辑器截图 |
| 节点 | 15 | 添加、删除、重命名、批量更新 |
| 脚本 | 10 | 创建、编辑、附加、验证、模板 |
| 项目 | 8 | 创建项目、自动加载、输入映射 |
| 运行时 | 20 | 播放、暂停、执行代码、截图 |
| 2D 渲染 | 12 | 精灵、瓦片地图、粒子、灯光 |
| 3D 渲染 | 15 | 网格、相机、灯光、环境、雾 |
| HD-2D | 8 | 像素完美、图集、光照、调色板 |
| 动画 | 8 | 播放器、轨道、补间、混合空间 |
| 物理 | 8 | 刚体、碰撞、材质、射线检测 |
| 音频 | 6 | 播放器、总线、效果器、空间音频 |
| 输入 | 6 | 键盘、鼠标、手柄、触摸模拟 |
| UI | 8 | 控件、按钮、主题、容器 |
| 网络 | 6 | HTTP、WebSocket、多人游戏、RPC |
| 资源 | 10 | 材质、着色器、纹理、渐变 |
| 文件 | 5 | 读取、写入、删除、搜索 |

## 示例指令

```
"创建一个名为 MyGame 的 2D 平台跳跃项目"
"添加一个带移动脚本的 CharacterBody2D 玩家"
"创建一个带 Ground 层的 TileMap"
"设置像素完美渲染实现 HD-2D 效果"
"启动 Godot 编辑器并启用 MCP 插件"
"运行主场景并截图"
"获取运行中游戏的玩家位置"
"截取 Godot 编辑器视口的截图"
"添加 PointLight2D 实现 HD-2D 光照"
"创建包含 MeshInstance3D 和 Camera3D 的 3D 场景"
"连接玩家的死亡信号到游戏管理器"
"列出项目中所有 .gd 脚本"
```

## 许可证

MIT
