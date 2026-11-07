import Link from 'next/link';

export default function NotFound() {
  return <main style={{maxWidth:640,margin:'64px auto',padding:'0 24px'}}>
    <h1>ページが見つかりません</h1>
    <p>ページが移動したか、公開が終了した可能性があります。</p>
    <Link href="/">ホームへ戻る</Link>
  </main>;
}
