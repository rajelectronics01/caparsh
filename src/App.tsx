import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Button, ToastProvider } from './components/ui'
import { StoreProvider, useStore } from './lib/store'
import Auth from './pages/Auth'

const Overview = lazy(() => import('./pages/Overview'))
const DailyLog = lazy(() => import('./pages/DailyLog'))
const Planner = lazy(() => import('./pages/Planner'))
const Subjects = lazy(() => import('./pages/Subjects'))
const Syllabus = lazy(() => import('./pages/Syllabus'))
const Lectures = lazy(() => import('./pages/Lectures'))
const Practice = lazy(() => import('./pages/Practice'))
const Revision = lazy(() => import('./pages/Revision'))
const Tests = lazy(() => import('./pages/Tests'))
const Backlog = lazy(() => import('./pages/Backlog'))
const Weekly = lazy(() => import('./pages/Weekly'))
const Monthly = lazy(() => import('./pages/Monthly'))
const Compare = lazy(() => import('./pages/Compare'))
const Settings = lazy(() => import('./pages/Settings'))

const Center = ({ children }: { children: React.ReactNode }) => <div className="grid min-h-full place-items-center p-6 text-center text-ink-3">{children}</div>

function Gate() {
  const { status, loadError, reload } = useStore()
  if (status === 'loading') return <Center>Loading your data…</Center>
  if (status === 'error')
    return (
      <Center>
        <div>
          <p className="font-medium text-ink">Could not load your data</p>
          <p className="mt-1 max-w-md text-sm">{loadError}</p>
          <Button className="mt-4" variant="primary" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      </Center>
    )
  if (status === 'signedOut') return <Auth />
  return (
    <Suspense fallback={<Center>Loading…</Center>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="log" element={<DailyLog />} />
          <Route path="planner" element={<Planner />} />
          <Route path="subjects" element={<Subjects />} />
          <Route path="syllabus" element={<Syllabus />} />
          <Route path="lectures" element={<Lectures />} />
          <Route path="practice" element={<Practice />} />
          <Route path="revision" element={<Revision />} />
          <Route path="tests" element={<Tests />} />
          <Route path="backlog" element={<Backlog />} />
          <Route path="weekly" element={<Weekly />} />
          <Route path="monthly" element={<Monthly />} />
          <Route path="compare" element={<Compare />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <StoreProvider>
          <Gate />
        </StoreProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
