const {chromium}=require('playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const repo=path.resolve(__dirname,'..');
const prefixCls=process.env.COMPANION_PREFIX_CLS || 'ant';
const pluginVersion=JSON.parse(fs.readFileSync(path.join(repo,'plugin.json'),'utf8')).version;
const output=process.env.COMPANION_PREVIEW_DIR || path.join(require('os').tmpdir(),'companion-core-preview');
fs.mkdirSync(output,{recursive:true});
const modules=path.dirname(path.dirname(require.resolve('react/package.json')));
const today=new Date().toLocaleDateString('en-CA');
const db={state:{date:today,mood:'平静而充实',energy:78,sleep:'昨晚睡了 8 小时',health:'状态不错',hunger:'刚刚好',dream:'穿过一片森林',note:'给自己留一点慢下来的时间'},schedule:{date:today,plan:[{time:'09:00',activity:'读书与晨间整理',mood:'期待'},{time:'14:00',activity:'去公园散步',mood:'放松'},{time:'20:30',activity:'记录今天的小确幸',mood:'平静'}]},notes:[{id:'n1',content:'周末一起去看展，记得提前预约。',created_at:today,expires_at:'',reminded:false},{id:'n2',content:'给家里的绿植浇水',created_at:today,expires_at:'',reminded:false}],relationship:{warmth_score:82,notes:'一起积累平凡而闪亮的日子。',milestones:[{date:'2026-10-01',event:'第一次一起看日落'}]},dates:{dates:[{name:'相遇纪念日',date:today,note:'记得这一天'},{name:'生日',date:'2000-12-20',note:'准备一份小惊喜'}]},dreams:[{date:today,content:'# '+today+' 的梦\n\n梦见穿过一片森林，树叶闪着光。'}]};
db.setup={completed:true,profile:{user_name:'',companion_name:''},has_existing_data:true};
db.agents={supported:true,agents:[{id:'alice',name:'测试智能体',agent_enabled:true,binding:'unbound',enabled_tools:[],total_tools:7,last_call:null}]};
db.profiles={map:{}};
let bindingWrites=0;
const organizerModules={};for(const key of ['state','schedule','dreams','notes','relationship','dates'])organizerModules[key]={enabled:key==='state',prompt:'仅整理明确事实',base_url:'',model:'',api_key:'',api_key_configured:false};
db.organizer={config:{base_url:'',model:'',api_key:'',api_key_configured:false,auto_enabled:false,agent_id:'',interval_minutes:30,recent_messages:30,max_context_chars:12000,max_output_tokens:1200,modules:organizerModules},definitions:{state:{type:'object'},schedule:{type:'object'},dreams:{type:'array'},notes:{type:'array'},relationship:{type:'object'},dates:{type:'array'}},auto_supported:true,status:{state:'idle'}};
let organizerPreviewCalls=0,organizerApplyCalls=0,careWrites=0;
const careConfig={agent_id:'alice',enabled:false,first_seen:false,sync_enabled:false,morning:false,notes:true,anniversaries:true,inactivity:false,dream_enabled:false,model_greeting:false,style:'',time:'08:15',quiet_start:'23:00',quiet_end:'08:00',max_daily:1,inactivity_days:7,anniversary_lead:3,channel:'console',user_id:'',session_id:'',confirmed:false,review_id:''};
const careQueue=[];

const scriptFiles={'/react.js':'react/umd/react.development.js','/react-dom.js':'react-dom/umd/react-dom.development.js','/dayjs.js':'dayjs/dayjs.min.js','/antd.js':'antd/dist/antd.min.js','/reset.css':'antd/dist/reset.css'};
const server=http.createServer(async(req,res)=>{
 if(req.url.startsWith('/api/companion-core/')){
  const endpoint=req.url.replace('/api/companion-core/','').split('?')[0];let body='';for await(const c of req)body+=c;const payload=body?JSON.parse(body):{};
  if(endpoint==='backup'){
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({format:'companion-core-backup-v1',contains_secrets:true,files:{'state.yaml':'mood: AI state'}}));return;
  }
  if(endpoint==='setup'){
   if(req.method==='POST')db.setup={completed:true,profile:payload,has_existing_data:db.setup.has_existing_data};
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(db.setup));return;
  }
  const params=new URL(req.url,'http://localhost').searchParams;
  if(endpoint==='timeline'){
   const day=params.get('day')||today;
   const value={agent_id:'alice',date:day,diary:'当天一起修复了插件 <script>window.timelineUnsafe=true</script>',dream:'【创作梦境】分号变成星星',state:day===today?db.state:null,schedule:day===today?db.schedule:null,countdown:[],dates:[today,'2025-10-15'],on_this_day:['2025-10-15'],milestones:db.relationship.milestones,shared_data_notice:'历史状态不补造',diary_notice:''};
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return;
  }
  if(endpoint==='relationship/score-preview'||endpoint==='relationship/score-apply'){
   const value=endpoint.endsWith('preview')?{preview_id:'score-1',proposed:35,current:db.relationship.warmth_score,parts:[{rule:'已确认里程碑',points:35,evidence:db.relationship.milestones}],notice:'本地计分，确认后写入'}:(db.relationship.warmth_score=35,{warmth_score:35});
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return;
  }
  if(endpoint==='care'||endpoint.startsWith('care/')){
   let value;
   if(endpoint==='care'){
    if(req.method==='PUT'){assert.equal(payload.review_id,'care-review');assert.equal(payload.confirmed,true);Object.assign(careConfig,payload);careWrites++;}
    value={settings:careConfig,targets:[{channel:'console',user_id:'u',session_id:'s'}],queue:careQueue,status:'idle',hooks_supported:true,scheduler_supported:true,notice:'仅在确认后启用',memory_changes:[],model_plan:{available:false}};
   }else if(endpoint==='care/preview')value={review_id:'care-review',rules:payload,model_plan:{available:false}};
   else if(endpoint==='care/followup-preview')value={draft:'那天修复插件的事情，后来怎么样了？'};
   else if(endpoint==='care/followup'){careQueue.push({id:'follow-1',text:payload.text,state:'pending'});value={state:'queued',notice:'跟进草稿已加入队列，尚未发送'};}
   else if(endpoint==='care/stop'){careConfig.enabled=false;value={state:'disabled'};}
   else if(endpoint==='care/ack'){careQueue.splice(0);value={state:'acknowledged'};}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return;
  }
  if(endpoint.startsWith('organizer/backfill/')){
   let value;
   const before={...db.setup.profile};
   if(endpoint.endsWith('/sources'))value={source_id:'source-local',documents:[{name:'PROFILE.md',role:'profile',text:'user_name: 番星',budget:4000,truncated:false,redacted:false}],candidates:[{field:'user_name',value:'番星',source:'PROFILE.md'},{field:'companion_name',value:'小伴',source:'agent.json'}],current_profile:before,notices:[]};
   if(endpoint.endsWith('/review')){assert.deepEqual(payload.modules,[]);value={review_id:'review-local',requests:[],profile:{before,after:payload.profile}};}
   if(endpoint.endsWith('/preview')){assert.equal(payload.confirmed,true);value={preview_id:'preview-local',changes:{profile:{before,after:{user_name:'番星',companion_name:'小伴'}}},requests:0,usage:[]};}
   if(endpoint.endsWith('/apply')){db.setup.profile={user_name:'番星',companion_name:'小伴'};value={state:'applied',modules:[]};}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return;
  }
  if(endpoint.startsWith('organizer/')){
   let value;
   if(endpoint==='organizer/config'){
    if(req.method==='PUT'){db.organizer.config=payload;for(const provider of [payload,...Object.values(payload.modules)]){provider.api_key_configured=!!provider.api_key||provider.api_key_configured;provider.api_key='';}}
    value=db.organizer;
   }else if(endpoint==='organizer/discover-model')value={available:true,base_url:'http://localhost:9999/v1',model:'cheap-model',api_key:'',hint:'模型候选已预填，密钥未复制'};
   else if(endpoint==='organizer/chats')value={chats:[{id:'chat-1',name:'最近的聊天',updated_at:'2026-10-15'}]};
   else if(endpoint==='organizer/preview'){organizerPreviewCalls++;value={preview_id:'preview-1',changes:{state:{before:{...db.state},after:{...db.state,mood:'整理后的心情'}}},message_count:10,chat_chars:300,requests:1,usage:[{module:'state',model:'cheap-model',usage:{total_tokens:150}}]};}
   else if(endpoint==='organizer/apply'){organizerApplyCalls++;db.state.mood='整理后的心情';value={state:'applied',modules:['state']};}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return;
  }
  if(endpoint==='agents/alice/binding' && req.method==='PUT'){
   bindingWrites++;
   const agent=db.agents.agents[0];agent.binding=payload.enabled?'bound':'unbound';agent.enabled_tools=payload.enabled?Array(7).fill('tool'):[];
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({agent,reload_scheduled:true,message:'配置已保存，已请求宿主重新加载'}));return;
  }
  if(endpoint==='notes' && req.method==='POST'){db.notes.push({id:'new-'+db.notes.length,...payload,created_at:today,reminded:false});}
  if(req.method==='PUT'){
   if(endpoint.startsWith('notes/'))Object.assign(db.notes.find(n=>n.id===endpoint.split('/')[1]),payload);
   else Object.assign(db[endpoint],payload);
  }
  let value=endpoint==='health'?{version:pluginVersion,status:'ok',notes_count:2,dreams_count:1}:endpoint.startsWith('dreams/')?db.dreams[0]:db[endpoint];
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value||{}));return;
 }
 if(req.url==='/plugin.js'){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(repo+'/ui/index.js'));return;}
 if(scriptFiles[req.url]){res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(path.join(modules,scriptFiles[req.url])));return;}
 res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/reset.css"><style>body{margin:0;background:#fafafb}</style><div id="root"></div><script src="/react.js"></script><script src="/react-dom.js"></script><script src="/dayjs.js"></script><script src="/antd.js"></script><script>const dark=location.search.includes('dark');window.QwenPaw={host:{React,antd,getSelectedAgentId:()=>window.selectedCompanionAgent||'',useLocale:()=>({locale:location.search.includes('en')?'en-US':'zh-CN'}),useTheme:()=>({isDark:dark})},registerRoutes:(id,r)=>{window.Companion=r[0].component}};</script><script src="/plugin.js"></script><script>ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(antd.ConfigProvider,{prefixCls:${JSON.stringify(prefixCls)},theme:{algorithm:dark?antd.theme.darkAlgorithm:antd.theme.defaultAlgorithm,token:{colorPrimary:'#db4486',borderRadius:10}}},React.createElement(window.Companion)));</script>`);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1280,height:1000}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error' && /same key|Each child|Cannot update a component/.test(m.text()))errors.push(m.text());});
 const url='http://127.0.0.1:'+server.address().port;
 try{
  await page.goto(url);await page.getByText('平静而充实',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'记一条便签',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'更新心情',exact:true}).count(),0);
  await page.getByText('AI 此刻心情',{exact:true}).waitFor();
  await page.getByText('AI 今天的安排',{exact:true}).waitFor();
  await page.getByText('读书与晨间整理',{exact:true}).waitFor();
  await page.screenshot({path:path.join(output,'overview-desktop.png'),fullPage:true});
  const projectUrl='https://github.com/fanxing724/qwenpaw-companion-core';
  await page.getByRole('tab',{name:'关于'}).click();
  assert.equal(await page.getByRole('link',{name:'GitHub 源码',exact:true}).getAttribute('href'),projectUrl);
  await page.getByText('由番星与 GPT 联合制作',{exact:true}).waitFor();
  await page.getByText('当前版本: v'+pluginVersion,{exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:'版本与下载',exact:true}).getAttribute('href'),projectUrl+'/releases');
  assert.equal(await page.getByRole('link',{name:'反馈问题',exact:true}).getAttribute('href'),projectUrl+'/issues');
  await page.screenshot({path:path.join(output,'about-desktop.png'),fullPage:true});
  await page.getByRole('tab',{name:'日程'}).click();
  await page.getByRole('button',{name:/编\s*辑/}).first().click();
  const modal=page.getByRole('dialog');await modal.locator('input').nth(1).fill('读书后去散步');await modal.getByRole('button',{name:/保\s*存/}).click();
  await page.getByText('读书后去散步',{exact:true}).waitFor();assert.equal(db.schedule.plan[0].activity,'读书后去散步');
  await page.getByRole('tab',{name:'便签'}).click();
  await page.getByRole('button',{name:/编\s*辑/}).first().click();await page.getByRole('dialog').locator('textarea').fill('修改后的预约提醒');await page.getByRole('dialog').getByRole('button',{name:/保\s*存/}).click();await page.getByText('修改后的预约提醒',{exact:true}).waitFor();
  await page.getByRole('textbox',{name:'搜索记录…'}).fill('不会匹配');await page.getByText('没有匹配的记录',{exact:true}).waitFor();await page.getByRole('textbox',{name:'搜索记录…'}).fill('预约');await page.getByText('修改后的预约提醒',{exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('.ant-message-notice'));
  await page.screenshot({path:path.join(output,'notes-desktop.png'),fullPage:true});
  await page.getByRole('tab',{name:'智能体绑定'}).click();
  await page.getByRole('heading',{name:/测试智能体/}).waitFor();
  await page.getByText('尚未观察到调用（仅记录本次插件运行期间）',{exact:true}).waitFor();
  await page.getByRole('button',{name:'绑定并启用工具'}).click();
  await page.getByText('工具启用数: 7/7',{exact:true}).waitFor();
  assert.equal(bindingWrites,1);
  // A mock host call record is shown only after a subsequent status read.
  db.agents.agents[0].last_call={tool:'companion_get_state',status:'success',at:'2026-10-15T20:00:00+08:00'};
  await page.getByRole('button',{name:'刷新状态'}).click();
  await page.getByText(/最近实际调用: companion_get_state/).waitFor();
  await page.screenshot({path:path.join(output,'agent-binding.png'),fullPage:true});
  await page.getByRole('button',{name:'解除绑定'}).click();
  await page.getByText('工具启用数: 0/7',{exact:true}).waitFor();
  assert.equal(bindingWrites,2);
  db.agents.agents[0].binding='bound';db.agents.agents[0].enabled_tools=Array(7).fill('tool');
  await page.getByRole('tab',{name:'AI 设置'}).click();
  await page.getByLabel('整理目标智能体',{exact:true}).selectOption('alice');
  await page.getByText('当前智能体: alice',{exact:true}).waitFor();
  await page.getByText('模型连接 · 未配置',{exact:true}).click();
  await page.getByRole('textbox',{name:/API 基址.*default/}).fill('http://localhost:9999/v1');
  await page.getByRole('textbox',{name:'模型名称 default',exact:true}).fill('cheap-model');
  await page.getByLabel('API Key（留空保留已保存密钥） default',{exact:true}).fill('fake-test-key');
  await page.getByRole('button',{name:'发现宿主模型（不复制密钥）',exact:true}).click();
  await page.getByText('模型候选已预填，密钥未复制',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('API Key（留空保留已保存密钥） default',{exact:true}).inputValue(),'');
  await page.getByLabel('近期会话',{exact:true}).selectOption('chat-1');
  const originalModel=await page.getByRole('textbox',{name:'模型名称 default',exact:true}).inputValue();
  await page.getByRole('textbox',{name:'模型名称 default',exact:true}).fill('draft-model');
  await page.getByRole('tab',{name:'便签',exact:false}).click();
  assert.equal(await page.getByRole('textbox',{name:'搜索记录…'}).inputValue(),'','agent switch resets old searches');
  await page.getByRole('textbox',{name:'搜索记录…'}).fill('预约');
  await page.getByRole('tab',{name:'AI 设置'}).click();
  assert.equal(await page.getByRole('textbox',{name:'模型名称 default',exact:true}).inputValue(),'draft-model','unsaved model survives tab switches');
  assert.equal(await page.getByLabel('近期会话',{exact:true}).inputValue(),'chat-1');
  await page.getByRole('textbox',{name:'模型名称 default',exact:true}).fill(originalModel);
  await page.getByRole('button',{name:'保存 AI 设置',exact:true}).click();
  await page.getByText('配置已保存',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('API Key（留空保留已保存密钥） default',{exact:true}).inputValue(),'');
  await page.getByText('高级参数与模块设置',{exact:true}).click();
  const companionBefore=JSON.stringify([db.state,db.schedule,db.notes,db.relationship,db.dates,db.dreams]);
  const backfill=page.locator('details:has(> summary:text-is("从工作区文件回填"))');
  await backfill.locator('summary').first().click();
  await backfill.getByRole('button',{name:'推断称呼（仅本地）',exact:true}).click();
  await backfill.getByLabel('backfill user_name',{exact:true}).waitFor();
  assert.equal(await backfill.getByLabel('backfill user_name',{exact:true}).inputValue(),'番星');
  assert.equal(await backfill.getByLabel('backfill companion_name',{exact:true}).inputValue(),'小伴');
  assert.equal(db.setup.profile.user_name,'');
  assert.equal(organizerPreviewCalls,0);
  await backfill.getByRole('button',{name:'生成发送全文（不调用模型）',exact:true}).click();
  const localPreview=backfill.getByRole('button',{name:'生成本地称呼结果预览',exact:true});
  await localPreview.waitFor();assert(await localPreview.isDisabled());
  await backfill.getByRole('checkbox',{name:/我已检查全文与接收地址/}).check();
  await localPreview.click();
  await backfill.getByRole('button',{name:'确认写入这些修改',exact:true}).click();
  await page.getByText('小伴 · 番星',{exact:true}).waitFor();
  assert.equal(db.setup.profile.user_name,'番星');
  assert.equal(JSON.stringify([db.state,db.schedule,db.notes,db.relationship,db.dates,db.dreams]),companionBefore);
  assert.equal(organizerPreviewCalls,0,'local name inference makes no model requests');

  await page.getByRole('button',{name:/整理并预览/ }).click();
  await page.getByText('本次只生成预览，尚未写入。预览有效期 10 分钟；期间数据变化会阻止覆盖。',{exact:true}).waitFor();
  await page.getByRole('tab',{name:'今日总览'}).click();
  await page.getByRole('tab',{name:'AI 设置'}).click();
  await page.getByText('本次只生成预览，尚未写入。预览有效期 10 分钟；期间数据变化会阻止覆盖。',{exact:true}).waitFor();
  assert.equal(organizerPreviewCalls,1);assert.equal(organizerApplyCalls,0);assert.equal(db.state.mood,'平静而充实');
  await page.screenshot({path:path.join(output,'organizer-preview.png'),fullPage:true});
  await page.getByRole('button',{name:'确认写入这些修改',exact:true}).click();
  await page.getByText('修改已写入，其他模块页面已刷新。',{exact:true}).waitFor();
  assert.equal(organizerApplyCalls,1);assert.equal(db.state.mood,'整理后的心情');
  db.state.mood='平静而充实';
  await page.getByRole('tab',{name:'那一天'}).click();
  await page.getByText('当天一起修复了插件 <script>window.timelineUnsafe=true</script>',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.timelineUnsafe),undefined);
  await page.getByText('2025-10-15',{exact:true}).first().click();
  await page.getByText('该日期暂无状态或日程历史；不会用今天的数据补填。',{exact:true}).first().waitFor();
  await page.getByRole('button',{name:'生成本地跟进草稿',exact:true}).click();
  await page.getByRole('textbox',{name:'问问现在怎么样',exact:true}).waitFor();
  await page.getByRole('button',{name:'确认加入跟进队列',exact:true}).click();
  await page.getByText('跟进草稿已加入队列，尚未发送',{exact:true}).waitFor();
  assert.equal(careQueue.length,1);assert.equal(careWrites,0);
  await page.getByRole('button',{name:'预览可解释亲密度',exact:true}).click();
  await page.getByRole('button',{name:'确认采用此分数',exact:true}).waitFor();
  assert.equal(db.relationship.warmth_score,82,'score preview must not write');
  await page.screenshot({path:path.join(output,'timeline-desktop.png'),fullPage:true});
  await page.getByRole('tab',{name:'关怀任务'}).click();
  await page.getByRole('checkbox',{name:'启用每日首见提示（成功响应后持久记录）',exact:true}).check();
  const consent=page.getByRole('checkbox',{name:'我已核对接收者、开关、静默时段和消息上限，确认保存。',exact:true});
  assert(await consent.isDisabled(),'care confirmation is gated by rule preview');
  await page.getByRole('button',{name:'预览完整规则与模型请求（不启用）',exact:true}).click();
  await consent.check();
  await page.getByRole('button',{name:'确认保存关怀设置',exact:true}).click();
  await page.getByText('已保存',{exact:true}).waitFor();
  assert.equal(careWrites,1);assert.equal(careConfig.first_seen,true);assert.equal(careConfig.enabled,false);
  await page.screenshot({path:path.join(output,'care-desktop.png'),fullPage:true});

  await page.getByRole('tab',{name:'数据',exact:false}).click();
  const privateOption=page.getByRole('checkbox',{name:'完整私密备份（全部档案与配置，含密钥）',exact:true});
  assert.equal(await privateOption.isChecked(),false);
  await privateOption.check();
  const backupDownload=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出数据',exact:true}).click();
  const downloaded=await backupDownload;
  const backupPath=path.join(output,'private-backup-test.json');
  await downloaded.saveAs(backupPath);
  assert.equal(JSON.parse(fs.readFileSync(backupPath,'utf8')).format,'companion-core-backup-v1');
  await page.setViewportSize({width:390,height:844});await page.getByRole('tab',{name:'今日总览'}).click();await page.getByText('平静而充实',{exact:true}).waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow');
  await page.screenshot({path:path.join(output,'overview-mobile.png'),fullPage:true});
  // Check row-heavy screens on a narrow viewport too.
  for(const name of ['日程','便签','重要日期','智能体绑定','AI 设置','那一天','关怀任务','关于']){await page.getByRole('tab',{name}).click();await page.waitForTimeout(200);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow in '+name);}
  await page.setViewportSize({width:1280,height:1000});await page.goto(url+'?dark');await page.getByText('平静而充实',{exact:true}).waitFor();await page.screenshot({path:path.join(output,'overview-dark.png'),fullPage:true});
  const beforeSetup=JSON.stringify([db.state,db.schedule,db.notes,db.relationship,db.dates,db.dreams]);
  db.setup={completed:false,profile:{user_name:'',companion_name:''},has_existing_data:true};
  await page.goto(url);const wizard=page.getByRole('dialog');await wizard.waitFor();
  await wizard.getByText('已检测到已有记录。本引导只保存设置，会保留现有数据。',{exact:true}).waitFor();
  await wizard.getByRole('textbox',{name:'你的称呼',exact:true}).fill('小星');
  await wizard.getByRole('textbox',{name:'陪伴对象的称呼',exact:true}).fill('小伴');
  await wizard.getByRole('button',{name:/下一步/}).click();
  await wizard.getByLabel('连接智能体',{exact:true}).selectOption('alice');
  await wizard.getByRole('button',{name:'绑定并继续',exact:true}).click();
  await wizard.getByRole('heading',{name:'开启生活引擎',exact:true}).waitFor();
  await wizard.getByRole('button',{name:/下一步/}).click();
  await wizard.getByText('配置 AI 模型（可选）',{exact:true}).waitFor();
  await page.screenshot({path:path.join(output,'setup-model.png'),fullPage:true});
  await page.getByText('完成设置',{exact:true}).click();
  await wizard.waitFor({state:'hidden'});assert.equal(db.setup.completed,true);assert.equal(db.setup.profile.user_name,'小星');
  assert.equal(JSON.stringify([db.state,db.schedule,db.notes,db.relationship,db.dates,db.dreams]),beforeSetup);
  assert.equal(organizerPreviewCalls,1,'setup makes no model calls');
  await page.reload();await page.getByText('平静而充实',{exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),0);
  await page.getByRole('button',{name:'快速配置',exact:true}).click();await page.getByRole('dialog').waitFor();
  await page.getByRole('dialog').getByRole('button',{name:'稍后设置',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  db.profiles.map.alice='alice';
  await page.getByLabel('选择 AI 智能体',{exact:true}).selectOption('@host');
  await page.evaluate(()=>window.selectedCompanionAgent='alice');
  await page.getByText('当前智能体: alice',{exact:true}).waitFor();
  await page.getByText('· 数据档案: alice',{exact:true}).waitFor();
  await page.getByRole('tab',{name:'AI 设置'}).click();
  await page.getByText(/模型连接 · /).click();
  await page.getByRole('textbox',{name:'模型名称 default',exact:true}).fill('alice-unsaved');
  await page.evaluate(()=>window.selectedCompanionAgent='bob');
  await page.getByText('当前智能体: bob',{exact:true}).waitFor();
  assert.equal(await page.locator('.cc-context').count(),1,'scope changes keep a single context indicator');
  await page.getByText(/模型连接 · /).click();
  assert.notEqual(await page.getByRole('textbox',{name:'模型名称 default',exact:true}).inputValue(),'alice-unsaved','agent switch resets old draft');
  await page.getByRole('tab',{name:'状态',exact:false}).click();
  await page.getByRole('button',{name:/编\s*辑/}).click();
  await page.getByRole('dialog').locator('input').first().fill('AI Bob 的状态');
  const scopedWrite=page.waitForRequest(r=>r.method()==='PUT' && r.url().includes('/state?agent=bob'));
  await page.getByRole('dialog').getByRole('button',{name:/保\s*存/}).click();
  await scopedWrite;
  await page.getByRole('dialog').waitFor({state:'hidden'});
  db.state.mood='平静而充实';
  await page.getByLabel('选择 AI 智能体',{exact:true}).selectOption('alice');
  await page.getByText('当前智能体: alice',{exact:true}).waitFor();
  await page.waitForTimeout(1200);
  assert.equal(await page.getByLabel('选择 AI 智能体',{exact:true}).inputValue(),'alice','manual selection is not overridden by host polling');
  await page.goto(url+'?en');await page.getByRole('tab',{name:'Overview'}).waitFor();await page.getByText('AI mood',{exact:true}).waitFor();
  await page.getByRole('tab',{name:'About'}).click();
  await page.getByText('Jointly created by 番星 and GPT',{exact:true}).waitFor();
  await page.getByRole('tab',{name:'Agent binding'}).click();
  await page.getByRole('button',{name:'Bind and enable tools'}).waitFor();
  db.agents={supported:false,reason:'宿主未注册 AI 工具',agents:[]};
  await page.getByRole('button',{name:'Refresh status'}).click();
  await page.getByText('宿主未注册 AI 工具',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log('Browser passed ('+prefixCls+'): AI-owned overview, full AI schedule, cached search/model/chat/preview, scope reset and scoped writes, manual scope selection, timeline/diary/on-this-day safe text, follow-up queue, score preview, model discovery, care review gates, local name inference, review/consent/apply without model calls, GitHub and About links, credits, localized About page, overview, schedule edit, note edit/search, 390px layouts, dark theme, English, AI settings save/preview/apply, onboarding and preservation, agent bind/unbind/status and unsupported host; no page errors');
 }catch(error){console.error('Browser page errors:',errors);await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw error;}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
