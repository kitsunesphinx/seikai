import { useState } from 'react'
import { planEntryPurge } from '../ledgerLogic.js'
import { emptyData } from '../storage.js'
import { today, nowLocal } from '../today.js'
import { t } from '../text.js'
import { slotView, lastSaveText } from '../saveLogic.js'
import { folderStatus, readSlots } from '../saveStore.js'
import { useConfirm } from './ConfirmDialog.jsx'

// 設定 → データ：仕訳の一括削除（月か全期間）と、全体の初期化。どちらも、文字を打たないと実行できない確認画面を出す。
// 確認画面に「最後のセーブ：○○前」と「先にセーブする」ボタンを出す。ボタンを押すと、確認画面を「いいえ」で閉じて、セーブ画面を開く（もう一度押し直す）。
// 計算は planEntryPurge（ledgerLogic.js）。画面は結果を出して、update するだけ

// 確認画面に出す「最後のセーブ：…」の行。許可は求めない（確かめるだけ）。ブラウザが対応していなければ null（行を出さない）
async function lastSaveLine() {
  try {
    const st = await folderStatus()
    if (st.state === 'unsupported') return null
    if (st.state === 'none') return t('save.lastSaveLine', { value: t('save.noFolder') })
    if (st.state !== 'granted') return t('save.lastSaveLine', { value: t('save.unknownLastSave') })
    const savedAts = (await readSlots()).filter((r) => r.text !== null).map((r) => slotView(r.text).savedAt).filter(Boolean)
    return t('save.lastSaveLine', { value: lastSaveText(savedAts, nowLocal()) })
  } catch {
    return t('save.lastSaveLine', { value: t('save.unknownLastSave') })
  }
}

export default function DataSettings({ data, update, openPanel, replaceData, autosaveBeforeReplace }) {
  const confirm = useConfirm()
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const [all, setAll] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const saveButton = <button type="button" onClick={() => openPanel('save')}>{t('save.saveFirst')}</button>

  const purge = async () => {
    setMessage('')
    setError('')
    const plan = planEntryPurge(data.entries, all ? null : month)
    if (plan.error) return setError(plan.error)
    if (plan.counts.total === 0) return setMessage(t('dataSettings.nothingToDelete'))
    const { normal, opening, adjustment, total } = plan.counts
    const last = await lastSaveLine()
    const ok = await confirm({
      message: [
        t('dataSettings.purgeHead', { target: all ? t('common.allPeriod') : month, total }),
        t('dataSettings.purgeBreakdown', { normal, opening, adjustment }),
        t('dataSettings.purgeNoteSubs'),
        t('dataSettings.purgeNoteKept'),
        ...(last ? [last] : []),
      ].join('\n'),
      requireText: t('dataSettings.purgeRequire'),
      extra: saveButton,
    })
    if (!ok) return
    await autosaveBeforeReplace() // 消す前の状態を、オートセーブへ書く（書けるときだけ。書けなくても進む）
    update({ ...data, entries: plan.kept }, { quiet: true }) // 消した直後のデータは、オートセーブに書かない
    setMessage(t('dataSettings.purged', { total }))
  }

  const reset = async () => {
    setMessage('')
    setError('')
    const last = await lastSaveLine()
    const ok = await confirm({
      message: [
        t('dataSettings.resetConfirmHead'),
        t('dataSettings.resetConfirmNote'),
        ...(last ? [last] : []),
      ].join('\n'),
      requireText: t('dataSettings.resetRequire'),
      extra: saveButton,
    })
    if (!ok) return
    replaceData(emptyData())
  }

  return (
    <section>
      <h4>{t('dataSettings.purgeTitle')}</h4>
      <p className="note">{t('dataSettings.purgeNote')}</p>
      <div>
        <input type="month" aria-label={t('dataSettings.monthAria')} value={month} disabled={all} onChange={(e) => setMonth(e.target.value)} />{' '}
        <label><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {t('common.allPeriod')}</label>{' '}
        <button type="button" onClick={purge}>{t('dataSettings.purgeButton')}</button>
        {error && <span className="error"> {error}</span>}
        {message && <span className="note"> {message}</span>}
      </div>
      <h4>{t('dataSettings.resetTitle')}</h4>
      <p className="note">{t('dataSettings.resetDesc')}</p>
      <button type="button" onClick={reset}>{t('dataSettings.resetButton')}</button>
    </section>
  )
}
