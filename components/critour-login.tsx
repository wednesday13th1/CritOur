'use client';
import {DisplayPreferences} from './critour-accessibility';
import {ja} from '@/lib/critour-ja';
import Link from 'next/link';
import {useState} from 'react';
import {CodeLogin} from './code-login';
const errors:Record<string,string>={setup:"このログイン方法は準備中です。以前の方法でログインできます。",state:"ログイン用のリンクが無効か、期限が切れています。もう一度お試しください。",cancelled:"ログインを取り消しました。下書きはこのタブに残っています。",authentication:"ログインできませんでした。入力した内容は削除されていません。もう一度お試しください。",reauthenticate:"アカウントを連携するには、もう一度ログインしてください。"};
export function CritourLogin({ready,returnTo,error}:{ready:{google:boolean;github:boolean};returnTo:string;error?:string}){
 const [busy,setBusy]=useState('');
 return <main className="cr-auth cm-root"><section className="cr-auth-card"><DisplayPreferences/><Link className="cr-auth-brand" href="/codemate">⌘ CritOur</Link><h1>CritOurへようこそ</h1><p>ひとりで作り、みんなで育てる。</p><div className="cr-auth-buttons">{(['google','github'] as const).map(provider=><form key={provider} method="post" action={'/api/auth/oauth/'+provider+'/start'} onSubmit={()=>setBusy(provider)}><input type="hidden" name="returnTo" value={returnTo}/><button disabled={!ready[provider]||!!busy} aria-describedby={!ready[provider]?'oauth-setup':undefined}><span aria-hidden="true">{provider==='google'?'G':'⌘'}</span>{busy===provider?"接続しています…":(provider==='google'?'Google':'GitHub')+'で'+ja.signIn}</button></form>)}</div><p className="cr-auth-note">新規登録もログインも、同じボタンから始められます。GitHub上のコードへのアクセスは求めません。</p>{(!ready.google||!ready.github)&&<p id="oauth-setup" role="status">一部のログイン方法は準備中です。今までの方法でログインできます。</p>}{error&&<p className="cm-error" role="alert">{errors[error]||errors.authentication}</p>}{busy&&<p role="status">ログイン画面を開いています…</p>}<details className="cr-legacy-login"><summary>すでにアカウントをお持ちの方</summary><p>作品や貢献の履歴を引き継ぐには、まずお持ちのコードでログインし、マイページでGoogleまたはGitHubを連携してください。メールアドレスが同じでもアカウントは統合されません。</p><CodeLogin embedded destination={returnTo} title="お持ちのアカウントでログイン"/></details><Link href="/explore">作品を探す →</Link></section></main>;
}
