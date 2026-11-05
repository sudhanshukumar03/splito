import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { HomeWorkspaceContext } from '../lib/home-context'
import { summarizeLedger } from '../lib/ledger'
import { useHome } from '../lib/use-home'
import { RefreshHome } from './HomePageHeader'
import { Brand, Icon } from './Icon'
import { MutationDialog } from './MutationDialog'

export function HomeLayout({ homeId }: { homeId: string }) {
  // The parent route stays mounted between sections, including in-flight payments.
  const state = useHome(homeId)
  const { data, loading, error, notice, refresh } = state
  const ledger = useMemo(
    () => (data ? summarizeLedger(data.home.members, data.bills) : null),
    [data],
  )
  const [dialog, setDialog] = useState<'bill' | 'member' | null>(null)
  const [feedback, setFeedback] = useState('')
  const routeId = useRouterState({ select: (router) => router.matches.at(-1)?.routeId })
  const section =
    routeId === '/homes/$homeId/bills'
      ? 'Shared bills'
      : routeId === '/homes/$homeId/housemates'
        ? 'Housemates'
        : 'Overview'
  const previousSection = useRef(section)
  const homeName = data?.home.name ?? 'Your home'
  useEffect(() => {
    document.title = `${section} | ${homeName} | Splito`
  }, [section, homeName])
  useEffect(() => {
    if (previousSection.current !== section && !document.querySelector('dialog[open]'))
      document.getElementById('page-title')?.focus()
    previousSection.current = section
  }, [section])
  function openDialog(mode: 'bill' | 'member') {
    setFeedback('')
    setDialog(mode)
  }
  async function saved(message: string): Promise<boolean> {
    const refreshed = await refresh()
    if (refreshed) {
      setDialog(null)
      setFeedback(message)
    }
    return refreshed
  }
  async function copyLink() {
    const address = new URL(`/homes/${encodeURIComponent(homeId)}`, window.location.origin).href
    try {
      await navigator.clipboard.writeText(address)
      setFeedback('Home link copied. Anyone with the link can view and update this home.')
    } catch {
      setFeedback(
        'Copy the household address from your browser to share it. Anyone with the link can view and update it.',
      )
    }
  }
  return (
    <HomeWorkspaceContext.Provider value={{ ...state, homeId, ledger, openDialog }}>
      <div className="app-shell">
        <a className="skip-link" href="#main">
          Skip to page content
        </a>
        <aside className="sidebar">
          <Link to="/" className="brand-link" aria-label="Splito - choose a home">
            <Brand />
          </Link>
          <Link to="/" className="home-switch">
            <span className="home-icon">
              <Icon name="home" />
            </span>
            <span>
              <strong className="truncate">{homeName}</strong>
              <small>Switch home</small>
            </span>
            <Icon name="chevron" size={16} />
          </Link>
          <nav aria-label="Home navigation">
            <Link
              to="/homes/$homeId"
              params={{ homeId }}
              className="nav-item"
              activeOptions={{ exact: true }}
              activeProps={{ className: 'active' }}
            >
              <Icon name="grid" />
              Overview
            </Link>
            <Link
              to="/homes/$homeId/bills"
              params={{ homeId }}
              className="nav-item"
              activeOptions={{ exact: true }}
              activeProps={{ className: 'active' }}
            >
              <Icon name="receipt" />
              Shared bills
            </Link>
            <Link
              to="/homes/$homeId/housemates"
              params={{ homeId }}
              className="nav-item"
              activeOptions={{ exact: true }}
              activeProps={{ className: 'active' }}
            >
              <Icon name="people" />
              Housemates
            </Link>
          </nav>
          <div className="sidebar-tools">
            <RefreshHome />
            <button
              type="button"
              className="button subtle copy-link"
              aria-label="Share household link"
              title="Share household link"
              onClick={() => void copyLink()}
            >
              <Icon name="link" size={17} />
              <span className="button-label">Share home</span>
            </button>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <Link
              to="/"
              className="mobile-home-switch"
              aria-label={`Switch household, current household ${homeName}`}
            >
              <Icon name="home" size={20} />
              <span className="truncate">{homeName}</span>
              <Icon name="chevron" size={14} />
            </Link>
          </header>
          <main className="workspace" id="main" tabIndex={-1}>
            <div className="live-feedback" role="status" aria-live="polite">
              {feedback || notice}
            </div>
            {error && (
              <div className="error-banner" role="alert">
                <Icon name="info" />
                <div>
                  <strong>
                    {data ? 'Could not refresh your household.' : 'Could not load your household.'}
                  </strong>
                  <p>
                    {error}
                    {data && ' Displaying your last successful update.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="button"
                  disabled={loading}
                  onClick={() => void refresh()}
                >
                  Try again
                </button>
              </div>
            )}
            <Outlet />
          </main>
        </div>
        {dialog && data && (
          <MutationDialog
            mode={dialog}
            home={data.home}
            onClose={() => setDialog(null)}
            onSaved={saved}
            onCheck={() => {
              setDialog(null)
              void refresh()
            }}
          />
        )}
      </div>
    </HomeWorkspaceContext.Provider>
  )
}
