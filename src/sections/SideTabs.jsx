import { useState } from 'react'
import '../nav.css'
import { t } from '../text.js'
import { HOME, toHash } from '../route.js'

// 縦タブ。畳んだ状態は ☰ だけ。☰ にマウスを乗せると開く（帯のほかの場所では開かない）。開いたあとは、パネル全体（☰ の位置も含む）の中にある間は開いたまま、
// 外へ出ると畳む。☰ を押すと開いたまま固定（もう一度で解除）。固定したかどうかは覚えない。
// キーボードで移動したとき（:focus-visible）も開く。マウスで押したあとのフォーカスでは開かない（離せば畳む）。移動は a（# の移動）
export default function SideTabs({ entry, currentTab, onOpenPanel }) {
  const [pinned, setPinned] = useState(false)
  const [hover, setHover] = useState(false)
  const [kbFocus, setKbFocus] = useState(false)
  const open = pinned || hover || kbFocus

  return (
    <aside
      className={`sidetabs${pinned ? ' pinned' : ''}`}
      onMouseLeave={() => setHover(false)} // aside の子孫（☰ とパネル）の外へ出たときだけ発火する
      onFocus={(e) => { if (e.target.matches(':focus-visible')) setKbFocus(true) }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setKbFocus(false) }}
    >
      <button type="button" className="toggle" aria-label={t('nav.menu')} aria-expanded={open} aria-pressed={pinned} onMouseEnter={() => setHover(true)} onClick={() => setPinned((p) => !p)}>☰</button>
      {open && (
        <div className="panel">
          <nav>
            {entry.groups.map((g) => (
              <section key={g.label}>
                <h3>{t(g.label)}</h3>
                <ul>
                  {g.tabs.map((tb) => (
                    <li key={tb.id}>
                      <a href={toHash({ entry: entry.id, tab: tb.id, detailId: null })} aria-current={tb.id === currentTab ? 'page' : undefined}>{t(tb.label)}</a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
          <div className="bottom">
            <button type="button" onClick={() => onOpenPanel('save')}>{t('save.title')}</button>
            <button type="button" onClick={() => onOpenPanel('load')}>{t('save.load')}</button>
            <a href={toHash(HOME)}>{t('nav.toHome')}</a>
          </div>
        </div>
      )}
    </aside>
  )
}
