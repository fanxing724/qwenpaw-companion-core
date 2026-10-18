"""Regression contracts for AI workbench isolation, readback and recovery."""
import asyncio
import json
from pathlib import Path
import sys
from types import SimpleNamespace as NS

import pytest

from test_plugin import loaded, binding_host, organizer_host, file_host
from test_features import care_host


def api(sdk):
    return '/api/companion-core' if sdk else '/api/plugins/companion-core'


def test_tool_records_once_in_its_own_profile_and_restores_outer_context(loaded,monkeypatch):
    m,c,root,sdk=loaded;p=api(sdk)
    c.put(p+'/profiles',json={'map':{'alice':'alice','bob':'bob'}})
    monkeypatch.setattr(m,'_current_agent_id',lambda:'alice')
    token=m._use_profile('bob')
    try:
        asyncio.run(m.companion_get_state())
        assert m._PROFILE_CTX.get()=='bob'
    finally:m._PROFILE_CTX.reset(token)
    events=json.loads((root/'profiles/alice/interactions.json').read_text())
    assert events[0]['count']==1 and events[0]['agents']=={'alice':1}
    assert not (root/'interactions.json').exists()
    assert not (root/'profiles/bob/interactions.json').exists()


def test_ai_routine_materializes_without_opening_dashboard(loaded):
    m,c,root,sdk=loaded;p=api(sdk)
    c.put(p+'/routine',json={'enabled':True,'plan':[{'time':'09:00','activity':'AI 的作息'}]})
    assert 'AI 的作息' in str(asyncio.run(m.companion_get_schedule()))
    assert c.get(p+'/schedule').json()['plan'][0]['activity']=='AI 的作息'


@pytest.mark.parametrize('kind',['weekly','diary','plan','relationship/score'])
def test_preview_cannot_be_applied_to_another_profile(loaded,monkeypatch,kind):
    m,c,root,sdk=loaded;p=api(sdk)
    c.put(p+'/profiles',json={'map':{'a':'a','b':'b'}})
    c.put(p+'/state?agent=a',json={'mood':'A 的经历'})
    if kind=='diary':
        monkeypatch.setattr(m.organizer,'provider',lambda *args:('https://example.invalid/v1','fake',''))
        monkeypatch.setattr(m,'_diary_complete',lambda *args:('A 的陪伴日记',{}))
    if kind=='relationship/score':
        draft=c.get(p+'/'+kind+'-preview?agent=a')
        endpoint=p+'/'+kind+'-apply'
    else:
        draft=c.post(p+'/'+kind+'/preview?agent=a',json={})
        endpoint=p+'/'+kind+'/apply'
    assert draft.status_code==200,draft.text
    body={'preview_id':draft.json()['preview_id'],'confirmed':True}
    assert c.post(endpoint+'?agent=b',json=body).status_code==409
    assert c.post(endpoint+'?agent=a',json=body).status_code==200


def test_preview_rejects_remapped_target_and_stale_sources(loaded,monkeypatch):
    m,c,root,sdk=loaded;p=api(sdk)
    c.put(p+'/profiles',json={'map':{'a':'a'}})
    c.put(p+'/state?agent=a',json={'mood':'原状态'})
    draft=c.post(p+'/weekly/preview?agent=a',json={}).json()
    c.put(p+'/state?agent=a',json={'mood':'新状态'})
    assert c.post(p+'/weekly/apply?agent=a',json={'preview_id':draft['preview_id']}).status_code==409
    draft=c.post(p+'/plan/preview?agent=a',json={}).json()
    c.put(p+'/profiles',json={'map':{'a':'new-a'}})
    assert c.post(p+'/plan/apply?agent=a',json={'preview_id':draft['preview_id']}).status_code==409


