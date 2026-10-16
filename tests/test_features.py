"""History, file isolation, opt-in scheduling and durable reminder semantics."""
import asyncio
from datetime import datetime, timezone
import json
import sys
import types
from types import SimpleNamespace as NS

import pytest

from test_plugin import loaded, binding_host, organizer_host, file_host


def test_history_archives_all_write_paths_and_backup(loaded,monkeypatch):
    module,client,root,sdk=loaded
    prefix='/api/companion-core' if sdk else '/api/plugins/companion-core'
    monkeypatch.setattr(module,'_today_str',lambda:'2026-10-16')
    client.put(prefix+'/state',json={'date':'2026-10-15','mood':'昨天'})
    client.put(prefix+'/schedule',json={'date':'2026-10-15','plan':[{'time':'09:00','activity':'旧日程'}]})
    assert client.put(prefix+'/state',json={'mood':'今天'}).json()['date']=='2026-10-16'
    client.put(prefix+'/schedule',json={'plan':[]})
    old=module._read_yaml(root/'history'/'2026-10-15.yaml')
    assert old['state']['mood']=='昨天' and old['schedule']['plan'][0]['activity']=='旧日程'
    assert module._read_yaml(root/'history'/'2026-10-16.yaml')['state']['mood']=='今天'
    assert (root/'history'/'2026-10-15.yaml').stat().st_mode&0o777==0o600
    backup=client.get(prefix+'/export?include_history=true').json()
    assert 'history' not in client.get(prefix+'/export').json()
    assert backup['history']['2026-10-15']==old
    before=client.get(prefix+'/export?include_history=true').json()
    invalid={'state':{'mood':'不应写入'},'history':{'2026-02-30':{'state':{'date':'2026-02-30'}}}}
    assert client.post(prefix+'/import',json=invalid).status_code==400
    assert client.get(prefix+'/state').json()['mood']=='今天'
    assert client.post(prefix+'/import',json={'history':backup['history']}).status_code==200
    # Organizer/tools share _write_yaml, so old dated records are retained too.
    module.organizer.write_unlocked({'state':{'date':'2026-10-17','mood':'整理结果'}})
    assert module._read_yaml(root/'history'/'2026-10-16.yaml')['state']['mood']=='今天'
    assert module._read_yaml(root/'history'/'2026-10-17.yaml')['state']['mood']=='整理结果'


def test_timeline_reads_diary_without_substituting_current_data(file_host):
    module,client,sdk,prefix,owner,root=file_host
    if not sdk:pytest.skip('SDK workspace mode only')
    (root/'memory'/'2025-10-01.md').write_text('去年的日记')
    (root/'memory'/'2026-10-01.md').write_text('修过一个 bug <script>window.bad=1</script>')
    client.put(prefix+'/state',json={'date':'2026-10-02','mood':'下一天'})
    view=client.get(prefix+'/timeline',params={'agent_id':'alice','day':'2026-10-01'})
    assert view.status_code==200,view.text
    assert '修过一个 bug' in view.json()['diary']
    assert view.json()['state'] is None
    assert view.json()['on_this_day']==['2025-10-01']
    assert '下一天' not in json.dumps(view.json())
    client.put(prefix+'/state',json={'date':'2026-10-01','mood':'当时'})
    client.put(prefix+'/state',json={'date':'2026-10-02','mood':'现在'})
    assert client.get(prefix+'/timeline',params={'agent_id':'alice','day':'2026-10-01'}).json()['state']['mood']=='当时'
    assert client.get(prefix+'/timeline',params={'agent_id':'alice','day':'2026-13-40'}).status_code==400
    path=root/'memory'/'2026-10-01.md';path.unlink();path.symlink_to(root/'PROFILE.md')
    assert client.get(prefix+'/timeline',params={'agent_id':'alice','day':'2026-10-01'}).json()['diary']==''
    missing=client.get(prefix+'/timeline',params={'agent_id':'alice','day':'2020-01-01'}).json()
    assert missing['diary_notice'] and missing['diary']==''
    draft=client.get(prefix+'/care/followup-preview',params={'agent_id':'alice','day':'2025-10-01'})
    assert draft.status_code==200 and '去年的日记' in draft.json()['draft']


