import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <main className="standalone">
      <h1>This page isn’t home.</h1>
      <p>Choose a home to get back to your bills.</p>
      <Link className="button primary" to="/">
        Choose a home
      </Link>
    </main>
  ),
  errorComponent: ({ reset }) => (
    <main className="standalone">
      <h1>Something interrupted the page.</h1>
      <p>Your saved bills are still in your home. Try opening the page again.</p>
      <button type="button" className="button primary" onClick={reset}>
        Try again
      </button>
      <Link className="button" to="/">
        Choose a home
      </Link>
    </main>
  ),
})
