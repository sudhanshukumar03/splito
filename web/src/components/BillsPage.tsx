import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useHomeWorkspace } from '../lib/home-context'
import { BillCard } from './BillCard'
import { HomeDataState, HomePageHeader } from './HomePageHeader'
import { Icon } from './Icon'
import { PageState } from './PageState'

type Filter = 'All bills' | 'Unpaid' | 'Settled'
export function BillsPage() {
  const { data, homeId, loading, pending, paymentErrors, pay, openDialog } = useHomeWorkspace()
  const [filter, setFilter] = useState<Filter>('All bills')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const bills = data?.bills ?? []
  const visible = [...bills]
    .reverse()
    .filter(
      (bill) =>
        (filter === 'All bills' ||
          (filter === 'Settled'
            ? bill.shares.every((share) => share.paidAt !== null)
            : bill.shares.some((share) => share.paidAt === null))) &&
        bill.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
    )
  return (
    <div className="bills-page">
      <HomePageHeader title="Shared bills">
        <button
          type="button"
          className="button primary"
          disabled={!data || loading || !data.home.members.length}
          onClick={() => openDialog('bill')}
        >
          <Icon name="plus" size={18} />
          Add a bill
        </button>
      </HomePageHeader>
      {!data ? (
        <HomeDataState />
      ) : (
        <section aria-label="Bill ledger">
          <div className="bill-tools">
            <fieldset className="filter-tabs">
              <legend className="sr-only">Filter bills</legend>
              {(['All bills', 'Unpaid', 'Settled'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  className={filter === value ? 'selected' : ''}
                  onClick={() => setFilter(value)}
                >
                  {value === 'All bills' ? 'All' : value}
                </button>
              ))}
            </fieldset>
            <label className="search-field">
              <Icon name="search" size={17} />
              <span className="sr-only">Search bill titles</span>
              <input
                type="search"
                placeholder="Search bills..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
          <div className="bills-list bill-ledger" aria-busy={loading}>
            {visible.length ? (
              visible.map((bill) => (
                <BillCard
                  key={bill.id}
                  bill={bill}
                  initialExpanded={false}
                  members={data.home.members}
                  pending={pending}
                  errors={paymentErrors}
                  onPay={(shareId) => void pay(bill, shareId)}
                />
              ))
            ) : (
              <PageState
                title={bills.length ? 'No matching bills' : 'No shared bills yet'}
                description={
                  bills.length
                    ? 'Try another filter or search for a different bill.'
                    : data.home.members.length
                      ? "Add your first bill to calculate each member's exact share."
                      : 'Add household members on the Housemates page before creating a bill.'
                }
                action={
                  bills.length
                    ? 'Clear filters'
                    : data.home.members.length
                      ? 'Add your first bill'
                      : 'Go to Housemates'
                }
                onAction={() => {
                  if (bills.length) {
                    setSearch('')
                    setFilter('All bills')
                  } else if (data.home.members.length) openDialog('bill')
                  else void navigate({ to: '/homes/$homeId/housemates', params: { homeId } })
                }}
              />
            )}
          </div>
          <p className="ledger-footnote">
            <Icon name="info" size={15} />
            Mark paid records a payment made outside Splito. No money is transferred.
          </p>
        </section>
      )}
    </div>
  )
}