def test_model_discovery_never_copies_keys_and_score_is_reviewed(file_host):
    module,client,sdk,prefix,owner,root=file_host
    if not sdk:pytest.skip('SDK workspace mode only')
    manager=NS(get_active_model=lambda:NS(provider_id='main',model='cheap'),get_provider=lambda key:NS(base_url='http://localhost:11434/v1',api_key='MUST-NOT-EXPOSE',chat_model='OpenAIChatModel'))
    client.app.state.provider_manager=manager
    before=owner.path.read_bytes()
    view=client.get(prefix+'/organizer/discover-model',params={'agent_id':'alice'})
    assert view.json()['available'] and view.json()['api_key']==''
    assert 'MUST-NOT-EXPOSE' not in view.text and owner.path.read_bytes()==before
    client.put(prefix+'/relationship',json={'milestones':[{'date':'2026-01-01','event':'初次互动'}]})
    score=client.get(prefix+'/relationship/score-preview').json()
    assert score['proposed']==sum(x['points'] for x in score['parts'])
    assert client.get(prefix+'/relationship').json()['warmth_score'] is None
    assert client.post(prefix+'/relationship/score-apply',json={'preview_id':score['preview_id']}).status_code==400
    assert client.post(prefix+'/relationship/score-apply',json={'preview_id':score['preview_id'],'confirmed':True}).status_code==200
    assert client.get(prefix+'/relationship').json()['warmth_score']==score['proposed']
    stale=client.get(prefix+'/relationship/score-preview').json()
    client.put(prefix+'/relationship',json={'notes':'新的关系记录'})
    assert client.post(prefix+'/relationship/score-apply',json={'preview_id':stale['preview_id'],'confirmed':True}).status_code==409


@pytest.fixture
def care_host(organizer_host,monkeypatch,tmp_path):
    module,client,sdk,prefix,owner,ws,chat,state=organizer_host
    if not sdk:pytest.skip('SDK scheduling mode only')
    module.care.hooks_supported=True
    ws.workspace_dir=tmp_path/'workspace';ws.workspace_dir.mkdir()
    jobs={};calls=[];sent=[]
    async def get(key):return jobs.get(key)
    async def create(spec):jobs[spec.id]=spec;calls.append('create')
    async def delete(key):jobs.pop(key,None);calls.append('delete');return True
    ws.cron_manager=NS(get_job=get,create_or_replace_job=create,delete_job=delete)
    async def send(**kwargs):sent.append(kwargs)
    ws.channel_manager=NS(send_text=send)
    class Spec:
        @classmethod
        def model_validate(cls,value):return NS(**value)
    models=types.ModuleType('qwenpaw.app.crons.models');models.CronJobSpec=Spec
    monkeypatch.setitem(sys.modules,'qwenpaw.app.crons.models',models)
    frozen=[datetime(2026,10,15,10,0,tzinfo=timezone.utc)]
    monkeypatch.setattr(module,'_now',lambda:frozen[0])
    return module,client,prefix,owner,ws,chat,jobs,calls,sent,frozen


def save_care(host,**changes):
    module,client,prefix,owner,ws,chat,jobs,calls,sent,clock=host
    body=client.get(prefix+'/care',params={'agent_id':'alice'}).json()['settings']
    body.update(enabled=True,channel=chat.channel,user_id=chat.user_id,session_id=chat.session_id,confirmed=True)
    body.update(changes)
    review=client.post(prefix+'/care/preview',json=body)
    assert review.status_code==200,review.text
    body['review_id']=review.json()['review_id']
    response=client.put(prefix+'/care',json=body)
    assert response.status_code==200,response.text
    return response.json()


