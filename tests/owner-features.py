"""Local D1 fixtures only. Never run against production."""
import urllib.request,urllib.error,json,sqlite3,pathlib,hashlib,uuid,time
BASE='http://127.0.0.1:5173';db=sqlite3.connect(next(p for p in pathlib.Path('.wrangler/state/v3/d1/miniflare-D1DatabaseObject').glob('*.sqlite') if p.name!='metadata.sqlite'))
prefix='ownerqa_'+uuid.uuid4().hex[:8];now=int(time.time()*1000);at='2026-10-25T00:00:00Z';h=lambda s:hashlib.sha256(s.encode()).hexdigest();checks=0
class Client:
 def __init__(self):self.cookie=''
 def request(self,path,b=None,method=None,origin=BASE):
  headers={'Origin':origin,'Cookie':self.cookie};data=None
  if b is not None:data=json.dumps(b).encode();headers['Content-Type']='application/json'
  try:r=urllib.request.urlopen(urllib.request.Request(BASE+path,data=data,headers=headers,method=method))
  except urllib.error.HTTPError as e:r=e
  if r.headers.get('Set-Cookie'):self.cookie=r.headers.get('Set-Cookie').split(';')[0]
  raw=r.read().decode()
  try:raw=json.loads(raw)
  except:pass
  return r.status,raw,r.headers
anon=Client();owner=Client();other=Client();ids=[prefix+'_'+str(i) for i in range(3)];code=uuid.uuid4().hex+uuid.uuid4().hex

def check(ok,label):
 global checks
 assert ok,label
 checks+=1;print('PASS',label)
