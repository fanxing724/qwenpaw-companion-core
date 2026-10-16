# -*- coding: utf-8 -*-
"""Opt-in rule-based life engine: deterministic, lazy state evolution.

演化发生在读取时（lazy），不依赖后台任务或模型：根据业务时区的当前时间
与今日日程推导睡眠/饥饿/精力，仅当结果变化时才写回。只演化空白字段或
上次由引擎写入的字段；用户手动编辑与 Agent 工具写入的字段不会被覆盖。
无可用日程时不演化，不编造状态。
"""
import threading

from fastapi import HTTPException
from pydantic import BaseModel

_EVOLVABLE = ("sleep", "hunger", "energy")
_MEAL_KEYS = ("饭", "餐", "吃")
_NIGHT_SLEEP_KEYS = ("睡觉", "入睡", "晚安")


def _minutes(text):
    try:
        hour, minute = str(text).split(":")
        hour, minute = int(hour), int(minute)
    except (ValueError, TypeError):
        return None
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None
    return hour * 60 + minute


def _fmt(minutes):
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _clamp(value, low, high):
    return max(low, min(high, value))


def _entries(schedule):
    items = []
    for item in schedule.get("plan") or []:
        if not isinstance(item, dict):
            continue
        moment = _minutes(item.get("time"))
        activity = str(item.get("activity") or "").strip()
        if moment is not None and activity:
            items.append((moment, activity))
    return sorted(items)


def evolve(state, schedule, now, auto):
    """Return {field: (value, reason)} for eligible fields that would change.

    Eligible = empty, or previously written by this engine, or stale date.
    Everything is a deterministic function of (now, today's schedule).
    """
    today = now.date().isoformat()
    auto = set(auto or ())
    stale = state.get("date") not in ("", today)

    def eligible(field):
        value = state.get(field)
        return stale or field in auto or value is None or value == ""

    entries = _entries(schedule)
    if not entries:
        return {}
    wake = next((m for m, a in entries if "起床" in a), None)
    sleep_start = next((m for m, a in reversed(entries)
                        if any(k in a for k in _NIGHT_SLEEP_KEYS)
                        or ("休息" in a and "午休" not in a and m >= 20 * 60)), None)
    naps = [(m, a) for m, a in entries if "午休" in a]
    meals = [m for m, a in entries if any(k in a for k in _MEAL_KEYS)]
    now_min = now.hour * 60 + now.minute

    if wake is not None and sleep_start is not None and sleep_start > wake:
        sleeping = now_min >= sleep_start or now_min < wake
    elif sleep_start is not None:
        sleeping = now_min >= sleep_start
    else:
        sleeping = False

    changes = {}

    if eligible("sleep"):
        if sleeping:
            value = f"睡眠中（预计 {_fmt(wake)} 起床）" if wake is not None else "睡眠中"
            reason = "当前处于日程睡眠时段"
        else:
            value = f"清醒中（{_fmt(sleep_start)} 入睡）" if sleep_start is not None else "清醒中"
            reason = "当前处于日程清醒时段"
        if state.get("sleep") != value:
            changes["sleep"] = (value, reason)

    if eligible("energy") and wake is not None:
        if sleeping and sleep_start is not None:
            span = (24 * 60 - sleep_start) + wake
            passed = (now_min - sleep_start) if now_min >= sleep_start else (24 * 60 - sleep_start) + now_min
            value = _clamp(round(25 + 65 * passed / span), 10, 90)
            reason = "睡眠时段精力随恢复曲线上升"
        else:
            hours_awake = max(0.0, (now_min - wake) / 60)
            value = _clamp(round(95 - hours_awake * 4), 15, 100)
            for nap_start, _ in naps:
                if now_min >= nap_start + 60:
                    value = _clamp(value + 10, 15, 100)
            reason = "清醒时长推动精力缓慢下降"
        if state.get("energy") != value:
            changes["energy"] = (value, reason)

    if eligible("hunger") and meals:
        last = max((m for m in meals if m <= now_min), default=None)
        following = min((m for m in meals if m > now_min), default=None)
        if following is not None and following - now_min <= 30:
            value, reason = f"有点饿（临近 {_fmt(following)} 饭点）", "临近下一餐"
        elif last is not None and now_min - last <= 60:
            value, reason = f"刚吃过（{_fmt(last)}），不饿", "餐后一小时内"
        elif last is not None and now_min - last >= 240:
            value, reason = f"有点饿（距 {_fmt(last)} 上一餐较久）", "距上一餐超过 4 小时"
        elif last is None and wake is not None and now_min - wake >= 120:
            value, reason = "有点饿（起床后还未进食）", "起床后长时间未进食"
        else:
            value, reason = "不饿", "两餐之间"
        if state.get("hunger") != value:
            changes["hunger"] = (value, reason)

    return changes