def test_opt_in_host_jobs_and_private_settings(care_host):
    module,client,prefix,owner,ws,chat,jobs,calls,sent,clock=care_host
    assert jobs=={} and not module.care.settings('alice')['enabled']
    assert client.put(prefix+'/care',json={'agent_id':'alice','enabled':True}).status_code==400
    view=save_care(care_host)
    assert len(jobs)==1 and calls==['create'] and sent==[]
    spec=next(iter(jobs.values()))
    assert spec.meta['owner']=='companion-core'
    assert spec.schedule['timezone']=='Asia/Shanghai'
    assert spec.dispatch['silent'] is True and spec.runtime['tool_safety'] is True
    assert 'token' not in view['settings']
    assert module.care.path.stat().st_mode&0o777==0o600
    jobs['unrelated']=NS(id='unrelated',meta={'owner':'other'})
    save_care(care_host,enabled=False)
    assert list(jobs)==['unrelated']
    body={'agent_id':'alice','enabled':True,'channel':'tg','user_id':'unknown','session_id':'unknown','confirmed':True}
    body['review_id']=client.post(prefix+'/care/preview',json=body).json()['review_id']
    assert client.put(prefix+'/care',json=body).status_code==400


def test_quiet_delay_delivery_ack_and_no_duplicate(care_host):
    module,client,prefix,owner,ws,chat,jobs,calls,sent,clock=care_host
    chat.channel='telegram'
    save_care(care_host)
    note=client.post(prefix+'/notes',json={'content':'提醒我喝水','expires_at':'2026-10-15'}).json()
    clock[0]=datetime(2026,10,15,23,30,tzinfo=timezone.utc)
    assert asyncio.run(module.care.tick('alice',ws))['state']=='quiet-deferred'
    assert sent==[] and client.get(prefix+'/notes?expired=true').json()[0]['reminded'] is False
    clock[0]=datetime(2026,10,16,8,0,tzinfo=timezone.utc)
    result=asyncio.run(module.care.tick('alice',ws))
    assert result['state']=='channel-accepted' and len(sent)==1
    assert '延迟补发' in sent[0]['text'] and '提醒我喝水' in sent[0]['text']
    assert client.get(prefix+'/notes?expired=true').json()[0]['reminded'] is True
    asyncio.run(module.care.tick('alice',ws))
    assert len(sent)==1
    assert client.post(prefix+'/care/attempt',json={'agent_id':'alice'}).status_code==400


def test_delivery_failure_console_and_uncertain_go_to_first_seen(care_host):
    module,client,prefix,owner,ws,chat,jobs,calls,sent,clock=care_host
    save_care(care_host)
    client.post(prefix+'/notes',json={'content':'不能丢的提醒','expires_at':'2026-10-15'})
    assert asyncio.run(module.care.tick('alice',ws))['state']=='console-first-seen'
    assert not sent
    assert client.get(prefix+'/notes').json()[0]['reminded'] is False
    item=module.care.read()['agents']['alice']['queue'][0]
    assert client.post(prefix+'/care/ack',json={'agent_id':'alice','event_id':item['id'],'confirmed':True}).status_code==200
    assert client.get(prefix+'/notes').json()[0]['reminded'] is True
    chat.channel='telegram';save_care(care_host)
    client.post(prefix+'/notes',json={'content':'渠道失败提醒','expires_at':'2026-10-15'})
    async def fail(**kwargs):raise RuntimeError('do not leak provider text')
    ws.channel_manager.send_text=fail
    assert asyncio.run(module.care.tick('alice',ws))['state']=='channel-failed-first-seen'
    assert module.care.read()['agents']['alice']['queue'][0]['state']=='first-seen'
    data=module.care.read();data['agents']['alice']['queue'][0]['state']='sending';module.care.write(data)
    assert asyncio.run(module.care.tick('alice',ws))['state']=='empty'
    assert module.care.read()['agents']['alice']['queue'][0]['state']=='uncertain'