def test_source_target_conflict_is_rejected_before_model_call(organizer_host,monkeypatch):
    m,c,sdk,p,owner,*_=organizer_host
    if not sdk:pytest.skip('Chat workspace requires SDK')
    c.put(p+'/profiles',json={'map':{'alice':'alice','bob':'bob'}})
    called=[]
    monkeypatch.setattr(owner,'complete',lambda *args:called.append(1))
    response=c.post(p+'/organizer/preview?agent=bob',json={'agent_id':'alice','chat_id':'chat-a'})
    assert response.status_code==409 and called==[]
    assert c.get(p+'/state?agent=bob').json()['mood']==''


def test_organizer_candidates_and_status_are_profile_scoped(organizer_host,monkeypatch):
    m,c,sdk,p,owner,*_=organizer_host
    if not sdk:pytest.skip('Chat workspace requires SDK')
    config=c.get(p+'/organizer/config').json()['config']
    c.put(p+'/profiles',json={'map':{'alice':'alice','bob':'bob'}})
    c.put(p+'/organizer/config?agent=alice',json=config)
    monkeypatch.setattr(owner,'complete',lambda *args:({'mood':'Alice 心情'},{'total_tokens':5}))
    draft=c.post(p+'/organizer/preview',json={'agent_id':'alice','chat_id':'chat-a'})
    assert draft.status_code==200,draft.text
    key=draft.json()['preview_id']
    assert c.post(p+'/organizer/apply?agent=bob',json={'preview_id':key}).status_code==409
    assert c.get(p+'/organizer/config?agent=bob').json()['status']=={'state':'idle'}
    assert c.post(p+'/organizer/apply?agent=alice',json={'preview_id':key}).status_code==200
    assert c.get(p+'/state?agent=alice').json()['mood']=='Alice 心情'
    assert c.get(p+'/state').json()['mood']==''
    assert c.get(p+'/usage?agent=alice').json()['totals']['organizer']['calls']==1


def test_failed_auto_diary_enable_is_not_persisted(loaded):
    m,c,root,sdk=loaded;p=api(sdk)
    before=c.get(p+'/diary/settings').json()
    assert c.put(p+'/diary/settings',json={'auto':True,'time':'22:30'}).status_code==400
    assert c.get(p+'/diary/settings').json()==before


def test_diary_job_time_updates_and_registration_failure_rolls_back(care_host,monkeypatch):
    m,c,p,owner,ws,chat,jobs,calls,*_=care_host
    async def get_agent(aid):return ws
    registry=NS(PluginRegistry=lambda:NS(get_workspace_manager=lambda:NS(get_agent=get_agent)))
    monkeypatch.setitem(sys.modules,'qwenpaw.plugins.registry',registry)
    response=c.put(p+'/diary/settings',json={'auto':True,'agent_id':'alice','time':'22:30','tokens':700})
    assert response.status_code==200,response.text
    key=next(k for k in jobs if k.startswith('companion-diary-'))
    assert jobs[key].schedule['cron']=='30 22 * * *'
    assert c.put(p+'/diary/settings',json={'time':'21:45'}).status_code==200
    assert jobs[key].schedule['cron']=='45 21 * * *'
    before=c.get(p+'/diary/settings').json()
    async def fail(spec):raise RuntimeError('simulated scheduler failure')
    monkeypatch.setattr(ws.cron_manager,'create_or_replace_job',fail)
    assert c.put(p+'/diary/settings',json={'time':'20:00'}).status_code==503
    assert c.get(p+'/diary/settings').json()==before
    assert jobs[key].schedule['cron']=='45 21 * * *'
    assert c.put(p+'/diary/settings',json={'auto':False}).json()['auto'] is False
    assert key not in jobs


