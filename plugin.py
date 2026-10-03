# -*- coding: utf-8 -*-
"""陪伴核心 — PawApp 后端。

一体化陪伴系统 API：状态管理、梦境记录、日程安排、便签提醒、
关系记录与重要日期。

持久化：YAML/JSON 文件存储于 ``~/.qwenpaw/data/companion-core/``。
首次启动自动补全缺失的种子文件；Agent 通过 REST API 或注册的工具访问所有数据。

接口（挂载于 /api/companion-core/）：

  - GET/PUT  /state              状态读写
  - GET/PUT  /schedule           日程读写
  - GET/POST /dreams             梦境列表/创建
  - GET      /dreams/{date}      指定日期梦境
  - GET/POST /notes              便签列表/创建
  - PUT/DEL  /notes/{id}         更新/删除便签
  - DEL      /notes/expired      清理过期便签
  - GET/PUT  /relationship       关系读写
  - POST     /relationship/decay 应用关系衰减
  - GET/POST /dates              重要日期列表/添加
  - DEL      /dates/{name}       删除重要日期
  - GET      /export             导出所有数据（备份）
  - POST     /import             导入数据（恢复）
  - GET      /health             健康检查

智能体工具（@app.tool，tool_type=internal）：
  - companion_get_state      读取当前状态
  - companion_get_schedule   读取今日日程
  - companion_get_notes      读取便签列表
  - companion_get_relationship 读取关系记录
"""

import asyncio
import json
import logging
import os
import re
import shutil
import threading
import time
from datetime import date, datetime
from pathlib import Path

import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from qwenpaw.pawapp import PawApp

logger = logging.getLogger(__name__)

PLUGIN_VERSION = "2.3.0"
PLUGIN_NAME = "陪伴核心"
PLUGIN_ID = "companion-core"

_PLUGIN_DIR = Path(__file__).resolve().parent
_DATA_DIR = Path(os.environ.get(
    "QWENPAW_COMPANION_DATA",
    Path.home() / ".qwenpaw" / "data" / "companion-core"
))

_lock = threading.Lock()
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


# ── Schemas ──────────────────────────────────────────────────────────

class StateModel(BaseModel):
    date: str = ""
    sleep: str = "昨晚睡得超香"
    dream: str = "不记得做什么梦啦"
    health: str = "身体状态超棒"
    hunger: str = "不饿也不撑刚刚好"
    mood: str = "心情超平和～"
    energy: int = Field(default=70, ge=0, le=100)
    note: str = ""


class ScheduleItem(BaseModel):
    time: str
    activity: str
    mood: str = "平稳"


class ScheduleModel(BaseModel):
    date: str = ""
    plan: list[ScheduleItem] = []


class DreamModel(BaseModel):
    date: str = ""
    content: str = Field(default="", max_length=2000)


class NoteModel(BaseModel):
    id: str = ""
    content: str = Field(default="", max_length=500)
    created_at: str = ""
    expires_at: str = ""
    reminded: bool = False


class RelationshipModel(BaseModel):
    last_updated: str = ""
    warmth_score: int = Field(default=50, ge=10, le=100)
    milestones: list[dict] = []
    notes: str = ""


class ImportantDateModel(BaseModel):
    name: str
    date: str
    note: str = ""


class ImportantDatesModel(BaseModel):
    dates: list[ImportantDateModel] = []


# ── File helpers ─────────────────────────────────────────────────────

def _read_yaml(path: Path) -> dict:
    """Read a YAML file; return {} when missing or unreadable."""
    if not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception as e:  # noqa: BLE001
        logger.warning("[companion] Failed to read YAML %s: %s", path, e)
        return {}


def _write_yaml(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".yaml.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False)
    os.replace(tmp, path)


def _read_json(path: Path) -> list | dict:
    """Read a JSON file; return [] when missing or unreadable."""
    if not path.exists():
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f) or []
    except Exception as e:  # noqa: BLE001
        logger.warning("[companion] Failed to read JSON %s: %s", path, e)
        return []


