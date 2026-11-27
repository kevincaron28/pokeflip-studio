"""Temporary emulator check of the eight Play-testing fixes in Cardstead 4.7.0 (CI only, not for main).

Drives the debug APK with real taps and the real Android keyboard (adb), reads the page through the WebView's
DevTools socket, and writes screenshots plus results.json to ./emu-results.
"""
import json, os, re, subprocess, sys, time, traceback, urllib.request
import xml.etree.ElementTree as ET
import websocket

PKG = 'top.kcaron.cardstudio'
ACT = PKG + '/.MainActivity'
OUT = 'emu-results'
os.makedirs(OUT, exist_ok=True)
results, info, js_errors = [], {}, []


def adb(*args, check=False, binary=False):
    p = subprocess.run(['adb', *args], capture_output=True, timeout=90)
    if check and p.returncode:
        raise RuntimeError(f'adb {args}: {p.stderr.decode(errors="replace")[:300]}')
    return p.stdout if binary else p.stdout.decode(errors='replace')


def sh(cmd):
    return adb('shell', cmd)


def top():
    out = sh('dumpsys activity activities')
    for pat in (r'topResumedActivity[=:]\s*ActivityRecord\{\S+ \S+ (\S+)', r'mResumedActivity[=:]\s*ActivityRecord\{\S+ \S+ (\S+)',
                r'ResumedActivity[=:]\s*ActivityRecord\{\S+ \S+ (\S+)'):
        m = re.search(pat, out)
        if m:
            return m.group(1)
    return ''


def ours(t=None):
    return (t if t is not None else top()).startswith(PKG + '/')


def ime():
    return 'mInputShown=true' in sh('dumpsys input_method')


def wait(fn, seconds=15, every=0.5):
    end = time.time() + seconds
    while True:
        try:
            v = fn()
        except Exception:
            v = None
        if v or time.time() > end:
            return v
        time.sleep(every)


def shot(name):
    png = adb('exec-out', 'screencap', '-p', binary=True)
    with open(f'{OUT}/{name}.png', 'wb') as f:
        f.write(png)


def ui_nodes():
    sh('rm -f /sdcard/ui.xml')
    sh('uiautomator dump /sdcard/ui.xml')
    xml = sh('cat /sdcard/ui.xml')
    try:
        return list(ET.fromstring(xml).iter('node'))
    except ET.ParseError:
        return []


def center(node):
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds')))
    return (x1 + x2) // 2, (y1 + y2) // 2


def tap_text(pattern):
    for n in ui_nodes():
        if re.search(pattern, n.get('text', ''), re.I):
            x, y = center(n)
            sh(f'input tap {x} {y}')
            return True
    return False


def dismiss_anr():
    for n in ui_nodes():
        if 'responding' in n.get('text', ''):
            tap_text(r'^wait$')
            info.setdefault('system_dialogs', []).append(n.get('text'))
            time.sleep(2)
            return


