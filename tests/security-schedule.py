"""Local-only regression tests for privacy, reauthentication, events and deadlines."""
import urllib.request,urllib.error,json,sqlite3,pathlib,hashlib,uuid,time,base64
BASE='http://127.0.0.1:5173';db=sqlite3.connect(next(p for p in pathlib.Path('.wrangler/state/v3/d1/miniflare-D1DatabaseObject').glob('*.sqlite') if p.name!='metadata.sqlite'))
prefix='scheduleqa_'+uuid.uuid4().hex[:8];now=int(time.time()*1000);at='2026-10-25T00:00:00Z';h=lambda s:hashlib.sha256(s.encode()).hexdigest();checks=0;image=None
class Client:
 def __init__(self):self.cookie=''
 def request(self,path,b=None,method=None,origin=BASE,raw=None,content_type='application/json'):
  headers={'Origin':origin,'Cookie':self.cookie,'Content-Type':content_type};data=raw if raw is not None else json.dumps(b).encode() if b is not None else None
  try:r=urllib.request.urlopen(urllib.request.Request(BASE+path,data=data,headers=headers,method=method),timeout=15)
  except urllib.error.HTTPError as e:r=e
  raw=r.read()
  try:body=json.loads(raw)
  except:body=raw
  return r.status,body,r.headers
anon=Client();fresh=Client();stale=Client();owner=prefix

def check(ok,label):
 global checks
 assert ok,label
 checks+=1;print('PASS',label)
