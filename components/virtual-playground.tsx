"use client";

import { useRef, useState } from "react";

type Build = {
  title: string;
  version_label: string;
  platform?: "web" | "ios" | "game";
  kind: "web" | "ios";
  device?: string;
  preview_url?: string;
  recording_url?: string;
  commit_url?: string;
};

const widths = { Desktop: "100%", Tablet: "768px", Mobile: "390px" };

export function VirtualPlayground({ build, screenshot }: { build: Build; screenshot?: string }) {
  const platform = build.platform ?? build.kind;
  const game = platform === "game";
  const [size, setSize] = useState<keyof typeof widths>("Desktop");
  const [opened, setOpened] = useState(false);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const frame = useRef<HTMLDivElement>(null);
  return (
    <section className="cm-preview cm-virtual">
      <header>
        <div><strong>Virtual Playground</strong><br />{build.title} · {build.version_label} · {platform.toUpperCase()}</div>
        {build.commit_url && <a href={build.commit_url} target="_blank" rel="noreferrer">対応するGitHubの変更</a>}
      </header>
      {build.preview_url ? <>
        <div className="cm-buttons cm-virtual-tools" role="group" aria-label="プレビュー操作">
          {(Object.keys(widths) as (keyof typeof widths)[]).map(mode => (
            <button key={mode} aria-pressed={size === mode} onClick={() => setSize(mode)}>{mode}</button>
          ))}
          {opened && <button onClick={() => setRevision(value => value + 1)}>{game ? "最初から遊ぶ" : "再読み込み"}</button>}
          {opened && <button onClick={async () => {
            try { await frame.current?.requestFullscreen(); setMessage(""); }
            catch { setMessage("全画面を利用できません。別タブでお試しください。"); }
          }}>全画面</button>}
          <a href={build.preview_url} target="_blank" rel="noopener noreferrer">別タブで開く ↗</a>
          {screenshot && <a href={screenshot} download>共有画像を保存</a>}
        </div>
        {game && <p className="cm-preview-note">キーボードやマウスを使う作品があります。スマートフォンで動かない場合はPCでお試しください。</p>}
        <div ref={frame} className="cm-virtual-frame" style={{ maxWidth: widths[size] }}>
          {opened ? <iframe
            key={revision}
            title={build.title + "のプレビュー"}
            src={build.preview_url}
            sandbox="allow-scripts allow-forms"
            referrerPolicy="no-referrer"
            allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'"
          /> : <div className="cm-preview-start"><button className="cm-primary" onClick={() => setOpened(true)}>
            {game ? "ゲームを遊ぶ" : "プレビューを開く"}
          </button></div>}
        </div>
        <p className="cm-preview-note">表示されない場合は、サイト側で埋め込みが制限されていることがあります。「別タブで開く」をお試しください。</p>
        {message && <p role="status">{message}</p>}
      </> : <>
        <div className="cm-preview-start">
          <h3>{build.device || "iPhone"}の実行記録</h3>
          <p>Simulator connection required — リモートSimulatorの操作はComing Soon。</p>
          {screenshot && <img src={screenshot} alt={build.title + "のスクリーンショット"} />}
          {build.recording_url && <video controls preload="none" src={build.recording_url} aria-label={build.title + "の画面録画"} />}
          {screenshot && <a href={screenshot} download>共有画像を保存</a>}
        </div>
      </>}
    </section>
  );
}