def _write_json(path: Path, data: list | dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def _read_notes() -> list:
    notes = _read_json(_DATA_DIR / "notes.json")
    return notes if isinstance(notes, list) else []


def _today_str() -> str:
    return date.today().isoformat()


def _now_ts() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _is_expired(note: dict, today: str) -> bool:
    """A note is expired only when it has a non-empty expires_at in the past."""
    expires = str(note.get("expires_at") or "")
    return bool(expires) and expires < today


def _seed_data() -> None:
    """创建用户数据目录并用种子文件初始化。

    优先从插件包的 data/ 目录复制种子文件（用户可在安装前自定义），
    缺失的文件使用 Pydantic 模型默认值。
    """
    (_DATA_DIR / "dreams").mkdir(parents=True, exist_ok=True)

    pkg_data_dir = _PLUGIN_DIR / "data"

    yaml_seeds = {
        "state.yaml": StateModel().model_dump(),
        "schedule.yaml": ScheduleModel().model_dump(),
        "relationship.yaml": RelationshipModel().model_dump(),
        "important_dates.yaml": ImportantDatesModel().model_dump(),
    }
    for name, default_payload in yaml_seeds.items():
        path = _DATA_DIR / name
        if not path.exists():
            pkg_file = pkg_data_dir / name
            if pkg_file.exists():
                shutil.copy2(pkg_file, path)
            else:
                _write_yaml(path, default_payload)

    notes_path = _DATA_DIR / "notes.json"
    if not notes_path.exists():
        pkg_notes = pkg_data_dir / "notes.json"
        if pkg_notes.exists():
            shutil.copy2(pkg_notes, notes_path)
        else:
            _write_json(notes_path, [])


# ── HTTP router ──────────────────────────────────────────────────────

router = APIRouter()


# ==================== 状态 ====================

@router.get("/state", response_model=StateModel)
def get_state():
    """获取当前状态。"""
    with _lock:
        data = _read_yaml(_DATA_DIR / "state.yaml")
    if not data:
        data = StateModel().model_dump()
    return data


@router.put("/state", response_model=StateModel)
def update_state(state: StateModel):
    """更新状态（增量合并，仅覆盖请求中显式提供的字段）。"""
    with _lock:
        path = _DATA_DIR / "state.yaml"
        existing = _read_yaml(path)
        merged = {**existing, **state.model_dump(exclude_unset=True)}
        merged["date"] = merged.get("date") or _today_str()
        _write_yaml(path, merged)
    return merged


# ==================== 日程 ====================

@router.get("/schedule", response_model=ScheduleModel)
def get_schedule():
    """获取今日日程。"""
    with _lock:
        data = _read_yaml(_DATA_DIR / "schedule.yaml")
    if not data:
        data = ScheduleModel().model_dump()
    return data


@router.put("/schedule", response_model=ScheduleModel)
def update_schedule(schedule: ScheduleModel):
    """更新日程（增量合并）。"""
    with _lock:
        path = _DATA_DIR / "schedule.yaml"
        existing = _read_yaml(path)
        merged = {**existing, **schedule.model_dump(exclude_unset=True)}
        merged["date"] = merged.get("date") or _today_str()
        _write_yaml(path, merged)
    return merged


# ==================== 梦境 ====================

@router.get("/dreams", response_model=list[DreamModel])
def list_dreams():
    """列出所有梦境碎片。"""
    dreams_dir = _DATA_DIR / "dreams"
    if not dreams_dir.exists():
        return []
    results = []
    for f in sorted(dreams_dir.glob("*.md"), reverse=True):
        dream_date = f.stem
        try:
            content = f.read_text(encoding="utf-8").strip()
        except Exception:  # noqa: BLE001
            content = ""
        results.append(DreamModel(date=dream_date, content=content[:500]))
    return results


@router.get("/dreams/{dream_date}", response_model=DreamModel)
def get_dream(dream_date: str):
    """获取指定日期的梦境。"""
    if not _DATE_RE.match(dream_date):
        raise HTTPException(400, "日期格式须为 YYYY-MM-DD")
    path = _DATA_DIR / "dreams" / f"{dream_date}.md"
    if not path.exists():
        raise HTTPException(404, f"没有 {dream_date} 的梦境记录")
    return DreamModel(
        date=dream_date,
        content=path.read_text(encoding="utf-8").strip(),
    )


@router.post("/dreams", response_model=DreamModel)
def create_dream(dream: DreamModel):
    """创建梦境碎片。"""
    dream_date = dream.date or _today_str()
    if not _DATE_RE.match(dream_date):
        raise HTTPException(400, "日期格式须为 YYYY-MM-DD")
    if not dream.content.strip():
        raise HTTPException(400, "梦境内容不能为空")

    with _lock:
        path = _DATA_DIR / "dreams" / f"{dream_date}.md"
        if path.exists():
            existing = path.read_text(encoding="utf-8").strip()
            new_content = f"{existing}\n\n---\n\n{dream.content.strip()}"
        else:
            new_content = f"# {dream_date} 的梦\n\n{dream.content.strip()}"
        path.write_text(new_content, encoding="utf-8")

        state_path = _DATA_DIR / "state.yaml"
        state = _read_yaml(state_path)
        if state:
            state["dream"] = dream.content[:80]
            _write_yaml(state_path, state)

    return DreamModel(date=dream_date, content=dream.content)


# ==================== 便签 ====================

@router.get("/notes", response_model=list[NoteModel])
def list_notes(expired: bool = False):
    """列出便签。expired=true 时包含过期便签。"""
    with _lock:
        notes = _read_notes()
    if not expired:
        today = _today_str()
        notes = [n for n in notes if not _is_expired(n, today)]
    return notes


@router.post("/notes", response_model=NoteModel)
def create_note(note: NoteModel):
    """创建便签。"""
    if not note.content.strip():
        raise HTTPException(400, "便签内容不能为空")
    expires = note.expires_at.strip()
    if expires and not _DATE_RE.match(expires):
        raise HTTPException(400, "过期日期格式须为 YYYY-MM-DD")
    with _lock:
        notes = _read_notes()
        entry = {
            "id": f"note_{int(time.time() * 1000)}",
            "content": note.content,
            "created_at": note.created_at or _now_ts(),
            "expires_at": expires,
            "reminded": note.reminded,
        }
        notes.append(entry)
        _write_json(_DATA_DIR / "notes.json", notes)
    return NoteModel(**entry)


@router.delete("/notes/expired")
def clean_expired_notes():
    """清理过期便签。"""
    with _lock:
        notes = _read_notes()
        today = _today_str()
        valid = [n for n in notes if not _is_expired(n, today)]
        cleaned = len(notes) - len(valid)
        if cleaned:
            _write_json(_DATA_DIR / "notes.json", valid)
    return {"cleaned": cleaned}


@router.put("/notes/{note_id}", response_model=NoteModel)
def update_note(note_id: str, note: NoteModel):
    """更新便签（增量合并，如仅标记 reminded）。"""
    with _lock:
        notes = _read_notes()
        for i, n in enumerate(notes):
            if n.get("id") == note_id:
                patch = note.model_dump(exclude_unset=True, exclude={"id"})
                notes[i] = {**n, **patch, "id": note_id}
                _write_json(_DATA_DIR / "notes.json", notes)
                return NoteModel(**notes[i])
    raise HTTPException(404, f"便签 {note_id} 不存在")


@router.delete("/notes/{note_id}")
def delete_note(note_id: str):
    """删除便签。"""
    with _lock:
        notes = _read_notes()
        new_notes = [n for n in notes if n.get("id") != note_id]
        if len(new_notes) == len(notes):
            raise HTTPException(404, f"便签 {note_id} 不存在")
        _write_json(_DATA_DIR / "notes.json", new_notes)
    return {"deleted": note_id}


# ==================== 关系 ====================

@router.get("/relationship", response_model=RelationshipModel)
def get_relationship():
    """获取关系记录。"""
    with _lock:
        data = _read_yaml(_DATA_DIR / "relationship.yaml")
    if not data:
        data = RelationshipModel().model_dump()
    return data


@router.put("/relationship", response_model=RelationshipModel)
def update_relationship(rel: RelationshipModel):
    """更新关系记录（增量合并）。"""
    with _lock:
        path = _DATA_DIR / "relationship.yaml"
        existing = _read_yaml(path)
        merged = {**existing, **rel.model_dump(exclude_unset=True)}
        merged["last_updated"] = _today_str()
        _write_yaml(path, merged)
    return merged


# ==================== 重要日期 ====================

@router.get("/dates", response_model=ImportantDatesModel)
def get_dates():
    """获取重要日期列表。"""
    with _lock:
        data = _read_yaml(_DATA_DIR / "important_dates.yaml")
    if not data or "dates" not in data:
        data = ImportantDatesModel().model_dump()
    return data


@router.post("/dates", response_model=ImportantDatesModel)
def add_date(new_date: ImportantDateModel):
    """添加重要日期。"""
    if not _DATE_RE.match(new_date.date):
        raise HTTPException(400, "日期格式须为 YYYY-MM-DD")
    with _lock:
        path = _DATA_DIR / "important_dates.yaml"
        data = _read_yaml(path)
        if not data or "dates" not in data:
            data = {"dates": []}
        if any(d.get("name") == new_date.name for d in data["dates"]):
            raise HTTPException(409, f"日期「{new_date.name}」已存在")
        data["dates"].append(new_date.model_dump())
        _write_yaml(path, data)
    return data


@router.delete("/dates/{date_name}")
def delete_date(date_name: str):
    """删除重要日期。"""
    with _lock:
        path = _DATA_DIR / "important_dates.yaml"
        data = _read_yaml(path)
        if not data or "dates" not in data:
            raise HTTPException(404, "没有重要日期")
        original = list(data["dates"])
        data["dates"] = [d for d in data["dates"] if d.get("name") != date_name]
        if len(data["dates"]) == len(original):
            raise HTTPException(404, f"日期「{date_name}」不存在")
        _write_yaml(path, data)
    return {"deleted": date_name}


# ==================== 数据导出/导入 ====================

@router.get("/export")
def export_all_data():
    """导出所有数据（用于备份）。"""
    with _lock:
        dreams_dir = _DATA_DIR / "dreams"
        dreams = []
        if dreams_dir.exists():
            for f in sorted(dreams_dir.glob("*.md"), reverse=True):
                try:
                    content = f.read_text(encoding="utf-8").strip()
                except Exception:
                    content = ""
                dreams.append({"date": f.stem, "content": content})

        return {
            "state": _read_yaml(_DATA_DIR / "state.yaml"),
            "schedule": _read_yaml(_DATA_DIR / "schedule.yaml"),
            "dreams": dreams,
            "notes": _read_notes(),
            "relationship": _read_yaml(_DATA_DIR / "relationship.yaml"),
            "dates": _read_yaml(_DATA_DIR / "important_dates.yaml"),
            "exported_at": _now_ts(),
        }


@router.post("/import")
def import_all_data(data: dict):
    """导入数据（覆盖现有数据，用于恢复备份）。

    仅导入已知字段，忽略无效数据。
    """
    imported = []
    with _lock:
        if "state" in data and isinstance(data["state"], dict):
            _write_yaml(_DATA_DIR / "state.yaml", data["state"])
            imported.append("state")
        if "schedule" in data and isinstance(data["schedule"], dict):
            _write_yaml(_DATA_DIR / "schedule.yaml", data["schedule"])
            imported.append("schedule")
        if "dreams" in data and isinstance(data["dreams"], list):
            dreams_dir = _DATA_DIR / "dreams"
            dreams_dir.mkdir(parents=True, exist_ok=True)
            count = 0
            for dream in data["dreams"]:
                if isinstance(dream, dict) and "date" in dream and "content" in dream:
                    dream_date = str(dream["date"])
                    if _DATE_RE.match(dream_date):
                        path = dreams_dir / f"{dream_date}.md"
                        path.write_text(str(dream["content"]), encoding="utf-8")
                        count += 1
            imported.append(f"dreams({count})")
        if "notes" in data and isinstance(data["notes"], list):
            _write_json(_DATA_DIR / "notes.json", data["notes"])
            imported.append("notes")
        if "relationship" in data and isinstance(data["relationship"], dict):
            _write_yaml(_DATA_DIR / "relationship.yaml", data["relationship"])
            imported.append("relationship")
        if "dates" in data and isinstance(data["dates"], dict):
            _write_yaml(_DATA_DIR / "important_dates.yaml", data["dates"])
            imported.append("dates")
    return {"status": "ok", "imported": imported, "imported_at": _now_ts()}


# ==================== 关系衰减 ====================

@router.post("/relationship/decay")
def apply_relationship_decay():
    """应用关系衰减（长时间未互动时亲密度下降）。

    衰减规则：
    - 每天未更新，亲密度下降 1 点
    - 最低降至 10 点（不会降到 0）
    """
    with _lock:
        path = _DATA_DIR / "relationship.yaml"
        data = _read_yaml(path)
        if not data:
            data = RelationshipModel().model_dump()

        last_updated = data.get("last_updated", "")
        if not last_updated:
            return {"decayed": 0, "warmth_score": data.get("warmth_score", 50)}

        try:
            last_date = datetime.strptime(last_updated[:10], "%Y-%m-%d").date()
            today = date.today()
            days_since = (today - last_date).days
        except Exception:
            return {"decayed": 0, "warmth_score": data.get("warmth_score", 50)}

        if days_since <= 0:
            return {"decayed": 0, "warmth_score": data.get("warmth_score", 50)}

        current_score = data.get("warmth_score", 50)
        decay = min(days_since, current_score - 10)
        if decay > 0:
            data["warmth_score"] = max(10, current_score - decay)
            _write_yaml(path, data)

    return {"decayed": decay, "warmth_score": data["warmth_score"], "days_since": days_since}


# ==================== 健康检查 ====================

@router.get("/health")
def health():
    """健康检查。"""
    dreams_dir = _DATA_DIR / "dreams"
    return {
        "status": "ok",
        "data_dir": str(_DATA_DIR),
        "dreams_count": len(list(dreams_dir.glob("*.md")))
        if dreams_dir.exists()
        else 0,
        "notes_count": len(_read_notes()),
    }


# ── PawApp definition + lifecycle ────────────────────────────────────

app = PawApp(name=PLUGIN_NAME, app_id=PLUGIN_ID)
app.include_router(router)


def _text_response(text):
    """agentscope ToolResponse 兼容封装（导入失败时退化为纯字符串）。"""
    try:
        from agentscope.tool import ToolResponse
        from agentscope.message import TextBlock
        return ToolResponse(content=[TextBlock(type="text", text=text)])
    except Exception:  # noqa: BLE001
        return text


@app.tool(
    "companion_get_state",
    description="读取「陪伴核心」的当前状态（心情、精力、睡眠、健康等）。"
                "当用户询问 Agent 的状态、心情或身体情况时调用。",
    icon="🌤",
    tool_type="internal",
    target_param="",
)
async def companion_get_state():
    """读取当前状态并返回自然语言描述。"""
    with _lock:
        data = _read_yaml(_DATA_DIR / "state.yaml")
    if not data:
        data = StateModel().model_dump()
    text = (
        f"当前状态（{data.get('date', '未知日期')}）：\n"
        f"- 心情：{data.get('mood', '未知')}\n"
        f"- 精力：{data.get('energy', 0)}/100\n"
        f"- 睡眠：{data.get('sleep', '未知')}\n"
        f"- 健康：{data.get('health', '未知')}\n"
        f"- 梦境：{data.get('dream', '无')}"
    )
    return _text_response(text)


@app.tool(
    "companion_get_notes",
    description="读取「陪伴核心」的便签列表。当用户说「帮我记一下」「提醒我」"
                "或询问有什么待办事项时调用。",
    icon="📝",
    tool_type="internal",
    target_param="",
)
async def companion_get_notes():
    """读取便签列表并返回。"""
    with _lock:
        notes = _read_notes()
    today = _today_str()
    active = [n for n in notes if not _is_expired(n, today)]
    if not active:
        return _text_response("当前没有便签。")
    lines = [f"当前便签（{len(active)} 条）："]
    for n in active[:10]:
        expires = n.get("expires_at") or "不过期"
        reminded = "已提醒" if n.get("reminded") else "未提醒"
        lines.append(f"- [{reminded}] {n.get('content', '')}（过期：{expires}）")
    return _text_response("\n".join(lines))


@app.tool(
    "companion_get_relationship",
    description="读取「陪伴核心」的关系记录（亲密度、里程碑）。"
                "当需要了解与用户的关系状态时调用。",
    icon="💕",
    tool_type="internal",
    target_param="",
)
async def companion_get_relationship():
    """读取关系记录并返回。"""
    with _lock:
        data = _read_yaml(_DATA_DIR / "relationship.yaml")
    if not data:
        data = RelationshipModel().model_dump()
    milestones = data.get("milestones", [])
    text = (
        f"关系记录：\n"
        f"- 亲密度：{data.get('warmth_score', 50)}/100\n"
        f"- 最后更新：{data.get('last_updated', '未知')}\n"
        f"- 里程碑：{len(milestones)} 个"
    )
    if milestones:
        text += "\n最近里程碑："
        for m in milestones[-3:]:
            text += f"\n  - {m.get('date', '')}: {m.get('event', '')}"
    return _text_response(text)


@app.tool(
    "companion_get_schedule",
    description="读取「陪伴核心」的今日日程。当用户询问今天有什么安排时调用。",
    icon="📅",
    tool_type="internal",
    target_param="",
)
async def companion_get_schedule():
    """读取今日日程并返回自然语言描述。"""
    with _lock:
        data = _read_yaml(_DATA_DIR / "schedule.yaml")
    if not data:
        data = ScheduleModel().model_dump()
    plan = data.get("plan", [])
    date_str = data.get("date", "未知日期")
    if not plan:
        return _text_response(f"今天（{date_str}）还没有安排。")
    lines = [f"今日日程（{date_str}）："]
    for item in plan:
        lines.append(f"  {item.get('time', '')} - {item.get('activity', '')}（{item.get('mood', '')}）")
    return _text_response("\n".join(lines))


@app.tool(
    "companion_update_state",
    description="更新「陪伴核心」的状态。当对话中产生了情绪变化、用户问候后"
                "需要更新心情/精力等状态时调用。仅提交要修改的字段。",
    icon="🌤",
    tool_type="internal",
    target_param="",
)
async def companion_update_state(
    mood: str = "",
    energy: int = -1,
    sleep: str = "",
    health: str = "",
    hunger: str = "",
    dream: str = "",
    note: str = "",
):
    """增量更新状态字段。"""
    patch = {}
    if mood:
        patch["mood"] = mood
    if energy >= 0:
        patch["energy"] = max(0, min(100, energy))
    if sleep:
        patch["sleep"] = sleep
    if health:
        patch["health"] = health
    if hunger:
        patch["hunger"] = hunger
    if dream:
        patch["dream"] = dream
    if note:
        patch["note"] = note
    if not patch:
        return _text_response("没有要更新的字段。")
    with _lock:
        path = _DATA_DIR / "state.yaml"
        existing = _read_yaml(path)
        merged = {**existing, **patch, "date": _today_str()}
        _write_yaml(path, merged)
    fields = "、".join(patch.keys())
    return _text_response(f"已更新状态：{fields}。")


@app.tool(
    "companion_create_note",
    description="创建一条便签。当用户说「帮我记一下」「提醒我」时调用。",
    icon="📝",
    tool_type="internal",
    target_param="",
)
async def companion_create_note(content: str, expires_at: str = ""):
    """创建一条便签。expires_at 为可选的过期日期（YYYY-MM-DD）。"""
    if not content.strip():
        return _text_response("便签内容不能为空。")
    if expires_at and not _DATE_RE.match(expires_at):
        return _text_response("过期日期格式须为 YYYY-MM-DD。")
    with _lock:
        notes = _read_notes()
        entry = {
            "id": f"note_{int(time.time() * 1000)}",
            "content": content.strip(),
            "created_at": _now_ts(),
            "expires_at": expires_at,
            "reminded": False,
        }
        notes.append(entry)
        _write_json(_DATA_DIR / "notes.json", notes)
    return _text_response(f"已记住：{content.strip()}")


@app.tool(
    "companion_get_important_dates",
    description="读取「陪伴核心」的重要日期（生日、纪念日等）。"
                "在主动关怀前或用户提及相关话题时调用。",
    icon="🎂",
    tool_type="internal",
    target_param="",
)
async def companion_get_important_dates():
    """读取重要日期并返回自然语言描述。"""
    with _lock:
        data = _read_yaml(_DATA_DIR / "important_dates.yaml")
    if not data or "dates" not in data:
        return _text_response("还没有记录重要日期。")
    dates = data["dates"]
    if not dates:
        return _text_response("还没有记录重要日期。")
    today = date.today()
    lines = ["重要日期："]
    for d in dates:
        name = d.get("name", "")
        dt = d.get("date", "")
        note = d.get("note", "")
        suffix = ""
        try:
            d_date = datetime.strptime(dt[:10], "%Y-%m-%d").date()
            delta = (d_date.replace(year=today.year) - today).days
            if delta < 0:
                delta = (d_date.replace(year=today.year + 1) - today).days
            if delta == 0:
                suffix = "（就是今天！）"
            elif delta <= 7:
                suffix = f"（还有 {delta} 天）"
        except Exception:  # noqa: BLE001
            pass
        line = f"  - {dt} {name}"
        if note:
            line += f"（{note}）"
        line += suffix
        lines.append(line)
    return _text_response("\n".join(lines))


def _build_prompt(agent) -> str:
    """动态构建系统提示，包含当前数据摘要。"""
    today = _today_str()
    parts = [
        "【陪伴核心系统】用户安装了陪伴核心插件。你可以通过以下工具访问陪伴数据：",
        "- companion_get_state: 读取当前状态",
        "- companion_get_schedule: 读取今日日程",
        "- companion_get_notes: 读取便签列表",
        "- companion_get_relationship: 读取关系记录",
        "- companion_get_important_dates: 读取重要日期",
        "- companion_update_state: 更新状态",
        "- companion_create_note: 创建便签",
        "当用户询问你的状态、心情、便签、日程或关系时，请调用相应工具获取数据后自然回应。",
        "保持人设语气，不要暴露技术细节。",
    ]
    with _lock:
        notes = _read_notes()
    active_notes = [n for n in notes if not _is_expired(n, today)]
    if active_notes:
        parts.append(f"\n当前有 {len(active_notes)} 条活跃便签。")
    try:
        dates_data = _read_yaml(_DATA_DIR / "important_dates.yaml")
        dates_list = dates_data.get("dates", []) if dates_data else []
        today_d = date.today()
        for d in dates_list:
            dt_str = d.get("date", "")
            try:
                d_date = datetime.strptime(dt_str[:10], "%Y-%m-%d").date()
                anniversary = d_date.replace(year=today_d.year)
                if anniversary < today_d:
                    anniversary = d_date.replace(year=today_d.year + 1)
                delta = (anniversary - today_d).days
                if 0 <= delta <= 7:
                    parts.append(f"\n提醒：{d.get('name', '')}（{dt_str}）还有 {delta} 天。")
            except Exception:  # noqa: BLE001
                pass
    except Exception:  # noqa: BLE001
        pass
    return "\n".join(parts)


app.prompt_section(
    "companion_core",
    _build_prompt,
    after="workspace",
    priority=200,
)


@app.on_launch
async def init_companion():
    """Seed the data directory on app launch and clean up stale data."""
    await asyncio.to_thread(_seed_data)
    with _lock:
        notes = _read_notes()
        today = _today_str()
        valid = [n for n in notes if not _is_expired(n, today)]
        if len(valid) < len(notes):
            _write_json(_DATA_DIR / "notes.json", valid)
            logger.info("[companion] Cleaned %d expired note(s) on startup", len(notes) - len(valid))
    logger.info("[companion] v%s loaded, data dir: %s", PLUGIN_VERSION, _DATA_DIR)
    logger.info(
        "[companion] API endpoints: /state, /schedule, /dreams, "
        "/notes, /relationship, /dates, /export, /import, /health",
    )


@app.hook("shutdown")
async def _shutdown() -> None:
    logger.info("[companion] Plugin stopped")


# REQUIRED: 模块级 plugin 实例
plugin = app
