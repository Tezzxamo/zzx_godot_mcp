# zzx-godot-mcp — 智能体参考文档

> 专为 Godot 4.6.x 游戏开发打造的全功能 MCP 服务器。支持 2D、HD-2D 和 3D 游戏。
> 本文档面向 AI 编程智能体。假设读者对该项目一无所知。

## 项目概述

`zzx-godot-mcp` 是一个 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 服务器，横跨 17 个类别暴露了 **167 个工具**，允许 AI 客户端（如 Kimi Code CLI）以编程方式创建、编辑、调试和控制 Godot 4.6.x 游戏项目。

该服务器使用 **TypeScript/Node.js**（ES 模块）编写，通过三种不同的通道与 Godot 通信：

1. **Headless CLI** — 启动 `godot --headless --script` 来执行文件级操作（创建场景、编辑脚本、验证资源），无需打开编辑器。
2. **WebSocket** — 通过端口 **9678** 连接 Godot 编辑器插件，实现实时编辑器控制（打开/保存场景、截取编辑器屏幕截图、检查实时节点）。
3. **TCP Socket** — 通过端口 **9679** 连接正在运行的游戏，进行运行时调试（暂停、执行 GDScript、获取/设置属性、截图、生成实体）。

项目包含一个 Godot 编辑器插件（`addons/zzx_godot_mcp/`）。将其复制到 Godot 项目的 `addons/` 文件夹并启用后，它将在编辑器内部托管 WebSocket 和 TCP 服务器。

## 技术栈

| 层级 | 技术 |
|-------|------------|
| MCP 服务器 | TypeScript 5.8, Node.js ≥ 20, ES 模块 |
| MCP SDK | `@modelcontextprotocol/sdk`（stdio 传输） |
| 网络 | `ws`（WebSocket 客户端）, Node.js `net`（TCP 客户端） |
| Godot 端 | GDScript, Godot 4.6.x |
| 测试 | Vitest 3.x |
| 代码检查/格式化 | ESLint 9.x, Prettier 3.x |
| 开发运行器 | `tsx`（TypeScript 执行） |

## 仓库结构

```
├── src/                          # TypeScript 源代码
│   ├── index.ts                  # 入口点（启动服务器、加载配置、注册工具）
│   ├── server.ts                 # 核心 MCP 服务器类（ZzxGodotServer）
│   ├── config.ts                 # 基于环境变量的配置加载器
│   ├── constants.ts              # 端口、环境变量名、Godot 可执行文件名、超时时间
│   ├── connection/               # 连接抽象层
│   │   ├── base-connection.ts    # 抽象基类
│   │   ├── headless-executor.ts  # 启动 godot --headless --script
│   │   ├── websocket-client.ts   # 连接 Godot 编辑器 WebSocket
│   │   └── tcp-client.ts         # 连接正在运行的游戏 TCP 服务器
│   ├── tools/                    # 15 个工具模块（共 157 个工具）
│   │   ├── registry.ts           # 导入并注册所有工具模块
│   │   ├── file-tools.ts
│   │   ├── scene-tools.ts
│   │   ├── node-tools.ts
│   │   ├── script-tools.ts
│   │   ├── project-tools.ts
│   │   ├── runtime-tools.ts
│   │   ├── resource-tools.ts
│   │   ├── rendering-2d-tools.ts
│   │   ├── rendering-3d-tools.ts
│   │   ├── hd2d-tools.ts
│   │   ├── animation-tools.ts
│   │   ├── physics-tools.ts
│   │   ├── audio-tools.ts
│   │   ├── input-tools.ts
│   │   ├── ui-tools.ts
│   │   └── networking-tools.ts
│   ├── types/                    # TypeScript 类型定义
│   │   ├── index.ts              # 核心类型（ToolDefinition、ToolResponse、ConnectionConfig 等）
│   │   └── godot-types.ts        # Godot ↔ JSON 类型映射（Vector2/3、Color、Rect、Transform 等）
│   └── utils/                    # 工具函数
│       ├── logger.ts             # 分级日志记录器（输出到 stderr）
│       ├── path-utils.ts         # res:// ↔ 绝对路径转换、路径安全、项目根目录检测
│       ├── validators.ts         # 输入验证器（requireString、requireNumber 等）
│       ├── type-converter.ts     # Godot 类型 ↔ JSON 转换器
│       └── godot-detector.ts     # 自动检测 Godot 可执行文件路径
├── addons/zzx_godot_mcp/         # Godot 编辑器插件（GDScript）
│   ├── plugin.cfg                # 插件元数据
│   ├── plugin.gd                 # EditorPlugin 入口 — 启动 WebSocket（9678）和 TCP（9679）服务器
│   ├── websocket_server.gd       # 基于 WebSocketPeer 的编辑器命令服务器
│   ├── tcp_server.gd             # 基于 StreamPeerTCP 的运行时游戏命令服务器
│   ├── command_router.gd         # 路由编辑器命令（open_scene、save_scene、node.get_info 等）
│   └── ui/                       # 编辑器停靠 UI（可选）
├── scripts/
│   └── headless_operations.gd    # 由 HeadlessExecutor 运行的 GDScript，用于 CLI 操作
├── bin/
│   └── zzx-godot-mcp.js          # CLI 二进制入口点
├── tests/                        # Vitest 测试
│   ├── tools.test.ts             # 工具注册冒烟测试
│   └── utils.test.ts             # 转换器、路径工具、验证器的单元测试
├── dist/                         # 编译后的 JavaScript 输出（由 tsc 生成）
├── package.json                  # npm 清单
└── README.md / README_CN.md      # 面向人类的文档（英文和中文）
```

