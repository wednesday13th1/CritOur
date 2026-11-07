"""Real HTTP against isolated local D1. Never points to production.
Run after starting CODEMATE_LOCAL_PREVIEW=1 on 127.0.0.1:5181.
The legacy suite provisions disposable accounts and validates existing behavior first.
"""
import runpy,sqlite3,uuid,concurrent.futures
x=runpy.run_path('tests/codemate-mvp.py')
a,b,outsider=x['a'],x['b'],x['outsider']
check,good,key=x['check'],x['good'],x['key']
project,sid=x['project'],x['sid']
c=sqlite3.connect(x['DB'],timeout=20)
c.executescript((x['ROOT']/'plans/critour-collaboration.sql').read_text())
# Undo only the disposable block made by the legacy test, then test an unrelated viewer.
c.execute('DELETE FROM cm_showcase_blocks WHERE account_id=? AND blocked_id=?',(x['outsider_id'],x['manager']));c.commit();c.close()
good(x['showpost'](a,'visibility',id=sid,visible=True))
def post(client,action,**kw):return client.request('/api/critour',dict(action=action,**kw))
def read(client):return client.request('/api/critour?listing='+sid)
check(x['Client']().request('/api/critour')[0]==401,'anonymous cannot access collaboration')
check(post(b,'request.create',listingId=sid,title='No',instructions='No',kind='test',minutes=5,difficulty='beginner',clientId=key())[0]==403,'nonowner cannot publish requests')
args=dict(listingId=sid,title='Try the first screen',instructions='Open the preview, try one button, and explain one improvement.',kind='test',minutes=5,difficulty='beginner',noCode=True,clientId=key())
r=good(post(a,'request.create',**args))['id']
check(good(post(a,'request.create',**args))['id']==r,'request retry is idempotent')
check(any(t['id']==r and t['minutes']==5 and t['no_code'] for t in good(read(b))['requests']),'B discovers beginner request with time and concrete steps')
check(post(a,'submit',requestId=r,body='Self',kind='idea',clientId=key())[0]==403,'owner cannot award their own contribution')
payload=dict(requestId=r,body='The next button is hard to find. Make its label clearer.',kind='improve',clientId=key())
cid=good(post(b,'submit',**payload))['id']
check(good(post(b,'submit',**payload))['id']==cid,'identical contribution retry returns original')
check(post(b,'submit',**dict(payload,body='Different'))[0]==409,'duplicate contribution rejected')
check(not good(b.request('/api/critour'))['impact'],'submitted work is not portfolio impact')
check(post(b,'review',contributionId=cid,version=1)[0]==403,'contributor cannot approve themselves')
check(post(a,'implement',contributionId=cid,version=1,improvement='Too early')[0]==409,'cannot implement before adoption')
good(post(a,'review',contributionId=cid,version=1))
check(post(a,'adopt',contributionId=cid,version=1)[0]==409,'stale review rejected')
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 results=list(pool.map(lambda _:post(a,'adopt',contributionId=cid,version=2),range(2)))
check(sorted(v[0] for v in results)==[200,409],'concurrent adoption has one winner')
check(good(b.request('/api/critour'))['impact'][0]['status']=='adopted','adoption appears in B portfolio')
check(post(a,'implement',contributionId=cid,version=3,improvement=' ')[0]==400,'implementation requires real improvement description')
good(post(a,'implement',contributionId=cid,version=3,improvement='Renamed the button to Continue and increased its contrast.'))
impact=good(b.request('/api/critour'))['impact']
check(impact[0]['status']=='implemented' and 'contrast' in impact[0]['improvement'],'image-free improvement appears in B impact')
history=good(read(b))['history'];check([h['status'] for h in history if h['contribution_id']==cid]==['submitted','reviewed','adopted','implemented'],'approval history retains complete progression')
check(not good(read(outsider))['contributions'],'third user cannot read private submissions')
reply=dict(contributionId=cid,body='Thank you for the clear suggestion.',clientId=key())
good(post(a,'reply',**reply));good(post(a,'reply',**reply))
check(len(good(read(b))['replies'])==1,'reply retry does not duplicate')
updates=good(b.request('/api/critour'))['notifications'];check(len({n['id'] for n in updates})==len(updates),'notifications have unique event identity')
n=updates[0];good(post(b,'notification.read',id=n['id']))
check(next(v for v in good(b.request('/api/critour'))['notifications'] if v['id']==n['id'])['read_at'],'read state persists')
check(post(b,'request.close',requestId=r,status='completed')[0]==403,'only the project owner can complete a request')
check(not any(item['kind']=='completed' for item in good(read(b))['canvas']),'pending closure gives no completion cell')
good(post(a,'request.close',requestId=r,status='completed'))
cells={item['id']:item['kind'] for item in good(b.request('/api/critour'))['canvas']}
check(all(cells.get(event+':'+(r if event=='completed' else cid))==event for event in ['feedback','adopted','implemented','completed']),'four persisted event types appear on contributor profile')
check(not good(read(outsider))['canvas'],'outsider canvas does not expose private contribution records')
check(post(outsider,'submit',requestId=r,body='Late contribution',kind='idea',clientId=key())[0]==409,'completed request refuses new submissions')
args['clientId']=key();args['title']='Cancelled task';r2=good(post(a,'request.create',**args))['id']
good(post(a,'request.close',requestId=r2,status='cancelled'))
check(post(b,'submit',requestId=r2,body='Late contribution',kind='idea',clientId=key())[0]==409,'cancelled request refuses submissions')
# A one-off contributor is never enrolled into project membership.
check(outsider.request('/api/codemate?projectId='+project)[0]==404,'discovery never grants team membership')
comment=dict(id=sid,kind='idea',body='A short and useful suggestion.',clientId=key())
good(x['showpost'](b,'comment',**comment));good(x['showpost'](b,'comment',**comment))
check(x['showpost'](b,'comment',**(comment|{'clientId':key()}))[0]==409,'same feedback with a different key cannot add a cell')
comments=good(b.request('/api/codemate/showcase?id='+sid))['comments']
check(sum(v['body']==comment['body'] for v in comments)==1,'showcase feedback retries do not duplicate')
source=next(v['id'] for v in comments if v['body']==comment['body'])
promoted=good(post(a,'feedback.promote',listingId=sid,commentId=source))['id']
check(good(post(a,'feedback.promote',listingId=sid,commentId=source))['id']==promoted,'existing feedback links idempotently to the contribution flow')
linked=next(v for v in good(read(b))['contributions'] if v['id']==promoted)
check(linked['body']==comment['body'] and linked['author_id'].startswith('cm_local_yuki_'),'linked feedback keeps its original text and author')
good(post(a,'review',contributionId=promoted,version=1));good(post(a,'adopt',contributionId=promoted,version=2));good(post(a,'implement',contributionId=promoted,version=3,improvement='Recorded an improvement based on existing feedback.'))
check(post(a,'impact.publish',listingId=sid,contributionId=promoted,published=True,confirm=True)[0]==409,'legacy feedback is not automatically made public through an Impact Card')
for path in ['/codemate','/codemate/create','/codemate/profile','/codemate/discover?listing='+sid]:check(a.request(path)[0]==200,'page renders: '+path)
print('PASS CritOur full two-user HTTP/D1 flow; no production data used')
