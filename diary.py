# -*- coding: utf-8 -*-
"""Opt-in companion diary: model-drafted from real records, preview then apply.

日记只从当天真实记录（history 快照、当日便签）起草；无模型配置不生成，
不编造内容。写入前预览确认；已存在的日记拒绝覆盖（409），删除需显式调用。
模型配置复用 organizer 的 dreams 模块（未单独配置时回退公共模型）。
"""
import json
import re
import threading
from urllib.request import HTTPRedirectHandler, Request as URLRequest, build_opener

from fastapi import HTTPException
from pydantic import BaseModel, Field, field_validator

MAX_CHARS = 4000
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class DiarySettings(BaseModel):
    auto: bool = False
    time: str = "22:30"
    tokens: int = Field(default=600, ge=100, le=2000)
    agent_id: str = Field(default="", max_length=200)
    token: str = ""

    @field_validator("time")
    @classmethod
    def clock(cls, value):
        if not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", value):
            raise ValueError("时间须为 HH:MM")
        return value


class DiaryPreviewRequest(BaseModel):
    date: str = ""

    @field_validator("date")
    @classmethod
    def valid(cls, value):
        if value and not _DATE_RE.match(value):
            raise ValueError("日期格式须为 YYYY-MM-DD")
        return value


class DiaryApplyRequest(BaseModel):
    preview_id: str = Field(min_length=1, max_length=100)


def _raw_complete(provider, messages, tokens):
    """Single non-redirecting model call returning raw text (no JSON envelope)."""
    url, model, secret = provider
    endpoint = url if url.endswith("/chat/completions") else url + "/chat/completions"
    headers = {"Content-Type": "application/json"}
    if secret:
        headers["Authorization"] = "Bearer " + secret
    payload = {"model": model, "messages": messages, "max_tokens": tokens, "stream": False}
    request = URLRequest(endpoint, data=json.dumps(payload).encode(), headers=headers, method="POST")
    with build_opener(_NoRedirect).open(request, timeout=60) as response:
        raw = response.read(1024 * 1024 + 1)
    if len(raw) > 1024 * 1024:
        raise ValueError("model response too large")
    result = json.loads(raw)
    choice = result["choices"][0]
    if choice.get("finish_reason") in {"length", "content_filter"}:
        raise ValueError("incomplete model response")
    text = (choice.get("message") or {}).get("content") or ""
    if text.startswith("```"):
        text = "\n".join(text.splitlines()[1:-1])
    return text.strip(), result.get("usage", {})


def _valid_day(day):
    if not _DATE_RE.match(day):
        return False
    try:
        from datetime import date as _date
        _date.fromisoformat(day)
    except ValueError:
        return False
    return True


