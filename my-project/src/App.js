import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import Resume from './pages/Resume';
import QCM from './pages/QCM';
import AISearchAgent from './pages/AISearchAgent';
import ChatInterface from './components/ChatInterface';
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
                <Route path="/resume" element={<Resume />} />
                <Route path="/qcm" element={<QCM />} />
                <Route path="/web-agent" element={<AISearchAgent />} />
                 <Route path="/chat" element={<ChatInterface />} />



      </Routes>
    </Router>
  );
}

export default App;
