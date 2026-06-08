import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Login from './pages/Login';
import CitizenLayout from './layouts/CitizenLayout';
import AdminLayout from './layouts/AdminLayout';
import { useAuthStore } from './store/auth';

function App() {
  const { isAuthenticated, user, loadUser } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !user) {
      loadUser();
    }
  }, [user, loadUser]);

  const renderRoutes = () => {
    if (!isAuthenticated) {
      return (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" state={{ from: location }} replace />} />
        </>
      );
    }

    if (user?.role === 'citizen') {
      return (
        <>
          <Route path="/citizen/*" element={<CitizenLayout />} />
          <Route path="*" element={<Navigate to="/citizen" replace />} />
        </>
      );
    }

    return (
      <>
        <Route path="/admin/*" element={<AdminLayout />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </>
    );
  };

  return <Routes>{renderRoutes()}</Routes>;
}

export default App;
