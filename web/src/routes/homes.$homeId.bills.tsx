import { createFileRoute } from '@tanstack/react-router'
import { BillsPage } from '../components/BillsPage'

export const Route = createFileRoute('/homes/$homeId/bills')({ component: BillsPage })
