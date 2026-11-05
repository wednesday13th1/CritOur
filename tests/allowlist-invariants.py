"""Migration/trigger invariants, in isolated in-memory SQLite; never touches production."""
import sqlite3,pathlib
connection=sqlite3.connect(':memory:');connection.execute('PRAGMA foreign_keys=ON')
for migration in sorted(pathlib.Path('drizzle').glob('*.sql')):connection.executescript(migration.read_text())
at='2026-10-25T00:00:00Z'
for m in ['a','b','c']:
 connection.execute('INSERT INTO members(id,name,role,created_at,updated_at)VALUES(?,?,?,?,?)',(m,m,'QA',at,at))
 connection.execute('INSERT INTO allowed_emails(email,public_member_id,created_at,updated_by)VALUES(?,?,?,?)',(m+'@example.test',m,at,'test'))
for m in ['a','b']:
 connection.execute('INSERT INTO member_accounts(id,public_member_id,auth_user_id,email,display_name,pin_hash,activated_at,created_at)VALUES(?,?,?,?,?,?,?,?)',(m,m,'supabase:'+m,m+'@example.test',m,'salted-hash-fixture',at,at))
 connection.execute("INSERT INTO workspace_sessions(token_hash,auth_user_id,purpose,version,verified_at,expires_at)VALUES(?,?,'admin',1,1,9999999999999)",(m,'supabase:'+m))
connection.execute("UPDATE allowed_emails SET disabled_at=?,updated_by='a' WHERE email='b@example.test'",(at,))
assert not connection.execute("SELECT 1 FROM workspace_sessions WHERE auth_user_id='supabase:b'").fetchone()
assert connection.execute("SELECT 1 FROM audit_logs WHERE action='allowlist.revoke' AND resource='b@example.test'").fetchone()
def must_fail(sql,args=()):
 try:connection.execute(sql,args)
 except sqlite3.DatabaseError:return
 raise AssertionError('Must reject: '+sql)
must_fail("UPDATE allowed_emails SET disabled_at=? WHERE email='a@example.test'",(at,)) # c is unactivated
must_fail("DELETE FROM audit_logs")
must_fail("UPDATE audit_logs SET action='forged'")
must_fail("DELETE FROM allowed_emails WHERE email='b@example.test'")
must_fail("UPDATE allowed_emails SET public_member_id='c' WHERE email='a@example.test'")
must_fail("INSERT INTO workspace_bootstrap(id)VALUES(1)")
connection.execute("UPDATE allowed_emails SET disabled_at=NULL,updated_by='a' WHERE email='b@example.test'")
assert connection.execute("SELECT count(*) FROM workspace_sessions WHERE auth_user_id='supabase:b'").fetchone()[0]==0
print('PASS migrations, immutable audit, atomic revocation, last activated Admin guard, immutable identity mapping, bootstrap guard, no restored sessions')