try:
 for ip in ['local','127.0.0.1','::1']:
  db.execute('DELETE FROM admin_login_attempts WHERE id=?',('workspace:'+h('code-ip:'+ip),))
 for i,id in enumerate(ids):db.execute('INSERT INTO members(id,name,role,visible,created_at,updated_at)VALUES(?,?,?,0,?,?)',(id,id,'QA',at,at))
 db.execute('INSERT INTO workspace_owners VALUES(?)',(ids[0],))
 for i,client in enumerate([owner,other]):
  token=uuid.uuid4().hex;db.execute('INSERT INTO member_accounts(id,public_member_id,auth_user_id,display_name,pin_hash,activated_at,created_at,login_code_hash)VALUES(?,?,?,?,?,?,?,?)',(ids[i],ids[i],ids[i],ids[i],'!test',at,at,h(code)))
  db.execute("INSERT INTO workspace_sessions(token_hash,auth_user_id,purpose,version,verified_at,expires_at)VALUES(?,?,'admin',1,?,?)",(h(token),ids[i],now,now+3600000));client.cookie='__Host-motto-workspace='+token
 db.commit()
 check(anon.request('/api/admin')[0]==401,'anonymous Admin API denied')
 check(anon.request('/api/workspace/owner')[0]==403,'anonymous owner API denied')
 check(other.request('/api/workspace/owner')[0]==403,'ordinary Admin cannot inspect owner access panel')
 check(owner.request('/api/workspace/owner')[0]==200,'designated owner can inspect credential status')
 status,body,_=owner.request('/api/workspace/owner');check('pin_hash' not in json.dumps(body) and 'login_code_hash' not in json.dumps(body),'credential hashes never returned')
 c=Client();status,body,headers=c.request('/api/workspace/code',{'username':ids[0],'code':code});check(status==200,'returning username/code login without PIN');cookie=headers.get('Set-Cookie');check(all(v.lower() in cookie.lower() for v in ['HttpOnly','Secure','SameSite=Strict']),'secure session cookie attributes')
 check(c.request('/api/workspace/code',{'username':ids[0],'code':code},origin='https://evil.test')[0]==403,'code-login CSRF rejected')
 status,body,_=owner.request('/api/admin',{'entity':'project','action':'save','data':{'name':prefix,'slug':prefix,'category':'Web','short_description':'secret','published':True}});check(status==200,'private project registration: '+str(body));project=body['id']
 row=db.execute('SELECT admin_only,published FROM projects WHERE id=?',(project,)).fetchone();check(row==(1,0),'new project defaults private and cannot be published accidentally')
 check(anon.request('/projects/'+prefix)[0]==404,'private project direct URL hidden')
 check(prefix not in anon.request('/')[1],'private project omitted from public homepage')
 check(any(p['id']==project for p in owner.request('/api/admin')[1]['projects']),'Admin can retrieve private project')
 for public in [False,True]:check(owner.request('/api/calendar',{'title':prefix+str(public),'event_date':'2026-10-25','description':'test','is_public':public})[0]==200,'calendar event creation')
 events=anon.request('/api/calendar')[1]['events'];check(any(e['title']==prefix+'True' for e in events) and not any(e['title']==prefix+'False' for e in events),'public calendar excludes private events')
 check(not any(e['title']==prefix+'False' for e in owner.request('/api/calendar')[1]['events']),'public calendar view stays public for logged-in owner')
 check(any(e['title']==prefix+'False' for e in owner.request('/api/calendar?admin=1')[1]['events']),'private events visible only in authenticated Admin calendar')
 check(anon.request('/api/calendar?admin=1')[0]==401,'anonymous cannot opt into private calendar')
 check(anon.request('/api/calendar',{'title':'bad'})[0]==401,'public visitor cannot create calendar event')
 check(other.request('/api/workspace/activity',{'id':prefix},method='DELETE')[0]==403,'ordinary Admin cannot delete website updates')
 check(owner.request('/api/workspace/activity',{'id':prefix},method='DELETE')[0]==200,'owner can delete website update')
 check(owner.request('/api/workspace/owner',{'action':'revoke','memberId':ids[0]})[0]==400,'owner cannot revoke self')
 check(owner.request('/api/workspace/owner',{'action':'revoke','memberId':ids[1]})[0]==200,'owner revokes another member')
 check(other.request('/api/admin')[0]==401,'revocation immediately rejects existing session')
 check(Client().request('/api/workspace/code',{'username':ids[1],'code':code})[0]!=200,'revoked code login denied')
 status,issued,_=owner.request('/api/workspace/owner',{'action':'issue','memberId':ids[2]});check(status==200,'owner can issue member-specific activation code')
 fresh=Client();check(fresh.request('/api/workspace/code',{'username':ids[2],'code':issued['token'],'pin':'7395','confirm':'7395'})[0]==200,'initial activation with matching PIN')
 check(Client().request('/api/workspace/code',{'username':ids[2],'code':issued['token']})[0]==200,'same dedicated code works on subsequent login without PIN')
 status,rotated,_=owner.request('/api/workspace/owner',{'action':'rotate','memberId':ids[2]});check(status==200,'owner rotates login code')
 check(fresh.request('/api/admin')[0]==401,'rotation ends old sessions')
 check(Client().request('/api/workspace/code',{'username':ids[2],'code':issued['token']})[0]!=200,'old login code rejected after rotation')
 check(Client().request('/api/workspace/code',{'username':ids[2],'code':rotated['token']})[0]==200,'new login code accepted')
 print('PASS',checks,'owner/code/calendar/private-project checks')
finally:
 db.execute('DELETE FROM calendar_events WHERE created_by LIKE ?', (prefix+'%',));db.execute('DELETE FROM projects WHERE name=?',(prefix,));db.execute('DELETE FROM activity WHERE actor_id LIKE ?',(prefix+'%',));db.execute('DELETE FROM workspace_sessions WHERE auth_user_id LIKE ?',(prefix+'%',));db.execute('DELETE FROM workspace_owners WHERE public_member_id LIKE ?',(prefix+'%',));db.execute('DELETE FROM member_activations WHERE public_member_id LIKE ?',(prefix+'%',));db.execute('DELETE FROM member_accounts WHERE id LIKE ?',(prefix+'%',));db.execute('DELETE FROM members WHERE id LIKE ?',(prefix+'%',));db.commit();db.close()
