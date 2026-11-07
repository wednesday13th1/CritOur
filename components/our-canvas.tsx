"use client";
import {formatDate} from '@/lib/critour-ja';

import { useId, useState } from "react";

type Cell = {
  slot: number;
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assigneeIds: string[];
};

const artwork = [
  "001100", "012210", "123321", "123321", "012210", "001100",
].join("");
const colors = ["#284659", "#477c82", "#e9a76f", "#f6d593"];
const labels: Record<string, string> = { todo: "未着手", in_progress: "取り組み中", done: "完了" };

export function OurCanvas({ cells, people, goal }: {
  cells: Cell[];
  people: { id: string; display_name: string }[];
  goal: string;
}) {
  const heading = useId();
  const [selected, setSelected] = useState<number | null>(null);
  const slots = new Map(cells.map(cell => [cell.slot, cell]));
  const detail = selected === null ? undefined : slots.get(selected);

  return (
    <section className="cm-card cm-canvas" aria-labelledby={heading}>
      <h2 id={heading}>チームのキャンバス</h2>
      <p>{goal || "次の制作目標を決めて、彩りたいタスクを選ぼう。"}</p>
      <p role="status">{cells.filter(cell => cell.status === "done").length} / {cells.length} 件完了</p>
      <div className="cm-canvas-grid" role="group" aria-label="6行6列のキャンバス">
        {Array.from({ length: 36 }, (_, slot) => {
          const cell = slots.get(slot);
          if (!cell) return <span key={slot} aria-hidden="true" />;
          const done = cell.status === "done";
          return (
            <button
              key={slot}
              type="button"
              aria-label={`マス ${slot + 1}、${cell.title}、${labels[cell.status]}`}
              aria-pressed={selected === slot}
              style={done ? { backgroundColor: colors[Number(artwork[slot])] } : undefined}
              onClick={() => setSelected(slot)}
            >
              <span aria-hidden="true">{done ? "✓" : "○"}</span>
            </button>
          );
        })}
      </div>
      <div aria-live="polite" className="cm-canvas-detail">
        {detail ? (
          <p><strong>{detail.title}</strong><br />
            {labels[detail.status]} · {detail.assigneeIds.map(id => people.find(person => person.id === id)?.display_name ?? "メンバー").join("・") || "担当未定"}
            {" · "}{detail.due_date ? `期限 ${formatDate(detail.due_date)}` : "期限なし"}
          </p>
        ) : <p>マスを選ぶと、対応するタスクを確認できます。</p>}
      </div>
    </section>
  );
}