def test_first_seen_commits_only_successfully_and_survives_restart(care_host):
    module,client,prefix,owner,ws,chat,jobs,calls,sent,clock=care_host
    save_care(care_host,enabled=False,first_seen=True)
    client.post(prefix+'/notes',json={'content':'今日提醒','expires_at':'2026-10-15'})
    injections=[]
    def ctx():return NS(agent_id='alice',workspace=ws,request=NS(session_source=None,request_context={}),input_msgs=[{'role':'user','content':'你好'}],extras={},error=None,inject_context=lambda value,**kw:injections.append(value))
    first=ctx();asyncio.run(module.care.first_before(first));assert len(injections)==1
    duplicate=ctx();asyncio.run(module.care.first_before(duplicate));assert len(injections)==1
    first.error=RuntimeError('failed');asyncio.run(module.care.first_after(first));module.care.release(first)
    assert not module.care.read()['agents']['alice'].get('last_prompted_date')
    retry=ctx();asyncio.run(module.care.first_before(retry));assert len(injections)==2
    asyncio.run(module.care.first_after(retry));module.care.release(retry)
    assert module.care.read()['agents']['alice']['last_prompted_date']=='2026-10-15'
    assert client.get(prefix+'/notes').json()[0]['reminded'] is False  # Injection is not delivery acknowledgement.
    new_care=module.care.__class__(owner,module.features)
    asyncio.run(new_care.first_before(ctx()));assert len(injections)==2
    clock[0]=datetime(2026,10,16,10,0,tzinfo=timezone.utc)
    tomorrow=ctx();asyncio.run(new_care.first_before(tomorrow));assert len(injections)==3


def test_stale_note_queue_is_removed_and_followup_waits(care_host):
    module,client,prefix,owner,ws,chat,jobs,calls,sent,clock=care_host
    save_care(care_host)
    note=client.post(prefix+'/notes',json={'content':'旧提醒','expires_at':'2026-10-15'}).json()
    module.care.collect('alice')
    client.delete(prefix+'/notes/'+note['id'])
    module.care.collect('alice')
    assert module.care.read()['agents']['alice']['queue']==[]
    (ws.workspace_dir/'memory').mkdir();(ws.workspace_dir/'memory'/'2026-10-14.md').write_text('昨天修了 bug')
    request={'agent_id':'alice','date':'2026-10-14','text':'修好了吗？','send_after':'2026-10-16T10:00:00+00:00','confirmed':True}
    assert client.post(prefix+'/care/followup',json=request).status_code==200
    assert asyncio.run(module.care.tick('alice',ws))['state']=='empty'
    request['send_after']='2026-10-16T10:00:00'
    assert client.post(prefix+'/care/followup',json=request).status_code==422


def test_incremental_sync_never_calls_model_and_preserves_unread_changes(care_host,monkeypatch):
    module,client,prefix,owner,ws,chat,jobs,calls,sent,clock=care_host
    save_care(care_host,enabled=False,sync_enabled=True)
    (ws.workspace_dir/'MEMORY.md').write_text('生日是 2000-02-04\npassword: should not be sent')
    def fail(*args):raise AssertionError('sync must not call a model')
    monkeypatch.setattr(owner,'complete',fail)
    assert module.features.incremental('alice',ws)==['MEMORY.md']
    assert module.features.incremental('alice',ws)==[]
    status=client.get(prefix+'/memory-sync',params={'agent_id':'alice'})
    assert status.json()['changed']==['MEMORY.md']
    assert 'password' not in status.text
    (ws.workspace_dir/'MEMORY.md').write_text('新的记忆')
    assert module.features.incremental('alice',ws)==['MEMORY.md']


def test_runtime_hooks_skip_models_and_fallback_hints(care_host,monkeypatch):
    module,client,prefix,owner,ws,chat,jobs,calls,sent,clock=care_host
    registered=[]
    module.app.runtime_hook=registered.append
    hooks=types.ModuleType('qwenpaw.runtime.hooks')
    hooks.HookBase=type('HookBase',(),{})
    class Result:
        def __init__(self,action='continue'):self.action=action
    hooks.HookResult=Result;hooks.HookAction=NS(SKIP_AGENT='skip-agent')
    phases=types.ModuleType('qwenpaw.runtime.phases')
    phases.Phase=NS(PRE_DISPATCH='pre',PRE_EXECUTE='execute',POST_RESPONSE='post',FINALLY='finally')
    monkeypatch.setitem(sys.modules,'qwenpaw.runtime.hooks',hooks)
    monkeypatch.setitem(sys.modules,'qwenpaw.runtime.phases',phases)
    module.care.register_hooks();assert len(registered)==4
    save_care(care_host,first_seen=False)
    client.post(prefix+'/notes',json={'content':'console 降级提醒','expires_at':'2026-10-15'})
    request=NS(companion_care_token=module.care.settings('alice')['token'],request_context={'source':'cron','cron_job_id':module.care.job_id('alice')})
    ctx=NS(agent_id='alice',workspace=ws,request=request)
    assert asyncio.run(registered[0].run(ctx)).action=='skip-agent'
    assert not sent
    # Invalid tokens never run delivery; owned cron remains silent without model work.
    request.companion_care_token='invalid'
    assert asyncio.run(registered[0].run(ctx)).action=='skip-agent'
    injections=[]
    user=NS(agent_id='alice',workspace=ws,request=NS(session_source=None,request_context={}),input_msgs=[{'role':'user'}],extras={},error=None,inject_context=lambda text,**kw:injections.append(text))
    asyncio.run(module.care.first_before(user))
    assert len(injections)==1  # automatic console fallback even if ordinary first-seen hints were off
    asyncio.run(module.care.first_after(user));module.care.release(user)


