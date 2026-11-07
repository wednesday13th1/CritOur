"""Build → Share → Join → Improve → Share Again, against isolated localhost only."""
import runpy,uuid,json,urllib.parse
z=runpy.run_path('tests/critour-flow.py');x=z['x']
a,b=x['a'],x['b'];check,good,key=x['check'],x['good'],x['key'];sid=x['sid'];anon=x['Client']()
post=z['post']
check(post(b,'publication.save',listingId=sid,published=True,confirm=True)[0]==403,'nonowner cannot create public Build Card')
check(post(a,'publication.save',listingId=sid,published=True,creatorLabel='Local QA creator')[0]==400,'public sharing requires explicit owner confirmation')
path=good(post(a,'publication.save',listingId=sid,published=True,creatorLabel='Local QA creator',confirm=True))['path'];token=path.split('/')[-1]
page=anon.request(path)
check(page[0]==200 and 'この作品に参加する'.encode() in page[1],'anonymous visitor can read Build Card')
html=page[1].decode();check('og:image' in html and 'summary_large_image' in html,'Build Card has Open Graph and Twitter metadata')
check('cm_local_manager' not in html and 'pin_hash' not in html and 'Local QA creator' in html,'Build Card exposes curated public fields only')
og=anon.request('/api/public/'+token+'/og');check(og[0]==200 and og[2].get('Content-Type','').startswith('image/png') and og[1][:8]==b'\x89PNG\r\n\x1a\n','real 1200x630 PNG Open Graph generated')
check(anon.request('/api/public/'+token+'/image')[0]==200,'explicitly published screenshot accessible anonymously')
args=dict(listingId=sid,title='A fresh visitor contribution',instructions='Try the screen and share one small improvement.',kind='idea',minutes=3,difficulty='beginner',noCode=True,clientId=key())
r=good(post(a,'request.create',**args))['id'];
updates=good(b.request('/api/critour'))['notifications'];check(sum(n['kind']=='request' for n in updates)>=1,'new task notification reaches existing collaborator')
payload=dict(requestId=r,body='Make the main action easier to spot.',kind='idea',clientId=key())
check(post(anon,'submit',**payload)[0]==401,'anonymous visitor must authenticate to submit')
# Exercise the actual existing sign-in endpoint rather than a forged session.
login=anon.request('/api/workspace/code',dict(username=x['tester_name'],code=x['CODE']))
check(login[0]==200 and login[2].get('Set-Cookie'),'B signs in through the existing authentication endpoint')
b=x['Client'](login[2]['Set-Cookie'].split(';')[0]);visitor=str(uuid.uuid4())
def event(name):return anon.request('/api/critour/events',dict(event=name,token=token,eventId=str(uuid.uuid4()),visitor=visitor,source='share'))
good(event('project_viewed'));good(event('collaboration_started'))
cid=good(post(b,'submit',**payload,analytics=dict(visitor=visitor,source='share')))['id']
check(post(a,'impact.publish',listingId=sid,contributionId=cid,published=True,confirm=True)[0]==409,'unimplemented work cannot become an Impact Card')
good(post(a,'review',contributionId=cid,version=1));good(post(a,'adopt',contributionId=cid,version=2));good(post(a,'implement',contributionId=cid,version=3,improvement='Changed the main action label and contrast after the suggestion.'))
impact=good(post(a,'impact.publish',listingId=sid,contributionId=cid,published=True,confirm=True))['path'];itoken=impact.split('/')[-1]
check('公開された改善'.encode() in anon.request(path)[1] and b'Make the main action easier to spot.' not in anon.request(path)[1],
      'public Canvas only shows explicitly published impacts')
card=anon.request(impact);check(card[0]==200 and 'CritOurの参加者'.encode() in card[1],'Impact Card hides contributor identity by default')
check(b'Changed the main action' in card[1] and '>改善前<'.encode() in card[1] and '>あなたのアイデア<'.encode() in card[1] and '改善後・変わったところ'.encode() in card[1],'Impact Card shows real linked before/feedback/after record')
good(post(b,'profile.visibility',showName=True,label='QA Public Alias'))
check(b'QA Public Alias' in anon.request(impact)[1],'contributor can opt in to public alias')
good(post(b,'profile.visibility',showName=False,label='QA Public Alias'))
check(b'QA Public Alias' not in anon.request(impact)[1],'revoking public name immediately removes alias')
check(anon.request('/api/impact/'+itoken+'/og')[0]==200,'Impact Open Graph PNG renders')
check(itoken in anon.request(path)[1].decode(),'project page links to implemented impact')
check(anon.request('/explore')[0]==200 and path.encode() in anon.request('/explore')[1],'anonymous discovery includes only explicit public cards')
check('一緒に、何かをつくろう。'.encode() in anon.request('/')[1] and '気になる作品を見つけて'.encode() in anon.request('/')[1],'anonymous landing explains CritOur without sign-in')
listing=next(v for v in good(a.request('/api/codemate/showcase?project='+x['project']))['listings'] if v['id']==sid)
tag='GalleryTag'+uuid.uuid4().hex[:8]
good(x['showpost'](a,'draft',id=sid,projectId=x['project'],title=listing['title'],description=listing['description'],
     category='web',stage=listing['stage'],seeking=True,tags=[tag],focusX=25,focusY=70))