def test_timeline_and_ai_prompt_can_read_plugin_diary(file_host,monkeypatch):
    m,c,sdk,p,owner,workspace=file_host
    if not sdk:pytest.skip('Workspace and prompt need SDK')
    c.put(p+'/profiles',json={'map':{'alice':'alice'}})
    today=m._today_str();root=m._BASE_DATA_DIR/'profiles/alice'
    (root/'diary').mkdir();(root/'diary'/f'{today}.md').write_text('只属于 Alice 的陪伴日记',encoding='utf-8')
    (workspace/'memory'/f'{today}.md').write_text('宿主的同日日记',encoding='utf-8')
    c.post(p+'/notes',json={'content':'共享便签'})
    for text in ['Alice 便签 1','Alice 便签 2']:c.post(p+'/notes?agent=alice',json={'content':text})
    view=c.get(p+'/timeline',params={'agent_id':'alice','day':today}).json()
    assert view['diary_source']=='companion'
    assert view['diary']=='只属于 Alice 的陪伴日记' and view['host_diary']=='宿主的同日日记'
    monkeypatch.setattr(m,'_current_agent_id',lambda:'alice')
    prompt=m._build_prompt(None)
    assert '当前有 2 条活跃便签' in prompt and '只属于 Alice 的陪伴日记' in prompt
    assert '共享便签' not in prompt and m._PROFILE_CTX.get() is None
    assert '只属于 Alice 的陪伴日记' in str(asyncio.run(m.companion_get_state()))


def test_portable_export_restore_includes_narratives_and_statistics(loaded):
    m,c,root,sdk=loaded;p=api(sdk);day=m._today_str()
    for folder,key in [('diary',day),('weekly','2026-W42')]:
        (root/folder).mkdir();(root/folder/f'{key}.md').write_text('AI 的陪伴经历',encoding='utf-8')
    m._record_usage('diary',{'total_tokens':12})
    backup=c.get(p+'/export?include_history=true').json()
    assert backup['diary'][day]=='AI 的陪伴经历' and backup['weekly']['2026-W42']=='AI 的陪伴经历'
    assert backup['usage'][0]['total']==12
    (root/'diary'/f'{day}.md').unlink()
    assert c.post(p+'/import',json=backup).status_code==200
    assert (root/'diary'/f'{day}.md').read_text()=='AI 的陪伴经历'
    assert c.post(p+'/import',json={'diary':{'../evil':'bad'},'state':{'mood':'bad'}}).status_code==400
    assert c.get(p+'/state').json()['mood']==''


def test_complete_backup_roundtrip_and_permissions(loaded):
    m,c,root,sdk=loaded;p=api(sdk)
    c.put(p+'/profiles',json={'map':{'a':'a'}})
    c.put(p+'/state?agent=a',json={'mood':'A 心情'})
    c.put(p+'/life?agent=a',json={'enabled':True})
    config=c.get(p+'/organizer/config?agent=a').json()['config']
    config.update(base_url='https://example.invalid/v1',model='fake',api_key='test-only-private-key')
    c.put(p+'/organizer/config?agent=a',json=config)
    backup=c.get(p+'/backup').json()
    assert backup['contains_secrets'] and 'profiles.json' in backup['files']
    assert 'test-only-private-key' in backup['files']['profiles/a/organizer-settings.json']
    c.put(p+'/state?agent=a',json={'mood':'Changed'})
    result=c.post(p+'/backup/restore',json=backup)
    assert result.status_code==200,result.text
    assert result.json()['automation_disabled'] is True
    assert c.get(p+'/state?agent=a').json()['mood']=='A 心情'
    assert c.get(p+'/life?agent=a').json()['enabled'] is False
    assert json.loads((root/'profiles/a/organizer-settings.json').read_text())['api_key']=='test-only-private-key'
    for path in m._record_files(root/'profiles/a'):assert path.stat().st_mode & 0o777==0o600
    assert list((root/'restore-backups').glob('*.json'))


@pytest.mark.parametrize('name',['../outside.json','/absolute.json','profiles/../state.yaml','profiles/a/../../state.yaml','unrelated.json','profiles/a/profiles.json'])
def test_complete_restore_rejects_unsafe_paths_before_any_write(loaded,name):
    m,c,root,sdk=loaded;p=api(sdk)
    original=(root/'state.yaml').read_text()
    result=c.post(p+'/backup/restore',json={'format':'companion-core-backup-v1','files':{'state.yaml':'mood: Changed',name:'{}'}})
    assert result.status_code==400,result.text
    assert (root/'state.yaml').read_text()==original
    assert not (root/'restore-backups').exists()