def test_memory_backfill_is_idempotent_for_dates_and_milestones(file_host):
    module,client,sdk,prefix,owner,root=file_host
    before={'milestones':[],'warmth_score':None}
    changes={'milestones':[{'date':'2026-01-01','event':'First   chat'}]}
    first=owner.prepare('relationship',changes,before)
    second=owner.prepare('relationship',{'milestones':[{'date':'2026-01-01','event':'first chat'}]},first)
    assert len(second['milestones'])==1
    first=owner.prepare('dates',[{'name':'生日','date':'2000-02-04'}],[])
    assert len(owner.prepare('dates',[{'name':' 生日 ','date':'2000-02-04'}],first))==1


def test_care_model_plan_is_reviewed_no_keys_and_greeting_keeps_facts(care_host,monkeypatch):
    module,client,prefix,owner,ws,chat,jobs,calls,sent,clock=care_host
    chat.channel='telegram'
    view=save_care(care_host,model_greeting=True,style='技术小跟班，少些套话')
    assert 'test-only-key' not in json.dumps(view)
    assert view['model_plan']['max_tokens']==384
    client.post(prefix+'/notes',json={'content':'喝水','expires_at':'2026-10-15'})
    models=[]
    def complete(provider,messages,tokens):
        models.append(messages)
        assert tokens==384 and '技术小跟班' in messages[0]['content']
        return {'greeting':'小跟班来报，有件你交代的小事。'},{'total_tokens':10}
    monkeypatch.setattr(owner,'complete',complete)
    assert asyncio.run(module.care.tick('alice',ws))['state']=='channel-accepted'
    assert len(models)==1 and '小跟班来报' in sent[0]['text'] and '喝水' in sent[0]['text']
    client.post(prefix+'/notes',json={'content':'第二件事','expires_at':'2026-10-15'})
    assert asyncio.run(module.care.tick('alice',ws))['state']=='daily-limit'
    assert len(models)==1 and len(sent)==1
    # Emergency stop never depends on current model configuration or a paid request.
    config=owner.settings().model_dump();config['base_url']='';config['model']=''
    owner.private_write(owner.path,config)
    assert client.post(prefix+'/care/stop',json={'agent_id':'alice','confirmed':True}).json()['state']=='disabled'
    assert not jobs


def test_care_review_invalidated_by_rules_or_model_changes(care_host):
    module,client,prefix,owner,ws,chat,jobs,calls,sent,clock=care_host
    body=client.get(prefix+'/care',params={'agent_id':'alice'}).json()['settings']
    body.update(first_seen=True,confirmed=True)
    review=client.post(prefix+'/care/preview',json=body).json()
    body.update(review_id=review['review_id'],max_daily=3)
    assert client.put(prefix+'/care',json=body).status_code==409
    body.update(model_greeting=True)
    review=client.post(prefix+'/care/preview',json=body).json();body['review_id']=review['review_id']
    config=owner.settings().model_dump();config['model']='another-model';owner.private_write(owner.path,config)
    assert client.put(prefix+'/care',json=body).status_code==409
    assert jobs=={} and sent==[]


