'use client';
import {ja, contributionLabels, formatDate} from '@/lib/critour-ja';

import {useId, useRef, useState} from 'react';
import type {CanvasEntry} from '@/lib/critour-types';

const marks = {
  feedback: {label:contributionLabels.feedback, icon:'▤'},
  completed: {label:contributionLabels.completed, icon:'✓'},
  adopted: {label:contributionLabels.adopted, icon:'★'},
  implemented: {label:contributionLabels.implemented, icon:'⚒'},
};

export function CreativeCanvas({entries}:{entries:CanvasEntry[]}) {
  const heading = useId();
  const selectedHeading = useRef<HTMLHeadingElement>(null);
  const [selected,setSelected] = useState<string>();
  const active = entries.find(entry => entry.id === selected);
  return <section className="cm-card cr-canvas" aria-labelledby={heading}>
    <h2 id={heading}>{ja.canvas}</h2>
    <p>{entries.length ? "色のついたマスを選ぶと、貢献の内容を確認できます。" : "最初はまっさらなキャンバスです。作品づくりに参加すると、少しずつ色がつきます。"}</p>
    {!!entries.length&&<ul className="cr-canvas-key" aria-label="マスの印の意味">
      {Object.entries(marks).map(([kind,mark])=><li key={kind} data-event={kind}><span aria-hidden="true">{mark.icon}</span> {mark.label}</li>)}
    </ul>}
    <div className="cr-canvas-grid">
      {entries.map(entry => <button key={entry.id} type="button" data-event={entry.kind} aria-pressed={selected===entry.id}
        aria-label={marks[entry.kind].label+'：'+entry.title}
        onClick={()=>{setSelected(entry.id);requestAnimationFrame(()=>selectedHeading.current?.focus())}}>
        <span aria-hidden="true">{marks[entry.kind].icon}</span>
      </button>)}
      {Array.from({length:Math.max(0,12-entries.length)},(_,index)=><span className="cr-canvas-empty" key={index} aria-hidden="true"/>)}
    </div>
    <h3 tabIndex={-1} ref={selectedHeading}>{active ? marks[active.kind].label : ja.history}</h3>
    {active&&<div className="cr-canvas-selection">
      <strong>{active.title}</strong>
      {active.detail&&<p className="cr-body">{active.detail}</p>}
      {(active.href||active.listing_id)&&<p><a href={active.href||('/codemate/discover?listing='+encodeURIComponent(active.listing_id!))}>{active.project ? active.project+'を見る' : '貢献を見る'} →</a></p>}
    </div>}
    {!!entries.length&&<details><summary>{ja.history}（最新{entries.length}件）</summary>
      <ul>{entries.map(entry=><li key={entry.id}>
        <strong><span aria-hidden="true">{marks[entry.kind].icon} </span>{marks[entry.kind].label}</strong>
        {' · '}{entry.href?<a href={entry.href}>{entry.title}</a>:entry.title}
        {' · '}<time dateTime={entry.at}>{formatDate(entry.at)}</time>
      </li>)}</ul>
    </details>}
  </section>;
}
