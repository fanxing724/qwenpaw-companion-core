# -*- coding: utf-8 -*-
"""Planning mode: one model pass drafts routine + organizer cadence + care hints.

预览确认制：模型结果先校验再入 pending，应用时才写盘。作息与整理节奏可直接
写入；关怀只返回预填建议（必须走关怀自身的预览-确认流），不静默开启主动消息。
无模型配置时只返回规则生成的作息草稿（不经模型），其余明确标为不可用。
"""
import re
import threading

from fastapi import HTTPException
from pydantic import BaseModel, Field

_CLOCK = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class PlanRequest(BaseModel):
    weekend: bool = False
    notes: str = Field(default="", max_length=500)


class PlanApply(BaseModel):
    preview_id: str = Field(min_length=1, max_length=100)


def _quiet_ok(time, quiet_start, quiet_end):
    def minutes(value):
        hour, minute = value.split(":")
        return int(hour) * 60 + int(minute)
    t, a, b = minutes(time), minutes(quiet_start), minutes(quiet_end)
    if a <= b:
        return not (a <= t < b)
    return not (t >= a or t < b)


def install(router, owner, life):
    c = owner.c
    lock = threading.RLock()
    pending = {}

    def rule_draft(weekend):
        """Deterministic fallback routine when no model is configured."""
        base = [("08:00", "起床洗漱，吃早餐"), ("09:00", "上午工作/学习"), ("12:00", "午饭"),
                ("13:00", "午休"), ("14:30", "下午工作/学习"), ("18:30", "晚饭"),
                ("20:00", "晚间休闲"), ("23:00", "睡觉")]
        if weekend:
            base = [("09:30", "起床洗漱，吃早餐"), ("10:30", "自由安排/外出"), ("12:30", "午饭"),
                    ("14:00", "午休或兴趣时间"), ("18:30", "晚饭"), ("21:00", "晚间休闲"),
                    ("23:30", "睡觉")]
        return [{"time": t, "activity": a, "mood": "平稳"} for t, a in base]

    def validate_plan(raw):
        routine = raw.get("routine") or []
        if not isinstance(routine, list) or not routine:
            raise ValueError("routine 必须是非空列表")
        plan = c["ScheduleModel"](plan=routine).plan
        organizer = raw.get("organizer") or {}
        interval = int(organizer.get("interval_minutes", 30))
        if not 30 <= interval <= 720:
            raise ValueError("整理间隔须在 30-720 分钟")
        care = raw.get("care") or {}
        for key in ("time", "quiet_start", "quiet_end"):
            if not _CLOCK.match(str(care.get(key, ""))):
                raise ValueError(f"care.{key} 须为 HH:MM")
        if not _quiet_ok(care["time"], care["quiet_start"], care["quiet_end"]):
            raise ValueError("关怀时间落在静默时段内")
        return {"routine": [item.model_dump() for item in plan],
                "organizer": {"auto_enabled": bool(organizer.get("auto_enabled", False)),
                              "interval_minutes": interval},
                "care": care}

    @router.post("/plan/preview")
    def plan_preview(payload: PlanRequest):
        context = []
        routine_now = c["_read_yaml"](c["_DATA_DIR"] / "routine.yaml") or {}
        if routine_now.get("plan"):
            context.append("现有作息：" + "；".join(
                f"{x.get('time','')} {x.get('activity','')}" for x in routine_now["plan"][:12]))
        relationship = c["_read_yaml"](c["_DATA_DIR"] / "relationship.yaml") or {}
        if relationship.get("description"):
            context.append("关系描述：" + str(relationship["description"])[:200])
        setup = owner.read_json(c["_DATA_DIR"] / "setup.json", {})
        profile = (setup or {}).get("profile") or {}
        names = [profile.get("user_name"), profile.get("companion_name")]
        if any(names):
            context.append("称呼：" + " / ".join(x for x in names if x))
        if payload.notes:
            context.append("用户偏好：" + payload.notes)
        try:
            provider = owner.provider(owner.settings(), "dreams")
        except Exception:  # noqa: BLE001 - 无模型走规则草稿
            draft = {"routine": rule_draft(payload.weekend),
                     "organizer": {"auto_enabled": False, "interval_minutes": 30},
                     "care": {"time": "08:15", "quiet_start": "23:00", "quiet_end": "08:00"}}
            with lock:
                key = owner.backfill.store(pending, {"plan": draft})
            return {"preview_id": key, "source": "rule", "model_available": False,
                    "plan": draft, "expires_in_seconds": 600,
                    "notice": "未配置模型：仅生成规则作息草稿，整理节奏与关怀建议需手动配置"}
        messages = [
            {"role": "system", "content":
             "你是陪伴系统规划器。输出 JSON：{\"changes\": {\"routine\": [{\"time\":\"HH:MM\","
             "\"activity\":\"...\",\"mood\":\"平稳\"}], \"organizer\": {\"auto_enabled\": bool,"
             " \"interval_minutes\": int}, \"care\": {\"time\":\"HH:MM\",\"quiet_start\":\"HH:MM\","
             "\"quiet_end\":\"HH:MM\"}}}。routine 6-10 条、时间递增；关怀时间必须避开静默时段；"
             "只输出 JSON。"},
            {"role": "user", "content":
             ("周末规划" if payload.weekend else "工作日规划") + "\n" + "\n".join(context or ["无额外上下文"])},
        ]
        try:
            changes, usage = owner.complete(provider, messages, 900)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(502, f"规划模型调用失败：{exc}") from None
        try:
            plan = validate_plan(changes)
        except (ValueError, TypeError, KeyError) as exc:
            raise HTTPException(502, f"模型规划结果无效：{exc}") from None
        with lock:
            key = owner.backfill.store(pending, {"plan": plan, "usage": usage})
        return {"preview_id": key, "source": "model", "model_available": True,
                "plan": plan, "usage": usage, "expires_in_seconds": 600}

    @router.post("/plan/apply")
    def plan_apply(payload: PlanApply):
        preview_id = payload.preview_id
        with lock:
            entry = owner.backfill.get(pending, preview_id)
            if not entry:
                raise HTTPException(410, "预览已过期或不存在，请重新生成")
            plan = entry["plan"]
            c["_write_yaml"](c["_DATA_DIR"] / "routine.yaml",
                             {"enabled": True, "plan": plan["routine"]})
            written = ["routine"]
            raw = owner.read_json(owner.path, {})
            if raw:
                raw["auto_enabled"] = plan["organizer"]["auto_enabled"]
                raw["interval_minutes"] = plan["organizer"]["interval_minutes"]
                validated = c["_organizer_module"].OrganizerSettings.model_validate(raw)
                owner.private_write(owner.path, validated.model_dump())
                written.append("organizer")
        return {"written": written,
                "care_suggestion": plan["care"],
                "notice": "关怀设置未自动写入：请到关怀页预览并确认后启用（防打扰与投递目标需本人确认）"}

    return lambda: None