def test_opt_in_dream_fiction_and_muted_queue_are_not_auto_sent(care_host):
    module,client,prefix,owner,ws,chat,jobs,calls,sent,clock=care_host
    chat.channel='telegram';save_care(care_host,dream_enabled=True)
    clock[0]=datetime(2026,10,15,21,0,tzinfo=timezone.utc)
    assert asyncio.run(module.care.tick('alice',ws))['state']=='channel-accepted'
    content=(module._DATA_DIR/'dreams'/'2026-10-15.md').read_text()
    assert '【创作梦境】' in content and '【创作梦境】' in sent[0]['text']
    clock[0]=datetime(2026,10,16,21,0,tzinfo=timezone.utc)
    asyncio.run(module.care.tick('alice',ws))
    assert len(sent)==1  # One explicit creative event, never a fabricated nightly routine.


def test_anniversary_filter_explicit_retry_and_uninstall_isolation(care_host):
    module,client,prefix,owner,ws,chat,jobs,calls,sent,clock=care_host
    save_care(care_host,anniversary_names=['生日'])
    client.post(prefix+'/dates',json={'name':'生日','date':'2000-10-16'})
    client.post(prefix+'/dates',json={'name':'其他日期','date':'2000-10-16'})
    module.care.collect('alice')
    queue=module.care.read()['agents']['alice']['queue']
    assert len(queue)==1 and '生日' in queue[0]['text']
    asyncio.run(module.care.tick('alice',ws))
    assert client.post(prefix+'/care/retry',json={'agent_id':'alice','event_id':queue[0]['id']}).status_code==400
    assert client.post(prefix+'/care/retry',json={'agent_id':'alice','event_id':queue[0]['id'],'confirmed':True}).status_code==200
    jobs['unrelated']=NS(id='unrelated',meta={'owner':'another-plugin'})
    asyncio.run(module.care.uninstall())
    assert any(key.startswith('companion-care-') for key in jobs)
    assert module.care.settings('alice')['enabled'] is True
    asyncio.run(module.care.uninstall(delete_files=True))
    assert list(jobs)==['unrelated'] and module.care.settings('alice')['enabled'] is False


def test_real_host_cron_schema_when_reference_available(care_host,monkeypatch):
    """Validate our actual generated task against the checked-out official model, when present."""
    import importlib.util
    from pathlib import Path
    reference=Path('/home/fanxing/repos/QwenPaw-reference/src/qwenpaw/app/crons/models.py')
    if not reference.exists():pytest.skip('official host reference is an optional local contract check')
    for name in ['qwenpaw.app','qwenpaw.app.crons','qwenpaw.app.channels']:
        package=types.ModuleType(name);package.__path__=[];monkeypatch.setitem(sys.modules,name,package)
    schema=types.ModuleType('qwenpaw.app.channels.schema');schema.DEFAULT_CHANNEL='console'
    monkeypatch.setitem(sys.modules,'qwenpaw.app.channels.schema',schema)
    spec=importlib.util.spec_from_file_location('qwenpaw.app.crons.models',reference)
    models=importlib.util.module_from_spec(spec);monkeypatch.setitem(sys.modules,spec.name,models);spec.loader.exec_module(models)
    save_care(care_host)
    actual=next(iter(care_host[6].values()))
    assert actual.dispatch.silent is True and actual.schedule.cron=='*/5 * * * *'
    assert actual.request.companion_care_token


def test_manually_rearmed_note_has_a_new_delivery_generation(care_host):
    module,client,prefix,owner,ws,chat,jobs,calls,sent,clock=care_host
    chat.channel='telegram';save_care(care_host)
    note=client.post(prefix+'/notes',json={'content':'可以重新提醒','expires_at':'2026-10-15'}).json()
    asyncio.run(module.care.tick('alice',ws));assert len(sent)==1
    assert client.put(prefix+'/notes/'+note['id'],json={'reminded':False}).status_code==200
    clock[0]=datetime(2026,10,16,9,0,tzinfo=timezone.utc)
    asyncio.run(module.care.tick('alice',ws));assert len(sent)==2
    assert client.get(prefix+'/notes?expired=true').json()[0]['reminded'] is True


