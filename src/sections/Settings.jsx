import { useState } from 'react'
import './settings.css'
import CardSettings from './CardSettings.jsx'
import DataSettings from './DataSettings.jsx'
import SaveSettings from './SaveSettings.jsx'
import { t, LANGUAGES } from '../text.js'
import { useConfirm } from './ConfirmDialog.jsx'
import { BALANCE_VIEWS, BALANCE_VIEW_LABELS, loadBalanceView, rememberBalanceView } from '../storage.js'
import {
  entryAccountOptions, groupByType, favoriteStats, addFavorite, removeFavorite, moveFavorite,
  validateFavoriteLimit, setFavoriteLimit, CURRENCIES, setCurrency, renameRows, applyRenames,
} from '../ledgerLogic.js'
import { today } from '../today.js'

const SIDE_KEYS = { debit: 'common.debit', credit: 'common.credit' } // 借方・貸方の名前（辞書のキー）
const LANGUAGE_KEYS = { ja: 'language.ja', ko: 'language.ko' } // 言語の名前（辞書のキー。どちらの言語でも、自分の言語の字で出す）

// 言語を変えるときの確認画面に出す、名前の置き換えの一覧。行ごとにチェック（blocked の行はチェックできず、理由を出す）。
// 一覧の上のボタン：選べる行（blocked でない行）が全部チェック済みなら「全部解除」、1つでも外れていれば「全部チェック」。押すと、選べる行だけを付け外しする（blocked の行は変えない）
// chosen は、チェックされた科目の id の Set。チェックを変えるたびに書き換え、確認画面で「はい」が押されたとき、呼んだ側が読む
function RenameList({ rows, chosen }) {
  const [, redraw] = useState(0)
  const toggle = (id, on) => {
    if (on) chosen.add(id)
    else chosen.delete(id)
    redraw((n) => n + 1)
  }
  const selectable = rows.filter((r) => !r.blocked)
  const allChecked = selectable.every((r) => chosen.has(r.account.id))
  const toggleAll = () => {
    for (const r of selectable) {
      if (allChecked) chosen.delete(r.account.id)
      else chosen.add(r.account.id)
    }
    redraw((n) => n + 1)
  }
  return (
    <>
    {selectable.length > 0 && <button type="button" className="rename-all" onClick={toggleAll}>{allChecked ? t('language.renameUncheckAll') : t('language.renameCheckAll')}</button>}
    <ul className="rename-list">
      {rows.map((r) => (
        <li key={r.account.id}>
          <label>
            <input type="checkbox" disabled={r.blocked} checked={chosen.has(r.account.id)} onChange={(e) => toggle(r.account.id, e.target.checked)} />{' '}
            {r.account.name} → {r.name}
          </label>
          {r.blocked && <span className="note"> {t('language.renameBlocked')}</span>}
        </li>
      ))}
    </ul>
    </>
  )
}

