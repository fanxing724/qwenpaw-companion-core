"""Private complete workbench backups, separate from credential-free record exports.

The bundle covers registered files in shared and independent profiles. Restore
validates the entire bundle before writing and disables automation; host jobs
must be explicitly re-enabled. Unknown files and host workspaces are untouched.
"""
from copy import deepcopy
from pathlib import Path, PurePosixPath
import json
import re
from uuid import uuid4

from fastapi import HTTPException
import yaml

FORMAT = 'companion-core-backup-v1'
MAX_BYTES = 32 * 1024 * 1024
MAX_FILES = 10000


def install(router, owner, life):
    c = owner.c
    base = c['_BASE_DATA_DIR'].resolve()

    def safe_path(name):
        if not isinstance(name, str) or '\\' in name:
            raise ValueError('备份路径无效')
        path = PurePosixPath(name)
        if path.is_absolute() or not path.parts or any(x in {'..', '.'} for x in path.parts) or str(path) != name:
            raise ValueError('备份路径越界')
        parts = path.parts
        if parts[0] == 'profiles':
            if len(parts) < 3 or not c['_PROFILE_RE'].fullmatch(parts[1]) or parts[1] == 'shared':
                raise ValueError('档案目录无效')
            parts = parts[2:]
        if len(parts) == 1:
            if parts[0] not in {*c['_RECORD_NAMES'], 'profiles.json'}:
                raise ValueError('未知备份文件')
            if parts[0] == 'profiles.json' and name != 'profiles.json':
                raise ValueError('档案映射必须位于根目录')
        elif len(parts) == 2:
            folder, leaf = parts
            if folder not in c['_RECORD_DIRS'] or not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}', leaf):
                raise ValueError('备份目录或文件名无效')
            if not PurePosixPath(leaf).match(c['_RECORD_DIRS'][folder]):
                raise ValueError('备份扩展名无效')
        else:
            raise ValueError('备份目录层级无效')
        target = base.joinpath(*path.parts)
        for ancestor in [target, *list(target.parents)[:len(path.parts)-1]]:
            if ancestor.is_symlink():
                raise ValueError('备份目标不可为符号链接')
        return target

    def validate_text(name, text):
        if not isinstance(text, str) or len(text.encode('utf-8')) > 2 * 1024 * 1024:
            raise ValueError('备份正文无效或单文件过大')
        target = safe_path(name)
        leaf = target.name
        if target.suffix == '.json':
            value = json.loads(text)
        elif target.suffix == '.yaml':
            value = yaml.safe_load(text)
        else:
            return target, text
        models = {'state.yaml':'StateModel', 'schedule.yaml':'ScheduleModel', 'routine.yaml':'RoutineModel',
                  'relationship.yaml':'RelationshipModel', 'important_dates.yaml':'ImportantDatesModel'}
        if leaf in models:
            c[models[leaf]].model_validate(value)
        elif leaf == 'profiles.json':
            if not isinstance(value,dict) or not isinstance(value.get('map'),dict):
                raise ValueError('档案映射无效')
            for aid,pid in value['map'].items():
                if not isinstance(aid,str) or not aid.strip() or not isinstance(pid,str) or (pid != 'shared' and not c['_PROFILE_RE'].fullmatch(pid)):
                    raise ValueError('档案映射无效')
        elif leaf == 'notes.json':
            if not isinstance(value,list):raise ValueError('便签须为列表')
            ids=[]
            for item in value:
                note=c['NoteModel'].model_validate(item)
                if not note.id or not note.content.strip():raise ValueError('便签缺少 ID 或内容')
                ids.append(note.id)
            if len(ids)!=len(set(ids)):raise ValueError('便签 ID 重复')
        elif leaf in {'usage.json','interactions.json'}:
            if not isinstance(value,list) or any(not isinstance(x,dict) for x in value):raise ValueError('统计须为对象列表')
        elif not isinstance(value,dict):
            raise ValueError('配置或记录须为对象')
        # Restoring data must not silently enable scheduling or first-seen actions.
        if leaf in {'life.json','routine.yaml'}:
            value={**value,'enabled':False}
        elif leaf == 'diary-settings.json':
            value=c['DiarySettings'].model_validate(value).model_dump()
            value.update(auto=False,token='')
        elif leaf == 'organizer-settings.json':
            value=c['_organizer_module'].OrganizerSettings.model_validate(value).model_dump()
            value['auto_enabled']=False
        elif leaf == 'care-state.json':
            value=deepcopy(value)
            if not isinstance(value.get('settings',{}),dict):raise ValueError('关怀设置无效')
            for aid,cfg in value.get('settings',{}).items():
                if not isinstance(cfg,dict):raise ValueError('关怀设置无效')
                cfg.pop('token',None);cfg.pop('model_signature',None)
                validated=c['CareSettings'].model_validate(cfg).model_dump(exclude={'confirmed','review_id'})
                validated.update(enabled=False,first_seen=False,sync_enabled=False)
                value['settings'][aid]=validated
        if target.suffix == '.json':
            text=json.dumps(value,ensure_ascii=False,indent=2)
        else:
            text=yaml.safe_dump(value,allow_unicode=True)
        return target,text

    def collect():
        directories=[base]
        profiles=base/'profiles'
        if profiles.is_symlink():raise HTTPException(409,'档案目录不可为符号链接')
        if profiles.is_dir():
            directories.extend(p for p in profiles.iterdir() if p.is_dir() and p.name!='shared' and c['_PROFILE_RE'].fullmatch(p.name))
        if len(directories)>200:raise HTTPException(400,'档案数量超过备份上限 200')
        files={};size=0
        for directory in directories:
            if directory.is_symlink():raise HTTPException(409,'档案不可为符号链接')
            for name in (*c['_RECORD_NAMES'], *c['_RECORD_DIRS']):
                if (directory/name).is_symlink():raise HTTPException(409,'备份记录不可为符号链接')
            for folder,pattern in c['_RECORD_DIRS'].items():
                if any(p.is_symlink() for p in (directory/folder).glob(pattern)):
                    raise HTTPException(409,'备份记录不可为符号链接')
            for path in c['_record_files'](directory):
                relative=path.resolve().relative_to(base).as_posix()
                try:safe_path(relative)
                except ValueError as exc:raise HTTPException(409,str(exc)) from None
                if path.stat().st_size>2*1024*1024:raise HTTPException(400,'单文件超过备份上限 2 MiB')
                content=path.read_text(encoding='utf-8');size+=len(content.encode('utf-8'))
                files[relative]=content
                if size>MAX_BYTES or len(files)>MAX_FILES:raise HTTPException(400,'备份超过大小或文件数量上限')
        mapping=base/'profiles.json'
        if mapping.exists():
            try:safe_path('profiles.json')
            except ValueError as exc:raise HTTPException(409,str(exc)) from None
            if mapping.stat().st_size>2*1024*1024:raise HTTPException(400,'档案映射过大')
            files['profiles.json']=mapping.read_text(encoding='utf-8')
        if sum(len(v.encode('utf-8')) for v in files.values())>MAX_BYTES or len(files)>MAX_FILES:raise HTTPException(400,'备份超过上限')
        return {'format':FORMAT,'version':c['PLUGIN_VERSION'],'created_at':c['_now_ts'](),
                'contains_secrets':True,'files':files}

    @router.get('/backup')
    def export_backup():
        with c['_lock']:
            return collect()

    @router.post('/backup/restore')
    def restore_backup(payload:dict):
        if payload.get('format')!=FORMAT or not isinstance(payload.get('files'),dict) or not payload['files']:
            raise HTTPException(400,'不是受支持的完整备份')
        raw=payload['files']
        if len(raw)>MAX_FILES:raise HTTPException(400,'备份文件过多')
        try:
            if sum(len(v.encode('utf-8')) for v in raw.values() if isinstance(v,str))>MAX_BYTES:raise ValueError('备份过大')
            prepared=[validate_text(name,text) for name,text in raw.items()]
        except (ValueError,TypeError,AttributeError,yaml.YAMLError) as exc:
            raise HTTPException(400,f'备份校验失败：{exc}') from None
        with c['_lock']:
            # Keep a complete private rollback bundle before the first replacement.
            previous=collect()
            # Disable remaining live automation too, including profiles absent from a partial bundle.
            try:
                for name,text in previous['files'].items():
                    if name not in raw and PurePosixPath(name).name in {'life.json','routine.yaml','diary-settings.json','organizer-settings.json','care-state.json'}:
                        prepared.append(validate_text(name,text))
            except (ValueError,TypeError,yaml.YAMLError) as exc:
                raise HTTPException(400,f'现有配置无法安全停用：{exc}') from None
            rollback_dir=base/'restore-backups'
            if rollback_dir.is_symlink():raise HTTPException(409,'回退目录不可为符号链接')
            rollback=rollback_dir/(c['_now']().strftime('%Y%m%d-%H%M%S')+'-'+uuid4().hex[:8]+'.json')
            owner.private_write(rollback,previous)
            originals={str(path):path.read_text(encoding='utf-8') if path.exists() else None for path,_ in prepared}
            try:
                for path,text in prepared:
                    # Recheck after preparation and before creating any child path.
                    safe_path(path.relative_to(base).as_posix())
                    c['_write_text'](path,text)
            except Exception:
                for path,_ in reversed(prepared):
                    old=originals[str(path)]
                    if old is None:path.unlink(missing_ok=True)
                    else:c['_write_text'](path,old)
                raise HTTPException(500,'恢复未完成，已尝试回滚；完整回退备份保留在 restore-backups') from None
            owner._profile_states.clear()
            owner.pending.clear()
            owner.backfill.sources.clear();owner.backfill.reviews.clear();owner.backfill.pending.clear()
            c['_invalidate_previews']()
        for old in sorted(rollback_dir.glob('*.json'),key=lambda p:p.stat().st_mtime,reverse=True)[3:]:
            if not old.is_symlink():old.unlink()
        return {'status':'ok','imported':[str(len(prepared))+' files'],
                'automation_disabled':True,'notice':'完整备份已恢复；自动整理、作息演化与关怀/日记自动任务需重新明确启用。'}

    return export_backup
