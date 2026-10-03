# 更新日志

本文件记录陪伴核心插件的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [2.3.0] - 2026-10-03

### 新增
- Agent 工具：`companion_get_schedule`（读取日程）、`companion_update_state`（更新状态）、`companion_create_note`（创建便签）、`companion_get_important_dates`（读取重要日期）
- 动态系统提示（`prompt_section` 改为 callable），自动注入活跃便签数量和临近重要日期提醒
- 前端仪表盘新增「数据」标签页，支持一键导出 JSON 备份与从文件导入恢复
- 前端新增日程编辑功能（添加/删除日程条目）
- 前端新增梦境创建功能（写梦 Modal）
- 前端新增关系记录编辑功能（内联编辑 notes 字段）
- 启动时自动清理过期便签

### 改进
- 前端适配暗色模式（`host.useTheme()`），自动跟随 QwenPaw 主题切换
- 前端 API 调用改用 `host.fetch`，自动携带认证信息
- `plugin.json` 新增 `meta.tools` 工具声明，应用中心可展示工具列表

### 技术
- Agent 工具总数从 3 个增至 7 个（4 读 + 2 写 + 1 关系读取）
- `_build_prompt(agent)` 函数动态构建系统提示，包含当日数据摘要

## [2.2.0] - 2026-10-03

### 变更
- 后端入口从 `backend/main.py` 迁移至根目录 `plugin.py`，对齐 QwenPaw 参考插件结构
- 数据目录统一为 `~/.qwenpaw/data/companion-core/`（与参考插件一致的外部存储路径）
- `plugin.json` 结构对齐参考插件：新增 `menu`、`license`、`min_version`，`permissions` 改为数组

### 新增
- Agent 工具注册（`@app.tool`，tool_type=internal）：`companion_get_state`、`companion_get_notes`、`companion_get_relationship`
- 系统提示注入（`app.prompt_section`），Agent 可自然语言访问陪伴数据
- `_text_response()` 辅助函数，兼容 agentscope ToolResponse

### 改进
- 所有数据读写操作加 `threading.Lock`，保证线程安全
- YAML/JSON 写入改为原子操作（tmp 文件 + `os.replace`），防止写入中断导致数据损坏
- 添加 `@app.hook("shutdown")` 生命周期管理

### 技术
- 删除 `backend/` 目录，单文件 `plugin.py` 承载全部后端逻辑
- 模块级常量 `PLUGIN_VERSION`、`PLUGIN_NAME`、`PLUGIN_ID`
- `plugin.json` 新增 `meta.category`、`meta.icon` 顶层字段

## [2.1.0] - 2026-10-03

### 新增
- 数据导出/导入 API（`GET /export`、`POST /import`）用于备份与恢复
- 关系衰减 API（`POST /relationship/decay`），长时间未互动亲密度自动下降
- 种子文件支持从插件包 `data/` 目录自定义初始数据
- 跨平台用户数据目录支持（Windows: `%APPDATA%`，Linux/Mac: `~/.local/share`）
- 环境变量 `QWENPAW_COMPANION_DATA` 自定义数据目录

### 改进
- 数据目录从插件包内迁移至用户数据目录，插件更新不再覆盖用户数据
- 重命名为「陪伴核心」（中文显示名）
- 完善 SKILL.md 和 README.md 文档
- 添加 `requirements.txt` 依赖声明

### 技术
- 数据目录使用 `_get_data_dir()` 函数动态获取
- `_seed_data()` 优先从插件包复制种子文件，缺失时使用 Pydantic 默认值

## [2.0.0] - 2026-09-19

### 重大变更
- 从 AstrBot 插件迁移为 QwenPaw PawApp 应用
- API 前缀从 `/api/companion` 变更为 `/api/companion-core`
- 插件类型从 `general` 迁移为 `app`

### 新增
- 完整的 REST API（状态、日程、梦境、便签、关系、重要日期）
- React 可视化仪表盘（6 个 Tab 页面）
- 中英双语支持
- Agent 技能定义（SKILL.md）

### 技术
- 后端：FastAPI + PawApp SDK
- 前端：React + Ant Design（宿主运行时加载）
- 持久化：YAML/JSON 文件存储

---

## 版本说明

- **新增**：新功能
- **改进**：对现有功能的增强
- **变更**：行为变化
- **废弃**：即将移除的功能
- **移除**：已移除的功能
- **修复**：问题修复
- **安全**：安全性修复
- **技术**：内部实现变更
