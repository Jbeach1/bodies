import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './routes/Home'
import Placeholder from './routes/Placeholder'
import GameShell from './routes/GameShell'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<Placeholder title="CREATE GAME" slice="slice 02" />} />
        <Route path="/join" element={<Placeholder title="JOIN GAME" slice="slice 02" />} />
        <Route path="/game/:roomCode" element={<GameShell />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
