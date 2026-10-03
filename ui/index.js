/**
 * Companion Core v2.3.1 — frontend dashboard.
 *
 * 7 tabs: State, Schedule, Dreams, Notes, Relationship, Dates, Data.
 * Dark mode via host.useTheme(); API calls go through host.getApiUrl().
 */
(function () {
  var QwenPaw = window.QwenPaw;
  if (!QwenPaw || !QwenPaw.host || !QwenPaw.registerRoutes) {
    console.error("[companion-core] window.QwenPaw not ready");
    return;
  }

  var host = QwenPaw.host;
  var React = host.React;
  var antd = host.antd;
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
      importDesc: "从 JSON 备份文件恢复数据（将覆盖现有数据）。",
      importSuccess: "数据导入成功，已恢复: {fields}",
      exportSuccess: "数据已导出", importFailed: "导入失败: {error}",
      timeRequired: "请填写时间", activityRequired: "请填写活动",
      retry: "重试", loading: "加载中…", loadError: "读取失败",
      healthStatus: "状态", healthDreams: "梦境", healthNotes: "便签",
      importConfirm: "导入将覆盖现有数据，确定继续？",
      isToday: "就是今天", tomorrow: "明天", inDays: "还有 {count} 天",
    },
    en: {
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
      importDesc: "Restore data from a JSON backup (overwrites existing).",
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

  function isValidDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")); }

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

  function apiFetch(path, opts) {
    opts = opts || {};
    var url = host.getApiUrl(API_PREFIX + path);
    var token = host.getApiToken ? host.getApiToken() : "";
    var headers = opts.headers || {};
    headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = "Bearer " + token;
    return fetch(url, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.status === 204 ? null : res.json();
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
    health: function () { return apiFetch("/companion-core/health"); },
  };

  // ── Shared UI pieces ─────────────────────────────────────────────────

  function Field(props) {
    var C = props.C;
    return h("div", { style: { display: "flex", gap: 8, padding: "7px 0", borderBottom: C.fieldBorder } },
      h("div", { style: { width: 64, flexShrink: 0, color: C.sub, fontSize: 13 } }, props.label),
      h("div", { style: { flex: 1, color: C.text, fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, props.children));
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
    return { background: C.cardBg, border: C.border, borderRadius: 12, padding: 16 };
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
        right: h(Space, {},
          h(Button, { size: "small", onClick: s.retry }, t("refresh")),
          h(Button, { size: "small", type: "primary", onClick: function () { setForm(Object.assign({}, data)); setEditing(true); } }, t("edit"))),
      }),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 } },
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
    var _f = useState({ time: "", activity: "", mood: "" }), form = _f[0], setForm = _f[1];
    var _g = useState(false), saving = _g[0], setSaving = _g[1];

    if (s.loading) return h(LoadingBlock, { t: t, C: C });
    if (s.error) return h(ErrorBlock, { t: t, C: C, error: s.error, onRetry: s.retry });

    var data = s.data || {};
    var plan = ((data.plan || []).slice()).sort(function (a, b) {
      return String(a.time || "99:99").localeCompare(String(b.time || "99:99"));
    });

    function savePlan(next, msgKey, after) {
      if (saving) return;
      setSaving(true);
      api.updateSchedule({ plan: next })
        .then(function () { message.success(t(msgKey)); if (after) after(); s.retry(); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); })
        .then(function () { setSaving(false); });
    }

    function addItem() {
      if (!form.time.trim()) { message.warning(t("timeRequired")); return; }
      if (!form.activity.trim()) { message.warning(t("activityRequired")); return; }
      var entry = { time: form.time.trim(), activity: form.activity.trim(), mood: form.mood.trim() || "平稳" };
      savePlan(plan.concat([entry]), "saved", function () {
        setModalOpen(false);
        setForm({ time: "", activity: "", mood: "" });
      });
    }

    function removeItem(idx) {
      savePlan(plan.filter(function (_, i) { return i !== idx; }), "deleted");
    }

    return h("div", {},
      h(Toolbar, {
        left: h(Space, {},
          h(Button, { size: "small", type: "primary", onClick: function () { setModalOpen(true); } }, t("newSchedule")),
          h("span", { style: { color: C.sub, fontSize: 13 } }, data.date || "")),
        right: h(Button, { size: "small", onClick: s.retry }, t("refresh")),
      }),
      h("div", { style: panelStyle(C) },
        plan.length === 0
          ? h(Empty, { description: t("noPlan") })
          : plan.map(function (item, idx) {
              return h("div", {
                key: idx,
                style: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: idx < plan.length - 1 ? C.fieldBorder : "none" },
              },
                h("span", { style: { fontFamily: "monospace", fontWeight: 600, color: C.accent, width: 52, flexShrink: 0 } }, item.time || ""),
                h("span", { style: { flex: 1, color: C.text, fontSize: 13 } }, item.activity || ""),
                item.mood ? h(Tag, { color: "purple" }, item.mood) : null,
                h(Popconfirm, { title: t("confirmDeleteSchedule"), onConfirm: function () { removeItem(idx); } },
                  h(Button, { size: "small", type: "link", danger: true, disabled: saving }, t("delete"))));
            })),
      h(Modal, {
        open: modalOpen, title: t("newSchedule"), okText: t("save"), cancelText: t("cancel"),
        okButtonProps: { loading: saving },
        onCancel: function () { setModalOpen(false); setForm({ time: "", activity: "", mood: "" }); },
        onOk: addItem,
      }, h("div", { style: { display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 } },
        h(EditorRow, { label: t("scheduleTime"), C: C }, h(Input, { placeholder: "08:20", value: form.time, onChange: function (e) { setForm(Object.assign({}, form, { time: e.target.value })); } })),
        h(EditorRow, { label: t("scheduleActivity"), C: C }, h(Input, { value: form.activity, onChange: function (e) { setForm(Object.assign({}, form, { activity: e.target.value })); } })),
        h(EditorRow, { label: t("scheduleMood"), C: C }, h(Input, { placeholder: "平稳", value: form.mood, onChange: function (e) { setForm(Object.assign({}, form, { mood: e.target.value })); } })))));
  }

  // ── Tab: Dreams ──────────────────────────────────────────────────────

  function DreamsTab(props) {
    var t = props.t, C = props.C;
    var s = useAsync(api.listDreams, []);
    var _v = useState(null), viewing = _v[0], setViewing = _v[1];
    var _m = useState(false), modalOpen = _m[0], setModalOpen = _m[1];
    var _f = useState({ date: "", content: "" }), form = _f[0], setForm = _f[1];
    var _g = useState(false), saving = _g[0], setSaving = _g[1];
    var _p = useState(false), opening = _p[0], setOpening = _p[1];

    if (s.loading) return h(LoadingBlock, { t: t, C: C });
    if (s.error) return h(ErrorBlock, { t: t, C: C, error: s.error, onRetry: s.retry });
    var dreams = s.data || [];

    function openDream(d) {
      setOpening(true);
      api.getDream(d).then(setViewing)
        .catch(function (e) { message.error(t("loadFailed", { error: e.message })); })
        .then(function () { setOpening(false); });
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
      h(Toolbar, {
        left: h(Space, {},
          h(Button, { size: "small", type: "primary", onClick: function () { setModalOpen(true); } }, t("newDream")),
          h("span", { style: { color: C.sub, fontSize: 13 } }, dreams.length ? t("tabDreams") + " · " + dreams.length : "")),
        right: h(Button, { size: "small", onClick: s.retry }, t("refresh")),
      }),
      h("div", { style: panelStyle(C) },
        dreams.length === 0
          ? h(Empty, { description: t("noDreams") })
          : dreams.map(function (dream, idx) {
              var preview = String(dream.content || "").replace(/^#.*$/m, "").trim().slice(0, 120);
              return h("div", {
                key: dream.date || idx,
                style: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: idx < dreams.length - 1 ? C.fieldBorder : "none", cursor: "pointer" },
                onClick: function () { openDream(dream.date); },
              },
                h(Tag, { color: "blue", style: { flexShrink: 0 } }, dream.date),
                h("span", { style: { flex: 1, color: C.sub, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, preview || "…"),
                h(Button, { size: "small", type: "link" }, t("view")));
            })),
      h(Modal, {
        open: !!viewing || opening, title: viewing ? t("dreamOf", { date: viewing.date }) : "",
        footer: null, onCancel: function () { setViewing(null); },
      }, opening ? h("div", { style: { padding: 24, textAlign: "center" } }, h(Spin, {}))
        : viewing ? h("div", { style: { whiteSpace: "pre-wrap", color: C.text, fontSize: 13, maxHeight: "60vh", overflow: "auto" } }, viewing.content) : null),
      h(Modal, {
        open: modalOpen, title: t("newDream"), okText: t("save"), cancelText: t("cancel"),
        okButtonProps: { loading: saving },
        onCancel: function () { setModalOpen(false); setForm({ date: "", content: "" }); },
        onOk: submitDream,
      }, h("div", { style: { display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 } },
        h(EditorRow, { label: t("dreamDate"), C: C }, h(Input, { placeholder: "YYYY-MM-DD", value: form.date, onChange: function (e) { setForm(Object.assign({}, form, { date: e.target.value })); } })),
        h(EditorRow, { label: t("dreamContent"), C: C }, h(TextArea, { rows: 5, value: form.content, onChange: function (e) { setForm(Object.assign({}, form, { content: e.target.value })); } })))));
  }

  // ── Tab: Notes ───────────────────────────────────────────────────────

  function NotesTab(props) {
    var t = props.t, C = props.C;
    var _x = useState(false), showExpired = _x[0], setShowExpired = _x[1];
    var s = useAsync(function () { return api.listNotes(showExpired); }, [showExpired]);
    var _m = useState(false), modalOpen = _m[0], setModalOpen = _m[1];
    var _f = useState({ content: "", expires_at: "" }), form = _f[0], setForm = _f[1];
    var _g = useState(false), busy = _g[0], setBusy = _g[1];

    if (s.loading) return h(LoadingBlock, { t: t, C: C });
    if (s.error) return h(ErrorBlock, { t: t, C: C, error: s.error, onRetry: s.retry });
    var notes = s.data || [];

    function runAsync(promise, onOk) {
      if (busy) return;
      setBusy(true);
      promise
        .then(function (res) { if (onOk) onOk(res); s.retry(); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); })
        .then(function () { setBusy(false); });
    }

    function toggleReminded(note) {
      runAsync(api.updateNote(note.id, { reminded: !note.reminded }));
    }

    function removeNote(id) {
      runAsync(api.deleteNote(id), function () { message.success(t("deleted")); });
    }

    function cleanExpired() {
      runAsync(api.cleanExpiredNotes(), function (res) {
        message.success(t("cleaned", { count: (res && res.cleaned) || 0 }));
      });
    }

    function submitCreate() {
      if (!form.content || !form.content.trim()) { message.warning(t("contentRequired")); return; }
      if (form.expires_at && !isValidDate(form.expires_at)) { message.warning(t("dateInvalid")); return; }
      runAsync(api.createNote({ content: form.content.trim(), expires_at: form.expires_at || "" }), function () {
        message.success(t("saved"));
        setModalOpen(false);
        setForm({ content: "", expires_at: "" });
      });
    }

    var today = localToday();

    return h("div", {},
      h(Toolbar, {
        left: h(Space, {},
          h(Button, { size: "small", type: "primary", onClick: function () { setModalOpen(true); }, disabled: busy }, t("newNote")),
          h(Popconfirm, { title: t("cleanExpired"), onConfirm: cleanExpired },
            h(Button, { size: "small", disabled: busy }, t("cleanExpired"))),
          h("span", { style: { color: C.sub, fontSize: 12 } }, t("showExpired")),
          h(Switch, { size: "small", checked: showExpired, onChange: setShowExpired })),
        right: h(Button, { size: "small", onClick: s.retry, disabled: busy }, t("refresh")),
      }),
      h("div", { style: panelStyle(C) },
        notes.length === 0
          ? h(Empty, { description: t("tabNotes") })
          : notes.map(function (note, idx) {
              var expired = note.expires_at && note.expires_at < today;
              return h("div", {
                key: note.id || idx,
                style: { padding: "10px 0", borderBottom: idx < notes.length - 1 ? C.fieldBorder : "none", opacity: expired ? 0.55 : 1 },
              },
                h("div", { style: { display: "flex", alignItems: "flex-start", gap: 8 } },
                  h("span", { style: { flex: 1, color: C.text, fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, note.content),
                  h(Space, { size: 4 },
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
        open: modalOpen, title: t("newNote"), okText: t("save"), cancelText: t("cancel"),
        okButtonProps: { loading: busy },
        onCancel: function () { setModalOpen(false); setForm({ content: "", expires_at: "" }); },
        onOk: submitCreate,
      }, h("div", { style: { display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 } },
        h(EditorRow, { label: t("noteContent"), C: C },
          h(TextArea, { rows: 3, value: form.content, onChange: function (e) { setForm(Object.assign({}, form, { content: e.target.value })); } })),
        h(EditorRow, { label: t("noteExpires"), C: C },
          h(Input, { placeholder: "YYYY-MM-DD", value: form.expires_at, onChange: function (e) { setForm(Object.assign({}, form, { expires_at: e.target.value })); } })))));
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
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 } },
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
    if (parts.length !== 3) return null;
    var m = parseInt(parts[1], 10), d = parseInt(parts[2], 10);
    if (!m || !d) return null;
    var now = new Date();
    var today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var next = new Date(today0.getFullYear(), m - 1, d);
    if (next < today0) next = new Date(today0.getFullYear() + 1, m - 1, d);
    return Math.round((next - today0) / 86400000);
  }

  function DatesTab(props) {
    var t = props.t, C = props.C;
    var s = useAsync(api.getDates, []);
    var _m = useState(false), modalOpen = _m[0], setModalOpen = _m[1];
    var _f = useState({ name: "", date: "", note: "" }), form = _f[0], setForm = _f[1];
    var _g = useState(false), saving = _g[0], setSaving = _g[1];

    if (s.loading) return h(LoadingBlock, { t: t, C: C });
    if (s.error) return h(ErrorBlock, { t: t, C: C, error: s.error, onRetry: s.retry });

    var dates = ((s.data && s.data.dates) || []).slice().sort(function (a, b) {
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
      h(Toolbar, {
        left: h(Button, { size: "small", type: "primary", onClick: function () { setModalOpen(true); } }, t("addDate")),
        right: h(Button, { size: "small", onClick: s.retry }, t("refresh")),
      }),
      h("div", { style: panelStyle(C) },
        dates.length === 0
          ? h(Empty, { description: t("noDates") })
          : dates.map(function (item, idx) {
              var left = daysUntilAnniversary(item.date);
              var label = left === null ? "" : left === 0 ? t("isToday") : left === 1 ? t("tomorrow") : t("inDays", { count: left });
              return h("div", { key: item.name || idx, style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: idx < dates.length - 1 ? C.fieldBorder : "none" } },
                h(Tag, { color: item.date === localToday() ? "red" : "magenta", style: { flexShrink: 0, fontFamily: "monospace" } }, item.date || ""),
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
        h(EditorRow, { label: t("dateValue"), C: C }, h(Input, { placeholder: "YYYY-MM-DD", value: form.date, onChange: function (e) { setForm(Object.assign({}, form, { date: e.target.value })); } })),
        h(EditorRow, { label: t("dateNote"), C: C }, h(Input, { value: form.note, onChange: function (e) { setForm(Object.assign({}, form, { note: e.target.value })); } })))));
  }

  // ── Tab: Data (export / import) ──────────────────────────────────────

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
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 } },
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

  var APP_VERSION = "2.3.1";

  function CompanionApp() {
    var locale = normalizeLocale(useHostLocale());
    var themeInfo = useHostTheme();
    var isDark = !!(themeInfo && themeInfo.isDark);
    var C = getThemeColors(isDark);

    function t(key, values) { return tr(locale, key, values); }

    return h("div", { style: { padding: "16px 20px", minHeight: "100%", background: C.pageBg, color: C.text } },
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 } },
        h("span", { style: { fontSize: 26 } }, "💞"),
        h("div", {},
          h("div", { style: { fontSize: 18, fontWeight: 600 } },
            t("appTitle"),
            h("span", { style: { fontSize: 11, fontWeight: 400, color: C.muted, marginLeft: 8 } }, "v" + APP_VERSION)),
          h("div", { style: { fontSize: 12, color: C.muted } }, t("appSubtitle")))),
      h(Tabs, {
        defaultActiveKey: "state",
        items: [
          { key: "state", label: "🌤 " + t("tabState"), children: h(StateTab, { t: t, C: C }) },
          { key: "schedule", label: "📅 " + t("tabSchedule"), children: h(ScheduleTab, { t: t, C: C }) },
          { key: "dreams", label: "💭 " + t("tabDreams"), children: h(DreamsTab, { t: t, C: C }) },
          { key: "notes", label: "📝 " + t("tabNotes"), children: h(NotesTab, { t: t, C: C }) },
          { key: "relationship", label: "💕 " + t("tabRelationship"), children: h(RelationshipTab, { t: t, C: C }) },
          { key: "dates", label: "🎂 " + t("tabDates"), children: h(DatesTab, { t: t, C: C }) },
          { key: "data", label: "💾 " + t("tabData"), children: h(DataTab, { t: t, C: C }) },
        ],
      }));
  }

  // ── Self-register ────────────────────────────────────────────────────

  QwenPaw.registerRoutes("companion-core", [{
    path: "/apps/companion-core",
    component: CompanionApp,
    label: "陪伴核心",
    icon: "💞",
  }]);

  console.info("[companion-core] v" + APP_VERSION + " registered route /apps/companion-core");
})();
