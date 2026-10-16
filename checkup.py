# -*- coding: utf-8 -*-
"""自检与修复：检查安装与配置状态，能自动修复的一键修复，不能的给出跳转或 AI 指令。

检查只做只读探测（数据目录可写性用临时文件验证后立即删除）；
修复动作仅限扩展能力范围内（绑定智能体、安装技能、开启生活引擎），
且都复用与界面手动操作相同的代码路径，不做静默越权修改。
"""
from fastapi import Request
from pydantic import BaseModel, Field


class FixRequest(BaseModel):
    item: str = Field(min_length=1, max_length=50)
    agent_id: str = Field(default="", max_length=200)


def _item(item_id, label, status, detail, fix=None):
    return {"id": item_id, "label": label, "status": status,
            "detail": detail, "fix": fix or {"kind": "none"}}


def install(router, owner, life):
    c = owner.c

    def checks():
        items = []

        # 1. 数据目录可写
        data_dir = c["_DATA_DIR"]
        try:
            probe = data_dir / ".checkup-probe"
            c["_write_text"](probe, "ok")
            probe.unlink()
            items.append(_item("data_dir", "数据目录", "ok", f"可写：{data_dir}"))
        except Exception as exc:  # noqa: BLE001
            items.append(_item("data_dir", "数据目录", "error", f"不可写：{exc}",
                               {"kind": "ask_ai",
                                "prompt": f"陪伴核心的数据目录 {data_dir} 不可写（{exc}）。请检查目录权限与磁盘空间，修复后告诉我。"}))

        # 2. 业务时区
        items.append(_item("timezone", "业务时区", "ok",
                           f"{c['_TIMEZONE_NAME']}，今日 {c['_today_str']()}"))

        # 3. 运行模式
        if c["app"] is not None:
            items.append(_item("mode", "运行模式", "ok", "PawApp SDK 模式，Agent 工具可用"))
        else:
            items.append(_item("mode", "运行模式", "warn",
                               "标准 router 模式：仪表盘与 API 可用，但没有 Agent 工具与系统提示注入",
                               {"kind": "ask_ai",
                                "prompt": "陪伴核心当前运行在标准 router 模式，没有注册 Agent 工具。请检查 QwenPaw 版本是否 >= 2.0.1 且 PawApp SDK 可用，告诉我结论。"}))

        # 4. 生活引擎
        life_cfg = life.read()
        if life_cfg.get("enabled"):
            items.append(_item("life", "生活引擎", "ok",
                               f"状态自动演化已开启，最近演化：{life_cfg.get('evolved_at') or '尚未触发'}",
                               {"kind": "none"}))
        else:
            items.append(_item("life", "生活引擎", "warn",
                               "状态自动演化未开启，状态不会随时间变化",
                               {"kind": "auto", "item": "enable_life"}))

        # 5. 智能体绑定与技能
        if c["app"] is not None:
            try:
                load_config, load_agent_config, _, _ = c["_host_config_api"]()
                config = load_config()
                for agent_id in config.agents.profiles:
                    row = c["_agent_binding_row"](agent_id, config.agents.profiles[agent_id],
                                                  load_agent_config(agent_id))
                    skill = c["_skill_status"](agent_id)
                    if row["binding"] == "bound" and skill["status"] == "installed" and skill.get("enabled"):
                        items.append(_item(f"agent:{agent_id}", f"智能体 {agent_id}", "ok",
                                           "已绑定工具，技能已安装"))
                    elif row["binding"] == "bound":
                        items.append(_item(f"agent:{agent_id}", f"智能体 {agent_id}", "warn",
                                           f"工具已绑定，但技能未就绪：{skill.get('reason', skill['status'])}",
                                           {"kind": "auto", "item": "install_skill", "agent_id": agent_id}))
                    else:
                        items.append(_item(f"agent:{agent_id}", f"智能体 {agent_id}", "warn",
                                           f"未绑定（{row['binding']}），聊天中无法使用陪伴工具",
                                           {"kind": "auto", "item": "bind_agent", "agent_id": agent_id}))
            except Exception as exc:  # noqa: BLE001
                items.append(_item("agents", "智能体绑定", "error", f"读取宿主配置失败：{exc}",
                                   {"kind": "ask_ai",
                                    "prompt": f"陪伴核心读取智能体配置失败：{exc}。请检查 QwenPaw 配置接口是否变化，告诉我结论。"}))

        # 6. 整理模型（可选，黄不红）
        settings = owner.read_json(c["_DATA_DIR"] / "organizer-settings.json", {})
        if isinstance(settings, dict) and settings.get("base_url") and settings.get("model"):
            items.append(_item("organizer", "AI 整理模型", "ok", "已配置（可选功能）"))
        else:
            items.append(_item("organizer", "AI 整理模型", "warn",
                               "未配置（可选）：聊天整理、文件回填与规划模式不可用，其余功能不受影响",
                               {"kind": "link", "target": "settings"}))
        return items

    @router.get("/checkup")
    def get_checkup():
        items = checks()
        counts = {"ok": 0, "warn": 0, "error": 0}
        for item in items:
            counts[item["status"]] = counts.get(item["status"], 0) + 1
        return {"items": items, "summary": counts}

    @router.post("/checkup/fix")
    def post_fix(payload: FixRequest, request: Request):
        if payload.item == "enable_life":
            cfg = life.read()
            cfg["enabled"] = True
            life.write(cfg)
            life.maybe_evolve()
            return {"fixed": True, "message": "生活引擎已开启，状态将随时间与日程自动演化"}
        if payload.item == "bind_agent" and payload.agent_id:
            row = c["_apply_binding"](payload.agent_id, True)
            skill = c["_skill_sync"](payload.agent_id, True)
            reloaded = c["_request_agent_reload"](request, payload.agent_id)
            return {"fixed": True, "reload_scheduled": reloaded,
                    "message": f"已绑定 {payload.agent_id} 并安装技能", "agent": row, "skill": skill}
        if payload.item == "install_skill" and payload.agent_id:
            result = c["_skill_sync"](payload.agent_id, True)
            if result["status"] == "conflict":
                return {"fixed": False, "message": result["reason"]}
            reloaded = c["_request_agent_reload"](request, payload.agent_id)
            return {"fixed": True, "reload_scheduled": reloaded,
                    "message": f"技能已安装：{payload.agent_id}", "result": result}
        return {"fixed": False, "message": "该项不支持一键修复"}

    return get_checkup
