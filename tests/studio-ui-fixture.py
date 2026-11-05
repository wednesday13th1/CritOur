"""Disposable local-only browser QA data. Fixed code below is not a real credential."""
import pathlib,sqlite3,hashlib,sys,datetime
path=next(p for p in pathlib.Path('.wrangler/state/v3/d1/miniflare-D1DatabaseObject').glob('*.sqlite') if p.name!='metadata.sqlite')
db=sqlite3.connect(path);prefix='uiqa_reliability_';alice=prefix+'alice';bob=prefix+'bob';project=prefix+'project';channel=prefix+'general';now=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
if sys.argv[1]=='setup':
 assert not db.execute('SELECT 1 FROM studio_admins').fetchone(),'Refuse to override an existing local admin'
 for id,name in [(alice,'Reliability QA Alice'),(bob,'Reliability QA Bob')]:
  db.execute('INSERT INTO members(id,name,role,visible,created_at,updated_at)VALUES(?,?,?,0,?,?)',(id,name,'QA',now,now))
  db.execute('INSERT INTO member_accounts(id,public_member_id,auth_user_id,display_name,pin_hash,activated_at,created_at,login_code_hash)VALUES(?,?,?,?,?,?,?,?)',(id,id,id,name,'!qa',now,now,hashlib.sha256(b'local-only-reliability-ui-code-20261028-0000').hexdigest()))
 db.execute('INSERT INTO studio_admins(id,account_id,auth_user_id,created_at)VALUES(1,?,?,?)',(alice,alice,now))
 db.execute('INSERT INTO studio_projects(id,name,description,created_by,created_at,updated_at)VALUES(?,?,?,?,?,?)',(project,'Reliability QA','Disposable local fixture. No live team data.',alice,now,now))
 for id in [alice,bob]:db.execute('INSERT INTO studio_project_members(project_id,account_id,added_by,joined_at)VALUES(?,?,?,?)',(project,id,alice,now))
 db.execute('INSERT INTO studio_channels(id,project_id,name,created_by,created_at)VALUES(?,?,?,?,?)',(channel,project,'general',alice,now))
 db.execute('INSERT INTO studio_messages(id,project_id,channel_id,sender_id,content,client_id,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?)',(prefix+'message',project,channel,bob,'UI検証用メッセージ。送信・タスク化を確認します。',prefix+'request',now,now))
 print('Local browser fixture ready:',project)
else:
 for table,col in [('studio_files','uploaded_by'),('studio_reactions','account_id'),('studio_reads','account_id'),('studio_notifications','recipient_id'),('studio_task_comments','account_id'),('studio_tasks','created_by'),('studio_messages','sender_id'),('studio_activity','actor_id'),('studio_project_members','added_by'),('studio_channels','created_by'),('studio_projects','created_by'),('studio_admins','account_id'),('direct_messages','sender_id'),('message_reads','member_id'),('direct_conversation_participants','member_id')]:db.execute('DELETE FROM '+table+' WHERE '+col+' LIKE ?',(prefix+'%',))
 db.execute('DELETE FROM direct_conversations WHERE pair_key LIKE ?',(prefix+'%',));db.execute('DELETE FROM workspace_sessions WHERE auth_user_id LIKE ?',(prefix+'%',));db.execute('DELETE FROM member_accounts WHERE id LIKE ?',(prefix+'%',));db.execute('DELETE FROM members WHERE id LIKE ?',(prefix+'%',));print('Local browser fixture removed')
db.commit();db.close()
