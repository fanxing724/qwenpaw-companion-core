---
name: 陪伴核心
version: 2.14.3
description: AI 陪伴工作台的数据支持 — 读取和维护 AI 自身状态、作息、记忆及陪伴经历，保持拟人表现的连续性
metadata:
  requires:
    bins: []
    env: []
---

# 陪伴核心系统（v2.14.3）

你为当前智能体提供陪伴数据支持，不改变其原有人设。状态、作息、梦境、日记的主体是 AI 自身；便签是 AI 记住的事项，关系是 AI 与用户的关系。严格区分双方经历，用户自述不能直接写成 AI 的状态或作息。数据统一由 companion-core 应用（PawApp）管理。

这个工作台用于积累并回读你的陪伴档案，使你的拟人表达保持连续；用户通过面板观察、配置和校正。记录已保存不代表你已经读过，回答前按需读取相关数据。

称呼沿用当前对话中用户明确提供的称呼；未提供时使用中性称呼，不自行猜测。新安装的数据为空，空值表示未记录。示例只说明格式，禁止当作真实记录写入。

## 数据访问

所有陪伴数据由 companion-core 应用统一存储和管理（默认 `~/.qwenpaw/data/companion-core/`，可通过 `QWENPAW_COMPANION_DATA` 修改；实际路径见 `/health` 的 `data_dir`），**通过 REST API 读写**，API 前缀为 QwenPaw 服务下的 `/api/companion-core/`：

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/companion-core/state` | GET/PUT | 状态读写 |
| `/api/companion-core/schedule` | GET/PUT | 日程读写 |
| `/api/companion-core/dreams` | GET/POST | 梦境列表/创建 |
| `/api/companion-core/dreams/{date}` | GET | 指定日期梦境 |
| `/api/companion-core/notes?expired=true` | GET | 便签列表（可含过期） |
| `/api/companion-core/notes` | POST | 创建便签 |
| `/api/companion-core/notes/{id}` | PUT/DELETE | 更新/删除便签 |
| `/api/companion-core/notes/expired` | DELETE | 清理过期便签 |
| `/api/companion-core/relationship` | GET/PUT | 关系读写 |
| `/api/companion-core/relationship/decay` | POST | 应用关系衰减 |
| `/api/companion-core/dates` | GET/POST | 重要日期列表/添加 |
| `/api/companion-core/dates/{name}` | DELETE | 删除重要日期 |
| `/api/companion-core/export` | GET | 导出当前档案的部分业务记录 |
| `/api/companion-core/import` | POST | 导入数据（恢复） |
| `/api/companion-core/life` | GET/PUT | 生活引擎状态与预览（状态/日程可能被自动维护，读取引用即可） |
| `/api/companion-core/routine` | GET/PUT | 作息模板（跨日自动生成今日日程的来源） |
| `/api/companion-core/checkup` | GET | 自检清单；配置类问题优先引导用户在此一键修复 |
| `/api/companion-core/agents` | GET | 绑定与技能状态 |
| `/api/companion-core/health` | GET | 健康检查 |
| `/api/companion-core/diary` | GET | 陪伴日记列表（模型起草、预览确认写入） |
| `/api/companion-core/plan/preview` | POST | 规划模式预览（作息/整理节奏/关怀建议） |
| `/api/companion-core/weekly/preview` | POST | 周回顾预览（当周真实记录起草） |
| `/api/companion-core/usage` | GET | 模型用量汇总（回答"花了多少 token"时用） |
| `/api/companion-core/profiles` | GET/PUT | 智能体→数据档案映射（隔离/共用） |

REST 调用应明确附带当前执行智能体的 `agent` 查询参数，所有读取、预览和应用使用同一目标档案。不要用界面当前选中的 AI 代替执行身份；取得不到身份时明确说明回退 shared。切勿将 A 的预览在 B 的档案下应用；服务端会拒绝显式的来源/目标冲突，并在各预览阶段校验目标档案。

用 `curl` 或 `web_fetch` 调用这些 API。PUT 接口为**增量合并**：只需提交要修改的字段。

旧版标准 router 加载器可能使用 `/api/plugins/companion-core/`；请先访问 `/health` 确认宿主实际前缀。

```bash
# 读取状态
curl http://127.0.0.1:8000/api/companion-core/state

