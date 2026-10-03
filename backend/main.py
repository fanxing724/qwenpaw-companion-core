# -*- coding: utf-8 -*-
"""陪伴核心 — PawApp 后端。

一体化陪伴系统 API：状态管理、梦境记录、日程安排、便签提醒、
关系记录与重要日期。

持久化：YAML/JSON 文件存储于 ``<app_dir>/data/``。首次启动自动补全
缺失的种子文件；Agent 通过 REST API 访问所有数据。
"""

import asyncio
import json
import logging
import os
import re
import time
from datetime import date, datetime
from pathlib import Path

import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from qwenpaw.pawapp import PawApp

logger = logging.getLogger(__name__)


def _get_data_dir() -> Path:
    """获取用户数据目录（跨平台）。

    优先使用环境变量 QWENPAW_COMPANION_DATA，否则使用平台默认位置：
    - Windows: %APPDATA%/qwenpaw/companion-core/
    - Linux/Mac: ~/.local/share/qwenpaw/companion-core/
    """
    env_dir = os.environ.get("QWENPAW_COMPANION_DATA")
    if env_dir:
        return Path(env_dir)

    if os.name == "nt":
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))

    return base / "qwenpaw" / "companion-core"


_DATA_DIR = _get_data_dir()

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


# ── Schemas ──────────────────────────────────────────────────────────

class StateModel(BaseModel):
    date: str = ""
    sleep: str = "昨晚睡得超香"
    dream: str = "不记得做什么梦啦"
    health: str = "身体状态超棒"
    hunger: str = "不饿也不撑刚刚好"
    mood: str = "心情超平和～"
    energy: int = 70
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
    content: str = ""


class NoteModel(BaseModel):
    id: str = ""
    content: str = ""
    created_at: str = ""
    expires_at: str = ""
    reminded: bool = False


class RelationshipModel(BaseModel):
    last_updated: str = ""
    warmth_score: int = 50
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
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False)


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
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


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

    pkg_data_dir = Path(__file__).resolve().parent.parent / "data"

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
                import shutil
                shutil.copy2(pkg_file, path)
            else:
                _write_yaml(path, default_payload)

    notes_path = _DATA_DIR / "notes.json"
    if not notes_path.exists():
        pkg_notes = pkg_data_dir / "notes.json"
        if pkg_notes.exists():
            import shutil
            shutil.copy2(pkg_notes, notes_path)
        else:
            _write_json(notes_path, [])


# ── HTTP router ──────────────────────────────────────────────────────

router = APIRouter()


# ==================== 状态 ====================

@router.get("/state", response_model=StateModel)
def get_state():
    """获取当前状态。"""
    data = _read_yaml(_DATA_DIR / "state.yaml")
    if not data:
        data = StateModel().model_dump()
    return data


@router.put("/state", response_model=StateModel)
def update_state(state: StateModel):
    """更新状态（增量合并，仅覆盖请求中显式提供的字段）。"""
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
    data = _read_yaml(_DATA_DIR / "schedule.yaml")
    if not data:
        data = ScheduleModel().model_dump()
    return data


@router.put("/schedule", response_model=ScheduleModel)
def update_schedule(schedule: ScheduleModel):
    """更新日程（增量合并）。"""
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

    path = _DATA_DIR / "dreams" / f"{dream_date}.md"
    # 如果已存在，追加而非覆盖
    if path.exists():
        existing = path.read_text(encoding="utf-8").strip()
        new_content = f"{existing}\n\n---\n\n{dream.content.strip()}"
    else:
        new_content = f"# {dream_date} 的梦\n\n{dream.content.strip()}"
    path.write_text(new_content, encoding="utf-8")

    # 更新 state.yaml 中的 dream 字段
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
    notes = _read_notes()
    entry = {
        "id": f"note_{int(time.time() * 1000)}",
        "content": note.content,
        "created_at": note.created_at or _now_ts(),
        "expires_at": note.expires_at or "",
        "reminded": note.reminded,
    }
    notes.append(entry)
    _write_json(_DATA_DIR / "notes.json", notes)
    return NoteModel(**entry)


# NOTE: registered before /notes/{note_id} so "expired" is not
# captured as a note_id path parameter.
@router.delete("/notes/expired")
def clean_expired_notes():
    """清理过期便签。"""
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
    data = _read_yaml(_DATA_DIR / "relationship.yaml")
    if not data:
        data = RelationshipModel().model_dump()
    return data


@router.put("/relationship", response_model=RelationshipModel)
def update_relationship(rel: RelationshipModel):
    """更新关系记录（增量合并）。"""
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
    data = _read_yaml(_DATA_DIR / "important_dates.yaml")
    if not data or "dates" not in data:
        data = ImportantDatesModel().model_dump()
    return data


@router.post("/dates", response_model=ImportantDatesModel)
def add_date(new_date: ImportantDateModel):
    """添加重要日期。"""
    if not _DATE_RE.match(new_date.date):
        raise HTTPException(400, "日期格式须为 YYYY-MM-DD")
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
    """导入数据（覆盖现有数据，用于恢复备份）。"""
    if "state" in data and isinstance(data["state"], dict):
        _write_yaml(_DATA_DIR / "state.yaml", data["state"])
    if "schedule" in data and isinstance(data["schedule"], dict):
        _write_yaml(_DATA_DIR / "schedule.yaml", data["schedule"])
    if "dreams" in data and isinstance(data["dreams"], list):
        dreams_dir = _DATA_DIR / "dreams"
        dreams_dir.mkdir(parents=True, exist_ok=True)
        for dream in data["dreams"]:
            if isinstance(dream, dict) and "date" in dream and "content" in dream:
                dream_date = dream["date"]
                if _DATE_RE.match(str(dream_date)):
                    path = dreams_dir / f"{dream_date}.md"
                    path.write_text(dream["content"], encoding="utf-8")
    if "notes" in data and isinstance(data["notes"], list):
        _write_json(_DATA_DIR / "notes.json", data["notes"])
    if "relationship" in data and isinstance(data["relationship"], dict):
        _write_yaml(_DATA_DIR / "relationship.yaml", data["relationship"])
    if "dates" in data and isinstance(data["dates"], dict):
        _write_yaml(_DATA_DIR / "important_dates.yaml", data["dates"])
    return {"status": "ok", "imported_at": _now_ts()}


# ==================== 关系衰减 ====================

@router.post("/relationship/decay")
def apply_relationship_decay():
    """应用关系衰减（长时间未互动时亲密度下降）。

    衰减规则：
    - 每天未更新，亲密度下降 1 点
    - 最低降至 10 点（不会降到 0）
    """
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

app = PawApp(name="陪伴核心", app_id="companion-core")
app.include_router(router)


@app.on_launch
async def init_companion():
    """Seed the data directory on app launch."""
    await asyncio.to_thread(_seed_data)
    logger.info("[companion] data dir: %s", _DATA_DIR)
    logger.info(
        "[companion] API endpoints: /state, /schedule, /dreams, "
        "/notes, /relationship, /dates, /export, /import, /health",
    )


# The 'plugin' variable is what PluginLoader looks for.
plugin = app