def test_checkup_covers_life_usage_and_narratives(loaded):
    m,c,root,sdk=loaded;p=api(sdk)
    for name,text in [('life.json','{}'),('usage.json','[]'),('diary-settings.json','{}')]:
        (root/name).write_text(text);(root/name).chmod(0o644)
    (root/'diary').mkdir();entry=root/'diary/2026-10-18.md';entry.write_text('AI 日记');entry.chmod(0o644)
    checks=c.get(p+'/checkup').json()['items']
    row=next(x for x in checks if x['id']=='permissions')
    assert row['status']=='warn' and 'usage.json' in row['detail']
    assert c.post(p+'/checkup/fix',json={'item':'tighten_permissions'}).status_code==200
    for name in ['life.json','usage.json','diary-settings.json','diary/2026-10-18.md']:
        assert (root/name).stat().st_mode & 0o777==0o600


def test_plan_rejects_unsorted_times_and_records_usage_once(loaded,monkeypatch):
    m,c,root,sdk=loaded;p=api(sdk)
    monkeypatch.setattr(m.organizer,'provider',lambda *args:('https://example.invalid/v1','fake',''))
    result={'routine':[{'time':'10:00','activity':'后'},{'time':'09:00','activity':'前'}],
            'organizer':{'auto_enabled':False,'interval_minutes':30},
            'care':{'time':'08:15','quiet_start':'23:00','quiet_end':'08:00'}}
    monkeypatch.setattr(m.organizer,'complete',lambda *args:(result,{'total_tokens':11}))
    assert c.post(p+'/plan/preview',json={}).status_code==502
    result['routine'].reverse()
    assert c.post(p+'/plan/preview',json={}).status_code==200
    totals=c.get(p+'/usage').json()['totals']
    assert totals['plan']['calls']==2 and totals['plan']['total']==22
    assert 'organizer' not in totals


def test_backfill_all_stages_keep_the_target_profile(file_host):
    m,c,sdk,p,owner,workspace=file_host
    if not sdk:pytest.skip('Backfill workspace needs SDK')
    c.put(p+'/profiles',json={'map':{'alice':'alice','bob':'bob'}})
    source=c.post(p+'/organizer/backfill/sources?agent=alice',json={'agent_id':'alice','profile':True,'memory':False,'recent':False}).json()
    body={'source_id':source['source_id'],'profile':{'companion_name':'Alice'},'modules':[]}
    assert c.post(p+'/organizer/backfill/review?agent=bob',json=body).status_code==409
    review=c.post(p+'/organizer/backfill/review?agent=alice',json=body).json()
    body={'review_id':review['review_id'],'confirmed':True}
    assert c.post(p+'/organizer/backfill/preview?agent=bob',json=body).status_code==409
    preview=c.post(p+'/organizer/backfill/preview?agent=alice',json=body).json()
    body={'preview_id':preview['preview_id']}
    assert c.post(p+'/organizer/backfill/apply?agent=bob',json=body).status_code==409
    assert c.post(p+'/organizer/backfill/apply?agent=alice',json=body).status_code==200
    assert c.get(p+'/setup?agent=alice').json()['profile']['companion_name']=='Alice'
    assert c.get(p+'/setup?agent=bob').json()['profile']['companion_name']==''


def test_restore_invalidates_old_candidates_and_disables_remaining_automation(loaded):
    m,c,root,sdk=loaded;p=api(sdk)
    c.put(p+'/life',json={'enabled':True})
    draft=c.post(p+'/plan/preview',json={}).json()
    result=c.post(p+'/backup/restore',json={'format':'companion-core-backup-v1','files':{'state.yaml':'mood: 恢复'}})
    assert result.status_code==200,result.text
    assert c.get(p+'/life').json()['enabled'] is False
    assert c.post(p+'/plan/apply',json={'preview_id':draft['preview_id']}).status_code==409


