import { HashRouter, Routes, Route } from 'react-router-dom'
import Home from './app/page'
import Demo from './app/demo/page'
import History from './app/history/page'

function App() {
    return (
        <HashRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/demo" element={<Demo />} />
                <Route path="/history" element={<History />} />
            </Routes>
        </HashRouter>
    )
}

export default App