def install(router, owner, life):
    c = owner.c
    c["_diary_complete"] = _raw_complete
    lock = threading.RLock()
    pending = {}
    settings_path = c["_DATA_DIR"] / "diary-settings.json"
    diary_dir = c["_DATA_DIR"] / "diary"

    def read_settings():
        data = owner.read_json(settings_path, {})
        base = DiarySettings().model_dump()
        if isinstance(data, dict):
            base.update({k: v for k, v in data.items() if k in base})
        return DiarySettings.model_validate(base).model_dump()

    def write_settings(data):
        owner.private_write(settings_path, data)

    def day_facts(day):
        facts = []
        history = c["_read_yaml"](c["_DATA_DIR"] / "history" / f"{day}.yaml") or {}
        state = history.get("state") or {}
        schedule = history.get("schedule") or {}
        if state:
            bits = [f"{k}: {v}" for k, v in state.items() if v not in ("", None) and k != "date"]
            if bits:
                facts.append("状态：" + "；".join(bits))
        plan = schedule.get("plan") or []
        if plan:
            facts.append("日程：" + "；".join(f"{x.get('time','')} {x.get('activity','')}" for x in plan[:12]))
        notes = owner.read_json(c["_DATA_DIR"] / "notes.json", [])
        today_notes = [n.get("content", "") for n in notes
                       if isinstance(n, dict) and str(n.get("created_at", "")).startswith(day) and n.get("content")]
        if today_notes:
            facts.append("便签：" + "；".join(today_notes[:10]))
        return facts

    @router.get("/diary")
    def list_diary():
        if not diary_dir.is_dir():
            return []
        out = []
        for path in sorted(diary_dir.glob("*.md"), reverse=True)[:400]:
            if not _DATE_RE.match(path.stem) or path.is_symlink():
                continue
            try:
                text = path.read_text(encoding="utf-8").strip()
            except OSError:
                text = ""
            out.append({"date": path.stem, "chars": len(text), "preview": text[:80]})
        return out

    @router.get("/diary/settings")
    def get_diary_settings():
        return read_settings()

    @router.get("/diary/status")
    def diary_status():
        return owner.read_json(status_path, {})

    def register_hooks():
        app = c["app"]
        if app is None or not hasattr(app, "runtime_hook"):
            return
        try:
            from qwenpaw.runtime.hooks import HookBase, HookResult, HookAction
            from qwenpaw.runtime.phases import Phase
        except ImportError:
            return
        if not hasattr(HookAction, "SKIP_AGENT") or not hasattr(Phase, "PRE_DISPATCH"):
            return

        class DiaryTick(HookBase):
            phase = Phase.PRE_DISPATCH
            name = "companion_diary_tick"
            priority = 2

            async def run(self, ctx):
                cfg = read_settings()
                context = getattr(ctx.request, "request_context", None) or {}
                if context.get("source") == "cron" and context.get("cron_job_id") == job_id(cfg.get("agent_id", "")):
                    token = getattr(ctx.request, "companion_diary_token", None)
                    if token and cfg.get("token") == token:
                        await generate_today()
                    return HookResult(action=HookAction.SKIP_AGENT)
                return HookResult()

        app.runtime_hook(DiaryTick())

    register_hooks()

    if c["app"] is not None and hasattr(c["app"], "on_uninstall"):
        async def _uninstall(delete_files=False, **_kw):
            if not delete_files:
                return
            cfg = read_settings()
            if cfg.get("auto") and cfg.get("agent_id"):
                await unregister_job(cfg["agent_id"])
        c["app"].on_uninstall(_uninstall)


    status_path = c["_DATA_DIR"] / "diary-status.json"

    def job_id(agent_id):
        import hashlib
        return "companion-diary-" + hashlib.sha256(agent_id.encode()).hexdigest()[:20]

    def write_status(info):
        owner.private_write(status_path, info)

    async def generate_today():
        """Plugin-side diary generation for today; never raises."""
        day = c["_today_str"]()
        info = owner.read_json(status_path, {})
        try:
            diary_dir.mkdir(parents=True, exist_ok=True)
            path = diary_dir / f"{day}.md"
            if path.exists():
                info.update({"state": "skipped", "reason": "already-exists", "at": c["_now_ts"]()})
                write_status(info)
                return info
            facts = day_facts(day)
            if not facts:
                info.update({"state": "skipped", "reason": "no-records", "at": c["_now_ts"]()})
                write_status(info)
                return info
            provider = owner.provider(owner.settings(), "dreams")
            settings = read_settings()
            messages = [
                {"role": "system", "content":
                 "你是陪伴角色本人。只依据用户提供的事实写第一人称日记，"
                 f"不超过{MAX_CHARS}字；没有的事实一律不写；直接输出正文，不要 JSON、不要代码块、不要标题。"},
                {"role": "user", "content": f"日期：{day}\n事实：\n" + "\n".join(facts)},
            ]
            text, usage = c["_diary_complete"](provider, messages, settings["tokens"])
            if not text or len(text) > MAX_CHARS:
                raise ValueError("empty or overlong model text")
            c["_write_text"](path, text)
            info.update({"state": "written", "date": day, "chars": len(text),
                         "usage": usage, "at": c["_now_ts"]()})
            write_status(info)
        except Exception as exc:  # noqa: BLE001 - 自动任务失败只记录，不影响宿主
            info.update({"state": "error", "error": str(exc), "at": c["_now_ts"]()})
            write_status(info)
        return info

    async def _workspace(agent_id):
        from qwenpaw.plugins.registry import PluginRegistry
        host = PluginRegistry().get_workspace_manager()
        if host is None:
            raise HTTPException(503, "宿主不提供工作区管理接口")
        return await host.get_agent(agent_id)

    def first_bound_agent():
        try:
            load_config, load_agent_config, _, _ = c["_host_config_api"]()
            config = load_config()
            for agent_id in config.agents.profiles:
                row = c["_agent_binding_row"](agent_id, config.agents.profiles[agent_id],
                                              load_agent_config(agent_id))
                if row["binding"] == "bound":
                    return agent_id
        except Exception:  # noqa: BLE001
            return None
        return None

    async def register_job(agent_id):
        ws = await _workspace(agent_id)
        manager = getattr(ws, "cron_manager", None)
        if not c["care"].scheduling_supported(manager):
            raise HTTPException(503, "宿主未提供兼容的公开 CronManager 接口，不能创建自动日记任务")
        chats = await ws.chat_manager.list_chats()
        if not chats:
            raise HTTPException(400, "该智能体没有可用会话作为静默投递目标")
        target = chats[0]
        settings = read_settings()
        hour, minute = settings["time"].split(":")
        from qwenpaw.app.crons.models import CronJobSpec
        spec = CronJobSpec.model_validate({
            "id": job_id(agent_id), "name": "陪伴核心：每日日记", "enabled": True,
            "schedule": {"type": "cron", "cron": f"{int(minute)} {int(hour)} * * *",
                         "timezone": c["_TIMEZONE_NAME"]},
            "task_type": "agent",
            "request": {"input": [], "companion_diary_token": settings["token"]},
            "dispatch": {"channel": target.channel, "silent": True, "mode": "final",
                         "target": {"user_id": target.user_id, "session_id": target.session_id}},
            "runtime": {"max_concurrency": 1, "timeout_seconds": 120,
                        "misfire_grace_seconds": 600, "share_session": False, "tool_safety": True},
            "meta": {"owner": "companion-core", "agent_id": agent_id}})
        existing = await manager.get_job(spec.id)
        if existing and getattr(existing, "meta", {}).get("owner") != "companion-core":
            raise HTTPException(409, "任务 ID 已被其他任务使用")
        await manager.create_or_replace_job(spec)

    async def unregister_job(agent_id):
        try:
            ws = await _workspace(agent_id)
        except Exception:  # noqa: BLE001
            return
        manager = getattr(ws, "cron_manager", None)
        if manager is None:
            return
        existing = await manager.get_job(job_id(agent_id))
        if existing and getattr(existing, "meta", {}).get("owner") == "companion-core":
            await manager.delete_job(job_id(agent_id))

    @router.put("/diary/settings")
    async def put_diary_settings(payload: DiarySettings):
        with lock:
            previous = read_settings()
            data = payload.model_dump()
            data["token"] = previous.get("token") or __import__("uuid").uuid4().hex
            write_settings(data)
        if data["auto"] and not previous.get("auto"):
            agent_id = data["agent_id"]
            if not agent_id:
                agent_id = first_bound_agent()
                if not agent_id:
                    raise HTTPException(400, "请先绑定一个智能体，自动日记需要它作为触发载体")
                data["agent_id"] = agent_id
                with lock:
                    write_settings(data)
            await register_job(agent_id)
        if not data["auto"] and previous.get("auto") and previous.get("agent_id"):
            await unregister_job(previous["agent_id"])
        return read_settings()

    @router.get("/diary/{day}")
    def get_diary(day: str):
        if not _valid_day(day):
            raise HTTPException(400, "日期不存在")
        path = diary_dir / f"{day}.md"
        if path.is_symlink() or not path.is_file():
            raise HTTPException(404, "该日没有日记")
        return {"date": day, "content": path.read_text(encoding="utf-8")}

    @router.delete("/diary/{day}")
    def delete_diary(day: str):
        if not _valid_day(day):
            raise HTTPException(400, "日期不存在")
        path = diary_dir / f"{day}.md"
        if path.is_symlink() or not path.is_file():
            raise HTTPException(404, "该日没有日记")
        path.unlink()
        return {"deleted": day}

    @router.post("/diary/preview")
    def preview_diary(payload: DiaryPreviewRequest):
        day = payload.date or c["_today_str"]()
        if not _valid_day(day):
            raise HTTPException(400, "日期不存在")
        facts = day_facts(day)
        if not facts:
            raise HTTPException(400, "当天没有任何记录，不编造日记")
        settings = read_settings()
        try:
            provider = owner.provider(owner.settings(), "dreams")
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(400, f"日记模型未配置或不可用：{exc}") from None
        messages = [
            {"role": "system", "content":
             "你是陪伴角色本人。只依据用户提供的事实写第一人称日记，"
             f"不超过{MAX_CHARS}字；没有的事实一律不写；直接输出正文，不要 JSON、不要代码块、不要标题。"},
            {"role": "user", "content": f"日期：{day}\n事实：\n" + "\n".join(facts)},
        ]
        try:
            text, usage = c["_diary_complete"](provider, messages, settings["tokens"])
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(502, f"模型调用失败：{exc}") from None
        if not text or len(text) > MAX_CHARS:
            raise HTTPException(502, "模型返回为空或超长，已拒绝")
        with lock:
            key = owner.backfill.store(pending, {"date": day, "text": text, "facts": facts})
        return {"preview_id": key, "date": day, "text": text, "facts": facts,
                "usage": usage, "expires_in_seconds": 600,
                "exists": (diary_dir / f"{day}.md").is_file()}

    @router.post("/diary/apply")
    def apply_diary(payload: DiaryApplyRequest):
        with lock:
            entry = owner.backfill.get(pending, payload.preview_id)
            if not entry:
                raise HTTPException(410, "预览已过期或不存在，请重新生成")
            diary_dir.mkdir(parents=True, exist_ok=True)
            path = diary_dir / f"{entry['date']}.md"
            if path.is_symlink():
                raise HTTPException(409, "日记路径不可为符号链接")
            if path.exists():
                raise HTTPException(409, f"{entry['date']} 已有日记，请先删除或换日期，不静默覆盖")
            c["_write_text"](path, entry["text"])
            pending.pop(payload.preview_id, None)
        return {"written": entry["date"], "chars": len(entry["text"])}

    return read_settings
