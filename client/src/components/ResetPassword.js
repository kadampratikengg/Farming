import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './AdminStyles.css';

function ResetPassword({ setError }) {
  const [resetData, setResetData] = useState({
    username: '',
    code: '',
    newPassword: '',
  });
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState([]);
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setResetData({ ...resetData, [e.target.name]: e.target.value });
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    try {
      const apiUrl = `${process.env.REACT_APP_API_URL}/admin/forgot-password`;
      const response = await axios.post(apiUrl, { username: resetData.username });
      setSuccess(response.data.message || 'Reset code sent to your WhatsApp number');
      setError('');
      setErrors([]);
    } catch (err) {
      const errorResponse = err.response?.data;
      if (errorResponse?.errors) {
        setErrors(errorResponse.errors.map((e) => e.msg));
      } else {
        setErrors([errorResponse?.error || 'Failed to send reset code. Please try again.']);
      }
      setSuccess('');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      const apiUrl = `${process.env.REACT_APP_API_URL}/admin/reset-password`;
      const response = await axios.post(apiUrl, resetData);
      setSuccess(response.data.message || 'Password reset successfully!');
      setError('');
      setErrors([]);
      setTimeout(() => navigate('/admin'), 2000);
    } catch (err) {
      const errorResponse = err.response?.data;
      if (errorResponse?.errors) {
        setErrors(errorResponse.errors.map((e) => e.msg));
      } else {
        setErrors([errorResponse?.error || 'Failed to reset password. Please try again.']);
      }
      setSuccess('');
    }
  };

  return (
    <div className="admin-container max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4 text-center">Reset Password</h2>
      {success && <p className="text-green-500 mb-4 text-center">{success}</p>}
      {errors.length > 0 && (
        <ul className="text-red-500 mb-4 list-disc list-inside">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      )}
      <form onSubmit={resetData.code ? handleResetPassword : handleForgotPassword} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            name="username"
            value={resetData.username}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-md focus:ring focus:ring-blue-200"
            placeholder="e.g., user@example.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Reset Code (if received)</label>
          <input
            type="text"
            name="code"
            value={resetData.code}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-md focus:ring focus:ring-blue-200"
            disabled={!resetData.username}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">New Password</label>
          <input
            type="password"
            name="newPassword"
            value={resetData.newPassword}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-md focus:ring focus:ring-blue-200"
            placeholder="At least 6 characters"
            disabled={!resetData.code}
            required={!!resetData.code}
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition"
          disabled={!resetData.username || (resetData.code && !resetData.newPassword)}
        >
          {resetData.code ? 'Reset Password' : 'Send Reset Code'}
        </button>
      </form>
      <Link to="/admin" className="block text-center mt-4 text-blue-500 hover:underline">
        Back to Login
      </Link>
    </div>
  );
}

export default ResetPassword;