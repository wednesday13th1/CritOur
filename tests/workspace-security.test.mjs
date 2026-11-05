import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
async function load(path){const {outputText}=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}});return import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));}
const {hashPin,verifyPin,validPin,digest}=await load('../lib/workspace-security.ts');
const {sanitizeHtml}=await load('../lib/sanitize-html.ts');
test('4-digit PIN rules and confirmation primitives',()=>{for(const pin of ['0000','1111','1234','4321','2580','12','abcd','１２３４',1234])assert.equal(validPin(pin),false);assert.equal(validPin('7395'),true)});
test('PIN hashes are salted and reject a wrong PIN',async()=>{const a=await hashPin('7395'),b=await hashPin('7395');assert.notEqual(a,b);assert.ok(!a.includes('7395'));assert.equal(await verifyPin('7395',a),true);assert.equal(await verifyPin('7396',a),false);assert.equal(await verifyPin('7395','bad'),false);assert.equal((await digest('invitation')).length,64)});
test('HTML output retains formatting and removes active content',()=>{const value=sanitizeHtml('<h2>Hello</h2><script>alert(1)</script><img src="https://example.com/a.png" onerror="alert(1)"><a href="javascript:alert(1)">x</a><svg onload="alert(1)"></svg><a href="https://example.com">link</a>');assert.ok(value.includes('<h2>Hello</h2>'));assert.ok(!/script|onerror|onload|javascript|svg/.test(value));assert.ok(value.includes('href="https://example.com"'));assert.ok(!sanitizeHtml('<a href="https://x.com/&#34;onmouseover=alert(1)">x</a>').includes('href'));});
