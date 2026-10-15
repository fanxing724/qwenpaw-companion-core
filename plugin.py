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
  - companion_get_state          读取当前状态
  - companion_get_schedule       读取今日日程
  - companion_get_notes          读取便签列表
  - companion_get_relationship   读取关系记录
  - companion_get_important_dates 读取重要日期
  - companion_update_state       更新状态字段
  - companion_create_note        创建便签
"""

import asyncio
import json
import logging
import os
import re
import threading
from contextlib import nullcontext
from functools import wraps
from uuid import uuid4
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, ValidationError, field_validator

try:
    from qwenpaw.pawapp import PawApp
except ModuleNotFoundError as exc:
    if exc.name not in {"qwenpaw", "qwenpaw.pawapp"}:
        raise
    PawApp = None

logger = logging.getLogger(__name__)

PLUGIN_VERSION = json.loads((Path(__file__).resolve().parent / "plugin.json").read_text(encoding="utf-8"))["version"]
PLUGIN_NAME = "陪伴核心"
PLUGIN_ID = "companion-core"
TOOL_NAMES = tuple(item["name"] for item in json.loads(
    (Path(__file__).resolve().parent / "plugin.json").read_text(encoding="utf-8")
)["meta"]["tools"])
# Business dates are independent of the host/container timezone.
_TIMEZONE_NAME = os.environ.get("QWENPAW_COMPANION_TIMEZONE", "Asia/Shanghai")
_TIMEZONE = ZoneInfo(_TIMEZONE_NAME)

_binding_lock = threading.Lock()
_call_history = {}  # Bounded latest call per agent; no conversation content stored.


_PLUGIN_DIR = Path(__file__).resolve().parent
_DATA_DIR = Path(os.environ.get(
    "QWENPAW_COMPANION_DATA",
    Path.home() / ".qwenpaw" / "data" / "companion-core"
))

_lock = threading.Lock()
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _days_until_anniversary(value: str, today: date) -> int:
    original = date.fromisoformat(value)
    for year in range(today.year, today.year + 9):
        try:
            upcoming = original.replace(year=year)
        except ValueError:
            continue  # February 29 recurs on the next leap year.
        if upcoming >= today:
            return (upcoming - today).days
    raise ValueError("无法计算周年日期")


# ── Schemas ──────────────────────────────────────────────────────────

def _validate_date(value: str) -> str:
    if value:
        if not _DATE_RE.fullmatch(value):
            raise ValueError("日期格式须为 YYYY-MM-DD")
        try:
            date.fromisoformat(value)
        except ValueError:
            raise ValueError("日期不存在") from None
    return value


class StateModel(BaseModel):
    date: str = ""
    sleep: str = ""
    dream: str = ""
    health: str = ""
    hunger: str = ""
    mood: str = ""
    energy: int | None = Field(default=None, ge=0, le=100)
    note: str = ""

    _valid_date = field_validator("date")(_validate_date)


class ScheduleItem(BaseModel):
    time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    activity: str = Field(min_length=1, max_length=500)
    mood: str = "平稳"

    @field_validator("activity")
    @classmethod
    def validate_activity(cls, value):
        if not value.strip():
            raise ValueError("活动不能为空")
        return value.strip()


class ScheduleModel(BaseModel):
    date: str = ""
    plan: list[ScheduleItem] = Field(default_factory=list)

    _valid_date = field_validator("date")(_validate_date)


class DreamModel(BaseModel):
    date: str = ""
    content: str = Field(default="", max_length=2000)

    _valid_date = field_validator("date")(_validate_date)


class NoteModel(BaseModel):
    id: str = ""
    content: str = Field(default="", max_length=500)
    created_at: str = ""
    expires_at: str = ""
    reminded: bool = False

    _valid_expiry = field_validator("expires_at")(_validate_date)


class RelationshipModel(BaseModel):
    last_updated: str = ""
    warmth_score: int | None = Field(default=None, ge=10, le=100)
    milestones: list[dict] = []
    notes: str = ""


class ImportantDateModel(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    date: str = Field(min_length=10)
    note: str = Field(default="", max_length=500)

    _valid_date = field_validator("date")(_validate_date)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value):
        if not value.strip():
            raise ValueError("名称不能为空")
        return value.strip()


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


def _write_text(path: Path, content: str) -> None:
    """Atomically replace a private data file without a world-readable temp file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as file:
            file.write(content)
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def _archive_daily(kind: str, data: dict) -> None:
    day = data.get("date", "")
    try:
        if not day:
            return
        _validate_date(day)
    except (ValueError, TypeError):
        return
    path = _DATA_DIR / "history" / f"{day}.yaml"
    if path.is_symlink() or path.parent.is_symlink():
        raise HTTPException(409, "历史归档目录或文件不可为符号链接")
    history = _read_yaml(path)
    if history.get(kind) == data:
        return
    history[kind] = data
    _write_text(path, yaml.safe_dump(history, allow_unicode=True, default_flow_style=False))