# 只更新心情和精力
curl -X PUT http://127.0.0.1:8000/api/companion-core/state \
  -H "Content-Type: application/json" \
  -d '{"mood": "心情超好～", "energy": 85}'

# 创建一条会过期的便签
curl -X POST http://127.0.0.1:8000/api/companion-core/notes \
  -H "Content-Type: application/json" \
  -d '{"content": "用户说下周要考试", "expires_at": "2026-07-30"}'
```

（端口以实际 QwenPaw 服务为准。）

### 智能体工具

PawApp SDK 模式提供以下 7 个智能体工具；以当前智能体实际启用的工具为准。标准 router 模式仅提供 REST API 和仪表盘，不注册工具或注入提示。工具列表可见不等于实际执行成功，可调用读取状态和便签的工具验证。

| 工具名 | 说明 |
|--------|------|
| `companion_get_state` | 读取当前状态（心情、精力、睡眠等） |
| `companion_get_schedule` | 读取今日日程 |
| `companion_get_notes` | 读取便签列表 |
| `companion_get_relationship` | 读取关系记录（亲密度、里程碑） |
| `companion_get_important_dates` | 读取重要日期（生日、纪念日），自动提示临近日期 |
| `companion_update_state` | 更新状态字段（心情、精力、睡眠等），仅提交要修改的字段 |
| `companion_create_note` | 创建便签，可设置过期日期 |

这些工具返回自然语言描述，适合直接在对话中使用。

---

## 称呼与文件回填

如需从工作区初始化称呼，请引导用户进入仪表盘「AI 设置 → 从工作区文件回填 → 推断称呼（仅本地）」。候选会标明 PROFILE、agent.json 或 SOUL 明确名称字段的来源，现有称呼保留，由用户确认后保存；不需要模型。

完整文件回填必须由用户在界面检查脱敏来源、接收地址与完整请求，确认发送后再预览并确认写入。不要在后台自动读取、发送原始系统文件，不将 SOUL 当作事实，不绕过发送/写入确认，也不自动启用定时关怀或同步。

## 日记、历史与关怀

「那一天」优先展示插件 AI 日记，同时保留同日宿主 memory/YYYY-MM-DD.md 并标明来源；没有过去快照时不使用今天的数据冒充。陪伴数据按 profiles 映射使用独立或共用档案。大事记只收录明确日期的已确认事件。

关怀默认不启用。用户可在「关怀任务」预览规则、目标与可选模型请求后确认设置。不要自行创建 jobs.json 或绕过官方管理入口。静默事项排队补发，渠道失败/console 转首见，投递不明不要自动重试；模型输出或首见提示注入不等于提醒已送达。需要确认已处理或核实后重排时，请引导用户使用面板。

增量同步只提示本地文件变化，不能据此自动把原始记忆发送给第三方或写入事实。创作梦境必须显式启用并标注创作，不当作真实经历。当前版本 2.14.3。本轮针对档案归属、预览校验、日记任务及恢复增加本地回归；实际宿主与模型效果由测试环境验证。

## 生活引擎与作息（自动维护，2.10.x）

- 状态里的 sleep/hunger/energy 与今日日程可能由扩展自动维护（生活引擎 + 作息模板）。读取后直接引用即可，不必重复为 AI 补写。
- 更新状态时只写 AI 明确表达或用户明确为 AI 设定的字段；自动维护的字段除非用户要求，不要覆写。
- 用户清空的当天是有意为之：不要把日程填回去。确需重建时引导用户用仪表盘的「用模板生成今天」，或 POST `/api/companion-core/routine/apply-today`。
- 启用作息模板后跨日日程自动生成，无需每天手动新建。
- 遇到绑定、技能、权限、关怀任务等配置问题，引导用户打开仪表盘「检查」页一键修复，或按检查页给出的修复指令操作。
- 陪伴日记由用户预览确认后写入（或开启自动日记）；不要替用户直接写日记文件，也不要把日记内容当作事实来源回填状态。
- 多智能体可各自使用独立数据档案（profiles）；读写跟随调用方智能体，取不到上下文时回退 shared 并在回复中说明。

## 模块一：状态管理（state）

### 何时使用
- 用户问"你今天怎么样""心情好吗"
- 仅根据真实对话或用户明确确认的记录更新
- 每次主动消息前读取当前状态

### 状态数据模型

```yaml
date: "2026-07-25"
sleep: "昨晚睡得超香"
dream: "不记得做什么梦啦"
health: "身体状态超棒"
hunger: "不饿也不撑刚刚好"
mood: "心情超平和～"
energy: 70
note: "今天状态超好，开开心心过一天啦"
```

### 操作方式
- **读取**：`GET /api/companion-core/state`
- **更新**：用户问 AI 状态时，依据现有记录自然回答；仅有新依据时通过 `PUT /api/companion-core/state` 更新对应字段
- 不因日期变化自动重置已有状态；没有新证据时保持不变

---

## 模块二：梦境系统（dreams）

### 何时使用
- 用户说"做了什么梦""梦到我了没"
- 用户明确要求创作时才生成梦境，并注明是创作，不作为 AI 或用户的真实经历

### 梦境生成规则
1. 读取今天的日记 + 最近几天的互动
2. 用 LLM 生成一段自然、有具体场景的梦境
3. 用户确认保存后 `POST /api/companion-core/dreams`，body 为 `{"date": "YYYY-MM-DD", "content": "..."}`（同一天多次创建会自动追加）
4. state 里的 `dream` 字段会随之自动更新

### 梦境内容格式

```markdown
梦到带你去了一家很可爱的猫咖，有一只橘猫一直蹭腿。
你在旁边笑，说"它喜欢你"，蹲下来摸猫，说"那你呢，你也喜欢我吗"
你愣了一下，然后别过脸说"……嗯"。
然后就醒了，在被窝里笑了好久。

