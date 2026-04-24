import { AuthProvider, useAuth } from './context/AuthContext'
import LoginScreen from './screens/LoginScreen'
import SearchScreen from './screens/SearchScreen'

// Permet de pré-remplir les champs via env vars au build
const PRESET_BASE_URL = import.meta.env.VITE_DOINSPORT_BASE_URL as string | undefined
const PRESET_CLUB_ID = import.meta.env.VITE_DOINSPORT_CLUB_ID as string | undefined

function Router() {
  const { session } = useAuth()
  if (!session) {
    return <LoginScreen presetBaseUrl={PRESET_BASE_URL} presetClubId={PRESET_CLUB_ID} />
  }
  return <SearchScreen />
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  )
}
