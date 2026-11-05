"""Local D1/R2 integration tests. Disposable sessions; no hosted writes."""
import pathlib,sqlite3,urllib.request,urllib.error,json,hashlib,time,uuid,concurrent.futures
BASE='http://127.0.0.1:5173';db=sqlite3.connect(next(p for p in pathlib.Path('.wrangler/state/v3/d1/miniflare-D1DatabaseObject').glob('*.sqlite') if p.name!='metadata.sqlite'));prefix='collabqa_'+uuid.uuid4().hex[:8];ids=[prefix+str(i) for i in range(4)];now=int(time.time()*1000);at='2026-10-26T00:00:00Z';h=lambda s:hashlib.sha256(s.encode()).hexdigest();checks=0;projects=[];uploads=[];clients=[];key=lambda:uuid.uuid4().hex
class Client:
 def __init__(self,cookie=''):self.cookie=cookie
 def req(self,path,b=None,method=None,headers=None):
  hh={'Origin':BASE,'Cookie':self.cookie,**(headers or {})};data=b
  if b is not None and not isinstance(b,bytes):data=json.dumps(b).encode();hh['Content-Type']='application/json'
  try:r=urllib.request.urlopen(urllib.request.Request(BASE+path,data=data,headers=hh,method=method),timeout=15)
  except urllib.error.HTTPError as e:r=e
  raw=r.read()
  try:raw=json.loads(raw)
  except:pass
  return r.status,raw,r.headers
 def act(self,**b):return self.req('/api/studio/collaboration',{'projectId':alpha,**b})
 def get(self,view,**q):return self.req('/api/studio/collaboration?'+urllib.parse.urlencode({'projectId':alpha,'view':view,**q}))
 def upload(self,kind,scope,name='notes.txt',data=b'hello private file'):
  boundary='studio-qa';body=b''
  for k,v in [('scopeKind',kind),('scopeId',scope)]:body+=('--'+boundary+'\r\nContent-Disposition: form-data; name="'+k+'"\r\n\r\n'+v+'\r\n').encode()
  body+=('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="'+name+'"\r\nContent-Type: application/octet-stream\r\n\r\n').encode()+data+('\r\n--'+boundary+'--\r\n').encode()
  r=self.req('/api/workspace/files',body,headers={'Content-Type':'multipart/form-data; boundary='+boundary})
  if r[0]==201:uploads.append(r[1]['id'])
  return r
anon=Client()
def check(v,label):
 global checks
 assert v,label
 checks+=1;print('PASS',label)
