import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import AdminLogin from '../components/AdminLogin';
import AdminPanel from '../components/AdminPanel';
import CreateUser from '../components/CreateUser';
import ResetPassword from '../components/ResetPassword';
import axios from 'axios';

function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      setIsAuthenticated(true);
      fetchAppointments();
    }
  }, []);

  const fetchAppointments = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/appointments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAppointments(response.data);
    } catch (err) {
      setError('Failed to fetch appointments.');
    }
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    fetchAppointments();
    navigate('/admin/panel');
  };

  const handleCreateUser = () => {
    navigate('/admin/create-user');
  };

  return (
    <div className="flex flex-col items-center p-4">
      {error && <p className="text-red-500 mt-4">{error}</p>}
      <Routes>
        <Route
          path="/"
          element={<AdminLogin onLogin={handleLogin} setError={setError} />}
        />
        <Route
          path="/panel"
          element={
            isAuthenticated ? (
              <AdminPanel
                appointments={appointments}
                onCreateUser={handleCreateUser}
              />
            ) : (
              <AdminLogin onLogin={handleLogin} setError={setError} />
            )
          }
        />
        <Route
          path="/create-user"
          element={<CreateUser setError={setError} />}
        />
        <Route
          path="/forgot-password"
          element={<ResetPassword setError={setError} />}
        />
      </Routes>
    </div>
  );
}

export default Admin;