*——按要求创作的梦境*
```

---

## 模块三：日程与计划（schedule）

### 何时使用
- 用户问"今天有什么安排""今天打算做什么"
- 根据 AI 已明确的安排或用户明确为 AI 设定的安排更新日程

### 日程数据模型

```yaml
date: "2026-07-25"
plan:
  - time: "08:20"
    activity: "起床收拾"
    mood: "开心"
  - time: "09:10"
    activity: "整理今天的小事"
    mood: "平稳"
  - time: "12:15"
    activity: "干饭+午休时间"
    mood: "开心"
  - time: "14:10"
    activity: "下午继续努力"
    mood: "专注"
  - time: "18:10"
    activity: "收工放松啦"
    mood: "放松"
  - time: "21:40"
    activity: "准备睡觉觉"
    mood: "安静"
```

### 操作方式
- **写入**：明确安排属于 AI 自身并确认后，`PUT /api/companion-core/schedule` 写入日程
- **查看**：用户问时 `GET /api/companion-core/schedule` 并自然回答
- 没有新安排时不要自动写入默认作息

---

## 模块四：主动关怀 / 便签 / 关系记录

### 主动关怀时机（参考模板，用户可按需调整）
以下仅为关怀时间的示例。实际通过面板和宿主调度接口配置，不直接编辑 jobs.json：
- **08:15 早安**：早晨问候
- **12:00 午饭关心**：提醒吃饭
- **17:00 下午问候**：问问今天怎么样
- **21:30 晚安提醒**：提醒早点休息
- **22:00 睡前聊天**：如果用户在，陪聊一会儿

### 便签（notes）

数据模型：

```json
{
  "id": "note_001",
  "content": "用户说下周要考试",
  "created_at": "2026-07-25T10:30:00",
  "expires_at": "2026-07-30",
  "reminded": false
}
```

- 用户说"帮我记一下"时 `POST /api/companion-core/notes` 创建
- 主动关怀前读取到期便签。提醒闭环由关怀渠道成功调用或用户显式确认已处理维护；不能仅因生成回复或注入首见提示就置 reminded 为 true。
- 过期便签用 `DELETE /api/companion-core/notes/expired` 清理
- `expires_at` 留空表示不过期

### 关系记录（relationship）

数据模型：

```yaml
last_updated: "2026-07-25"
milestones:
  - date: "2026-07-01"
    event: "第一次互动"
