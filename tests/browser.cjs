const {chromium}=require('playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const repo=path.resolve(__dirname,'..');
const output=process.env.COMPANION_PREVIEW_DIR || path.join(require('os').tmpdir(),'companion-core-preview');
fs.mkdirSync(output,{recursive:true});
const modules=path.dirname(path.dirname(require.resolve('react/package.json')));
const today=new Date().toLocaleDateString('en-CA');
const db={state:{date:today,mood:'平静而充实',energy:78,sleep:'昨晚睡了 8 小时',health:'状态不错',hunger:'刚刚好',dream:'穿过一片森林',note:'给自己留一点慢下来的时间'},schedule:{date:today,plan:[{time:'09:00',activity:'读书与晨间整理',mood:'期待'},{time:'14:00',activity:'去公园散步',mood:'放松'},{time:'20:30',activity:'记录今天的小确幸',mood:'平静'}]},notes:[{id:'n1',content:'周末一起去看展，记得提前预约。',created_at:today,expires_at:'',reminded:false},{id:'n2',content:'给家里的绿植浇水',created_at:today,expires_at:'',reminded:false}],relationship:{warmth_score:82,notes:'一起积累平凡而闪亮的日子。',milestones:[{date:'2026-10-01',event:'第一次一起看日落'}]},dates:{dates:[{name:'相遇纪念日',date:today,note:'记得这一天'},{name:'生日',date:'2000-12-20',note:'准备一份小惊喜'}]},dreams:[{date:today,content:'# '+today+' 的梦\n\n梦见穿过一片森林，树叶闪着光。'}]};
const scriptFiles={'/react.js':'react/umd/react.development.js','/react-dom.js':'react-dom/umd/react-dom.development.js','/dayjs.js':'dayjs/dayjs.min.js','/antd.js':'antd/dist/antd.min.js','/reset.css':'antd/dist/reset.css'};
const server=http.createServer(async(req,res)=>{
 if(req.url.startsWith('/api/companion-core/')){
  const endpoint=req.url.replace('/api/companion-core/','').split('?')[0];let body='';for await(const c of req)body+=c;const payload=body?JSON.parse(body):{};
  if(req.method==='PUT'){
   if(endpoint.startsWith('notes/'))Object.assign(db.notes.find(n=>n.id===endpoint.split('/')[1]),payload);
   else Object.assign(db[endpoint],payload);
  }
  let value=endpoint==='health'?{version:'2.4.0',status:'ok',notes_count:2,dreams_count:1}:endpoint.startsWith('dreams/')?db.dreams[0]:db[endpoint];
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
  await page.getByRole('tab',{name:'日程'}).click();
  await page.getByRole('button',{name:'编辑',exact:true}).first().click();
  const modal=page.getByRole('dialog');await modal.locator('input').nth(1).fill('读书后去散步');await modal.getByRole('button',{name:/保\s*存/}).click();
  await page.getByText('读书后去散步',{exact:true}).waitFor();assert.equal(db.schedule.plan[0].activity,'读书后去散步');
  await page.getByRole('tab',{name:'便签'}).click();
  await page.getByRole('button',{name:'编辑',exact:true}).first().click();await page.getByRole('dialog').locator('textarea').fill('修改后的预约提醒');await page.getByRole('dialog').getByRole('button',{name:/保\s*存/}).click();await page.getByText('修改后的预约提醒',{exact:true}).waitFor();
  await page.getByRole('textbox',{name:'搜索记录…'}).fill('不会匹配');await page.getByText('没有匹配的记录',{exact:true}).waitFor();await page.getByRole('textbox',{name:'搜索记录…'}).fill('预约');await page.getByText('修改后的预约提醒',{exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('.ant-message-notice'));
  await page.screenshot({path:path.join(output,'notes-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.getByRole('tab',{name:'今日总览'}).click();await page.getByText('平静而充实',{exact:true}).waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow');
  await page.screenshot({path:path.join(output,'overview-mobile.png'),fullPage:true});
  // Check row-heavy screens on a narrow viewport too.
  for(const name of ['日程','便签','重要日期']){await page.getByRole('tab',{name}).click();await page.waitForTimeout(200);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow in '+name);}
  await page.setViewportSize({width:1280,height:1000});await page.goto(url+'?dark');await page.getByText('平静而充实',{exact:true}).waitFor();await page.screenshot({path:path.join(output,'overview-dark.png'),fullPage:true});
  await page.goto(url+'?en');await page.getByRole('tab',{name:'Overview'}).waitFor();await page.getByText('Current mood',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log('Browser passed: overview, schedule edit, note edit/search, 390px layouts, dark theme, English; no page errors');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
