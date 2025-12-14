import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { TransferProvider } from './context/TransferContext'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import SharePage from './pages/SharePage'
import ReceivePage from './pages/ReceivePage'
import ConfirmPage from './pages/ConfirmPage'
import TransferPage from './pages/TransferPage'
import ResultPage from './pages/ResultPage'

function App() {
  return (
    <TransferProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/share" element={<SharePage />} />
            <Route path="/receive" element={<ReceivePage />} />
            <Route path="/confirm" element={<ConfirmPage />} />
            <Route path="/transfer" element={<TransferPage />} />
            <Route path="/result" element={<ResultPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TransferProvider>
  )
}

export default App
