import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Chantiers from './pages/Chantiers'
import ChantierForm from './pages/ChantierForm'
import ChantierDetail from './pages/ChantierDetail'
import PVForm from './pages/PVForm'
import PVDetail from './pages/PVDetail'
import Preview from './pages/Preview'
import Parametres from './pages/Parametres'
import Sauvegarde from './pages/Sauvegarde'

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chantiers" element={<Chantiers />} />
          <Route path="/chantiers/nouveau" element={<ChantierForm />} />
          <Route path="/chantiers/:id/editer" element={<ChantierForm />} />
          <Route path="/chantiers/:id" element={<ChantierDetail />} />
          <Route path="/pvs/nouveau" element={<PVForm />} />
          <Route path="/pv/:id" element={<PVDetail />} />
          <Route path="/pv/:id/editer" element={<PVForm />} />
          <Route path="/pv/:id/apercu" element={<Preview />} />
          <Route path="/sauvegarde" element={<Sauvegarde />} />
          <Route path="/parametres" element={<Parametres />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}
