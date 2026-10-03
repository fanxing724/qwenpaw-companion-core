/**
 * Companion Core v2.3.0 — frontend dashboard.
 *
 * 7 tabs: State, Schedule, Dreams, Notes, Relationship, Dates, Data.
 * Supports dark mode via host.useTheme() and uses host.fetch for API calls.
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
    }
  };

  function normalizeLocale(v) {
    return String(v || "").toLowerCase().split("-")[0] === "zh" ? "zh" : "en";
  }

  function tr(locale, key, values) {
    var tpl = (MESSAGES[locale] && MESSAGES[locale][key]) || MESSAGES.en[key] || key;
    return tpl.replace(/\{(\w+)\}/g, function (_, n) {
      return values && values[n] !== undefined ? String(values[n]) : "{" + n + "}";
    });
  }

  function isValidDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")); }

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

  function apiFetch(path, opts) {
    opts = opts || {};
    if (host.fetch) {
      var fetchOpts = { method: opts.method || "GET" };
      if (opts.body) {
        fetchOpts.headers = { "Content-Type": "application/json" };
        fetchOpts.body = JSON.stringify(opts.body);
      }
      return host.fetch(path, fetchOpts).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.status === 204 ? null : res.json();
      });
    }
    var shortPath = path.replace(/^\/api/, "");
    var url = host.getApiUrl(shortPath);
    var headers = Object.assign({}, opts.headers);
    headers["Content-Type"] = "application/json";
    return fetch(url, {
      method: opts.method || "GET", headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.status === 204 ? null : res.json();
    });
  }

  var api = {
    getState: function () { return apiFetch("/api/companion-core/state"); },
    updateState: function (d) { return apiFetch("/api/companion-core/state", { method: "PUT", body: d }); },
    getSchedule: function () { return apiFetch("/api/companion-core/schedule"); },
    updateSchedule: function (d) { return apiFetch("/api/companion-core/schedule", { method: "PUT", body: d }); },
    listDreams: function () { return apiFetch("/api/companion-core/dreams"); },
    getDream: function (d) { return apiFetch("/api/companion-core/dreams/" + encodeURIComponent(d)); },
    createDream: function (d) { return apiFetch("/api/companion-core/dreams", { method: "POST", body: d }); },
    listNotes: function (exp) { return apiFetch("/api/companion-core/notes?expired=" + (exp ? "true" : "false")); },
    createNote: function (d) { return apiFetch("/api/companion-core/notes", { method: "POST", body: d }); },
    updateNote: function (id, d) { return apiFetch("/api/companion-core/notes/" + encodeURIComponent(id), { method: "PUT", body: d }); },
    deleteNote: function (id) { return apiFetch("/api/companion-core/notes/" + encodeURIComponent(id), { method: "DELETE" }); },
    cleanExpiredNotes: function () { return apiFetch("/api/companion-core/notes/expired", { method: "DELETE" }); },
    getRelationship: function () { return apiFetch("/api/companion-core/relationship"); },
    updateRelationship: function (d) { return apiFetch("/api/companion-core/relationship", { method: "PUT", body: d }); },
    getDates: function () { return apiFetch("/api/companion-core/dates"); },
    addDate: function (d) { return apiFetch("/api/companion-core/dates", { method: "POST", body: d }); },
    deleteDate: function (n) { return apiFetch("/api/companion-core/dates/" + encodeURIComponent(n), { method: "DELETE" }); },
    exportAll: function () { return apiFetch("/api/companion-core/export"); },
    importAll: function (d) { return apiFetch("/api/companion-core/import", { method: "POST", body: d }); },
    health: function () { return apiFetch("/api/companion-core/health"); },
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
    var _d = useState(null), data = _d[0], setData = _d[1];
    var _e = useState(false), editing = _e[0], setEditing = _e[1];
    var _f = useState(null), form = _f[0], setForm = _f[1];

    function load() {
      api.getState().then(setData).catch(function (e) { message.error(t("loadFailed", { error: e.message })); });
    }
    useEffect(load, []);

    if (!data) return h("div", { style: { padding: 32, textAlign: "center" } }, h(Empty, { description: t("noState") }));

    var energy = typeof data.energy === "number" ? data.energy : 0;

    function setField(key, value) {
      setForm(Object.assign({}, form, (function () { var o = {}; o[key] = value; return o; })()));
    }

    return h("div", {},
      h(Toolbar, {
        left: h("span", { style: { color: C.sub, fontSize: 13 } }, t("fDate") + ": " + (data.date || "—")),
        right: h(Space, {},
          h(Button, { size: "small", onClick: load }, t("refresh")),
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
        onCancel: function () { setEditing(false); },
        onOk: function () {
          api.updateState(form).then(function () { message.success(t("saved")); setEditing(false); load(); })
            .catch(function (e) { message.error(t("saveFailed", { error: e.message })); });
        },
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
    var _d = useState(null), data = _d[0], setData = _d[1];
    var _m = useState(false), modalOpen = _m[0], setModalOpen = _m[1];
    var _f = useState({ time: "", activity: "", mood: "" }), form = _f[0], setForm = _f[1];

    function load() {
      api.getSchedule().then(setData).catch(function (e) { message.error(t("loadFailed", { error: e.message })); });
    }
    useEffect(load, []);

    var plan = (data && data.plan) || [];

    function addItem() {
      if (!form.time.trim()) { message.warning(t("timeRequired")); return; }
      if (!form.activity.trim()) { message.warning(t("activityRequired")); return; }
      var newPlan = plan.concat([{ time: form.time.trim(), activity: form.activity.trim(), mood: form.mood.trim() || "平稳" }]);
      api.updateSchedule({ plan: newPlan })
        .then(function () { message.success(t("saved")); setModalOpen(false); setForm({ time: "", activity: "", mood: "" }); load(); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); });
    }

    function removeItem(idx) {
      var newPlan = plan.filter(function (_, i) { return i !== idx; });
      api.updateSchedule({ plan: newPlan })
        .then(function () { message.success(t("deleted")); load(); })
        .catch(function (e) { message.error(t("deleteFailed", { error: e.message })); });
    }

    return h("div", {},
      h(Toolbar, {
        left: h(Space, {},
          h(Button, { size: "small", type: "primary", onClick: function () { setModalOpen(true); } }, t("newSchedule")),
          h("span", { style: { color: C.sub, fontSize: 13 } }, (data && data.date) ? data.date : "")),
        right: h(Button, { size: "small", onClick: load }, t("refresh")),
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
                  h(Button, { size: "small", type: "link", danger: true }, t("delete"))));
            })),
      h(Modal, {
        open: modalOpen, title: t("newSchedule"), okText: t("save"), cancelText: t("cancel"),
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
    var _d = useState(null), dreams = _d[0], setDreams = _d[1];
    var _v = useState(null), viewing = _v[0], setViewing = _v[1];
    var _m = useState(false), modalOpen = _m[0], setModalOpen = _m[1];
    var _f = useState({ date: "", content: "" }), form = _f[0], setForm = _f[1];

    function load() {
      api.listDreams().then(setDreams).catch(function (e) { message.error(t("loadFailed", { error: e.message })); });
    }
    useEffect(load, []);

    function openDream(d) {
      api.getDream(d).then(setViewing).catch(function (e) { message.error(t("loadFailed", { error: e.message })); });
    }

    function submitDream() {
      if (!form.content.trim()) { message.warning(t("contentRequired")); return; }
      if (form.date && !isValidDate(form.date)) { message.warning(t("dateInvalid")); return; }
      var body = { content: form.content.trim() };
      if (form.date) body.date = form.date;
      api.createDream(body)
        .then(function () { message.success(t("saved")); setModalOpen(false); setForm({ date: "", content: "" }); load(); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); });
    }

    return h("div", {},
      h(Toolbar, {
        left: h(Space, {},
          h(Button, { size: "small", type: "primary", onClick: function () { setModalOpen(true); } }, t("newDream")),
          h("span", { style: { color: C.sub, fontSize: 13 } }, t("tabDreams"))),
        right: h(Button, { size: "small", onClick: load }, t("refresh")),
      }),
      h("div", { style: panelStyle(C) },
        !dreams || dreams.length === 0
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
        open: !!viewing, title: viewing ? t("dreamOf", { date: viewing.date }) : "",
        footer: null, onCancel: function () { setViewing(null); },
      }, viewing ? h("div", { style: { whiteSpace: "pre-wrap", color: C.text, fontSize: 13, maxHeight: "60vh", overflow: "auto" } }, viewing.content) : null),
      h(Modal, {
        open: modalOpen, title: t("newDream"), okText: t("save"), cancelText: t("cancel"),
        onCancel: function () { setModalOpen(false); setForm({ date: "", content: "" }); },
        onOk: submitDream,
      }, h("div", { style: { display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 } },
        h(EditorRow, { label: t("dreamDate"), C: C }, h(Input, { placeholder: "YYYY-MM-DD", value: form.date, onChange: function (e) { setForm(Object.assign({}, form, { date: e.target.value })); } })),
        h(EditorRow, { label: t("dreamContent"), C: C }, h(TextArea, { rows: 5, value: form.content, onChange: function (e) { setForm(Object.assign({}, form, { content: e.target.value })); } })))));
  }

  // ── Tab: Notes ───────────────────────────────────────────────────────

  function NotesTab(props) {
    var t = props.t, C = props.C;
    var _n = useState(null), notes = _n[0], setNotes = _n[1];
    var _x = useState(false), showExpired = _x[0], setShowExpired = _x[1];
    var _m = useState(false), modalOpen = _m[0], setModalOpen = _m[1];
    var _f = useState({ content: "", expires_at: "" }), form = _f[0], setForm = _f[1];

    function load(expired) {
      api.listNotes(expired !== undefined ? expired : showExpired)
        .then(setNotes).catch(function (e) { message.error(t("loadFailed", { error: e.message })); });
    }
    useEffect(function () { load(showExpired); }, [showExpired]);

    function toggleReminded(note) {
      api.updateNote(note.id, { reminded: !note.reminded })
        .then(function () { load(); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); });
    }

    function removeNote(id) {
      api.deleteNote(id).then(function () { message.success(t("deleted")); load(); })
        .catch(function (e) { message.error(t("deleteFailed", { error: e.message })); });
    }

    function cleanExpired() {
      api.cleanExpiredNotes()
        .then(function (res) { message.success(t("cleaned", { count: (res && res.cleaned) || 0 })); load(); })
        .catch(function (e) { message.error(t("deleteFailed", { error: e.message })); });
    }

    function submitCreate() {
      if (!form.content || !form.content.trim()) { message.warning(t("contentRequired")); return; }
      if (form.expires_at && !isValidDate(form.expires_at)) { message.warning(t("dateInvalid")); return; }
      api.createNote({ content: form.content.trim(), expires_at: form.expires_at || "" })
        .then(function () { message.success(t("saved")); setModalOpen(false); setForm({ content: "", expires_at: "" }); load(); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); });
    }

    var today = new Date().toISOString().slice(0, 10);

    return h("div", {},
      h(Toolbar, {
        left: h(Space, {},
          h(Button, { size: "small", type: "primary", onClick: function () { setModalOpen(true); } }, t("newNote")),
          h(Popconfirm, { title: t("cleanExpired"), onConfirm: cleanExpired },
            h(Button, { size: "small" }, t("cleanExpired"))),
          h("span", { style: { color: C.sub, fontSize: 12 } }, t("showExpired")),
          h(Switch, { size: "small", checked: showExpired, onChange: setShowExpired })),
        right: h(Button, { size: "small", onClick: function () { load(); } }, t("refresh")),
      }),
      h("div", { style: panelStyle(C) },
        !notes || notes.length === 0
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
                    h(Button, { size: "small", type: "link", onClick: function () { toggleReminded(note); } },
                      note.reminded ? t("notReminded") : t("reminded")),
                    h(Popconfirm, { title: t("confirmDeleteNote"), onConfirm: function () { removeNote(note.id); } },
                      h(Button, { size: "small", type: "link", danger: true }, t("delete"))))),
                h("div", { style: { display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" } },
                  h(Tag, { color: note.reminded ? "green" : "default" }, note.reminded ? t("reminded") : t("notReminded")),
                  note.expires_at
                    ? h(Tag, { color: expired ? "red" : "orange" }, note.expires_at)
                    : h(Tag, {}, t("neverExpires")),
                  note.created_at ? h("span", { style: { color: C.muted, fontSize: 11, lineHeight: "22px" } }, note.created_at) : null));
            })),
      h(Modal, {
        open: modalOpen, title: t("newNote"), okText: t("save"), cancelText: t("cancel"),
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
    var _d = useState(null), data = _d[0], setData = _d[1];
    var _e = useState(false), editing = _e[0], setEditing = _e[1];
    var _f = useState(""), editNotes = _f[0], setEditNotes = _f[1];

    function load() {
      api.getRelationship().then(setData).catch(function (e) { message.error(t("loadFailed", { error: e.message })); });
    }
    useEffect(load, []);

    if (!data) return h("div", { style: { padding: 32, textAlign: "center" } }, h(Empty, { description: "…" }));

    var warmth = typeof data.warmth_score === "number" ? data.warmth_score : 0;
    var milestones = data.milestones || [];

    function saveNotes() {
      api.updateRelationship({ notes: editNotes })
        .then(function () { message.success(t("saved")); setEditing(false); load(); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); });
    }

    return h("div", {},
      h(Toolbar, {
        left: h("span", { style: { color: C.sub, fontSize: 13 } },
          data.last_updated ? t("lastUpdated", { date: data.last_updated }) : ""),
        right: h(Button, { size: "small", onClick: load }, t("refresh")),
      }),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 } },
        h("div", { style: panelStyle(C) },
          h("div", { style: { color: C.sub, fontSize: 13, marginBottom: 4 } }, t("warmth")),
          h(Progress, { percent: warmth, strokeColor: C.accent }),
          h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 4px" } },
            h("span", { style: { color: C.sub, fontSize: 13 } }, t("relNotes")),
            editing
              ? h(Space, { size: 4 },
                  h(Button, { size: "small", type: "primary", onClick: saveNotes }, t("save")),
                  h(Button, { size: "small", onClick: function () { setEditing(false); } }, t("cancel")))
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

  function DatesTab(props) {
    var t = props.t, C = props.C;
    var _d = useState(null), dates = _d[0], setDates = _d[1];
    var _m = useState(false), modalOpen = _m[0], setModalOpen = _m[1];
    var _f = useState({ name: "", date: "", note: "" }), form = _f[0], setForm = _f[1];

    function load() {
      api.getDates().then(function (res) { setDates((res && res.dates) || []); })
        .catch(function (e) { message.error(t("loadFailed", { error: e.message })); });
    }
    useEffect(load, []);

    function removeDate(name) {
      api.deleteDate(name).then(function () { message.success(t("deleted")); load(); })
        .catch(function (e) { message.error(t("deleteFailed", { error: e.message })); });
    }

    function submitAdd() {
      if (!form.name || !form.name.trim()) { message.warning(t("nameRequired")); return; }
      if (!form.date) { message.warning(t("dateRequired")); return; }
      if (!isValidDate(form.date)) { message.warning(t("dateInvalid")); return; }
      api.addDate({ name: form.name.trim(), date: form.date, note: form.note || "" })
        .then(function () { message.success(t("saved")); setModalOpen(false); setForm({ name: "", date: "", note: "" }); load(); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); });
    }

    return h("div", {},
      h(Toolbar, {
        left: h(Button, { size: "small", type: "primary", onClick: function () { setModalOpen(true); } }, t("addDate")),
        right: h(Button, { size: "small", onClick: load }, t("refresh")),
      }),
      h("div", { style: panelStyle(C) },
        !dates || dates.length === 0
          ? h(Empty, { description: t("noDates") })
          : dates.map(function (item, idx) {
              return h("div", { key: item.name || idx, style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: idx < dates.length - 1 ? C.fieldBorder : "none" } },
                h(Tag, { color: "magenta", style: { flexShrink: 0, fontFamily: "monospace" } }, item.date || ""),
                h("span", { style: { color: C.text, fontSize: 13, fontWeight: 500 } }, item.name || ""),
                h("span", { style: { flex: 1, color: C.muted, fontSize: 12 } }, item.note || ""),
                h(Popconfirm, { title: t("confirmDeleteDate", { name: item.name }), onConfirm: function () { removeDate(item.name); } },
                  h(Button, { size: "small", type: "link", danger: true }, t("delete"))));
            })),
      h(Modal, {
        open: modalOpen, title: t("addDate"), okText: t("save"), cancelText: t("cancel"),
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
    var _h = useState(null), healthData = _h[0], setHealthData = _h[1];
    var fileRef = React.useRef(null);

    useEffect(function () {
      api.health().then(setHealthData).catch(function () {});
    }, []);

    function doExport() {
      api.exportAll()
        .then(function (data) {
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url;
          a.download = "companion-core-backup-" + new Date().toISOString().slice(0, 10) + ".json";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          message.success(t("exportSuccess"));
        })
        .catch(function (e) { message.error(t("loadFailed", { error: e.message })); });
    }

    function doImport(file) {
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var data = JSON.parse(ev.target.result);
          api.importAll(data)
            .then(function (res) {
              var fields = (res && res.imported) ? res.imported.join(", ") : "";
              message.success(t("importSuccess", { fields: fields }));
              api.health().then(setHealthData).catch(function () {});
            })
            .catch(function (e) { message.error(t("importFailed", { error: e.message })); });
        } catch (err) {
          message.error(t("importFailed", { error: err.message }));
        }
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

    return h("div", {},
      h("div", { style: panelStyle(C) },
        h("div", { style: { fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 12 } }, t("tabData")),
        healthData ? h("div", { style: { display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 } },
          h(Tag, { color: "green" }, "状态: " + (healthData.status || "ok")),
          h(Tag, {}, "梦境: " + (healthData.dreams_count || 0)),
          h(Tag, {}, "便签: " + (healthData.notes_count || 0)),
          h("span", { style: { color: C.muted, fontSize: 12 } }, healthData.data_dir || "")
        ) : null,
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 } },
          h("div", { style: { padding: 16, borderRadius: 8, border: C.border } },
            h("div", { style: { fontWeight: 500, color: C.text, marginBottom: 6 } }, t("exportData")),
            h("div", { style: { color: C.sub, fontSize: 13, marginBottom: 12 } }, t("exportDesc")),
            h(Button, { type: "primary", onClick: doExport }, t("exportData"))),
          h("div", { style: { padding: 16, borderRadius: 8, border: C.border } },
            h("div", { style: { fontWeight: 500, color: C.text, marginBottom: 6 } }, t("importData")),
            h("div", { style: { color: C.sub, fontSize: 13, marginBottom: 12 } }, t("importDesc")),
            h("input", { ref: fileRef, type: "file", accept: ".json", style: { display: "none" }, onChange: onFileChange }),
            h(Popconfirm, {
              title: "导入将覆盖现有数据，确定继续？",
              onConfirm: function () { if (fileRef.current) fileRef.current.click(); },
            }, h(Button, { danger: true }, t("importData")))))));
  }

  // ── Root ─────────────────────────────────────────────────────────────

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
          h("div", { style: { fontSize: 18, fontWeight: 600 } }, t("appTitle")),
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
    label: "Companion Core",
    icon: "💞",
  }]);

  console.info("[companion-core] v2.3.0 registered route /apps/companion-core");
})();
