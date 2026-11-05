import { createFileRoute } from '@tanstack/react-router'
import { HousematesPage } from '../components/HousematesPage'

export const Route = createFileRoute('/homes/$homeId/housemates')({ component: HousematesPage })