def _write_yaml(path: Path, data: dict) -> None:
    # Callers already serialize with _lock; all dashboard/tool/import/model paths use this writer.
    kind = path.stem if path.parent == _DATA_DIR and path.name in {"state.yaml", "schedule.yaml"} else None
    if kind:
        _archive_daily(kind, _read_yaml(path))
    _write_text(path, yaml.safe_dump(data, allow_unicode=True, default_flow_style=False))
    if kind:
        _archive_daily(kind, data)


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
    _write_text(path, json.dumps(data, ensure_ascii=False, indent=2))


def _read_notes() -> list:
    notes = _read_json(_DATA_DIR / "notes.json")
    return notes if isinstance(notes, list) else []


def _today_str() -> str:
    return _now().date().isoformat()


def _now() -> datetime:
    return datetime.now(_TIMEZONE)


def _now_ts() -> str:
    return _now().isoformat(timespec="seconds")


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
                _write_text(path, pkg_file.read_text(encoding="utf-8"))
            else:
                _write_yaml(path, default_payload)

    notes_path = _DATA_DIR / "notes.json"
    if not notes_path.exists():
        pkg_notes = pkg_data_dir / "notes.json"
        if pkg_notes.exists():
            _write_text(notes_path, pkg_notes.read_text(encoding="utf-8"))
        else:
            _write_json(notes_path, [])

    for kind in ("state", "schedule"):
        _archive_daily(kind, _read_yaml(_DATA_DIR / f"{kind}.yaml"))

    # Only known plugin records: preserve contents and leave unrelated files alone.
    for path in [*(_DATA_DIR / "dreams").glob("*.md"),
                 *(_DATA_DIR / "history").glob("*.yaml"),
                 *(_DATA_DIR / "organizer-backups").glob("*.json"),
                 *[_DATA_DIR / name for name in (*yaml_seeds, "notes.json", "setup.json", "organizer-settings.json", "organizer-status.json")]]:
        if path.is_file():
            path.chmod(0o600)


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
        merged["date"] = state.date or _today_str()
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
        merged["date"] = schedule.date or _today_str()
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
    try:
        _validate_date(dream_date)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None
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
        _write_text(path, new_content)

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
            "id": f"note_{uuid4().hex}",
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
    if "content" in note.model_fields_set and not note.content.strip():
        raise HTTPException(400, "便签内容不能为空")
    caretaker = globals().get("care")
    with (caretaker.lock if caretaker is not None else nullcontext()):
        with _lock:
            notes = _read_notes()
            for i, n in enumerate(notes):
                if n.get("id") == note_id:
                    patch = note.model_dump(exclude_unset=True, exclude={"id"})
                    notes[i] = {**n, **patch, "id": note_id}
                    _write_json(_DATA_DIR / "notes.json", notes)
                    result = NoteModel(**notes[i])
                    rearmed = "reminded" in patch and patch["reminded"] is False
                    break
            else:
                raise HTTPException(404, f"便签 {note_id} 不存在")
        if rearmed and caretaker is not None:
            caretaker.note_rearmed(note_id)
    return result

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
def export_all_data(include_history: bool = False):
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

        result = {
            "state": _read_yaml(_DATA_DIR / "state.yaml"),
            "schedule": _read_yaml(_DATA_DIR / "schedule.yaml"),
            "dreams": dreams,
            "notes": _read_notes(),
            "relationship": _read_yaml(_DATA_DIR / "relationship.yaml"),
            "dates": _read_yaml(_DATA_DIR / "important_dates.yaml"),
            "exported_at": _now_ts(),
        }
        if include_history:
            if (_DATA_DIR / "history").is_symlink():
                raise HTTPException(409,"历史目录不可为符号链接")
            result["history"] = {path.stem: _read_yaml(path) for path in sorted((_DATA_DIR / "history").glob("*.yaml")) if not path.is_symlink()}
        return result


