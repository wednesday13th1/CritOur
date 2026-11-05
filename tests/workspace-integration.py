"""Local-only Google workspace API tests. Signed Google ID claims are tested separately.
This seeds application session fixtures only in local D1, never in production.
"""
import urllib.request,urllib.error,json,sqlite3,pathlib,hashlib,uuid,time
BASE='http://127.0.0.1:5173'
DB=next(p for p in pathlib.Path('.wrangler/state/v3/d1/miniflare-D1DatabaseObject').glob('*.sqlite') if p.name!='metadata.sqlite')
db=sqlite3.connect(DB);now=int(time.time()*1000);at='2026-10-25T00:00:00Z';prefix='qa_'+uuid.uuid4().hex[:8]
class Client:
 def __init__(self):self.cookies={}
 def request(self,path,body=None,origin=BASE):
  headers={'Origin':origin,'Cookie':'; '.join(k+'='+v for k,v in self.cookies.items())};data=None
  if body is not None:data=json.dumps(body).encode();headers['Content-Type']='application/json'
  try:r=urllib.request.urlopen(urllib.request.Request(BASE+path,data=data,headers=headers))
  except urllib.error.HTTPError as e:r=e
  for cookie in r.headers.get_all('Set-Cookie',[]):
   k,v=cookie.split(';',1)[0].split('=',1);self.cookies[k]=v
  raw=r.read().decode()
  try:raw=json.loads(raw)
  except:pass
  return r.status,raw
 def post(self,path,**b):return self.request(path,b)
h=lambda s:hashlib.sha256(s.encode()).hexdigest()
ids=[prefix+'_'+str(i) for i in range(5)];emails=[m+'@gmail.com' for m in ids];tokens=[uuid.uuid4().hex for _ in ids]
checks=0
clients=[Client() for _ in range(3)];anonymous=Client()
def check(condition,label):
 global checks
 assert condition,label
 checks+=1;print('PASS',label)
