"""Exercise standard router loading against isolated user data."""
import importlib.util
import json
from pathlib import Path
import sys
import types

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(params=[False, True])
def loaded(request, tmp_path, monkeypatch):
    monkeypatch.setenv('QWENPAW_COMPANION_DATA', str(tmp_path))
    # Model SDK presence separately from standard router loading.
    host = types.ModuleType('qwenpaw')
    host.__path__ = []
    monkeypatch.setitem(sys.modules, 'qwenpaw', host)
    monkeypatch.delitem(sys.modules, 'qwenpaw.pawapp', raising=False)
    if request.param:
        class PawApp:
            def __init__(self, **kwargs):
                self.tools = []
            def include_router(self, router):
                self.router = router
            def tool(self, name, **kwargs):
                self.tools.append(name)
                return lambda fn: fn
            def prompt_section(self, *args, **kwargs):
                pass
            def on_launch(self, fn):
                self.launch = fn
                return fn
            def hook(self, name):
                return lambda fn: fn
        sdk = types.ModuleType('qwenpaw.pawapp')
        sdk.PawApp = PawApp
        monkeypatch.setitem(sys.modules, 'qwenpaw.pawapp', sdk)
    spec = importlib.util.spec_from_file_location('companion_test', ROOT / 'plugin.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    web = FastAPI()
    web.include_router(module.app.router if request.param else module.router,
                       prefix='/api/companion-core' if request.param else '/api/plugins/companion-core')
    with TestClient(web) as client:
        yield module, client, tmp_path, bool(request.param)


def test_load_and_preserve_existing_data(loaded):
    module, client, data, sdk = loaded
    prefix = '/api/companion-core' if sdk else '/api/plugins/companion-core'
    health = client.get(prefix + '/health').json()
    assert health['version'] == json.loads((ROOT / 'plugin.json').read_text())['version']
    assert health['agent_tools'] is sdk
    if sdk:
        assert len(module.app.tools) == 7
    assert client.put(prefix + '/state', json={'mood': '测试心情', 'energy': 42}).status_code == 200
    module._seed_data()
    state = client.get(prefix + '/state').json()
    assert state['mood'] == '测试心情' and state['energy'] == 42
    assert (data / 'schedule.yaml').exists()


def test_dashboard_data_and_restore(loaded):
    _, client, _, sdk = loaded
    prefix = '/api/companion-core' if sdk else '/api/plugins/companion-core'
    for path in ['/state', '/schedule', '/dreams', '/notes', '/relationship', '/dates']:
        assert client.get(prefix + path).status_code == 200
    note = client.post(prefix + '/notes', json={'content': '记得喝水'}).json()
    assert note['id']
    assert client.put(prefix + '/notes/' + note['id'], json={'content': '记得休息'}).status_code == 200
    assert client.post(prefix + '/dreams', json={'date': '2026-10-15', 'content': '一场好梦'}).status_code == 200
    assert '一场好梦' in client.get(prefix + '/dreams/2026-10-15').json()['content']
    assert client.post(prefix + '/dates', json={'name': '纪念日', 'date': '2026-10-15'}).status_code == 200
    backup = client.get(prefix + '/export').json()
    assert client.delete(prefix + '/notes/' + note['id']).status_code == 200
    response = client.post(prefix + '/import', json=backup)
    assert response.status_code == 200, response.text
    assert any(n['content'] == '记得休息' for n in client.get(prefix + '/notes').json())


def test_invalid_updates_and_import_do_not_change_data(loaded):
    _, client, _, sdk = loaded
    prefix = '/api/companion-core' if sdk else '/api/plugins/companion-core'
    original = client.get(prefix + '/export').json()
    for path, body in [('/dreams', {'date': '2026-02-30', 'content': 'x'}),
                       ('/notes', {'content': 'x', 'expires_at': '2026-13-01'}),
                       ('/dates', {'name': ' ', 'date': '2026-10-15'})]:
        assert client.post(prefix + path, json=body).status_code == 422
    assert client.put(prefix + '/schedule', json={'plan': [{'time': '25:99', 'activity': 'test'}]}).status_code == 422
    assert client.post(prefix + '/import', json={'state': {'mood': '不应写入'}, 'notes': [1]}).status_code == 400
    assert client.get(prefix + '/state').json() == original['state']
    assert client.post(prefix + '/import', json={'unrelated': True}).status_code == 400
    note = client.post(prefix + '/notes', json={'content': '保留这条'}).json()
    assert client.put(prefix + '/notes/' + note['id'], json={'content': ' '}).status_code == 400
    assert any(n['content'] == '保留这条' for n in client.get(prefix + '/notes').json())


def test_note_ids_are_unique_and_edit_preserves_metadata(loaded):
    _, client, _, sdk = loaded
    prefix = '/api/companion-core' if sdk else '/api/plugins/companion-core'
    notes = [client.post(prefix + '/notes', json={'content': '便签'}).json() for _ in range(20)]
    assert len({n['id'] for n in notes}) == 20
    note = notes[0]
    updated = client.put(prefix + '/notes/' + note['id'], json={'content': '编辑后', 'expires_at': '2028-02-29'}).json()
    assert updated['created_at'] == note['created_at']
    assert updated['content'] == '编辑后'
    assert client.put(prefix + '/notes/' + note['id'], json={'reminded': True}).json()['content'] == '编辑后'


def test_anniversaries_use_valid_leap_day(loaded):
    from datetime import date
    module, _, _, _ = loaded
    assert module._days_until_anniversary('2020-02-29', date(2026, 10, 15)) == (date(2028, 2, 29) - date(2026, 10, 15)).days
    assert module._days_until_anniversary('2000-10-15', date(2026, 10, 15)) == 0


@pytest.fixture
def binding_host(loaded, monkeypatch):
    from copy import deepcopy
    from types import SimpleNamespace as NS
    module, client, _, sdk = loaded
    profiles = {'alice': NS(name='Alice', enabled=True), 'bob': NS(name='Bob', enabled=True),
                'off': NS(name='Off', enabled=False)}
    saved = {key: NS(tools=NS(builtin_tools={'unrelated': NS(name='unrelated', enabled=True, config={'keep':1})})) for key in profiles}
    saves = []
    def save(key, value):
        saved[key] = deepcopy(value)
        saves.append(key)
    monkeypatch.setattr(module, '_host_config_api', lambda: (
        lambda: NS(agents=NS(profiles=profiles)), lambda key: deepcopy(saved[key]), save,
        lambda **kw: NS(**kw)))
    reloads = []
    utils = types.ModuleType('qwenpaw.app.utils')
    utils.schedule_agent_reload = lambda request, agent_id: reloads.append(agent_id) or True
    monkeypatch.setitem(sys.modules, 'qwenpaw.app.utils', utils)
    return module, client, sdk, saved, saves, reloads


def test_binding_config_and_unbinding_are_agent_scoped(binding_host):
    module, client, sdk, saved, saves, reloads = binding_host
    prefix = '/api/companion-core' if sdk else '/api/plugins/companion-core'
    status = client.get(prefix + '/agents').json()
    if not sdk:
        assert status['supported'] is False
        assert client.put(prefix + '/agents/alice/binding', json={'enabled':True}).status_code == 503
        assert not saves
        return
    assert all(row['binding'] == 'unbound' for row in status['agents'])
    bound = client.put(prefix + '/agents/alice/binding', json={'enabled':True})
    assert bound.status_code == 200, bound.text
    assert bound.json()['agent']['binding'] == 'bound'
    assert bound.json()['reload_scheduled'] is True
    assert reloads == ['alice']
    assert all(saved['alice'].tools.builtin_tools[name].enabled for name in module.TOOL_NAMES)
    assert saved['alice'].tools.builtin_tools['unrelated'].config == {'keep':1}
    assert len(saved['bob'].tools.builtin_tools) == 1
    assert client.put(prefix + '/agents/unknown/binding', json={'enabled':True}).status_code == 404
    assert client.put(prefix + '/agents/off/binding', json={'enabled':True}).status_code == 409
    assert saves == ['alice']
    unbound = client.put(prefix + '/agents/alice/binding', json={'enabled':False}).json()
    assert unbound['agent']['binding'] == 'unbound'
    assert saved['alice'].tools.builtin_tools['unrelated'].enabled


def test_actual_tool_call_tracking_and_prompt_scope(binding_host, monkeypatch):
    import asyncio
    module, client, sdk, _, _, _ = binding_host
    if not sdk:
        return
    prefix = '/api/companion-core'
    client.put(prefix + '/agents/alice/binding', json={'enabled':True})
    monkeypatch.setattr(module, '_current_agent_id', lambda: 'alice')
    assert 'companion_get_state' in module._build_prompt(None)
    asyncio.run(module.companion_get_state())
    rows = client.get(prefix + '/agents').json()['agents']
    alice = next(row for row in rows if row['id']=='alice')
    assert alice['last_call']['tool'] == 'companion_get_state'
    assert alice['last_call']['status'] == 'success'
    assert next(row for row in rows if row['id']=='bob')['last_call'] is None
    monkeypatch.setattr(module, '_current_agent_id', lambda: 'bob')
    assert module._build_prompt(None) == ''
    monkeypatch.setattr(module, '_current_agent_id', lambda: None)
    asyncio.run(module.companion_get_notes())
    assert None not in module._call_history


def test_binding_reload_failure_is_not_reported_as_live(binding_host, monkeypatch):
    module, client, sdk, _, _, _ = binding_host
    if not sdk:
        return
    monkeypatch.setattr(sys.modules['qwenpaw.app.utils'], 'schedule_agent_reload', lambda *args: False)
    result = client.put('/api/companion-core/agents/alice/binding', json={'enabled':True}).json()
    assert result['agent']['binding'] == 'bound'
    assert result['reload_scheduled'] is False
    assert '重启' in result['message']


def test_no_active_ui_agent_fallback_for_call_tracking(loaded, monkeypatch):
    from contextvars import ContextVar
    module, _, _, _ = loaded
    app_package = types.ModuleType('qwenpaw.app')
    context_module = types.ModuleType('qwenpaw.app.agent_context')
    context_module.get_current_agent_id = lambda: 'wrong-active-ui-agent'
    context_module._current_agent_id = ContextVar('test_agent', default=None)
    app_package.agent_context = context_module
    monkeypatch.setitem(sys.modules, 'qwenpaw.app', app_package)
    monkeypatch.setitem(sys.modules, 'qwenpaw.app.agent_context', context_module)
    assert module._current_agent_id() is None
    module._record_tool_call('companion_get_state', 'success')
    assert not module._call_history
    token = context_module._current_agent_id.set('real-agent')
    try:
        assert module._current_agent_id() == 'real-agent'
    finally:
        context_module._current_agent_id.reset(token)
