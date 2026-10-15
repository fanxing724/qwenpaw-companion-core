"""Read-only timeline, host-model discovery and explicitly reviewed local insights."""
from datetime import date
import hashlib
import json
import threading
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field


class Confirm(BaseModel):
    model_config = ConfigDict(extra='forbid')
    preview_id: str = Field(min_length=1,max_length=100)
    confirmed: bool = False


class Features:
    def __init__(self,owner):
        self.o,self.c=owner,owner.c
        self.pending={}
        self.lock=threading.RLock()
        self.sources=owner.backfill
        self.state_path=self.c['_DATA_DIR']/'feature-state.json'

    def day(self,value):
        try:
            if not value:raise ValueError()
            self.c['_validate_date'](value)
        except (ValueError,TypeError):
            raise HTTPException(400,'日期须为有效 YYYY-MM-DD') from None
        return value

    def memory_index(self,root):
        directory=root/'memory'
        if directory.is_symlink() or not directory.is_dir():return []
        result=[]
        for i,path in enumerate(directory.iterdir()):
            if i>=10000:raise HTTPException(400,'日记目录过大，请按年份归档')
            if path.is_symlink() or not path.is_file() or path.suffix!='.md':continue
            try:self.day(path.stem)
            except HTTPException:continue
            result.append(path.stem)
        return sorted(set(result),reverse=True)

    async def timeline(self,request,agent_id,day=None):
        ws=await self.o.workspace(request,agent_id)
        if not getattr(ws,'workspace_dir',None):raise HTTPException(503,'宿主未提供工作区路径')
        root=Path(ws.workspace_dir).expanduser().resolve()
        day=self.day(day or self.c['_today_str']())
        diary_days=self.memory_index(root)
        diary,note=self.sources.read(root,'memory/'+day+'.md')
        with self.c['_lock']:
            archive_path=self.c['_DATA_DIR']/'history'/f'{day}.yaml'
            archived={} if archive_path.is_symlink() or archive_path.parent.is_symlink() else self.c['_read_yaml'](archive_path)
            state=self.c['_read_yaml'](self.c['_DATA_DIR']/'state.yaml')
            schedule=self.c['_read_yaml'](self.c['_DATA_DIR']/'schedule.yaml')
            dates=self.c['_read_yaml'](self.c['_DATA_DIR']/'important_dates.yaml').get('dates',[])
            relation=self.c['_read_yaml'](self.c['_DATA_DIR']/'relationship.yaml')
            dream,dream_note=self.sources.read(self.c['_DATA_DIR'],'dreams/'+day+'.md')
        historical={}
        for kind,current in [('state',state),('schedule',schedule)]:
            historical[kind]=current if current.get('date')==day else archived.get(kind)
        countdown=[]
        for item in dates:
            try:delta=self.c['_days_until_anniversary'](item['date'],date.fromisoformat(day))
            except (KeyError,ValueError,TypeError):continue
            if delta<=30:countdown.append({**item,'days_until':delta})
        available=set(diary_days)
        for directory,suffix in [('history','.yaml'),('dreams','.md')]:
            parent=self.c['_DATA_DIR']/directory
            if parent.is_symlink() or not parent.exists():continue
            for i,path in enumerate(parent.iterdir()):
                if i>=10000:break
                if path.is_symlink() or path.suffix!=suffix:continue
                try:self.day(path.stem)
                except HTTPException:continue
                available.add(path.stem)
        for item in (state,schedule):
            if item.get('date'):available.add(item['date'])
        return {'agent_id':agent_id,'date':day,'diary':diary or '',
                'diary_notice':('该智能体暂无该日期的本地日记；远程记忆暂不支持' if diary is None else ''),
                'dream':dream or '',**historical,'countdown':countdown,
                'dates':sorted(available,reverse=True)[:1000],
                'on_this_day':[x for x in diary_days if x[5:]==day[5:] and x[:4]<day[:4]],
                'milestones':relation.get('milestones',[]),
                'shared_data_notice':'日记按智能体隔离；状态、日程、梦境、关系仍为插件共享数据。历史仅从启用归档后积累。'}

    async def discover(self,request,agent_id):
        self.o.require_bound(agent_id)
        manager=getattr(request.app.state,'provider_manager',None)
        if manager is None:return {'available':False,'reason':'宿主未提供模型管理接口，请手动配置兼容模型'}
        try:
            _,load_agent,_,_=self.c['_host_config_api']()
            slot=getattr(load_agent(agent_id),'active_model',None) or manager.get_active_model()
            if not slot:return {'available':False,'reason':'未配置主模型，请手动配置整理模型'}
            provider=manager.get_provider(slot.provider_id)
            if getattr(provider,'chat_model','OpenAIChatModel')!='OpenAIChatModel':
                return {'available':False,'reason':'主模型使用不同协议，请手动选择 OpenAI Chat Completions 兼容模型'}
            base=getattr(provider,'base_url','')
            # Only an explicit public URL attribute; never serialize provider/config/key objects.
            model=getattr(slot,'model','')
            if not isinstance(base,str) or not isinstance(model,str) or not base or not model:
                return {'available':False,'reason':'宿主未暴露兼容 API 地址，请手动配置；不会读取密钥'}
            url=self.c['_organizer_module'].Provider(base_url=base).base_url
            return {'available':True,'base_url':url,'model':model,'api_key':'',
                    'hint':'可复用现有地址与模型；整理任务建议使用便宜小模型或本地免密模型。密钥不会复制。'}
        except Exception:
            return {'available':False,'reason':'无法读取兼容模型配置，请手动填写；宿主配置未修改'}

    def score_plan(self):
        with self.c['_lock']:
            relation=self.c['_read_yaml'](self.c['_DATA_DIR']/'relationship.yaml')
            dates=self.c['_read_yaml'](self.c['_DATA_DIR']/'important_dates.yaml').get('dates',[])
        events=[]
        for item in relation.get('milestones',[]):
            try:day=date.fromisoformat(item['date'])
            except (ValueError,TypeError,KeyError):continue
            event=item.get('event','')
            if not isinstance(event,str) or not event.strip():continue
            normalized={**item,'event':' '.join(event.split())}
            if day<=self.c['_now']().date() and not any(x['date']==normalized['date'] and x['event'].casefold()==normalized['event'].casefold() for x in events):events.append(normalized)
        unique_dates={}
        for item in dates:
            try:
                parsed=self.c['ImportantDateModel'].model_validate(item).model_dump()
                unique_dates[parsed['name']]=parsed
            except Exception:continue
        dates=list(unique_dates.values())
        days=max(0,(self.c['_now']().date()-min((date.fromisoformat(x['date']) for x in events),default=self.c['_now']().date())).days)
        parts=[{'rule':'起始刻度（不代表感情评价）','points':10,'evidence':[]},
               {'rule':'已确认最早里程碑至今，每 7 天 +2，最多 20','points':min(20,days//7*2),'evidence':[min(events,key=lambda x:x['date'])] if events else []},
               {'rule':'每条已确认里程碑 +5，最多 40','points':min(40,len(events)*5),'evidence':events[:8]},
               {'rule':'每个已记录重要日期 +3，最多 30','points':min(30,len(dates)*3),'evidence':dates[:10]}]
        entry={'kind':'score','before':relation,'score':sum(x['points'] for x in parts)}
        key=self.sources.store(self.pending,entry)
        return {'preview_id':key,'current':relation.get('warmth_score'),'proposed':entry['score'],'known_days':days,'parts':parts,
                'notice':'仅按已确认记录计分，不从文件数量、模型猜测或生日推断亲密度。确认后才写入。'}

    def apply_score(self,payload):
        if not payload.confirmed:raise HTTPException(400,'请确认分项和证据后再写入')
        entry=self.sources.get(self.pending,payload.preview_id)
        with self.c['_lock']:
            path=self.c['_DATA_DIR']/'relationship.yaml'
            current=self.c['_read_yaml'](path)
            if current!=entry['before']:raise HTTPException(409,'关系记录已变化，请重新计算')
            self.o.private_write(self.c['_DATA_DIR']/'insight-backups'/f'score-{uuid4().hex}.json',{'relationship':current})
            self.c['_write_yaml'](path,{**current,'warmth_score':entry['score']})
        del self.pending[payload.preview_id]
        # Keep only ten private backups.
        backups=sorted((self.c['_DATA_DIR']/'insight-backups').glob('score-*.json'),key=lambda p:p.stat().st_mtime,reverse=True)
        for old in backups[10:]:old.unlink()
        return {'warmth_score':entry['score']}

    async def style_preview(self,request,agent_id):
        ws=await self.o.workspace(request,agent_id)
        raw,note=self.sources.read(Path(ws.workspace_dir).resolve(),'SOUL.md')
        style=self.sources.sanitize_text(raw or '')[:1500]
        return {'style':style,'notice':note or '仅在本地审阅，保存到关怀设置后影响措辞；不覆盖 SOUL 或技能文件。'}

    def bounded_sources(self,root):
        sources=[('PROFILE.md',4000),('MEMORY.md',3000)]
        directory=root/'memory';files=[]
        if directory.is_dir() and not directory.is_symlink():
            for i,path in enumerate(directory.iterdir()):
                if i>=1000:break
                if path.suffix=='.md' and not path.is_symlink() and path.is_file():
                    files.append((path.stat().st_mtime_ns,path.name))
        remaining=2000
        for _,name in sorted(files,reverse=True)[:3]:
            budget=min(800,remaining);sources.append(('memory/'+name,budget));remaining-=budget
        return sources

    def incremental(self,agent_id,workspace):
        with self.lock:return self._incremental(agent_id,workspace)

    def _incremental(self,agent_id,workspace):
        """Keep bounded line fingerprints, never original file content or credentials."""
        root=Path(workspace.workspace_dir).resolve()
        docs={};line_hashes={}
        for name,budget in self.bounded_sources(root):
            raw,_=self.sources.read(root,name)
            if raw is None:continue
            clean=self.sources.sanitize_text(raw)[:budget]
            docs[name]=hashlib.sha256(raw.encode()).hexdigest()
            line_hashes[name]=list(dict.fromkeys(hashlib.sha256(line.encode()).hexdigest() for line in clean.splitlines() if line.strip() and '[已脱敏]' not in line))[:200]
        state=self.o.read_json(self.state_path,{})
        old=state.get(agent_id,{})
        changes=[name for name,digest in docs.items() if old.get('files',{}).get(name)!=digest]
        pending_lines=old.get('pending_lines',{})
        for name in changes:
            added=set(line_hashes.get(name,[]))-set(old.get('line_hashes',{}).get(name,[]))
            pending_lines[name]=list(dict.fromkeys(pending_lines.get(name,[])+list(added)))[-200:]
        pending=list(dict.fromkeys(old.get('changed',[])+changes))[-100:]
        state[agent_id]={'files':docs,'line_hashes':line_hashes,'pending_lines':pending_lines,'changed':pending,'checked_at':self.c['_now_ts']()}
        self.o.private_write(self.state_path,state)
        return changes

    def acknowledge_lines(self,agent_id,reviewed):
        with self.lock:return self._acknowledge_lines(agent_id,reviewed)

    def _acknowledge_lines(self,agent_id,reviewed):
        state=self.o.read_json(self.state_path,{})
        agent=state.get(agent_id)
        if not agent:return
        for name,lines in reviewed.items():
            remaining=set(agent.get('pending_lines',{}).get(name,[]))-set(lines)
            agent.setdefault('pending_lines',{})[name]=list(remaining)
            if not remaining and name in agent.get('changed',[]):agent['changed'].remove(name)
        self.o.private_write(self.state_path,state)


def install(router,owner):
    features=Features(owner)
    @router.get('/timeline')
    async def timeline(request:Request,agent_id:str,day:str|None=None):
        return await features.timeline(request,agent_id,day)
    @router.get('/organizer/discover-model')
    async def discover(request:Request,agent_id:str):
        return await features.discover(request,agent_id)
    @router.get('/relationship/score-preview')
    def score():return features.score_plan()
    @router.post('/relationship/score-apply')
    def apply(payload:Confirm):return features.apply_score(payload)
    @router.get('/style-preview')
    async def style(request:Request,agent_id:str):return await features.style_preview(request,agent_id)
    @router.get('/memory-sync')
    def sync(agent_id:str):
        owner.require_bound(agent_id)
        return owner.read_json(features.state_path,{}).get(agent_id,{'changed':[]})
    @router.post('/memory-sync/ack')
    def acknowledge_sync(payload:dict):
        if payload.get('confirmed') is not True:raise HTTPException(400,'请确认仅清空变更提示，不写入事实')
        agent_id=payload.get('agent_id','');owner.require_bound(agent_id)
        with features.lock:
            state=owner.read_json(features.state_path,{})
            if agent_id in state:
                state[agent_id]['changed']=[];state[agent_id]['pending_lines']={}
                owner.private_write(features.state_path,state)
        return {'state':'acknowledged'}
    return features
