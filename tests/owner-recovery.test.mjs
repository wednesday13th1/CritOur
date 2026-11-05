import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';import {spawnSync} from 'node:child_process';
registerHooks({resolve(s,c,next){if(s==='./workspace-security'&&c.parentURL?.endsWith('/owner-recovery.ts'))return next(new URL('../lib/workspace-security.ts',import.meta.url).href,c);return next(s,c)}});
const {recoveryConfig,rotateRecoveredOwner}=await import('../lib/owner-recovery.ts');
const now=Date.now(),hash='a'.repeat(64),config={memberId:'owner-id',expectedCodeHash:hash,authorizationHash:'c'.repeat(64),expiresAt:now+600000};
test('recovery fails closed unless exact short-lived configuration is supplied',()=>{assert.deepEqual(recoveryConfig(JSON.stringify(config),now),config);for(const c of [null,'{}','broken',JSON.stringify({...config,expiresAt:now}),JSON.stringify({...config,expiresAt:now+900001}),JSON.stringify({...config,expectedCodeHash:'bad'})])assert.equal(recoveryConfig(c,now),null)});
test('SQLite transaction consumes recovery once, invalidates sessions, preserves identity and rejects nonowners/Google/disabled accounts',async()=>{
 const statements=[];const db={prepare(sql){return {bind(...args){const stmt={sql,args};return stmt}}},async batch(writes){statements.push(...writes);return [{meta:{changes:1}}]}};
 const token=await rotateRecoveredOwner(db,config);assert.equal(token.length,72);await rotateRecoveredOwner(db,config);
 const result=spawnSync('/usr/bin/python3',['-c',`
import json,sqlite3,sys
groups=json.loads(sys.stdin.read());s=groups[:3];retry=groups[3:];db=sqlite3.connect(':memory:')
db.executescript("CREATE TABLE member_accounts(public_member_id TEXT,auth_user_id TEXT,login_code_hash TEXT,session_version INTEGER,disabled_at INTEGER); CREATE TABLE workspace_owners(public_member_id TEXT); CREATE TABLE workspace_sessions(auth_user_id TEXT); CREATE TABLE audit_logs(id TEXT,actor_id TEXT,actor_name TEXT,action TEXT,resource TEXT,created_at TEXT);")
old='a'*64;db.execute('INSERT INTO workspace_owners VALUES(?)',('owner-id',))
def seed(auth='stable-auth-id',disabled=None,owner=True):
 db.execute('DELETE FROM member_accounts');db.execute('DELETE FROM workspace_sessions');db.execute('DELETE FROM audit_logs');db.execute('DELETE FROM workspace_owners');
 if owner:db.execute('INSERT INTO workspace_owners VALUES(?)',('owner-id',))
 db.execute('INSERT INTO member_accounts VALUES(?,?,?,?,?)',('owner-id',auth,old,4,disabled));db.execute('INSERT INTO workspace_sessions VALUES(?)',(auth,));db.commit()
def run(writes=None):
 with db:
  results=[]
  for st in (s if writes is None else writes):results.append(db.execute(st['sql'],st['args']).rowcount)
 return results
seed();assert run()==[1,1,1];assert db.execute('SELECT auth_user_id,session_version FROM member_accounts').fetchone()==('stable-auth-id',5);assert run(retry)==[0,0,0];assert db.execute('SELECT count(*) FROM audit_logs').fetchone()[0]==1
for args in [('stable-auth-id',None,False),('google:verified-sub',None,True),('stable-auth-id',123,True)]:
 seed(*args);assert run(retry)==[0,0,0];assert db.execute('SELECT count(*) FROM workspace_sessions').fetchone()[0]==1
print('PASS owner CAS recovery invariants')
`],{input:JSON.stringify(statements),encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/PASS/);
});
