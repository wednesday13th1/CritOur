"""Stage 1/2 access tests against local D1 only. No hosted calls or secrets."""
import pathlib,sqlite3,urllib.request,urllib.error,json,hashlib,time,uuid
BASE='http://127.0.0.1:5173';db=sqlite3.connect(next(p for p in pathlib.Path('.wrangler/state/v3/d1/miniflare-D1DatabaseObject').glob('*.sqlite') if p.name!='metadata.sqlite'));prefix='studioqa_'+uuid.uuid4().hex[:8];ids=[prefix+str(i) for i in range(4)];now=int(time.time()*1000);at='2026-10-26T00:00:00Z';h=lambda s:hashlib.sha256(s.encode()).hexdigest();checks=0;projectIds=[]
class Client:
 def __init__(self,cookie=''):self.cookie=cookie
 def request(self,path,b=None,method=None,origin=BASE,extra=None):
  headers={'Origin':origin,'Cookie':self.cookie,'Content-Type':'application/json',**(extra or {})};data=json.dumps(b).encode() if b is not None else None
  try:r=urllib.request.urlopen(urllib.request.Request(BASE+path,data=data,headers=headers,method=method),timeout=20)
  except urllib.error.HTTPError as e:r=e
  raw=r.read()
  try:body=json.loads(raw)
  except:body=raw.decode()
  return r.status,body,r.headers
clients=[];anon=Client()
def check(value,label):
 global checks
 assert value,label
 checks+=1;print('PASS',label)
