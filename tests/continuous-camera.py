"""Continuous video bulk scanner: one click, then automatic captures on card changes.
All camera frames are synthetic testing imagery; real-photo accuracy remains unverified.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  ctx=browser.new_context(viewport={'width':390,'height':844},service_workers='block',locale='en-CA')
  page=ctx.new_page()
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.add_init_script("""
   (() => {
    const original=HTMLVideoElement.prototype.play;
    window.__syntheticCamera=()=> {
      const canvas=document.createElement('canvas');canvas.width=480;canvas.height=650;
      const ctx=canvas.getContext('2d');window.__camCanvas=canvas;window.__camContext=ctx;
      window.__drawCard=(variant)=>{
        ctx.fillStyle='#273345';ctx.fillRect(0,0,480,650);
        ctx.fillStyle=variant==='first'?'#d94457':'#276db2';
        ctx.fillRect(60,44,360,550);
        ctx.fillStyle=variant==='first'?'#e9b755':'#b4e669';
        for(let i=0;i<8;i++)ctx.fillRect(76+i*40,70+(i%2)*30,26,390);
        ctx.fillStyle='#101321';ctx.fillRect(86,475,308,80);
        ctx.fillStyle='#fff';ctx.font='bold 35px sans-serif';
        ctx.fillText(variant==='first'?'Seedot':'Pikachu',90,528);
      };
      window.__drawCard('first');
      return canvas.captureStream(20);
    };
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{
      getUserMedia:async ()=>window.__syntheticCamera()
    }});
   })();
  """)
  response=page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='domcontentloaded')
  assert response and response.status==200
  page.evaluate("CardsteadNav.show('scan')")
  page.locator('#liveMode').select_option('stack')
  page.locator('#liveTarget').fill('2')
  page.locator('#liveStart').click()
  page.locator('#liveCamera:not([hidden])').wait_for(timeout=12000)
  # Avoid worker initialization on test-generated artwork; focus on automatic capture mechanics.
  page.locator('#autoOCR').uncheck(force=True)
  page.wait_for_function("document.querySelector('#liveCount').textContent.startsWith('1 ')",timeout=15000)
  assert page.locator('#liveBadge').inner_text().endswith('Live')
  assert page.locator('#currentPhoto').get_attribute('src').startswith('blob:')
  page.wait_for_timeout(2200)
  assert page.locator('#liveCount').inner_text().startswith('1 '),'Repeated capture of stationary card'
  page.evaluate("window.__drawCard('second')")
  page.wait_for_function("document.querySelector('#liveCount').textContent.startsWith('2 ')",timeout=15000)
  assert page.locator('#currentPhoto').get_attribute('src').startswith('blob:'),'Active review disappeared'
  assert page.locator('#liveBadge').inner_text()=='Camera off', 'Target count should stop camera automatically'
  assert not errors,errors
  print('PASS Stack Mode: two cards placed on top, no shutter taps or same-card repeats, automatic target stop')
  page.locator('#liveMode').select_option('single')
  page.locator('#liveTarget').fill('0')
  page.locator('#liveStart').click()
  page.locator('#liveCamera:not([hidden])').wait_for(timeout=12000)
  before=page.locator('#liveCount').inner_text()
  page.wait_for_timeout(2100)
  assert page.locator('#liveCount').inner_text()==before, 'Single mode must not automatically capture'
  page.locator('#liveManual').click()
  page.wait_for_function("document.querySelector('#liveCount').textContent.startsWith('1 ')",timeout=10000)
  page.locator('#liveStop').click()
  assert not errors,errors
  print('PASS Single Card: manual capture only, continuous video stays open between cards')
  ctx.close();browser.close()
finally:
 server.shutdown()
