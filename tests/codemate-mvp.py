"""Run only with CODEMATE_LOCAL_PREVIEW=1, port 5181. Never contacts hosted services."""
import base64, concurrent.futures, datetime, hashlib, json, pathlib, sqlite3, sys, time, urllib.error, urllib.request, uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:5181'
import os
state_dir='deploy-now-smoke-state' if os.environ.get('CRITOUR_TEST_STANDALONE')=='1' else 'codemate-local-state'
STATE=ROOT/'.sites-runtime'/state_dir/'v3/d1/miniflare-D1DatabaseObject'
try:urllib.request.urlopen(BASE+'/api/codemate',timeout=10)
except urllib.error.HTTPError as e:assert e.code==401,'Expected the isolated CodeMate preview.'
if not any(p.name!='metadata.sqlite' for p in STATE.glob('*.sqlite')):
 try:urllib.request.urlopen(BASE+'/api/calendar',timeout=10)
 except urllib.error.HTTPError:pass  # On an empty fixture DB this creates the local SQLite file.
assert STATE.is_dir(),'Start the isolated CodeMate local preview.'
DB=next(p for p in STATE.glob('*.sqlite') if p.name!='metadata.sqlite')
conn=sqlite3.connect(DB,timeout=20)
h=lambda s:hashlib.sha256(s.encode()).hexdigest()
at=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
exists=lambda t:conn.execute('SELECT 1 FROM sqlite_master WHERE type=\'table\' AND name=?',(t,)).fetchone()
if not exists('studio_projects'):
 for p in sorted((ROOT/'drizzle').glob('*.sql')):conn.executescript(p.read_text())
if not exists('cm_builds'):conn.executescript((ROOT/'plans/codemate-mvp.sql').read_text())
if 'commit_url' not in [r[1] for r in conn.execute('PRAGMA table_info(cm_builds)')]:conn.execute('ALTER TABLE cm_builds ADD COLUMN commit_url TEXT')
if not exists('cm_showcase'):conn.executescript((ROOT/'plans/show-and-grow.sql').read_text())
conn.executescript((ROOT/'plans/our-canvas.sql').read_text())
conn.executescript((ROOT/'plans/virtual-playground.sql').read_text())
conn.executescript((ROOT/'plans/critour-showcase.sql').read_text())
conn.executescript((ROOT/'plans/critour-gallery.sql').read_text())
conn.execute('PRAGMA foreign_keys=ON')
CODE='codemate-disposable-local-qa-login-20261105'
manager='cm_local_manager'
def account(id,name):
 stamp=at()
 conn.execute('INSERT OR IGNORE INTO members(id,name,role,visible,created_at,updated_at)VALUES(?,?,?,0,?,?)',(id,name,'LOCAL QA',stamp,stamp))
 conn.execute('INSERT OR IGNORE INTO member_accounts(id,public_member_id,auth_user_id,display_name,pin_hash,activated_at,created_at,login_code_hash)VALUES(?,?,?,?,?,?,?,?)',(id,id,id,name,'!qa',stamp,stamp,h(CODE)))
 token=uuid.uuid4().hex+uuid.uuid4().hex
 now=int(time.time()*1000)
 conn.execute("INSERT INTO workspace_sessions(token_hash,auth_user_id,purpose,version,verified_at,expires_at)VALUES(?,?,'admin',1,?,?)",(h(token),id,now,now+3600000))
 return Client('__Host-motto-workspace='+token)
class Client:
 def __init__(self,cookie=''):self.cookie=cookie
 def request(self,path,b=None,method=None,origin=BASE,raw=None,content='application/json'):
  headers={'Cookie':self.cookie,'Origin':origin,'Content-Type':content}
  data=raw if raw is not None else json.dumps(b).encode() if b is not None else None
  try:r=urllib.request.urlopen(urllib.request.Request(BASE+path,data=data,method=method,headers=headers),timeout=20)
  except urllib.error.HTTPError as e:r=e
  raw=r.read()
  try:body=json.loads(raw)
  except Exception:body=raw
  return r.status,body,r.headers
 def post(self,action,projectId='',**kwargs):return self.request('/api/codemate',dict(action=action,projectId=projectId,**kwargs))
 def read(self,p=''):return self.request('/api/codemate'+('?projectId='+p if p else ''))
 def image(self,p,name='qa.png',payload=None):
  # Transparent one-pixel file for testing storage policy only, never a product screenshot.
  if payload is None:payload=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+Xk0cAAAAASUVORK5CYII=')
  boundary='cmfixture'+uuid.uuid4().hex
  body=(f'--{boundary}\r\nContent-Disposition: form-data; name="projectId"\r\n\r\n{p}\r\n--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: image/png\r\n\r\n').encode()+payload+f'\r\n--{boundary}--\r\n'.encode()
  return self.request('/api/codemate/assets',method='POST',raw=body,content='multipart/form-data; boundary='+boundary)