## 构建和测试命令

所有命令都定义在 `package.json` 中：

```bash
# 安装依赖
npm install

# 构建（将 TypeScript 编译到 dist/）
npm run build

# 开发（更改时自动重载）
npm run dev

# 启动编译后的服务器
npm start

# 运行测试一次
npm test

# 在监视模式下运行测试
npm run test:watch

# 代码检查
npm run lint

# 格式化代码
npm run format
```

项目**在仓库根目录没有 `tsconfig.json`** — TypeScript 编译依赖默认值或隐式配置。构建输出到 `dist/`，包含 `.js`、`.d.ts` 和 `.js.map` 文件。

## 运行时架构

```
Kimi Code CLI（MCP 客户端）
    |
    | stdio
    v
zzx-godot-mcp 服务器（TypeScript/Node.js）
    |-----------|----------------
    |           |                |
    | WebSocket | Headless CLI   | TCP Socket
    | (:9678)   | (godot --headless) | (:9679)
    |           |                |
    v           v                v
Godot 编辑器  Godot Headless   正在运行的游戏
插件        （文件操作）      （运行时调试）
```

### 连接模式

| 模式 | 类 | 端口 | 要求 | 使用场景 |
|------|-------|------|----------|----------|
| Headless | `HeadlessExecutor` | N/A | Godot 可执行文件 | 文件/场景编辑、脚本验证、项目信息 |
| WebSocket | `WebSocketClient` | 9678（可配置） | 编辑器插件已启用 | 打开/保存场景、编辑器截图、节点检查 |
| TCP | `TcpClient` | 9679（可配置） | 游戏正在运行且插件已加载 | 暂停、执行脚本、属性获取/设置、实例化、截图 |

如果 WebSocket 在启动时不可用，服务器会记录警告并回退到 headless 模式。TCP 仅在游戏运行时才连接。

## 配置

通过环境变量控制（在 `src/config.ts` 中加载）：

| 变量 | 默认值 | 描述 |
|----------|---------|-------------|
| `GODOT_PATH` | 自动检测 | Godot 可执行文件路径。自动检测先搜索 `PATH`，然后搜索常见的 Windows 安装目录（`C:\Program Files\Godot`、`C:\Godot`、`D:\Godot`、`E:\Godot`）。 |
| `ZZX_WEBSOCKET_PORT` | 9678 | 编辑器插件的 WebSocket 端口 |
| `ZZX_TCP_PORT` | 9679 | 运行时游戏的 TCP 端口 |
| `ZZX_LOG_LEVEL` | info | 级别：`silent`、`error`、`warn`、`info`、`debug` |
| `ZZX_PROJECT_PATH` | 当前工作目录 / 自动检测 | Godot 项目根目录。通过从当前工作目录向上遍历查找 `project.godot` 来自动检测。 |

## 代码组织和模块划分

### 添加新工具

工具按领域分组到 `src/tools/` 下的文件中。每个模块导出一个 `register*Tools(server: ZzxGodotServer)` 函数，由 `src/tools/registry.ts` 调用。

一个工具由以下部分组成：

1. **`definition`** — MCP 工具模式（`name`、`description`、`inputSchema`）
2. **`handler`** — `async (args) => ToolResponse` 函数
3. **`readOnly`** — `boolean` 标志，指示工具是否修改项目状态

来自 `src/tools/scene-tools.ts` 的示例模式：

```typescript
const tools: ToolRegistration[] = [
  {
    definition: {
      name: 'scene_create',
      description: 'Create a new empty scene file (.tscn).',
      inputSchema: { type: 'object', properties: { ... }, required: ['path'] },
    },
    handler: async (args) => {
      const filePath = requireString(args, 'path');
      // ... 实现
      return { content: [{ type: 'text', text: '...' }] };
    },
    readOnly: false,
  },
];
```

### 工具类别

| 类别 | 数量 | 模块 |
|----------|-------|--------|
| 文件 I/O | 5 | `file-tools.ts` |
| 场景 | 12 | `scene-tools.ts` |
| 节点 | 15 | `node-tools.ts` |
| 脚本 | 10 | `script-tools.ts` |
| 项目 | 11 | `project-tools.ts` |
| 运行时 | 20 | `runtime-tools.ts` |
| 2D 渲染 | 12 | `rendering-2d-tools.ts` |
| 3D 渲染 | 15 | `rendering-3d-tools.ts` |
| HD-2D | 8 | `hd2d-tools.ts` |
| 动画 | 8 | `animation-tools.ts` |
| 物理 | 8 | `physics-tools.ts` |
| 音频 | 6 | `audio-tools.ts` |
| 输入 | 6 | `input-tools.ts` |
| UI | 8 | `ui-tools.ts` |
| 网络 | 6 | `networking-tools.ts` |
| 资源 | 11 | `resource-tools.ts` |
| 进程 | 4 | `process-tools.ts` |
| 文档 | 2 | `docs-tools.ts` |

