import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './app/App.tsx'
import CueListsPage from './app/CueListsPage.tsx'
import KioskShowsPage from './app/kiosk/KioskShowsPage.tsx'
import KioskCueListsPage from './app/kiosk/KioskCueListsPage.tsx'
import KioskCueListPage from './app/kiosk/KioskCueListPage.tsx'
import { ShowList } from './components/ShowList.tsx'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/shows" replace />} />
        <Route path="/shows" element={<ShowList />} />
        <Route path="/show/:id" element={<App />} />
        <Route path="/show/:id/cue-lists" element={<CueListsPage />} />
        <Route path="/kiosk" element={<KioskShowsPage />} />
        <Route path="/kiosk/show/:id" element={<KioskCueListsPage />} />
        <Route path="/kiosk/show/:showId/cue-list/:cueListId" element={<KioskCueListPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
