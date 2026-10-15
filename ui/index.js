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

  var MESSAGES = {
    zh: {
      tabOrganizer:"聊天整理", orgIntro:"使用独立的小模型整理近期聊天，不占用主聊天模型。近期文字会发送至你配置的 API。每个启用模块最多调用一次，六个模块最多六次；实际费用按服务商计费。",
      orgBase:"API 基址（例如 https://example.com/v1）", orgModel:"模型名称", orgKey:"API Key（留空保留已保存密钥）", orgKeySaved:"已保存密钥", orgKeyEmpty:"未设置密钥（支持免密本地接口）", orgKeyClear:"清除已保存密钥", orgInherit:"留空继承公共设置；不同 API 地址不继承公共密钥",
      orgAgent:"整理目标智能体", orgChooseAgent:"选择已绑定的智能体", orgChat:"近期会话", orgChooseChat:"选择一个会话", orgAuto:"聊天结束自动整理", orgAutoHint:"自动整理默认关闭。开启后仅处理目标智能体，在聊天结束后按最小间隔运行，无新内容则跳过；会自动写入数据并保留最近 10 份轮换备份。",
      orgNoAuto:"此宿主不支持自动整理钩子，可手动整理。", orgInterval:"最小间隔（分钟）", orgMessages:"最多读取消息数", orgChars:"聊天文字上限（字符）", orgTokens:"每个模块最大输出 token", orgEnabled:"启用此模块", orgPrompt:"模块整理规则 / 提示词", orgSchema:"数据定义（固定结构，点击查看）",
      orgSave:"保存整理配置", orgRefresh:"刷新配置与状态", orgSaved:"配置已保存", orgPreview:"整理并预览（会消耗模型额度）", orgApply:"确认写入这些修改", orgDiscard:"放弃预览", orgNoChanges:"模型未提出数据修改。", orgPreviewHint:"本次只生成预览，尚未写入。预览有效期 10 分钟；期间数据变化会阻止覆盖。",
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
      tabOrganizer:"Chat organizer", orgIntro:"Use an independent small model to organize recent chats. Recent text is sent to your configured API. Each enabled module makes at most one request, up to six per run. Provider pricing applies.",
      orgBase:"API base URL (e.g. https://example.com/v1)", orgModel:"Model name", orgKey:"API key (blank keeps the saved key)", orgKeySaved:"Key saved", orgKeyEmpty:"No key (local keyless endpoints supported)", orgKeyClear:"Clear saved key", orgInherit:"Blank inherits shared settings. A different endpoint does not inherit the shared key.",
      orgAgent:"Target agent", orgChooseAgent:"Choose a bound agent", orgChat:"Recent conversation", orgChooseChat:"Choose a conversation", orgAuto:"Organize after chats automatically", orgAutoHint:"Off by default. Runs after the selected agent finishes a chat, subject to the minimum interval; unchanged text is skipped. Changes are applied automatically, retaining 10 rotating backups.",
      orgNoAuto:"This host has no automatic hook; manual organization is available.", orgInterval:"Minimum interval (minutes)", orgMessages:"Maximum recent messages", orgChars:"Maximum chat characters", orgTokens:"Maximum output tokens per module", orgEnabled:"Enable module", orgPrompt:"Module rules / prompt", orgSchema:"Data schema (fixed structure)",
      orgSave:"Save organizer settings", orgRefresh:"Refresh settings and status", orgSaved:"Settings saved", orgPreview:"Generate preview (uses model credits)", orgApply:"Apply these changes", orgDiscard:"Discard preview", orgNoChanges:"The model proposed no changes.", orgPreviewHint:"Preview only; nothing written yet. Expires in 10 minutes. Concurrent edits block overwriting.",
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
  function localToday() {
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
    exportAll: function () { return apiFetch("/companion-core/export"); },
    importAll: function (d) { return apiFetch("/companion-core/import", { method: "POST", body: d }); },
    organizerConfig: function () { return apiFetch("/companion-core/organizer/config"); },
    saveOrganizer: function (data) { return apiFetch("/companion-core/organizer/config", {method:"PUT",body:data}); },
    organizerChats: function (id) { return apiFetch("/companion-core/organizer/chats?agent_id=" + encodeURIComponent(id)); },
    organizerPreview: function (agent,chat) { return apiFetch("/companion-core/organizer/preview", {method:"POST",body:{agent_id:agent,chat_id:chat}}); },
    organizerApply: function (id) { return apiFetch("/companion-core/organizer/apply", {method:"POST",body:{preview_id:id}}); },
    agents: function () { return apiFetch("/companion-core/agents"); },
    bindAgent: function (id, enabled) { return apiFetch("/companion-core/agents/" + encodeURIComponent(id) + "/binding", {method:"PUT", body:{enabled:enabled}}); },
    health: function () { return apiFetch("/companion-core/health"); },
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
        metric(t("summaryEnergy"), String(state.energy || 0) + "%", state.sleep || "—", "state", "↗"),
        metric(t("pendingNotes"), notes.length, t("notesHint"), "notes", "✎"),
        metric(t("summaryWarmth"), String(s.data[4].warmth_score || 0) + "%", t("tabRelationship"), "relationship", "♡")),
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
    if (!data.date && !data.mood) {
      return h("div", { style: { padding: 32, textAlign: "center" } }, h(Empty, { description: t("noState") }));
    }

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
          h(Progress, { percent: energy, strokeColor: C.accent }),
          h(Field, { label: t("fDream"), C: C }, data.dream || "—"),
          h(Field, { label: t("fNote"), C: C }, data.note || "—"))),
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

  // ── Tab: Schedule ────────────────────────────────────────────────────

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
          h(Progress, { percent: warmth, strokeColor: C.accent }),
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
    var now = new Date();
    var today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
      field(t("orgChat"),h("select",{value:chat,disabled:busy,style:selectStyle,"aria-label":t("orgChat"),onChange:function(e){setChat(e.target.value);setPreview(null);}},
        h("option",{value:""},t("orgChooseChat")),chats.map(function(item){return h("option",{key:item.id,value:item.id},item.name+" · "+item.updated_at);}))),
      number("orgMessages","recent_messages",2,200),number("orgChars","max_context_chars",1000,64000),number("orgTokens","max_output_tokens",128,4096),
      field(t("orgAuto"),h(Switch,{checked:form.auto_enabled,disabled:busy||!meta.auto_supported,onChange:function(v){update("auto_enabled",v);}})),
      h("p",{style:{color:C.sub,lineHeight:1.8}},t("orgAutoHint")),
      !meta.auto_supported?h("p",null,t("orgNoAuto")):null,
      number("orgInterval","interval_minutes",5,1440),
      h("p",{style:{color:C.sub}},t("orgShared")),
      Object.keys(labels).map(function(key){var module=form.modules[key];return h("details",{key:key,style:{border:C.border,padding:16,borderRadius:12,marginBottom:12}},
        h("summary",{style:{cursor:"pointer",fontWeight:600}},t(labels[key])+" · "+(module.model || form.model || "—")),
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
.cc-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:20px}.cc-metric{text-align:left;display:flex;flex-direction:column;position:relative;gap:12px;padding:22px 20px;background:var(--cc-card);color:var(--cc-text);border:1px solid rgba(127,127,127,.14);border-radius:18px;cursor:pointer;min-width:0;font:inherit;transition:transform .18s,border-color .18s}.cc-metric:hover{transform:translateY(-3px);border-color:var(--cc-accent)}.cc-metric:focus-visible{outline:2px solid var(--cc-accent);outline-offset:3px}.cc-metric strong{font-size:25px;font-weight:600;line-height:1.4;overflow-wrap:anywhere}.cc-metric-icon{position:absolute;right:18px;top:16px;font-size:22px;color:var(--cc-accent)}.cc-metric .cc-eyebrow{padding-right:22px;letter-spacing:0}.cc-metric-detail{font-size:12px;color:var(--cc-sub);line-height:1.6;overflow-wrap:anywhere}.cc-overview-grid{display:grid;grid-template-columns:1.15fr 1fr;gap:20px}.cc-timeline-row{display:flex;gap:20px;padding:15px 0;border-bottom:1px solid rgba(127,127,127,.1);overflow-wrap:anywhere}.cc-timeline-row time{font-variant-numeric:tabular-nums;color:var(--cc-accent);font-weight:600;flex-shrink:0}.cc-date-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid rgba(127,127,127,.1)}.cc-date-row small{display:block;color:var(--cc-sub);margin-top:5px}.cc-note-preview{padding:14px 16px;background:rgba(236,72,153,.04);border-left:3px solid var(--cc-accent);border-radius:4px 10px 10px 4px;margin:10px 0;white-space:pre-wrap;overflow-wrap:anywhere}.cc-search-row{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}.cc-app .ant-btn{border-radius:8px}.cc-app .ant-input,.cc-app .ant-input-affix-wrapper{border-radius:8px}.cc-app section{min-width:0}.cc-app .ant-tabs-content-holder{min-width:0}
@media(max-width:760px){.cc-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.cc-overview-grid{grid-template-columns:1fr}.cc-hero{padding:24px}.cc-today{display:none}.cc-hero h1{font-size:26px}.cc-app{padding-top:16px}.cc-app .ant-space{flex-wrap:wrap}.cc-app .ant-tabs-tab+.ant-tabs-tab{margin-left:20px}}
@media(max-width:760px){.cc-tabs>.ant-tabs-nav .ant-tabs-nav-wrap{overflow:visible}.cc-tabs>.ant-tabs-nav .ant-tabs-nav-list{transform:none!important;flex-wrap:wrap;gap:4px 6px;width:100%}.cc-tabs>.ant-tabs-nav .ant-tabs-tab{margin:0!important;padding:8px 10px;border-radius:8px;font-size:13px}.cc-tabs>.ant-tabs-nav .ant-tabs-tab-active{background:rgba(236,72,153,.08)}.cc-tabs>.ant-tabs-nav .ant-tabs-nav-operations,.cc-tabs>.ant-tabs-nav .ant-tabs-ink-bar{display:none}.cc-tabs>.ant-tabs-nav .ant-tabs-nav-wrap:before,.cc-tabs>.ant-tabs-nav .ant-tabs-nav-wrap:after{display:none}}
@media(max-width:420px){.cc-metric{padding:16px 12px}.cc-metric strong{font-size:21px}.cc-metric-icon{right:12px;top:12px}.cc-hero{padding:20px}.cc-hero h1{font-size:24px}}
@media(prefers-reduced-motion:reduce){.cc-metric{transition:none}}
`;
  var APP_VERSION = "";

  function CompanionApp() {
    var _tab = useState("overview"), activeTab = _tab[0], setActiveTab = _tab[1];
    var _rev = useState(0), revision = _rev[0], setRevision = _rev[1];
    var versionState = useState(APP_VERSION), version = versionState[0], setVersion = versionState[1];
    useEffect(function () {
      var active = true;
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
      h("header",{className:"cc-hero"},
        h("div",{className:"cc-hero-copy"}, h("div",{className:"cc-eyebrow"},"♡  " + t("todayLabel")),
          h("h1",null,t("appTitle"),h("span",{className:"cc-version"},version ? "v"+version : "")),
          h("p",null,t("welcome"))),
        h("div",{className:"cc-today"},h("span",null,localToday()),h("small",null,t("overviewHint")))),
      h(Tabs, {
        className: "cc-tabs", activeKey:activeTab, onChange:setActiveTab,
        destroyInactiveTabPane:true,
        items: [
          {key:"overview",label:"◈ " + t("tabOverview"),children:h(OverviewTab,{key:revision,t:t,C:C,navigate:setActiveTab})},
          { key: "state", label: "🌤 " + t("tabState"), children: h(StateTab, { key:revision, t: t, C: C }) },
          { key: "schedule", label: "📅 " + t("tabSchedule"), children: h(ScheduleTab, { key:revision, t: t, C: C }) },
          { key: "dreams", label: "💭 " + t("tabDreams"), children: h(DreamsTab, { key:revision, t: t, C: C }) },
          { key: "notes", label: "📝 " + t("tabNotes"), children: h(NotesTab, { key:revision, t: t, C: C }) },
          { key: "relationship", label: "💕 " + t("tabRelationship"), children: h(RelationshipTab, { key:revision, t: t, C: C }) },
          { key: "dates", label: "🎂 " + t("tabDates"), children: h(DatesTab, { key:revision, t: t, C: C }) },
          { key: "organizer", label: "✨ " + t("tabOrganizer"), children: h(OrganizerTab, { t:t, C:C, onApplied:function(){setRevision(function(v){return v+1;});} }) },
          { key: "agents", label: "🤖 " + t("tabAgents"), children: h(AgentsTab, { t:t, C:C }) },
          { key: "data", label: "💾 " + t("tabData"), children: h(DataTab, { t:t, C:C, onImport:function(){setRevision(function(v){return v+1;});} }) },
        ],
      }));
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
