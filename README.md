# 💞 陪伴核心系统（Companion Core）

[![自动打包](https://github.com/fanxing724/qwenpaw-companion-core/actions/workflows/release.yml/badge.svg)](https://github.com/fanxing724/qwenpaw-companion-core/actions/workflows/release.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[下载正式安装包](https://github.com/fanxing724/qwenpaw-companion-core/releases/latest) · [发布说明](RELEASE.md) · [开源协议](LICENSE)

这是基于 QwenPaw 2.x 的 **AI 陪伴工作台**：积累 AI 自身的状态、作息、记忆与陪伴经历，供 AI 读取并延续拟人表现。用户通过面板观察、配置与校正 AI 档案。便签是 AI 记住的事项，关系记录 AI 与用户的互动。

源码设计入口：[产品定位与数据闭环](DESIGN.md) · [逐文件检查与已知问题](FILE_REVIEW.md) · [后续维护约定](AGENTS.md)。这些开发文档保留在源码仓库，不随插件安装包分发。

2.14.0 已修复检查报告中的八类已复现问题及维护缺口，具体证据见报告状态表。状态工具和动态提示可提供当前档案的日记摘要；AI 如何自然使用这些数据仍需在测试环境验收。

由 **番星与 GPT 联合制作**。插件面板顶部可打开 GitHub，或进入「关于」查看版本、下载入口、问题反馈与开源协议。

## 🙏 致谢

本项目灵感与功能设计来源于 [astrbot_plugin_private_companion](https://github.com/menglimi/astrbot_plugin_private_companion)，针对 QwenPaw 平台进行了适配与重构。感谢原作者的贡献。

## ✨ 特性

- 🏠 **今日总览** - 心情、精力、待提醒便签和关系温度卡片，集中查看今天的日程及临近纪念日
- 📱 **响应式界面** - 柔和卡片布局、窄屏换行导航、浅色/深色主题
- 🔎 **搜索与编辑** - 梦境和重要日期搜索，便签搜索及待提醒筛选；直接编辑日程和便签

- 🌤 **状态管理** - 心情、精力、睡眠、健康等状态追踪，仪表盘可直接编辑
- 📅 **日程安排** - 每日计划时间线展示
- ⏰ **作息模板** - 保存 AI 作息模板，跨日读取时生成今日日程，支持生活引擎按需演化（当天手动修改不被覆盖）
- 💭 **梦境记录** - 按日期存储的梦境碎片，支持全文查看
- 📝 **便签系统** - 可设置过期时间的便签，支持提醒标记与过期清理
- 💕 **关系记录** - 亲密度、里程碑、互动记录
- 🎂 **重要日期** - 生日、纪念日管理
- 🔌 **REST API** - 全部数据可通过 API 编程访问，搭配 companion_core 技能供 Agent 使用
- 🤖 **Agent 工具** - PawApp SDK 可用时注册 7 个智能体工具（读取状态/日程/便签/关系/日期，更新状态，创建便签），Agent 可直接调用
- 🌙 **暗色模式** - 仪表盘自动跟随 QwenPaw 主题切换明暗模式
- 💾 **数据管理** - 业务导出包含日记、回顾与统计；可选完整私密备份包含全部档案与配置（含密钥）
- 🔒 **线程安全** - 核心业务写入使用锁和文件原子替换；跨文件更新不构成事务
- 🌐 **中英双语** - 自动跟随 QwenPaw 的语言设置

## 📦 版本要求

- QwenPaw ≥ 2.0.1（PawApp 框架）
- v2.14.0：修复跨档案读写与预览校验、统一日程读取、自动日记任务回滚和时间更新；打通日记回顾与受限摘要读取，补完整私密备份、权限检查及准确用量统计。
- v2.13.1（并入 2.14.0，未单独发布）：明确 AI 档案主体与模型整理视角，改善切页草稿保留、查看智能体选择及 AI 设置操作区；保留现有导航与自定义折叠。
- v2.14.1：修复完整备份在符号链接数据目录下的 500（相对化前先 resolve），补符号链接回归测试。
- v2.13.0：多智能体数据隔离——按智能体解析数据档案（profiles.json 映射，独立档案存于 profiles/<id>/），HTTP/工具/钩子三条路径统一解析，默认 shared 完全向后兼容；绑定页可切换共用/独立/自定义组。
- v2.12.0：互动计分候选（工具互动/关怀投递进入可解释计分，确认制）、周回顾（当周真实记录起草）、模型用量统计页；互动记录与用量持久化并纳入权限收紧。
- v2.11.0：陪伴日记（模型起草、预览确认、自动日记可选）与规划模式（一键起草作息+整理节奏+关怀建议）；新增「陪伴日记」页签与日程页「规划模式」入口。
- v2.10.6：检查页修复补全——存储持久性按平台/本地部署标注、数据权限一键收紧、关怀任务一键重建、「一键修复全部」不碰绑定类操作。
- v2.10.5：导航修复与自定义——修复宿主 `qwenpaw-tabs` 前缀导致的页签被折叠问题；折叠集合改为用户自选（自定义导航弹窗 + 收起开关，偏好持久化）；头部新增「⭐ 支持作者」与「🐞 反馈」（GitHub Issue / 平台社区）入口。
- v2.10.4：修复作息模板三处缺陷——故意清空的当天不再被模板回填、模板纳入导出/导入备份、`routine.yaml` 权限收紧为 0600；并修正检查界面提示文案重复。
- v2.10.3：作息模板（跨日自动生成今日日程，生活引擎无需每天手填即可持续演化）；仪表盘导航精简为 8 个主标签 + 「更多」菜单；使用引导新增“开启生活引擎”一步。
- v2.10.1：生活引擎（状态自动演化，可选）、技能随绑定自动安装、检查界面（自检与一键修复）；修复绑定接口自死锁与跨天演化误覆盖手动字段。
- v2.9.0：稳定测试版，真机验收完成；修复 Actions artifact 双层 ZIP 无法直装的问题，安装包瘦身至 19 个文件，插件功能与 2.8.2 一致。
- v2.8.1：新增每日历史归档、日记时间线、持久化首见、可解释计分、宿主模型发现与可选关怀任务。
- v2.8.0：新增本地称呼推断与手动文件回填基础。
- v2.7.0：新增首次使用引导，将模型配置入口改名为“AI 设置”，新用户以空白记录开始。
- v2.6.0：新增独立模型聊天整理，每模块 API/模型/提示词配置、手动预览写入及可选自动整理。
- v2.5.0：新增智能体绑定、工具开关及实际调用记录。
- v2.4.0：新增今日总览、响应式卡片界面、日程/便签编辑及搜索筛选；加强日期时间校验、导入预校验，避免便签 ID 冲突。保留 2.3.2 的标准插件适配。
- v2.3.0：新增 4 个 Agent 工具（共 7 个）、动态系统提示、暗色模式、数据导出/导入 UI、日程编辑与梦境创建
- v2.2.0：后端入口迁移至 `plugin.py`，数据目录统一为 `~/.qwenpaw/data/companion-core/`，新增 Agent 工具注册与系统提示注入
- 从 1.x 升级：本版本由旧版 `general` 插件迁移为 `app` 类型 PawApp，API 前缀由 `/api/companion` 变更为 `/api/companion-core`。如需保留旧数据，将原工作区 `companion_data/` 中的文件复制到 `~/.qwenpaw/data/companion-core/` 即可。

## 🚀 安装

### 本地安装

将 `companion-core-2.14.1.zip` 交给 QwenPaw 的插件安装界面，或执行：

```bash
qwenpaw plugin install /path/to/companion-core-2.14.0.zip
# 覆盖安装已有版本
qwenpaw plugin install --force /path/to/companion-core
```

源码打包：`python3 scripts/package.py`，输出到 `dist/`，ZIP 内保留 `companion-core/` 顶层目录；追加 `--dir` 可同时在 `dist/companion-core/` 生成解包目录（CI 用它发布单层包裹的 `-installable` artifact）。

### 首次使用引导

首次打开仪表盘会显示四步引导：填写可选称呼、绑定智能体、选择是否开启生活引擎、配置供各模块共用的 AI 模型。可以选择「稍后设置」直接进入，之后点击页面顶部的「快速配置」重新打开。完成或暂缓后，刷新页面不会重复弹出。引导保存配置本身不调用模型。

新安装不预填心情、睡眠、作息日程或关系描述，精力和关系分数为未记录，页面显示占位；便签、梦境和重要日期为空。AI 可通过工具和已启用的整理流程积累记录，用户也可在面板校正 AI 档案。引导与升级均保留已有记录，不清空或覆盖用户数据；旧版已有的示例数据也不会自动删除。

称呼与引导完成状态存于数据目录下的 `setup.json`。称呼用于界面显示；智能体绑定和 AI 配置仍使用相应的宿主与插件配置，不替换智能体原有的人设。

### 技能安装

**推荐：绑定即安装。** 在「智能体绑定」页（或 `PUT /agents/{id}/binding`）绑定智能体时，扩展会把自带 `SKILL.md` 写入该智能体工作区的 `skills/companion_core/` 并启用；已存在且内容不一致时不覆盖，可在检查页一键更新。解绑仅移除与扩展完全一致的副本。

手动方式（可选）：
1. 将 `SKILL.md` 放到 Agent 工作区的 `skills/companion_core/` 目录
2. 在 `skill.json` 中启用该技能
3. 按需配置 `jobs.json` 中的定时关怀任务

## 📖 REST API

安装后通过 HTTP API 管理所有陪伴数据（前缀 `/api/companion-core`）：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/companion-core/state` | GET/PUT | 状态读写（PUT 为增量合并） |
| `/api/companion-core/schedule` | GET/PUT | 日程读写（GET 时若启用作息模板且今日无日程，自动按模板生成） |
| `/api/companion-core/routine` | GET/PUT | 作息模板读写：启用后每天自动物化今日日程，生活引擎得以跨日持续演化；当天手动修改不被覆盖 |
| `/api/companion-core/routine/apply-today` | POST | 显式用模板重建今日日程（会覆盖当天已有安排） |
| `/api/companion-core/dreams` | GET/POST | 梦境列表/创建 |
| `/api/companion-core/dreams/{date}` | GET | 指定日期梦境 |
| `/api/companion-core/notes` | GET/POST | 便签列表（`?expired=true` 含过期）/创建 |
| `/api/companion-core/notes/{id}` | PUT/DELETE | 更新/删除便签 |
| `/api/companion-core/notes/expired` | DELETE | 清理过期便签 |
| `/api/companion-core/relationship` | GET/PUT | 关系读写 |
| `/api/companion-core/relationship/decay` | POST | 应用关系衰减 |
| `/api/companion-core/dates` | GET/POST | 重要日期列表/添加 |
| `/api/companion-core/dates/{name}` | DELETE | 删除重要日期 |
| `/api/companion-core/export` | GET | 导出当前档案的业务记录、日记、回顾与统计（历史需 include_history=true） |
| `/api/companion-core/import` | POST | 导入业务记录（兼容旧备份） |
| `/api/companion-core/backup` | GET | 全部档案与配置的私密备份（含密钥） |
| `/api/companion-core/backup/restore` | POST | 完整恢复，保留回退备份，关闭自动功能等待重新启用 |
| `/api/companion-core/life` | GET/PUT | 生活引擎开关、自动管理字段与演化预览（纯规则、零模型） |
| `/api/companion-core/checkup` | GET | 自检清单：存储持久性、数据权限、绑定/技能、关怀任务完整性等 |
| `/api/companion-core/checkup/fix` | POST | 一键修复（绑定类修复不参与批量） |
| `/api/companion-core/care` | GET/PUT | 关怀配置读写（PUT 需预览确认） |
| `/api/companion-core/care/stop` | POST | 停用关怀并清理其定时任务 |
| `/api/companion-core/agents` | GET | 各智能体绑定与技能状态 |
| `/api/companion-core/agents/{id}/binding` | PUT | 绑定开关（同时安装/移除自带技能） |
| `/api/companion-core/health` | GET | 健康检查 |
| `/api/companion-core/diary` | GET | 陪伴日记列表 |
| `/api/companion-core/diary/{date}` | GET/DELETE | 读取/删除某日日记 |
| `/api/companion-core/diary/preview` | POST | 从当天真实记录起草日记（无记录/无模型不生成） |
| `/api/companion-core/diary/apply` | POST | 预览确认后写入；已有日记拒绝覆盖 |
| `/api/companion-core/diary/settings` | GET/PUT | 自动日记开关、每日生成时间与 token 上限 |
| `/api/companion-core/plan/preview` | POST | 规划模式预览：作息+整理节奏+关怀建议（无模型时规则草稿） |
| `/api/companion-core/plan/apply` | POST | 应用作息与整理节奏；关怀只返回建议不自动写入 |
| `/api/companion-core/weekly` | GET | 周回顾列表 |
| `/api/companion-core/weekly/{week}` | GET/DELETE | 读取/删除某周回顾（YYYY-Www） |
| `/api/companion-core/weekly/preview` | POST | 从当周真实记录起草周回顾（无记录不生成） |
| `/api/companion-core/weekly/apply` | POST | 预览确认后写入；已有回顾拒绝覆盖 |
| `/api/companion-core/usage` | GET | 模型用量按来源汇总 + 最近明细 |
| `/api/companion-core/profiles` | GET/PUT | 智能体→数据档案映射：shared 共用或独立档案；预览应用校验目标档案 |

PawApp SDK 模式遵循官方 Creator 的路由约定，使用 `/api/companion-core/*`。旧版标准 router 加载器使用 `/api/plugins/companion-core/*`；仪表盘通过只读健康检查自动兼容这两种模式。外部脚本请按宿主实际加载模式选择前缀。

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

## 🤝 绑定智能体与验证 AI 调用

打开仪表盘的 **智能体绑定** 页，选择目标智能体并点击 **绑定并启用工具**。该操作通过 QwenPaw 官方配置接口启用上述 7 个工具，只修改所选智能体的陪伴工具，保留其他工具的配置。新建的智能体也可在这里绑定。解除绑定会关闭该智能体的这 7 个工具。

- 页面读取宿主真实配置，显示未绑定、部分启用、已绑定或配置读取失败。
- 保存后请求宿主重新加载智能体；无法请求时，页面提示手动重新加载或重启 QwenPaw。已请求重新加载不代表加载完成。
- 在所选智能体的新对话中发送：**请调用 companion_get_state 和 companion_get_notes，告诉我你当前的心情及你记住的便签。** 然后返回绑定页刷新状态。
- 仅当插件实际执行了工具且宿主提供当前智能体上下文时，才显示该智能体最近一次调用的工具名、时间及成功/失败。记录保留在内存中，重启后清空，不保存对话内容。无记录不等于一定不能使用。
- 工具已启用只代表配置就绪；模型需支持工具调用，并实际选择调用。默认使用 shared 共用档案；可在数据档案设置中选择独立档案。绑定操作本身不迁移数据。
- 系统提示只向启用了陪伴工具的智能体提供，并仅列出其已启用的工具。标准 router 模式无法直接注册智能体工具，页面明确提示不支持；仍可使用 REST API 和技能模板。

绑定 API：`GET /api/companion-core/agents` 查询状态；`PUT /api/companion-core/agents/{agent_id}/binding`，请求体 `{"enabled":true}` 或 `{"enabled":false}`。旧版 router 前缀同前文。

绑定使用官方源码中的 `load_config`、`load_agent_config`、`save_agent_config`、`BuiltinToolConfig` 和 `schedule_agent_reload`，与宿主工具开关机制一致。真实宿主的模型调用仍需按上述步骤验证，测试替身不代表真实 AI 已调用成功。

## ✨ 用便宜的小模型整理聊天

「AI 设置」使用独立的 OpenAI 兼容 `/chat/completions` 调用流程，不修改宿主模型设置；可配置不同的小模型，也可复用主模型的服务地址与型号，费用仍按实际模型调用计算。你可以使用自己选择的小模型或本地免密模型。

1. 先在「智能体绑定」页启用目标智能体的陪伴工具。
2. 在「AI 设置」中填写公共 **API 基址**（通常含 `/v1`）、**模型名**和 **API Key**，选择目标智能体与一个近期会话。
3. 展开状态、日程、梦境、便签、关系、重要日期的模块设置。每个模块均可独立启用、填写 API/模型/密钥、编辑整理规则，并查看固定数据结构。留空继承公共模型/API；换用不同 API 地址时不会继承公共密钥，请另行填写。
4. 保存配置，点击「整理并预览」。系统读取所选会话最近的文字，调用启用模块的模型，并展示修改前后数据、消息数、请求数及服务商返回的 token 用量。此步会消耗模型额度，但不写入陪伴数据。
5. 检查后点击「确认写入这些修改」。预览 10 分钟后失效；预览后目标模块被手动编辑或被工具更新时，拒绝覆盖，须重新整理。

默认最多读取 30 条用户/助手文字、12000 个聊天字符，每模块最多输出 1200 token。可自行调小，关闭不需要的模块。每次整理每个启用模块最多发出一次请求，全部启用最多六次，某模块失败后不再调用后续模块；失败前已完成的请求仍可能收费。除聊天外还需发送该模块当前数据、数据结构及规则，实际 token 和金额以服务商为准。仅在服务商返回用量时显示 token，不推测价格。

模型结果写入前统一验证。状态/日程等对象合并指定字段，日程的 `plan` 字段可整体更新；便签、梦境和重要日期按标识新增或更新，不删除其他记录，关系里程碑合并去重。无证据时应返回无变化。没有 API、模型不支持兼容接口、返回非法 JSON 或数据不符合定义时，会显示错误。

### 可选自动整理

默认关闭。支持 `PawApp.runtime_hook` 的宿主可开启「聊天结束自动整理」，并设置最小间隔（默认 30 分钟，最低 5 分钟）。它仅处理配置中选定、仍已绑定的智能体，等待其会话保存后运行；不会额外创建定时常驻服务。自动整理直接写入通过验证的修改，不需要手动确认；聊天及配置未变化时跳过重复模型调用。不支持该钩子的宿主会明确提示，仍可手动整理。

每次写入前在 `~/.qwenpaw/data/companion-core/organizer-backups/` 保存陪伴数据备份，最多保留 10 个轮换文件，可通过数据管理页导入恢复。磁盘故障时不保证跨文件事务；必要时从备份恢复。读写目标取决于当前档案；预览与应用校验目标档案，跨档案请求被拒绝。

密钥只存于插件数据目录下的 `organizer-settings.json`，文件权限为 `0600`，配置查询仅返回是否已设置；不包含在陪伴数据导出中。空密钥保留已保存值，清除开关可删除密钥。模型请求不自动重试、不跟随重定向，避免重复收费或密钥被转发；同时只允许一个整理任务。聊天中只提取用户/助手文字，不发送工具输出、系统消息或图片，但文字本身及该模块当前数据会发送至所配置的服务商。

API（PawApp 模式前缀 `/api/companion-core`）：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/organizer/config` | GET/PUT | 脱敏配置、各模块数据定义与最近任务状态 / 保存配置 |
| `/organizer/chats?agent_id=...` | GET | 所选已绑定智能体最近 50 个会话 |
| `/organizer/preview` | POST | `{agent_id, chat_id}`：读取近期文字并生成预览，会调用模型 |
| `/organizer/apply` | POST | `{preview_id}`：应用预览，不再调用模型 |

## 📥 称呼推断与手动文件回填

在「AI 设置」选择并保存已绑定的智能体后，展开「从工作区文件回填」。点击「推断称呼（仅本地）」无需配置模型：只解析 PROFILE.md 的明确用户称呼字段，以及 agent.json 的 name；后者缺失时尝试 SOUL.md 的明确名称。候选标明来源，已有称呼保留在输入框中；需替换时由用户手动编辑。不从叙事记忆猜测称呼，也不更改智能体人设。称呼结果预览、确认写入前均不保存；写入不代表完成首次引导。

完整文件回填流程独立于聊天整理，默认不自动运行：

1. 选择来源并读取。PROFILE.md 最多 4000 字符，MEMORY.md 最多 3000 字符，memory/ 按修改时间选最近 3 篇、每篇最多 800 字符且合计最多 2000 字符；SOUL 风格参考默认不选，最多 1500 字符。文件大小超过 64 KiB、非 UTF-8、符号链接会跳过；memory/ 最多枚举 1000 项。原始文件不修改。
2. 检查并编辑脱敏后的来源。过滤密码、token、key、secret 等敏感行、常见密钥格式、私钥块、IPv4 地址及带账号或查询参数的 HTTP URL；已保存的整理 API Key 也会过滤。**这不是完整的秘密检测器，无法保证识别未标注的密码、所有凭据格式或其他隐私。必须人工检查，建议使用本地免密模型。**
3. 点击「生成发送全文」只构建请求，不调用模型。显示每个接收地址、模型、token 上限和完整 system/user 消息，包括经脱敏的当前模块数据及自定义规则。可取消、返回编辑后重新生成。显式勾选确认后才发送这份不可变快照；模型配置或陪伴数据变化会要求重新审阅。确认后网络失败也不会自动重试同一请求。某模块失败前已完成的请求仍可能收费；再次整理须重新审阅。
4. 只使用已启用的「关系」「重要日期」模型，最多两次调用；近期 memory 仅用于关系事件。PROFILE 显式资料优先于叙事记忆；SOUL 仅供关系描述的措辞参考，不进入事实来源或数据字段。AGENTS.md 不读，agent.json 只在本地解析 name，不作为模型输入。文件回填不允许模型修改关系分数、状态、日程、梦境或任务。
5. 模型结果只做预览，另行确认后才写入。无依据时不修改；非法结果或脱敏占位符拒绝写回；冲突时阻止覆盖。预览和请求审阅均在 10 分钟后过期，缓存仅保存在当前进程中，重载后失效。

写前备份复用最近 10 份 `organizer-backups/`，文件回填备份额外包含原始 `setup`。数据管理页导入仍只恢复陪伴数据，不恢复称呼配置；如需回退称呼，需从私密备份中手动恢复 setup.json。磁盘故障时不保证多文件事务。

API 前缀同现有宿主模式：

| 端点 | 方法 | 作用 |
|---|---|---|
| `/organizer/backfill/sources` | POST | 只读允许的工作区来源，返回脱敏文本与本地称呼候选；不调用模型、不写数据 |
| `/organizer/backfill/review` | POST | 允许编辑来源与称呼，构建完整请求；不调用模型 |
| `/organizer/backfill/preview` | POST | `{review_id, confirmed:true}`，发送已审阅请求或生成本地称呼预览；不写数据 |
| `/organizer/backfill/apply` | POST | `{preview_id}`，检查冲突、备份后写入 |

按难度推进的设计与当前状态见 [ROADMAP.md](ROADMAP.md)。2.8.1 已实现历史归档、日记/那年今日/大事记、模型发现、计分、首见与可选关怀任务；完整规则与限制见 [FEATURES.md](FEATURES.md)。所有自动功能需要显式开启。

## 🗂 数据存储

数据存储在 `~/.qwenpaw/data/companion-core/`（插件目录之外，覆盖安装不丢数据）：

- **默认路径**: `~/.qwenpaw/data/companion-core/`
- **自定义**: 设置环境变量 `QWENPAW_COMPANION_DATA=/path/to/data`

```
companion-core/
├── state.yaml           # 当前状态
├── schedule.yaml        # 今日日程
├── routine.yaml         # 作息模板（启用后跨日自动生成今日日程）
├── profiles.json        # 智能体→数据档案映射（缺省共用）
├── profiles/<id>/       # 独立档案目录（结构同上，首次使用自动种子化）
├── dreams/              # 梦境碎片（YYYY-MM-DD.md）
├── notes.json           # 便签
├── relationship.yaml    # 关系记录
└── important_dates.yaml # 重要日期
```

首次加载会自动补全缺失的种子文件，不覆盖已有文件；有效日期的状态和日程同时保存在 history/ 中。可通过 `/api/companion-core/export` 导出支持的业务记录、通过 `/api/companion-core/import` 恢复；业务导出包含插件日记、周回顾与统计，不含密钥配置；数据页可勾选完整私密备份以备份全部档案、映射及配置。

### 业务时区与数据权限

插件默认按 `Asia/Shanghai` 计算“今日”，不依赖容器是否采用 UTC，也不修改宿主时区。需要其他时区时，为插件进程设置 `QWENPAW_COMPANION_TIMEZONE` 为 IANA 时区名（例如 `UTC`、`America/New_York`），重新加载后生效。无效时区会阻止加载，请修正配置。`/health` 的 `timezone` 与 `today` 可用于核对；调用记录与新记录时间戳携带时区偏移。已有日期和时间戳不重写，历史无时区时间戳不自动转换。

升级会在初始化时将已知陪伴记录、梦境与整理备份文件收紧为 `0600`，保留内容；新增与替换记录也使用 `0600` 的临时文件原子写入。不会改变宿主时区、用户数据内容或启动备份服务。

### 已安装实例与容器迁移

默认目录按插件进程的 `Path.home()` 解析，与 `WORKING_DIR` 无关：以 root 运行时通常是 `/root/.qwenpaw/data/companion-core/`。访问 `/health` 查看 `version`、`data_dir`、`agent_tools`、`tool_names` 和 `tool_count`；SDK 模式本版本声明 7 个工具，标准 router 模式为 0。健康接口只反映插件模式与工具清单，不证明某个智能体绑定或模型调用成功。若宿主显示 8 个工具，请核对完整名称、加载版本和是否重复加载插件。

升级保留已有记录。旧版示例与真实数据无法可靠自动区分，因此不会自动删除。需要清理时先备份，再由用户确认具体记录并在仪表盘编辑。

容器销毁前应备份**整个实际数据目录**，并将该目录持久化挂载；或为插件进程设置 `QWENPAW_COMPANION_DATA` 为已持久化的绝对路径。修改环境变量不会搬迁旧数据：暂停插件写入，完整复制旧目录并保留权限，设置变量后重启或重新加载插件，再核对 `/health` 路径及原记录。验证通过前保留旧目录以便回退；不要为迁移覆盖已有目标数据。

完整目录还包括 `setup.json`（引导状态）、`organizer-settings.json`（模型配置及密钥，须保留 0600 权限）和 `organizer-backups/`。仪表盘导出只备份陪伴记录，**不包含引导状态或模型配置与密钥**；完整迁移须额外备份这些文件。包含密钥的目录备份应私密保存，不提交 Git 或公开传输。

## 🎨 自定义指南

### 1. 称呼与技能

技能模板沿用对话中已确认的称呼，无需替换占位符。首次使用引导中的称呼仅用于仪表盘显示。技能不自动创建定时任务，也不将格式示例写为真实数据。

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
├── requirements-dev.txt     # Python 依赖
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
.venv/bin/pip install -r requirements-dev.txt fastapi httpx pytest
.venv/bin/python -m pytest -q tests
node tests/frontend.cjs
python3 scripts/package.py
```

浏览器交互测试位于 `tests/browser.cjs`，需要测试环境提供 Playwright、React 18、React DOM 18、Ant Design 5 和 Day.js。使用模拟宿主及内存 API，不写入真实陪伴数据；测试结束后会关闭浏览器和本地预览服务。可通过 `COMPANION_PREVIEW_DIR` 指定截图输出目录，`PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定已有 Chromium。

自动测试使用临时数据目录验证 FastAPI 接口、保存和备份恢复，并模拟前端宿主检查 API 地址与菜单注册。SDK 注册检查使用测试替身，不代表已在真实 QwenPaw 验证。发布前仍需在目标宿主检查安装、页面加载及 Agent 工具可用性。

恢复备份时先校验所有已知数据段，格式有误时拒绝写入；备份中提供的数据段覆盖对应记录，梦境按日期合并，不删除备份外的梦境。磁盘故障时仍不保证跨文件事务。2 月 29 日纪念日倒计时按下一次有效闰日计算。

## 自动打包与发布

- 推送 `main` 或手动运行 **Package and Release**：验证后生成 ZIP，可在对应 Actions 运行的 Artifacts 中下载。日常测试请下载 `companion-core-<版本>-installable`，解压即可直接安装；`companion-core-<版本>` artifact 会被 GitHub 再打包一层（双层 ZIP），直接上传安装会提示找不到 plugin.json，需先解出内层 ZIP。
- 推送 `v<版本号>` 标签：核对标签与 `plugin.json` 版本，验证并打包，自动发布 GitHub Release。
- Release 页面展示 `RELEASE.md`，附件仅提供插件 ZIP；README 和 LICENSE 保留在仓库及 ZIP 内。
- 安装 ZIP 顶层为 `companion-core/`，其中包含描述清单、README、发布说明、更新日志和 MIT 协议；缺少必要文件会直接阻止打包。

## 运行依赖

插件使用 QwenPaw 宿主已有的 PyYAML（`pyyaml>=6.0`）、FastAPI 和 Pydantic。用户已在 QwenPaw 2.2.2 的安装元数据中确认 PyYAML 为宿主直接依赖。发布包不携带 `requirements.txt`，不触发宿主的插件依赖安装流程；`requirements-dev.txt` 仅供本地开发，不进入安装包。

2.8.2 规避依赖安装分支中的缓存刷新错误，不修复宿主 Python 本身，也不保证其他宿主调用 `importlib.invalidate_caches()` 的路径正常。

## 2.14.0 测试环境更新

先私密备份实际数据目录，再通过插件安装界面覆盖安装新 ZIP，重载插件并刷新页面。进入绑定/检查页，将既有智能体工作区中的旧技能显式更新为扩展自带版本；默认绑定不覆盖用户自定义技能。优先验证 A/B 独立档案、跨日作息、AI 实际读取日记、自动日记改时间与关怀投递。

普通导出只覆盖当前档案，不含模型密钥。完整私密备份覆盖 shared 和所有独立档案、配置及映射，含密钥，请妥善保管。完整恢复合并备份中包含的文件，保留无关文件，恢复前在 restore-backups 保存回退副本（保留最近 3 份）；恢复后所有自动开关关闭，已有宿主任务因开关/令牌校验保持不执行，需重新启用。单文件上限 2 MiB、总内容上限 32 MiB、文件最多 10000、档案最多 200；回退备份与宿主工作区不再递归打包。
