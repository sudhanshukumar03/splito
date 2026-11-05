import { type FormEvent, useEffect, useRef, useState } from 'react'
import { ApiError, api, errorMessage, type HomeDetails } from '../lib/api'
import { CreationAttempt } from '../lib/creation-attempt'
import { money, parseAmount } from '../lib/money'
import { Icon } from './Icon'
import { Modal } from './Modal'

export function MutationDialog({
  mode,
  home,
  onClose,
  onSaved,
  onCheck,
}: {
  mode: 'bill' | 'member'
  home: HomeDetails
  onClose: () => void
  onSaved: (message: string) => Promise<boolean>
  onCheck: () => void
}) {
  const alive = useRef(false)
  const writing = useRef(false)
  const attempt = useRef(new CreationAttempt())
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const isBill = mode === 'bill'
  let preview: string | null = null
  if (isBill && amount && home.members.length) {
    try {
      preview = money(BigInt(parseAmount(amount)) / BigInt(home.members.length))
    } catch {
      /* Validation is shown on submit. */
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (writing.current || busy || uncertain) return
    setError('')
    if (!attempt.current.committed && !name.trim()) {
      setError(isBill ? 'Give this bill a title.' : 'Enter your housemate’s name.')
      return
    }
    let total = 0
    if (isBill && !attempt.current.committed) {
      try {
        total = parseAmount(amount)
      } catch (failure) {
        setError(errorMessage(failure))
        return
      }
      if (!home.members.length) {
        setError('Add at least one housemate before creating a bill.')
        return
      }
    }
    writing.current = true
    setBusy(true)
    try {
      const refreshed = await attempt.current.run(
        () =>
          isBill ? api.addBill(home.id, name.trim(), total) : api.addMember(home.id, name.trim()),
        () =>
          alive.current
            ? onSaved(isBill ? 'Bill added.' : 'Housemate added. They’ll join future bill splits.')
            : Promise.resolve(false),
      )
      if (alive.current && !refreshed)
        setError(
          'Already saved. The list could not refresh. Retry the refresh to see the saved item; this will not add it again.',
        )
    } catch (failure) {
      if (!alive.current) return
      if (attempt.current.committed) {
        setError(
          'Already saved. The list could not refresh. Retry the refresh to see the saved item; this will not add it again.',
        )
        return
      }
      const unknownResult = failure instanceof ApiError && failure.uncertain
      setUncertain(unknownResult)
      setError(
        unknownResult
          ? 'The response was interrupted, so this may already be saved. Check the latest household data before trying to add it again.'
          : errorMessage(failure),
      )
    } finally {
      writing.current = false
      if (alive.current) setBusy(false)
    }
  }
  return (
    <Modal title={isBill ? 'Add a shared bill' : 'Add a housemate'} busy={busy} onClose={onClose}>
      <p className="modal-intro">
        {isBill
          ? 'Enter the total to split it between all current members.'
          : 'This member will be included in future bills.'}
      </p>
      <form onSubmit={submit} aria-busy={busy}>
        <label className="field">
          {isBill ? 'Bill title' : 'Housemate’s name'}
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={isBill ? 'e.g. Weekly groceries' : 'e.g. Asha'}
            required
            disabled={busy || uncertain || attempt.current.committed}
          />
        </label>
        {isBill && (
          <label className="field">
            Total amount (dollars)
            <span className="amount-input">
              <input
                name="amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                required
                disabled={busy || uncertain || attempt.current.committed}
              />
              <span>2 decimals</span>
            </span>
          </label>
        )}
        <div className="form-note">
          <Icon name={isBill ? 'people' : 'info'} size={19} />
          <p>
            {isBill ? (
              <>
                Split between all {home.members.length} current housemates.
                {preview && (
                  <>
                    {' '}
                    About <strong>{preview}</strong> each; any remaining cents go to the first
                    members added.
                  </>
                )}
              </>
            ) : (
              'New members join future bills. Existing splits stay exactly as they are.'
            )}
          </p>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            {attempt.current.committed ? 'Close' : 'Cancel'}
          </button>
          {uncertain ? (
            <button type="button" className="button primary" onClick={onCheck}>
              Check latest data
              <Icon name="refresh" size={17} />
            </button>
          ) : (
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner" />
                  {attempt.current.committed ? 'Refreshing…' : 'Saving…'}
                </>
              ) : (
                <>
                  {attempt.current.committed
                    ? 'Refresh saved item'
                    : isBill
                      ? 'Add bill'
                      : 'Add housemate'}
                  <Icon name={attempt.current.committed ? 'refresh' : 'plus'} size={17} />
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}
