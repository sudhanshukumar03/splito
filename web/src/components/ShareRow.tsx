import type { Member, Share } from '../lib/api'
import { money } from '../lib/money'
import { Avatar, Icon } from './Icon'

export function ShareRow({
  share,
  member,
  index,
  pending,
  error,
  onPay,
}: {
  share: Share
  member: Member
  index: number
  pending: boolean
  error?: string
  onPay: () => void
}) {
  const paid = share.paidAt !== null
  return (
    <li className={`share-item${paid ? ' is-paid' : ''}`}>
      <div className="share-row">
        <span className="share-person">
          <Avatar name={member.name} index={index} small />
          <span className="truncate">{member.name}</span>
        </span>
        <span className="share-amount">{money(share.amountCents)}</span>
        {paid ? (
          <span className="payment-record">
            <span className="paid-label">
              <Icon name="check-circle" size={16} />
              Paid
            </span>
            {share.paidAt && (
              <time
                dateTime={share.paidAt}
                title={`Recorded ${new Date(share.paidAt).toLocaleString()}`}
              >
                {new Intl.DateTimeFormat('en', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }).format(new Date(share.paidAt))}
              </time>
            )}
          </span>
        ) : (
          <button
            type="button"
            className="pay-button"
            disabled={pending}
            onClick={onPay}
            aria-label={`${error ? 'Retry payment' : 'Mark paid'} for ${member.name}`}
          >
            <span>
              {pending ? (
                <>
                  <span className="spinner" />
                  Saving
                </>
              ) : error ? (
                'Retry'
              ) : (
                'Mark paid'
              )}
            </span>
          </button>
        )}
      </div>
      {error && !paid && (
        <p className="share-error" role="alert">
          {error}
        </p>
      )}
    </li>
  )
}
