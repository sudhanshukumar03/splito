import { createFileRoute } from '@tanstack/react-router'
import { HomeLayout } from '../components/HomeLayout'

export const Route = createFileRoute('/homes/$homeId')({ component: HomeRoute })
function HomeRoute() {
  const { homeId } = Route.useParams()
  return <HomeLayout key={homeId} homeId={homeId} />
}