// 借方・貸方の1つ分：登録済みの一覧（上下ボタン・解除）、追加、上限、「よく使う」
function FavoriteSide({ side, data, update }) {
  const { accounts, settings } = data
  const registered = settings.favorites[side]
  const limit = settings.favoriteLimits[side]
  const [addId, setAddId] = useState('')
  const [addError, setAddError] = useState('')
  const [limitText, setLimitText] = useState(limit === null ? '' : String(limit))
  const [limitMessage, setLimitMessage] = useState('')
  const [limitError, setLimitError] = useState('')
  const save = (next) => update({ ...data, settings: next })
  const accountOf = (id) => accounts.find((a) => a.id === id)
  const candidates = entryAccountOptions(accounts).filter((a) => !registered.includes(a.id))
  const sideName = t(SIDE_KEYS[side])

  const add = (e) => {
    e.preventDefault()
    const r = addFavorite(settings, side, addId, accounts)
    if (r.error) return setAddError(r.error)
    setAddError('')
    setAddId('')
    save(r.settings)
  }

  const saveLimit = (e) => {
    e.preventDefault()
    setLimitMessage('')
    const r = validateFavoriteLimit(limitText, registered.length)
    if (r.error) return setLimitError(r.error) // 入力は消さない。保存しない
    setLimitError('')
    save(setFavoriteLimit(settings, side, r.limit))
    setLimitMessage(t('common.saved'))
  }

  return (
    <section>
      <h3>{t('settings.favoriteOf', { side: sideName })}</h3>
      {registered.length === 0 ? <p className="note">{t('settings.noFavorites')}</p> : (
        <ol>
          {registered.map((id, i) => {
            const account = accountOf(id)
            if (!account) return null
            return (
              <li key={id} className={account.active ? '' : 'inactive'}>
                <span className="name">{account.name}{!account.active && <span className="note"> {t('common.inactive')}</span>}</span>
                <button type="button" disabled={i === 0} onClick={() => save(moveFavorite(settings, side, id, -1))}>{t('settings.up')}</button>
                <button type="button" disabled={i === registered.length - 1} onClick={() => save(moveFavorite(settings, side, id, 1))}>{t('settings.down')}</button>
                <button type="button" onClick={() => save(removeFavorite(settings, side, id))}>{t('settings.release')}</button>
              </li>
            )
          })}
        </ol>
      )}
      <form onSubmit={add}>
        <select aria-label={t('settings.addAria', { side: sideName })} value={addId} onChange={(e) => setAddId(e.target.value)}>
          <option value="">{t('settings.chooseAdd')}</option>
          {groupByType(candidates).map((g) => (
            <optgroup key={g.type} label={g.label}>
              {g.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </optgroup>
          ))}
        </select>
        <button>{t('common.add')}</button>
        {addError && <span className="error">{addError}</span>}
      </form>
      <form onSubmit={saveLimit}>
        <label>
          {t('settings.limit')}{' '}<input inputMode="numeric" aria-label={t('settings.limitAria', { side: sideName })} value={limitText} onChange={(e) => setLimitText(e.target.value)} placeholder={t('settings.none')} />{' '}{t('settings.countUnit')}
        </label>
        <button>{t('common.save')}</button>
        {limitError && <span className="error">{limitError}</span>}
        {limitMessage && <span className="note">{limitMessage}</span>}
      </form>
      <p className="note">{limit === null ? t('settings.summaryNoLimit', { count: registered.length }) : t('settings.summaryLimit', { count: registered.length, limit })}</p>
    </section>
  )
}

// 「よく使う」：今月・前月・前々月の通常の仕訳から、借方・貸方別々に上位5件（回数つき）。登録の手がかり（選択肢には出さない）
function Frequent({ data }) {
  const { accounts, entries, settings } = data
  const stats = favoriteStats(entries, accounts, today())
  return (
    <section>
      <h3>{t('settings.frequentTitle')}</h3>
      <div className="columns">
        {['debit', 'credit'].map((side) => (
          <div key={side}>
            <h4>{t(SIDE_KEYS[side])}</h4>
            {stats[side].length === 0 ? <p className="note">{t('settings.frequentNone')}</p> : (
              <ol>
                {stats[side].map((r) => (
                  <li key={r.account.id}>
                    <span className="name">{r.account.name}</span> {t('settings.times', { count: r.count })}
                    {settings.favorites[side].includes(r.account.id) && <span className="note"> {t('settings.registered')}</span>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
      <p className="note">{t('settings.frequentNote')}</p>
    </section>
  )
}

export default function Settings({ data, update, openPanel, replaceData, autosave, autosaveBeforeReplace, language, onChangeLanguage }) {
  const confirm = useConfirm()
  // 残高の表示：残高の画面で、自由に使える額を最初にどちらで出すか。ブラウザごとに覚える（保存データには入れない）。変えたらすぐ覚える（確認画面なし）
  const [balanceView, setBalanceView] = useState(loadBalanceView)
  const changeBalanceView = (view) => {
    rememberBalanceView(view)
    setBalanceView(view)
  }
  // 通貨を変える：金額の数字は変えず、付ける文字だけが変わる（確認画面。いいえなら変えない。選択肢は data の通貨のままなので、表示も戻る）
  // 言語を変える：名前を置き換えられる科目があれば、確認画面を出す（一覧から行ごとに選ぶ）。「いいえ」なら、言語も名前も変えない（選択肢は今の言語のままなので、表示も戻る）。
  // 置き換えられる科目がなければ、確認画面を出さずに変える。チェックを全部外して「はい」なら、言語だけ変わる
  const changeLanguage = async (next) => {
    if (next === language) return
    const rows = renameRows(data.accounts, language, next)
    if (rows.length === 0) return onChangeLanguage(next)
    const chosen = new Set(rows.filter((r) => r.checked).map((r) => r.account.id))
    if (!(await confirm({ message: t('language.renameConfirm'), extra: <RenameList rows={rows} chosen={chosen} /> }))) return
    if (chosen.size > 0) update({ ...data, accounts: applyRenames(data.accounts, [...chosen], next) })
    onChangeLanguage(next)
  }
  const changeCurrency = async (next) => {
    if (next === data.settings.currency) return
    if (!(await confirm({ message: t('currency.confirm') }))) return
    update({ ...data, settings: setCurrency(data.settings, next) })
  }
  return (
    <div className="settings">
      <h2>{t('settings.title')}</h2>
      <h3>{t('language.title')}</h3>
      <select aria-label={t('language.title')} value={language} onChange={(e) => changeLanguage(e.target.value)}>
        {LANGUAGES.map((code) => <option key={code} value={code}>{t(LANGUAGE_KEYS[code])}</option>)}
      </select>
      <h3>{t('currency.title')}</h3>
      <select aria-label={t('currency.title')} value={data.settings.currency} onChange={(e) => changeCurrency(e.target.value)}>
        {Object.entries(CURRENCIES).map(([code, currency]) => <option key={code} value={code}>{currency.unit}</option>)}
      </select>
      <h3>{t('balanceView.title')}</h3>
      <select aria-label={t('balanceView.title')} value={balanceView} onChange={(e) => changeBalanceView(e.target.value)}>
        {BALANCE_VIEWS.map((v) => <option key={v} value={v}>{t(BALANCE_VIEW_LABELS[v])}</option>)}
      </select>
      <h3>{t('settings.favoritesHeading')}</h3>
      <p className="note">{t('settings.favoritesNote')}</p>
      <FavoriteSide side="debit" data={data} update={update} />
      <FavoriteSide side="credit" data={data} update={update} />
      <Frequent data={data} />
      <h3>{t('card.title')}</h3>
      <CardSettings data={data} update={update} />
      <h3>{t('save.title')}</h3>
      <SaveSettings autosave={autosave} />
      <h3>{t('settings.dataHeading')}</h3>
      <DataSettings data={data} update={update} openPanel={openPanel} replaceData={replaceData} autosaveBeforeReplace={autosaveBeforeReplace} />
    </div>
  )
}
