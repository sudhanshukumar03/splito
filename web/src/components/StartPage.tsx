import { Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { ApiError, api, errorMessage } from '../lib/api'
import { recentHomes, rememberHome } from '../lib/storage'
import { Brand, Icon } from './Icon'

export function StartPage() {
  const alive = useRef(false)
  const writing = useRef(false)
  useEffect(() => {
    alive.current = true
    document.title = 'Splito | Shared household bills'
    return () => {
      alive.current = false
    }
  }, [])
  const navigate = useNavigate()
  const [homes] = useState(recentHomes)
  const [name, setName] = useState('')
  const [homeId, setHomeId] = useState('')
  const [busy, setBusy] = useState<'create' | 'sample' | null>(null)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [partial, setPartial] = useState<string | null>(null)
  async function create(event?: FormEvent<HTMLFormElement>, sample = false) {
    event?.preventDefault()
    if (writing.current || busy || uncertain) return
    if (!sample && !name.trim()) {
      setError('Give your home a name to get started.')
      return
    }
    writing.current = true
    setBusy(sample ? 'sample' : 'create')
    setError('')
    let createdId: string | null = null
    try {
      const home = await api.createHome(sample ? 'Maple House' : name.trim())
      createdId = home.id
      rememberHome(home)
      // Stop obsolete setup from navigating or scheduling more writes after leaving.
      if (!alive.current) return
      if (sample) {
        // Sequential additions preserve the assignment’s member-order rounding rule.
        for (const memberName of ['Asha', 'Ben', 'Chitra', 'Dev']) {
          if (!alive.current) return
          await api.addMember(home.id, memberName)
        }
        const examples = [
          { title: 'Weekend groceries', totalCents: 8643, paid: 2 },
          { title: 'Electricity', totalCents: 12875, paid: 1 },
          { title: 'Home internet', totalCents: 4999, paid: 4 },
        ]
        for (const example of examples) {
          if (!alive.current) return
          const bill = await api.addBill(home.id, example.title, example.totalCents)
          for (const share of bill.shares.slice(0, example.paid)) {
            if (!alive.current) return
            await api.pay(bill.id, share.id, crypto.randomUUID())
          }
        }
      }
      if (!alive.current) return
      await navigate({ to: '/homes/$homeId', params: { homeId: home.id } })
    } catch (failure) {
      if (!alive.current) return
      if (createdId) {
        setPartial(createdId)
        setUncertain(true)
        setError(
          'Your home was created, but setup was interrupted. Open it to see what was saved and finish adding bills there.',
        )
      } else {
        const unknownResult = failure instanceof ApiError && failure.uncertain
        setUncertain(unknownResult)
        setError(
          unknownResult
            ? 'The request was interrupted. A home may have been created, but its address was not returned. Check your connection before starting a different home.'
            : errorMessage(failure),
        )
      }
    } finally {
      writing.current = false
      if (alive.current) setBusy(null)
    }
  }
  const createForm = (
    <form onSubmit={(event) => void create(event)} aria-busy={busy !== null}>
      <label className="field">
        Household name
        <input
          name="homeName"
          placeholder="e.g. The Cedar Flat"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          disabled={busy !== null || uncertain}
        />
      </label>
      <button
        type="submit"
        className="button primary full-width"
        disabled={busy !== null || uncertain}
      >
        {busy === 'create' ? (
          <>
            <span className="spinner" />
            Creating...
          </>
        ) : (
          'Create household'
        )}
      </button>
    </form>
  )
  return (
    <div className="start-page landing-page">
      <a className="skip-link" href="#main">
        Skip to page content
      </a>
      <header className="start-header">
        <Link className="brand-link" to="/" aria-label="Splito home">
          <Brand />
        </Link>
        <nav className="landing-nav" aria-label="Welcome navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#get-started">Get started</a>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        <div className="start-main">
          <section className="landing-hero" aria-labelledby="landing-title">
            <p className="landing-intro">For the place you share.</p>
            <h1 id="landing-title">
              Shared home.
              <br />
              Clearer bills.
            </h1>
            <p className="landing-description">
              Groceries, electricity, the internet. Keep your household’s bills in one place, split
              every cent fairly, and see which shares are still unpaid.
            </p>
            <a className="button landing-explainer" href="#how-it-works">
              See how Splito works <Icon name="arrow" size={18} />
            </a>
            <p className="landing-assurance">
              <Icon name="split" size={20} />
              Exact shares. A clear record. Fewer follow-ups.
            </p>
          </section>
          <section
            className="landing-panel"
            id="get-started"
            aria-labelledby="setup-title"
            tabIndex={-1}
          >
            <h2 id="setup-title">{homes.length ? 'Your households' : 'Create a household'}</h2>
            <p className="landing-setup-description">
              {homes.length
                ? 'Pick up where your household left off.'
                : 'Start with a name. Add your housemates and first bill next.'}
            </p>
            {homes.length ? (
              <>
                <div className="saved-households">
                  {homes.map((home) => (
                    <Link
                      className="recent-home"
                      key={home.id}
                      to="/homes/$homeId"
                      params={{ homeId: home.id }}
                    >
                      <strong className="truncate">{home.name}</strong>
                      <Icon name="chevron" size={16} />
                    </Link>
                  ))}
                </div>
                <details className="start-options">
                  <summary>Create another household</summary>
                  {createForm}
                </details>
              </>
            ) : (
              createForm
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {partial && (
              <Link className="button full-width" to="/homes/$homeId" params={{ homeId: partial }}>
                Open your saved household
              </Link>
            )}
            {uncertain && !partial && (
              <button
                type="button"
                className="button full-width"
                onClick={() => {
                  setUncertain(false)
                  setError('')
                }}
              >
                Start a different household
              </button>
            )}
            <details className="start-options">
              <summary>More ways to start</summary>
              <form
                className="open-home-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (homeId.trim())
                    void navigate({ to: '/homes/$homeId', params: { homeId: homeId.trim() } })
                }}
              >
                <label className="field">
                  Home ID
                  <input
                    name="homeId"
                    placeholder="Enter a home ID"
                    value={homeId}
                    onChange={(event) => setHomeId(event.target.value)}
                    required
                  />
                </label>
                <button type="submit" className="button">
                  Open
                </button>
              </form>
              <button
                type="button"
                className="button subtle sample-button"
                disabled={busy !== null || uncertain}
                onClick={() => void create(undefined, true)}
              >
                {busy === 'sample' ? (
                  <>
                    <span className="spinner" />
                    Creating sample...
                  </>
                ) : (
                  'Try a sample household'
                )}
              </button>
              <p className="section-note">The sample creates its own example household.</p>
            </details>
            <p className="start-privacy">
              Anyone with your household link can view and update its records.
            </p>
          </section>
        </div>
        <section
          className="landing-how"
          id="how-it-works"
          aria-labelledby="how-title"
          tabIndex={-1}
        >
          <h2 id="how-title">A little less admin for your household.</h2>
          <ol className="landing-steps">
            <li>
              <Icon name="people" size={26} />
              <h3>Add your housemates</h3>
              <p>Create a household, add everyone’s name, and share its link.</p>
            </li>
            <li>
              <Icon name="split" size={26} />
              <h3>Split a shared bill</h3>
              <p>
                Enter the total. Splito divides it equally and accounts for every remaining cent.
              </p>
            </li>
            <li>
              <Icon name="check-circle" size={26} />
              <h3>Keep track together</h3>
              <p>Record payments as they happen and check each housemate’s outstanding shares.</p>
            </li>
          </ol>
        </section>
      </main>
      <footer className="landing-footer">
        <span>Splito · For shared households.</span>
        <span>Payments are recorded here. No money is transferred.</span>
      </footer>
    </div>
  )
}