### 场景文件编辑策略

大多数非运行时工具直接以文本形式读写 `.tscn` 文件。它们：

- 解析 `[node name="..." type="..." parent="..."]` 块
- 管理 `[ext_resource ...]` 引用
- 追加或修改属性行（`key = value`）
- 使用基于正则表达式的辅助函数进行节点查找和操作

这允许在 Godot 编辑器未打开的情况下进行操作。

## 代码风格指南

- **语言**：TypeScript 使用 ES 模块（`"type": "module"`）
- **文件头**：每个源文件以 `/** zzx-godot-mcp — <描述> */` 开头
- **导入**：相对导入使用 `.js` 扩展名（Node.js ESM 要求），例如 `import { ... } from '../server.js'`
- **路径处理**：同时支持 `res://` 和绝对路径。相对于 `projectPath` 解析 `res://`。文件操作前始终使用 `isSafePath()` 进行验证。
- **错误处理**：处理程序捕获错误并返回 `{ content: [{ type: 'text', text: message }], isError: true }`。验证器对缺失/无效参数抛出 `ValidationError`。
- **日志记录**：使用 `src/utils/logger.ts`（记录到 **stderr**，以避免破坏 stdio MCP 传输）
- **异步**：所有工具处理程序和连接方法都是 `async`

## 测试说明

测试使用 **Vitest**，直接从 `src/` 导入：

```bash
npm test          # 运行一次
npm run test:watch # 监视模式
```

当前测试覆盖范围（`tests/`）：
- `tools.test.ts` — 验证工具注册的冒烟测试
- `utils.test.ts` — `type-converter`、`path-utils` 和 `validators` 的单元测试

添加新工具函数时，请在 `tests/utils.test.ts` 中添加相应的测试，或创建新的测试文件。

## 安全注意事项

- **路径遍历防护**：所有文件操作都使用 `isSafePath(targetPath, projectPath)`，它会拒绝包含 `..` 的路径，并确保解析后的路径在项目目录内。
- **禁止任意 shell 执行**：`HeadlessExecutor` 仅使用一组固定的参数（`--headless`、`--path`、`--script`、`--`、`<json_params>`）启动 Godot 可执行文件。
- **Headless 脚本网关**：`scripts/headless_operations.gd` 使用 `match` 语句，带有明确的允许操作列表（`validate_script`、`get_project_info`）。未知方法返回错误。
- **网络范围**：WebSocket 和 TCP 服务器仅绑定到 `127.0.0.1`（本地主机），不暴露到网络。

## Godot 插件设置（用于编辑器/运行时功能）

要启用 WebSocket 和 TCP 功能：

1. 将 `addons/zzx_godot_mcp/` 复制到目标 Godot 项目的 `addons/` 文件夹
2. 在 Godot 编辑器中打开项目
3. 转到 **项目 → 项目设置 → 插件**
4. 启用 **ZZX Godot MCP**
5. WebSocket 服务器自动在端口 9678 上启动；TCP 服务器在游戏运行时启动

## 常见任务的关键文件

| 任务 | 文件 |
|------|---------|
| 添加新工具类别 | 创建 `src/tools/<category>-tools.ts`，导出 `register*Tools`，在 `src/tools/registry.ts` 中导入 |
| 添加新 headless 操作 | 向 `scripts/headless_operations.gd` 添加方法，通过 `server.getHeadless().send(...)` 调用 |
| 添加新编辑器命令 | 向 `addons/zzx_godot_mcp/command_router.gd` 添加 case，通过 WebSocket 调用 |
| 添加新运行时命令 | 向 `addons/zzx_godot_mcp/tcp_server.gd` 添加 case，通过 TCP 调用 |
| 更改默认端口 | 编辑 `src/constants.ts` |
| 更改日志行为 | 编辑 `src/utils/logger.ts` |
| 添加新的 Godot 类型映射 | 编辑 `src/types/godot-types.ts` 和 `src/utils/type-converter.ts` |

## 智能体注意事项

- 项目目标为 **Godot 4.6.x**。场景文件格式为 Godot 4 的 `format=3`。
- `.tscn` 编辑通过文本操作完成，而不是通过 Godot 的 XML API。使用基于正则表达式的替换时要小心。
- 当工具需要 WebSocket/TCP 但连接不可用时，处理程序会返回一个友好的错误消息，告诉用户手动执行操作。
- `readOnly: true` 工具不应修改文件或游戏状态。这是 MCP 客户端的元数据。
- 中文 README（`README_CN.md`）与英文版本一起维护。如果更新文档，请保持两者同步。