def test_diaries_are_isolated_between_selected_agents(file_host,monkeypatch):
    module,client,sdk,prefix,owner,root=file_host
    if not sdk:pytest.skip('SDK workspace mode only')
    client.put(prefix+'/agents/bob/binding',json={'enabled':True})
    second=root.parent/'bob';second.mkdir();(second/'memory').mkdir()
    (root/'memory'/'2026-10-15.md').write_text('ALICE PRIVATE')
    (second/'memory'/'2026-10-15.md').write_text('BOB PRIVATE')
    async def select(request,agent_id):
        owner.require_bound(agent_id)
        return NS(workspace_dir=root if agent_id=='alice' else second)
    monkeypatch.setattr(owner,'workspace',select)
    for agent,expected,forbidden in [('alice','ALICE PRIVATE','BOB PRIVATE'),('bob','BOB PRIVATE','ALICE PRIVATE')]:
        response=client.get(prefix+'/timeline',params={'agent_id':agent,'day':'2026-10-15'})
        assert response.status_code==200 and response.json()['diary']==expected and forbidden not in response.text


def test_rearm_during_model_generation_cancels_the_old_attempt(care_host,monkeypatch):
    module,client,prefix,owner,ws,chat,jobs,calls,sent,clock=care_host
    chat.channel='telegram';save_care(care_host,model_greeting=True)
    note=client.post(prefix+'/notes',json={'content':'保持这个内容','expires_at':'2026-10-15'}).json()
    paid=[]
    def complete(*args):
        paid.append(1)
        assert client.put(prefix+'/notes/'+note['id'],json={'reminded':False}).status_code==200
        return {'greeting':'有件小事提醒你'},{}
    monkeypatch.setattr(owner,'complete',complete)
    assert asyncio.run(module.care.tick('alice',ws))['state']=='source-changed-before-send'
    assert sent==[]
    assert asyncio.run(module.care.tick('alice',ws))['state']=='channel-accepted'
    assert len(sent)==1 and len(paid)==1  # Daily model budget includes the cancelled attempt.


def test_unbinding_and_emergency_stop_do_not_require_a_model(care_host):
    module,client,prefix,owner,ws,chat,jobs,calls,sent,clock=care_host
    save_care(care_host)
    client.put(prefix+'/agents/alice/binding',json={'enabled':False})
    assert client.post(prefix+'/care/stop',json={'agent_id':'alice','confirmed':True}).json()['state']=='disabled'
    assert not jobs and not sent


def test_incremental_line_review_excludes_old_lines_and_never_stores_plaintext(file_host,monkeypatch):
    module,client,sdk,prefix,owner,root=file_host
    if not sdk:pytest.skip('SDK workspace mode only')
    (root/'MEMORY.md').write_text('已经整理的旧事实\npassword: NEVER-PERSIST\n',encoding='utf-8')
    ws=NS(workspace_dir=root)
    module.features.incremental('alice',ws)
    indexed=owner.read_json(module.features.state_path,{})['alice']
    module.features.acknowledge_lines('alice',indexed['line_hashes'])
    (root/'MEMORY.md').write_text('已经整理的旧事实\npassword: NEVER-PERSIST\n生日: 2000-02-04\n',encoding='utf-8')
    module.features.incremental('alice',ws)
    cache=module.features.state_path.read_text()
    assert '已经整理' not in cache and 'NEVER-PERSIST' not in cache and '生日' not in cache
    endpoint=prefix+'/organizer/backfill'
    source=client.post(endpoint+'/sources',json={'agent_id':'alice','profile':False,'recent':False,'incremental':True}).json()
    text=source['documents'][0]['text']
    assert '生日: 2000-02-04' in text and '旧事实' not in text and 'NEVER-PERSIST' not in text
    config=client.get(prefix+'/organizer/config').json()['config'];config['modules']['dates']['enabled']=True
    client.put(prefix+'/organizer/config',json=config)
    monkeypatch.setattr(owner,'complete',lambda *args:([{'name':'生日','date':'2000-02-04'}],{}))
    review=client.post(endpoint+'/review',json={'source_id':source['source_id'],'modules':['dates']}).json()
    preview=client.post(endpoint+'/preview',json={'review_id':review['review_id'],'confirmed':True}).json()
    assert client.post(endpoint+'/apply',json={'preview_id':preview['preview_id']}).status_code==200
    assert owner.read_json(module.features.state_path,{})['alice']['changed']==[]