try:
 assert not db.execute('SELECT 1 FROM studio_admins').fetchone()
 for i,id in enumerate(ids):
  db.execute('INSERT INTO members(id,name,role,visible,created_at,updated_at)VALUES(?,?,?,0,?,?)',(id,'Collaborator '+str(i),'QA',at,at));db.execute('INSERT INTO member_accounts(id,public_member_id,auth_user_id,display_name,pin_hash,activated_at,created_at,login_code_hash)VALUES(?,?,?,?,?,?,?,?)',(id,id,id,'Collaborator '+str(i),'!qa',at,at,h(key())));token=key();db.execute("INSERT INTO workspace_sessions(token_hash,auth_user_id,purpose,version,verified_at,expires_at)VALUES(?,?,'admin',1,?,?)",(h(token),id,now,now+3600000));clients.append(Client('__Host-motto-workspace='+token))
 db.execute('INSERT INTO workspace_owners VALUES(?)',(ids[0],));db.commit();owner,a,b,outsider=clients
 check(owner.req('/api/studio/initialize',{})[0]==200,'initialize exact owner identity')
 for name in ['Core Alpha','Core Beta']:
  r=owner.req('/api/studio/projects',{'name':name});assert r[0]==201,r;projects.append(r[1]['id'])
 alpha,beta=projects
 for id in ids[1:3]:assert owner.req('/api/studio/projects/'+alpha+'/members',{'action':'add','accountId':id})[0]==200
 assert owner.req('/api/studio/projects/'+beta+'/members',{'action':'add','accountId':ids[3]})[0]==200
 channels=a.get('channels')[1]['channels'];channel=next(c['id'] for c in channels if c['name']=='general');other=next(c['id'] for c in channels if c['name']=='bugs')
 check(len(channels)==5,'new projects have five real channels')
 check(anon.req('/api/studio/collaboration?projectId='+alpha)[0]==401,'visitor cannot read collaboration API')
 check(outsider.get('messages',channelId=channel)[0]==404,'unassigned member cannot read channel')
 check(a.get('messages',channelId=channel,projectId=beta)[0]==404,'project/channel mismatch denied')
 check(a.act(action='message.send',channelId=channel,content='blocked',clientId=key(),projectId=beta)[0]==404,'write project/channel mismatch denied')
 # Concurrent requests represent double-clicks or a lost HTTP acknowledgement.
 concurrentKey=key();concurrentBody={'action':'message.send','channelId':channel,'content':'Concurrent retry','clientId':concurrentKey}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  results=list(pool.map(lambda _:a.act(**concurrentBody),range(4)))
 check(all(r[0]==200 for r in results) and len({r[1]['id'] for r in results})==1,'simultaneous channel retries acknowledge one canonical message')
 check(db.execute('SELECT count(*) FROM studio_messages WHERE sender_id=? AND client_id=?',(ids[1],concurrentKey)).fetchone()[0]==1,'concurrent channel retry stores exactly one row')
 # A client ID is scoped to a single channel/thread, including racing requests.
 conflictKey=key()
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  results=list(pool.map(lambda c:a.act(action='message.send',channelId=c,content='scope conflict',clientId=conflictKey),[channel,other]))
 check(sorted(r[0] for r in results)==[200,409],'racing reuse of a client ID across channels is rejected')
 k=key();body={'action':'message.send','channelId':channel,'content':'Hello @[B](member:'+ids[2]+')','clientId':k};r=a.act(**body);assert r[0]==200,r;message=r[1]['id']
 check(a.act(**body)[1]['id']==message,'retry returns same message')
 check(db.execute('SELECT count(*) FROM studio_messages WHERE sender_id=? AND client_id=?',(ids[1],k)).fetchone()[0]==1,'message retry does not duplicate storage')
 check(len(b.get('notifications')[1]['notifications'])==1,'mention notification delivered once')
 check(a.get('notifications')[1]['notifications']==[],'notifications private to recipient')
 mentionKey=key();mentionBody={'action':'message.send','channelId':channel,'content':'Concurrent @[B](member:'+ids[2]+')','clientId':mentionKey}
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  results=list(pool.map(lambda _:a.act(**mentionBody),range(3)))
 check(all(r[0]==200 for r in results),'concurrent mention deliveries acknowledged')
 mentionMessage=results[0][1]['id']
 check(db.execute('SELECT count(*) FROM studio_notifications WHERE target_id=? AND recipient_id=?',(mentionMessage,ids[2])).fetchone()[0]==1,'concurrent retry creates one mention notification')

 check(outsider.act(**body)[0]==404,'unassigned member cannot send by guessed channel')
 check(b.act(action='message.edit',channelId=channel,messageId=message,content='hijack',version=1)[0]==403,'cannot edit someone else message')
 check(a.act(action='message.edit',channelId=channel,messageId=message,content='Updated',version=1)[0]==200,'author edits message')
 check(a.act(action='message.edit',channelId=channel,messageId=message,content='stale',version=1)[0]==409,'stale message edit rejected')
 r=b.act(action='message.send',channelId=channel,parentId=message,content='Reply',clientId=key());reply=r[1]['id'];check(r[0]==200,'thread reply saved')
 check(next(m for m in a.get('messages',channelId=channel)[1]['messages'] if m['id']==message)['reply_count']==1,'root displays thread count')
 check(a.get('messages',channelId=channel,parentId=message)[1]['messages'][0]['id']==reply,'thread loads scoped replies')
 check(b.act(action='message.send',channelId=other,parentId=message,content='wrong',clientId=key())[0]==400,'cross-channel thread rejected')
 for _ in range(2):assert b.act(action='message.react',channelId=channel,messageId=message,emoji='👍',remove=False)[0]==200
 check(len(a.get('messages',channelId=channel)[1]['reactions'])==1,'reaction retries idempotent')
 check(a.get('channels')[1]['channels'][0]['unread']>0,'channel unread includes colleague reply')
 seq=db.execute('SELECT max(seq) FROM studio_messages WHERE channel_id=?',(channel,)).fetchone()[0];check(a.act(action='message.read',channelId=channel,lastSeq=seq)[0]==200,'read cursor accepted');check(a.get('channels')[1]['channels'][0]['unread']==0,'read cursor clears unread count')
 r=a.upload('channel',channel);check(r[0]==201,'private text attachment uploads');file=r[1]['id']
 check(b.req('/api/workspace/files/'+file)[0]==404,'pending attachment private even to project peer')
 check(a.upload('channel',channel,'fake.png',b'<script>bad</script>')[0]==400,'extension/MIME spoof rejected')
 check(a.upload('channel',channel,'unsafe.html',b'<h1>bad</h1>')[0]==400,'HTML attachment rejected')
 check(outsider.upload('channel',channel)[0]==404,'attachment upload enforces project scope')
 check(b.act(action='message.send',channelId=channel,content='stolen',fileIds=[file],clientId=key())[0]==400,'cannot attach another uploader file')
 check(a.act(action='message.send',channelId=other,content='wrong channel',fileIds=[file],clientId=key())[0]==400,'cannot reuse file in different channel')
 fileKey=key()
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  bound=list(pool.map(lambda _:a.act(action='message.send',channelId=channel,content='',fileIds=[file],clientId=fileKey),range(3)))
 check(all(r[0]==200 for r in bound) and len({r[1]['id'] for r in bound})==1,'attachment-bearing concurrent retries return the same canonical message')
 r=bound[0];check(r[0]==200,'file-only message binds attachment');filemsg=r[1]['id']
 check(b.req('/api/workspace/files/'+file)[1]==b'hello private file','authorized colleague downloads bound file')
 headers=b.req('/api/workspace/files/'+file)[2];check('attachment;' in headers.get('Content-Disposition','') and 'sandbox' in headers.get('Content-Security-Policy',''),'downloads forced with sandbox CSP')
 check(anon.req('/api/workspace/files/'+file)[0]==401,'visitor cannot download private file')
 check(outsider.req('/api/workspace/files/'+file)[0]==404,'unassigned account cannot download private file')
 storage=db.execute('SELECT storage_key FROM studio_files WHERE id=?',(file,)).fetchone()[0];check(anon.req('/media/'+storage)[0]==404,'public media path cannot bypass private download')
 check(a.req('/api/workspace/files/'+file,method='DELETE')[0]==403,'sent attachment cannot be detached through pending API')
 check(a.act(action='message.send',channelId=channel,content='reuse',fileIds=[file],clientId=key())[0]==400,'sent attachment cannot be rebound')
 assert a.act(action='message.delete',channelId=channel,messageId=filemsg)[0]==200
 check(b.req('/api/workspace/files/'+file)[0]==404,'deleted message attachment no longer downloads')
 taskbody={'action':'task.create','title':'Implement UI','assigneeIds':[ids[1],ids[2]],'priority':'high','dueDate':'2026-10-26','sourceMessageId':message,'clientId':key(),'githubUrl':'https://github.com/wednesday13th1/Team_Site/issues/1'}
 r=a.act(**taskbody);assert r[0]==200,r;task=r[1]['id'];check(a.act(**{**taskbody,'clientId':key()})[1]['id']==task,'message-to-task conversion idempotent')
 source=a.act(action='message.send',channelId=channel,content='Concurrent source task',clientId=key())[1]['id']
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  results=list(pool.map(lambda c:c.act(action='task.create',title='Review source',sourceMessageId=source,clientId=key()),[a,b]))
 check(all(r[0]==200 for r in results) and len({r[1]['id'] for r in results})==1,'simultaneous message-to-task conversion returns the same task to both members')
 sourceTask=results[0][1]['id']
 check(db.execute("SELECT count(*) FROM studio_activity WHERE action='task.create' AND target_account_id=?",(sourceTask,)).fetchone()[0]==1,'source task concurrent retry records one creation activity')
 taskKey=key()
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  results=list(pool.map(lambda _:a.act(action='task.create',title='One task',clientId=taskKey),range(3)))
 check(all(r[0]==200 for r in results) and len({r[1]['id'] for r in results})==1,'simultaneous task-create retries return one canonical task')
 check(a.get('task',taskId=task)[1]['task']['source_channel_id']==channel,'task preserves original message link')
 check(any(t['id']==task for t in b.req('/api/studio/inbox')[1]['tasks']),'My Tasks lists assigned authorized project task')
 check(not outsider.req('/api/studio/inbox')[1]['tasks'],'My Tasks excludes unassigned project')
 check(outsider.get('task',taskId=task)[0]==404,'task detail enforces project scope')
 check(a.act(action='task.create',title='bad',assigneeIds=[ids[3]],clientId=key())[0]==400,'task cannot assign unrelated project member')
 check(a.act(action='task.create',title='bad',githubUrl='https://evil.test/issues/1',clientId=key())[0]==400,'non-GitHub task reference rejected')
 check(a.act(action='task.create',title='bad',status='invented',clientId=key())[0]==400,'invalid task status rejected')
 deadline=next(n for n in b.get('notifications')[1]['notifications'] if n['kind']=='deadline');assert b.act(action='notification.read',id=deadline['id'])[0]==200
 r=a.act(action='task.update',taskId=task,version=1,status='in_progress');check(r[0]==200,'task status transition saves')
 saved=next(n for n in b.get('notifications')[1]['notifications'] if n['kind']=='deadline');check(saved['id']==deadline['id'] and saved['read_at'],'unchanged deadline retains notification identity and read state')
 check(b.act(action='task.update',taskId=task,version=1,status='done')[0]==409,'concurrent stale task edit rejected')
 check(a.get('task',taskId=task)[1]['task']['status']=='in_progress','stale task edit does not overwrite latest state')
 comment=key();assert a.act(action='task.comment',taskId=task,content='Ready for review',clientId=comment)[0]==200;assert a.act(action='task.comment',taskId=task,content='Ready for review',clientId=comment)[0]==200
 check(len(a.get('task',taskId=task)[1]['comments'])==1,'task comment retry deduplicates')
 check(any(n['kind']=='deadline' for n in b.get('notifications')[1]['notifications']),'upcoming deadline appears in-app')
 assert a.act(action='task.update',taskId=task,version=2,status='done')[0]==200
 check(not any(n['kind']=='deadline' for n in b.get('notifications')[1]['notifications']),'completed task removes deadline notification')
 note=b.get('notifications')[1]['notifications'][0];assert b.act(action='notification.read',id=note['id'])[0]==200
 check(next(n for n in b.get('notifications')[1]['notifications'] if n['id']==note['id'])['read_at'],'notification read state saved')
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  futures=[pool.submit(c.act,action='task.update',taskId=task,version=3,status=s) for c,s in [(a,'in_review'),(b,'todo')]];codes=sorted(f.result()[0] for f in futures)
 check(codes==[200,409],'simultaneous task edits commit exactly one winner')
 # Unchanged deadline notifications retain read state and unique identity.
 # DM uploads use the existing participant rule, without an owner bypass.
 conv=a.req('/api/workspace/chat',{'action':'conversation','peer':ids[2]})[1]['id'];r=a.upload('dm',conv);assert r[0]==201,r;dmfile=r[1]['id'];r=a.req('/api/workspace/chat',{'action':'send','channel':conv,'content':'private attachment','fileIds':[dmfile],'clientId':key()});check(r[0]==200,'existing DM supports bound private attachments')
 dmKey=key();dmBody={'action':'send','channel':conv,'content':'same DM','clientId':dmKey}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  results=list(pool.map(lambda _:a.req('/api/workspace/chat',dmBody),range(4)))
 check(all(r[0]==200 for r in results) and len({r[1]['id'] for r in results})==1,'simultaneous DM retries return one canonical message')
 check(db.execute('SELECT count(*) FROM direct_messages WHERE sender_id=? AND client_id=?',(ids[1],dmKey)).fetchone()[0]==1,'DM stores one message after concurrent delivery')
 dmId=results[0][1]['id'];dmVersion=db.execute('SELECT updated_at FROM direct_messages WHERE id=?',(dmId,)).fetchone()[0]
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  edits=list(pool.map(lambda text:a.req('/api/workspace/chat',{'action':'edit','channel':conv,'id':dmId,'updatedAt':dmVersion,'content':text}),['first edit','second edit']))
 check(sorted(r[0] for r in edits)==[200,409],'concurrent DM edits with the same version have one winner')

 check(any(m['client_id']==dmKey for m in b.req('/api/workspace/chat?channel='+conv)[1]['messages']),'second DM client reads confirmed sender message')
 check(b.req('/api/workspace/files/'+dmfile)[0]==200,'DM participant can download')
 check(owner.req('/api/workspace/files/'+dmfile)[0]==404,'Workspace owner cannot bypass DM membership')
 check(outsider.req('/api/workspace/chat?channel='+conv)[0]==403,'outsider cannot read DM API')
 check(a.req('/api/workspace/chat?channel='+conv+'&before=missing-page-id')[0]==400,'invalid DM pagination cursor fails explicitly')
 stamp='2026-10-26T01:00:00.000Z';firstId=prefix+'zzz';secondId=prefix+'aaa'
 db.execute('INSERT INTO direct_messages(id,conversation_id,sender_id,content,client_id,created_at,updated_at)VALUES(?,?,?,?,?,?,?)',(firstId,conv,ids[2],'first at same millisecond',key(),stamp,stamp));db.commit()
 check(a.req('/api/workspace/chat',{'action':'read','channel':conv,'readAt':stamp,'lastId':firstId})[0]==200,'DM read cursor accepts the exact visible message identity')
 db.execute('INSERT INTO direct_messages(id,conversation_id,sender_id,content,client_id,created_at,updated_at)VALUES(?,?,?,?,?,?,?)',(secondId,conv,ids[2],'later at same millisecond',key(),stamp,stamp));db.commit()
 unread=next(c['unread'] for c in a.req('/api/workspace/chat?channel='+conv)[1]['conversations'] if c['id']==conv)
 check(unread==1,'same-millisecond later DM remains unread after an earlier message was read')
 check(b.req('/api/workspace/chat',{'action':'delete','channel':conv,'id':secondId})[0]==200,'DM author can delete unread message')
 check(next(c['unread'] for c in a.req('/api/workspace/chat?channel='+conv)[1]['conversations'] if c['id']==conv)==0,'deleted DM no longer produces a ghost unread count')

 selected=a.req('/api/workspace/chat?'+urllib.parse.urlencode({'channel':conv,'ids':json.dumps([dmId])}))
 check(selected[0]==200 and len(selected[1]['messages'])==1 and selected[1]['messages'][0]['id']==dmId,'DM batch refresh returns exactly requested messages')
 otherDM=a.req('/api/workspace/chat',{'action':'conversation','peer':ids[0]})[1]['id']
 check(a.req('/api/workspace/chat?'+urllib.parse.urlencode({'channel':otherDM,'ids':json.dumps([dmId])}))[1]['messages']==[],'DM batch refresh cannot read another conversation by ID')
 check(a.req('/api/workspace/chat?'+urllib.parse.urlencode({'channel':conv,'ids':json.dumps(['x']*101)}))[0]==400,'DM batch refresh is bounded to one hundred IDs')

 db.execute('UPDATE member_accounts SET disabled_at=? WHERE id=?',(now,ids[3]));db.commit()
 check(a.req('/api/workspace/chat',{'action':'conversation','peer':ids[3]})[0]==400,'disabled account cannot become a new DM recipient')
 check(not any(p['id']==ids[3] for p in a.req('/api/workspace/chat?channel='+conv)[1]['people']),'disabled account is absent from DM picker')
 db.execute('UPDATE member_accounts SET disabled_at=NULL WHERE id=?',(ids[3],));db.commit()

 check(a.req('/api/studio/collaboration',{'action':'message.send','projectId':alpha,'channelId':channel,'content':'CSRF','clientId':key()},headers={'Origin':'https://evil.test'})[0]==403,'collaboration CSRF denied')
 # Read real API pages across identical timestamps and tombstones.
 for i in range(53):
  mid=prefix+'page'+str(i);db.execute('INSERT INTO studio_messages(id,project_id,channel_id,sender_id,content,client_id,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?)',(mid,alpha,other,ids[1],'Page '+str(i),key(),at,at))
 db.commit();page1=a.get('messages',channelId=other)[1]['messages'];page2=a.get('messages',channelId=other,before=page1[0]['seq'])[1]['messages']
 check(len(page1)==50 and len({m['id'] for m in page1+page2})==len(page1)+len(page2),'channel pagination uses sequence cursors without duplicates at equal timestamps')
 check([m['seq'] for m in page2+page1]==sorted(m['seq'] for m in page2+page1),'paginated messages remain in server chronological sequence')
 oldMessage=page2[0];assert a.act(action='message.edit',channelId=other,messageId=oldMessage['id'],content='Edited outside newest window',version=oldMessage['version'])[0]==200
 refreshed=a.get('messages',channelId=other,ids=json.dumps([oldMessage['id']]))
 check(refreshed[0]==200 and refreshed[1]['messages'][0]['content']=='Edited outside newest window','loaded old message refresh includes edits outside the latest page')
 check(a.get('messages',channelId=channel,ids=json.dumps([oldMessage['id']]))[1]['messages']==[],'batch message refresh is still restricted to the requested channel')
 check(a.get('messages',channelId=other,ids=json.dumps(['x']*51))[0]==400,'batch channel refresh is bounded to fifty IDs')
 check(outsider.get('messages',channelId=other,ids=json.dumps([oldMessage['id']]))[0]==404,'batch refresh cannot bypass project access')

 limitId='workspace:'+h('studio-action:'+ids[1]);db.execute('UPDATE admin_login_attempts SET attempts=120,window=? WHERE id=?',(int(time.time()*1000)//60000,limitId));db.commit()
 check(a.act(action='message.send',channelId=channel,content='limit',clientId=key())[0]==429,'collaboration action rate limit enforced');db.execute('DELETE FROM admin_login_attempts WHERE id=?',(limitId,));db.commit()
 # Open SSE, mutate data, observe event, then revoke and verify stream closes.
 stream=urllib.request.urlopen(urllib.request.Request(BASE+'/api/studio/live?projectId='+alpha,headers={'Cookie':a.cookie}),timeout=10)
 def event():
  while True:
   line=stream.readline().decode().strip()
   if line.startswith('event:'):return line
 check(event()=='event: refresh','SSE starts with authorized revision')
 db.execute('UPDATE studio_projects SET revision=revision+1 WHERE id=?',(alpha,));db.commit();check(event()=='event: refresh','SSE observes new project revision')
 assert owner.req('/api/studio/projects/'+alpha+'/members',{'action':'remove','accountId':ids[1]})[0]==200
 check(event()=='event: revoked','active SSE closes after membership revocation');stream.close()
 check(a.get('messages',channelId=channel)[0]==404,'revoked member cannot read channel history')
 check(a.req('/api/studio/inbox')[1]['tasks']==[],'revoked project removed from My Tasks')
 check(a.req('/api/workspace/files/'+dmfile)[0]==200,'project removal does not change existing DM membership')
 stream2=urllib.request.urlopen(urllib.request.Request(BASE+'/api/studio/live?projectId='+alpha,headers={'Cookie':b.cookie}),timeout=10)
 while not stream2.readline().decode().startswith('event: refresh'):pass
 db.execute('UPDATE workspace_sessions SET expires_at=? WHERE auth_user_id=?',(now-1,ids[2]));db.commit();check(b.req('/api/studio/inbox')[0]==401,'expired session denied across projects');check(b.req('/api/workspace/files/'+dmfile)[0]==401,'expired session cannot download attachment')
 while True:
  line=stream2.readline().decode()
  if line.startswith('event: revoked'):check(True,'active SSE closes on session expiry');break
  if not line:raise AssertionError('Missing revoked event')
 stream2.close()
 print('PASS',checks,'collaboration workflow checks')
finally:
 # R2 deletion is intentionally through authorized pending API; bound fixture blobs are local-only.
 for table,col in [('studio_files','uploaded_by'),('studio_reactions','account_id'),('studio_reads','account_id'),('studio_notifications','recipient_id'),('studio_task_comments','account_id'),('studio_tasks','created_by'),('studio_messages','sender_id'),('studio_activity','actor_id'),('studio_project_members','added_by'),('studio_channels','created_by'),('studio_projects','created_by'),('studio_admins','account_id'),('direct_messages','sender_id'),('direct_conversation_participants','member_id'),('message_reads','member_id')]:db.execute('DELETE FROM '+table+' WHERE '+col+' LIKE ?',(prefix+'%',))
 db.execute('DELETE FROM direct_conversations WHERE pair_key LIKE ?',(prefix+'%',));db.execute('DELETE FROM workspace_sessions WHERE auth_user_id LIKE ?',(prefix+'%',));db.execute('DELETE FROM workspace_owners WHERE public_member_id LIKE ?',(prefix+'%',));db.execute('DELETE FROM member_accounts WHERE id LIKE ?',(prefix+'%',));db.execute('DELETE FROM members WHERE id LIKE ?',(prefix+'%',));db.commit();db.close()