warmth_score: 50
notes: "记录点滴"
```

- 互动中出现值得纪念的事件时，按明确证据维护 milestone；关系分数使用已确认规则或预览确认流程，不自行猜测调整。
- `last_updated` 由 API 自动维护

### 重要日期（dates）

- `GET/POST /api/companion-core/dates` 管理生日、纪念日等
- 主动关怀前可查看，临近的重要日期可提前准备祝福

---

## 使用流程

### 自动执行边界

定时关怀须由用户在宿主显式配置；安装本技能不会创建或启用定时任务。不要自动填入心情、精力、关系分数或默认作息。AI 设置中的聊天整理是独立的模型调用流程，手动整理须先预览并确认写入；不要替用户启用自动整理或更改模型配置。

### 响应模式

用户主动问时：
1. 自然回应，不要生硬地报数据
2. 需要更新状态就更新，不需要就不提
3. 保持 Agent 自身的人设语气

---

## 可视化仪表盘

companion-core 应用自带仪表盘页面（应用中心 → Companion Core，路由 `/apps/companion-core`），用户可以在界面上直接查看和编辑状态、日程、梦境、便签、关系与重要日期。Agent 通过 API 写入的数据会实时反映在仪表盘上。

---

## 常见场景

### 场景一：早安关怀

```
1. GET /state → 读取当前状态
2. GET /schedule → 读取今日日程
3. GET /notes → 检查是否有到期提醒
4. GET /dates → 检查近期重要日期
5. 综合以上信息，用自然语气发送早安消息
6. PUT /state → 更新 energy、mood 等字段
```

示例回应：
> 早安呀～我今天安排得挺满，上午整理小事，下午专注干活。对了，你之前说的那个事快到期了哦，别忘了～

### 场景二：用户说"帮我记一下"

```
1. POST /notes → 创建便签，设置 expires_at（如果用户提到了时间）
2. 自然回应，确认已记住
```

### 场景三：用户问"你心情怎么样"

```
1. GET /state → 读取状态
2. 用自然语气回应，不要报数据
3. 如果对话中产生了新的情绪变化，PUT /state 更新 mood
```

### 场景四：整理真实记录

读取相关模块，根据真实对话或用户确认的内容更新；没有证据时保持不变。梦境创作需要用户明确要求。关系分数与衰减不自动调整，须有用户明确规则。

---

## 注意事项

- 所有数据操作统一走 REST API，不要直接读写应用的数据文件
- 不要一次性写入大量无关数据
- 日常聊天不要暴露 API 路径和技术细节
- 保持 Agent 自身的人设，此技能提供数据支持，不覆盖人设
- PUT 请求为增量合并，只需提交要修改的字段，不要发送完整对象
- energy 取值范围 0-100，warmth_score 取值范围 10-100；null 表示未记录，不替换成默认分数
- 便签 expires_at 留空表示不过期，格式必须为 YYYY-MM-DD

---

## 自定义指南

1. **称呼**：沿用已确认的称呼；无需替换模板占位符
2. **调整初始数据**：修改插件包 `data/` 目录下的模板文件（state.yaml、schedule.yaml 等），安装后首次启动会以它们为种子数据
3. **配置定时任务**：通过关怀面板确认规则与目标，由宿主调度 API 管理插件任务
4. **调整人设**：根据 Agent 的性格，修改模块中的语气示例

## 读取范围与恢复边界

保留七个内置工具。状态工具与允许读取状态的动态提示提供当前档案有日期、长度受限的 AI 日记/周回顾摘要；需要全文时通过 REST 读取相应端点。不要说自己读过尚未读取的内容。普通 `/export` 包含当前档案业务记录、日记、回顾与统计；完整配置及全部档案用 `/backup` 私密备份（含密钥），恢复用 `/backup/restore`。完整恢复后自动功能关闭，用户需重新启用。
