# 💞 陪伴核心系统（Companion Core）

[![自动打包](https://github.com/fanxing724/qwenpaw-companion-core/actions/workflows/release.yml/badge.svg)](https://github.com/fanxing724/qwenpaw-companion-core/actions/workflows/release.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[下载正式安装包](https://github.com/fanxing724/qwenpaw-companion-core/releases/latest) · [发布说明](RELEASE.md) · [开源协议](LICENSE)

基于 QwenPaw 2.x 插件接口开发的一体化陪伴系统，为 QwenPaw Agent 提供状态管理、梦境记录、日程安排、便签提醒、关系记录和重要日期管理，并附带可视化仪表盘。

## 🙏 致谢

本项目灵感与功能设计来源于 [astrbot_plugin_private_companion](https://github.com/menglimi/astrbot_plugin_private_companion)，针对 QwenPaw 平台进行了适配与重构。感谢原作者的贡献。

## ✨ 特性

- 🏠 **今日总览** - 心情、精力、待提醒便签和关系温度卡片，集中查看今天的日程及临近纪念日
- 📱 **响应式界面** - 柔和卡片布局、窄屏换行导航、浅色/深色主题
- 🔎 **搜索与编辑** - 梦境和重要日期搜索，便签搜索及待提醒筛选；直接编辑日程和便签

- 🌤 **状态管理** - 心情、精力、睡眠、健康等状态追踪，仪表盘可直接编辑
- 📅 **日程安排** - 每日计划时间线展示
- 💭 **梦境记录** - 按日期存储的梦境碎片，支持全文查看
- 📝 **便签系统** - 可设置过期时间的便签，支持提醒标记与过期清理
- 💕 **关系记录** - 亲密度、里程碑、互动记录
- 🎂 **重要日期** - 生日、纪念日管理
- 🔌 **REST API** - 全部数据可通过 API 编程访问，搭配 companion_core 技能供 Agent 使用
- 🤖 **Agent 工具** - PawApp SDK 可用时注册 7 个智能体工具（读取状态/日程/便签/关系/日期，更新状态，创建便签），Agent 可直接调用
- 🌙 **暗色模式** - 仪表盘自动跟随 QwenPaw 主题切换明暗模式
- 💾 **数据管理** - 仪表盘内置导出/导入功能，一键备份与恢复
- 🔒 **线程安全** - 所有数据读写加锁，原子写入防止数据损坏
- 🌐 **中英双语** - 自动跟随 QwenPaw 的语言设置

## 📦 版本要求

- QwenPaw ≥ 2.0.1（PawApp 框架）
- v2.4.0：新增今日总览、响应式卡片界面、日程/便签编辑及搜索筛选；加强日期时间校验、导入预校验，避免便签 ID 冲突。保留 2.3.2 的标准插件适配。
- v2.3.0：新增 4 个 Agent 工具（共 7 个）、动态系统提示、暗色模式、数据导出/导入 UI、日程编辑与梦境创建
- v2.2.0：后端入口迁移至 `plugin.py`，数据目录统一为 `~/.qwenpaw/data/companion-core/`，新增 Agent 工具注册与系统提示注入
- 从 1.x 升级：本版本由旧版 `general` 插件迁移为 `app` 类型 PawApp，API 前缀由 `/api/companion` 变更为 `/api/plugins/companion-core`。如需保留旧数据，将原工作区 `companion_data/` 中的文件复制到 `~/.qwenpaw/data/companion-core/` 即可。

## 🚀 安装

### 本地安装

将 `companion-core-2.4.0.zip` 交给 QwenPaw 的插件安装界面，或执行：

```bash
qwenpaw plugin install /path/to/companion-core-2.4.0.zip
# 覆盖安装已有版本
qwenpaw plugin install --force /path/to/companion-core
```

源码打包：`python3 scripts/package.py`，输出到 `dist/`，ZIP 内保留 `companion-core/` 顶层目录。

### 技能安装

将 `SKILL.md` 注册为 Agent 的技能：
1. 将 `SKILL.md` 放到 Agent 工作区的 `skills/companion_core/` 目录
2. 在 `skill.json` 中启用该技能
3. 按需配置 `jobs.json` 中的定时关怀任务

## 📖 REST API

安装后通过 HTTP API 管理所有陪伴数据（前缀 `/api/plugins/companion-core`）：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/plugins/companion-core/state` | GET/PUT | 状态读写（PUT 为增量合并） |
| `/api/plugins/companion-core/schedule` | GET/PUT | 日程读写 |
| `/api/plugins/companion-core/dreams` | GET/POST | 梦境列表/创建 |
| `/api/plugins/companion-core/dreams/{date}` | GET | 指定日期梦境 |
| `/api/plugins/companion-core/notes` | GET/POST | 便签列表（`?expired=true` 含过期）/创建 |
| `/api/plugins/companion-core/notes/{id}` | PUT/DELETE | 更新/删除便签 |
| `/api/plugins/companion-core/notes/expired` | DELETE | 清理过期便签 |
| `/api/plugins/companion-core/relationship` | GET/PUT | 关系读写 |
| `/api/plugins/companion-core/relationship/decay` | POST | 应用关系衰减 |
| `/api/plugins/companion-core/dates` | GET/POST | 重要日期列表/添加 |
| `/api/plugins/companion-core/dates/{name}` | DELETE | 删除重要日期 |
| `/api/plugins/companion-core/export` | GET | 导出所有数据（备份） |
| `/api/plugins/companion-core/import` | POST | 导入数据（恢复） |
| `/api/plugins/companion-core/health` | GET | 健康检查 |

旧版 `/api/companion-core/*` 地址不再用于标准插件模式，已有外部脚本和 Agent 技能请同步改为 `/api/plugins/companion-core/*`。原用户数据目录不变。

## 🤖 Agent 工具

宿主提供 `qwenpaw.pawapp.PawApp` SDK 时，插件注册以下智能体工具：

| 工具名 | 说明 |
|--------|------|
| `companion_get_state` | 读取当前状态（心情、精力、睡眠等） |
| `companion_get_schedule` | 读取今日日程 |
| `companion_get_notes` | 读取便签列表 |
| `companion_get_relationship` | 读取关系记录（亲密度、里程碑） |
| `companion_get_important_dates` | 读取重要日期（生日、纪念日） |
| `companion_update_state` | 更新状态字段（心情、精力等） |
| `companion_create_note` | 创建便签 |

SDK 模式同时通过 `app.prompt_section` 注入系统提示。标准 `router` 模式提供全部仪表盘和 REST API，但不注册这些工具或注入提示；Agent 可使用下方 SKILL.md 模板通过 REST API 访问。`/health` 返回 `agent_tools` 字段标识当前模式。

## 🗂 数据存储

数据存储在 `~/.qwenpaw/data/companion-core/`（插件目录之外，覆盖安装不丢数据）：

- **默认路径**: `~/.qwenpaw/data/companion-core/`
- **自定义**: 设置环境变量 `QWENPAW_COMPANION_DATA=/path/to/data`

```
companion-core/
├── state.yaml           # 当前状态
├── schedule.yaml        # 今日日程
├── dreams/              # 梦境碎片（YYYY-MM-DD.md）
├── notes.json           # 便签
├── relationship.yaml    # 关系记录
└── important_dates.yaml # 重要日期
```

首次加载会自动补全缺失的种子文件，不覆盖已有文件。可通过 `/api/plugins/companion-core/export` 导出备份，`/api/plugins/companion-core/import` 恢复。

## 🎨 自定义指南

### 1. 替换占位符

在 `SKILL.md` 中搜索以下占位符并替换：

| 占位符 | 说明 | 示例 |
|--------|------|------|
| `{{AGENT_NAME}}` | Agent 名称 | 小爱、月欣羽 |
| `{{USER_NAME}}` | 用户名称 | 小明 |
| `{{USER_NICKNAME}}` | 用户昵称 | 宝宝、宝贝 |

### 2. 修改数据模板

`data/` 目录下的种子文件可直接修改：
- `state.yaml` — 设置初始状态值
- `schedule.yaml` — 设置默认日程
- `relationship.yaml` — 设置初始关系
- `important_dates.yaml` — 添加重要日期
- `notes.json` — 预置便签

### 3. 配置定时任务

在 Agent 的 `jobs.json` 中添加陪伴定时任务，参考模板：

```json
{
  "id": "morning_greeting",
  "name": "早安问候",
  "enabled": true,
  "schedule": {
    "type": "cron",
    "cron": "15 8 * * 1-5",
    "timezone": "Asia/Shanghai"
  },
  "task_type": "agent",
  "request": {
    "input": [{
      "role": "user",
      "type": "message",
      "content": [{"type": "text", "text": "现在是早安时间，看看今天的日程和状态，给用户发一句早安问候。"}]
    }]
  }
}
```

### 4. 调整人设

`SKILL.md` 中的语气示例仅供参考，请根据 Agent 的实际人设风格调整。

## 📁 文件结构

```
companion-core/
├── plugin.json          # 插件清单（PawApp app 类型）
├── plugin.py            # FastAPI + PawApp 后端
├── requirements.txt     # Python 依赖
├── ui/
│   └── index.js         # 仪表盘前端（React + antd，宿主运行时加载）
├── SKILL.md             # 陪伴技能模板（需自定义）
├── README.md            # 本文件
└── data/                # 种子数据模板（首次启动时复制到用户数据目录）
    ├── state.yaml
    ├── schedule.yaml
    ├── relationship.yaml
    ├── important_dates.yaml
    ├── notes.json
    └── dreams/
```

## 🔧 技术栈

- **前端**: React + Ant Design（由 QwenPaw 宿主提供，无打包器）
- **后端**: FastAPI APIRouter；可选 PawApp SDK 增强 Agent 集成
- **依赖**: PyYAML（通常已随 QwenPaw 安装）

## 📄 许可证

本项目采用 [MIT License](LICENSE)，完整协议保存在仓库根目录，并随每个插件安装包分发。

## 开发验证

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt fastapi httpx pytest
.venv/bin/python -m pytest -q tests
node tests/frontend.cjs
python3 scripts/package.py
```

浏览器交互测试位于 `tests/browser.cjs`，需要测试环境提供 Playwright、React 18、React DOM 18、Ant Design 5 和 Day.js。使用模拟宿主及内存 API，不写入真实陪伴数据；测试结束后会关闭浏览器和本地预览服务。可通过 `COMPANION_PREVIEW_DIR` 指定截图输出目录，`PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定已有 Chromium。

自动测试使用临时数据目录验证 FastAPI 接口、保存和备份恢复，并模拟前端宿主检查 API 地址与菜单注册。SDK 注册检查使用测试替身，不代表已在真实 QwenPaw 验证。发布前仍需在目标宿主检查安装、页面加载及 Agent 工具可用性。

恢复备份时先校验所有已知数据段，格式有误时拒绝写入；备份中提供的数据段覆盖对应记录，梦境按日期合并，不删除备份外的梦境。磁盘故障时仍不保证跨文件事务。2 月 29 日纪念日倒计时按下一次有效闰日计算。

## 自动打包与发布

- 推送 `main` 或手动运行 **Package and Release**：验证后生成 ZIP，可在对应 Actions 运行的 Artifacts 中下载。
- 推送 `v<版本号>` 标签：核对标签与 `plugin.json` 版本，验证并打包，自动发布 GitHub Release。
- Release 页面展示 `RELEASE.md`，附件仅提供插件 ZIP；README 和 LICENSE 保留在仓库及 ZIP 内。
- 安装 ZIP 顶层为 `companion-core/`，其中包含描述清单、README、发布说明、更新日志和 MIT 协议；缺少必要文件会直接阻止打包。