@router.post("/import")
def import_all_data(data: dict):
    """导入数据（覆盖现有数据，用于恢复备份）。

    写入前校验全部已知字段；梦境按日期合并，不删除备份外的梦境。
    """
    # Reject malformed known sections before touching any user files.
    models = {"state": StateModel, "schedule": ScheduleModel,
              "relationship": RelationshipModel, "dates": ImportantDatesModel}
    known = set(models) | {"notes", "dreams", "history"}
    if not known.intersection(data):
        raise HTTPException(400, "备份不包含可恢复的数据")
    try:
        for name, model in models.items():
            if name in data:
                model.model_validate(data[name])
        if "notes" in data:
            if not isinstance(data["notes"], list):
                raise ValueError("notes 必须是列表")
            ids = []
            for item in data["notes"]:
                note = NoteModel.model_validate(item)
                if not note.id or not note.content.strip():
                    raise ValueError("便签必须包含 id 和内容")
                ids.append(note.id)
            if len(ids) != len(set(ids)):
                raise ValueError("便签 id 重复")
        if "history" in data:
            if not isinstance(data["history"], dict) or len(data["history"]) > 10000:
                raise ValueError("历史归档格式无效或超过上限")
            for day, record in data["history"].items():
                _validate_date(day)
                if not day or not isinstance(record,dict) or set(record)-{"state","schedule"}:
                    raise ValueError("历史归档包含未知字段")
                target = _DATA_DIR / "history" / f"{day}.yaml"
                if target.is_symlink() or target.parent.is_symlink():
                    raise HTTPException(409,"历史目录不可为符号链接")
                for kind, value in record.items():
                    models[kind].model_validate(value)
                    if value.get("date") != day:
                        raise ValueError("历史记录日期不一致")
        if "dreams" in data:
            if not isinstance(data["dreams"], list):
                raise ValueError("dreams 必须是列表")
            for item in data["dreams"]:
                if not isinstance(item, dict) or not item.get("date") or not isinstance(item.get("content"), str):
                    raise ValueError("梦境格式无效")
                _validate_date(item["date"])
    except (ValidationError, ValueError, TypeError) as exc:
        raise HTTPException(400, f"备份格式无效: {exc}") from None
    imported = []
    with _lock:
        if "history" in data:
            for day, record in data["history"].items():
                path = _DATA_DIR / "history" / f"{day}.yaml"
                if path.is_symlink() or path.parent.is_symlink():
                    raise HTTPException(409,"历史目录不可为符号链接")
                _write_yaml(path, {**_read_yaml(path), **record})
            imported.append("history")
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
                        _write_text(path, str(dream["content"]))
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
            return {"decayed": 0, "warmth_score": data.get("warmth_score")}

        try:
            last_date = datetime.strptime(last_updated[:10], "%Y-%m-%d").date()
            today = _now().date()
            days_since = (today - last_date).days
        except Exception:
            return {"decayed": 0, "warmth_score": data.get("warmth_score")}

        if days_since <= 0:
            return {"decayed": 0, "warmth_score": data.get("warmth_score")}

        current_score = data.get("warmth_score")
        if current_score is None:
            return {"decayed": 0, "warmth_score": None}
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
        "version": PLUGIN_VERSION,
        "agent_tools": app is not None,
        "tool_names": list(TOOL_NAMES) if app is not None else [],
        "tool_count": len(TOOL_NAMES) if app is not None else 0,
        "data_dir": str(_DATA_DIR),
        "timezone": _TIMEZONE_NAME,
        "today": _today_str(),
        "dreams_count": len(list(dreams_dir.glob("*.md")))
        if dreams_dir.exists()
        else 0,
        "notes_count": len(_read_notes()),
    }


