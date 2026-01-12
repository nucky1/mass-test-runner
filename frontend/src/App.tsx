import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import RunsPage from './pages/RunsPage'
import RunDetailPage from './pages/RunDetailPage'
import PluginsPage from './pages/PluginsPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="navbar">
          <div className="nav-container">
            <Link to="/" className="nav-logo">
              Mass Test Runner
            </Link>
            <Link to="/" className="nav-link">
              Runs
            </Link>
            <Link to="/plugins" className="nav-link">
              Plugins
            </Link>
          </div>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<RunsPage />} />
            <Route path="/runs/:runId" element={<RunDetailPage />} />
            <Route path="/plugins" element={<PluginsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
