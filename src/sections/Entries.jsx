import { useState } from 'react'
import './entries.css'
import {
  entryAccountOptions, validateEntryInput, newEntry, editEntry, lastCreditId, favoriteOptionGroups, accountLabelWithType,
  entriesOfMonth, groupEntriesByDate, canEditEntry, formatMoney,
} from '../ledgerLogic.js'
import { today } from '../today.js'
import { t } from '../text.js'
import { useConfirm } from './ConfirmDialog.jsx'

// favoriteIds：その側（借方か貸方）のお気に入り。一番上に「お気に入り」を出し、そこだけ科目名の後ろに区分を付ける（表示だけ。値は科目の id）
export function AccountSelect({ value, onChange, options, label, favoriteIds = [] }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{label}</option>
      {favoriteOptionGroups(options, favoriteIds).map((g) => (
        <optgroup key={g.type} label={g.label}>
          {g.accounts.map((a) => <option key={a.id} value={a.id}>{g.withType ? accountLabelWithType(a) : a.name}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

// 入力・編集で共用。エラーのときは入力途中の内容を消さない。
// currentIds は編集フォームだけが渡す（その仕訳が今使っている科目を選択肢に残す）。新規入力では渡さない。
export function EntryForm({ accounts, initial, submitLabel, onSubmit, onCancel, currentIds, favorites = { debit: [], credit: [] } }) {
  const options = entryAccountOptions(accounts, currentIds)
  const [f, setF] = useState(initial)
  const [error, setError] = useState('')
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))

  const submit = (e) => {
    e.preventDefault()
    const r = validateEntryInput({ ...f, amountText: f.amount }, accounts)
    if (r.error) return setError(r.error)
    setError('')
    onSubmit(r, f.memo)
    setF((s) => ({ ...s, amount: '', memo: '' })) // 成功時は金額とメモだけ空にする
  }

  return (
    <form onSubmit={submit}>
      <input type="date" aria-label={t('common.date')} value={f.date} onChange={(e) => set('date')(e.target.value)} />
      <input inputMode="numeric" placeholder={t('common.amount')} aria-label={t('common.amount')} value={f.amount} onChange={(e) => set('amount')(e.target.value)} />
      <AccountSelect label={t('common.debit')} value={f.debitId} onChange={set('debitId')} options={options} favoriteIds={favorites.debit} />
      <AccountSelect label={t('common.credit')} value={f.creditId} onChange={set('creditId')} options={options} favoriteIds={favorites.credit} />
      <input placeholder={t('common.memo')} aria-label={t('common.memo')} value={f.memo} onChange={(e) => set('memo')(e.target.value)} />
      <button>{submitLabel}</button>
      {onCancel && <button type="button" onClick={onCancel}>{t('common.cancel')}</button>}
      {error && <span className="error">{error}</span>}
    </form>
  )
}

// 読むたびに辞書から取る（読み込み時に固めない）。LedgerBook も同じ書き方で使う
export const KIND_LABELS = {
  normal: '',
  get opening() { return t('entries.kind.opening') },
  get adjustment() { return t('entries.kind.adjustment') },
}

function EntryRow({ entry, number, accounts, favorites, currency, editing, onEdit, onCancel, onSave, onDelete }) {
  const name = (id) => accounts.find((a) => a.id === id)?.name ?? ''
  if (editing) {
    return (
      <li>
        <EntryForm
          accounts={accounts}
          initial={{ date: entry.date, amount: String(entry.amount), debitId: entry.debitId, creditId: entry.creditId, memo: entry.memo }}
          currentIds={[entry.debitId, entry.creditId]}
          favorites={favorites}
          submitLabel={t('common.save')}
          onSubmit={onSave}
          onCancel={onCancel}
        />
      </li>
    )
  }
  return (
    <li className="row">
      <span>{number}.</span>
      <span className="cell debit">{name(entry.debitId)}</span>
      <span className="cell">{name(entry.creditId)}</span>
      <span className="amount">{formatMoney(entry.amount, currency)}</span>
      <span className="cell">
        {KIND_LABELS[entry.kind] && <span className="note">{t('entries.kindNote', { kind: KIND_LABELS[entry.kind] })}</span>}
        {entry.memo}
      </span>
      <span>
        {canEditEntry(entry) && (
          <>
            <button onClick={onEdit}>{t('common.edit')}</button>
            <button onClick={onDelete}>{t('common.delete')}</button>
          </>
        )}
      </span>
    </li>
  )
}

const ORDER_LABELS = { asc: 'entries.orderAsc', desc: 'entries.orderDesc' } // 日付の枠の並びの切り替えボタンの文言（辞書のキー）

export default function Entries({ data, update }) {
  const { accounts, entries, settings } = data
  const [month, setMonth] = useState(() => today().slice(0, 7))
  const [editingId, setEditingId] = useState(null)
  const [order, setOrder] = useState('asc') // 日付の枠の並び。画面の中だけで持ち、保存しない（画面を移る・再読み込みで古い順に戻る）
  const confirm = useConfirm()
  const setEntries = (next) => update({ ...data, entries: next })
  const add = (input, memo) => {
    setEntries([...entries, newEntry(input, memo)])
    setMonth(input.date.slice(0, 7)) // 追加した仕訳が見える月に切り替える
  }
  const last = lastCreditId(entries)
  const creditId = entryAccountOptions(accounts).some((a) => a.id === last) ? last : '' // 選択肢にあるときだけ使う
  const groups = month ? groupEntriesByDate(entriesOfMonth(entries, month), order) : []

  const save = (entry) => (input, memo) => {
    setEntries(entries.map((e) => (e.id === entry.id ? editEntry(entry, input, memo) : e)))
    setEditingId(null)
  }
  const remove = async (entry) => {
    if (!(await confirm({ message: t('entries.deleteConfirm') }))) return
    setEntries(entries.filter((e) => e.id !== entry.id))
  }

  return (
    <div className="entries">
      <h2>{t('entries.inputTitle')}</h2>
      <EntryForm
        accounts={accounts}
        favorites={settings.favorites}
        initial={{ date: today(), amount: '', debitId: '', creditId, memo: '' }}
        submitLabel={t('common.add')}
        onSubmit={add}
      />
      <h2>{t('entries.listTitle')}</h2>
      <input type="month" aria-label={t('common.month')} value={month} onChange={(e) => { setMonth(e.target.value); setEditingId(null) }} />{' '}
      {/* 押すたびに切り替える。表示は、押したら切り替わる先 */}
      <button type="button" aria-pressed={order === 'desc'} onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}>{t(order === 'asc' ? ORDER_LABELS.desc : ORDER_LABELS.asc)}</button>
      {!month ? <p className="note">{t('common.chooseMonth')}</p> : groups.length === 0 ? <p className="note">{t('common.noEntriesInMonth')}</p> : (
        groups.map((g) => (
          <section key={g.date} className="day">
            <h3>{g.date}</h3>
            <div className="head">
              <span />
              <span className="debit">{t('common.debit')}</span>
              <span>{t('common.credit')}</span>
              <span className="amount">{t('common.amount')}</span>
              <span />
              <span />
            </div>
            <ol>
              {g.entries.map((e, i) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  number={i + 1}
                  accounts={accounts}
                  favorites={settings.favorites}
                  currency={settings.currency}
                  editing={editingId === e.id}
                  onEdit={() => setEditingId(e.id)}
                  onCancel={() => setEditingId(null)}
                  onSave={save(e)}
                  onDelete={() => remove(e)}
                />
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  )
}
