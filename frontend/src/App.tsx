import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Landing from './pages/Landing';
import Room from './pages/Room';

function App() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-screen bg-dark">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route 
          path="/room/:roomId" 
          element={user ? <Room /> : <Navigate to="/" replace />} 
        />
      </Routes>
    </div>
  );
}

export default App;
