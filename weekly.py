# -*- coding: utf-8 -*-
"""Weekly review: model-drafted (or rule-summarized) from that week's records.

与日记同一安全姿态：只从当周真实记录起草（history 快照、日记、便签、互动与
关怀投递计数）；无记录或无模型时给规则摘要并明确标注来源；预览确认后才写入；
已存在的周回顾拒绝覆盖；删除需显式调用。
"""
import re
import threading
from datetime import date, timedelta

from fastapi import HTTPException
from pydantic import BaseModel, Field

WEEK_RE = re.compile(r"^(\d{4})-W(\d{2})$")
MAX_CHARS = 6000


class WeekRequest(BaseModel):
    week: str = ""


class WeekApply(BaseModel):
    preview_id: str = Field(min_length=1, max_length=100)


def week_key(day):
    iso = day.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def week_range(key):
    m = WEEK_RE.match(key or "")
    if not m:
        raise HTTPException(400, "周标识须为 YYYY-Www（ISO 周）")
    year, week = int(m.group(1)), int(m.group(2))
    try:
        monday = date.fromisocalendar(year, week, 1)
    except ValueError:
        raise HTTPException(400, "周标识不存在") from None
    return monday, monday + timedelta(days=6)


def install(router, owner, life):
    c = owner.c
    lock = threading.RLock()
    pending = {}
    weekly_dir = c["_DATA_DIR"] / "weekly"

    def week_facts(key):
        monday, sunday = week_range(key)
        today = c["_now"]().date()
        facts = []
        interactions = owner.read_json(c["_DATA_DIR"] / "interactions.json", [])
        notes = owner.read_json(c["_DATA_DIR"] / "notes.json", [])
        day = monday
        while day <= sunday and day <= today:
            day_str = day.isoformat()
            history = c["_read_yaml"](c["_DATA_DIR"] / "history" / f"{day_str}.yaml") or {}
            state = history.get("state") or {}
            bits = [f"{k}={v}" for k, v in state.items()
                    if k in ("mood", "energy", "sleep") and v not in ("", None)]
            diary_path = c["_DATA_DIR"] / "diary" / f"{day_str}.md"
            diary = ""
            if diary_path.is_file() and not diary_path.is_symlink():
                diary = diary_path.read_text(encoding="utf-8").strip()[:120]
            day_notes = [n.get("content", "")[:60] for n in notes
                         if isinstance(n, dict) and str(n.get("created_at", "")).startswith(day_str)]
            tool_calls = sum(int(x.get("count", 0)) for x in interactions
                             if isinstance(x, dict) and x.get("date") == day_str and x.get("kind") == "tool_call")
            care_hits = sum(int(x.get("count", 0)) for x in interactions
                            if isinstance(x, dict) and x.get("date") == day_str and x.get("kind") == "care_delivery")
            line = [day_str]
            if bits:
                line.append("状态 " + "，".join(bits))
            if diary:
                line.append("日记 " + diary)
            if day_notes:
                line.append("便签 " + "；".join(day_notes[:5]))
            if tool_calls:
                line.append(f"工具互动 {tool_calls} 次")
            if care_hits:
                line.append(f"关怀投递 {care_hits} 次")
            if len(line) > 1:
                facts.append(" ｜ ".join(line))
            day += timedelta(days=1)
        return facts

    def rule_summary(key, facts):
        monday, sunday = week_range(key)
        return (f"{key}（{monday.isoformat()} ~ {sunday.isoformat()}）规则摘要：\n"
                + "\n".join("- " + x for x in facts[:14])
                + "\n（未配置模型，以上为按记录直出的摘要，非叙事回顾。）")

    @router.get("/weekly")
    def list_weekly():
        if not weekly_dir.is_dir():
            return []
        out = []
        for path in sorted(weekly_dir.glob("*.md"), reverse=True)[:120]:
            if not WEEK_RE.match(path.stem) or path.is_symlink():
                continue
            try:
                text = path.read_text(encoding="utf-8").strip()
            except OSError:
                text = ""
            out.append({"week": path.stem, "chars": len(text), "preview": text[:80]})
        return out

    @router.get("/weekly/{key}")
    def get_weekly(key: str):
        week_range(key)
        path = weekly_dir / f"{key}.md"
        if path.is_symlink() or not path.is_file():
            raise HTTPException(404, "该周没有回顾")
        return {"week": key, "content": path.read_text(encoding="utf-8")}

    @router.delete("/weekly/{key}")
    def delete_weekly(key: str):
        week_range(key)
        path = weekly_dir / f"{key}.md"
        if path.is_symlink() or not path.is_file():
            raise HTTPException(404, "该周没有回顾")
        path.unlink()
        return {"deleted": key}

    @router.post("/weekly/preview")
    def preview_weekly(payload: WeekRequest):
        key = payload.week or week_key(c["_now"]().date())
        week_range(key)
        facts = week_facts(key)
        if not facts:
            raise HTTPException(400, "当周没有任何记录，不编造回顾")
        try:
            provider = owner.provider(owner.settings(), "dreams")
        except Exception:  # noqa: BLE001
            text, source = rule_summary(key, facts), "rule"
            usage = {}
        else:
            messages = [
                {"role": "system", "content":
                 "你是陪伴角色本人。只依据用户提供的一周记录写第一人称周回顾，"
                 f"不超过{MAX_CHARS}字；没有的事实一律不写；直接输出正文，不要 JSON、不要代码块。"},
                {"role": "user", "content": f"周：{key}\n记录：\n" + "\n".join(facts)},
            ]
            try:
                text, usage = c["_diary_complete"](provider, messages, 900)
                c["_record_usage"]("weekly", usage)
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(502, f"模型调用失败：{exc}") from None
            source = "model"
        if not text or len(text) > MAX_CHARS:
            raise HTTPException(502, "模型返回为空或超长，已拒绝")
        with lock:
            pid = owner.backfill.store(pending, {"week": key, "text": text})
        return {"preview_id": pid, "week": key, "source": source, "text": text,
                "facts": facts, "expires_in_seconds": 600,
                "exists": (weekly_dir / f"{key}.md").is_file()}

    @router.post("/weekly/apply")
    def apply_weekly(payload: WeekApply):
        with lock:
            entry = owner.backfill.get(pending, payload.preview_id)
            if not entry:
                raise HTTPException(410, "预览已过期或不存在，请重新生成")
            weekly_dir.mkdir(parents=True, exist_ok=True)
            path = weekly_dir / f"{entry['week']}.md"
            if path.is_symlink():
                raise HTTPException(409, "周回顾路径不可为符号链接")
            if path.exists():
                raise HTTPException(409, f"{entry['week']} 已有回顾，请先删除，不静默覆盖")
            c["_write_text"](path, entry["text"])
            pending.pop(payload.preview_id, None)
        return {"written": entry["week"], "chars": len(entry["text"])}

    return lambda: None