try:
 assert not db.execute('SELECT 1 FROM studio_admins').fetchone(),'Local Studio must not have a real enrolled admin for this fixture test'
 cmsBefore=db.execute('SELECT id,name,published,admin_only FROM projects ORDER BY id').fetchall()
 for i,id in enumerate(ids):
  db.execute('INSERT INTO members(id,name,role,visible,created_at,updated_at)VALUES(?,?,?,0,?,?)',(id,'K' if i==3 else 'Studio QA '+str(i),'QA',at,at))
  db.execute('INSERT INTO member_accounts(id,public_member_id,auth_user_id,display_name,pin_hash,activated_at,created_at,login_code_hash)VALUES(?,?,?,?,?,?,?,?)',(id,id,id,'K' if i==3 else 'Studio QA '+str(i),'!qa',at,at,h(uuid.uuid4().hex)))
  token=uuid.uuid4().hex;db.execute("INSERT INTO workspace_sessions(token_hash,auth_user_id,purpose,version,verified_at,expires_at)VALUES(?,?,'admin',1,?,?)",(h(token),id,now,now+3600000));clients.append(Client('__Host-motto-workspace='+token))
 db.execute('INSERT INTO workspace_owners VALUES(?)',(ids[0],));db.commit();owner,alice,bob,pretendK=clients
 check(anon.request('/api/studio/projects')[0]==401,'anonymous project API denied')
 check(not pretendK.request('/api/studio/projects')[1]['user']['canInitialize'],'display name K grants no setup privilege')
 check(pretendK.request('/api/studio/initialize',{})[0]==403,'display-name impersonation cannot initialize Workspace')
 check(owner.request('/api/studio/initialize',{},origin='https://evil.test')[0]==403,'initialization CSRF rejected')
 check(owner.request('/api/studio/initialize',{})[0]==200,'verified existing owner initializes Studio')
 binding=db.execute('SELECT account_id,auth_user_id FROM studio_admins WHERE id=1').fetchone();check(binding==(ids[0],ids[0]),'admin bound to exact authenticated account and auth user IDs')
 db.execute("UPDATE member_accounts SET display_name='Renamed Owner' WHERE id=?",(ids[0],));db.commit()
 check(owner.request('/api/studio/projects')[1]['user']['isStudioAdmin'],'renaming owner does not lose admin identity')
 check(not pretendK.request('/api/studio/projects')[1]['user']['isStudioAdmin'],'matching display name cannot become Studio admin')
 check(pretendK.request('/api/studio/initialize',{})[0]==403,'cannot replace initialized admin binding')
 check(owner.request('/api/studio/initialize',{})[0]==200,'owner initialization retry is idempotent')
 check(alice.request('/api/studio/projects',{'name':'Not allowed'})[0]==403,'ordinary member cannot create a project')
 for name in ['Private Alpha','Private Beta']:
  status,j,_=owner.request('/api/studio/projects',{'name':name,'description':'Private description'});check(status==201,'admin creates '+name);projectIds.append(j['id'])
 alpha,beta=projectIds
 check(alice.request('/api/studio/projects')[1]['projects']==[],'unassigned member sees no projects')
 check(alice.request('/api/studio/projects/'+alpha)[0]==404,'guessed project URL denied before assignment')
 check(alice.request('/studio/'+alpha)[0]==404,'server-rendered page denies unassigned member')
 check(owner.request('/api/studio/projects/'+alpha+'/members',{'action':'add','accountId':ids[1]})[0]==200,'admin assigns Alice to Alpha')
 check(owner.request('/api/studio/projects/'+beta+'/members',{'action':'add','accountId':ids[2]})[0]==200,'admin assigns Bob to Beta')
 check([p['id'] for p in alice.request('/api/studio/projects')[1]['projects']]==[alpha],'member list restricted to assigned project')
 check(alice.request('/api/studio/projects/'+alpha)[0]==200,'assigned member reads project details')
 check(alice.request('/studio/'+alpha)[0]==200,'assigned member opens server-rendered Workspace')
 check(alice.request('/api/studio/projects/'+beta)[0]==404,'member cannot access another project by direct API')
 check(bob.request('/api/studio/projects/'+alpha)[0]==404,'another project member cannot read Alpha')
 check(alice.request('/api/studio/accounts')[0]==403,'member cannot enumerate all account candidates')
 check('email' not in json.dumps(owner.request('/api/studio/accounts')[1]),'admin account choices contain no login emails')
 check(alice.request('/api/studio/projects/'+alpha,{'name':'hijack'},method='PATCH')[0]==403,'member cannot rename projects')
 check(alice.request('/api/studio/projects/'+alpha+'/members',{'action':'add','accountId':ids[2]})[0]==403,'member cannot grant someone else membership')
 check(owner.request('/api/studio/projects/'+alpha+'/members',{'action':'add','accountId':ids[2]},origin='https://evil.test')[0]==403,'membership CSRF rejected')
 payload=alice.request('/api/studio/projects/'+alpha)[1]
 check('Private Beta' not in json.dumps(payload) and beta not in json.dumps(payload),'project response contains no unrelated project data or activity')
 check('no-store' in alice.request('/studio/'+alpha)[2].get('Cache-Control',''),'private Studio pages cannot be cached')
 db.execute('UPDATE workspace_sessions SET verified_at=? WHERE auth_user_id=?',(now-360000,ids[0]));db.commit()
 check(owner.request('/api/studio/projects/'+alpha+'/members',{'action':'add','accountId':ids[2]})[0]==403,'membership change requires recent reauthentication')
 db.execute('UPDATE workspace_sessions SET verified_at=? WHERE auth_user_id=?',(now,ids[0]));db.commit()
 check(owner.request('/api/studio/projects/'+alpha+'/members',{'action':'remove','accountId':ids[1]})[0]==200,'admin removes membership')
 check(alice.request('/api/studio/projects/'+alpha)[0]==404,'revoked membership immediately denies detail API')
 check(alice.request('/api/studio/projects')[1]['projects']==[],'revoked membership disappears from project list')
 check(owner.request('/api/studio/projects/'+beta,{'archived':True},method='PATCH')[0]==200,'admin archives project')
 check(bob.request('/api/studio/projects/'+beta)[0]==404,'archived project denied to member')
 check(owner.request('/api/studio/projects/'+beta)[0]==200,'admin retains archived project access')
 check(owner.request('/api/studio/projects/'+beta,{'archived':False},method='PATCH')[0]==200,'admin restores project')
 check(bob.request('/api/studio/projects/'+beta)[0]==200,'membership resumes on project restore')
 db.execute('UPDATE member_accounts SET disabled_at=? WHERE id=?',(now,ids[2]));db.commit()
 check(bob.request('/api/studio/projects/'+beta)[0]==401,'account revocation denies Studio with old cookie')
 check(owner.request('/api/studio/projects/'+alpha+'/members',{'action':'add','accountId':ids[2]})[0]==400,'disabled account cannot be newly assigned')
 check(cmsBefore==db.execute('SELECT id,name,published,admin_only FROM projects ORDER BY id').fetchall(),'Studio operations leave CMS projects and visibility unchanged')
 check(not db.execute("SELECT 1 FROM audit_logs WHERE resource IN (?,?)",projectIds).fetchone(),'private Studio activity not exposed through global CMS audit')
 check(owner.request('/api/studio/projects/'+alpha)[1]['activity'],'project activity available inside authorized project')
 print('PASS',checks,'Studio identity/membership/access checks')
finally:
 db.execute('DELETE FROM studio_activity WHERE actor_id LIKE ?',(prefix+'%',));db.execute('DELETE FROM studio_project_members WHERE added_by LIKE ?',(prefix+'%',));db.execute('DELETE FROM studio_projects WHERE created_by LIKE ?',(prefix+'%',));db.execute('DELETE FROM studio_admins WHERE account_id LIKE ?',(prefix+'%',));db.execute('DELETE FROM workspace_sessions WHERE auth_user_id LIKE ?',(prefix+'%',));db.execute('DELETE FROM workspace_owners WHERE public_member_id LIKE ?',(prefix+'%',));db.execute('DELETE FROM member_accounts WHERE id LIKE ?',(prefix+'%',));db.execute('DELETE FROM members WHERE id LIKE ?',(prefix+'%',));db.commit();db.close()