try:
 for ip in ['local','127.0.0.1','::1']:
  db.execute('DELETE FROM admin_login_attempts WHERE id=?',('workspace:'+h('code-ip:'+ip),))
 db.execute('INSERT INTO members(id,name,role,visible,created_at,updated_at)VALUES(?,?,?,0,?,?)',(owner,owner,'QA',at,at));db.execute('INSERT INTO member_accounts(id,public_member_id,auth_user_id,display_name,pin_hash,activated_at,created_at,login_code_hash)VALUES(?,?,?,?,?,?,?,?)',(owner,owner,owner,owner,'!test',at,at,h('test-code')));db.execute('INSERT INTO workspace_owners VALUES(?)',(owner,))
 for c,verified in [(fresh,now),(stale,now-360000)]:
  token=uuid.uuid4().hex;db.execute("INSERT INTO workspace_sessions(token_hash,auth_user_id,purpose,version,verified_at,expires_at)VALUES(?,?,'admin',1,?,?)",(h(token),owner,verified,now+3600000));c.cookie='__Host-motto-workspace='+token
 db.commit()
 check(stale.request('/api/workspace/auth',{'action':'setPin','pin':'7395','confirm':'7395'})[0]==403,'stale session cannot change PIN')
 check(fresh.request('/api/workspace/auth',{'action':'setPin','pin':'7395','confirm':'7395'},origin='https://evil.test')[0]==403,'cross-origin PIN change denied')
 check(fresh.request('/api/workspace/auth',{'action':'setPin','pin':'7395','confirm':'7395'})[0]==200,'freshly authenticated account can change PIN')
 check(stale.request('/api/workspace/owner',{'action':'rotate','memberId':owner})[0]==403,'stale owner session cannot rotate credentials')
 check('reauthenticate' in stale.request('/api/workspace/owner',{'action':'rotate','memberId':owner})[1],'reauthentication is explicitly requested')
 check(anon.request('/api/calendar?admin=1')[0]==401,'anonymous private-calendar request rejected')
 for date in ['2026-02-29','2026-04-31','2026-13-01']:
  check(fresh.request('/api/calendar',{'title':'bad','event_date':date})[0]==400,'invalid date rejected '+date)
 check(fresh.request('/api/calendar',{'action':'arbitrary','title':'bad','event_date':'2026-11-01'})[0]==400,'unknown calendar action rejected')
 for public in [False,True]:
  status,body,_=fresh.request('/api/calendar',{'action':'create','title':prefix+str(public),'event_date':'2026-11-01','kind':'deadline','description':'private details','is_public':public});check(status==200,'deadline created');event=body['id']
 rows=anon.request('/api/calendar')[1]['events'];check(any(e['title']==prefix+'True' for e in rows) and not any(e['title']==prefix+'False' for e in rows),'public sees only explicitly public deadlines')
 check(fresh.request('/api/calendar',{'action':'update','id':event,'title':prefix+'updated','event_date':'2026-11-02','kind':'deadline','is_public':False})[0]==200,'event date and visibility edited')
 check(not any(e['id']==event for e in anon.request('/api/calendar')[1]['events']),'event disappears publicly when made private')
 check(fresh.request('/api/calendar',{'action':'complete','id':event,'completed':True})[0]==200,'deadline completion stored')
 check(next(e for e in fresh.request('/api/calendar?admin=1')[1]['events'] if e['id']==event)['completed']==1,'completion round trips')
 check(fresh.request('/api/calendar',{'action':'complete','id':event,'completed':'false'})[0]==400,'string cannot masquerade as boolean')
 check(fresh.request('/api/calendar',raw=b'null')[0]==400,'non-object calendar JSON rejected')
 check(fresh.request('/api/calendar',raw=b'{')[0]==400,'malformed JSON handled without server error')
 check(fresh.request('/api/calendar',raw=json.dumps({'x':'z'*17000}).encode())[0]==413,'oversized calendar request rejected')
 response=anon.request('/api/workspace/code',raw=json.dumps({'username':'z'*5000}).encode());check(response[0]==413,'unauthenticated login input is size bounded: '+str(response[:2]))
 check(fresh.request('/api/calendar',{'title':'x'},origin='https://evil.test')[0]==403,'calendar CSRF rejected')
 check('no-store' in fresh.request('/api/admin')[2].get('Cache-Control',''),'private CMS response cannot be cached')
 png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jp1sAAAAASUVORK5CYII=');boundary='qa_'+uuid.uuid4().hex
 payload=('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="qa.png"\r\nContent-Type: image/png\r\n\r\n').encode()+png+('\r\n--'+boundary+'--\r\n').encode()
 status,body,_=fresh.request('/api/upload',raw=payload,content_type='multipart/form-data; boundary='+boundary);check(status==200,'valid PNG uploaded');image=body['url']
 check(anon.request(image)[0]==200,'test image starts publicly accessible')
 status,body,_=fresh.request('/api/admin',{'entity':'project','action':'save','data':{'name':prefix,'slug':prefix,'category':'Web','short_description':'secret','admin_only':True,'cover_image':image}});check(status==200,'private project references existing public image');project=body['id']
 check(anon.request(image)[0]==404,'private project image hidden from visitors')
 check(fresh.request(image)[0]==200,'authenticated Admin can read protected image')
 check(fresh.request('/api/admin',{'entity':'project','action':'delete','id':project})[0]==200,'private project deleted')
 check(anon.request(image)[0]==404,'image stays private after project deletion')
 status,body,_=fresh.request('/api/admin',{'entity':'project','action':'save','data':{'name':'bad','slug':'bad','category':'Web','short_description':'bad','project_url':'javascript:alert(1)'}});check(status==400,'dangerous URL scheme rejected');check('SQLITE' not in str(body) and 'D1_' not in str(body),'database internals not exposed')
 logs=db.execute('SELECT action FROM audit_logs WHERE actor_id=?',(owner,)).fetchall();check(any(x[0]=='calendar.create' for x in logs) and any(x[0]=='calendar.complete' for x in logs),'calendar writes audited without event contents')
 print('PASS',checks,'security and schedule checks')
finally:
 db.execute('DELETE FROM calendar_events WHERE created_by=?',(owner,));db.execute('DELETE FROM projects WHERE name=?',(prefix,));db.execute('DELETE FROM activity WHERE actor_id=?',(owner,));db.execute('DELETE FROM workspace_sessions WHERE auth_user_id=?',(owner,));db.execute('DELETE FROM workspace_owners WHERE public_member_id=?',(owner,));db.execute('DELETE FROM member_accounts WHERE id=?',(owner,));db.execute('DELETE FROM members WHERE id=?',(owner,))
 if image:db.execute('DELETE FROM protected_media WHERE path=?',(image,))
 db.commit();db.close()
