import { createContext, useContext } from 'react'
import type { LedgerSummary } from './ledger'
import type { useHome } from './use-home'

export type HomeWorkspace = ReturnType<typeof useHome> & {
  homeId: string
  ledger: LedgerSummary | null
  openDialog: (mode: 'bill' | 'member') => void
}
export const HomeWorkspaceContext = createContext<HomeWorkspace | null>(null)
export function useHomeWorkspace(): HomeWorkspace {
  const workspace = useContext(HomeWorkspaceContext)
  if (!workspace) throw new Error('Household pages require the shared home layout')
  return workspace
}