# ==================== 智能体绑定 ====================

class AgentBindingUpdate(BaseModel):
    enabled: bool


def _host_config_api():
    try:
        from qwenpaw.config.utils import load_config
        from qwenpaw.config.config import (
            BuiltinToolConfig, load_agent_config, save_agent_config,
        )
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="宿主不提供智能体配置接口，请在 QwenPaw 工具设置中启用陪伴工具") from exc
    return load_config, load_agent_config, save_agent_config, BuiltinToolConfig


def _agent_binding_row(agent_id, ref, config):
    entries = config.tools.builtin_tools if config.tools else {}
    enabled = [name for name in TOOL_NAMES if name in entries and entries[name].enabled]
    with _binding_lock:
        last_call = dict(_call_history[agent_id]) if agent_id in _call_history else None
    return {
        "id": agent_id, "name": getattr(ref, "name", None) or agent_id,
        "agent_enabled": getattr(ref, "enabled", True),
        "enabled_tools": enabled, "total_tools": len(TOOL_NAMES),
        "binding": "bound" if len(enabled) == len(TOOL_NAMES) else "partial" if enabled else "unbound",
        "last_call": last_call,
    }


@router.get("/agents")
def companion_agents():
    if app is None:
        return {"supported": False, "reason": "当前为标准 router 模式，未注册 AI 工具。请使用支持 PawApp SDK 的 QwenPaw 宿主。", "agents": []}
    load_config, load_agent_config, _, _ = _host_config_api()
    config = load_config()
    rows = []
    for agent_id, ref in config.agents.profiles.items():
        try:
            rows.append(_agent_binding_row(agent_id, ref, load_agent_config(agent_id)))
        except Exception:
            logger.exception("Cannot read companion binding for agent %s", agent_id)
            rows.append({"id": agent_id, "name": agent_id, "binding": "unknown", "error": "无法读取智能体配置"})
    return {"supported": True, "agents": rows, "tools": list(TOOL_NAMES)}


@router.put("/agents/{agent_id}/binding")
async def set_companion_binding(agent_id: str, payload: AgentBindingUpdate, request: Request):
    if app is None:
        raise HTTPException(status_code=503, detail="当前宿主未注册 AI 工具，无法绑定")
    load_config, load_agent_config, save_agent_config, tool_class = _host_config_api()
    with _binding_lock:
        config = load_config()
        if agent_id not in config.agents.profiles:
            raise HTTPException(status_code=404, detail="智能体不存在")
        ref = config.agents.profiles[agent_id]
        if payload.enabled and not getattr(ref, "enabled", True):
            raise HTTPException(status_code=409, detail="请先在 QwenPaw 中启用该智能体")
        agent_config = load_agent_config(agent_id)
        if agent_config.tools is None:
            raise HTTPException(status_code=409, detail="该智能体缺少工具配置，请先在宿主中初始化工具")
        entries = agent_config.tools.builtin_tools
        for name in TOOL_NAMES:
            if name not in entries:
                entries[name] = tool_class(name=name, enabled=payload.enabled, config={})
            else:
                entries[name].enabled = payload.enabled
        save_agent_config(agent_id, agent_config)
    reload_scheduled = False
    try:
        from qwenpaw.app.utils import schedule_agent_reload
        reload_scheduled = schedule_agent_reload(request, agent_id) is True
    except Exception:
        logger.exception("Companion binding saved; agent reload unavailable")
    row = _agent_binding_row(agent_id, ref, load_agent_config(agent_id))
    return {"agent": row, "reload_scheduled": reload_scheduled,
            "message": "配置已保存，已请求宿主重新加载；请在新对话中验证实际调用。" if reload_scheduled else "配置已保存；请在宿主重新加载智能体或重启 QwenPaw 后再验证。"}