a=account(manager,'Hana · ローカル検証')
conn.execute('INSERT OR IGNORE INTO studio_admins(id,account_id,auth_user_id,created_at)VALUES(1,?,?,?)',(manager,manager,at()))
conn.execute('INSERT OR IGNORE INTO cm_site_admins VALUES(?)',(manager,))
check_count=0
def check(ok,label):
 global check_count
 assert ok,label
 check_count+=1; print('PASS',label,flush=True)
def good(result,status=200):
 check(result[0]==status,str(result[:2]));return result[1]
key=lambda:uuid.uuid4().hex
run=uuid.uuid4().hex[:7]
tester_id='cm_local_yuki_'+run
outsider_id='cm_local_outsider_'+run
tester_name='Yuki · ローカル検証 '+run
b=account(tester_id,tester_name); outsider=account(outsider_id,'別プロジェクト · 検証');conn.commit()
anon=Client()
check(anon.read()[0]==401,'anonymous CodeMate denied')
check(a.request('/api/admin')[0]==200,'explicit CMS administrator can access CMS')
check(b.request('/api/admin')[0]==401,'existing account without CMS grant cannot read CMS')
check(b.request('/api/admin',{'entity':'settings','action':'save','data':{'team_name':'DO NOT WRITE'}})[0]==401,'CodeMate login cannot mutate CMS')
check(outsider.request('/api/workspace/chat')[0]==401,'non-CMS account cannot enter legacy global chat')
check(a.request('/')[0]==200,'public homepage still renders')
project=good(a.post('project.create',name='はじめてのログイン画面 · QA '+run,description='ローカル検証用。小さな改善を、友達と一緒に。',kind='web'))['id']
other=good(a.post('project.create',name='別プロジェクト QA '+run,kind='ios'))['id']
check(b.read(project)[0]==404,'nonmember project read denied')
check(b.post('feedback.create',project,buildId='guess',kind='love',body='bad',clientId=key())[0]==404,'nonmember write denied')
check(a.request('/api/codemate',{'action':'project.goal','projectId':project,'goal':'bad'},origin='https://outside.test')[0]==403,'cross-origin mutation denied')
i=good(a.post('invite.create',project,role='tester'))
check('token_hash' not in i,'invitation response has no stored hash')
token=i['url'].split('#invite=')[1]
check(conn.execute('SELECT token_hash FROM cm_invites WHERE id=?',(i['id'],)).fetchone()[0]==h(token),'only invite hash persisted')
good(b.post('invite.accept',token=token))
check(outsider.post('invite.accept',token=token)[0]==410,'invite cannot be reused')
check(b.read(project)[1]['project']['role']=='tester','tester role scoped to target project')
check(b.read(other)[0]==404,'tester cannot read another project')
check(b.request('/api/studio/projects/'+project)[0]==404,'tester cannot bypass with legacy Studio API')
check(b.request('/api/admin')[0]==401,'invitation never adds CMS rights')
check(b.post('project.goal',project,goal='bad')[0]==403,'tester cannot edit goals')
check(b.post('task.create',project,title='bad',clientId=key())[0]==403,'tester cannot create internal task')
good(a.post('project.goal',project,goal='友達とログイン画面を試す'))
mini=good(a.post('task.create',project,title='ログインボタンを動かす',description='クリックで画面を開く',assigneeIds=[manager],clientId=key()))['id']
check(a.read(project)[1]['nextTask']['id']==mini,'next task comes from assigned unfinished work')
check(b.read(project)[1]['tasks']==[],'tester receives no internal task payload')
check(a.image(project,'x.svg',b'<svg onload="alert(1)"></svg>')[0]==400,'active SVG not accepted as screenshot')
oversize=bytearray(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+Xk0cAAAAASUVORK5CYII='))
oversize[16:20]=(9000).to_bytes(4,'big')
check(a.image(project,payload=oversize)[0]==400,'image dimensions are capped before storage')
asset=good(a.image(project),201)['id']
check(b.request('/api/codemate/assets/'+asset)[0]==404,'unpublished screenshot private to uploader')
url='https://mdn.github.io/dom-examples/'
for bad in ['http://localhost:8080/','https://127.0.0.1/','javascript:alert(1)','https://a.pages.dev/?token=secret','https://a.pages.dev.evil.test/','https://user:a@a.pages.dev/']:
 check(a.post('build.create',project,title='Bad',versionLabel='bad',previewUrl=bad,clientId=key())[0]==400,'unsafe preview rejected: '+bad.split('?')[0])
check(a.post('build.create',other,title='Wrong image',versionLabel='bad',assetId=asset,clientId=key())[0]==400,'cannot attach another project screenshot')
check(a.post('build.create',project,title='bad',versionLabel='bad',previewUrl=url,commitUrl='https://notgithub.com/a/b/commit/abc1234',clientId=key())[0]==400,'invalid commit link rejected')
v1=good(a.post('build.create',project,title='ログイン画面',versionLabel='Iteration 01',summary='ログインボタンを試してみて！',previewUrl=url,taskId=mini,assetId=asset,clientId=key()))['id']
asset_result=b.request('/api/codemate/assets/'+asset)
check(asset_result[0]==200 and 'no-store' in asset_result[2]['Cache-Control'],'published screenshot private and noncacheable')
check(outsider.request('/api/codemate/assets/'+asset)[0]==404,'outsider cannot read image by ID')
check(anon.request('/api/codemate/assets/'+asset)[0]==401,'anonymous cannot read image')
check(b.post('build.create',project,title='bad',versionLabel='bad',previewUrl=url,clientId=key())[0]==403,'tester cannot publish')
check(a.post('feedback.create',other,buildId=v1,kind='idea',body='bad',clientId=key())[0]==404,'cross-project build reference denied')
fkey=key()
f=good(b.post('feedback.create',project,buildId=v1,kind='idea',body='ログインボタンが少し見つけにくいかも。',clientId=fkey))['id']
check(b.post('feedback.create',project,buildId=v1,kind='idea',body='ログインボタンが少し見つけにくいかも。',clientId=fkey)[1]['id']==f,'feedback retry returns original')
check(b.post('feedback.create',project,buildId=v1,kind='love',body='different',clientId=fkey)[0]==409,'cannot reuse feedback key for changed input')
good(a.post('feedback.reply',project,feedbackId=f,body='ありがとう！ボタンを大きくしてみるね。',clientId=key()))
check(b.post('feedback.task',project,feedbackId=f)[0]==403,'tester cannot turn feedback into internal task')
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 t1,t2=list(pool.map(lambda _:a.post('feedback.task',project,feedbackId=f),range(2)))
check(t1[0]==t2[0]==200 and t1[1]['taskId']==t2[1]['taskId'],'concurrent feedback conversion creates one task')
t=t1[1]['taskId']
check(conn.execute('SELECT count(*) FROM studio_tasks WHERE id=?',(t,)).fetchone()[0]==1,'exactly one task persisted')
check(a.post('retest.request',project,feedbackId=f,buildId=v1)[0]==400,'old version cannot be used as improvement')
v2asset=good(a.image(project),201)['id']
v2=good(a.post('build.create',project,title='ログイン画面',versionLabel='Iteration 02',summary='ボタンがもっと見つけやすくなったよ！',previewUrl=url,taskId=t,previousId=v1,assetId=v2asset,clientId=key()))['id']
good(a.post('retest.request',project,feedbackId=f,buildId=v2))
r=b.read(project)[1];retest=r['retests'][0]['id']
check(r['builds'][0]['previous_id']==v1 and r['builds'][0]['after_asset_id']==v2asset,'before and after keep both version records')
check(any(e['kind']=='retest.requested' for e in r['unseen']),'returning tester sees retest request')
check(a.post('retest.answer',project,retestId=retest,outcome='better')[0]==403,'only requested tester can answer')
good(b.post('retest.answer',project,retestId=retest,outcome='better',note='ボタンが見つけやすくなった！'))
check(b.post('retest.answer',project,retestId=retest,outcome='confused')[0]==409,'recorded result cannot be silently overwritten')
check(a.read(project)[1]['retests'][0]['outcome']=='better','creator sees completed feedback journey')
good(b.post('visit',project,seq=b.read(project)[1]['latestSeq']))
check(not b.read(project)[1]['unseen'],'confirmed activity is no longer unread')
check(b.post('visit',project,seq=a.read(other)[1]['latestSeq'])[0]==400,'cannot acknowledge foreign project activity')
check(b.request('/codemate/playground?project='+project)[0]==200,'authenticated Playground renders')
page=b.request('/codemate/playground?project='+project)
check('frame-src' in page[2].get('Content-Security-Policy','') and page[2].get('Cache-Control')=='no-store','preview route has scoped iframe policy and no-store')
check('frame-src' not in a.request('/')[2].get('Content-Security-Policy',''),'public site CSP not widened')
# A separate disposable tester verifies revocation without disrupting the visual fixture.
ri=good(a.post('invite.create',project,role='tester'))
good(outsider.post('invite.accept',token=ri['url'].split('#invite=')[1]))
check(outsider.read(project)[0]==200,'invited tester can read the shared project')
good(a.post('member.remove',project,accountId=outsider_id))
check(outsider.read(project)[0]==404 and outsider.request('/api/codemate/assets/'+asset)[0]==404,'removed tester loses project and image access immediately')
# Cross-team exhibition never grants access to the private project.
show='/api/codemate/showcase'
def showpost(client,action,**args):return client.request(show,dict(action=action,**args))
draft=dict(projectId=project,buildId=v2,title='QA Showcase '+run,description='Local test',category='app',stage='wip',seeking=True)
check(showpost(b,'draft',**draft)[0]==403,'tester cannot publish a draft')
good(showpost(a,'draft',**draft))
listing=good(a.request(show+'?project='+project))['listings'][0]
sid=listing['id']
detail=show+'?id='+sid
picture=show+'/'+sid+'/image'
check(outsider.request(detail)[0]==404 and outsider.request(picture)[0]==404,'draft and its image are private')
good(showpost(a,'visibility',id=sid,visible=True))
check(Client().request(detail)[0]==401,'showcase requires authentication')
card=good(outsider.request(detail))['listing']
check(set(card)=={'id','title','description','category','stage','seeking','kind','version','preview','media','image','updatedAt','tags','focusX','focusY'},'showcase returns only curated metadata')
check(outsider.read(project)[0]==404 and outsider.request(picture)[0]==200,'displaying an image does not grant project access')
# Standalone showcases do not require a simulator, build, or GitHub account.
standalone=dict(projectId=project,title='Standalone QA '+run,description='A standalone gallery',category='android',stage='ready',
                coverId=asset,screenshots=[v2asset,v2asset],demo='https://play.google.com/store/apps/details?id=org.example.app',
                video='https://www.youtube.com/watch?v=example',github='https://github.com/example/example')
check(showpost(a,'draft',**(standalone|{'demo':'https://127.0.0.1/'}))[0]==400,'showcase rejects private-address demo URL')
check(showpost(a,'draft',**(standalone|{'github':'https://github.com/example'}))[0]==400,'showcase requires repository-shaped GitHub URLs')
good(showpost(a,'draft',**standalone))
gallery=next(v for v in good(a.request(show+'?project='+project))['listings'] if v['title']==standalone['title'])
gallery_id=gallery['id']; gallery_image=show+'/'+gallery_id+'/image'
check(gallery['media']['screenshots']==[v2asset] and gallery['media']['cover']==asset,'showcase saves a cover and deduplicates screenshots')
check(outsider.request(gallery_image+'?asset='+v2asset)[0]==404,'draft gallery screenshot is private')
check(showpost(b,'draft',id=gallery_id,**standalone)[0]==403,'only the owner can edit the showcase')
good(showpost(a,'visibility',id=gallery_id,visible=True))
check(outsider.request(gallery_image+'?asset='+v2asset)[0]==200 and outsider.request(gallery_image+'?asset='+str(uuid.uuid4()))[0]==404,'gallery serves only its listed assets')
good(showpost(a,'draft',id=gallery_id,**(standalone|{'title':'Edited gallery '+run,'screenshots':[],'coverId':None})))
gallery=good(outsider.request(show+'?id='+gallery_id))['listing']
check(gallery['title'].startswith('Edited gallery') and gallery['media']['cover'] is None and outsider.request(gallery_image+'?asset='+v2asset)[0]==404,'edit preserves listing identity and removes gallery access')

check(any(x['id']==sid for x in good(outsider.request(show+'?mode=seeking&q='+run))['listings']),'seeking filter finds new showcase')
check(showpost(outsider,'comment',id=sid,kind='idea',body='https://bad.example')[0]==400,'external links rejected in feedback')
good(showpost(outsider,'comment',id=sid,kind='idea',body='ボタンを見つけやすくできそう。'))
cid=good(a.request(detail))['comments'][0]['id']
good(showpost(a,'comment',id=sid,commentId=cid,kind='love',body='感想ありがとう！'))
good(showpost(b,'report',id=sid,commentId=cid,reason='ローカル検証'))
check(len(good(a.request(show+'?reports=1'))['reports'])>=1,'manager receives reports')
check(showpost(outsider,'hide',id=sid,commentId=cid)[0] in (403,404),'outsider cannot hide feedback')
good(showpost(a,'hide',id=sid,commentId=cid))
check(not good(b.request(detail))['comments'],'hidden thread and replies disappear')
good(showpost(outsider,'block',id=sid))
check(outsider.request(detail)[0]==404 and outsider.request(picture)[0]==404,'block applies to detail and media')
good(showpost(a,'visibility',id=sid,visible=False))
check(b.request(detail)[0]==404 and b.request(picture)[0]==404,'unpublish removes detail and media')
check(b.request('/codemate/discover')[0]==200,'Discover route renders')
print('PASS',check_count,'CodeMate local integration assertions',flush=True)
print(json.dumps({'project':project,'build':v2,'manager':'Hana · ローカル検証','tester':tester_name,'test_code':CODE},ensure_ascii=False),flush=True)
conn.close()
