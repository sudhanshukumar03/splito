import { useId, useState } from 'react'
import type { Bill, Member } from '../lib/api'
import { money } from '../lib/money'
import { Icon } from './Icon'
import { ShareRow } from './ShareRow'

export function BillCard({
  bill,
  members,
  pending,
  errors,
  onPay,
  initialExpanded = false,
}: {
  bill: Bill
  members: Member[]
  pending: Set<string>
  errors: Record<string, string>
  onPay: (shareId: string) => void
  initialExpanded?: boolean
}) {
  const heading = useId()
  const [expanded, setExpanded] = useState(initialExpanded)
  const paid = bill.shares.filter((share) => share.paidAt !== null).length
  const settled = paid === bill.shares.length
  const saving = bill.shares.some((share) => pending.has(share.id))
  const hasError = bill.shares.some((share) => share.paidAt === null && errors[share.id])
  // Closed bills render only their summary; payment state stays in the shared parent.
  const byMember = new Map(
    expanded ? members.map((member, index) => [member.id, { member, index }] as const) : [],
  )
  return (
    <details
      className="bill-entry"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
      aria-labelledby={heading}
    >
      <summary className="bill-summary">
        <span className="bill-title">
          <strong className="bill-name" id={heading}>
            {bill.title}
          </strong>
          <span className="bill-meta">
            {bill.shares.length} {bill.shares.length === 1 ? 'member' : 'members'}
          </span>
          {saving && (
            <span className="bill-feedback">
              <span className="spinner" />
              Saving payment...
            </span>
          )}
          {hasError && (
            <span className="bill-feedback error" role={expanded ? undefined : 'alert'}>
              <Icon name="info" size={14} />
              Payment needs attention
            </span>
          )}
        </span>
        <span className="bill-total">
          <strong>{money(bill.totalCents)}</strong>
          <span className={`status-pill${settled ? ' settled' : paid > 0 ? ' part-paid' : ''}`}>
            <Icon name={settled ? 'check-circle' : 'clock'} size={14} />
            {settled ? 'Settled' : paid > 0 ? 'Part paid' : 'Unpaid'}
          </span>
        </span>
        <span className="bill-chevron">
          <Icon name="chevron" size={18} />
        </span>
      </summary>
      {expanded && (
        <div className="bill-detail">
          <div className="split-heading" aria-hidden="true">
            <span>Member</span>
            <span>Share</span>
            <span>Payment</span>
          </div>
          <ul className="share-list">
            {bill.shares.map((share) => {
              const person = byMember.get(share.memberId)
              if (!person) throw new Error('A bill share is missing its household member')
              return (
                <ShareRow
                  key={share.id}
                  share={share}
                  member={person.member}
                  index={person.index}
                  pending={pending.has(share.id)}
                  error={errors[share.id]}
                  onPay={() => onPay(share.id)}
                />
              )
            })}
          </ul>
        </div>
      )}
    </details>
  )
}
