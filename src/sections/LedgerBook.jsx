import { useState } from 'react'
import './balance.css'
import { groupByType, ledgerBook, formatYen } from '../ledgerLogic.js'
import { t } from '../text.js'
import { KIND_LABELS } from './Entries.jsx'

const Num = ({ n }) => <span className={n < 0 ? 'neg' : ''}>{formatYen(n)}</span>

export default function LedgerBook({ data }) {
  const { accounts, entries } = data
  const [accountId, setAccountId] = useState('')
  const [month, setMonth] = useState('') // 初期は全期間
  const name = (id) => accounts.find((a) => a.id === id)?.name ?? ''
  const book = accountId ? ledgerBook(accounts, entries, accountId, month) : null

  return (
    <div className="report">
      <h2>{t('book.title')}</h2>
      <div className="month-bar">
        <select aria-label={t('common.account')} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">{t('common.chooseAccount')}</option>
          {groupByType(accounts).map((g) => (
            <optgroup key={g.type} label={g.label}>
              {g.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{!a.active && t('common.inactive')}</option>)}
            </optgroup>
          ))}
        </select>
        <input type="month" aria-label={t('common.month')} value={month} onChange={(e) => setMonth(e.target.value)} />
        <button type="button" onClick={() => setMonth('')}>{t('common.allPeriod')}</button>
      </div>
      <p className="note">{t('book.note')}</p>
      {book && book.total === 0 && <p className="note">{t('book.empty')}</p>}
      {book && book.total > 0 && (
        <>
          <table>
            <thead>
              <tr>
                <th>{t('common.date')}</th><th className="text">{t('common.otherAccount')}</th><th>{t('common.debit')}</th><th>{t('common.credit')}</th><th>{t('common.balance')}</th><th className="text">{t('common.memo')}</th><th className="text">{t('book.kind')}</th>
              </tr>
            </thead>
            <tbody>
              {book.carryOver !== null && (
                <tr className="total">
                  <td colSpan={4}>{t('book.carryOver')}</td>
                  <td className={book.carryOver < 0 ? 'neg' : ''}>{formatYen(book.carryOver)}</td>
                  <td colSpan={2} />
                </tr>
              )}
              {book.rows.map((r) => (
                <tr key={r.entry.id}>
                  <td>{r.entry.date}</td>
                  <td className="text">{name(r.otherId)}</td>
                  <td>{r.debit !== null && formatYen(r.debit)}</td>
                  <td>{r.credit !== null && formatYen(r.credit)}</td>
                  <td><Num n={r.balance} /></td>
                  <td className="text">{r.entry.memo}</td>
                  <td className="text">{KIND_LABELS[r.entry.kind]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {book.rows.length === 0 && <p className="note">{t('common.noEntriesInMonth')}</p>}
        </>
      )}
    </div>
  )
}
