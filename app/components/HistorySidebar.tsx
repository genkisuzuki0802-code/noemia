"use client";

import type { HistorySession } from "../lib/history";

type Props = {
  sessions: HistorySession[];
  currentId: string | null;
  open: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
};

function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);

  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}時間前`;

  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}日前`;

  const date = new Date(ts);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function HistorySidebar({
  sessions,
  currentId,
  open,
  onSelect,
  onDelete,
  onNew,
  onClose,
}: Props) {
  return (
    <>
      {open && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
        />
      )}

      <aside className={`history-sidebar${open ? " open" : ""}`}>
        <div className="history-header">
          <span className="history-brand">Noemia</span>

          <button
            className="history-close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <button className="history-new" onClick={onNew}>
          ＋ 新しい意図
        </button>

        <div className="history-list">
          {sessions.length === 0 && (
            <div className="history-empty">
              まだ履歴がありません。
              意図を整理すると、ここに保存されていきます。
            </div>
          )}

          {sessions.map((session) => (
            <div
              key={session.id}
              className={`history-item${
                session.id === currentId ? " active" : ""
              }`}
              onClick={() => onSelect(session.id)}
            >
              <div className="history-item-main">
                <div className="history-item-title">
                  {session.title}
                </div>

                <div className="history-item-time">
                  {relativeTime(session.updatedAt)}
                </div>
              </div>

              <button
                className="history-item-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(session.id);
                }}
                aria-label="この履歴を削除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
