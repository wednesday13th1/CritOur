export function FirstStepLearning({ heading = "どうやって作るのか見てみる" }: { heading?: string }) {
  return <details className="cr-first-learning">
    <summary>{heading}</summary>
    <p>ボタンに書かれた言葉を変えるだけでも、アプリは使いやすくなります。</p>
    <pre><code>{"<button>アイデアを保存</button>"}</code></pre>
    <p>二つのタグの間に書いた言葉が、ボタンに表示されます。「アイデアを保存」なら、押すと何が起きるか伝わります。</p>
    <a href="/codemate/create">自分でもつくってみる →</a>
  </details>;
}
