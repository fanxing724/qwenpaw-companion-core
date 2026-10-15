const {chromium}=require('playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const repo=path.resolve(__dirname,'..');
const pluginVersion=JSON.parse(fs.readFileSync(path.join(repo,'plugin.json'),'utf8')).version;
const output=process.env.COMPANION_PREVIEW_DIR || path.join(require('os').tmpdir(),'companion-core-preview');
fs.mkdirSync(output,{recursive:true});
const modules=path.dirname(path.dirname(require.resolve('react/package.json')));
const today=new Date().toLocaleDateString('en-CA');
const db={state:{date:today,mood:'平静而充实',energy:78,sleep:'昨晚睡了 8 小时',health:'状态不错',hunger:'刚刚好',dream:'穿过一片森林',note:'给自己留一点慢下来的时间'},schedule:{date:today,plan:[{time:'09:00',activity:'读书与晨间整理',mood:'期待'},{time:'14:00',activity:'去公园散步',mood:'放松'},{time:'20:30',activity:'记录今天的小确幸',mood:'平静'}]},notes:[{id:'n1',content:'周末一起去看展，记得提前预约。',created_at:today,expires_at:'',reminded:false},{id:'n2',content:'给家里的绿植浇水',created_at:today,expires_at:'',reminded:false}],relationship:{warmth_score:82,notes:'一起积累平凡而闪亮的日子。',milestones:[{date:'2026-10-01',event:'第一次一起看日落'}]},dates:{dates:[{name:'相遇纪念日',date:today,note:'记得这一天'},{name:'生日',date:'2000-12-20',note:'准备一份小惊喜'}]},dreams:[{date:today,content:'# '+today+' 的梦\n\n梦见穿过一片森林，树叶闪着光。'}]};
db.setup={completed:true,profile:{user_name:'',companion_name:''},has_existing_data:true};
db.agents={supported:true,agents:[{id:'alice',name:'测试智能体',agent_enabled:true,binding:'unbound',enabled_tools:[],total_tools:7,last_call:null}]};
let bindingWrites=0;
const organizerModules={};for(const key of ['state','schedule','dreams','notes','relationship','dates'])organizerModules[key]={enabled:key==='state',prompt:'仅整理明确事实',base_url:'',model:'',api_key:'',api_key_configured:false};
db.organizer={config:{base_url:'',model:'',api_key:'',api_key_configured:false,auto_enabled:false,agent_id:'',interval_minutes:30,recent_messages:30,max_context_chars:12000,max_output_tokens:1200,modules:organizerModules},definitions:{state:{type:'object'},schedule:{type:'object'},dreams:{type:'array'},notes:{type:'array'},relationship:{type:'object'},dates:{type:'array'}},auto_supported:true,status:{state:'idle'}};
let organizerPreviewCalls=0,organizerApplyCalls=0;
const scriptFiles={'/react.js':'react/umd/react.development.js','/react-dom.js':'react-dom/umd/react-dom.development.js','/dayjs.js':'dayjs/dayjs.min.js','/antd.js':'antd/dist/antd.min.js','/reset.css':'antd/dist/reset.css'};
const server=http.createServer(async(req,res)=>{
 if(req.url.startsWith('/api/companion-core/')){
  const endpoint=req.url.replace('/api/companion-core/','').split('?')[0];let body='';for await(const c of req)body+=c;const payload=body?JSON.parse(body):{};
  if(endpoint==='setup'){
   if(req.method==='POST')db.setup={completed:true,profile:payload,has_existing_data:db.setup.has_existing_data};
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(db.setup));return;
  }
  if(endpoint.startsWith('organizer/')){
   let value;
   if(endpoint==='organizer/config'){
    if(req.method==='PUT'){db.organizer.config=payload;for(const provider of [payload,...Object.values(payload.modules)]){provider.api_key_configured=!!provider.api_key||provider.api_key_configured;provider.api_key='';}}
    value=db.organizer;
   }else if(endpoint==='organizer/chats')value={chats:[{id:'chat-1',name:'最近的聊天',updated_at:'2026-10-15'}]};
   else if(endpoint==='organizer/preview'){organizerPreviewCalls++;value={preview_id:'preview-1',changes:{state:{before:{...db.state},after:{...db.state,mood:'整理后的心情'}}},message_count:10,chat_chars:300,requests:1,usage:[{module:'state',model:'cheap-model',usage:{total_tokens:150}}]};}
   else if(endpoint==='organizer/apply'){organizerApplyCalls++;db.state.mood='整理后的心情';value={state:'applied',modules:['state']};}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return;
  }
  if(endpoint==='agents/alice/binding' && req.method==='PUT'){
   bindingWrites++;
   const agent=db.agents.agents[0];agent.binding=payload.enabled?'bound':'unbound';agent.enabled_tools=payload.enabled?Array(7).fill('tool'):[];
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({agent,reload_scheduled:true,message:'配置已保存，已请求宿主重新加载'}));return;
  }
  if(req.method==='PUT'){
   if(endpoint.startsWith('notes/'))Object.assign(db.notes.find(n=>n.id===endpoint.split('/')[1]),payload);
   else Object.assign(db[endpoint],payload);
  }
  let value=endpoint==='health'?{version:pluginVersion,status:'ok',notes_count:2,dreams_count:1}:endpoint.startsWith('dreams/')?db.dreams[0]:db[endpoint];
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value||{}));return;
 }
 if(req.url==='/plugin.js'){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(repo+'/ui/index.js'));return;}
 if(scriptFiles[req.url]){res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(path.join(modules,scriptFiles[req.url])));return;}
 res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/reset.css"><style>body{margin:0;background:#fafafb}</style><div id="root"></div><script src="/react.js"></script><script src="/react-dom.js"></script><script src="/dayjs.js"></script><script src="/antd.js"></script><script>const dark=location.search.includes('dark');window.QwenPaw={host:{React,antd,useLocale:()=>({locale:location.search.includes('en')?'en-US':'zh-CN'}),useTheme:()=>({isDark:dark})},registerRoutes:(id,r)=>{window.Companion=r[0].component}};</script><script src="/plugin.js"></script><script>ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(antd.ConfigProvider,{theme:{algorithm:dark?antd.theme.darkAlgorithm:antd.theme.defaultAlgorithm,token:{colorPrimary:'#db4486',borderRadius:10}}},React.createElement(window.Companion)));</script>`);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:'+server.address().port;
 try{
  await page.goto(url);await page.getByText('平静而充实',{exact:true}).waitFor();
  await page.screenshot({path:path.join(output,'overview-desktop.png'),fullPage:true});
  const projectUrl='https://github.com/fanxing724/qwenpaw-companion-core';
  const githubLink=page.getByRole('link',{name:'GitHub',exact:true});
  assert.equal(await githubLink.getAttribute('href'),projectUrl);
  assert.equal(await githubLink.getAttribute('target'),'_blank');
  assert.equal(await githubLink.getAttribute('rel'),'noopener noreferrer');
  await page.getByRole('button',{name:/关\s*于/}).click();
  await page.getByText('由番星与 GPT 联合制作',{exact:true}).waitFor();
  await page.getByText('当前版本: v'+pluginVersion,{exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:'版本与下载',exact:true}).getAttribute('href'),projectUrl+'/releases');
  assert.equal(await page.getByRole('link',{name:'反馈问题',exact:true}).getAttribute('href'),projectUrl+'/issues');
  await page.screenshot({path:path.join(output,'about-desktop.png'),fullPage:true});
  await page.getByRole('tab',{name:'日程'}).click();
  await page.getByRole('button',{name:'编辑',exact:true}).first().click();
  const modal=page.getByRole('dialog');await modal.locator('input').nth(1).fill('读书后去散步');await modal.getByRole('button',{name:/保\s*存/}).click();
  await page.getByText('读书后去散步',{exact:true}).waitFor();assert.equal(db.schedule.plan[0].activity,'读书后去散步');
  await page.getByRole('tab',{name:'便签'}).click();
  await page.getByRole('button',{name:'编辑',exact:true}).first().click();await page.getByRole('dialog').locator('textarea').fill('修改后的预约提醒');await page.getByRole('dialog').getByRole('button',{name:/保\s*存/}).click();await page.getByText('修改后的预约提醒',{exact:true}).waitFor();
  await page.getByRole('textbox',{name:'搜索记录…'}).fill('不会匹配');await page.getByText('没有匹配的记录',{exact:true}).waitFor();await page.getByRole('textbox',{name:'搜索记录…'}).fill('预约');await page.getByText('修改后的预约提醒',{exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('.ant-message-notice'));
  await page.screenshot({path:path.join(output,'notes-desktop.png'),fullPage:true});
  await page.getByRole('tab',{name:'智能体绑定'}).click();
  await page.getByText('测试智能体',{exact:false}).waitFor();
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
  await page.getByRole('textbox',{name:/API 基址.*default/}).fill('http://localhost:9999/v1');
  await page.getByRole('textbox',{name:'模型名称 default',exact:true}).fill('cheap-model');
  await page.getByLabel('API Key（留空保留已保存密钥） default',{exact:true}).fill('fake-test-key');
  await page.getByLabel('整理目标智能体',{exact:true}).selectOption('alice');
  await page.getByLabel('近期会话',{exact:true}).selectOption('chat-1');
  await page.getByRole('button',{name:'保存 AI 设置',exact:true}).click();
  await page.getByText('配置已保存',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('API Key（留空保留已保存密钥） default',{exact:true}).inputValue(),'');
  await page.getByRole('button',{name:/整理并预览/ }).click();
  await page.getByText('本次只生成预览，尚未写入。预览有效期 10 分钟；期间数据变化会阻止覆盖。',{exact:true}).waitFor();
  assert.equal(organizerPreviewCalls,1);assert.equal(organizerApplyCalls,0);assert.equal(db.state.mood,'平静而充实');
  await page.screenshot({path:path.join(output,'organizer-preview.png'),fullPage:true});
  await page.getByRole('button',{name:'确认写入这些修改',exact:true}).click();
  await page.getByText('修改已写入，其他模块页面已刷新。',{exact:true}).waitFor();
  assert.equal(organizerApplyCalls,1);assert.equal(db.state.mood,'整理后的心情');
  db.state.mood='平静而充实';
  await page.setViewportSize({width:390,height:844});await page.getByRole('tab',{name:'今日总览'}).click();await page.getByText('平静而充实',{exact:true}).waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow');
  await page.screenshot({path:path.join(output,'overview-mobile.png'),fullPage:true});
  // Check row-heavy screens on a narrow viewport too.
  for(const name of ['日程','便签','重要日期','智能体绑定','AI 设置','关于']){await page.getByRole('tab',{name}).click();await page.waitForTimeout(200);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow in '+name);}
  await page.setViewportSize({width:1280,height:1000});await page.goto(url+'?dark');await page.getByText('平静而充实',{exact:true}).waitFor();await page.screenshot({path:path.join(output,'overview-dark.png'),fullPage:true});
  const beforeSetup=JSON.stringify([db.state,db.schedule,db.notes,db.relationship,db.dates,db.dreams]);
  db.setup={completed:false,profile:{user_name:'',companion_name:''},has_existing_data:true};
  await page.goto(url);const wizard=page.getByRole('dialog');await wizard.waitFor();
  await wizard.getByText('已检测到已有记录。本引导只保存设置，会保留现有数据。',{exact:true}).waitFor();
  await wizard.getByRole('textbox',{name:'你的称呼',exact:true}).fill('小星');
  await wizard.getByRole('textbox',{name:'陪伴对象的称呼',exact:true}).fill('小伴');
  await wizard.getByRole('button',{name:'下一步',exact:true}).click();
  await wizard.getByLabel('连接智能体',{exact:true}).selectOption('alice');
  await wizard.getByRole('button',{name:'绑定并继续',exact:true}).click();
  await wizard.getByText('配置 AI 模型',{exact:true}).waitFor();
  await page.screenshot({path:path.join(output,'setup-model.png'),fullPage:true});
  await page.getByText('完成设置',{exact:true}).click();
  await wizard.waitFor({state:'hidden'});assert.equal(db.setup.completed,true);assert.equal(db.setup.profile.user_name,'小星');
  assert.equal(JSON.stringify([db.state,db.schedule,db.notes,db.relationship,db.dates,db.dreams]),beforeSetup);
  assert.equal(organizerPreviewCalls,1,'setup makes no model calls');
  await page.reload();await page.getByText('平静而充实',{exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),0);
  await page.getByRole('button',{name:'使用引导',exact:true}).click();await page.getByRole('dialog').waitFor();
  await page.getByRole('dialog').getByRole('button',{name:'稍后设置',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.goto(url+'?en');await page.getByRole('tab',{name:'Overview'}).waitFor();await page.getByText('Current mood',{exact:true}).waitFor();
  await page.getByRole('tab',{name:'About'}).click();
  await page.getByText('Jointly created by 番星 and GPT',{exact:true}).waitFor();
  await page.getByRole('tab',{name:'Agent binding'}).click();
  await page.getByRole('button',{name:'Bind and enable tools'}).waitFor();
  db.agents={supported:false,reason:'宿主未注册 AI 工具',agents:[]};
  await page.getByRole('button',{name:'Refresh status'}).click();
  await page.getByText('宿主未注册 AI 工具',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log('Browser passed: GitHub and About links, credits, localized About page, overview, schedule edit, note edit/search, 390px layouts, dark theme, English, AI settings save/preview/apply, onboarding and preservation, agent bind/unbind/status and unsupported host; no page errors');
 }catch(error){console.error('Browser page errors:',errors);await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw error;}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