matched=anon.request('/explore?q='+tag+'&category=web&beginner=1&tasks=1&feedback=1&sort=new')
check(matched[0]==200 and path.encode() in matched[1] and b'25% 70%' in matched[1],'tag search combines with category, all filters, and saved cover crop')
check(path.encode() not in anon.request('/explore?q='+tag+'&category=design')[1],'category excludes a tag match')
blank=next(v for v in good(a.request('/api/codemate/showcase?project='+x['project']))['listings'] if v['title'].startswith('Edited gallery'))
long_title='画像なしの作品'+'長い作品名'*17
good(x['showpost'](a,'draft',id=blank['id'],projectId=x['project'],title=long_title,description=blank['description'],category='design',stage='ready')
     )
blank_path=good(post(a,'publication.save',listingId=blank['id'],published=True,confirm=True))['path']
blank_card=anon.request('/explore?q='+urllib.parse.quote('画像なしの作品')+'&category=design')
check(blank_card[0]==200 and blank_path.encode() in blank_card[1] and long_title.encode() in blank_card[1] and b'cr-gallery-placeholder' in blank_card[1],
      'long title and image-free design work are discoverable')
check(anon.request('/team')[0]==200,'original CMS homepage remains available')
check(good(b.request('/api/critour'))['impact'][0].get('shareToken')==itoken,'B portfolio includes shareable implemented impact')
metrics=good(a.request('/api/critour?analytics='+sid));check(metrics['cohort'] is None,'small analytics cohorts suppressed')
check(b.request('/api/critour?analytics='+sid)[0]==403,'only project owner sees analytics')
check(anon.request('/api/critour/events',dict(event='contribution_accepted',token=token,eventId=str(uuid.uuid4()),visitor=visitor,source='share'))[0]==400,'client cannot forge server acceptance metrics')
check(anon.request('/codemate/login?returnTo=https://evil.example')[0]==200,'external return URL does not redirect login')
good(post(a,'publication.save',listingId=sid,published=False))
check(anon.request(path)[0]==404 and anon.request('/api/public/'+token+'/image')[0]==404 and anon.request(impact)[0]==404 and anon.request('/api/impact/'+itoken+'/og')[0]==404,'unpublish revokes Build, screenshot, Impact and OG access')
good(post(a,'publication.save',listingId=sid,published=True,creatorLabel='Local QA creator',confirm=True))
build_args=dict(title='Text-only growth update',versionLabel='Growth '+key()[:8],summary='A real local QA build record without an image.',previewUrl='https://mdn.github.io/dom-examples/',clientId=key())
good(a.post('build.create',x['project'],**build_args))
check(any(n['kind']=='project' for n in good(b.request('/api/critour'))['notifications']),'project update reaches collaborators without exposing private data')
# Mature, disposable analytics cohorts exercise SQL definitions without pretending they are real users.
import sqlite3,time
conn=sqlite3.connect(x['DB']);now=int(time.time()*1000);day=86400000
for i in range(5):
 visitor_id='qa-mature-'+str(uuid.uuid4())
 for label,when in [('project_viewed',now-40*day),('project_viewed',now-33*day),('project_viewed',now-10*day),('contribution_submitted',now-40*day+120000)]:
  conn.execute('INSERT INTO cr_analytics VALUES(?,?,?,?,?,?)',(str(uuid.uuid4()),label,visitor_id,sid,'share',when))
conn.commit()
summary=good(a.request('/api/critour?analytics='+sid))['cohort']
check(summary['eligible7']>=5 and summary['retained7']>=5 and summary['eligible30']>=5 and summary['retained30']>=5,'D7 and D30 SQL counts mature returning cohorts')
conn.execute("DELETE FROM cr_analytics WHERE visitor LIKE 'qa-mature-%'");conn.commit();conn.close()
print('PASS growth loop with actual existing sign-in and anonymous public cards')
print(json.dumps({'projectPath':path,'impactPath':impact,'tester':x['tester_name'],'listing':sid},ensure_ascii=False))
