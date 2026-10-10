import { useState } from 'react'
import './opening.css'
import { groupByType, openingAccounts, openingInitial, planOpening, currencyUnit } from '../ledgerLogic.js'
import { today } from '../today.js'
import { t } from '../text.js'
import { useConfirm } from './ConfirmDialog.jsx'

export default function Opening({ data, update }) {
  const { accounts, entries } = data
  const confirm = useConfirm()
  const [initial] = useState(() => openingInitial(accounts, entries, today()))
  const [date, setDate] = useState(initial.date)
  const [texts, setTexts] = useState(initial.amounts)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const save = async (e) => {
    e.preventDefault()
    setMessage('')
    const plan = planOpening(accounts, entries, date, texts)
    if (plan.error) return setError(plan.error) // 入力途中の内容は消さない
    setError('')
    if (!plan.created && !plan.updated && !plan.deleted) return setMessage(t('opening.noChange'))
    const warn = plan.earlier ? `${t('opening.earlierWarning', { count: plan.earlier.count, first: plan.earlier.first })}\n\n` : ''
    if (!(await confirm({ message: `${warn}${t('opening.confirm', { created: plan.created, updated: plan.updated, deleted: plan.deleted })}` }))) return
    update({ ...data, entries: plan.entries })
    setMessage(t('common.saved'))
  }

  return (
    <div className="opening">
      <h2>{t('opening.title')}</h2>
      <p className="note">{t('opening.noteEarmark')}</p>
      <p className="note">{t('opening.noteCard')}</p>
      <p className="note">{t('opening.noteEmpty')}</p>
      <form onSubmit={save}>
        <label className="date">
          {t('opening.date')}{' '}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {groupByType(openingAccounts(accounts)).map((g) => (
          <section key={g.type}>
            <h3>{g.label}</h3>
            {g.accounts.map((a) => (
              <label key={a.id} className="row">
                <span>{a.name}</span>
                <input
                  inputMode="numeric"
                  aria-label={a.name}
                  value={texts[a.id] ?? ''}
                  onChange={(e) => setTexts((prev) => ({ ...prev, [a.id]: e.target.value }))}
                />
                <span>{currencyUnit(data.settings.currency)}</span>
              </label>
            ))}
          </section>
        ))}
        <button>{t('common.save')}</button>
        {error && <span className="error">{error}</span>}
        {message && <span className="note">{message}</span>}
      </form>
    </div>
  )
}
