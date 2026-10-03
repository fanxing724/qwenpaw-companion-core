/**
 * Companion Core — frontend (runtime-loaded plugin module).
 *
 * Loaded by the host via usePluginLoader (same-origin Blob URL + dynamic
 * import). Self-registers a React route at /apps/companion-core. React and
 * antd come from window.QwenPaw.host (no bundler in this context).
 *
 * A cozy companion dashboard with six tabs:
 * - State: mood / energy / sleep / health snapshot, editable
 * - Schedule: today's plan timeline
 * - Dreams: dated dream fragments with full-text view
 * - Notes: reminders with expiry — create / mark reminded / delete
 * - Relationship: warmth score and milestones
 * - Dates: important dates management
 */
(function () {
  var QwenPaw = window.QwenPaw;
  if (!QwenPaw || !QwenPaw.host || !QwenPaw.registerRoutes) {
    console.error("[companion-core] window.QwenPaw not ready — cannot register.");
    return;
  }

  var host = QwenPaw.host;
  var React = host.React;
  var antd = host.antd;
  var h = React.createElement;
  var useHostLocale = typeof host.useLocale === "function"
    ? host.useLocale
    : function () { return "en"; };

  var useState = React.useState;
  var useEffect = React.useEffect;

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

  var MESSAGES = {
    zh: {
      appTitle: "陪伴核心",
      appSubtitle: "状态 · 日程 · 梦境 · 便签 · 关系 · 重要日期",
      tabState: "状态", tabSchedule: "日程", tabDreams: "梦境",
      tabNotes: "便签", tabRelationship: "关系", tabDates: "重要日期",
      refresh: "刷新", edit: "编辑", save: "保存", cancel: "取消",
      delete: "删除", close: "关闭", view: "查看",
      saved: "已保存", deleted: "已删除",
      loadFailed: "加载失败: {error}", saveFailed: "保存失败: {error}",
      deleteFailed: "删除失败: {error}",
      fDate: "日期", fMood: "心情", fEnergy: "精力", fSleep: "睡眠",
      fDream: "梦境", fHealth: "健康", fHunger: "饱腹", fNote: "备注",
      noState: "还没有状态数据",
      noPlan: "今天还没有安排", noDreams: "还没有梦境记录",
      dreamOf: "{date} 的梦",
      newNote: "新建便签", cleanExpired: "清理过期", showExpired: "显示过期",
      noteContent: "内容", noteExpires: "过期日期（可选，YYYY-MM-DD）",
      reminded: "已提醒", notReminded: "未提醒", neverExpires: "不过期",
      confirmDeleteNote: "确定删除这条便签吗？",
      contentRequired: "请填写便签内容",
      cleaned: "已清理 {count} 条过期便签",
      warmth: "亲密度", lastUpdated: "更新于 {date}", milestones: "里程碑",
      relNotes: "记录", noMilestones: "还没有里程碑",
      addDate: "添加日期", dateName: "名称", dateValue: "日期（YYYY-MM-DD）",
      dateNote: "备注（可选）", noDates: "还没有重要日期",
      nameRequired: "请填写名称", dateRequired: "请填写日期",
      dateInvalid: "日期格式须为 YYYY-MM-DD",
      confirmDeleteDate: "确定删除「{name}」吗？",
    },
    en: {
      appTitle: "Companion Core",
      appSubtitle: "State · Schedule · Dreams · Notes · Relationship · Dates",
      tabState: "State", tabSchedule: "Schedule", tabDreams: "Dreams",
      tabNotes: "Notes", tabRelationship: "Relationship", tabDates: "Dates",
      refresh: "Refresh", edit: "Edit", save: "Save", cancel: "Cancel",
      delete: "Delete", close: "Close", view: "View",
      saved: "Saved", deleted: "Deleted",
      loadFailed: "Load failed: {error}", saveFailed: "Save failed: {error}",
      deleteFailed: "Delete failed: {error}",
      fDate: "Date", fMood: "Mood", fEnergy: "Energy", fSleep: "Sleep",
      fDream: "Dream", fHealth: "Health", fHunger: "Hunger", fNote: "Note",
      noState: "No state data yet",
      noPlan: "Nothing planned yet", noDreams: "No dreams recorded yet",
      dreamOf: "Dream of {date}",
      newNote: "New note", cleanExpired: "Clean expired", showExpired: "Show expired",
      noteContent: "Content", noteExpires: "Expires at (optional, YYYY-MM-DD)",
      reminded: "Reminded", notReminded: "Not reminded", neverExpires: "Never expires",
      confirmDeleteNote: "Delete this note?",
      contentRequired: "Enter the note content",
      cleaned: "Cleaned {count} expired note(s)",
      warmth: "Warmth", lastUpdated: "Updated {date}", milestones: "Milestones",
      relNotes: "Notes", noMilestones: "No milestones yet",
      addDate: "Add date", dateName: "Name", dateValue: "Date (YYYY-MM-DD)",
      dateNote: "Note (optional)", noDates: "No important dates yet",
      nameRequired: "Enter a name", dateRequired: "Enter the date",
      dateInvalid: "Date must be YYYY-MM-DD",
      confirmDeleteDate: "Delete \"{name}\"?",
    }
  };

  function normalizeLocale(value) {
    return String(value || "").toLowerCase().split("-")[0] === "zh" ? "zh" : "en";
  }

  function tr(locale, key, values) {
    var template = (MESSAGES[locale] && MESSAGES[locale][key]) || MESSAGES.en[key] || key;
    return template.replace(/\{(\w+)\}/g, function (_, name) {
      return values && values[name] !== undefined ? String(values[name]) : "{" + name + "}";
    });
  }

  function isValidDate(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
  }

  // ── API helpers ────────────────────────────────────────────────────────
  function apiFetch(path, opts) {
    opts = opts || {};
    var url = host.getApiUrl(path);
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
    updateState: function (data) { return apiFetch("/companion-core/state", { method: "PUT", body: data }); },
    getSchedule: function () { return apiFetch("/companion-core/schedule"); },
    listDreams: function () { return apiFetch("/companion-core/dreams"); },
    getDream: function (d) { return apiFetch("/companion-core/dreams/" + encodeURIComponent(d)); },
    listNotes: function (expired) { return apiFetch("/companion-core/notes?expired=" + (expired ? "true" : "false")); },
    createNote: function (data) { return apiFetch("/companion-core/notes", { method: "POST", body: data }); },
    updateNote: function (id, data) { return apiFetch("/companion-core/notes/" + encodeURIComponent(id), { method: "PUT", body: data }); },
    deleteNote: function (id) { return apiFetch("/companion-core/notes/" + encodeURIComponent(id), { method: "DELETE" }); },
    cleanExpiredNotes: function () { return apiFetch("/companion-core/notes/expired", { method: "DELETE" }); },
    getRelationship: function () { return apiFetch("/companion-core/relationship"); },
    getDates: function () { return apiFetch("/companion-core/dates"); },
    addDate: function (data) { return apiFetch("/companion-core/dates", { method: "POST", body: data }); },
    deleteDate: function (name) { return apiFetch("/companion-core/dates/" + encodeURIComponent(name), { method: "DELETE" }); },
  };

  // ── Shared styles & bits ───────────────────────────────────────────────
  var C = {
    text: "#1f2937",
    sub: "#6b7280",
    muted: "#9ca3af",
    accent: "#ec4899",
    cardBg: "#ffffff",
    pageBg: "#fafafb",
    border: "1px solid rgba(15,23,42,0.08)",
  };

  function panelStyle() {
    return {
      background: C.cardBg,
      border: C.border,
      borderRadius: 12,
      padding: 16,
    };
  }

  function Field(props) {
    return h("div", { style: { display: "flex", gap: 8, padding: "7px 0", borderBottom: "1px solid rgba(15,23,42,0.05)" } },
      h("div", { style: { width: 64, flexShrink: 0, color: C.sub, fontSize: 13 } }, props.label),
      h("div", { style: { flex: 1, color: C.text, fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, props.children));
  }

  function EditorRow(props) {
    return h("div", {},
      h("div", { style: { fontSize: 12, color: C.sub, marginBottom: 4 } }, props.label),
      props.children);
  }

  function Toolbar(props) {
    return h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 } },
      props.left || h("span", {}),
      props.right || h("span", {}));
  }

  function LoadError(props) {
    return h("div", { style: { padding: 32, textAlign: "center" } },
      h(Empty, { description: props.text }));
  }

  // ── Tab: State ─────────────────────────────────────────────────────────
  function StateTab(props) {
    var t = props.t;
    var _d = useState(null), data = _d[0], setData = _d[1];
    var _e = useState(false), editing = _e[0], setEditing = _e[1];
    var _f = useState(null), form = _f[0], setForm = _f[1];

    function load() {
      api.getState()
        .then(setData)
        .catch(function (e) { message.error(t("loadFailed", { error: e.message })); });
    }
    useEffect(load, []);

    if (!data) return h(LoadError, { text: t("noState") });

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
        h("div", { style: panelStyle() },
          h(Field, { label: t("fMood") }, h(Tag, { color: "pink" }, data.mood || "—")),
          h(Field, { label: t("fSleep") }, data.sleep || "—"),
          h(Field, { label: t("fHealth") }, data.health || "—"),
          h(Field, { label: t("fHunger") }, data.hunger || "—")),
        h("div", { style: panelStyle() },
          h("div", { style: { color: C.sub, fontSize: 13, marginBottom: 4 } }, t("fEnergy")),
          h(Progress, { percent: energy, strokeColor: C.accent }),
          h(Field, { label: t("fDream") }, data.dream || "—"),
          h(Field, { label: t("fNote") }, data.note || "—"))),
      h(Modal, {
        open: editing,
        title: t("edit"),
        okText: t("save"),
        cancelText: t("cancel"),
        onCancel: function () { setEditing(false); },
        onOk: function () {
          api.updateState(form)
            .then(function () { message.success(t("saved")); setEditing(false); load(); })
            .catch(function (e) { message.error(t("saveFailed", { error: e.message })); });
        },
      }, form ? h("div", { style: { display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 } },
        h(EditorRow, { label: t("fMood") }, h(Input, { value: form.mood, onChange: function (e) { setField("mood", e.target.value); } })),
        h(EditorRow, { label: t("fSleep") }, h(Input, { value: form.sleep, onChange: function (e) { setField("sleep", e.target.value); } })),
        h(EditorRow, { label: t("fHealth") }, h(Input, { value: form.health, onChange: function (e) { setField("health", e.target.value); } })),
        h(EditorRow, { label: t("fHunger") }, h(Input, { value: form.hunger, onChange: function (e) { setField("hunger", e.target.value); } })),
        h(EditorRow, { label: t("fDream") }, h(Input, { value: form.dream, onChange: function (e) { setField("dream", e.target.value); } })),
        h(EditorRow, { label: t("fNote") }, h(Input.TextArea, { rows: 2, value: form.note, onChange: function (e) { setField("note", e.target.value); } })),
        h(EditorRow, { label: t("fEnergy") }, h(InputNumber, { min: 0, max: 100, value: form.energy, onChange: function (v) { setField("energy", v); } }))) : null));
  }

  // ── Tab: Schedule ──────────────────────────────────────────────────────
  function ScheduleTab(props) {
    var t = props.t;
    var _d = useState(null), data = _d[0], setData = _d[1];

    function load() {
      api.getSchedule()
        .then(setData)
        .catch(function (e) { message.error(t("loadFailed", { error: e.message })); });
    }
    useEffect(load, []);

    var plan = (data && data.plan) || [];

    return h("div", {},
      h(Toolbar, {
        left: h("span", { style: { color: C.sub, fontSize: 13 } },
          t("tabSchedule") + ((data && data.date) ? " · " + data.date : "")),
        right: h(Button, { size: "small", onClick: load }, t("refresh")),
      }),
      h("div", { style: panelStyle() },
        plan.length === 0
          ? h(Empty, { description: t("noPlan") })
          : plan.map(function (item, idx) {
              return h("div", {
                key: idx,
                style: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: idx < plan.length - 1 ? "1px solid rgba(15,23,42,0.05)" : "none" },
              },
                h("span", { style: { fontFamily: "monospace", fontWeight: 600, color: C.accent, width: 52, flexShrink: 0 } }, item.time || ""),
                h("span", { style: { flex: 1, color: C.text, fontSize: 13 } }, item.activity || ""),
                item.mood ? h(Tag, { color: "purple" }, item.mood) : null);
            })));
  }

  // ── Tab: Dreams ────────────────────────────────────────────────────────
  function DreamsTab(props) {
    var t = props.t;
    var _d = useState(null), dreams = _d[0], setDreams = _d[1];
    var _v = useState(null), viewing = _v[0], setViewing = _v[1];

    function load() {
      api.listDreams()
        .then(setDreams)
        .catch(function (e) { message.error(t("loadFailed", { error: e.message })); });
    }
    useEffect(load, []);

    function openDream(d) {
      api.getDream(d)
        .then(setViewing)
        .catch(function (e) { message.error(t("loadFailed", { error: e.message })); });
    }

    return h("div", {},
      h(Toolbar, {
        left: h("span", { style: { color: C.sub, fontSize: 13 } }, t("tabDreams")),
        right: h(Button, { size: "small", onClick: load }, t("refresh")),
      }),
      h("div", { style: panelStyle() },
        !dreams || dreams.length === 0
          ? h(Empty, { description: t("noDreams") })
          : dreams.map(function (dream, idx) {
              var preview = String(dream.content || "").replace(/^#.*$/m, "").trim().slice(0, 120);
              return h("div", {
                key: dream.date || idx,
                style: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: idx < dreams.length - 1 ? "1px solid rgba(15,23,42,0.05)" : "none", cursor: "pointer" },
                onClick: function () { openDream(dream.date); },
              },
                h(Tag, { color: "blue", style: { flexShrink: 0 } }, dream.date),
                h("span", { style: { flex: 1, color: C.sub, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, preview || "…"),
                h(Button, { size: "small", type: "link" }, t("view")));
            })),
      h(Modal, {
        open: !!viewing,
        title: viewing ? t("dreamOf", { date: viewing.date }) : "",
        footer: null,
        onCancel: function () { setViewing(null); },
      }, viewing ? h("div", { style: { whiteSpace: "pre-wrap", color: C.text, fontSize: 13, maxHeight: "60vh", overflow: "auto" } }, viewing.content) : null));
  }

  // ── Tab: Notes ─────────────────────────────────────────────────────────
  function NotesTab(props) {
    var t = props.t;
    var _n = useState(null), notes = _n[0], setNotes = _n[1];
    var _x = useState(false), showExpired = _x[0], setShowExpired = _x[1];
    var _m = useState(false), modalOpen = _m[0], setModalOpen = _m[1];
    var _f = useState({ content: "", expires_at: "" }), form = _f[0], setForm = _f[1];

    function load(expired) {
      api.listNotes(expired !== undefined ? expired : showExpired)
        .then(setNotes)
        .catch(function (e) { message.error(t("loadFailed", { error: e.message })); });
    }
    useEffect(function () { load(showExpired); }, [showExpired]);

    function toggleReminded(note) {
      api.updateNote(note.id, { reminded: !note.reminded })
        .then(function () { load(); })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); });
    }

    function removeNote(id) {
      api.deleteNote(id)
        .then(function () { message.success(t("deleted")); load(); })
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
        .then(function () {
          message.success(t("saved"));
          setModalOpen(false);
          setForm({ content: "", expires_at: "" });
          load();
        })
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
      h("div", { style: panelStyle() },
        !notes || notes.length === 0
          ? h(Empty, { description: t("tabNotes") })
          : notes.map(function (note, idx) {
              var expired = note.expires_at && note.expires_at < today;
              return h("div", {
                key: note.id || idx,
                style: { padding: "10px 0", borderBottom: idx < notes.length - 1 ? "1px solid rgba(15,23,42,0.05)" : "none", opacity: expired ? 0.55 : 1 },
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
        open: modalOpen,
        title: t("newNote"),
        okText: t("save"),
        cancelText: t("cancel"),
        onCancel: function () { setModalOpen(false); setForm({ content: "", expires_at: "" }); },
        onOk: submitCreate,
      }, h("div", { style: { display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 } },
        h(EditorRow, { label: t("noteContent") },
          h(Input.TextArea, { rows: 3, value: form.content, onChange: function (e) { setForm(Object.assign({}, form, { content: e.target.value })); } })),
        h(EditorRow, { label: t("noteExpires") },
          h(Input, { placeholder: "YYYY-MM-DD", value: form.expires_at, onChange: function (e) { setForm(Object.assign({}, form, { expires_at: e.target.value })); } })))));
  }

  // ── Tab: Relationship ──────────────────────────────────────────────────
  function RelationshipTab(props) {
    var t = props.t;
    var _d = useState(null), data = _d[0], setData = _d[1];

    function load() {
      api.getRelationship()
        .then(setData)
        .catch(function (e) { message.error(t("loadFailed", { error: e.message })); });
    }
    useEffect(load, []);

    if (!data) return h(LoadError, { text: "…" });

    var warmth = typeof data.warmth_score === "number" ? data.warmth_score : 0;
    var milestones = data.milestones || [];

    return h("div", {},
      h(Toolbar, {
        left: h("span", { style: { color: C.sub, fontSize: 13 } },
          data.last_updated ? t("lastUpdated", { date: data.last_updated }) : ""),
        right: h(Button, { size: "small", onClick: load }, t("refresh")),
      }),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 } },
        h("div", { style: panelStyle() },
          h("div", { style: { color: C.sub, fontSize: 13, marginBottom: 4 } }, t("warmth")),
          h(Progress, { percent: warmth, strokeColor: C.accent }),
          h("div", { style: { color: C.sub, fontSize: 13, margin: "12px 0 4px" } }, t("relNotes")),
          h("div", { style: { color: C.text, fontSize: 13, whiteSpace: "pre-wrap" } }, data.notes || "—")),
        h("div", { style: panelStyle() },
          h("div", { style: { color: C.sub, fontSize: 13, marginBottom: 8 } }, t("milestones")),
          milestones.length === 0
            ? h(Empty, { image: Empty.PRESENTED_IMAGE_SIMPLE, description: t("noMilestones") })
            : milestones.map(function (m, idx) {
                return h("div", { key: idx, style: { display: "flex", gap: 10, padding: "8px 0", borderBottom: idx < milestones.length - 1 ? "1px solid rgba(15,23,42,0.05)" : "none" } },
                  h(Tag, { color: "pink", style: { flexShrink: 0 } }, m.date || ""),
                  h("span", { style: { color: C.text, fontSize: 13 } }, m.event || ""));
              }))));
  }

  // ── Tab: Important dates ───────────────────────────────────────────────
  function DatesTab(props) {
    var t = props.t;
    var _d = useState(null), dates = _d[0], setDates = _d[1];
    var _m = useState(false), modalOpen = _m[0], setModalOpen = _m[1];
    var _f = useState({ name: "", date: "", note: "" }), form = _f[0], setForm = _f[1];

    function load() {
      api.getDates()
        .then(function (res) { setDates((res && res.dates) || []); })
        .catch(function (e) { message.error(t("loadFailed", { error: e.message })); });
    }
    useEffect(load, []);

    function removeDate(name) {
      api.deleteDate(name)
        .then(function () { message.success(t("deleted")); load(); })
        .catch(function (e) { message.error(t("deleteFailed", { error: e.message })); });
    }

    function submitAdd() {
      if (!form.name || !form.name.trim()) { message.warning(t("nameRequired")); return; }
      if (!form.date) { message.warning(t("dateRequired")); return; }
      if (!isValidDate(form.date)) { message.warning(t("dateInvalid")); return; }
      api.addDate({ name: form.name.trim(), date: form.date, note: form.note || "" })
        .then(function () {
          message.success(t("saved"));
          setModalOpen(false);
          setForm({ name: "", date: "", note: "" });
          load();
        })
        .catch(function (e) { message.error(t("saveFailed", { error: e.message })); });
    }

    return h("div", {},
      h(Toolbar, {
        left: h(Button, { size: "small", type: "primary", onClick: function () { setModalOpen(true); } }, t("addDate")),
        right: h(Button, { size: "small", onClick: load }, t("refresh")),
      }),
      h("div", { style: panelStyle() },
        !dates || dates.length === 0
          ? h(Empty, { description: t("noDates") })
          : dates.map(function (item, idx) {
              return h("div", { key: item.name || idx, style: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: idx < dates.length - 1 ? "1px solid rgba(15,23,42,0.05)" : "none" } },
                h(Tag, { color: "magenta", style: { flexShrink: 0, fontFamily: "monospace" } }, item.date || ""),
                h("span", { style: { color: C.text, fontSize: 13, fontWeight: 500 } }, item.name || ""),
                h("span", { style: { flex: 1, color: C.muted, fontSize: 12 } }, item.note || ""),
                h(Popconfirm, { title: t("confirmDeleteDate", { name: item.name }), onConfirm: function () { removeDate(item.name); } },
                  h(Button, { size: "small", type: "link", danger: true }, t("delete"))));
            })),
      h(Modal, {
        open: modalOpen,
        title: t("addDate"),
        okText: t("save"),
        cancelText: t("cancel"),
        onCancel: function () { setModalOpen(false); setForm({ name: "", date: "", note: "" }); },
        onOk: submitAdd,
      }, h("div", { style: { display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 } },
        h(EditorRow, { label: t("dateName") },
          h(Input, { value: form.name, onChange: function (e) { setForm(Object.assign({}, form, { name: e.target.value })); } })),
        h(EditorRow, { label: t("dateValue") },
          h(Input, { placeholder: "YYYY-MM-DD", value: form.date, onChange: function (e) { setForm(Object.assign({}, form, { date: e.target.value })); } })),
        h(EditorRow, { label: t("dateNote") },
          h(Input, { value: form.note, onChange: function (e) { setForm(Object.assign({}, form, { note: e.target.value })); } })))));
  }

  // ── Root ───────────────────────────────────────────────────────────────
  function CompanionApp() {
    var locale = normalizeLocale(useHostLocale());
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
          { key: "state", label: "🌤 " + t("tabState"), children: h(StateTab, { t: t }) },
          { key: "schedule", label: "📅 " + t("tabSchedule"), children: h(ScheduleTab, { t: t }) },
          { key: "dreams", label: "💭 " + t("tabDreams"), children: h(DreamsTab, { t: t }) },
          { key: "notes", label: "📝 " + t("tabNotes"), children: h(NotesTab, { t: t }) },
          { key: "relationship", label: "💕 " + t("tabRelationship"), children: h(RelationshipTab, { t: t }) },
          { key: "dates", label: "🎂 " + t("tabDates"), children: h(DatesTab, { t: t }) },
        ],
      }));
  }

  // ── Self-register route ─────────────────────────────────────────────────
  QwenPaw.registerRoutes("companion-core", [
    {
      path: "/apps/companion-core",
      component: CompanionApp,
      label: "Companion Core",
      icon: "💞",
    },
  ]);

  console.info("[companion-core] registered route /apps/companion-core");
})();