class LifeSettings(BaseModel):
    enabled: bool = False


class Life:
    """Owns life.json and applies rule-based evolution under the shared lock."""

    def __init__(self, owner):
        self.o = owner
        self.c = owner.c
        self.path = self.c["_DATA_DIR"] / "life.json"
        self.lock = threading.RLock()

    def read(self):
        with self.lock:
            data = self.o.read_json(self.path, {})
            if not isinstance(data, dict):
                data = {}
            data.setdefault("enabled", False)
            data.setdefault("auto", [])
            data.setdefault("evolved_at", "")
            data.setdefault("last_reasons", {})
            return data

    def write(self, data):
        with self.lock:
            self.o.private_write(self.path, data)

    def mark_manual(self, fields):
        """Fields written by dashboard/agent/organizer stop being auto-evolved."""
        fields = {f for f in fields if f in _EVOLVABLE}
        if not fields:
            return
        with self.lock:
            cfg = self.read()
            auto = [f for f in cfg.get("auto", []) if f not in fields]
            if auto != cfg.get("auto", []):
                cfg["auto"] = auto
                self.write(cfg)

    def preview(self):
        with self.c["_lock"]:
            state = self.c["_read_yaml"](self.c["_DATA_DIR"] / "state.yaml") or {}
            schedule = self.c["_read_yaml"](self.c["_DATA_DIR"] / "schedule.yaml") or {}
            now = self.c["_now"]()
            changes = evolve(state, schedule, now, self.read().get("auto", []))
        return {field: {"value": value, "reason": reason}
                for field, (value, reason) in changes.items()}

    def maybe_evolve(self):
        """Apply pending evolution; return the applied changes or None.

        Never raises: state reads must stay available even if evolution fails.
        """
        try:
            with self.lock:
                cfg = self.read()
                if not cfg.get("enabled"):
                    return None
                with self.c["_lock"]:
                    state = self.c["_read_yaml"](self.c["_DATA_DIR"] / "state.yaml") or {}
                    schedule = self.c["_read_yaml"](self.c["_DATA_DIR"] / "schedule.yaml") or {}
                    now = self.c["_now"]()
                    changes = evolve(state, schedule, now, cfg.get("auto", []))
                    if not changes:
                        return None
                    merged = {**state,
                              **{field: value for field, (value, _) in changes.items()},
                              "date": state.get("date") or now.date().isoformat()}
                    self.c["_write_yaml"](self.c["_DATA_DIR"] / "state.yaml", merged)
                cfg["auto"] = sorted(set(cfg.get("auto", [])) | set(changes))
                cfg["evolved_at"] = now.isoformat(timespec="seconds")
                cfg["last_reasons"] = {field: reason for field, (_, reason) in changes.items()}
                self.write(cfg)
                return changes
        except Exception:  # noqa: BLE001
            self.c["logger"].exception("[companion] life evolution failed")
            return None

    def summary(self):
        cfg = self.read()
        return {"enabled": bool(cfg.get("enabled")), "evolved_at": cfg.get("evolved_at", "")}


def install(router, owner):
    life = Life(owner)

    @router.get("/life")
    def get_life():
        cfg = life.read()
        return {"enabled": bool(cfg.get("enabled")),
                "evolved_at": cfg.get("evolved_at", ""),
                "auto_fields": cfg.get("auto", []),
                "last_reasons": cfg.get("last_reasons", {}),
                "evolvable_fields": list(_EVOLVABLE),
                "preview": life.preview()}

    @router.put("/life")
    def put_life(payload: LifeSettings):
        cfg = life.read()
        cfg["enabled"] = payload.enabled
        life.write(cfg)
        if payload.enabled:
            life.maybe_evolve()
        return get_life()

    return life
