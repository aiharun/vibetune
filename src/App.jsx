import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Navbar from './components/Navbar'
import LandingPage from './components/LandingPage'
import ResultsPage from './components/ResultsPage'
import MyVibes from './components/MyVibes'
import Dashboard from './components/Dashboard'

function App() {
  const [analysisResult, setAnalysisResult] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const location = useLocation()

  // Hide navbar on dashboard
  const hideNavbar = location.pathname === '/dboard'

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {!hideNavbar && <Navbar />}

      <AnimatePresence mode="wait">
        <Routes>
          <Route
            path="/"
            element={
              <LandingPage
                setAnalysisResult={setAnalysisResult}
                setIsAnalyzing={setIsAnalyzing}
              />
            }
          />
          <Route
            path="/results"
            element={<ResultsPage analysisResult={analysisResult} setAnalysisResult={setAnalysisResult} />}
          />
          <Route path="/my-vibes" element={<MyVibes />} />
          <Route path="/dboard" element={<Dashboard />} />
        </Routes>
      </AnimatePresence>
    </div>
  )
}

export default App
