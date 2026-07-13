import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './routes/Home'
import Create from './routes/Create'
import Join from './routes/Join'
import GameShell from './routes/GameShell'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<Create />} />
        <Route path="/join" element={<Join />} />
        <Route path="/game/:roomCode" element={<GameShell />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
