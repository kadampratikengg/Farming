import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './AdminStyles.css';

function AdminLogin({ onLogin, setError }) {
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState([]);
  const navigate = useNavigate();

  console.log('API URL:', process.env.REACT_APP_API_URL); // Debug log

  const handleInputChange = (e) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const apiUrl = `${process.env.REACT_APP_API_URL}/admin/login`;
      console.log('Attempting to login with API URL:', apiUrl);
      const response = await axios.post(apiUrl, loginData);
      localStorage.setItem('adminToken', response.data.token);
      setSuccess('Login successful!');
      setError('');
      setErrors([]);
      onLogin();
    } catch (err) {
      const errorResponse = err.response?.data;
      if (errorResponse?.errors) {
        setErrors(errorResponse.errors.map((e) => e.msg));
      } else {
        setErrors([errorResponse?.error || 'Failed to login. Please try again.']);
      }
      setSuccess('');
      console.error('Error logging in:', err.response?.status, err.response?.data);
    }
  };

  return (
    <div className="admin-container max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4 text-center">Admin Login</h2>
      {success && <p className="text-green-500 mb-4 text-center">{success}</p>}
      {errors.length > 0 && (
        <ul className="text-red-500 mb-4 list-disc list-inside">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            name="username"
            value={loginData.username}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-md focus:ring focus:ring-blue-200"
            placeholder="e.g., user@example.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            name="password"
            value={loginData.password}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-md focus:ring focus:ring-blue-200"
            placeholder="Enter your password"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition"
        >
          Login
        </button>
      </form>
      <div className="flex justify-between mt-4">
        <Link to="/admin/forgot-password" className="text-blue-500 hover:underline demo" >
          Forgot Password?
        </Link>
        <Link to="/admin/create-user" className="text-blue-500 hover:underline">
          Create Account
        </Link>
      </div>
    </div>
  );
}

export default AdminLogin;