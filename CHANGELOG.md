# 更新日志

本文件记录陪伴核心插件的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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
