# 💞 陪伴核心系统（Companion Core）

基于 PawApp 框架（QwenPaw 2.x）开发的一体化陪伴系统，为 QwenPaw Agent 提供状态管理、梦境记录、日程安排、便签提醒、关系记录和重要日期管理，并附带可视化仪表盘。

## 🙏 致谢

本项目灵感与功能设计来源于 [astrbot_plugin_private_companion](https://github.com/menglimi/astrbot_plugin_private_companion)，针对 QwenPaw 平台进行了适配与重构。感谢原作者的贡献。

## ✨ 特性

- 🌤 **状态管理** - 心情、精力、睡眠、健康等状态追踪，仪表盘可直接编辑
- 📅 **日程安排** - 每日计划时间线展示
- 💭 **梦境记录** - 按日期存储的梦境碎片，支持全文查看
- 📝 **便签系统** - 可设置过期时间的便签，支持提醒标记与过期清理
- 💕 **关系记录** - 亲密度、里程碑、互动记录
- 🎂 **重要日期** - 生日、纪念日管理
- 🔌 **REST API** - 全部数据可通过 API 编程访问，搭配 companion_core 技能供 Agent 使用
- 🌐 **中英双语** - 自动跟随 QwenPaw 的语言设置

## 📦 版本要求

- QwenPaw ≥ 2.0.1（PawApp 框架）
- 从 1.x 升级：本版本由旧版 `general` 插件迁移为 `app` 类型 PawApp，API 前缀由 `/api/companion` 变更为 `/api/companion-core`，数据目录变更为应用安装目录下的 `data/`。如需保留旧数据，将原工作区 `companion_data/` 中的文件复制到应用的 `data/` 目录即可。

## 🚀 安装

### 应用中心安装

1. 打开 QwenPaw 应用中心
2. 搜索 "Companion Core"
3. 点击安装

### 本地安装

```bash
qwenpaw plugin install /path/to/companion-core
qwenpaw app
```

### 技能安装

将 `SKILL.md` 注册为 Agent 的技能：
1. 将 `SKILL.md` 放到 Agent 工作区的 `skills/companion_core/` 目录
2. 在 `skill.json` 中启用该技能
3. 按需配置 `jobs.json` 中的定时关怀任务

## 📖 REST API

安装后通过 HTTP API 管理所有陪伴数据（前缀 `/api/companion-core`）：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/companion-core/state` | GET/PUT | 状态读写（PUT 为增量合并） |
| `/api/companion-core/schedule` | GET/PUT | 日程读写 |
| `/api/companion-core/dreams` | GET/POST | 梦境列表/创建 |
| `/api/companion-core/dreams/{date}` | GET | 指定日期梦境 |
| `/api/companion-core/notes` | GET/POST | 便签列表（`?expired=true` 含过期）/创建 |
| `/api/companion-core/notes/{id}` | PUT/DELETE | 更新/删除便签 |
| `/api/companion-core/notes/expired` | DELETE | 清理过期便签 |
| `/api/companion-core/relationship` | GET/PUT | 关系读写 |
| `/api/companion-core/relationship/decay` | POST | 应用关系衰减 |
| `/api/companion-core/dates` | GET/POST | 重要日期列表/添加 |
| `/api/companion-core/dates/{name}` | DELETE | 删除重要日期 |
| `/api/companion-core/export` | GET | 导出所有数据（备份） |
| `/api/companion-core/import` | POST | 导入数据（恢复） |
| `/api/companion-core/health` | GET | 健康检查 |

## 🗂 数据存储

数据存储在用户数据目录（跨平台，插件更新不会丢失数据）：

- **Windows**: `%APPDATA%/qwenpaw/companion-core/`
- **Linux/Mac**: `~/.local/share/qwenpaw/companion-core/`
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

首次启动会自动补全缺失的种子文件。可通过 `/api/companion-core/export` 导出备份，`/api/companion-core/import` 恢复。

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
├── requirements.txt     # Python 依赖
├── backend/
│   └── main.py          # FastAPI + PawApp 后端
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
- **后端**: FastAPI + PawApp SDK
- **依赖**: PyYAML（通常已随 QwenPaw 安装）

## 📄 许可证

MIT