def test_complete_restore_validates_and_rolls_back_failed_write(loaded,monkeypatch):
    m,c,root,sdk=loaded;p=api(sdk)
    bundle=c.get(p+'/backup').json()
    c.put(p+'/state',json={'mood':'恢复前的状态'})
    before=(root/'state.yaml').read_text()
    write=m._write_text;failed=[]
    def fail_once(path,content):
        if path.name=='schedule.yaml' and not failed:
            failed.append(True);raise OSError('simulated write failure')
        return write(path,content)
    monkeypatch.setattr(m,'_write_text',fail_once)
    response=c.post(p+'/backup/restore',json=bundle)
    assert response.status_code==500
    assert (root/'state.yaml').read_text()==before
    assert list((root/'restore-backups').glob('*.json'))


def test_backup_and_restore_reject_symlink_targets(loaded,tmp_path):
    m,c,root,sdk=loaded;p=api(sdk)
    outside=tmp_path/'outside';outside.mkdir()
    (root/'diary').symlink_to(outside,target_is_directory=True)
    assert c.get(p+'/backup').status_code==409
    body={'format':'companion-core-backup-v1','files':{'diary/2026-10-18.md':'AI 日记'}}
    assert c.post(p+'/backup/restore',json=body).status_code==400
    assert not list(outside.iterdir())


def test_install_script_stops_when_validation_fails(tmp_path):
    import os
    import shutil
    import subprocess
    project=tmp_path/'project';(project/'scripts').mkdir(parents=True)
    script=project/'scripts/reinstall-local.sh'
    shutil.copyfile(Path(__file__).parents[1]/'scripts/reinstall-local.sh',script)
    (project/'scripts/package.py').write_text('print("mock package")')
    (project/'plugin.json').write_text('{"version":"test"}')
    bindir=tmp_path/'bin';bindir.mkdir()
    command=bindir/'qwenpaw'
    command.write_text('#!/bin/sh\nif [ "$2" = "validate" ]; then exit 9; fi\ntouch "'+str(tmp_path/'installed')+'"\n')
    command.chmod(0o755)
    data=tmp_path/'data';data.mkdir()
    response=subprocess.run(['bash',str(script),str(data),str(tmp_path/'backups')],env={**os.environ,'PATH':str(bindir)+':'+os.environ['PATH']},capture_output=True,text=True)
    assert response.returncode==9 and not (tmp_path/'installed').exists()
    assert not (tmp_path/'backups').exists()


def test_backup_invalid_settings_are_rejected_before_record_writes(loaded):
    m,c,root,sdk=loaded;p=api(sdk)
    before=(root/'state.yaml').read_text()
    for name,text in [('diary-settings.json','{"time":"99:99","auto":true}'),
                      ('organizer-settings.json','{"base_url":"file:///tmp/key"}'),
                      ('care-state.json','{"settings":{"a":{"agent_id":"a","time":"99:99"}}}')]:
        response=c.post(p+'/backup/restore',json={'format':'companion-core-backup-v1','files':{'state.yaml':'mood: 坏配置不应写入',name:text}})
        assert response.status_code==400,response.text
        assert (root/'state.yaml').read_text()==before