try:
 for i,m in enumerate(ids):
  db.execute('INSERT INTO members(id,name,role,visible,created_at,updated_at)VALUES(?,?,?,0,?,?)',(m,'QA '+str(i),'QA',at,at))
  if i<3:
   db.execute('INSERT INTO allowed_emails(email,public_member_id,created_at,updated_by)VALUES(?,?,?,?)',(emails[i],m,at,prefix))
   db.execute('INSERT INTO member_accounts(id,public_member_id,auth_user_id,email,display_name,pin_hash,activated_at,created_at)VALUES(?,?,?,?,?,?,?,?)',(m,m,'google:'+m,emails[i],'QA '+str(i),'!google-only',at,at))
   db.execute("INSERT INTO workspace_sessions(token_hash,auth_user_id,purpose,version,verified_at,expires_at)VALUES(?,?,'admin',1,?,?)",(h(tokens[i]),'google:'+m,now,now+3600000))
 db.commit()
 check(anonymous.request('/')[0]==200,'anonymous public website available')
 for path in ['/api/admin','/api/workspace/chat','/api/workspace/allowlist','/api/workspace/activity']:
  check(anonymous.request(path)[0]==401,'anonymous denied '+path)
 for action in ['pin','activate','invite','reset','setupPin','changePin','sendEmail','verifyEmail']:
  check(anonymous.post('/api/workspace/auth',action=action)[0]==410,'legacy '+action+' disabled')
 check(anonymous.post('/api/workspace/auth',action='setupPin',pin='7395',confirm='7395')[0]==410,'PIN setup cannot authenticate')
 check(anonymous.request('/api/workspace/auth',{'action':'setupPin'},origin='https://evil.test')[0]==403,'CSRF rejected')
 for i,client in enumerate(clients):
  client.cookies['__Host-motto-workspace']=tokens[i]
  check(client.request('/api/admin')[0]==200,'equal Admin CMS access')
  check(client.post('/api/workspace/auth',action='setupPin',pin='8462',confirm='8462')[0]==410,'no activation or PIN setup required')
 a,b,c=clients
 # A legacy private account must never be transferable through public-profile enrollment.
 db.execute('INSERT INTO member_accounts(id,public_member_id,auth_user_id,display_name,pin_hash,activated_at,created_at)VALUES(?,?,?,?,?,?,?)',(ids[4],ids[4],ids[4],'Legacy QA','legacy-hash-fixture',at,at));db.commit()
 check(a.post('/api/workspace/allowlist',action='add',email=emails[4],memberId=ids[4])[0]==400,'allowlist cannot reassign a legacy private account')
 db.execute('INSERT INTO allowed_emails(email,public_member_id,created_at,updated_by)VALUES(?,?,?,?)',(emails[4],ids[4],at,prefix))
 db.commit()
 legacy=Client();legacy.cookies['__Host-motto-email']=tokens[4]
 check(legacy.post('/api/workspace/auth',action='setupPin',pin='7395',confirm='7395')[0]==410,'legacy PIN route cannot transfer private messages')
 check(db.execute('SELECT pin_hash FROM member_accounts WHERE email=?',(emails[0],)).fetchone()[0].startswith('!google-only'),'Google account has no PIN credential')
 accounts=[db.execute('SELECT id FROM member_accounts WHERE email=?',(email,)).fetchone()[0] for email in emails[:3]]
 # MIME spoofing is rejected after membership checks and before storage.
 boundary='qa-boundary'
 raw=('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="spoof.png"\r\nContent-Type: image/png\r\n\r\n<script>alert(1)</script>\r\n--'+boundary+'--\r\n').encode()
 request=urllib.request.Request(BASE+'/api/upload',data=raw,headers={'Origin':BASE,'Cookie':'; '.join(k+'='+v for k,v in a.cookies.items()),'Content-Type':'multipart/form-data; boundary='+boundary})
 try:response=urllib.request.urlopen(request)
 except urllib.error.HTTPError as e:response=e
 check(response.status==400,'spoofed image MIME rejected')
 check(a.post('/api/workspace/chat',action='send',content='local QA only')[0]==200,'persistent group message')
 message=b.request('/api/workspace/chat')[1]['messages'][-1]
 check(message['content']=='local QA only','second browser sees message')
 check(b.post('/api/workspace/chat',action='edit',id=message['id'],content='forged')[0]==403,'cannot edit teammate message')
 cid=a.post('/api/workspace/chat',action='conversation',peer=accounts[1])[1]['id']
 check(a.post('/api/workspace/chat',action='send',channel=cid,content='private QA')[0]==200,'private DM saved')
 check(b.request('/api/workspace/chat?channel='+cid)[1]['messages'][0]['content']=='private QA','participant reads DM')
 check(c.request('/api/workspace/chat?channel='+cid)[0]==403,'third Admin denied DM')
 db.execute('UPDATE workspace_sessions SET verified_at=? WHERE auth_user_id=?',(now-600001,'google:'+ids[2]));db.commit()
 check(c.post('/api/workspace/allowlist',action='add',email=emails[3],memberId=ids[3])[0]==403,'stale reauthentication cannot manage allowlist')
 check(c.post('/api/workspace/auth',action='changePin',pin='8462',confirm='8462')[0]==410,'PIN reset has been removed')
 check(a.post('/api/workspace/allowlist',action='add',email=emails[3],memberId=ids[3])[0]==200,'freshly verified Admin adds approved email')
 check(a.post('/api/workspace/allowlist',action='revoke',email=emails[1])[0]==200,'approved email revoked')
 for path in ['/api/admin','/api/workspace/chat','/api/workspace/allowlist','/api/workspace/activity']:
  check(b.request(path)[0]==401,'revocation immediately denies '+path)
 check(a.post('/api/workspace/allowlist',action='restore',email=emails[1])[0]==200,'email can be restored')
 check(b.request('/api/admin')[0]==401,'restore never resurrects old sessions')
 check(a.post('/api/workspace/allowlist',action='revoke',email=emails[1])[0]==200,'revoke restored account')
 check(a.post('/api/workspace/allowlist',action='revoke',email=emails[2])[0]==200,'second Admin revoked')
 check(a.post('/api/workspace/allowlist',action='revoke',email=emails[0])[0]==400,'last activated Admin protected even with pending approved email')
 logs=a.request('/api/workspace/activity')[1]['logs']
 check(any(x['action']=='allowlist.revoke' and x['resource']==emails[1] for x in logs),'allowlist security event audited')
 check(all('7395' not in json.dumps(x) and 'private QA' not in json.dumps(x) for x in logs),'no PIN or DM contents in audit')
 check(a.post('/api/workspace/auth',action='changePin',pin='8462',confirm='8462')[0]==410,'even authenticated Admin has no PIN setup route')
 # A new browser with the same opaque session sees persisted content, not browser-local data.
 refresh=Client();refresh.cookies=dict(a.cookies)
 check(refresh.request('/api/workspace/chat')[1]['messages'][-1]['content']=='local QA only','chat persists across session refresh')
 print(f'{checks} Google workspace checks passed; actual Google OAuth requires client credentials')
finally:
 # Keep immutable QA audit + revoked allowlist mappings locally; remove private test contents.
 account_rows=db.execute('SELECT id,auth_user_id FROM member_accounts WHERE public_member_id LIKE ?', (prefix+'%',)).fetchall()
 for account,auth_user in account_rows:
  for (cid,) in db.execute('SELECT conversation_id FROM direct_conversation_participants WHERE member_id=?',(account,)).fetchall():
   db.execute('DELETE FROM direct_messages WHERE conversation_id=?',(cid,));db.execute('DELETE FROM direct_conversation_participants WHERE conversation_id=?',(cid,));db.execute('DELETE FROM direct_conversations WHERE id=?',(cid,))
  db.execute('DELETE FROM message_reactions WHERE member_id=? OR message_id IN(SELECT id FROM team_messages WHERE sender_id=?)',(account,account));db.execute('DELETE FROM team_messages WHERE sender_id=?',(account,));db.execute('DELETE FROM message_reads WHERE member_id=?',(account,));db.execute('DELETE FROM workspace_sessions WHERE auth_user_id=?',(auth_user,))
 db.execute('DELETE FROM member_accounts WHERE public_member_id LIKE ?', (prefix+'%',))
 db.execute('UPDATE allowed_emails SET disabled_at=?,updated_by=? WHERE public_member_id LIKE ? AND disabled_at IS NULL',(at,prefix,prefix+'%'))
 db.execute('DELETE FROM email_challenges WHERE email LIKE ?', (prefix+'%',))
 db.execute("DELETE FROM admin_login_attempts WHERE id LIKE 'workspace:%'")
 db.commit();db.close()
