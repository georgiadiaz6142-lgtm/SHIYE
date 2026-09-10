"""Restart only the known local development service; never print configuration values."""
import hashlib,json,os,pathlib,signal,subprocess,time,urllib.request
root=pathlib.Path(__file__).resolve().parents[2]
runtime=root/'.local/baidu-live-trial-20260908'
lock=runtime/'process.lock'
pid=int(lock.read_text().strip())
expected='/Users/song/.local/bin/node --env-file=.env.local dist/server/index.js'
command=subprocess.check_output(['ps','-p',str(pid),'-o','command='],text=True).strip()
if command!=expected:raise SystemExit('Process identity did not match; no process was stopped.')
state=json.loads((runtime/'state.json').read_text())
jobs=state.get('jobs',[])
if isinstance(jobs,dict):jobs=jobs.values()
if any(j.get('status') in ['queued','running'] for j in jobs):raise SystemExit('A photo job is active; no process was stopped.')
copy_file=runtime/'ai-copy-state.json'
if copy_file.exists() and any(o.get('status')=='pending' for o in json.loads(copy_file.read_text()).get('operations',[])):raise SystemExit('A copy job is active; no process was stopped.')
files=[runtime/'admin.json',runtime/'invites.json',root/'.env.local']
before=[hashlib.sha256(f.read_bytes()).digest() for f in files]
os.kill(pid,signal.SIGTERM)
for _ in range(50):
 if not lock.exists():break
 time.sleep(.1)
if lock.exists():raise SystemExit('Service is still stopping; no replacement was started.')
with open(root/'.local/admin-service.log','ab') as log:
 process=subprocess.Popen(['/Users/song/.local/bin/node','--env-file=.env.local','dist/server/index.js'],cwd=root,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
for _ in range(50):
 try:
  with urllib.request.urlopen('http://127.0.0.1:4176/api/health',timeout=1) as response:health=json.load(response)
  break
 except Exception:time.sleep(.1)
else:raise SystemExit('Replacement did not become ready; inspect the private service log.')
unchanged=[hashlib.sha256(f.read_bytes()).digest()==h for f,h in zip(files,before)]
result={'pid':process.pid,'priorPid':pid,'adminUnchanged':unchanged[0],'invitationsUnchanged':unchanged[1],'environmentUnchanged':unchanged[2],'serviceReady':True,'liveModePreserved':health.get('mode')=='live','callLimitSettingPreserved':health.get('limitsDisabled') is True}
(root/'verification/prompt-font-size-20260910/restart-results.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
if not all(unchanged):raise SystemExit('Configuration changed; investigation required.')
