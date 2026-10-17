/**
 * Companion Core — frontend dashboard.
 *
 * Companion data, agent binding and independent-model chat organization.
 * Dark mode via host.useTheme(); API calls go through host.getApiUrl().
 */
(function () {
  var QwenPaw = window.QwenPaw;
  if (!QwenPaw || !QwenPaw.host) {
    console.error("[companion-core] window.QwenPaw not ready");
    return;
  }

  var host = QwenPaw.host;
  var React = host.React;
  var antd = host.antd;
  if (!React || !antd) {
    console.error("[companion-core] Host React and antd are required");
    return;
  }
  var h = React.createElement;
  var useState = React.useState;
  var useEffect = React.useEffect;

  var useHostLocale = typeof host.useLocale === "function" ? host.useLocale : function () { return "en"; };
  var useHostTheme = typeof host.useTheme === "function" ? host.useTheme : function () { return { isDark: false }; };

  var Button = antd.Button;
  var Dropdown = antd.Dropdown;
  var Checkbox = antd.Checkbox;
  var Empty = antd.Empty;
  var Input = antd.Input;
  var InputNumber = antd.InputNumber;
  var Modal = antd.Modal;
  var Popconfirm = antd.Popconfirm;
  var Progress = antd.Progress;
  var Space = antd.Space;
  var Spin = antd.Spin;
  var Switch = antd.Switch;
  var Tabs = antd.Tabs;
  var Tag = antd.Tag;
  var message = antd.message;
  var TextArea = Input.TextArea;

  // ── i18n ─────────────────────────────────────────────────────────────

  var PROJECT_URL = "https://github.com/fanxing724/qwenpaw-companion-core";
  var FEEDBACK_PLATFORM_URL = "https://platform.agentscope.io/community/ask";

  var MESSAGES = {
    zh: {
      discoverHost:"发现宿主模型（不复制密钥）",tabTimeline:"那一天",tabCare:"关怀任务",bfOnThisDay:"那年今日",bfDiary:"日记",bfHistoryEmpty:"该日期暂无状态或日程历史；不会用今天的数据补填。",bfHistoryDates:"可查看的日期",milestoneHint:"这里只展示已确认的关系里程碑。不会从文件修改时间推断事件，也不会虚构“第一次”。关系记录仍由插件共享。",milestoneExtract:"从记忆提取候选（先预览）",bfMilestones:"我们的大事记",bfDraft:"生成本地跟进草稿",bfWhen:"预约时间（留空则按队列规则）",bfFollowup:"问问现在怎么样",bfFollowupHint:"根据选中的日记写一条跟进草稿，确认后加入关怀队列；不会立即发送。",bfQueueFollowup:"确认加入跟进队列",bfScore:"预览可解释亲密度",bfScoreTotal:"建议分数",bfScoreApply:"确认采用此分数",
      careIntro:"定时、首见、增量、模型问候和梦境默认关闭。选择真实接收目标并确认后启用，定时检查复用宿主调度器，每五分钟合并处理；静默时段保留待办，结束后补发。",careModel:"自动生成一句人设问候（每批最多一次模型调用）",careEnabled:"启用定时关怀",careFirst:"启用每日首见提示（成功响应后持久记录）",careSync:"启用本地记忆变化提示（不自动调用模型或写入事实）",careMorning:"根据当天日程发送问候",careDateSuggestion:"建议提前提醒",careDateScope:"纪念日范围（不选则全部）",careDateSuggestionHint:"提醒建议：提前 3 天；请选择智能体和目标，再预览并确认启用。",careDates:"临近纪念日提醒",careInactive:"久未互动跟进",careDream:"启用一次晚间创作梦境（明确标为创作）",careNoScheduler:"宿主暂不支持兼容调度；可用时启用首见提示。",careTarget:"投递目标",careSelectTarget:"请选择会话目标",careTime:"每日问候最早时间",careQuietStart:"静默开始",careQuietEnd:"静默结束",careMax:"每日合并消息上限",careInactiveDays:"未互动天数",careLead:"纪念日提前天数",careStyleHint:"风格供首见 Agent 与可选模型问候使用；原始提醒事实始终附在问候后。开启模型问候会发送脱敏事项和这段风格，请先审阅请求；不改写 SOUL 或技能文件。",careReadStyle:"读取 SOUL 风格（本地预览）",carePreview:"保存前核对规则与接收者",careConsent:"我已核对接收者、开关、静默时段和消息上限，确认保存。",careReview:"预览完整规则与模型请求（不启用）",careSave:"确认保存关怀设置",careStop:"停止定时关怀",careAttempt:"按保存规则尝试一次",careAttemptConfirm:"将向已保存目标尝试投递，仍遵守静默、去重与频率限制。确定继续？",careIgnoreSync:"忽略本批变更提示（不写事实）",careIgnoreConfirm:"仅清空本批记忆变更提示，不修改原文件或陪伴记录，确定？",careQueue:"延迟与首见队列",careRetry:"核实未收到，重新排队",careRetryConfirm:"请先核实未收到；重新排队可能导致重复投递。确认继续？",careAck:"确认已处理",careAckConfirm:"确认该事项已处理？对应便签将标记为已提醒。",

      bfTitle:"从工作区文件回填", bfInferNames:"推断称呼（仅本地）",bfReadDelta:"读取记忆新增行（不调用模型）",bfAcceptNoChanges:"确认本批无需修改并标记已审阅", bfIntro:"手动读取 → 编辑脱敏来源 → 审阅发送全文 → 确认发送 → 预览并确认写入。不会加入自动聊天整理。",
      bfPrivacy:"正则脱敏不能识别所有秘密，请逐字检查并删除敏感内容；建议使用本地免密模型。AGENTS.md 不读取，agent.json 只在本地取 name，不发送配置或密钥。PROFILE 上限 4000 字符，MEMORY 3000，近期最多 3 篇共 2000，SOUL 风格 1500。",
      bfModules:"将使用已启用的回填模块", bfNamesOnly:"仅本地称呼预览，不调用模型", bfStyle:"仅风格", bfRead:"读取来源（不调用模型）", bfReview:"生成发送全文（不调用模型）", bfCandidateHint:"候选称呼标明来源。现有称呼优先保留；如需替换请手动修改输入框。PROFILE 显式资料优先，无法确定的称呼不推断。", bfTruncated:"已截断", bfOutbound:"将要发送的完整请求", bfFrozen:"下面显示每个模块的接收地址、模型与完整消息。确认后只发送这份快照；模型配置或当前数据变化会要求重新审阅。确认发送会消耗模型额度。", bfProfileLocal:"称呼变更仅在本地处理，确认写入前不保存：", bfConsent:"我已检查全文与接收地址，确认继续；模型请求完成后仍需另行确认写入。", bfSend:"确认发送并生成结果预览", bfLocalPreview:"生成本地称呼结果预览",

      tabAbout:"关于", aboutCredit:"由番星与 GPT 联合制作", aboutIntro:"为 QwenPaw 提供状态、日程、梦境、便签、关系与重要日期管理。",
      aboutVersion:"当前版本", aboutRepo:"GitHub 源码", aboutReleases:"版本与下载", aboutIssues:"反馈问题", aboutLicense:"MIT 开源协议", aboutThanks:"灵感与功能设计来源于 astrbot_plugin_private_companion，感谢原作者的贡献。",

      setupTitle:"开始你的陪伴记录", setupOpen:"使用引导", quickSetup:"快速配置", navMore:"更多", navCollapse:"收起自选页签", navExpand:"展开全部页签", navCustomize:"自定义导航", navCustomizeHint:"勾选的页签留在主行；取消勾选的在收起时进入「更多」菜单。当前打开的页签始终可见。", supportAuthor:"支持作者", feedback:"反馈", feedbackGitHub:"GitHub 提 Issue", feedbackPlatform:"平台社区反馈", setupStep:"第 {step} 步，共 4 步",
      setupLife:"开启生活引擎", setupLifeHint:"让睡眠/饥饿/精力按当前时间与今日日程自动演化。纯规则、不调用模型、不消耗 token，随时可以关闭。", setupLifeNow:"现在开启", setupLifeOn:"已开启", setupModelOptional:"配置 AI 模型（可选）", setupNames:"认识彼此", setupNamesHint:"称呼可以留空。记录从真实的聊天和生活开始。", setupUser:"你的称呼", setupCompanion:"陪伴对象的称呼", setupExisting:"已检测到已有记录。本引导只保存设置，会保留现有数据。", setupClean:"从空白记录开始：不预填心情、作息或关系分数。", setupAgent:"连接智能体", setupAgentHint:"选择一个智能体并启用陪伴工具，也可以稍后在“智能体绑定”中操作。", setupChoose:"暂不绑定", setupBindNext:"绑定并继续", setupModel:"配置 AI 模型", setupModelHint:"可填写一个便宜小模型，供各模块共用。也可跳过，之后在“AI 设置”中配置。保存本身不会调用模型，自动整理保持原来的开关状态。", setupNext:"下一步", setupBack:"上一步", setupLater:"稍后设置", setupFinish:"完成设置", setupMissingModel:"请同时填写 API 地址和模型名称，或选择稍后设置。", orgUseShared:"公共模型", noScore:"尚未记录",
      tabOrganizer:"AI 设置", orgIntro:"使用独立的小模型整理近期聊天，不占用主聊天模型。近期文字会发送至你配置的 API。每个启用模块最多调用一次，六个模块最多六次；实际费用按服务商计费。",
      orgBase:"API 基址（例如 https://example.com/v1）", orgModel:"模型名称", orgKey:"API Key（留空保留已保存密钥）", orgKeySaved:"已保存密钥", orgKeyEmpty:"未设置密钥（支持免密本地接口）", orgKeyClear:"清除已保存密钥", orgInherit:"留空继承公共设置；不同 API 地址不继承公共密钥",
      orgAgent:"整理目标智能体", orgChooseAgent:"选择已绑定的智能体", orgChat:"近期会话", orgChooseChat:"选择一个会话", orgAuto:"聊天结束自动整理", orgAutoHint:"自动整理默认关闭。开启后仅处理目标智能体，在聊天结束后按最小间隔运行，无新内容则跳过；会自动写入数据并保留最近 10 份轮换备份。",
      orgNoAuto:"此宿主不支持自动整理钩子，可手动整理。", orgInterval:"最小间隔（分钟）", orgMessages:"最多读取消息数", orgChars:"聊天文字上限（字符）", orgTokens:"每个模块最大输出 token", orgEnabled:"启用此模块", orgPrompt:"模块整理规则 / 提示词", orgSchema:"数据定义（固定结构，点击查看）",
      orgSave:"保存 AI 设置", orgRefresh:"刷新配置与状态", orgSaved:"配置已保存", orgPreview:"整理并预览（会消耗模型额度）", orgApply:"确认写入这些修改", orgDiscard:"放弃预览", orgNoChanges:"模型未提出数据修改。", orgPreviewHint:"本次只生成预览，尚未写入。预览有效期 10 分钟；期间数据变化会阻止覆盖。",
      orgApplied:"修改已写入，其他模块页面已刷新。", orgBefore:"修改前", orgAfter:"修改后", orgUsage:"本次模型用量（服务商未返回时显示空对象）", orgStatus:"最近整理状态", orgDirty:"有未保存设置，请先保存再整理。", orgRead:"读取消息", orgRequests:"模型请求数", orgLoadingChats:"未选择会话或该智能体暂无可读取会话。", orgShared:"六个模块分别使用自己的提示词和模型；API、模型留空时使用公共设置。各智能体仍共享陪伴数据。",
      tabAgents: "智能体绑定", agentsHint: "绑定会在宿主配置中启用该智能体的 7 个陪伴工具。数据仍由本插件共享；绑定不代表模型已经调用。",
      agentBind: "绑定并启用工具", agentUnbind: "解除绑定", agentBound: "已绑定", agentPartial: "部分启用", agentUnbound: "未绑定", agentUnknown: "配置读取失败",
      agentDisabled: "智能体已停用", agentNoCalls: "尚未观察到调用（仅记录本次插件运行期间）", agentLastCall: "最近实际调用", agentSuccess: "成功", agentError: "失败",
      agentTest: "绑定后，在该智能体的新对话里发送：请调用 companion_get_state 和 companion_get_notes，告诉我当前心情及便签。随后点击刷新，查看是否出现实际调用记录。",
      agentEmpty: "宿主中没有可绑定的智能体。", agentRefresh: "刷新状态", agentTools: "工具启用数", agentSaved: "配置已保存", agentNoSdk: "当前宿主不支持智能体绑定。",
      tabOverview: "今日总览", overviewHint: "把今天的状态、安排和牵挂放在一起。",
      pendingNotes: "待提醒便签", upcoming: "即将到来", nextPlan: "今天的安排",
      quickActions: "快速前往", welcome: "每一天，都值得好好记录", todayLabel: "今日陪伴",
      search: "搜索记录…", noResults: "没有匹配的记录", allNotes: "全部", pendingOnly: "待提醒",
      editNote: "编辑便签", editSchedule: "编辑日程", timeInvalid: "请输入有效时间 HH:MM",
      scheduleHint: "日程按时间排列，可随时调整。", notesHint: "记下小事，也留住重要的叮嘱。",
      dreamsHint: "记录醒来前的片刻，留住梦里的世界。", datesHint: "让每个重要的日子都被记得。",
      staleSchedule: "这份安排来自 {date}，请留意日期。", records: "{count} 条记录",
      routineOn: "自动作息：已开启（{count} 条）", routineOff: "自动作息：未开启",
      routineSave: "保存为作息模板", routineDisable: "停用自动作息", routineEnable: "启用自动作息",
      routineApply: "用模板生成今天", routineApplyConfirm: "将用作息模板覆盖今天的日程安排，确定吗？",
      routineSaved: "已保存为作息模板，明天起自动生成今日日程", routineDisabled: "已停用自动作息",
      routineEnabled: "已启用自动作息", routineApplied: "已按模板生成今日日程",
      routineHint: "作息模板让每天自动有日程，生活引擎才能跨日持续演化；当天的手动修改不会被覆盖。",
      tabDiary: "陪伴日记", diaryHint: "日记只从当天真实记录起草，预览确认后才写入；无记录不生成。",
      diaryGenerate: "生成今日日记预览", diaryPreviewed: "预览已生成", diaryApply: "确认写入", diaryWritten: "日记已写入",
      diaryAuto: "自动日记", diaryAutoOn: "自动日记已开启", diaryAutoOff: "自动日记已关闭", diaryTime: "生成时间",
      diaryEmpty: "还没有日记", diaryFromModel: "模型起草", diaryFromRule: "规则草稿", view: "查看",
      planTitle: "规划模式", planGenerate: "生成规划预览", planPreviewed: "规划预览已生成", planApply: "应用作息与整理节奏",
      planApplied: "规划已应用", planWeekend: "周末版", planOrganizer: "整理节奏：", planCare: "关怀建议时间：",
      summaryMood: "此刻心情", summaryEnergy: "今日精力", summaryWarmth: "关系温度",
      openSection: "打开", summaryEmpty: "慢慢来，从一条记录开始。", viewAll: "查看全部",

      appTitle: "陪伴核心", appSubtitle: "状态 · 日程 · 梦境 · 便签 · 关系 · 重要日期 · 数据",
      tabState: "状态", tabSchedule: "日程", tabDreams: "梦境",
      tabNotes: "便签", tabRelationship: "关系", tabDates: "重要日期", tabData: "数据",
      refresh: "刷新", edit: "编辑", save: "保存", cancel: "取消",
      delete: "删除", close: "关闭", view: "查看", add: "添加",
      saved: "已保存", deleted: "已删除",
      loadFailed: "加载失败: {error}", saveFailed: "保存失败: {error}", deleteFailed: "删除失败: {error}",
      fDate: "日期", fMood: "心情", fEnergy: "精力", fSleep: "睡眠",
      fDream: "梦境", fHealth: "健康", fHunger: "饱腹", fNote: "备注",
      lifeTitle: "生活引擎", lifeHint: "开启后，睡眠/饥饿/精力会按当前时间与今日日程自动演化；你手动改的字段不会被覆盖。",
      lifeOn: "自动演化中", lifeOff: "未开启", lifePreview: "下一步将变为", lifeNoChange: "当前无需演化",
      lifeEvolvedAt: "最近演化", lifeAutoFields: "自动管理的字段", lifeNoSchedule: "填写今日日程后才会演化，不编造状态。",
      tabCheckup: "检查", checkupHint: "自动体检安装与配置状态；能自动修复的可一键修复。",
      checkupOk: "正常", checkupWarn: "建议处理", checkupError: "需要修复",
      checkupFix: "一键修复", checkupFixAll: "一键修复全部", checkupFixAllDone: "已修复 {done} 项，失败 {failed} 项", checkupNothingToFix: "没有可自动修复的项目", checkupAskAi: "发给 Agent 修复", checkupGoto: "去设置",
      checkupFixed: "已修复", checkupFixFailed: "修复失败: {error}", checkupCopied: "修复指令已复制，粘贴到 Agent 聊天中即可",
      noState: "还没有状态数据", noPlan: "今天还没有安排", noDreams: "还没有梦境记录",
      dreamOf: "{date} 的梦", newDream: "写梦",
      dreamContent: "梦境内容", dreamDate: "日期（留空为今天）",
      newSchedule: "添加日程", scheduleTime: "时间（如 08:20）",
      scheduleActivity: "活动", scheduleMood: "心情（可选）",
      confirmDeleteSchedule: "确定删除这条日程吗？",
      newNote: "新建便签", cleanExpired: "清理过期", showExpired: "显示过期",
      noteContent: "内容", noteExpires: "过期日期（可选，YYYY-MM-DD）",
      reminded: "已提醒", notReminded: "未提醒", neverExpires: "不过期",
      confirmDeleteNote: "确定删除这条便签吗？", contentRequired: "请填写内容",
      cleaned: "已清理 {count} 条过期便签",
      warmth: "亲密度", lastUpdated: "更新于 {date}", milestones: "里程碑",
      relNotes: "记录", noMilestones: "还没有里程碑", editRelNotes: "编辑记录",
      addDate: "添加日期", dateName: "名称", dateValue: "日期（YYYY-MM-DD）",
      dateNote: "备注（可选）", noDates: "还没有重要日期",
      nameRequired: "请填写名称", dateRequired: "请填写日期",
      dateInvalid: "日期格式须为 YYYY-MM-DD",
      confirmDeleteDate: "确定删除「{name}」吗？",
      exportData: "导出数据", importData: "导入数据",
      exportDesc: "下载所有陪伴数据的 JSON 备份文件。",
      importDesc: "恢复备份中包含的数据；梦境按日期合并。",
      importSuccess: "数据导入成功，已恢复: {fields}",
      exportSuccess: "数据已导出", importFailed: "导入失败: {error}",
      timeRequired: "请填写时间", activityRequired: "请填写活动",
      retry: "重试", loading: "加载中…", loadError: "读取失败",
      healthStatus: "状态", healthDreams: "梦境", healthNotes: "便签",
      importConfirm: "导入将覆盖现有数据，确定继续？",
      isToday: "就是今天", tomorrow: "明天", inDays: "还有 {count} 天",
    },
    en: {
      discoverHost:"Discover host model (no key copied)",tabTimeline:"That day",tabCare:"Care tasks",bfOnThisDay:"On this day",bfDiary:"Diary",bfHistoryEmpty:"No state or schedule history for this date. Current data is never substituted.",bfHistoryDates:"Available dates",milestoneHint:"Only confirmed milestones are shown. File modification times never become event dates; first events are not invented. Relationship data remains shared.",milestoneExtract:"Extract memory candidates (preview first)",bfMilestones:"Our milestones",bfDraft:"Draft a local follow-up",bfWhen:"Schedule time (blank uses queue rules)",bfFollowup:"Follow up",bfFollowupHint:"Write a follow-up draft based on this diary. Confirmation queues it without sending immediately.",bfQueueFollowup:"Confirm and queue follow-up",bfScore:"Preview explainable warmth score",bfScoreTotal:"Proposed score",bfScoreApply:"Confirm this score",
      careIntro:"Scheduling, first-conversation hints, sync, model greetings and dreams are off by default. Confirm a real recipient before enabling. Uses the host scheduler every five minutes; quiet hours defer messages until the window ends.",careModel:"Generate a styled greeting (at most one model call per batch)",careEnabled:"Enable scheduled care",careFirst:"Enable daily first-conversation hints (persist after successful reply)",careSync:"Notify local memory changes (no automatic model calls or fact writes)",careMorning:"Greeting based on today's schedule",careDateSuggestion:"Suggest a reminder",careDateScope:"Anniversaries (empty means all)",careDateSuggestionHint:"Suggested lead time: 3 days. Choose an agent and recipient, review, then confirm enabling.",careDates:"Upcoming anniversary reminders",careInactive:"Follow up after inactivity",careDream:"Enable one evening fictional dream (labeled as creative)",careNoScheduler:"Compatible scheduling is unavailable; first-conversation hints may still be supported.",careTarget:"Recipient",careSelectTarget:"Choose a conversation target",careTime:"Earliest greeting time",careQuietStart:"Quiet hours start",careQuietEnd:"Quiet hours end",careMax:"Daily merged-message limit",careInactiveDays:"Days without interaction",careLead:"Anniversary lead days",careStyleHint:"Style is for first-conversation phrasing and optional model greetings. Original facts are always appended. Model greetings send redacted items and this style; inspect the request first. SOUL and skill files are preserved.",careReadStyle:"Preview local SOUL style",carePreview:"Review rules and recipient before saving",careConsent:"I checked the recipient, switches, quiet hours and frequency limit and confirm saving.",careReview:"Preview rules and model request (no enabling)",careSave:"Confirm care settings",careStop:"Stop scheduled care",careAttempt:"Try once with saved rules",careAttemptConfirm:"Attempt delivery to the saved recipient, respecting quiet hours, deduplication and frequency limits?",careIgnoreSync:"Dismiss memory-change hints (no fact writes)",careIgnoreConfirm:"Clear these memory-change hints without modifying files or companion records?",careQueue:"Deferred and first-conversation queue",careRetry:"Verified missing: requeue",careRetryConfirm:"Verify it was not received. Requeueing could duplicate delivery. Continue?",careAck:"Confirm handled",careAckConfirm:"Confirm this item was handled? Its note will be marked reminded.",

      bfTitle:"Backfill from workspace files", bfInferNames:"Infer names (local only)",bfReadDelta:"Read added memory lines (no model call)",bfAcceptNoChanges:"Confirm no changes and mark reviewed", bfIntro:"Read → edit redacted sources → inspect full requests → confirm sending → preview and confirm saving. Never runs automatically with chats.",
      bfPrivacy:"Redaction cannot detect every secret. Inspect the full text and remove sensitive content; prefer a local keyless model. AGENTS.md is excluded. Only agent.json name is read locally; configuration and keys are never sent. Limits: PROFILE 4000 chars, MEMORY 3000, up to 3 recent files totaling 2000, SOUL style 1500.",
      bfModules:"Enabled backfill modules", bfNamesOnly:"Local name preview only; no model calls", bfStyle:"style only", bfRead:"Read sources (no model call)", bfReview:"Build full request preview (no model call)", bfCandidateHint:"Name candidates include provenance. Existing names are preserved unless you edit them. Explicit PROFILE fields take priority; uncertain names are not inferred.", bfTruncated:"truncated", bfOutbound:"Complete outgoing requests", bfFrozen:"Inspect each recipient, model and complete message. Only this frozen snapshot is sent. Changed settings or data require a new review. Sending uses model credits.", bfProfileLocal:"Name changes are local and saved only after confirmation:", bfConsent:"I inspected the complete text and recipients and confirm continuing. Saving still requires a separate confirmation.", bfSend:"Confirm sending and preview results", bfLocalPreview:"Preview local name changes",

      tabAbout:"About", aboutCredit:"Jointly created by 番星 and GPT", aboutIntro:"State, schedules, dreams, notes, relationships and important dates for QwenPaw.",
      aboutVersion:"Current version", aboutRepo:"GitHub source", aboutReleases:"Releases & downloads", aboutIssues:"Report an issue", aboutLicense:"MIT License", aboutThanks:"Inspired by astrbot_plugin_private_companion. Thanks to its original author.",

      setupTitle:"Start your companion journal", setupOpen:"Getting started", quickSetup:"Quick setup", navMore:"More", navCollapse:"Collapse chosen tabs", navExpand:"Show all tabs", navCustomize:"Customize nav", navCustomizeHint:"Checked tabs stay in the main row; unchecked ones move to the More menu when collapsed. The open tab is always visible.", supportAuthor:"Support the author", feedback:"Feedback", feedbackGitHub:"Open a GitHub issue", feedbackPlatform:"Community feedback", setupStep:"Step {step} of 4",
      setupLife:"Turn on the life engine", setupLifeHint:"Sleep, hunger and energy evolve with the clock and today's schedule. Rule-based: no model calls, no token cost, switch off anytime.", setupLifeNow:"Turn on now", setupLifeOn:"On", setupModelOptional:"Configure an AI model (optional)", setupNames:"Get acquainted", setupNamesHint:"Names are optional. Start with real conversations and experiences.", setupUser:"Your name", setupCompanion:"Companion name", setupExisting:"Existing records found. This guide saves settings and preserves your data.", setupClean:"Start with empty records: no preset moods, routines or relationship scores.", setupAgent:"Connect an agent", setupAgentHint:"Enable companion tools for an agent, or do this later in Agent binding.", setupChoose:"Bind later", setupBindNext:"Bind and continue", setupModel:"Configure an AI model", setupModelHint:"Optionally share one inexpensive model across modules. You can configure it later in AI settings. Saving makes no model requests and preserves the existing automatic-update switch.", setupNext:"Next", setupBack:"Back", setupLater:"Set up later", setupFinish:"Finish setup", setupMissingModel:"Enter both API URL and model name, or choose Set up later.", orgUseShared:"Shared model", noScore:"Not recorded",
      tabOrganizer:"AI settings", orgIntro:"Use an independent small model to organize recent chats. Recent text is sent to your configured API. Each enabled module makes at most one request, up to six per run. Provider pricing applies.",
      orgBase:"API base URL (e.g. https://example.com/v1)", orgModel:"Model name", orgKey:"API key (blank keeps the saved key)", orgKeySaved:"Key saved", orgKeyEmpty:"No key (local keyless endpoints supported)", orgKeyClear:"Clear saved key", orgInherit:"Blank inherits shared settings. A different endpoint does not inherit the shared key.",
      orgAgent:"Target agent", orgChooseAgent:"Choose a bound agent", orgChat:"Recent conversation", orgChooseChat:"Choose a conversation", orgAuto:"Organize after chats automatically", orgAutoHint:"Off by default. Runs after the selected agent finishes a chat, subject to the minimum interval; unchanged text is skipped. Changes are applied automatically, retaining 10 rotating backups.",
      orgNoAuto:"This host has no automatic hook; manual organization is available.", orgInterval:"Minimum interval (minutes)", orgMessages:"Maximum recent messages", orgChars:"Maximum chat characters", orgTokens:"Maximum output tokens per module", orgEnabled:"Enable module", orgPrompt:"Module rules / prompt", orgSchema:"Data schema (fixed structure)",
      orgSave:"Save AI settings", orgRefresh:"Refresh settings and status", orgSaved:"Settings saved", orgPreview:"Generate preview (uses model credits)", orgApply:"Apply these changes", orgDiscard:"Discard preview", orgNoChanges:"The model proposed no changes.", orgPreviewHint:"Preview only; nothing written yet. Expires in 10 minutes. Concurrent edits block overwriting.",
      orgApplied:"Changes applied. Other module pages refreshed.", orgBefore:"Before", orgAfter:"After", orgUsage:"Model usage (empty if the provider omitted it)", orgStatus:"Latest organizer status", orgDirty:"Unsaved settings. Save before organizing.", orgRead:"Messages read", orgRequests:"Model requests", orgLoadingChats:"No conversation selected or no readable conversations.", orgShared:"Each module has its own prompt and optional model/API overrides. Blank settings inherit the shared defaults. Companion data is shared across agents.",
      tabAgents: "Agent binding", agentsHint: "Binding enables the seven companion tools in the host agent configuration. Companion data remains shared; binding does not prove model usage.",
      agentBind: "Bind and enable tools", agentUnbind: "Unbind", agentBound: "Bound", agentPartial: "Partially enabled", agentUnbound: "Unbound", agentUnknown: "Cannot read configuration",
      agentDisabled: "Agent disabled", agentNoCalls: "No observed calls in this plugin run", agentLastCall: "Last actual call", agentSuccess: "Success", agentError: "Failed",
      agentTest: "After binding, start a new conversation with that agent: Please call companion_get_state and companion_get_notes and report my mood and notes. Then refresh here to check for an actual tool call.",
      agentEmpty: "No agents configured in the host.", agentRefresh: "Refresh status", agentTools: "Enabled tools", agentSaved: "Configuration saved", agentNoSdk: "This host does not support agent binding.",
      tabOverview: "Overview", overviewHint: "Your mood, plans and reminders, together.",
      pendingNotes: "Pending reminders", upcoming: "Coming up", nextPlan: "Today's plans",
      quickActions: "Quick access", welcome: "A little care, every day", todayLabel: "DAILY COMPANION",
      search: "Search records…", noResults: "No matching records", allNotes: "All", pendingOnly: "Pending",
      editNote: "Edit note", editSchedule: "Edit schedule", timeInvalid: "Enter a valid time HH:MM",
      scheduleHint: "Your plans in time order. Adjust them as life happens.", notesHint: "Small thoughts and important reminders, kept close.",
      dreamsHint: "Save a little of the world you wake up from.", datesHint: "Keep the days that matter within reach.",
      staleSchedule: "These plans are dated {date}. Check before following them.", records: "{count} records",
      routineOn: "Daily routine: on ({count} items)", routineOff: "Daily routine: off",
      routineSave: "Save as routine", routineDisable: "Disable routine", routineEnable: "Enable routine",
      routineApply: "Apply to today", routineApplyConfirm: "This replaces today's plans with the routine template. Continue?",
      routineSaved: "Saved as routine; today's plans will be generated automatically from tomorrow",
      routineDisabled: "Daily routine disabled", routineEnabled: "Daily routine enabled",
      routineApplied: "Today's plans regenerated from the routine",
      routineHint: "A routine gives every day a schedule so the life engine keeps evolving across days; manual edits made today are never overwritten.",
      tabDiary: "Companion diary", diaryHint: "Diaries are drafted only from that day's real records and written after you confirm; nothing is fabricated.",
      diaryGenerate: "Draft today's diary", diaryPreviewed: "Preview ready", diaryApply: "Confirm and write", diaryWritten: "Diary written",
      diaryAuto: "Auto diary", diaryAutoOn: "Auto diary on", diaryAutoOff: "Auto diary off", diaryTime: "Generation time",
      diaryEmpty: "No diary yet", diaryFromModel: "Model draft", diaryFromRule: "Rule draft", view: "View",
      planTitle: "Planning mode", planGenerate: "Draft plan", planPreviewed: "Plan preview ready", planApply: "Apply routine & cadence",
      planApplied: "Plan applied", planWeekend: "Weekend", planOrganizer: "Organizer cadence: ", planCare: "Suggested care time: ",
      summaryMood: "Current mood", summaryEnergy: "Energy today", summaryWarmth: "Relationship warmth",
      openSection: "Open", summaryEmpty: "Start small. One record is enough.", viewAll: "View all",

      appTitle: "Companion Core", appSubtitle: "State · Schedule · Dreams · Notes · Relationship · Dates · Data",
      tabState: "State", tabSchedule: "Schedule", tabDreams: "Dreams",
      tabNotes: "Notes", tabRelationship: "Relationship", tabDates: "Dates", tabData: "Data",
      refresh: "Refresh", edit: "Edit", save: "Save", cancel: "Cancel",
      delete: "Delete", close: "Close", view: "View", add: "Add",
      saved: "Saved", deleted: "Deleted",
      loadFailed: "Load failed: {error}", saveFailed: "Save failed: {error}", deleteFailed: "Delete failed: {error}",
      fDate: "Date", fMood: "Mood", fEnergy: "Energy", fSleep: "Sleep",
      fDream: "Dream", fHealth: "Health", fHunger: "Hunger", fNote: "Note",
      lifeTitle: "Life Engine", lifeHint: "When enabled, sleep/hunger/energy evolve automatically with the clock and today's schedule; fields you edit by hand are never overwritten.",
      lifeOn: "Auto-evolving", lifeOff: "Off", lifePreview: "Next evolution", lifeNoChange: "Nothing to evolve right now",
      lifeEvolvedAt: "Last evolved", lifeAutoFields: "Auto-managed fields", lifeNoSchedule: "Evolution needs today's schedule; nothing is fabricated.",
      tabCheckup: "Checkup", checkupHint: "Inspects installation and configuration; auto-fixable items can be repaired in one click.",
      checkupOk: "OK", checkupWarn: "Suggested", checkupError: "Action needed",
      checkupFix: "Fix now", checkupFixAll: "Fix all", checkupFixAllDone: "Fixed {done}, failed {failed}", checkupNothingToFix: "Nothing to auto-fix", checkupAskAi: "Send to Agent", checkupGoto: "Open settings",
      checkupFixed: "Fixed", checkupFixFailed: "Fix failed: {error}", checkupCopied: "Repair instruction copied; paste it into the Agent chat",
      noState: "No state data yet", noPlan: "Nothing planned yet", noDreams: "No dreams recorded yet",
      dreamOf: "Dream of {date}", newDream: "New Dream",
      dreamContent: "Dream content", dreamDate: "Date (leave empty for today)",
      newSchedule: "Add Schedule", scheduleTime: "Time (e.g. 08:20)",
      scheduleActivity: "Activity", scheduleMood: "Mood (optional)",
      confirmDeleteSchedule: "Delete this schedule item?",
      newNote: "New note", cleanExpired: "Clean expired", showExpired: "Show expired",
      noteContent: "Content", noteExpires: "Expires at (optional, YYYY-MM-DD)",
      reminded: "Reminded", notReminded: "Not reminded", neverExpires: "Never expires",
      confirmDeleteNote: "Delete this note?", contentRequired: "Enter the content",
      cleaned: "Cleaned {count} expired note(s)",
      warmth: "Warmth", lastUpdated: "Updated {date}", milestones: "Milestones",
      relNotes: "Notes", noMilestones: "No milestones yet", editRelNotes: "Edit notes",
      addDate: "Add date", dateName: "Name", dateValue: "Date (YYYY-MM-DD)",
      dateNote: "Note (optional)", noDates: "No important dates yet",
      nameRequired: "Enter a name", dateRequired: "Enter the date",
      dateInvalid: "Date must be YYYY-MM-DD",
      confirmDeleteDate: "Delete \"{name}\"?",
      exportData: "Export Data", importData: "Import Data",
      exportDesc: "Download a JSON backup of all companion data.",
      importDesc: "Restore included sections from a JSON backup; dreams merge by date.",
      importSuccess: "Import successful, restored: {fields}",
      exportSuccess: "Data exported", importFailed: "Import failed: {error}",
      timeRequired: "Enter the time", activityRequired: "Enter the activity",
      retry: "Retry", loading: "Loading…", loadError: "Failed to load",
      healthStatus: "Status", healthDreams: "Dreams", healthNotes: "Notes",
      importConfirm: "Import overwrites existing data. Continue?",
      isToday: "Today", tomorrow: "Tomorrow", inDays: "in {count} days",
    }
  };

  // host.useLocale() 在文档里是对象 { locale: "zh-CN", ... }，实测宿主可能
  // 直接回字符串，两种形态都要收敛成 zh / en。
  function normalizeLocale(v) {
    var s = v && typeof v === "object" ? String(v.locale || v.language || "") : String(v || "");
    return /^zh/i.test(s.trim()) ? "zh" : "en";
  }

  function tr(locale, key, values) {
    var tpl = (MESSAGES[locale] && MESSAGES[locale][key]) || MESSAGES.en[key] || key;
    return tpl.replace(/\{(\w+)\}/g, function (_, n) {
      return values && values[n] !== undefined ? String(values[n]) : "{" + n + "}";
    });
  }

  function isValidDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ""))) return false;
    var parts = s.split("-"), d = new Date(s + "T12:00:00");
    return !isNaN(d) && d.getFullYear() === +parts[0] && d.getMonth() + 1 === +parts[1] && d.getDate() === +parts[2];
  }
  function matches(text, query) { return String(text || "").toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase()) >= 0; }

  // 后端按本地日期存 key，前端也必须用本地日期：toISOString 是 UTC，
  // 东八区每天 0-8 点会少算一天。
  var BUSINESS_TIMEZONE = "", BUSINESS_DAY = "";
  function localToday() {
    if (BUSINESS_TIMEZONE) {
      try {
        var parts = new Intl.DateTimeFormat('en-CA',{timeZone:BUSINESS_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
        var values={};parts.forEach(function(p){values[p.type]=p.value;});
        return values.year+'-'+values.month+'-'+values.day;
      } catch (e) { if(BUSINESS_DAY)return BUSINESS_DAY; }
    }
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" + m : m) + "-" + (day < 10 ? "0" + day : day);
  }

  // ── Data loading ─────────────────────────────────────────────────────

  // loader 只在 deps 变化或 retry() 后重跑；alive 标记避免切换标签页后
  // 迟到的响应写到已卸载组件上。
  function useAsync(loader, deps) {
    var _s = useState({ data: null, error: null, loading: true }), st = _s[0], setSt = _s[1];
    var _r = useState(0), attempt = _r[0], setAttempt = _r[1];
    var loaderRef = React.useRef(loader);
    loaderRef.current = loader;
    useEffect(function () {
      var alive = true;
      setSt({ data: null, error: null, loading: true });
      loaderRef.current().then(function (d) {
        if (alive) setSt({ data: d, error: null, loading: false });
      }).catch(function (e) {
        if (alive) setSt({ data: null, error: e, loading: false });
      });
      return function () { alive = false; };
    }, (deps || []).concat([attempt]));
    return {
      data: st.data, error: st.error, loading: st.loading,
      retry: function () { setAttempt(attempt + 1); },
    };
  }

  function LoadingBlock(props) {
    return h("div", { style: { padding: 40, textAlign: "center" } },
      h(Spin, {}),
      h("div", { style: { color: props.C.muted, fontSize: 12, marginTop: 10 } }, props.t("loading")));
  }

  function ErrorBlock(props) {
    var detail = props.error && props.error.message ? props.error.message : String(props.error || "");
    return h("div", { style: { padding: 36, textAlign: "center" } },
      h("div", { style: { color: props.C.sub, fontSize: 13, marginBottom: 4 } }, props.t("loadError")),
      h("div", { style: { color: props.C.muted, fontSize: 12, marginBottom: 12 } }, detail),
      h(Button, { size: "small", onClick: props.onRetry }, props.t("retry")));
  }

  // ── Theme ────────────────────────────────────────────────────────────

  function getThemeColors(isDark) {
    return isDark ? {
      text: "#e5e7eb", sub: "#9ca3af", muted: "#6b7280",
      accent: "#f472b6", cardBg: "#1f2937", pageBg: "#111827",
      border: "1px solid rgba(255,255,255,0.1)",
      fieldBorder: "1px solid rgba(255,255,255,0.06)",
    } : {
      text: "#1f2937", sub: "#6b7280", muted: "#9ca3af",
      accent: "#ec4899", cardBg: "#ffffff", pageBg: "#fafafb",
      border: "1px solid rgba(15,23,42,0.08)",
      fieldBorder: "1px solid rgba(15,23,42,0.05)",
    };
  }

  // ── API helpers ──────────────────────────────────────────────────────

  // 宿主是否自动补 /api 前缀在不同 QwenPaw 版本间不一致（文档亦互相矛盾），
  // 写死任一种都会在另一类宿主上 404，故启动时探测一次再自适应。
  var API_PREFIX = (function () {
    try {
      var probe = String(host.getApiUrl("/__cp_probe__") || "");
      return /\/api\/__cp_probe__$/.test(probe) ? "" : "/api";
    } catch (e) {
      return "/api";
    }
  })();

  function apiUrl(path) {
    return typeof host.getApiUrl === "function"
      ? host.getApiUrl(API_PREFIX + path)
      : "/api" + path;
  }

  // PawApp mounts at /api/<app_id>; older router loaders use /api/plugins/<id>.
  // Resolve once with a read-only health request, never retry a mutation.
  var apiMountPromise;
  function resolveApiMount() {
    if (!apiMountPromise) {
      var token = host.getApiToken ? host.getApiToken() : "";
      apiMountPromise = fetch(apiUrl("/companion-core/health"), {
        headers: token ? {Authorization: "Bearer " + token} : {},
      }).then(function (res) {
        return res.status === 404 ? "/plugins" : "";
      }).catch(function (error) {
        apiMountPromise = null;
        throw error;
      });
    }
    return apiMountPromise;
  }

  function apiFetch(path, opts) {
    opts = opts || {};
    return resolveApiMount().then(function (mount) {
      var url = apiUrl(mount + path);
      var token = host.getApiToken ? host.getApiToken() : "";
      var headers = opts.headers || {};
      headers["Content-Type"] = "application/json";
      if (token) headers["Authorization"] = "Bearer " + token;
      return fetch(url, {
        method: opts.method || "GET",
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      }).then(function (res) {
        if (!res.ok) return res.json().catch(function () { return {}; }).then(function (data) {
          var detail = data.detail;
          if (Array.isArray(detail)) detail = detail.map(function (item) { return item.msg; }).join("; ");
          throw new Error(typeof detail === "string" ? detail : "HTTP " + res.status);
        });
        return res.status === 204 ? null : res.json();
      });
    });
  }

  var api = {
    getState: function () { return apiFetch("/companion-core/state"); },
    updateState: function (d) { return apiFetch("/companion-core/state", { method: "PUT", body: d }); },
    getSchedule: function () { return apiFetch("/companion-core/schedule"); },
    updateSchedule: function (d) { return apiFetch("/companion-core/schedule", { method: "PUT", body: d }); },
    getRoutine: function () { return apiFetch("/companion-core/routine"); },
    updateRoutine: function (d) { return apiFetch("/companion-core/routine", { method: "PUT", body: d }); },
    applyRoutineToday: function () { return apiFetch("/companion-core/routine/apply-today", { method: "POST", body: {} }); },
    listDiary: function () { return apiFetch("/companion-core/diary"); },
    getDiary: function (d) { return apiFetch("/companion-core/diary/" + encodeURIComponent(d)); },
    deleteDiary: function (d) { return apiFetch("/companion-core/diary/" + encodeURIComponent(d), { method: "DELETE" }); },
    diaryPreview: function (d) { return apiFetch("/companion-core/diary/preview", { method: "POST", body: { date: d || "" } }); },
    diaryApply: function (id) { return apiFetch("/companion-core/diary/apply", { method: "POST", body: { preview_id: id } }); },
    diarySettings: function () { return apiFetch("/companion-core/diary/settings"); },
    putDiarySettings: function (d) { return apiFetch("/companion-core/diary/settings", { method: "PUT", body: d }); },
    planPreview: function (d) { return apiFetch("/companion-core/plan/preview", { method: "POST", body: d }); },
    planApply: function (id) { return apiFetch("/companion-core/plan/apply", { method: "POST", body: { preview_id: id } }); },
    listDreams: function () { return apiFetch("/companion-core/dreams"); },
    getDream: function (d) { return apiFetch("/companion-core/dreams/" + encodeURIComponent(d)); },
    createDream: function (d) { return apiFetch("/companion-core/dreams", { method: "POST", body: d }); },
    listNotes: function (exp) { return apiFetch("/companion-core/notes?expired=" + (exp ? "true" : "false")); },
    createNote: function (d) { return apiFetch("/companion-core/notes", { method: "POST", body: d }); },
    updateNote: function (id, d) { return apiFetch("/companion-core/notes/" + encodeURIComponent(id), { method: "PUT", body: d }); },
    deleteNote: function (id) { return apiFetch("/companion-core/notes/" + encodeURIComponent(id), { method: "DELETE" }); },
    cleanExpiredNotes: function () { return apiFetch("/companion-core/notes/expired", { method: "DELETE" }); },
    getRelationship: function () { return apiFetch("/companion-core/relationship"); },
    updateRelationship: function (d) { return apiFetch("/companion-core/relationship", { method: "PUT", body: d }); },
    getDates: function () { return apiFetch("/companion-core/dates"); },
    addDate: function (d) { return apiFetch("/companion-core/dates", { method: "POST", body: d }); },
    deleteDate: function (n) { return apiFetch("/companion-core/dates/" + encodeURIComponent(n), { method: "DELETE" }); },
    exportAll: function () { return apiFetch("/companion-core/export?include_history=true"); },
    importAll: function (d) { return apiFetch("/companion-core/import", { method: "POST", body: d }); },
    setup: function () { return apiFetch("/companion-core/setup"); },
    completeSetup: function (data) { return apiFetch("/companion-core/setup",{method:"POST",body:data}); },
    organizerConfig: function () { return apiFetch("/companion-core/organizer/config"); },
    saveOrganizer: function (data) { return apiFetch("/companion-core/organizer/config", {method:"PUT",body:data}); },
    organizerChats: function (id) { return apiFetch("/companion-core/organizer/chats?agent_id=" + encodeURIComponent(id)); },
    timeline:function(agent,day){return apiFetch('/companion-core/timeline?agent_id='+encodeURIComponent(agent)+'&day='+encodeURIComponent(day));},
    discoverModel:function(agent){return apiFetch('/companion-core/organizer/discover-model?agent_id='+encodeURIComponent(agent));},
    scorePlan:function(){return apiFetch('/companion-core/relationship/score-preview');},
    scoreApply:function(id){return apiFetch('/companion-core/relationship/score-apply',{method:'POST',body:{preview_id:id,confirmed:true}});},
    care:function(agent){return apiFetch('/companion-core/care?agent_id='+encodeURIComponent(agent));},
    reviewCare:function(body){return apiFetch('/companion-core/care/preview',{method:'POST',body:body});},
    saveCare:function(body){return apiFetch('/companion-core/care',{method:'PUT',body:body});},
    stylePreview:function(agent){return apiFetch('/companion-core/style-preview?agent_id='+encodeURIComponent(agent));},
    followupPreview:function(agent,day){return apiFetch('/companion-core/care/followup-preview?agent_id='+encodeURIComponent(agent)+'&day='+encodeURIComponent(day));},
    followup:function(body){return apiFetch('/companion-core/care/followup',{method:'POST',body:body});},
    retryCare:function(agent,id){return apiFetch('/companion-core/care/retry',{method:'POST',body:{agent_id:agent,event_id:id,confirmed:true}});},
    ackCare:function(agent,id){return apiFetch('/companion-core/care/ack',{method:'POST',body:{agent_id:agent,event_id:id,confirmed:true}});},
    dismissSync:function(agent){return apiFetch('/companion-core/memory-sync/ack',{method:'POST',body:{agent_id:agent,confirmed:true}});},
    stopCare:function(agent){return apiFetch('/companion-core/care/stop',{method:'POST',body:{agent_id:agent,confirmed:true}});},
    attemptCare:function(agent){return apiFetch('/companion-core/care/attempt',{method:'POST',body:{agent_id:agent,confirmed:true}});},
    backfillSources: function(body){return apiFetch("/companion-core/organizer/backfill/sources",{method:"POST",body:body});},
    backfillReview: function(body){return apiFetch("/companion-core/organizer/backfill/review",{method:"POST",body:body});},
    backfillPreview: function(body){return apiFetch("/companion-core/organizer/backfill/preview",{method:"POST",body:body});},
    backfillApply: function(id){return apiFetch("/companion-core/organizer/backfill/apply",{method:"POST",body:{preview_id:id}});},
    organizerPreview: function (agent,chat) { return apiFetch("/companion-core/organizer/preview", {method:"POST",body:{agent_id:agent,chat_id:chat}}); },
    organizerApply: function (id) { return apiFetch("/companion-core/organizer/apply", {method:"POST",body:{preview_id:id}}); },
    agents: function () { return apiFetch("/companion-core/agents"); },
    bindAgent: function (id, enabled) { return apiFetch("/companion-core/agents/" + encodeURIComponent(id) + "/binding", {method:"PUT", body:{enabled:enabled}}); },
    getLife: function () { return apiFetch("/companion-core/life"); },
    putLife: function (enabled) { return apiFetch("/companion-core/life", { method: "PUT", body: { enabled: enabled } }); },
    getCheckup: function () { return apiFetch("/companion-core/checkup"); },
    fixCheckup: function (body) { return apiFetch("/companion-core/checkup/fix", { method: "POST", body: body }); },
    health: function () { return apiFetch("/companion-core/health").then(function(data){BUSINESS_TIMEZONE=data.timezone||BUSINESS_TIMEZONE;BUSINESS_DAY=data.today||BUSINESS_DAY;return data;}); },
  };

  // ── Shared UI pieces ─────────────────────────────────────────────────

  function Field(props) {
    var C = props.C;
    return h("div", { style: { display: "flex", gap: 8, padding: "7px 0", borderBottom: C.fieldBorder } },
      h("div", { style: { width: 64, flexShrink: 0, color: C.sub, fontSize: 13 } }, props.label),
      h("div", { style: { flex: 1, minWidth:100, overflowWrap:"anywhere", color: C.text, fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, props.children));
  }

  function EditorRow(props) {
    var C = props.C;
    return h("div", {},
      h("div", { style: { fontSize: 12, color: C ? C.sub : "#6b7280", marginBottom: 4 } }, props.label),
      props.children);
  }

  function Toolbar(props) {
    return h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 } },
      props.left || h("span"), props.right || h("span"));
  }

  function panelStyle(C) {
    return { background: C.cardBg, border: C.border, borderRadius: 18, padding: 22, boxShadow: "0 4px 22px rgba(15,23,42,.025)" };
  }

  function SearchBox(props) {
    return h(Input, { value: props.value, onChange: function (e) { props.onChange(e.target.value); },
      placeholder: props.t("search"), "aria-label": props.t("search"), allowClear: true,
      style: { width: "min(100%, 300px)", marginBottom: 16 } });
  }
  function SectionIntro(props) {
    return h("div", { style: { color: props.C.sub, marginBottom: 20, lineHeight: 1.7 } }, props.children);
  }

  function OverviewTab(props) {
    var t = props.t, C = props.C;
    var s = useAsync(function () {
      return Promise.all([api.getState(), api.getSchedule(), api.listNotes(false), api.getDates(), api.getRelationship()]);
    }, []);
    if (s.loading) return h(LoadingBlock, {t: t, C: C});
    if (s.error) return h(ErrorBlock, {t: t, C: C, error: s.error, onRetry: s.retry});
    var state = s.data[0], schedule = s.data[1], notes = s.data[2].filter(function (n) {return !n.reminded;});
    var dates = (s.data[3].dates || []).map(function (d) {return Object.assign({}, d, {left: daysUntilAnniversary(d.date)});})
      .filter(function (d) {return d.left !== null;}).sort(function (a,b) {return a.left-b.left;}).slice(0,3);
    var plans = schedule.date === localToday() ? (schedule.plan || []).slice().sort(function(a,b) {return a.time.localeCompare(b.time);}) : [];
    function metric(label, value, detail, key, icon) {
      return h("button", {className: "cc-metric", onClick: function () {props.navigate(key);}},
        h("span", {className: "cc-metric-icon", "aria-hidden": true}, icon),
        h("span", {className: "cc-eyebrow"}, label), h("strong", null, value),
        h("span", {className: "cc-metric-detail"}, detail));
    }
    function card(title, key, body) {
      return h("section", {style: panelStyle(C)}, h(Toolbar, {left: h("h3", {style: {margin: 0, fontSize: 16}}, title),
        right: h(Button, {type: "link", onClick: function () {props.navigate(key);}}, t("viewAll"))}), body);
    }
    return h("div", null,
      h(Toolbar, {left: h(SectionIntro, {C:C}, t("overviewHint")), right: h(Button, {onClick:s.retry}, t("refresh"))}),
      h("div", {className: "cc-metrics"},
        metric(t("summaryMood"), state.mood || "—", state.date || t("summaryEmpty"), "state", "☀"),
        metric(t("summaryEnergy"), typeof state.energy === "number" ? state.energy + "%" : "—", state.sleep || "—", "state", "↗"),
        metric(t("pendingNotes"), notes.length, t("notesHint"), "notes", "✎"),
        metric(t("summaryWarmth"), typeof s.data[4].warmth_score === "number" ? s.data[4].warmth_score + "%" : "—", t("tabRelationship"), "relationship", "♡")),
      h("div", {className: "cc-overview-grid"},
        card(t("nextPlan"), "schedule", plans.length ? plans.slice(0,5).map(function(item,i) {
          return h("div", {className:"cc-timeline-row", key:i}, h("time", null,item.time), h("span", null,item.activity));
        }) : h(Empty, {description:t("noPlan")})),
        card(t("upcoming"), "dates", dates.length ? dates.map(function(item) {
          return h("div", {className:"cc-date-row", key:item.name}, h("div", null, h("strong", null,item.name), h("small", null,item.date)),
            h(Tag, {color: item.left === 0 ? "magenta" : "gold"}, item.left === 0 ? t("isToday") : t("inDays", {count:item.left})));
        }) : h(Empty, {description:t("noDates")}))),
      h("section", {style: Object.assign({},panelStyle(C),{marginTop:20})},
        h(Toolbar, {left:h("h3", {style:{margin:0,fontSize:16}},t("pendingNotes")),
          right:h(Button,{type:"link",onClick:function(){props.navigate("notes");}},t("viewAll"))}),
        notes.length ? notes.slice(0,3).map(function(note) {return h("div",{className:"cc-note-preview",key:note.id}, note.content);}) : h("p",{style:{color:C.sub}},t("summaryEmpty"))));
  }

  // ── Tab: State ───────────────────────────────────────────────────────

  function StateTab(props) {
    var t = props.t, C = props.C;
    var s = useAsync(api.getState, []);
    var _e = useState(false), editing = _e[0], setEditing = _e[1];
    var _f = useState(null), form = _f[0], setForm = _f[1];
    var _g = useState(false), saving = _g[0], setSaving = _g[1];

    if (s.loading) return h(LoadingBlock, { t: t, C: C });
    if (s.error) return h(ErrorBlock, { t: t, C: C, error: s.error, onRetry: s.retry });
    var data = s.data || {};

    var energy = typeof data.energy === "number" ? data.energy : 0;

    function setField(key, value) {
      setForm(Object.assign({}, form, (function () { var o = {}; o[key] = value; return o; })()));
    }

    function submit() {
      if (saving) return;
      setSaving(true);
      api.updateState(form)
        .then(function () { message.success(t("saved")); setEditing(false); s.retry(); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); })
        .then(function () { setSaving(false); });
    }

    return h("div", {},
      h(Toolbar, {
        left: h("span", { style: { color: C.sub, fontSize: 13 } }, t("fDate") + ": " + (data.date || "—")),
        right: h(Space, { wrap: true },
          h(Button, { size: "small", onClick: s.retry }, t("refresh")),
          h(Button, { size: "small", type: "primary", onClick: function () { setForm(Object.assign({}, data)); setEditing(true); } }, t("edit"))),
      }),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 16 } },
        h("div", { style: panelStyle(C) },
          h(Field, { label: t("fMood"), C: C }, h(Tag, { color: "pink" }, data.mood || "—")),
          h(Field, { label: t("fSleep"), C: C }, data.sleep || "—"),
          h(Field, { label: t("fHealth"), C: C }, data.health || "—"),
          h(Field, { label: t("fHunger"), C: C }, data.hunger || "—")),
        h("div", { style: panelStyle(C) },
          h("div", { style: { color: C.sub, fontSize: 13, marginBottom: 4 } }, t("fEnergy")),
          typeof data.energy === "number" ? h(Progress, { percent: energy, strokeColor: C.accent }) : h("p",{style:{color:C.sub}},t("noScore")),
          h(Field, { label: t("fDream"), C: C }, data.dream || "—"),
          h(Field, { label: t("fNote"), C: C }, data.note || "—"))),
      h(LifeCard, { t: t, C: C, onChanged: s.retry }),
      h(Modal, {
        open: editing, title: t("edit"), okText: t("save"), cancelText: t("cancel"),
        okButtonProps: { loading: saving },
        onCancel: function () { setEditing(false); },
        onOk: submit,
      }, form ? h("div", { style: { display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 } },
        h(EditorRow, { label: t("fMood"), C: C }, h(Input, { value: form.mood, onChange: function (e) { setField("mood", e.target.value); } })),
        h(EditorRow, { label: t("fSleep"), C: C }, h(Input, { value: form.sleep, onChange: function (e) { setField("sleep", e.target.value); } })),
        h(EditorRow, { label: t("fHealth"), C: C }, h(Input, { value: form.health, onChange: function (e) { setField("health", e.target.value); } })),
        h(EditorRow, { label: t("fHunger"), C: C }, h(Input, { value: form.hunger, onChange: function (e) { setField("hunger", e.target.value); } })),
        h(EditorRow, { label: t("fDream"), C: C }, h(Input, { value: form.dream, onChange: function (e) { setField("dream", e.target.value); } })),
        h(EditorRow, { label: t("fNote"), C: C }, h(TextArea, { rows: 2, value: form.note, onChange: function (e) { setField("note", e.target.value); } })),
        h(EditorRow, { label: t("fEnergy"), C: C }, h(InputNumber, { min: 0, max: 100, value: form.energy, onChange: function (v) { setField("energy", v); } }))) : null));
  }

  // ── Life engine card (shown on the State tab) ─────────────────────

  function LifeCard(props) {
    var t = props.t, C = props.C;
    var s = useAsync(api.getLife, []);
    var _b = useState(false), busy = _b[0], setBusy = _b[1];

    if (s.loading) return null;
    if (s.error) return null;
    var data = s.data || {};
    var preview = data.preview || {};
    var previewKeys = Object.keys(preview);

    function toggle(value) {
      if (busy) return;
      setBusy(true);
      api.putLife(value)
        .then(function () { message.success(t("saved")); s.retry(); if (props.onChanged) props.onChanged(); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); })
        .then(function () { setBusy(false); });
    }

    return h("div", { style: Object.assign({}, panelStyle(C), { marginTop: 16 }) },
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
        h("strong", null, "⏳ " + t("lifeTitle")),
        h(Switch, { size: "small", checked: !!data.enabled, disabled: busy, onChange: toggle }),
        h(Tag, { color: data.enabled ? "green" : "default" }, data.enabled ? t("lifeOn") : t("lifeOff"))),
      h("p", { style: { color: C.sub, fontSize: 13 } }, t("lifeHint")),
      data.enabled ? h("div", null,
        previewKeys.length ? h("div", null,
          h("div", { style: { color: C.sub, fontSize: 13, marginBottom: 4 } }, t("lifePreview")),
          previewKeys.map(function (key) {
            return h("p", { key: key, style: { margin: "4px 0" } },
              h(Tag, { color: "blue" }, key), String(preview[key].value), " ",
              h("small", { style: { color: C.sub } }, preview[key].reason));
          })) : h("p", { style: { color: C.sub, fontSize: 13 } }, t("lifeNoChange")),
        h("p", { style: { color: C.sub, fontSize: 12 } },
          t("lifeEvolvedAt") + ": " + (data.evolved_at || "—") + " · " +
          t("lifeAutoFields") + ": " + ((data.auto_fields || []).join(", ") || "—")))
        : h("p", { style: { color: C.sub, fontSize: 12 } }, t("lifeNoSchedule")));
  }

  // ── Tab: Checkup ───────────────────────────────────────────────────

  function CheckupTab(props) {
    var t = props.t, C = props.C;
    var s = useAsync(api.getCheckup, []);
    var _b = useState(""), fixing = _b[0], setFixing = _b[1];

    if (s.loading) return h(LoadingBlock, { t: t, C: C });
    if (s.error) return h(ErrorBlock, { t: t, C: C, error: s.error, onRetry: s.retry });
    var data = s.data || { items: [], summary: {} };
    var colors = { ok: "green", warn: "orange", error: "red" };
    var labels = { ok: t("checkupOk"), warn: t("checkupWarn"), error: t("checkupError") };

    function fix(item) {
      if (fixing) return;
      setFixing(item.id);
      api.fixCheckup({ item: item.fix.item, agent_id: item.fix.agent_id || "" })
        .then(function (res) {
          if (res && res.fixed) { message.success(t("checkupFixed") + "：" + (res.message || "")); s.retry(); }
          else { message.warning((res && res.message) || t("checkupFixFailed", { error: "" })); }
        })
        .catch(function (e) { message.error(t("checkupFixFailed", { error: e.message })); })
        .then(function () { setFixing(""); });
    }

    function fixAll() {
      if (fixing) return;
      var targets = data.items.filter(function (it) { return it.fix && it.fix.kind === "auto" && it.fix.batch !== false; });
      if (!targets.length) { message.info(t("checkupNothingToFix")); return; }
      setFixing("all");
      var done = 0, failed = 0;
      var chain = Promise.resolve();
      targets.forEach(function (it) {
        chain = chain.then(function () {
          return api.fixCheckup({ item: it.fix.item, agent_id: it.fix.agent_id || "" })
            .then(function (res) { if (res && res.fixed) done++; else failed++; })
            .catch(function () { failed++; });
        });
      });
      chain.then(function () {
        setFixing("");
        message.success(t("checkupFixAllDone", { done: done, failed: failed }));
        s.retry();
      });
    }

    function askAi(item) {
      var text = item.fix.prompt || item.detail;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { message.success(t("checkupCopied")); });
      } else {
        window.prompt(t("checkupAskAi"), text);
      }
    }

    return h("div", null,
      h(Toolbar, {
        left: h("span", { style: { color: C.sub, fontSize: 13 } }, t("checkupHint")),
        right: h(Space, { size: 8 },
          h(Button, { size: "small", type: "primary", loading: fixing === "all", onClick: fixAll }, t("checkupFixAll")),
          h(Button, { size: "small", onClick: s.retry }, t("refresh"))),
      }),
      h("div", { style: { display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" } },
        ["ok", "warn", "error"].map(function (key) {
          return h(Tag, { key: key, color: colors[key] }, labels[key] + " " + (data.summary[key] || 0));
        })),
      data.items.map(function (item) {
        return h("div", { key: item.id, style: Object.assign({}, panelStyle(C), { marginBottom: 12 }) },
          h("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" } },
            h(Tag, { color: colors[item.status] || "default" }, labels[item.status] || item.status),
            h("strong", null, item.label),
            h("span", { style: { color: C.sub, fontSize: 13 } }, item.detail),
            h("span", { style: { flex: 1 } }),
            item.fix && item.fix.kind === "auto" ? h(Button, {
              size: "small", type: "primary", loading: fixing === item.id,
              onClick: function () { fix(item); },
            }, t("checkupFix")) : null,
            item.fix && item.fix.kind === "link" ? h(Button, {
              size: "small",
              onClick: function () { if (props.navigate) props.navigate(item.fix.target === "settings" ? "organizer" : item.fix.target); },
            }, t("checkupGoto")) : null,
            item.fix && item.fix.kind === "ask_ai" ? h(Button, {
              size: "small", onClick: function () { askAi(item); },
            }, t("checkupAskAi")) : null));
      }));
  }

  // ── Tab: Schedule ────────────────────────────────────────────────────

  function DiaryTab(props) {
    var t = props.t, C = props.C;
    var ls = useAsync(api.listDiary, []);
    var st = useAsync(api.diarySettings, []);
    var _v = useState(null), viewing = _v[0], setViewing = _v[1];
    var _p = useState(null), preview = _p[0], setPreview = _p[1];
    var _b = useState(false), busy = _b[0], setBusy = _b[1];
    function act(promise, okKey, after) {
      if (busy) return;
      setBusy(true);
      promise.then(function (res) { message.success(t(okKey)); if (after) after(res); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); })
        .then(function () { setBusy(false); ls.retry(); st.retry(); });
    }
    if (ls.loading) return h(LoadingBlock, { t: t, C: C });
    if (ls.error) return h(ErrorBlock, { t: t, C: C, error: ls.error, onRetry: ls.retry });
    var settings = st.data || {};
    var list = ls.data || [];
    return h("div", {},
      h(SectionIntro, { C: C }, t("diaryHint")),
      h(Toolbar, {
        left: h(Space, { wrap: true },
          h(Button, { size: "small", type: "primary", disabled: busy, onClick: function () {
              act(api.diaryPreview(localToday()), "diaryPreviewed", function (res) { setPreview(res); });
            } }, t("diaryGenerate")),
          h(Space, { size: 4 },
            h("span", { style: { color: C.sub, fontSize: 12 } }, t("diaryAuto")),
            h(Switch, { size: "small", checked: !!settings.auto, disabled: busy, onChange: function (v) {
                act(api.putDiarySettings({ auto: v, time: settings.time || "22:30" }), v ? "diaryAutoOn" : "diaryAutoOff");
              } }),
            h(Input, { type: "time", "aria-label": t("diaryTime"), value: settings.time || "22:30", style: { width: 110 },
              onChange: function (e) { if (/^([01]\d|2[0-3]):[0-5]\d$/.test(e.target.value)) act(api.putDiarySettings({ auto: !!settings.auto, time: e.target.value }), "saved"); } }))),
        right: h(Button, { size: "small", onClick: ls.retry }, t("refresh")),
      }),
      preview ? h("div", { style: Object.assign({}, panelStyle(C), { padding: 12, marginBottom: 12 }) },
        h("strong", null, preview.date + " · " + (preview.source === "model" ? t("diaryFromModel") : t("diaryFromRule"))),
        preview.notice ? h("p", { style: { color: C.sub, fontSize: 12 } }, preview.notice) : null,
        h("pre", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit" } }, preview.text),
        h(Space, {},
          h(Button, { size: "small", type: "primary", disabled: busy, onClick: function () {
              act(api.diaryApply(preview.preview_id), "diaryWritten", function () { setPreview(null); });
            } }, t("diaryApply")),
          h(Button, { size: "small", onClick: function () { setPreview(null); } }, t("cancel")))) : null,
      viewing ? h("div", { style: Object.assign({}, panelStyle(C), { padding: 12, marginBottom: 12 }) },
        h("strong", null, viewing.date),
        h("pre", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit" } }, viewing.content),
        h(Space, {},
          h(Popconfirm, { title: t("confirmDeleteSchedule"), onConfirm: function () {
              act(api.deleteDiary(viewing.date), "deleted", function () { setViewing(null); });
            } }, h(Button, { size: "small", danger: true, disabled: busy }, t("delete"))),
          h(Button, { size: "small", onClick: function () { setViewing(null); } }, t("cancel")))) : null,
      h("div", { style: panelStyle(C) },
        list.length === 0 ? h(Empty, { description: t("diaryEmpty") })
          : list.map(function (item) {
              return h("div", { key: item.date, style: { display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: C.fieldBorder } },
                h("span", { style: { fontFamily: "monospace", color: C.accent } }, item.date),
                h("span", { style: { flex: 1, color: C.sub, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, item.preview),
                h(Button, { size: "small", type: "link", onClick: function () {
                    api.getDiary(item.date).then(setViewing).catch(function (e) { message.error(e.message); });
                  } }, t("view")));
            })));
  }

  function PlanModal(props) {
    var t = props.t, C = props.C, open = props.open, onClose = props.onClose, onApplied = props.onApplied;
    var _p = useState(null), preview = _p[0], setPreview = _p[1];
    var _w = useState(false), weekend = _w[0], setWeekend = _w[1];
    var _b = useState(false), busy = _b[0], setBusy = _b[1];
    function run(fn, okKey) {
      if (busy) return;
      setBusy(true);
      fn().then(function (res) { message.success(t(okKey)); if (res && res.preview_id) setPreview(res); if (okKey === "planApplied") { setPreview(null); if (onApplied) onApplied(); } })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); })
        .then(function () { setBusy(false); });
    }
    return h(Modal, { open: open, title: t("planTitle"), footer: null, onCancel: onClose, width: 560 },
      h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
        h(Space, { wrap: true },
          h(Checkbox, { checked: weekend, onChange: function (e) { setWeekend(e.target.checked); } }, t("planWeekend")),
          h(Button, { size: "small", type: "primary", loading: busy, onClick: function () {
              run(function () { return api.planPreview({ weekend: weekend }); }, "planPreviewed");
            } }, t("planGenerate"))),
        preview ? h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
          h("strong", null, preview.source === "model" ? t("diaryFromModel") : t("diaryFromRule")),
          preview.notice ? h("p", { style: { color: C.sub, fontSize: 12 } }, preview.notice) : null,
          h("div", { style: { maxHeight: 220, overflow: "auto" } },
            (preview.plan.routine || []).map(function (x, i) {
              return h("p", { key: i, style: { margin: "2px 0", fontFamily: "monospace", fontSize: 12 } }, x.time + "  " + x.activity);
            })),
          h("p", { style: { color: C.sub, fontSize: 12 } },
            t("planOrganizer") + (preview.plan.organizer.auto_enabled ? "ON " : "OFF ") + preview.plan.organizer.interval_minutes + "min · " +
            t("planCare") + preview.plan.care.time),
          h(Space, {},
            h(Button, { size: "small", type: "primary", loading: busy, onClick: function () {
                run(function () { return api.planApply(preview.preview_id); }, "planApplied");
              } }, t("planApply")),
            h(Button, { size: "small", onClick: onClose }, t("cancel")))) : null));
  }

  function RoutineBar(props) {
    var t = props.t, C = props.C, plan = props.plan, onSaved = props.onSaved;
    var r = useAsync(api.getRoutine, []);
    var _b = useState(false), busy = _b[0], setBusy = _b[1];
    var _pl = useState(false), planOpen = _pl[0], setPlanOpen = _pl[1];
    if (r.loading) return null;
    var routine = r.data || {};
    var enabled = !!routine.enabled;
    var count = (routine.plan || []).length;

    function act(promise, okKey) {
      if (busy) return;
      setBusy(true);
      promise
        .then(function () { message.success(t(okKey)); r.retry(); if (onSaved) onSaved(); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); })
        .then(function () { setBusy(false); });
    }

    return h("div", { style: Object.assign({}, panelStyle(C), { padding: "10px 12px", marginBottom: 10 }) },
      h("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 } },
        h(Tag, { color: enabled ? "green" : "default" },
          enabled ? t("routineOn", { count: count }) : t("routineOff")),
        h(Space, { wrap: true },
          h(Button, { size: "small", disabled: busy || !plan.length, onClick: function () {
              act(api.updateRoutine({ enabled: true, plan: plan }), "routineSaved");
            } }, t("routineSave")),
          enabled
            ? h(Button, { size: "small", disabled: busy, onClick: function () {
                act(api.updateRoutine({ enabled: false }), "routineDisabled");
              } }, t("routineDisable"))
            : h(Button, { size: "small", disabled: busy || !count, onClick: function () {
                act(api.updateRoutine({ enabled: true }), "routineEnabled");
              } }, t("routineEnable")),
          enabled ? h(Popconfirm, { title: t("routineApplyConfirm"), onConfirm: function () {
              act(api.applyRoutineToday(), "routineApplied");
            } }, h(Button, { size: "small", type: "link", disabled: busy }, t("routineApply"))) : null),
        h(Space, { style: { marginLeft: "auto" } }, h(Button, { size: "small", onClick: function () { setPlanOpen(true); } }, t("planTitle"))),
        h(PlanModal, { t: t, C: C, open: planOpen, onClose: function () { setPlanOpen(false); }, onApplied: onSaved }),
        h("span", { style: { flexBasis: "100%", color: C.sub, fontSize: 12 } }, t("routineHint"))));
  }

  function ScheduleTab(props) {
    var t = props.t, C = props.C;
    var s = useAsync(api.getSchedule, []);
    var _m = useState(false), modalOpen = _m[0], setModalOpen = _m[1];
    var _idx = useState(null), editingIndex = _idx[0], setEditingIndex = _idx[1];
    var _f = useState({ time: "", activity: "", mood: "" }), form = _f[0], setForm = _f[1];
    var _g = useState(false), saving = _g[0], setSaving = _g[1];

    if (s.loading) return h(LoadingBlock, { t: t, C: C });
    if (s.error) return h(ErrorBlock, { t: t, C: C, error: s.error, onRetry: s.retry });

    var data = s.data || {};
    var plan = ((data.plan || []).slice()).sort(function (a, b) {
      return String(a.time || "99:99").localeCompare(String(b.time || "99:99"));
    });

    function savePlan(next, msgKey, after, selectedDate) {
      if (saving) return;
      setSaving(true);
      api.updateSchedule({ date: selectedDate || data.date || localToday(), plan: next })
        .then(function () { message.success(t(msgKey)); if (after) after(); s.retry(); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); })
        .then(function () { setSaving(false); });
    }

    function addItem() {
      if (!form.time.trim()) { message.warning(t("timeRequired")); return; }
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)) { message.warning(t("timeInvalid")); return; }
      if (!form.activity.trim()) { message.warning(t("activityRequired")); return; }
      var entry = { time: form.time.trim(), activity: form.activity.trim(), mood: form.mood.trim() || "平稳" };
      savePlan(editingIndex === null ? plan.concat([entry]) : plan.map(function(item,i){return i === editingIndex ? entry : item;}), "saved", function () {
        setEditingIndex(null);
        setModalOpen(false);
        setForm({ time: "", activity: "", mood: "" });
      });
    }

    function removeItem(idx) {
      savePlan(plan.filter(function (_, i) { return i !== idx; }), "deleted");
    }

    return h("div", {},
      h(SectionIntro, {C:C}, t("scheduleHint")),
      data.date && data.date !== localToday() ? h("p", {role:"status",style:{color:C.accent}},t("staleSchedule",{date:data.date})) : null,
      h(RoutineBar, { t: t, C: C, plan: plan, onSaved: s.retry }),
      h(Toolbar, {
        left: h(Space, { wrap: true },
          h(Button, { size: "small", type: "primary", onClick: function () { setEditingIndex(null); setForm({time:"",activity:"",mood:""}); setModalOpen(true); } }, t("newSchedule")),
          h(Input, {type:"date", "aria-label":t("fDate"), value:data.date || localToday(), disabled:saving, style:{width:155}, onChange:function(e){if(isValidDate(e.target.value)) savePlan(plan,"saved",null,e.target.value);}})),
        right: h(Button, { size: "small", onClick: s.retry }, t("refresh")),
      }),
      h("div", { style: panelStyle(C) },
        plan.length === 0
          ? h(Empty, { description: t("noPlan") })
          : plan.map(function (item, idx) {
              return h("div", {
                key: idx,
                style: { display: "flex", flexWrap:"wrap", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: idx < plan.length - 1 ? C.fieldBorder : "none" },
              },
                h("span", { style: { fontFamily: "monospace", fontWeight: 600, color: C.accent, width: 52, flexShrink: 0 } }, item.time || ""),
                h("span", { style: { flex: 1, minWidth:100, overflowWrap:"anywhere", color: C.text, fontSize: 13 } }, item.activity || ""),
                item.mood ? h(Tag, { color: "purple" }, item.mood) : null,
                h(Button, {size:"small",type:"link",disabled:saving,onClick:function(){setEditingIndex(idx);setForm(Object.assign({},item));setModalOpen(true);}},t("edit")),
                h(Popconfirm, { title: t("confirmDeleteSchedule"), onConfirm: function () { removeItem(idx); } },
                  h(Button, { size: "small", type: "link", danger: true, disabled: saving }, t("delete"))));
            })),
      h(Modal, {
        open: modalOpen, title: t(editingIndex === null ? "newSchedule" : "editSchedule"), okText: t("save"), cancelText: t("cancel"),
        okButtonProps: { loading: saving },
        onCancel: function () { setModalOpen(false); setForm({ time: "", activity: "", mood: "" }); },
        onOk: addItem,
      }, h("div", { style: { display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 } },
        h(EditorRow, { label: t("scheduleTime"), C: C }, h(Input, { type: "time", value: form.time, onChange: function (e) { setForm(Object.assign({}, form, { time: e.target.value })); } })),
        h(EditorRow, { label: t("scheduleActivity"), C: C }, h(Input, { value: form.activity, onChange: function (e) { setForm(Object.assign({}, form, { activity: e.target.value })); } })),
        h(EditorRow, { label: t("scheduleMood"), C: C }, h(Input, { placeholder: "平稳", value: form.mood, onChange: function (e) { setForm(Object.assign({}, form, { mood: e.target.value })); } })))));
  }

  // ── Tab: Dreams ──────────────────────────────────────────────────────

  function DreamsTab(props) {
    var t = props.t, C = props.C;
    var s = useAsync(api.listDreams, []);
    var _q = useState(""), query = _q[0], setQuery = _q[1];
    var _v = useState(null), viewing = _v[0], setViewing = _v[1];
    var _m = useState(false), modalOpen = _m[0], setModalOpen = _m[1];
    var _f = useState({ date: "", content: "" }), form = _f[0], setForm = _f[1];
    var _g = useState(false), saving = _g[0], setSaving = _g[1];
    var _p = useState(false), opening = _p[0], setOpening = _p[1];
    var dreamRequest = React.useRef(0);
    useEffect(function(){return function(){dreamRequest.current++;};},[]);

    if (s.loading) return h(LoadingBlock, { t: t, C: C });
    if (s.error) return h(ErrorBlock, { t: t, C: C, error: s.error, onRetry: s.retry });
    var dreams = (s.data || []).filter(function(d){return matches(d.date + " " + d.content,query);});

    function openDream(d) {
      var requestId = ++dreamRequest.current;
      setOpening(true);
      api.getDream(d).then(function(value){if(requestId === dreamRequest.current) setViewing(value);})
        .catch(function (e) { if(requestId === dreamRequest.current) message.error(t("loadFailed", { error: e.message })); })
        .then(function () { if(requestId === dreamRequest.current) setOpening(false); });
    }

    function submitDream() {
      if (saving) return;
      if (!form.content.trim()) { message.warning(t("contentRequired")); return; }
      if (form.date && !isValidDate(form.date)) { message.warning(t("dateInvalid")); return; }
      var body = { content: form.content.trim() };
      if (form.date) body.date = form.date;
      setSaving(true);
      api.createDream(body)
        .then(function () { message.success(t("saved")); setModalOpen(false); setForm({ date: "", content: "" }); s.retry(); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); })
        .then(function () { setSaving(false); });
    }

    return h("div", {},
      h(SectionIntro,{C:C},t("dreamsHint")),
      h(SearchBox,{t:t,value:query,onChange:setQuery}),
      h(Toolbar, {
        left: h(Space, { wrap: true },
          h(Button, { size: "small", type: "primary", onClick: function () { setModalOpen(true); } }, t("newDream")),
          h("span", { style: { color: C.sub, fontSize: 13 } }, dreams.length ? t("tabDreams") + " · " + dreams.length : "")),
        right: h(Button, { size: "small", onClick: s.retry }, t("refresh")),
      }),
      h("div", { style: panelStyle(C) },
        dreams.length === 0
          ? h(Empty, { description: t(query ? "noResults" : "noDreams") })
          : dreams.map(function (dream, idx) {
              var preview = String(dream.content || "").replace(/^#.*$/m, "").trim().slice(0, 120);
              return h("div", {
                key: dream.date || idx,
                style: { display: "flex", flexWrap:"wrap", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: idx < dreams.length - 1 ? C.fieldBorder : "none", cursor: "pointer" },
                onClick: function () { openDream(dream.date); },
              },
                h(Tag, { color: "blue", style: { flexShrink: 0 } }, dream.date),
                h("span", { style: { flex: 1, color: C.sub, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, preview || "…"),
                h(Button, { size: "small", type: "link" }, t("view")));
            })),
      h(Modal, {
        open: !!viewing || opening, title: viewing ? t("dreamOf", { date: viewing.date }) : "",
        footer: null, onCancel: function () { dreamRequest.current++; setOpening(false); setViewing(null); },
      }, opening ? h("div", { style: { padding: 24, textAlign: "center" } }, h(Spin, {}))
        : viewing ? h("div", { style: { whiteSpace: "pre-wrap", color: C.text, fontSize: 13, maxHeight: "60vh", overflow: "auto" } }, viewing.content) : null),
      h(Modal, {
        open: modalOpen, title: t("newDream"), okText: t("save"), cancelText: t("cancel"),
        okButtonProps: { loading: saving },
        onCancel: function () { setModalOpen(false); setForm({ date: "", content: "" }); },
        onOk: submitDream,
      }, h("div", { style: { display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 } },
        h(EditorRow, { label: t("dreamDate"), C: C }, h(Input, { type:"date", value: form.date, onChange: function (e) { setForm(Object.assign({}, form, { date: e.target.value })); } })),
        h(EditorRow, { label: t("dreamContent"), C: C }, h(TextArea, { rows: 5, maxLength:2000, showCount:true, value: form.content, onChange: function (e) { setForm(Object.assign({}, form, { content: e.target.value })); } })))));
  }

  // ── Tab: Notes ───────────────────────────────────────────────────────

  function NotesTab(props) {
    var t = props.t, C = props.C;
    var _x = useState(false), showExpired = _x[0], setShowExpired = _x[1];
    var s = useAsync(function () { return api.listNotes(showExpired); }, [showExpired]);
    var _q = useState(""), query = _q[0], setQuery = _q[1];
    var _p = useState(false), pending = _p[0], setPending = _p[1];
    var _id = useState(null), editingId = _id[0], setEditingId = _id[1];
    var _m = useState(false), modalOpen = _m[0], setModalOpen = _m[1];
    var _f = useState({ content: "", expires_at: "" }), form = _f[0], setForm = _f[1];
    var _g = useState(false), busy = _g[0], setBusy = _g[1];

    if (s.loading) return h(LoadingBlock, { t: t, C: C });
    if (s.error) return h(ErrorBlock, { t: t, C: C, error: s.error, onRetry: s.retry });
    var notes = (s.data || []).filter(function(note){return matches(note.content,query) && (!pending || !note.reminded);})
      .slice().sort(function(a,b){return Number(a.reminded)-Number(b.reminded) || String(b.created_at).localeCompare(String(a.created_at));});

    function runAsync(action, onOk) {
      if (busy) return;
      setBusy(true);
      Promise.resolve().then(action)
        .then(function (res) { if (onOk) onOk(res); s.retry(); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); })
        .then(function () { setBusy(false); });
    }

    function toggleReminded(note) {
      runAsync(function () { return api.updateNote(note.id, { reminded: !note.reminded }); });
    }

    function removeNote(id) {
      runAsync(function () { return api.deleteNote(id); }, function () { message.success(t("deleted")); });
    }

    function cleanExpired() {
      runAsync(function () { return api.cleanExpiredNotes(); }, function (res) {
        message.success(t("cleaned", { count: (res && res.cleaned) || 0 }));
      });
    }

    function submitCreate() {
      if (!form.content || !form.content.trim()) { message.warning(t("contentRequired")); return; }
      if (form.expires_at && !isValidDate(form.expires_at)) { message.warning(t("dateInvalid")); return; }
      runAsync(function () {
        var body = {content: form.content.trim(), expires_at: form.expires_at || ""};
        return editingId ? api.updateNote(editingId, body) : api.createNote(body);
      }, function () {
        message.success(t("saved"));
        setModalOpen(false);
        setForm({ content: "", expires_at: "" });
      });
    }

    var today = localToday();

    return h("div", {},
      h(SectionIntro, {C:C}, t("notesHint")),
      h("div", {className:"cc-search-row"}, h(SearchBox,{t:t,value:query,onChange:setQuery}),
        h(Button,{type:pending ? "primary" : "default",onClick:function(){setPending(!pending);}},t("pendingOnly"))),
      h(Toolbar, {
        left: h(Space, { wrap: true },
          h(Button, { size: "small", type: "primary", onClick: function () { setEditingId(null); setForm({content:"",expires_at:""}); setModalOpen(true); }, disabled: busy }, t("newNote")),
          h(Popconfirm, { title: t("cleanExpired"), onConfirm: cleanExpired },
            h(Button, { size: "small", disabled: busy }, t("cleanExpired"))),
          h("span", { style: { color: C.sub, fontSize: 12 } }, t("showExpired")),
          h(Switch, { size: "small", checked: showExpired, onChange: setShowExpired })),
        right: h(Button, { size: "small", onClick: s.retry, disabled: busy }, t("refresh")),
      }),
      h("div", { style: panelStyle(C) },
        notes.length === 0
          ? h(Empty, { description: t(query || pending ? "noResults" : "tabNotes") })
          : notes.map(function (note, idx) {
              var expired = note.expires_at && note.expires_at < today;
              return h("div", {
                key: note.id || idx,
                style: { padding: "10px 0", borderBottom: idx < notes.length - 1 ? C.fieldBorder : "none", opacity: expired ? 0.55 : 1 },
              },
                h("div", { style: { display: "flex", flexWrap:"wrap", alignItems: "flex-start", gap: 8 } },
                  h("span", { style: { flex: 1, minWidth:100, overflowWrap:"anywhere", color: C.text, fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, note.content),
                  h(Space, { size: 4, wrap:true },
                    h(Button,{size:"small",type:"link",disabled:busy,onClick:function(){setEditingId(note.id);setForm({content:note.content,expires_at:note.expires_at || ""});setModalOpen(true);}},t("edit")),
                    h(Button, { size: "small", type: "link", onClick: function () { toggleReminded(note); }, disabled: busy },
                      note.reminded ? t("notReminded") : t("reminded")),
                    h(Popconfirm, { title: t("confirmDeleteNote"), onConfirm: function () { removeNote(note.id); } },
                      h(Button, { size: "small", type: "link", danger: true, disabled: busy }, t("delete"))))),
                h("div", { style: { display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" } },
                  h(Tag, { color: note.reminded ? "green" : "default" }, note.reminded ? t("reminded") : t("notReminded")),
                  note.expires_at
                    ? h(Tag, { color: expired ? "red" : "orange" }, note.expires_at)
                    : h(Tag, {}, t("neverExpires")),
                  note.created_at ? h("span", { style: { color: C.muted, fontSize: 11, lineHeight: "22px" } }, note.created_at) : null));
            })),
      h(Modal, {
        open: modalOpen, title: t(editingId ? "editNote" : "newNote"), okText: t("save"), cancelText: t("cancel"),
        okButtonProps: { loading: busy },
        onCancel: function () { setModalOpen(false); setForm({ content: "", expires_at: "" }); },
        onOk: submitCreate,
      }, h("div", { style: { display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 } },
        h(EditorRow, { label: t("noteContent"), C: C },
          h(TextArea, { rows: 3, maxLength:500, showCount:true, value: form.content, onChange: function (e) { setForm(Object.assign({}, form, { content: e.target.value })); } })),
        h(EditorRow, { label: t("noteExpires"), C: C },
          h(Input, { type:"date", value: form.expires_at, onChange: function (e) { setForm(Object.assign({}, form, { expires_at: e.target.value })); } })))));
  }

  // ── Tab: Relationship ────────────────────────────────────────────────

  function RelationshipTab(props) {
    var t = props.t, C = props.C;
    var s = useAsync(api.getRelationship, []);
    var _e = useState(false), editing = _e[0], setEditing = _e[1];
    var _f = useState(""), editNotes = _f[0], setEditNotes = _f[1];
    var _g = useState(false), saving = _g[0], setSaving = _g[1];

    if (s.loading) return h(LoadingBlock, { t: t, C: C });
    if (s.error) return h(ErrorBlock, { t: t, C: C, error: s.error, onRetry: s.retry });
    var data = s.data || {};

    var warmth = typeof data.warmth_score === "number" ? data.warmth_score : 0;
    var milestones = data.milestones || [];

    function saveNotes() {
      if (saving) return;
      setSaving(true);
      api.updateRelationship({ notes: editNotes })
        .then(function () { message.success(t("saved")); setEditing(false); s.retry(); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); })
        .then(function () { setSaving(false); });
    }

    return h("div", {},
      h(Toolbar, {
        left: h("span", { style: { color: C.sub, fontSize: 13 } },
          data.last_updated ? t("lastUpdated", { date: data.last_updated }) : ""),
        right: h(Button, { size: "small", onClick: s.retry }, t("refresh")),
      }),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 16 } },
        h("div", { style: panelStyle(C) },
          h("div", { style: { color: C.sub, fontSize: 13, marginBottom: 4 } }, t("warmth")),
          typeof data.warmth_score === "number" ? h(Progress, { percent: warmth, strokeColor: C.accent }) : h("p",{style:{color:C.sub}},t("noScore")),
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 4px" } },
            h("span", { style: { color: C.sub, fontSize: 13 } }, t("relNotes")),
            editing
              ? h(Space, { size: 4 },
                  h(Button, { size: "small", type: "primary", onClick: saveNotes, loading: saving }, t("save")),
                  h(Button, { size: "small", onClick: function () { setEditing(false); }, disabled: saving }, t("cancel")))
              : h(Button, { size: "small", type: "link", onClick: function () { setEditNotes(data.notes || ""); setEditing(true); } }, t("editRelNotes"))),
          editing
            ? h(TextArea, { rows: 3, value: editNotes, onChange: function (e) { setEditNotes(e.target.value); },
                style: { marginTop: 4 } })
            : h("div", { style: { color: C.text, fontSize: 13, whiteSpace: "pre-wrap" } }, data.notes || "—")),
        h("div", { style: panelStyle(C) },
          h("div", { style: { color: C.sub, fontSize: 13, marginBottom: 8 } }, t("milestones")),
          milestones.length === 0
            ? h(Empty, { image: Empty.PRESENTED_IMAGE_SIMPLE, description: t("noMilestones") })
            : milestones.map(function (m, idx) {
                return h("div", { key: idx, style: { display: "flex", gap: 10, padding: "8px 0", borderBottom: idx < milestones.length - 1 ? C.fieldBorder : "none" } },
                  h(Tag, { color: "pink", style: { flexShrink: 0 } }, m.date || ""),
                  h("span", { style: { color: C.text, fontSize: 13 } }, m.event || ""));
              }))));
  }

  // ── Tab: Important dates ─────────────────────────────────────────────

  // 下一次周年还有几天：日期按 MM-DD 滚动，今年已过就取明年。
  function daysUntilAnniversary(dateStr) {
    var parts = String(dateStr || "").split("-");
    if (!isValidDate(dateStr)) return null;
    var m = parseInt(parts[1], 10), d = parseInt(parts[2], 10);
    if (!m || !d) return null;
    var calendar=localToday().split("-");
    var today0 = new Date(+calendar[0],+calendar[1]-1,+calendar[2]);
    for (var year = today0.getFullYear(); year <= today0.getFullYear() + 8; year++) {
      var next = new Date(year, m - 1, d);
      if (next.getMonth() !== m - 1 || next.getDate() !== d || next < today0) continue;
      return Math.round((Date.UTC(year,m-1,d) - Date.UTC(today0.getFullYear(),today0.getMonth(),today0.getDate())) / 86400000);
    }
    return null;
  }

  function DatesTab(props) {
    var t = props.t, C = props.C;
    var s = useAsync(api.getDates, []);
    var _q = useState(""), query = _q[0], setQuery = _q[1];
    var _m = useState(false), modalOpen = _m[0], setModalOpen = _m[1];
    var _f = useState({ name: "", date: "", note: "" }), form = _f[0], setForm = _f[1];
    var _g = useState(false), saving = _g[0], setSaving = _g[1];

    if (s.loading) return h(LoadingBlock, { t: t, C: C });
    if (s.error) return h(ErrorBlock, { t: t, C: C, error: s.error, onRetry: s.retry });

    var dates = ((s.data && s.data.dates) || []).filter(function(d){return matches(d.name + " " + d.note + " " + d.date,query);}).slice().sort(function (a, b) {
      var da = daysUntilAnniversary(a.date), db = daysUntilAnniversary(b.date);
      return (da === null ? 1e9 : da) - (db === null ? 1e9 : db);
    });

    function removeDate(name) {
      if (saving) return;
      setSaving(true);
      api.deleteDate(name)
        .then(function () { message.success(t("deleted")); s.retry(); })
        .catch(function (e) { message.error(t("deleteFailed", { error: e.message })); })
        .then(function () { setSaving(false); });
    }

    function submitAdd() {
      if (saving) return;
      if (!form.name || !form.name.trim()) { message.warning(t("nameRequired")); return; }
      if (!form.date) { message.warning(t("dateRequired")); return; }
      if (!isValidDate(form.date)) { message.warning(t("dateInvalid")); return; }
      setSaving(true);
      api.addDate({ name: form.name.trim(), date: form.date, note: form.note || "" })
        .then(function () { message.success(t("saved")); setModalOpen(false); setForm({ name: "", date: "", note: "" }); s.retry(); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); })
        .then(function () { setSaving(false); });
    }

    return h("div", {},
      h(SectionIntro,{C:C},t("datesHint")),
      h(SearchBox,{t:t,value:query,onChange:setQuery}),
      h(Toolbar, {
        left: h(Button, { size: "small", type: "primary", onClick: function () { setModalOpen(true); } }, t("addDate")),
        right: h(Button, { size: "small", onClick: s.retry }, t("refresh")),
      }),
      h("div", { style: panelStyle(C) },
        dates.length === 0
          ? h(Empty, { description: t(query ? "noResults" : "noDates") })
          : dates.map(function (item, idx) {
              var left = daysUntilAnniversary(item.date);
              var label = left === null ? "" : left === 0 ? t("isToday") : left === 1 ? t("tomorrow") : t("inDays", { count: left });
              return h("div", { key: item.name || idx, style: { display: "flex", flexWrap:"wrap", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: idx < dates.length - 1 ? C.fieldBorder : "none" } },
                h(Tag, { color: left === 0 ? "red" : "magenta", style: { flexShrink: 0, fontFamily: "monospace" } }, item.date || ""),
                h("span", { style: { color: C.text, fontSize: 13, fontWeight: 500 } }, item.name || ""),
                h("span", { style: { flex: 1, color: C.muted, fontSize: 12 } }, item.note || ""),
                label ? h(Tag, { color: left === 0 ? "red" : "gold" }, label) : null,
                h(Button,{size:"small",onClick:function(){if(props.onCare)props.onCare(item);}},t("careDateSuggestion")),
                h(Popconfirm, { title: t("confirmDeleteDate", { name: item.name }), onConfirm: function () { removeDate(item.name); } },
                  h(Button, { size: "small", type: "link", danger: true, disabled: saving }, t("delete"))));
            })),
      h(Modal, {
        open: modalOpen, title: t("addDate"), okText: t("save"), cancelText: t("cancel"),
        okButtonProps: { loading: saving },
        onCancel: function () { setModalOpen(false); setForm({ name: "", date: "", note: "" }); },
        onOk: submitAdd,
      }, h("div", { style: { display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 } },
        h(EditorRow, { label: t("dateName"), C: C }, h(Input, { value: form.name, onChange: function (e) { setForm(Object.assign({}, form, { name: e.target.value })); } })),
        h(EditorRow, { label: t("dateValue"), C: C }, h(Input, { type:"date", value: form.date, onChange: function (e) { setForm(Object.assign({}, form, { date: e.target.value })); } })),
        h(EditorRow, { label: t("dateNote"), C: C }, h(Input, { value: form.note, onChange: function (e) { setForm(Object.assign({}, form, { note: e.target.value })); } })))));
  }

  // ── Tab: Data (export / import) ──────────────────────────────────────

  function SetupWizard(props) {
    var t=props.t,C=props.C,profile=(props.setup && props.setup.profile)||{};
    var st=useState(0),step=st[0],setStep=st[1];
    var names=useState({user_name:profile.user_name||"",companion_name:profile.companion_name||""}),name=names[0],setName=names[1];
    var as=useState(""),agent=as[0],setAgent=as[1];
    var fs=useState(null),config=fs[0],setConfig=fs[1];
    var bs=useState(false),busy=bs[0],setBusy=bs[1];
    var es=useState(""),error=es[0],setError=es[1];
    var ls=useState(false),lifeOn=ls[0],setLifeOn=ls[1];
    var s=useAsync(function(){return Promise.all([api.agents().catch(function(e){return {agents:[],reason:e.message};}),api.organizerConfig(),api.getLife().catch(function(){return {enabled:false};})]);},[]);
    useEffect(function(){if(s.data){setConfig(s.data[1].config);setAgent(s.data[1].config.agent_id||"");setLifeOn(!!(s.data[2]&&s.data[2].enabled));}},[s.data]);
    function act(fn){if(busy)return;setBusy(true);setError("");fn().catch(function(e){setError(e.message);}).then(function(){setBusy(false);});}
    function complete(later){act(function(){
      var save=Promise.resolve();
      if(!later && config){
        if((config.base_url || config.model || config.api_key) && (!config.base_url || !config.model))return Promise.reject(new Error(t("setupMissingModel")));
        save=api.saveOrganizer(Object.assign({},config,{agent_id:agent||config.agent_id}));
      }
      return save.then(function(){return api.completeSetup(name);}).then(props.onDone);
    });}
    function next(){
      if(step===0){setStep(1);return;}
      if(step===1){
        if(!agent){setStep(2);return;}
        act(function(){return api.bindAgent(agent,true).then(function(){setStep(2);});});
        return;
      }
      if(step===2){setStep(3);return;}
    }
    function toggleLife(){act(function(){return api.putLife(!lifeOn).then(function(){setLifeOn(!lifeOn);});});}
    function input(label,value,onChange,password){return h("div",{style:{marginBottom:18}},h(EditorRow,{label:label,C:C},h(Input,{"aria-label":label,type:password?"password":"text",autoComplete:password?"new-password":"off",maxLength:password?4000:200,value:value,disabled:busy,onChange:function(e){onChange(e.target.value);}})));}
    function setting(key,value){setConfig(Object.assign({},config,(function(){var update={};update[key]=value;return update;})()));}
    var agents=s.data?(s.data[0].agents||[]):[];
    return h(Modal,{open:true,title:t("setupTitle"),footer:null,closable:false,maskClosable:false,width:640},
      h("p",{style:{color:C.sub}},t("setupStep",{step:step+1})),
      h("p",{style:{color:C.sub,lineHeight:1.7}},t(props.setup && props.setup.has_existing_data?"setupExisting":"setupClean")),
      error?h("p",{role:"alert",style:{color:C.accent}},error):null,
      step===0?h("div",{},h("h3",null,t("setupNames")),h("p",null,t("setupNamesHint")),
        input(t("setupUser"),name.user_name,function(v){setName(Object.assign({},name,{user_name:v}));}),
        input(t("setupCompanion"),name.companion_name,function(v){setName(Object.assign({},name,{companion_name:v}));})):null,
      step===1?h("div",{},h("h3",null,t("setupAgent")),h("p",null,t("setupAgentHint")),
        s.loading?h(LoadingBlock,{t:t,C:C}):s.error?h(ErrorBlock,{t:t,C:C,error:s.error,onRetry:s.retry}):
          h("select",{"aria-label":t("setupAgent"),value:agent,disabled:busy,style:{width:"100%",padding:10,borderRadius:8,background:C.cardBg,color:C.text},onChange:function(e){setAgent(e.target.value);}},
            h("option",{value:""},t("setupChoose")),agents.filter(function(a){return a.agent_enabled!==false && !a.error;}).map(function(a){return h("option",{key:a.id,value:a.id},a.name+" ("+a.id+")");})),
        s.data && s.data[0].reason?h("p",null,s.data[0].reason):null):null,
      step===2?h("div",{},h("h3",null,t("setupLife")),h("p",{style:{lineHeight:1.7}},t("setupLifeHint")),
        h(Button,{type:lifeOn?"default":"primary",loading:busy,disabled:busy,onClick:toggleLife,style:{marginTop:8}},lifeOn?"✓ "+t("setupLifeOn"):t("setupLifeNow")),
        h("p",{style:{color:C.sub,marginTop:12}},t("lifeNoSchedule"))):null,
      step===3?h("div",{},h("h3",null,t("setupModelOptional")),h("p",{style:{lineHeight:1.7}},t("setupModelHint")),
        config?h("div",{},input(t("orgBase"),config.base_url,function(v){setting("base_url",v);}),input(t("orgModel"),config.model,function(v){setting("model",v);}),
          input(t("orgKey"),config.api_key,function(v){setting("api_key",v);},true),config.api_key_configured?h("p",null,t("orgKeySaved")):null):
          s.error?h(ErrorBlock,{t:t,C:C,error:s.error,onRetry:s.retry}):h(LoadingBlock,{t:t,C:C})):null,
      h("div",{style:{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"flex-end",marginTop:24}},
        h(Button,{disabled:busy,onClick:function(){complete(true);}},t("setupLater")),
        step>0?h(Button,{disabled:busy,onClick:function(){setError("");setStep(step-1);}},t("setupBack")):null,
        step<3?h(Button,{type:"primary",loading:busy,disabled:busy,onClick:next},t(step===1 && agent?"setupBindNext":"setupNext")):
          h(Button,{type:"primary",loading:busy,disabled:busy||!config,onClick:function(){complete(false);}},t("setupFinish"))));
  }

  function FeatureAgent(props) {
    var s=useAsync(api.agents,[]);
    useEffect(function(){if(s.data&&!props.value){var first=(s.data.agents||[]).find(function(a){return a.enabled_tools&&a.enabled_tools.length&&a.agent_enabled!==false;});if(first)props.onChange(first.id);}},[s.data]);
    return h('label',{style:{display:'block',marginBottom:16}},props.t('orgAgent'),h('select',{'aria-label':props.label||props.t('orgAgent'),value:props.value,onChange:function(e){props.onChange(e.target.value);},style:{display:'block',width:'100%',padding:10,background:props.C.cardBg,color:props.C.text,borderRadius:8}},h('option',{value:''},props.t('orgChooseAgent')),(s.data&&s.data.agents||[]).filter(function(a){return a.enabled_tools&&a.enabled_tools.length&&a.agent_enabled!==false;}).map(function(a){return h('option',{key:a.id,value:a.id},a.name+' ('+a.id+')');})),s.error?h('span',null,s.error.message):s.data&&!s.data.supported?h('p',{role:'status'},s.data.reason||props.t('agentNoSdk')):null);
  }

  function TimelineTab(props) {
    var t=props.t,C=props.C;
    var as=useState(''),agent=as[0],setAgent=as[1];
    var ds=useState(localToday()),day=ds[0],setDay=ds[1];
    var dataState=useState(null),data=dataState[0],setData=dataState[1];
    var es=useState(''),notice=es[0],setNotice=es[1];
    var bs=useState(false),busy=bs[0],setBusy=bs[1];
    var fs=useState(''),followup=fs[0],setFollowup=fs[1];
    var whenState=useState(''),when=whenState[0],setWhen=whenState[1];
    var ss=useState(null),score=ss[0],setScore=ss[1];
    useEffect(function(){var active=true;setData(null);setNotice('');if(agent)api.timeline(agent,day).then(function(value){if(active)setData(value);}).catch(function(e){if(active)setNotice(e.message);});return function(){active=false;};},[agent,day,props.revision]);
    function action(fn){setBusy(true);setNotice('');Promise.resolve().then(fn).catch(function(e){setNotice(e.message);}).then(function(){setBusy(false);});}
    function text(value){return h('pre',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:500,overflow:'auto',fontFamily:'inherit'}},value||t('noScore'));}
    return h('section',{style:panelStyle(C)},h('h2',null,t('tabTimeline')),
      h(FeatureAgent,{t:t,C:C,value:agent,onChange:setAgent,label:'timeline agent'}),
      h('label',null,t('fDate'),' ',h('input',{type:'date',value:day,'aria-label':'timeline date',onChange:function(e){if(isValidDate(e.target.value))setDay(e.target.value);}})),
      notice?h('p',{role:'status'},notice):null,
      data?h('div',null,h('p',{style:{color:C.sub}},data.shared_data_notice),
        h('h3',null,t('bfOnThisDay')),data.on_this_day.length?data.on_this_day.map(function(value){return h(Button,{key:value,onClick:function(){setDay(value);},style:{marginRight:8}},value);}):h('p',null,t('noScore')),
        h('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:20}},
          h('article',null,h('h3',null,t('bfDiary')),text(data.diary),data.diary_notice?h('p',null,data.diary_notice):null),
          h('article',null,h('h3',null,t('tabDreams')),text(data.dream))),
        h('h3',null,t('tabState')),data.state?h('p',null,[data.state.mood,data.state.energy===null?'':data.state.energy+'/100',data.state.sleep,data.state.health,data.state.note].filter(Boolean).join(' · ')):h('p',null,t('bfHistoryEmpty')),
        h('h3',null,t('tabSchedule')),data.schedule&&data.schedule.plan.length?data.schedule.plan.map(function(x,i){return h('p',{key:i},x.time+' '+x.activity);}):h('p',null,t('bfHistoryEmpty')),
        h('h3',null,t('upcoming')),data.countdown.map(function(x){return h('p',{key:x.name},x.name+' · '+t('inDays',{count:x.days_until}));}),
        h('details',null,h('summary',null,t('bfHistoryDates')),data.dates.map(function(x){return h(Button,{key:x,size:'small',style:{margin:4},onClick:function(){setDay(x);}},x);})),
        h('h3',null,t('bfMilestones')),data.milestones.slice().sort(function(a,b){return a.date.localeCompare(b.date);}).map(function(x,i){return h('p',{key:i},x.date+' · '+x.event);}),
        h('h3',null,t('bfFollowup')),h('p',null,t('bfFollowupHint')),
        h(Button,{disabled:busy||!data.diary,onClick:function(){action(function(){return api.followupPreview(agent,day).then(function(value){setFollowup(value.draft);});});}},t('bfDraft')),
        h('label',{style:{display:'block',margin:'12px 0'}},t('bfWhen'),' ',h('input',{type:'datetime-local',value:when,onChange:function(e){setWhen(e.target.value);}})),
        h(TextArea,{'aria-label':t('bfFollowup'),rows:3,maxLength:1500,value:followup,onChange:function(e){setFollowup(e.target.value);}}),
        h(Button,{disabled:busy||!followup.trim()||!data.diary,onClick:function(){action(function(){return api.followup({agent_id:agent,date:day,text:followup,confirmed:true,send_after:when?new Date(when).toISOString():null}).then(function(result){setNotice(result.notice);setFollowup('');});});}},t('bfQueueFollowup'))):null,
      h('hr'),h(Button,{disabled:busy,onClick:function(){action(function(){return api.scorePlan().then(setScore);});}},t('bfScore')),
      score?h('div',null,h('p',null,score.notice),h('p',null,t('bfScoreTotal')+': '+score.proposed+' / 100'),score.parts.map(function(part,i){return h('details',{key:i,open:true},h('summary',null,part.rule+' → +'+part.points),part.evidence.map(function(e,j){return h('p',{key:j},e.date+' '+(e.event||e.name));}));}),
        h(Button,{type:'primary',disabled:busy,onClick:function(){action(function(){return api.scoreApply(score.preview_id).then(function(){setScore(null);setNotice(t('saved'));props.onApplied();});});}},t('bfScoreApply'))):null);
  }

  function MilestonesTab(props) {
    var t=props.t,C=props.C,s=useAsync(api.getRelationship,[]);
    if(s.loading)return h(LoadingBlock,{t:t,C:C});
    if(s.error)return h(ErrorBlock,{t:t,C:C,error:s.error,onRetry:s.retry});
    var records=(s.data.milestones||[]).filter(function(x){return isValidDate(x.date)&&typeof x.event==='string';}).slice().sort(function(a,b){return a.date.localeCompare(b.date);});
    return h('section',{style:panelStyle(C)},h('h2',null,t('bfMilestones')),h('p',null,t('milestoneHint')),
      h(Button,{onClick:function(){props.navigate('organizer');}},t('milestoneExtract')),
      records.length?records.map(function(item,i){return h('article',{key:i,style:{borderLeft:'3px solid '+C.accent,padding:'6px 16px',margin:'20px 0'}},h('strong',null,item.date),h('p',null,item.event));}):h(Empty,{description:t('noMilestones')}));
  }

  function CareTab(props) {
    var t=props.t,C=props.C;
    var as=useState(''),agent=as[0],setAgent=as[1];
    var ds=useState(null),data=ds[0],setData=ds[1];
    var cs=useState(null),cfg=cs[0],setCfg=cs[1];
    var es=useState(''),notice=es[0],setNotice=es[1];
    var bs=useState(false),busy=bs[0],setBusy=bs[1];
    var dirtyState=useState(false),dirty=dirtyState[0],setDirty=dirtyState[1];
    var reviewState=useState(null),review=reviewState[0],setReview=reviewState[1];
    var confirmState=useState(false),confirmed=confirmState[0],setConfirmed=confirmState[1];
    function load(){return api.care(agent).then(function(value){setData(value);setCfg(value.settings);setDirty(false);setConfirmed(false);setReview(null);});}
    useEffect(function(){var alive=true;setCfg(null);setData(null);setNotice('');if(agent)api.care(agent).then(function(value){if(alive){setData(value);setCfg(value.settings);setDirty(false);setConfirmed(false);setReview(null);}}).catch(function(e){if(alive)setNotice(e.message);});return function(){alive=false;};},[agent]);
    useEffect(function(){if(props.suggestion&&cfg){update('anniversary_names',[props.suggestion.name]);update('anniversaries',true);update('anniversary_lead',3);}},[props.suggestion,data&&data.settings.agent_id]);
    function update(key,value){setCfg(function(old){var next=Object.assign({},old);next[key]=value;return next;});setDirty(true);setConfirmed(false);setReview(null);}
    function action(fn){if(busy)return;setBusy(true);setNotice('');Promise.resolve().then(fn).catch(function(e){setNotice(e.message);}).then(function(){setBusy(false);});}
    var switches={model_greeting:'careModel',enabled:'careEnabled',first_seen:'careFirst',sync_enabled:'careSync',morning:'careMorning',notes:'tabNotes',anniversaries:'careDates',inactivity:'careInactive',dream_enabled:'careDream'};
    return h('section',{style:panelStyle(C)},h('h2',null,t('tabCare')),h('p',null,t('careIntro')),
      h(FeatureAgent,{t:t,C:C,value:agent,onChange:setAgent,label:'care agent'}),notice?h('p',{role:'status'},notice):null,
      data&&cfg?h('div',null,h('p',null,data.notice),props.suggestion?h('p',null,props.suggestion.name+' · '+props.suggestion.date+' · '+t('careDateSuggestionHint')):null,!data.scheduler_supported?h('p',null,t('careNoScheduler')):null,
        Object.keys(switches).map(function(key){return h('label',{key:key,style:{display:'block',margin:'12px 0'}},h('input',{type:'checkbox',checked:cfg[key],disabled:busy||(key==='enabled'&&!data.scheduler_supported)||(['first_seen','sync_enabled'].includes(key)&&!data.hooks_supported),onChange:function(e){update(key,e.target.checked);}}),' '+t(switches[key]));}),
        h('label',null,t('careTarget'),h('select',{'aria-label':t('careTarget'),value:JSON.stringify([cfg.channel,cfg.user_id,cfg.session_id]),disabled:busy,style:{display:'block',width:'100%',padding:10},onChange:function(e){var value=JSON.parse(e.target.value);update('channel',value[0]);update('user_id',value[1]);update('session_id',value[2]);}},h('option',{value:JSON.stringify(['console','',''])},t('careSelectTarget')),data.targets.map(function(x,i){return h('option',{key:i,value:JSON.stringify([x.channel,x.user_id,x.session_id])},x.channel+' · '+x.user_id+' · '+x.session_id);}))),
        h('label',{style:{display:'block',margin:'12px 0'}},t('careDateScope'),h('select',{multiple:true,value:cfg.anniversary_names||[],disabled:busy,style:{display:'block',width:'100%',minHeight:80},'aria-label':t('careDateScope'),onChange:function(e){update('anniversary_names',Array.from(e.target.selectedOptions).map(function(o){return o.value;}));}},(data.important_dates||[]).map(function(x){return h('option',{key:x.name,value:x.name},x.name+' · '+x.date);}))),
        ['time','quiet_start','quiet_end'].map(function(key){return h('label',{key:key,style:{display:'block',margin:'12px 0'}},t({time:'careTime',quiet_start:'careQuietStart',quiet_end:'careQuietEnd'}[key])+' ',h('input',{type:'time',value:cfg[key],disabled:busy,'aria-label':key,onChange:function(e){update(key,e.target.value);}}));}),
        ['max_daily','inactivity_days','anniversary_lead'].map(function(key){return h(EditorRow,{key:key,C:C,label:t({max_daily:'careMax',inactivity_days:'careInactiveDays',anniversary_lead:'careLead'}[key])},h(InputNumber,{min:key==='anniversary_lead'?0:key==='inactivity_days'?2:1,max:key==='max_daily'?5:key==='inactivity_days'?90:30,value:cfg[key],onChange:function(v){if(v!==null)update(key,v);},disabled:busy}));}),
        h('p',null,t('careStyleHint')),h(Button,{disabled:busy,onClick:function(){action(function(){return api.stylePreview(agent).then(function(result){update('style',result.style);setNotice(result.notice);});});}},t('careReadStyle')),
        h(TextArea,{'aria-label':t('bfStyle'),rows:4,maxLength:1500,value:cfg.style,disabled:busy,onChange:function(e){update('style',e.target.value);}}),
        cfg.model_greeting?h('details',{open:true},h('summary',null,t('bfOutbound')),h('pre',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:350,overflow:'auto'}},JSON.stringify(review?review.model_plan:data.model_plan,null,2))):null,
        h('p',null,t('carePreview')+': '+cfg.channel+' → '+cfg.user_id+' / '+cfg.session_id+' · '+cfg.time+' · '+t('careQuietStart')+' '+cfg.quiet_start+'–'+cfg.quiet_end),
        h('label',null,h('input',{type:'checkbox',checked:confirmed,disabled:busy||!review,onChange:function(e){setConfirmed(e.target.checked);}}),' '+t('careConsent')),
        h('div',{style:{display:'flex',gap:12,flexWrap:'wrap',margin:'16px 0'}},
          h(Button,{disabled:busy,onClick:function(){action(function(){return api.reviewCare(cfg).then(function(value){setReview(value);setConfirmed(false);});});}},t('careReview')),
          h(Button,{type:'primary',disabled:busy||!confirmed||!review,onClick:function(){action(function(){return api.saveCare(Object.assign({},cfg,{confirmed:true,review_id:review.review_id})).then(function(value){setData(value);setCfg(value.settings);setDirty(false);setConfirmed(false);setReview(null);setNotice(t('saved'));});});}},t('careSave')),
          h(Button,{disabled:busy,onClick:function(){action(load);}},t('refresh')),
          h(Button,{danger:true,disabled:busy,onClick:function(){action(function(){return api.stopCare(agent).then(load);});}},t('careStop')),
          h(Popconfirm,{title:t('careAttemptConfirm'),onConfirm:function(){action(function(){return api.attemptCare(agent).then(function(result){setNotice(result.state);return load();});});}},h(Button,{disabled:busy||dirty||!cfg.enabled},t('careAttempt')))),
        h('h3',null,t('careQueue')),data.memory_changes&&data.memory_changes.length?h('div',null,h('p',null,'Memory: '+data.memory_changes.join(', ')),h(Popconfirm,{title:t('careIgnoreConfirm'),onConfirm:function(){action(function(){return api.dismissSync(agent).then(load);});}},h(Button,{disabled:busy},t('careIgnoreSync')))):null,h('p',null,data.status+' · '+(data.last_prompted_date||'—')+' · '+t('orgRequests')+': '+(data.model_attempts_today||0)),
        data.queue.map(function(item){return h('article',{key:item.id,style:{padding:12,border:C.border,marginBottom:8,borderRadius:8}},h('p',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},item.text),h('p',null,item.state),h(Popconfirm,{title:t('careRetryConfirm'),onConfirm:function(){action(function(){return api.retryCare(agent,item.id).then(load);});}},h(Button,{disabled:busy||item.state==='sending',style:{marginRight:8}},t('careRetry'))),h(Popconfirm,{title:t('careAckConfirm'),onConfirm:function(){action(function(){return api.ackCare(agent,item.id).then(load);});}},h(Button,{disabled:busy},t('careAck'))));})):null);
  }

  function FileBackfillPanel(props) {
    var t=props.t,C=props.C;
    var a=useState({profile:true,memory:true,recent:true,style:false}),flags=a[0],setFlags=a[1];
    var ds=useState(null),draft=ds[0],setDraft=ds[1];
    var ts=useState({}),texts=ts[0],setTexts=ts[1];
    var ps=useState({}),profile=ps[0],setProfile=ps[1];
    var rs=useState(null),review=rs[0],setReview=rs[1];
    var vs=useState(null),preview=vs[0],setPreview=vs[1];
    var bs=useState(false),busy=bs[0],setBusy=bs[1];
    var es=useState(''),error=es[0],setError=es[1];
    var cs=useState(false),confirmed=cs[0],setConfirmed=cs[1];
    var ls=useState(false),localOnly=ls[0],setLocalOnly=ls[1];
    useEffect(function(){setDraft(null);setReview(null);setPreview(null);setConfirmed(false);},[props.agentId,props.dirty]);
    function run(fn){if(busy)return;setBusy(true);setError('');Promise.resolve().then(fn).catch(function(e){setError(e.message);}).then(function(){setBusy(false);});}
    function clear(){setDraft(null);setReview(null);setPreview(null);setConfirmed(false);}
    function read(onlyNames,incremental){setLocalOnly(onlyNames);run(function(){return api.backfillSources(Object.assign({agent_id:props.agentId},onlyNames?{profile:true,memory:false,recent:false,style:false}:flags,{incremental:!!incremental})).then(function(data){
      setDraft(data);setReview(null);setPreview(null);setConfirmed(false);
      var values={},names=Object.assign({},data.current_profile);
      data.documents.forEach(function(doc){values[doc.name]=doc.text;});
      data.candidates.forEach(function(candidate){if(!names[candidate.field])names[candidate.field]=candidate.value;});
      setTexts(values);setProfile(names);
    });});}
    function build(){run(function(){return api.backfillReview({source_id:draft.source_id,texts:texts,profile:profile,modules:localOnly?[]:props.modules}).then(function(data){setReview(data);setPreview(null);setConfirmed(false);});});}
    function generate(){run(function(){return api.backfillPreview({review_id:review.review_id,confirmed:confirmed}).then(function(data){setPreview(data);setReview(null);setConfirmed(false);});});}
    function apply(){run(function(){return api.backfillApply(preview.preview_id).then(function(){clear();setError(t('orgApplied'));props.onApplied();});});}
    function json(value){return h('pre',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:400,overflow:'auto',fontSize:12}},JSON.stringify(value,null,2));}
    return h('details',{style:{margin:'20px 0',border:C.border,borderRadius:12,padding:16}},
      h('summary',{style:{cursor:'pointer',fontWeight:600}},t('bfTitle')),
      h('p',null,t('bfIntro')),h('p',null,t('bfPrivacy')),
      h('p',null,t('bfModules')+': '+((localOnly?[]:props.modules).join(', ')||t('bfNamesOnly'))),
      h('div',{style:{display:'flex',gap:16,flexWrap:'wrap'}},Object.keys(flags).map(function(key){return h('label',{key:key},h('input',{type:'checkbox',checked:flags[key],disabled:busy,onChange:function(e){var next=Object.assign({},flags);next[key]=e.target.checked;setFlags(next);clear();}}),' '+({profile:'PROFILE.md + agent.json / SOUL name',memory:'MEMORY.md',recent:'memory/*.md',style:'SOUL.md ('+t('bfStyle')+')'})[key]);})),
      h(Button,{style:{margin:'12px 12px 0 0'},disabled:busy||props.dirty||!props.agentId,onClick:function(){read(true);}},t('bfInferNames')),
      h(Button,{style:{marginTop:12},disabled:busy||props.dirty||!props.agentId,onClick:function(){read(false);}},t('bfRead')),
      h(Button,{style:{margin:'12px 0 0 12px'},disabled:busy||props.dirty||!props.agentId,onClick:function(){read(false,true);}},t('bfReadDelta')),
      error?h('p',{role:'status',style:{whiteSpace:'pre-wrap'}},error):null,
      draft?h('div',null,
        h('p',null,t('bfCandidateHint')),
        draft.candidates.map(function(item){return h('p',{key:item.field},item.field+': '+item.value+' ← '+item.source);}),
        ['user_name','companion_name'].map(function(key){return h(EditorRow,{key:key,label:t(key==='user_name'?'setupUser':'setupCompanion'),C:C},h(Input,{'aria-label':'backfill '+key,value:profile[key]||'',maxLength:80,disabled:busy,onChange:function(e){var next=Object.assign({},profile);next[key]=e.target.value;setProfile(next);setReview(null);setPreview(null);}}));}),
        draft.notices.map(function(item,i){return h('p',{key:i},item.file+': '+item.message);}),
        draft.documents.map(function(doc){return h('details',{key:doc.name,open:true,style:{marginTop:12}},
          h('summary',null,doc.name+' · '+doc.role+' · '+texts[doc.name].length+'/'+doc.budget+(doc.truncated?' · '+t('bfTruncated'):'')),
          h(TextArea,{'aria-label':'backfill '+doc.name,rows:5,maxLength:doc.budget,value:texts[doc.name],disabled:busy,onChange:function(e){var next=Object.assign({},texts);next[doc.name]=e.target.value;setTexts(next);setReview(null);setPreview(null);}}));}),
        h(Button,{disabled:busy,onClick:build,style:{marginTop:12}},t('bfReview'))):null,
      review?h('section',null,h('h3',null,t('bfOutbound')),h('p',null,t('bfFrozen')),
        h('p',null,t('bfProfileLocal')),json(review.profile),
        review.requests.map(function(req){return h('article',{key:req.module},h('h4',null,req.module+' → '+req.endpoint),json(req));}),
        !review.requests.length?h('p',null,t('bfNamesOnly')):null,
        h('label',null,h('input',{type:'checkbox',checked:confirmed,disabled:busy,onChange:function(e){setConfirmed(e.target.checked);}}),' '+t('bfConsent')),
        h('div',{style:{marginTop:12}},h(Button,{type:'primary',loading:busy,disabled:busy||!confirmed,onClick:generate},t(review.requests.length?'bfSend':'bfLocalPreview')))):null,
      preview?h('section',null,h('h3',null,t('orgPreviewHint')),json(preview.changes),h('p',null,t('orgUsage')),json(preview.usage),
        h(Button,{type:'primary',disabled:busy,onClick:apply},t(Object.keys(preview.changes).length?'orgApply':'bfAcceptNoChanges'))):null,
      draft?h(Button,{disabled:busy,onClick:clear,style:{margin:'12px 0 0 12px'}},t('orgDiscard')):null);
  }

  function OrganizerTab(props) {
    var t=props.t, C=props.C;
    var s=useAsync(function(){return Promise.all([api.organizerConfig(),api.agents()]);},[]);
    var f=useState(null),form=f[0],setForm=f[1];
    var d=useState(false),dirty=d[0],setDirty=d[1];
    var b=useState(false),busy=b[0],setBusy=b[1];
    var cs=useState([]),chats=cs[0],setChats=cs[1];
    var ci=useState(""),chat=ci[0],setChat=ci[1];
    var ps=useState(null),preview=ps[0],setPreview=ps[1];
    var ns=useState(""),notice=ns[0],setNotice=ns[1];
    useEffect(function(){if(s.data){setForm(s.data[0].config);setDirty(false);}},[s.data]);
    var agentId=form ? form.agent_id : "";
    useEffect(function(){
      var alive=true;setChats([]);setChat("");
      if(agentId) api.organizerChats(agentId).then(function(data){if(alive)setChats(data.chats);})
        .catch(function(error){if(alive)setNotice(error.message);});
      return function(){alive=false;};
    },[agentId]);
    function update(key,value,module){
      setForm(function(old){var next=Object.assign({},old);if(module){next.modules=Object.assign({},old.modules);next.modules[module]=Object.assign({},old.modules[module]);next.modules[module][key]=value;}else next[key]=value;return next;});
      setDirty(true);setPreview(null);
    }
    function run(action){if(busy)return;setBusy(true);setNotice("");action().catch(function(error){setNotice(error.message);}).then(function(){setBusy(false);});}
    function save(){run(function(){return api.saveOrganizer(form).then(function(data){setForm(data.config);setDirty(false);setPreview(null);setNotice(t("orgSaved"));});});}
    function generate(){setPreview(null);run(function(){return api.organizerPreview(agentId,chat).then(setPreview);});}
    function apply(){run(function(){return api.organizerApply(preview.preview_id).then(function(){setPreview(null);setNotice(t("orgApplied"));if(props.onApplied)props.onApplied();});});}
    function field(label,child){return h("div",{style:{marginBottom:14}},h(EditorRow,{label:label,C:C},child));}
    function provider(value,module){return h("div",{},
      field(t("orgBase"),h(Input,{"aria-label":t("orgBase")+" "+(module||"default"),value:value.base_url,disabled:busy,onChange:function(e){update("base_url",e.target.value,module);}})),
      field(t("orgModel"),h(Input,{"aria-label":t("orgModel")+" "+(module||"default"),value:value.model,disabled:busy,onChange:function(e){update("model",e.target.value,module);}})),
      field(t("orgKey"),h(Input,{"aria-label":t("orgKey")+" "+(module||"default"),type:"password",autoComplete:"new-password",value:value.api_key,disabled:busy,onChange:function(e){update("api_key",e.target.value,module);}})),
      h("p",{style:{color:C.sub}},t(value.api_key_configured?"orgKeySaved":"orgKeyEmpty")),
      value.api_key_configured ? field(t("orgKeyClear"),h(Switch,{checked:!!value.clear_api_key,disabled:busy,onChange:function(v){update("clear_api_key",v,module);}})) : null);
    }
    function number(label,key,min,max){return field(t(label),h(InputNumber,{min:min,max:max,value:form[key],disabled:busy,onChange:function(value){if(value!==null)update(key,value);}}));}
    var labels={state:"tabState",schedule:"tabSchedule",dreams:"tabDreams",notes:"tabNotes",relationship:"tabRelationship",dates:"tabDates"};
    var selectStyle={width:"100%",padding:10,borderRadius:8,background:C.cardBg,color:C.text,border:"1px solid #aaa"};
    if(s.loading || !form && !s.error)return h(LoadingBlock,{t:t,C:C});
    if(s.error)return h(ErrorBlock,{t:t,C:C,error:s.error,onRetry:s.retry});
    var meta=s.data[0], agents=s.data[1].agents || [];
    return h("section",{style:panelStyle(C)},
      h(Toolbar,{left:h("strong",null,t("tabOrganizer")),right:h(Button,{disabled:busy,onClick:s.retry},t("orgRefresh"))}),
      h(SectionIntro,{C:C},t("orgIntro")),
      notice?h("p",{role:"status",style:{color:C.accent,whiteSpace:"pre-wrap"}},notice):null,
      provider(form),
      field(t("orgAgent"),h("select",{value:agentId,disabled:busy,style:selectStyle,"aria-label":t("orgAgent"),onChange:function(e){update("agent_id",e.target.value);}},
        h("option",{value:""},t("orgChooseAgent")),agents.filter(function(a){return a.enabled_tools && a.enabled_tools.length && a.agent_enabled!==false;}).map(function(a){return h("option",{key:a.id,value:a.id},a.name+" ("+a.id+")");}))),
      h(Button,{disabled:busy||!agentId,onClick:function(){run(function(){return api.discoverModel(agentId).then(function(data){if(!data.available){setNotice(data.reason);return;}update('base_url',data.base_url);update('model',data.model);update('api_key','');update('clear_api_key',true);setNotice(data.hint);});});}},t('discoverHost')),
      field(t("orgChat"),h("select",{value:chat,disabled:busy,style:selectStyle,"aria-label":t("orgChat"),onChange:function(e){setChat(e.target.value);setPreview(null);}},
        h("option",{value:""},t("orgChooseChat")),chats.map(function(item){return h("option",{key:item.id,value:item.id},item.name+" · "+item.updated_at);}))),
      h(FileBackfillPanel,{t:t,C:C,agentId:agentId,dirty:dirty,modules:['relationship','dates'].filter(function(key){return form.modules[key].enabled;}),onApplied:function(){s.retry();if(props.onApplied)props.onApplied();}}),
      number("orgMessages","recent_messages",2,200),number("orgChars","max_context_chars",1000,64000),number("orgTokens","max_output_tokens",128,4096),
      field(t("orgAuto"),h(Switch,{checked:form.auto_enabled,disabled:busy||!meta.auto_supported,onChange:function(v){update("auto_enabled",v);}})),
      h("p",{style:{color:C.sub,lineHeight:1.8}},t("orgAutoHint")),
      !meta.auto_supported?h("p",null,t("orgNoAuto")):null,
      number("orgInterval","interval_minutes",5,1440),
      h("p",{style:{color:C.sub}},t("orgShared")),
      Object.keys(labels).map(function(key){var module=form.modules[key];return h("details",{key:key,style:{border:C.border,padding:16,borderRadius:12,marginBottom:12}},
        h("summary",{style:{cursor:"pointer",fontWeight:600}},t(labels[key])+" · "+(module.model || t("orgUseShared"))),
        h("div",{style:{paddingTop:16}},field(t("orgEnabled"),h(Switch,{checked:module.enabled,disabled:busy,onChange:function(v){update("enabled",v,key);}})),
          h("p",{style:{color:C.sub}},t("orgInherit")),provider(module,key),
          field(t("orgPrompt"),h(TextArea,{rows:4,value:module.prompt,disabled:busy,onChange:function(e){update("prompt",e.target.value,key);}})),
          h("details",{},h("summary",{style:{cursor:"pointer"}},t("orgSchema")),h("pre",{style:{maxHeight:300,overflow:"auto",whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:12}},JSON.stringify(meta.definitions[key],null,2)))));}),
      dirty?h("p",null,t("orgDirty")):null,
      h("div",{style:{display:"flex",gap:10,flexWrap:"wrap",marginTop:20}},
        h(Button,{type:"primary",disabled:busy,onClick:save},t("orgSave")),
        h(Button,{loading:busy,disabled:busy||dirty||!agentId||!chat,onClick:generate},t("orgPreview"))),
      preview?h("div",{style:{marginTop:24}},
        h("p",null,t("orgRead")+": "+preview.message_count+" · "+t("orgRequests")+": "+preview.requests),
        h("p",null,t("orgPreviewHint")),
        Object.keys(preview.changes).length?Object.keys(preview.changes).map(function(key){return h("details",{key:key,open:true,style:{marginBottom:16}},h("summary",null,t(labels[key])),
          h("strong",null,t("orgBefore")),h("pre",{style:{whiteSpace:"pre-wrap",overflowWrap:"anywhere",maxHeight:250,overflow:"auto"}},JSON.stringify(preview.changes[key].before,null,2)),
          h("strong",null,t("orgAfter")),h("pre",{style:{whiteSpace:"pre-wrap",overflowWrap:"anywhere",maxHeight:250,overflow:"auto"}},JSON.stringify(preview.changes[key].after,null,2)));}):h("p",null,t("orgNoChanges")),
        h("p",null,t("orgUsage")),h("pre",{style:{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}},JSON.stringify(preview.usage,null,2)),
        h("div",{style:{display:"flex",gap:10,flexWrap:"wrap"}},
          h(Button,{type:"primary",disabled:busy||!Object.keys(preview.changes).length,onClick:apply},t("orgApply")),
          h(Button,{disabled:busy,onClick:function(){setPreview(null);}},t("orgDiscard")))):null,
      h("details",{style:{marginTop:24}},h("summary",null,t("orgStatus")),h("pre",{style:{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}},JSON.stringify(meta.status,null,2))));
  }

  function AgentsTab(props) {
    var t = props.t, C = props.C;
    var s = useAsync(api.agents, []);
    var busyState = useState(false), busy = busyState[0], setBusy = busyState[1];
    var noticeState = useState(""), notice = noticeState[0], setNotice = noticeState[1];
    function bind(id, enabled) {
      if (busy) return;
      setBusy(true);
      api.bindAgent(id, enabled).then(function (result) {
        setNotice(result.message || t("agentSaved"));
        s.retry();
      }).catch(function (error) { message.error(error.message); })
        .then(function () { setBusy(false); });
    }
    var data = s.data;
    return h("section", {style:panelStyle(C)},
      h(Toolbar, {left:h("strong",null,t("tabAgents")),right:h(Button,{onClick:s.retry,disabled:busy},t("agentRefresh"))}),
      h(SectionIntro,{C:C},t("agentsHint")),
      notice ? h("p",{role:"status",style:{color:C.sub}},notice) : null,
      s.loading ? h(LoadingBlock,{t:t,C:C}) : s.error ? h(ErrorBlock,{t:t,C:C,error:s.error,onRetry:s.retry}) : null,
      data && !data.supported ? h("p",{role:"status"},data.reason || t("agentNoSdk")) : null,
      data && data.supported && !data.agents.length ? h("p",null,t("agentEmpty")) : null,
      data && data.supported ? data.agents.map(function (agent) {
        var labels = {bound:"agentBound", partial:"agentPartial", unbound:"agentUnbound", unknown:"agentUnknown"};
        return h("article",{key:agent.id,style:{border:C.border,borderRadius:12,padding:16,marginBottom:14}},
          h("h3",{style:{marginTop:0}},agent.name," ",h(Tag,{color:agent.binding === "bound" ? "green" : "default"},t(labels[agent.binding] || "agentUnknown"))),
          h("p",{style:{color:C.sub,overflowWrap:"anywhere"}},agent.id),
          agent.error ? h("p",{role:"alert"},agent.error) : h("p",null,t("agentTools") + ": " + agent.enabled_tools.length + "/" + agent.total_tools),
          agent.agent_enabled === false ? h("p",null,t("agentDisabled")) : null,
          h("p",{style:{overflowWrap:"anywhere"}},agent.last_call
            ? t("agentLastCall") + ": " + agent.last_call.tool + " · " + t(agent.last_call.status === "success" ? "agentSuccess" : "agentError") + " · " + agent.last_call.at
            : t("agentNoCalls")),
          h("div",{style:{display:"flex",flexWrap:"wrap",gap:8}},
            h(Button,{type:"primary",disabled:busy || !!agent.error || agent.agent_enabled === false || agent.binding === "bound",onClick:function(){bind(agent.id,true);}},t("agentBind")),
            h(Button,{disabled:busy || !!agent.error || agent.binding === "unbound",onClick:function(){bind(agent.id,false);}},t("agentUnbind"))));
      }) : null,
      h("p",{style:{color:C.sub,lineHeight:1.8}},t("agentTest")));
  }

  function DataTab(props) {
    var t = props.t, C = props.C;
    var s = useAsync(api.health, []);
    var _b = useState(false), exporting = _b[0], setExporting = _b[1];
    var _i = useState(false), importing = _i[0], setImporting = _i[1];
    var fileRef = React.useRef(null);
    var healthData = s.data;

    function doExport() {
      if (exporting) return;
      setExporting(true);
      api.exportAll()
        .then(function (data) {
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url;
          a.download = "companion-core-backup-" + localToday() + ".json";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          message.success(t("exportSuccess"));
        })
        .catch(function (e) { message.error(t("loadFailed", { error: e.message })); })
        .then(function () { setExporting(false); });
    }

    function doImport(file) {
      setImporting(true);
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var data = JSON.parse(ev.target.result);
          api.importAll(data)
            .then(function (res) {
              var fields = (res && res.imported) ? res.imported.join(", ") : "";
              message.success(t("importSuccess", { fields: fields }));
              s.retry();
              if (props.onImport) props.onImport();
            })
            .catch(function (e) { message.error(t("importFailed", { error: e.message })); })
            .then(function () { setImporting(false); });
        } catch (err) {
          message.error(t("importFailed", { error: err.message }));
          setImporting(false);
        }
      };
      reader.onerror = function () {
        message.error(t("importFailed", { error: "read error" }));
        setImporting(false);
      };
      reader.readAsText(file);
    }

    function onFileChange(e) {
      var files = e.target.files;
      if (files && files[0]) {
        doImport(files[0]);
        e.target.value = "";
      }
    }

    var busy = exporting || importing;

    // 这里不整页拦截：后端不通时导出/导入按钮仍需可用，只把故障显式标出来。
    var banner = healthData
      ? h("div", { style: { display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 } },
          h(Tag, { color: "green" }, t("healthStatus") + ": " + (healthData.status || "ok")),
          h(Tag, {}, t("healthDreams") + ": " + (healthData.dreams_count || 0)),
          h(Tag, {}, t("healthNotes") + ": " + (healthData.notes_count || 0)),
          h("span", { style: { color: C.muted, fontSize: 12, lineHeight: "22px" } }, healthData.data_dir || "")
        )
      : s.error
        ? h("div", { style: { display: "flex", gap: 10, alignItems: "center", marginBottom: 16 } },
            h(Tag, { color: "red" }, t("loadError") + ": " + (s.error.message || String(s.error))),
            h(Button, { size: "small", onClick: s.retry }, t("retry")))
        : null;

    return h("div", {},
      h("div", { style: panelStyle(C) },
        h("div", { style: { fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 12 } }, t("tabData")),
        banner,
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 16 } },
          h("div", { style: { padding: 16, borderRadius: 8, border: C.border } },
            h("div", { style: { fontWeight: 500, color: C.text, marginBottom: 6 } }, t("exportData")),
            h("div", { style: { color: C.sub, fontSize: 13, marginBottom: 12 } }, t("exportDesc")),
            h(Button, { type: "primary", onClick: doExport, loading: exporting, disabled: busy }, t("exportData"))),
          h("div", { style: { padding: 16, borderRadius: 8, border: C.border } },
            h("div", { style: { fontWeight: 500, color: C.text, marginBottom: 6 } }, t("importData")),
            h("div", { style: { color: C.sub, fontSize: 13, marginBottom: 12 } }, t("importDesc")),
            h("input", { ref: fileRef, type: "file", accept: ".json", style: { display: "none" }, onChange: onFileChange }),
            h(Popconfirm, {
              title: t("importConfirm"),
              onConfirm: function () { if (fileRef.current) fileRef.current.click(); },
            }, h(Button, { danger: true, loading: importing, disabled: busy }, t("importData")))))));
  }

  // ── Root ─────────────────────────────────────────────────────────────

  var APP_CSS = `
.cc-app{max-width:1240px;margin:0 auto;padding:28px clamp(12px,3vw,36px) 48px;color:var(--cc-text);background:var(--cc-bg);min-height:100%;font-family:inherit}
.cc-app *{box-sizing:border-box}.cc-hero{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:32px;border:1px solid rgba(236,72,153,.12);border-radius:24px;background:linear-gradient(115deg,rgba(236,72,153,.09),rgba(251,191,36,.06));margin-bottom:24px;position:relative;overflow:hidden}
.cc-eyebrow{font-size:11px;letter-spacing:.12em;color:var(--cc-sub);font-weight:600}.cc-hero h1{margin:12px 0 8px;font-size:30px;letter-spacing:-.04em;line-height:1.3}.cc-version{font-size:11px;letter-spacing:0;font-weight:400;color:var(--cc-sub);margin-left:12px}.cc-hero p{margin:0;color:var(--cc-sub);font-size:14px}.cc-today{text-align:right;max-width:260px}.cc-today>span{display:block;font-variant-numeric:tabular-nums;font-size:22px;font-weight:600}.cc-today small{display:block;margin-top:8px;color:var(--cc-sub);line-height:1.7}
.cc-tabs>.ant-tabs-nav{margin-bottom:24px}.cc-tabs .ant-tabs-tab{padding:12px 4px;font-size:14px}.cc-tabs .ant-tabs-ink-bar{background:var(--cc-accent)}.cc-tabs .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn{color:var(--cc-accent)}
.cc-tabs>.qwenpaw-tabs-nav{margin-bottom:24px}.cc-tabs .qwenpaw-tabs-tab{padding:12px 4px;font-size:14px}.cc-tabs .qwenpaw-tabs-ink-bar{background:var(--cc-accent)}.cc-tabs .qwenpaw-tabs-tab.qwenpaw-tabs-tab-active .qwenpaw-tabs-tab-btn{color:var(--cc-accent)}
.cc-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:20px}.cc-metric{text-align:left;display:flex;flex-direction:column;position:relative;gap:12px;padding:22px 20px;background:var(--cc-card);color:var(--cc-text);border:1px solid rgba(127,127,127,.14);border-radius:18px;cursor:pointer;min-width:0;font:inherit;transition:transform .18s,border-color .18s}.cc-metric:hover{transform:translateY(-3px);border-color:var(--cc-accent)}.cc-metric:focus-visible{outline:2px solid var(--cc-accent);outline-offset:3px}.cc-metric strong{font-size:25px;font-weight:600;line-height:1.4;overflow-wrap:anywhere}.cc-metric-icon{position:absolute;right:18px;top:16px;font-size:22px;color:var(--cc-accent)}.cc-metric .cc-eyebrow{padding-right:22px;letter-spacing:0}.cc-metric-detail{font-size:12px;color:var(--cc-sub);line-height:1.6;overflow-wrap:anywhere}.cc-overview-grid{display:grid;grid-template-columns:1.15fr 1fr;gap:20px}.cc-timeline-row{display:flex;gap:20px;padding:15px 0;border-bottom:1px solid rgba(127,127,127,.1);overflow-wrap:anywhere}.cc-timeline-row time{font-variant-numeric:tabular-nums;color:var(--cc-accent);font-weight:600;flex-shrink:0}.cc-date-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid rgba(127,127,127,.1)}.cc-date-row small{display:block;color:var(--cc-sub);margin-top:5px}.cc-note-preview{padding:14px 16px;background:rgba(236,72,153,.04);border-left:3px solid var(--cc-accent);border-radius:4px 10px 10px 4px;margin:10px 0;white-space:pre-wrap;overflow-wrap:anywhere}.cc-search-row{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}.cc-app .ant-btn{border-radius:8px}.cc-app .ant-input,.cc-app .ant-input-affix-wrapper{border-radius:8px}.cc-app section{min-width:0}.cc-app .ant-tabs-content-holder{min-width:0}
@media(max-width:760px){.cc-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.cc-overview-grid{grid-template-columns:1fr}.cc-hero{padding:24px}.cc-today{display:none}.cc-hero h1{font-size:26px}.cc-app{padding-top:16px}.cc-app .ant-space{flex-wrap:wrap}.cc-app .ant-tabs-tab+.ant-tabs-tab{margin-left:20px}}
.cc-tabs>.ant-tabs-nav .ant-tabs-nav-wrap{overflow:visible}.cc-tabs>.ant-tabs-nav .ant-tabs-nav-list{transform:none!important;flex-wrap:wrap;gap:4px 6px;width:100%}.cc-tabs>.ant-tabs-nav .ant-tabs-tab{margin:0!important;padding:8px 10px;border-radius:8px;font-size:13px}.cc-tabs>.ant-tabs-nav .ant-tabs-tab-active{background:rgba(236,72,153,.08)}.cc-tabs>.ant-tabs-nav .ant-tabs-nav-operations,.cc-tabs>.ant-tabs-nav .ant-tabs-ink-bar{display:none}.cc-tabs>.ant-tabs-nav .ant-tabs-nav-wrap:before,.cc-tabs>.ant-tabs-nav .ant-tabs-nav-wrap:after{display:none}
.cc-tabs>.qwenpaw-tabs-nav .qwenpaw-tabs-nav-wrap{overflow:visible}.cc-tabs>.qwenpaw-tabs-nav .qwenpaw-tabs-nav-list{transform:none!important;flex-wrap:wrap;gap:4px 6px;width:100%}.cc-tabs>.qwenpaw-tabs-nav .qwenpaw-tabs-tab{margin:0!important;padding:8px 10px;border-radius:8px;font-size:13px}.cc-tabs>.qwenpaw-tabs-nav .qwenpaw-tabs-tab-active{background:rgba(236,72,153,.08)}.cc-tabs>.qwenpaw-tabs-nav .qwenpaw-tabs-nav-operations,.cc-tabs>.qwenpaw-tabs-nav .qwenpaw-tabs-ink-bar{display:none}.cc-tabs>.qwenpaw-tabs-nav .qwenpaw-tabs-nav-wrap:before,.cc-tabs>.qwenpaw-tabs-nav .qwenpaw-tabs-nav-wrap:after{display:none}
@media(max-width:420px){.cc-metric{padding:16px 12px}.cc-metric strong{font-size:21px}.cc-metric-icon{right:12px;top:12px}.cc-hero{padding:20px}.cc-hero h1{font-size:24px}}
@media(prefers-reduced-motion:reduce){.cc-metric{transition:none}}
.cc-project-links{display:flex;flex-wrap:wrap;align-items:center;gap:12px}.cc-today .cc-project-links{justify-content:flex-end}.cc-project-link{color:var(--cc-accent);text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}.cc-project-link:focus-visible{outline:2px solid var(--cc-accent);outline-offset:4px}.cc-about{padding:24px;background:var(--cc-card);border-radius:16px;line-height:1.8;color:var(--cc-text)}.cc-about h2{margin-top:0}.cc-credit{font-weight:600}.cc-about nav{margin:20px 0}
`;
  var APP_VERSION = "";

  function ProjectLink(props) {
    return h("a", {href:props.href, target:"_blank", rel:"noopener noreferrer", className:"cc-project-link"}, props.label);
  }

  function AboutTab(props) {
    var t=props.t;
    return h("section", {className:"cc-about"},
      h("h2",null,t("appTitle")),
      h("p",{className:"cc-credit"},t("aboutCredit")),
      h("p",null,t("aboutIntro")),
      h("p",null,t("aboutVersion")+": "+(props.version ? "v"+props.version : "—")),
      h("nav",{"aria-label":t("tabAbout"),className:"cc-project-links"},
        h(ProjectLink,{href:PROJECT_URL,label:t("aboutRepo")}),
        h(ProjectLink,{href:PROJECT_URL+"/releases",label:t("aboutReleases")}),
        h(ProjectLink,{href:PROJECT_URL+"/issues",label:t("aboutIssues")}),
        h(ProjectLink,{href:PROJECT_URL+"/blob/main/LICENSE",label:t("aboutLicense")})),
      h("p",null,t("aboutThanks")),
      h(ProjectLink,{href:"https://github.com/menglimi/astrbot_plugin_private_companion",label:"astrbot_plugin_private_companion"}));
  }

  function CompanionApp() {
    var careSuggestionState=useState(null),careSuggestion=careSuggestionState[0],setCareSuggestion=careSuggestionState[1];
    var _tab = useState("overview"), activeTab = _tab[0], setActiveTab = _tab[1];
    function navigate(key) { setActiveTab(key); }
    // 导航偏好全部由用户自选并持久化：collapsed=是否收起；hidden=用户选择收进「更多」的页签。
    var NAV_COLLAPSED_KEY = "cc-nav-collapsed";
    var NAV_HIDDEN_KEY = "cc-nav-hidden";
    var navInit = { collapsed: false, hidden: [] };
    try {
      if (typeof localStorage !== "undefined") {
        navInit.collapsed = localStorage.getItem(NAV_COLLAPSED_KEY) === "1";
        navInit.hidden = JSON.parse(localStorage.getItem(NAV_HIDDEN_KEY) || "[]");
        if (!Array.isArray(navInit.hidden)) navInit.hidden = [];
      }
    } catch (e) { navInit = { collapsed: false, hidden: [] }; }
    var _nav = useState(navInit.collapsed), navCollapsed = _nav[0], setNavCollapsed = _nav[1];
    var _hid = useState(navInit.hidden), hiddenTabs = _hid[0], setHiddenTabs = _hid[1];
    var _cust = useState(false), custOpen = _cust[0], setCustOpen = _cust[1];
    var _draft = useState([]), draftHidden = _draft[0], setDraftHidden = _draft[1];
    function toggleNav() {
      var next = !navCollapsed;
      setNavCollapsed(next);
      try { localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0"); } catch (e) { /* ignore */ }
    }
    function openCustomize() { setDraftHidden(hiddenTabs.slice()); setCustOpen(true); }
    function saveCustomize() {
      var next = Array.isArray(draftHidden) ? draftHidden : [];
      setHiddenTabs(next);
      try { localStorage.setItem(NAV_HIDDEN_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
      setCustOpen(false);
    }
    var NAV_KEYS = [["overview","tabOverview"],["state","tabState"],["schedule","tabSchedule"],["dreams","tabDreams"],
      ["notes","tabNotes"],["diary","tabDiary"],["relationship","tabRelationship"],["dates","tabDates"],["organizer","tabOrganizer"],
      ["agents","tabAgents"],["data","tabData"],["timeline","tabTimeline"],["milestones","bfMilestones"],
      ["care","tabCare"],["checkup","tabCheckup"],["about","tabAbout"]];
    function navLabel(key) {
      for (var i = 0; i < NAV_KEYS.length; i++) if (NAV_KEYS[i][0] === key) return t(NAV_KEYS[i][1]);
      return key;
    }
    var _rev = useState(0), revision = _rev[0], setRevision = _rev[1];
    var setupState=useState(null),setupData=setupState[0],setSetupData=setupState[1];
    var setupOpenState=useState(false),setupOpen=setupOpenState[0],setSetupOpen=setupOpenState[1];
    var versionState = useState(APP_VERSION), version = versionState[0], setVersion = versionState[1];
    useEffect(function () {
      var active = true;
      api.setup().then(function(data){if(active){setSetupData(data);setSetupOpen(!data.completed);}})
        .catch(function(error){console.warn("[companion-core] setup failed",error);});
      api.health().then(function (data) {
        APP_VERSION = data.version || "";
        if (active) setVersion(APP_VERSION);
      }).catch(function (error) { console.warn("[companion-core] health failed", error); });
      return function () { active = false; };
    }, []);
    var locale = normalizeLocale(useHostLocale());
    var themeInfo = useHostTheme();
    var isDark = !!(themeInfo && themeInfo.isDark);
    var C = getThemeColors(isDark);

    function t(key, values) { return tr(locale, key, values); }

    return h("div", {className:"cc-app", "data-theme":isDark ? "dark" : "light", style:{"--cc-text":C.text,"--cc-sub":C.sub,"--cc-card":C.cardBg,"--cc-bg":C.pageBg,"--cc-accent":C.accent}},
      h("style",null,APP_CSS),
      setupOpen?h(SetupWizard,{t:t,C:C,setup:setupData,onDone:function(data){setSetupData(data);setSetupOpen(false);setRevision(function(v){return v+1;});}}):null,
      h("header",{className:"cc-hero"},
        h("div",{className:"cc-hero-copy"}, h("div",{className:"cc-eyebrow"},"♡  " + t("todayLabel")),
          h("h1",null,t("appTitle"),h("span",{className:"cc-version"},version ? "v"+version : "")),
          h("p",null,setupData && setupData.profile && (setupData.profile.user_name || setupData.profile.companion_name)?[setupData.profile.companion_name,setupData.profile.user_name].filter(Boolean).join(" · "):t("welcome"))),
        h("div",{className:"cc-today"},h("span",null,localToday()),h("small",null,t("overviewHint")),h("div",{className:"cc-project-links",style:{marginTop:12}},
          h(Button,{type:"primary",size:"small",onClick:function(){setSetupOpen(true);}},t("quickSetup")),
          h(Button,{size:"small",onClick:toggleNav,"aria-pressed":navCollapsed},navCollapsed?t("navExpand"):t("navCollapse")),
          h(Button,{size:"small",onClick:openCustomize},t("navCustomize")),
          h(Button,{size:"small",onClick:function(){if(typeof window!=="undefined"&&window.open)window.open(PROJECT_URL,"_blank");}},"⭐ "+t("supportAuthor")),
          Dropdown?h(Dropdown,{menu:{items:[
            {key:"gh",label:t("feedbackGitHub"),onClick:function(){if(typeof window!=="undefined"&&window.open)window.open(PROJECT_URL+"/issues","_blank");}},
            {key:"platform",label:t("feedbackPlatform"),onClick:function(){if(typeof window!=="undefined"&&window.open)window.open(FEEDBACK_PLATFORM_URL,"_blank");}}
          ]}},h(Button,{size:"small"},"🐞 "+t("feedback"))):null,
          (navCollapsed&&hiddenTabs.length&&Dropdown)?h(Dropdown,{menu:{items:
            hiddenTabs.map(function(k){return {key:k,label:navLabel(k),onClick:function(){navigate(k);}};})
              .concat([{type:"divider"},
                {key:"setup",label:t("setupOpen"),onClick:function(){setSetupOpen(true);}},
                {key:"github",label:"GitHub",onClick:function(){if(typeof window!=="undefined"&&window.open)window.open(PROJECT_URL,"_blank");}}])
          }},h(Button,{size:"small"},"⋯ "+t("navMore"))):null))),
      h(Tabs, {
        className: "cc-tabs", activeKey:activeTab, onChange:setActiveTab,
        destroyInactiveTabPane:true,
        items: [
          {key:"overview",label:"◈ " + t("tabOverview"),children:h(OverviewTab,{key:revision,t:t,C:C,navigate:setActiveTab})},
          { key: "state", label: "🌤 " + t("tabState"), children: h(StateTab, { key:revision, t: t, C: C }) },
          { key: "schedule", label: "📅 " + t("tabSchedule"), children: h(ScheduleTab, { key:revision, t: t, C: C }) },
          { key: "dreams", label: "💭 " + t("tabDreams"), children: h(DreamsTab, { key:revision, t: t, C: C }) },
          { key: "diary", label: "📔 " + t("tabDiary"), children: h(DiaryTab, { t: t, C: C }) },
          { key: "notes", label: "📝 " + t("tabNotes"), children: h(NotesTab, { key:revision, t: t, C: C }) },
          { key: "relationship", label: "💕 " + t("tabRelationship"), children: h(RelationshipTab, { key:revision, t: t, C: C }) },
          { key: "dates", label: "🎂 " + t("tabDates"), children: h(DatesTab, { key:revision, t: t, C: C, onCare:function(item){setCareSuggestion(item);setActiveTab("care");} }) },
          { key: "organizer", label: "✨ " + t("tabOrganizer"), children: h(OrganizerTab, { t:t, C:C, onApplied:function(){setRevision(function(v){return v+1;});api.setup().then(setSetupData).catch(function(error){console.warn("[companion-core] setup refresh failed",error);});} }) },
          { key: "agents", label: "🤖 " + t("tabAgents"), children: h(AgentsTab, { t:t, C:C }) },
          { key: "data", label: "💾 " + t("tabData"), children: h(DataTab, { t:t, C:C, onImport:function(){setRevision(function(v){return v+1;});} }) },
          {key:'timeline',label:'📖 '+t('tabTimeline'),children:h(TimelineTab,{t:t,C:C,revision:revision,onApplied:function(){setRevision(function(v){return v+1;});}})},
          {key:'milestones',label:'💕 '+t('bfMilestones'),children:h(MilestonesTab,{t:t,C:C,navigate:setActiveTab})},
          {key:'care',label:'📣 '+t('tabCare'),children:h(CareTab,{t:t,C:C,suggestion:careSuggestion})},
          {key:'checkup',label:'🩺 '+t('tabCheckup'),children:h(CheckupTab,{t:t,C:C,navigate:setActiveTab})},
          { key:"about", label:"ⓘ " + t("tabAbout"), children:h(AboutTab,{t:t,version:version}) },
        ].filter(function(it){return !navCollapsed||hiddenTabs.indexOf(it.key)<0||it.key===activeTab;}),
      }),
      h(Modal,{open:custOpen,title:t("navCustomize"),okText:t("save"),cancelText:t("cancel"),
        onOk:saveCustomize,onCancel:function(){setCustOpen(false);}},
        h("div",{style:{display:"flex",flexDirection:"column",gap:10,paddingTop:4}},
          h("p",{style:{color:C.sub,margin:0,fontSize:12}},t("navCustomizeHint")),
          NAV_KEYS.map(function(pair){
            var key=pair[0];
            var isHidden=(draftHidden||[]).indexOf(key)>=0;
            return h("label",{key:key,style:{display:"flex",alignItems:"center",gap:8,color:C.text,fontSize:13}},
              h("input",{type:"checkbox",checked:!isHidden,onChange:function(ev){
                var next=(draftHidden||[]).slice();
                var idx=next.indexOf(key);
                if(ev.target.checked&&idx>=0)next.splice(idx,1);
                if(!ev.target.checked&&idx<0)next.push(key);
                setDraftHidden(next);
              }}),
              navLabel(key));
          })))
      );
  }

  // ── Self-register ────────────────────────────────────────────────────

  if (QwenPaw.registerRoutes) {
    try { QwenPaw.registerRoutes("companion-core", [{
      path: "/apps/companion-core",
      component: CompanionApp,
      label: "陪伴核心",
      icon: "💞",
    }]);
    } catch (e) { console.warn("[companion-core] registerRoutes failed", e); }
  }
  if (QwenPaw.menu && QwenPaw.menu.add) {
    try { QwenPaw.menu.add("companion-core", [{
      id: "companion-core.menu", location: "primary.settings",
      label: "陪伴核心", icon: function () { return h("span", null, "💞"); },
      route: "companion-core.home", order: 45,
    }]); } catch (e) { console.warn("[companion-core] menu.add failed", e); }
  }
  if (QwenPaw.route && QwenPaw.route.add) {
    try { QwenPaw.route.add("companion-core", [{
      id: "companion-core.home", path: "/plugin/companion-core", component: CompanionApp,
    }]); } catch (e) { console.warn("[companion-core] route.add failed", e); }
  }
})();
