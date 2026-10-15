# 陪伴核心 Companion Core 2.4.0

QwenPaw 2.x 应用插件：在一个界面中管理状态、日程、梦境、便签、关系与重要日期。

## 本版更新

- 新增今日总览，集中展示心情、精力、待提醒便签、关系温度、当日日程和临近纪念日。
- 优化卡片布局、深色模式和手机窄屏导航，保留中英文界面。
- 新增日程与便签编辑、便签待提醒筛选，以及梦境/便签/重要日期搜索。
- 加强真实日期和时间校验、备份导入预校验，使用 UUID 避免便签 ID 冲突。
- 修正标准插件 API 路径和设置菜单；无 PawApp SDK 时仍可加载仪表盘和 REST API。

## 安装

下载下方 `companion-core-2.4.0.zip`，在 QwenPaw 插件页面选择安装，或执行：

```bash
qwenpaw plugin install /path/to/companion-core-2.4.0.zip
```

覆盖安装请添加 `--force`。用户数据目录仍为 `~/.qwenpaw/data/companion-core/`。

安装包内含 `plugin.json`、完整 `README.md`、`RELEASE.md`、`CHANGELOG.md`、MIT `LICENSE`、后端、前端及种子模板。Release 也单独提供 README 和 LICENSE 下载。

## 许可与验证

本项目采用 **MIT License**，完整条款见仓库及安装包中的 `LICENSE`。

本地后端、前端模拟宿主及 Chromium 交互检查已通过。尚未在真实 QwenPaw 中安装验证；直接 Agent 工具集成需要宿主提供 PawApp SDK。