def _current_agent_id():
    try:
        from qwenpaw.app import agent_context
        # get_current_agent_id falls back to the UI's active agent, which can
        # misattribute calls. Only trust an explicitly set execution context.
        peek = getattr(agent_context, "peek_current_agent_id", None)
        if peek is not None:
            return peek() or None
        context = getattr(agent_context, "_current_agent_id", None)
        return context.get() if context is not None else None
    except (ImportError, RuntimeError):
        return None


def _record_tool_call(tool_name, status):
    agent_id = _current_agent_id()
    if not agent_id:
        return
    with _binding_lock:
        if len(_call_history) >= 256 and agent_id not in _call_history:
            _call_history.pop(next(iter(_call_history)))
        _call_history[agent_id] = {"tool": tool_name, "status": status,
                                   "at": _now_ts()}


# ── PawApp definition + lifecycle ────────────────────────────────────

app = PawApp(name=PLUGIN_NAME, app_id=PLUGIN_ID) if PawApp else None
if app is not None:
    app.include_router(router)


def _agent_tool(name, **kwargs):
    def decorate(function):
        @wraps(function)
        async def tracked(*args, **call_kwargs):
            try:
                result = await function(*args, **call_kwargs)
            except Exception:
                _record_tool_call(name, "error")
                raise
            _record_tool_call(name, "success")
            return result
        return app.tool(name, **kwargs)(tracked) if app is not None else tracked
    return decorate


def _text_response(text):
    """agentscope ToolResponse 兼容封装（导入失败时退化为纯字符串）。"""
    try:
        from agentscope.tool import ToolResponse
        from agentscope.message import TextBlock
        return ToolResponse(content=[TextBlock(type="text", text=text)])
    except Exception:  # noqa: BLE001
        return text


@_agent_tool(
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
        f"- 精力：{str(data['energy']) + '/100' if data.get('energy') is not None else '未记录'}\n"
        f"- 睡眠：{data.get('sleep', '未知')}\n"
        f"- 健康：{data.get('health', '未知')}\n"
        f"- 梦境：{data.get('dream', '无')}"
    )
    return _text_response(text)