class Page:
    def __init__(self):
        self.ws, self.n, self.offset = None, 0, (0, 0)

    def connect(self):
        self.close()
        def find():
            pid = sh(f'pidof {PKG}').strip().split()
            if not pid:
                return None
            name = f'webview_devtools_remote_{pid[0]}'
            if name not in sh('cat /proc/net/unix'):
                return None
            adb('forward', 'tcp:9222', f'localabstract:{name}', check=True)
            pages = json.load(urllib.request.urlopen('http://127.0.0.1:9222/json', timeout=10))
            pages = [p for p in pages if p.get('type') == 'page' and p.get('webSocketDebuggerUrl')]
            return pages[0] if pages else None
        page = wait(find, 90, 2)
        if not page:
            raise RuntimeError('no WebView to inspect')
        self.ws = websocket.create_connection(page['webSocketDebuggerUrl'], suppress_origin=True, timeout=60)
        self.send('Runtime.enable')
        self.send('Page.enable')
        wait(lambda: self.js("document.readyState==='complete' && !!window.CardsteadHelp && !!window.CardsteadActions"), 60, 1)
        dismiss_anr()
        for n in ui_nodes():
            if n.get('class') == 'android.webkit.WebView':
                x1, y1, x2, y2 = map(int, re.findall(r'\d+', n.get('bounds')))
                self.offset = (x1, y1)
                info['webview_bounds'] = n.get('bounds')
                break

    def close(self):
        if self.ws:
            try:
                self.ws.close()
            except Exception:
                pass
        self.ws = None

    def send(self, method, params=None):
        self.n += 1
        me = self.n
        self.ws.send(json.dumps({'id': me, 'method': method, 'params': params or {}}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get('method') == 'Runtime.exceptionThrown':
                d = m['params']['exceptionDetails']
                js_errors.append((d.get('exception', {}).get('description') or d.get('text', ''))[:400])
            if m.get('method') == 'Runtime.consoleAPICalled' and m['params'].get('type') == 'error':
                js_errors.append('console.error: ' + ' '.join(str(a.get('value', a.get('description', ''))) for a in m['params']['args'])[:400])
            if m.get('method') == 'Page.javascriptDialogOpening':
                info.setdefault('js_dialogs', []).append(m['params'].get('type', '') + ': ' + m['params'].get('message', '')[:80])
                shot('js-dialog')
                self.n += 1
                self.ws.send(json.dumps({'id': self.n, 'method': 'Page.handleJavaScriptDialog', 'params': {'accept': False}}))
            if m.get('id') == me:
                return m

    def js(self, expr):
        r = self.send('Runtime.evaluate', {'expression': expr, 'awaitPromise': True, 'returnByValue': True})['result']
        if 'exceptionDetails' in r:
            raise RuntimeError('page script: ' + json.dumps(r['exceptionDetails'])[:500])
        return r['result'].get('value')

    def box(self, selector):
        return self.js(f"""(()=>{{const e=document.querySelector({json.dumps(selector)});if(!e)return null;
          const r=e.getBoundingClientRect(),v=visualViewport;
          return {{top:r.top,bottom:r.bottom,x:r.left+r.width/2-v.offsetLeft,y:r.top+r.height/2-v.offsetTop,w:r.width,h:r.height,
            vvTop:v.offsetTop,vvH:v.height,innerH:innerHeight,dpr:devicePixelRatio,scale:v.scale}}}})()""")

    def tap(self, selector, scroll=True):
        if not wait(lambda: self.js(f"!!document.querySelector({json.dumps(selector)})"), 15):
            raise RuntimeError('missing ' + selector)
        if scroll:
            self.js(f"""(()=>{{const e=document.querySelector({json.dumps(selector)});
              for(let d=e.parentElement;d;d=d.parentElement)if(d.tagName==='DETAILS'&&!e.closest('summary'))d.open=true;
              e.scrollIntoView({{block:'center',behavior:'instant'}})}})()""")
            time.sleep(1.0)
        b = self.box(selector)
        if not b or b['w'] == 0:
            raise RuntimeError('not visible: ' + selector)
        k = b['dpr'] * b['scale']
        x, y = int(self.offset[0] + b['x'] * k), int(self.offset[1] + b['y'] * k)
        sh(f'input tap {x} {y}')
        time.sleep(0.8)

    def is_open(self, ident):
        return self.js(f"!!document.getElementById({json.dumps(ident)})?.open")

    def go(self, h):
        self.js(f"document.querySelectorAll('dialog[open]').forEach(d=>d.close()); location.hash={json.dumps(h)}")
        time.sleep(1.5)


page = Page()


def launch(fresh=True):
    if fresh:
        sh(f'am force-stop {PKG}')
        time.sleep(1)
    sh(f'am start -W -n {ACT}')
    wait(ours, 60, 1)
    time.sleep(3)
    page.connect()
    time.sleep(1.5)


def back():
    sh('input keyevent KEYCODE_BACK')
    time.sleep(1.2)


def return_to_app():
    for _ in range(4):
        if ours():
            break
        sh('input keyevent KEYCODE_BACK')
        time.sleep(1.5)
    if not ours():
        sh(f'am start -W -n {ACT}')
        time.sleep(2)
    if not ours():
        raise RuntimeError('could not return to the app, on top: ' + top())


def check(name):
    def wrap(fn):
        entry = {'check': name, 'ok': False, 'detail': {}}
        print('== ' + name, flush=True)
        try:
            ok = fn(entry['detail'])
            entry['ok'] = bool(ok)
        except Exception as e:
            entry['detail']['error'] = str(e)[:500]
            traceback.print_exc()
            try:
                shot('error-' + re.sub(r'\W+', '-', name)[:50])
            except Exception:
                pass
        results.append(entry)
        print(json.dumps(entry), flush=True)
        save()
        return fn
    return wrap


def save():
    json.dump({'info': info, 'results': results, 'js_errors': js_errors}, open(f'{OUT}/results.json', 'w'), indent=1, ensure_ascii=False)


# ---------------------------------------------------------------------------
adb('logcat', '-c')
launch()


@check('0 version in the installed app')
def _(d):
    out = sh(f'dumpsys package {PKG}')
    d['versionName'] = re.search(r'versionName=(\S+)', out).group(1)
    d['versionCode'] = re.search(r'versionCode=(\d+)', out).group(1)
    d['footer'] = page.js("document.querySelector('.footer')?.firstChild?.textContent||''")
    d['native'] = page.js('window.PokeFlipNative?.isNative===true')
    d['android'] = sh('getprop ro.build.version.release').strip()
    info['android'] = d['android']
    return d['versionName'] == '4.7.0' and d['versionCode'] == '40700' and 'Cardstead 4.7' in d['footer'] and d['native']


@check('6 walkthrough opens once on first run, four steps')
def _(d):
    if not wait(lambda: page.is_open('tourDialog'), 15):
        return False
    titles = []
    for i in range(1, 5):
        titles.append(page.js("document.querySelector('#tourDialog h2').textContent"))
        shot(f'en-01-walkthrough-{i}')
        page.tap('#tourDialog [data-tour-next]', scroll=False)
    d['titles'] = titles
    d['closedAfterStart'] = not page.is_open('tourDialog')
    d['noReviewAtLaunch'] = page.js('!localStorage.getItem("cardstead-review-asked-v1")')
    shot('en-02-first-page')
    launch()
    d['reopenedOnSecondRun'] = page.is_open('tourDialog')
    return d['closedAfterStart'] and not d['reopenedOnSecondRun'] and len(set(titles)) == 4


def back_trial(n):
    d = {}
    launch()
    time.sleep(3)
    adb('logcat', '-c')
    d['pidBefore'] = sh(f'pidof {PKG}').strip()
    d['topBefore'] = top()
    back()
    d['afterOne'] = top()
    d['pidAfterOne'] = sh(f'pidof {PKG}').strip()
    first = ours(d['afterOne'])
    if first:
        d['toast'] = page.js("(()=>{const t=document.getElementById('toast');return t&&getComputedStyle(t).display!=='none'?t.textContent:''})()")
        if n == 1:
            shot('en-03-back-once')
        time.sleep(4)
        sh('input keyevent KEYCODE_BACK')
        time.sleep(0.8)
        d['afterLateSecond'] = top()
        sh('input keyevent KEYCODE_BACK')
        time.sleep(2)
        d['afterQuickSecond'] = top()
        if n == 1:
            shot('en-04-back-twice-left-app')
    else:
        shot(f'back-trial-{n}-left-at-once')
    log = adb('logcat', '-d')
    open(f'{OUT}/logcat-back-{n}.txt', 'w').write(chr(10).join(l for l in log.splitlines() if re.search(
        r'kcaron|Capacitor|ActivityManager|ActivityTaskManager|WindowManager|libc |DEBUG|Fatal|FATAL|has died|Killing|webview|BackAnimation|OnBackInvoked|InputDispatcher', l))[-150000:])
    d['ok'] = bool(first and ours(d.get('afterLateSecond', '')) and not ours(d.get('afterQuickSecond', '')) and 'again' in (d.get('toast') or ''))
    return d


for trial in (1, 2, 3, 4):
    @check(f'7 Back on the first page asks to press again, then exits (try {trial})')
    def _(d, trial=trial):
        d.update(back_trial(trial))
        return d['ok']


@check('7 Back from another page returns to the first page')
def _(d):
    launch()
    page.tap('.mobile-dock [data-dock="settings"]', scroll=False)
    time.sleep(1)
    d['before'] = page.js("document.querySelector('main section:not(.hidden)')?.id")
    back()
    d['after'] = page.js("document.querySelector('main section:not(.hidden)')?.id")
    return ours() and d['before'] == 'settings' and d['after'] == 'prices'


def keyboard_case(selector, hashv, name, d):
    page.go(hashv)
    time.sleep(1)
    if ime():
        back()
    before = page.js('visualViewport.height')
    page.tap(selector)
    d['keyboardShown'] = bool(wait(ime, 12))
    time.sleep(2)
    b = page.box(selector)
    d.update({'viewportBefore': round(before), 'viewportWithKeyboard': round(b['vvH']), 'fieldTop': round(b['top'] - b['vvTop']),
              'fieldBottom': round(b['bottom'] - b['vvTop'])})
    d['barsHidden'] = page.js("[...document.querySelectorAll('.mobile-dock,.add-card-fab')].every(e=>getComputedStyle(e).display==='none'||getComputedStyle(e).visibility==='hidden')")
    sh('input text abc' if 'Ceiling' not in selector else 'input text 75')
    time.sleep(1)
    shot(name)
    visible = b['top'] - b['vvTop'] >= -1 and b['bottom'] - b['vvTop'] <= b['vvH'] + 1
    resized = before - b['vvH'] > 150
    d['fieldAboveKeyboard'], d['pageResized'] = visible, resized
    back()
    d['backClosedKeyboardOnly'] = not ime() and ours()
    time.sleep(1)
    d['barsBackAfter'] = page.js("!document.body.classList.contains('kb-open')")
    return d['keyboardShown'] and visible and resized and d['barsHidden'] and d['backClosedKeyboardOnly']


launch()


@check('1 keyboard: price search')
def _(d):
    return keyboard_case('#pricesSearch', '#/', 'en-05-keyboard-search', d)


@check('1 keyboard: sign-in email in Settings')
def _(d):
    return keyboard_case('#cloudEmail', '#/settings', 'en-06-keyboard-sign-in', d)


@check('1 keyboard: product watch maximum price (alert form)')
def _(d):
    return keyboard_case('#restockCeiling', '#/drops', 'en-07-keyboard-alert-form', d)


@check('2 privacy policy opens inside the app, also offline')
def _(d):
    page.go('#/settings')
    sh('svc wifi disable')
    sh('svc data disable')
    try:
        time.sleep(2)
        page.tap('#aboutPanel a[data-privacy=""], a.btn[data-privacy=""]')
        d['dialog'] = bool(wait(lambda: page.is_open('privacyDialog'), 8))
        wait(lambda: page.js("document.querySelectorAll('#privacyDialog .doc-body h2').length"), 8)
        d['sections'] = page.js("document.querySelectorAll('#privacyDialog .doc-body h2').length")
        d['stayedInApp'] = ours()
        shot('en-08-privacy-offline')
        page.tap('#privacyDialog summary', scroll=False)
        shot('en-09-privacy-sections')
        back()
        d['backClosedIt'] = not page.is_open('privacyDialog') and ours()
    finally:
        sh('svc wifi enable')
        sh('svc data enable')
        time.sleep(4)
    return d['dialog'] and d['sections'] > 2 and d['stayedInApp'] and d['backClosedIt']


@check('5 Help and FAQ page')
def _(d):
    page.go('#/settings')
    page.tap('[data-page-link="help"]')
    time.sleep(1)
    d['visible'] = page.js("!document.getElementById('help').classList.contains('hidden')")
    d['topics'] = page.js("document.querySelectorAll('#help details.faq').length")
    page.js('scrollTo(0,0)')
    time.sleep(0.5)
    shot('en-10-help')
    page.tap('#help details.faq summary')
    shot('en-11-help-open')
    return d['visible'] and d['topics'] == 7


@check('6 walkthrough can be replayed from Settings')
def _(d):
    page.go('#/settings')
    page.tap('#aboutPanel [data-tour]')
    d['open'] = page.is_open('tourDialog')
    page.js("document.getElementById('aboutPanel').scrollIntoView()")
    back()
    d['backClosedIt'] = not page.is_open('tourDialog') and ours()
    shot('en-12-settings-help-and-about')
    return d['open'] and d['backClosedIt']


@check('4 share opens the Android share sheet')
def _(d):
    page.go('#/settings')
    page.tap('[data-share-app]')
    d['onTop'] = wait(lambda: (lambda t: t if t and not ours(t) else None)(top()), 10) or top()
    time.sleep(2)
    shot('en-13-share-sheet')
    ok = bool(re.search(r'chooser|intentresolver|resolver', d['onTop'], re.I))
    return_to_app()
    d['returned'] = ours()
    return ok


@check('8 report a problem: form, keyboard, opens a mail draft')
def _(d):
    page.go('#/settings')
    page.tap('#aboutPanel [data-report]')
    d['open'] = bool(wait(lambda: page.is_open('reportDialog'), 8))
    d['details'] = page.js("document.querySelector('.report-details').textContent.split('\\n')[0]")
    shot('en-14-report-form')
    page.tap('#reportText')
    d['keyboardShown'] = bool(wait(ime, 10))
    time.sleep(2)
    b = page.box('#reportText')
    d['textAboveKeyboard'] = b['top'] - b['vvTop'] >= -1 and b['top'] - b['vvTop'] < b['vvH'] - 40
    sh("input text 'Emulator%scheck'")
    time.sleep(1)
    shot('en-15-report-keyboard')
    back()
    d['typed'] = page.js("document.getElementById('reportText').value")
    page.tap('#reportCopy')
    time.sleep(1.5)
    d['copyStatus'] = page.js("document.getElementById('reportStatus').textContent.slice(0,40)")
    d['copyBox'] = page.js("(()=>{const b=document.getElementById('reportCopyText');return b?{chars:b.value.length,selected:b.selectionEnd-b.selectionStart,typed:b.value.includes('Emulator check')}:null})()")
    d['webview'] = page.js("(navigator.userAgent.match(/Chrome\/[0-9.]+/)||[''])[0]")
    shot('en-16-report-copied')
    page.tap('#reportForm button[type="submit"]')
    d['onTop'] = wait(lambda: (lambda t: t if t and not ours(t) else None)(top()), 10) or top()
    time.sleep(3)
    shot('en-17-report-mail-app')
    opened = not ours(d['onTop'])
    return_to_app()
    copied = d['copyStatus'].startswith('Copied') or bool(d['copyBox'] and d['copyBox']['typed'])
    return d['open'] and d['keyboardShown'] and d['textAboveKeyboard'] and '4.7.0 (40700)' in d['details'] and bool(d['typed']) and copied and opened and not info.get('js_dialogs')


@check('3 Rate button opens the Play Store page')
def _(d):
    page.go('#/settings')
    d['hidden'] = page.js("document.querySelector('[data-rate]').hidden")
    page.tap('[data-rate]')
    d['onTop'] = wait(lambda: (lambda t: t if 'com.android.vending' in t else None)(top()), 15) or top()
    time.sleep(5)
    shot('en-18-rate-play-store')
    ok = 'com.android.vending' in d['onTop']
    return_to_app()
    return ok and not d['hidden']


@check('3 in-app rating is requested after a first saved alert, not before')
def _(d):
    launch()
    page.js("localStorage.removeItem('cardstead-review-asked-v1')")
    page.js("""(()=>{window.__rev={calls:0,results:[]};const f=PokeFlipNative.requestReview;
      PokeFlipNative.requestReview=async()=>{__rev.calls++;const r=await f();__rev.results.push(r);return r}})()""")
    time.sleep(4)
    d['callsBeforeSaving'] = page.js('__rev.calls')
    page.go('#/drops')
    page.js("""(()=>{document.getElementById('restockProduct').value='Emulator check Elite Trainer Box';
      document.getElementById('restockCeiling').value='75'})()""")
    page.tap('#restockWatchForm button[type="submit"]')
    d['saved'] = page.js("document.getElementById('restockWatches').textContent.includes('Emulator check')")
    wait(lambda: page.js('__rev.results.length'), 25, 1)
    time.sleep(2)
    d['callsAfterSaving'] = page.js('__rev.calls')
    d['googleAccepted'] = page.js('__rev.results')
    d['rememberedAsAsked'] = page.js("localStorage.getItem('cardstead-review-asked-v1')")
    d['onTop'] = top()
    shot('en-19-after-first-alert')
    d['plugin'] = page.js("Capacitor.Plugins.AppReview.request().then(()=>'resolved',e=>String(e.message||e))")
    log = adb('logcat', '-d')
    d['playCoreLog'] = [l[-220:] for l in log.splitlines() if re.search(r'PlayCore|ReviewService|requestInAppReview', l)][:12]
    return_to_app()
    return d['callsBeforeSaving'] == 0 and d['saved'] and d['callsAfterSaving'] == 1 and 'not implemented' not in d['plugin']


@check('French: walkthrough, Help, privacy and report')
def _(d):
    launch()
    page.go('#/settings')
    page.js("(()=>{const s=document.getElementById('uiLanguage');s.value='fr';s.dispatchEvent(new Event('change',{bubbles:true}))})()")
    time.sleep(2)
    page.js("document.getElementById('aboutPanel').scrollIntoView()")
    time.sleep(1)
    shot('fr-01-settings-help-and-about')
    page.tap('#aboutPanel [data-tour]')
    d['tour'] = page.js("document.querySelector('#tourDialog h2')?.textContent")
    shot('fr-02-walkthrough')
    page.go('#/help')
    d['help'] = page.js("document.querySelector('#help h1')?.textContent")
    shot('fr-03-help')
    page.go('#/settings')
    page.tap('#aboutPanel a[data-privacy=""], a.btn[data-privacy=""]')
    wait(lambda: page.js("document.querySelectorAll('#privacyDialog .doc-body h2').length"), 8)
    d['privacy'] = page.js("document.querySelector('#privacyDialog .doc-bar strong')?.textContent")
    shot('fr-04-privacy')
    page.go('#/settings')
    page.tap('#aboutPanel [data-report]')
    wait(lambda: page.is_open('reportDialog'), 8)
    d['report'] = page.js("document.querySelector('#reportDialog h2')?.textContent")
    shot('fr-05-report')
    back()
    page.go('#/')
    back()
    d['back'] = page.js("document.getElementById('toast')?.textContent")
    shot('fr-06-back-once')
    return d['help'] == 'Aide et FAQ' and d['report'] == 'Signaler un problème' and 'confidentialité' in (d['privacy'] or '') and 'quitter' in (d['back'] or '').lower()


log = adb('logcat', '-d')
open(f'{OUT}/logcat-app.txt', 'w').write('\n'.join(l for l in log.splitlines() if re.search(r'Capacitor|AndroidRuntime|FATAL|PlayCore|chromium', l))[-120000:])
info['fatal'] = [l[-300:] for l in log.splitlines() if 'FATAL EXCEPTION' in l or (PKG in l and 'ANR in' in l)]
save()
failed = [r['check'] for r in results if not r['ok']]
print(f'{len(results) - len(failed)}/{len(results)} checks passed; failed: {failed}; page errors: {len(js_errors)}')
sys.exit(1 if failed else 0)
