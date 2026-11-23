"""Mobile first card-scanning workflow regression using the real app shell."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from base64 import b64decode
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(("127.0.0.1",0),partial(SimpleHTTPRequestHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=["--no-sandbox","--disable-dev-shm-usage"])
  for width in (390,360):
   context=browser.new_context(viewport={"width":width,"height":844},service_workers="block")
   page=context.new_page()
   errors=[]
   page.on("pageerror",lambda e:errors.append(str(e)))
   page.goto(f"http://127.0.0.1:{server.server_port}/",wait_until="domcontentloaded")
   assert page.locator(".mobile-dock").is_visible()
   assert not page.locator(".tabs").is_visible()
   assert page.locator('.dock-item').count()==5
   page.locator('.dock-item[data-dock="settings"]').click()
   assert page.locator("section#settings").is_visible()
   page.locator('#subnav [data-page="ebay"]').click()
   assert page.locator("section#ebay").is_visible()
   page.locator('.dock-item[data-dock="inventory"]').click(); page.locator('#subnav [data-page="scan"]').click()
   assert page.locator("section#scan").is_visible()
   assert page.locator(".scan-launch").is_visible()
   assert page.locator(".scan-capture-cta").is_visible()
   assert page.locator(".scan-card-optional").count()==1
   assert not page.locator(".scan-card-optional").evaluate("(e)=>e.open")
   page.evaluate("document.querySelector('#autoOCR').checked=false")
   png=b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZtacAAAAASUVORK5CYII=")
   page.locator("#mobileCameraInput").set_input_files({"name":"card.png","mimeType":"image/png","buffer":png})
   page.locator("#mobilePhotoPreview:not([hidden])").wait_for(timeout=10000)
   assert page.locator("#currentPhoto").is_visible()
   assert "1 of 1" in page.locator("#mobileScanStatus").inner_text()
   page.locator(".scan-card-optional summary").click()
   assert page.locator("#cardPrice").is_visible()
   page.locator('.dock-item[data-dock="inventory"]').click()
   assert page.locator("section#inventory").is_visible()
   page.locator('.dock-item[data-dock="inventory"]').click(); page.locator('#subnav [data-page="scan"]').click()
   assert page.locator("#mobilePhotoPreview").is_visible()
   assert not errors,errors
   print(f"PASS mobile scanner {width}px: bottom dock, five-tab dock, camera queue, preview, disclosure, navigation")
   context.close()
  # Preserve desktop sidebar and all navigation tabs.
  ctx=browser.new_context(viewport={"width":1440,"height":900},service_workers="block")
  page=ctx.new_page()
  page.goto(f"http://127.0.0.1:{server.server_port}/",wait_until="domcontentloaded")
  assert not page.locator(".mobile-dock").is_visible()
  assert page.locator(".tabs").is_visible()
  assert page.locator(".tab").count()==5
  print("PASS desktop: original sidebar still available")
  ctx.close()
  browser.close()
finally:
 server.shutdown()