@_agent_tool(
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


@_agent_tool(
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
        f"- 亲密度：{str(data['warmth_score']) + '/100' if data.get('warmth_score') is not None else '未记录'}\n"
        f"- 最后更新：{data.get('last_updated', '未知')}\n"
        f"- 里程碑：{len(milestones)} 个"
    )
    if milestones:
        text += "\n最近里程碑："
        for m in milestones[-3:]:
            text += f"\n  - {m.get('date', '')}: {m.get('event', '')}"
    return _text_response(text)


@_agent_tool(
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


@_agent_tool(
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


@_agent_tool(
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
    try:
        create_note(NoteModel(content=content, expires_at=expires_at))
    except (ValidationError, HTTPException) as exc:
        return _text_response(f"便签未保存：{exc}")
    return _text_response(f"已记住：{content.strip()}")


@_agent_tool(
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
    today = _now().date()
    lines = ["重要日期："]
    for d in dates:
        name = d.get("name", "")
        dt = d.get("date", "")
        note = d.get("note", "")
        suffix = ""
        try:
            delta = _days_until_anniversary(dt[:10], today)
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
    agent_id = _current_agent_id()
    if not agent_id:
        return ""
    try:
        _, load_agent_config, _, _ = _host_config_api()
        config = load_agent_config(agent_id)
        entries = config.tools.builtin_tools if config.tools else {}
        enabled = [name for name in TOOL_NAMES if name in entries and entries[name].enabled]
    except Exception:
        return ""
    if not enabled:
        return ""
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
    parts = [line for line in parts if not line.startswith("- companion_") or line.split(":", 1)[0][2:] in enabled]
    with _lock:
        notes = _read_notes()
    active_notes = [n for n in notes if not _is_expired(n, today)]
    if active_notes:
        parts.append(f"\n当前有 {len(active_notes)} 条活跃便签。")
    parts.append("主动事项提示由已启用的关怀首见钩子统一提供；不要仅凭便签数量反复主动问候。")
    return "\n".join(parts)


if app is not None:
    app.prompt_section(
        "companion_core", _build_prompt, after="workspace", priority=200,
    )


async def init_companion():
    """Seed the data directory without deleting pending or overdue reminders."""
    await asyncio.to_thread(_seed_data)
    logger.info("[companion] v%s loaded, data dir: %s", PLUGIN_VERSION, _DATA_DIR)
    logger.info(
        "[companion] API endpoints: /state, /schedule, /dreams, "
        "/notes, /relationship, /dates, /export, /import, /health",
    )


async def _shutdown() -> None:
    logger.info("[companion] Plugin stopped")


if app is not None:
    app.on_launch(init_companion)
    app.hook("shutdown")(_shutdown)
# Load from the plugin directory independently of host sys.path behavior.
import importlib.util as _importlib_util
_organizer_spec = _importlib_util.spec_from_file_location(
    "companion_chat_organizer", _PLUGIN_DIR / "organizer.py")
_organizer_module = _importlib_util.module_from_spec(_organizer_spec)
_organizer_spec.loader.exec_module(_organizer_module)
organizer = _organizer_module.install(router, globals())
if app is not None:
    app.hook("shutdown")(organizer.shutdown)

class SetupProfile(BaseModel):
    user_name: str = Field(default="", max_length=80)
    companion_name: str = Field(default="", max_length=80)

    @field_validator("user_name", "companion_name")
    @classmethod
    def clean_name(cls, value):
        return value.strip()


@router.get("/setup")
def get_setup():
    data = organizer.read_json(_DATA_DIR / "setup.json", {})
    snapshot = export_all_data()
    state = snapshot["state"]
    relationship = snapshot["relationship"]
    has_data = bool(snapshot["schedule"].get("plan") or snapshot["notes"] or snapshot["dreams"]
                    or snapshot["dates"].get("dates") or relationship.get("milestones")
                    or relationship.get("notes") or relationship.get("warmth_score") is not None
                    or any(state.get(key) for key in ("mood", "sleep", "health", "hunger", "dream", "note", "date"))
                    or state.get("energy") is not None)
    return {"completed": data.get("completed") is True,
            "profile": SetupProfile.model_validate(data.get("profile", {})).model_dump(),
            "has_existing_data": has_data}


@router.post("/setup")
def complete_setup(payload: SetupProfile):
    # Finishing or deferring setup only stores preferences. Never reset records.
    with _lock:
        organizer.private_write(_DATA_DIR / "setup.json", {
            "completed": True, "profile": payload.model_dump(), "completed_at": _now_ts(),
        })
    return get_setup()


# Feature modules share the data lock and the host's existing lifecycle.
for _feature_name in ("companion_features", "care"):
    _spec = _importlib_util.spec_from_file_location("companion_"+_feature_name, _PLUGIN_DIR / (_feature_name+".py"))
    _module = _importlib_util.module_from_spec(_spec)
    _spec.loader.exec_module(_module)
    if _feature_name == "companion_features":
        features = _module.install(router, organizer)
    else:
        care = _module.install(router, organizer, features)

# Standard router loaders do not invoke PawApp lifecycle hooks, even
# when the optional SDK is installed. Initialize only missing files.
with _lock:
    _seed_data()
if app is None:
    logger.info("[companion] Router mode: Agent tools require the optional PawApp SDK")

# PawApp loaders use plugin; standard loaders use the module-level router.
plugin = app