def test_organizer_hook_scopes_itself_without_relying_on_earlier_hooks(organizer_host,monkeypatch):
    import types
    m,c,sdk,p,owner,ws,chat,_=organizer_host
    if not sdk:pytest.skip('Runtime hook requires SDK')
    c.put(p+'/profiles',json={'map':{'alice':'alice','bob':'bob'}})
    hooks=types.ModuleType('qwenpaw.runtime.hooks');hooks.HookBase=type('HookBase',(),{});hooks.HookResult=type('HookResult',(),{})
    phases=types.ModuleType('qwenpaw.runtime.phases');phases.Phase=NS(POST_RESPONSE='post_response')
    monkeypatch.setitem(sys.modules,'qwenpaw.runtime.hooks',hooks);monkeypatch.setitem(sys.modules,'qwenpaw.runtime.phases',phases)
    registered=[];owner.c['app'].runtime_hook=registered.append
    owner.register_auto()
    seen=[]
    def settings():seen.append(m._PROFILE_CTX.get());return NS(auto_enabled=False)
    monkeypatch.setattr(owner,'settings',settings)
    token=m._use_profile('bob')
    try:
        asyncio.run(registered[0].run(NS(agent_id='alice',extras={})))
        assert m._PROFILE_CTX.get()=='bob'
    finally:m._PROFILE_CTX.reset(token)
    assert seen==['alice']


@pytest.mark.parametrize('content_type',['application/json','application/vnd.api+json'])
def test_source_target_guard_does_not_depend_on_content_type(loaded,content_type):
    m,c,root,sdk=loaded;p=api(sdk)
    response=c.post(p+'/organizer/preview?agent=bob',content=json.dumps({'agent_id':'alice','chat_id':'chat-a'}),headers={'Content-Type':content_type})
    assert response.status_code==409


def test_profile_mapping_rejects_symlink_before_publishing(loaded,tmp_path):
    m,c,root,sdk=loaded;p=api(sdk)
    (root/'profiles').mkdir(exist_ok=True)
    outside=tmp_path/'outside-profile';outside.mkdir()
    (root/'profiles/linked').symlink_to(outside,target_is_directory=True)
    assert c.put(p+'/profiles',json={'map':{'a':'linked'}}).status_code==409
    assert c.get(p+'/profiles').json()['map']=={}
    assert list(outside.iterdir())==[]


def test_disabling_auto_diary_during_model_call_prevents_late_write(care_host,monkeypatch):
    import importlib.util
    import types
    m,c,p,owner,ws,chat,*_=care_host
    hooks=types.ModuleType('qwenpaw.runtime.hooks')
    hooks.HookBase=type('HookBase',(),{})
    class Result:
        def __init__(self,**kwargs):self.__dict__.update(kwargs)
    hooks.HookResult=Result;hooks.HookAction=NS(SKIP_AGENT='skip')
    phases=types.ModuleType('qwenpaw.runtime.phases');phases.Phase=NS(PRE_DISPATCH='pre_dispatch')
    monkeypatch.setitem(sys.modules,'qwenpaw.runtime.hooks',hooks);monkeypatch.setitem(sys.modules,'qwenpaw.runtime.phases',phases)
    registered=[];m.app.runtime_hook=registered.append
    spec=importlib.util.spec_from_file_location('diary_race_test',Path(__file__).parents[1]/'diary.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);module.install(m.router,owner,m.life)
    c.put(p+'/state',json={'mood':'AI 的今日状态'})
    cfg={'auto':True,'time':'22:30','tokens':600,'agent_id':'alice','token':'test-job-token'}
    owner.private_write(m._DATA_DIR/'diary-settings.json',cfg)
    monkeypatch.setattr(owner,'provider',lambda *args:('https://example.invalid/v1','fake',''))
    called=[]
    def complete(*args):
        called.append(True);owner.private_write(m._DATA_DIR/'diary-settings.json',{**cfg,'auto':False})
        return '不得在停用后写入的日记',{}
    monkeypatch.setattr(m,'_diary_complete',complete)
    import hashlib
    ctx=NS(agent_id='alice',request=NS(companion_diary_token='test-job-token',request_context={'source':'cron','cron_job_id':'companion-diary-'+hashlib.sha256(b'alice').hexdigest()[:20]}))
    asyncio.run(registered[0].run(ctx))
    assert called==[True] and not (m._DATA_DIR/'diary'/f'{m._today_str()}.md').exists()
    assert c.get(p+'/diary/status').json()['reason']=='settings-changed'
