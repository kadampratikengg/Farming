import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import './AdminStyles.css';

function CreateUser({ setError }) {
  const [userData, setUserData] = useState({
    username: '',
    password: '',
    contactNumber: '',
  });
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState([]);
  const navigate = useNavigate();

  console.log('API URL:', process.env.REACT_APP_API_URL); // Debug log to verify .env

  const handleInputChange = (e) => {
    setUserData({ ...userData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const apiUrl = `${process.env.REACT_APP_API_URL}/admin/register`;
      console.log('Attempting to create user with API URL:', apiUrl);
      console.log('Request data:', userData);

      const response = await axios.post(apiUrl, userData);

      setSuccess(response.data.message || 'User created successfully!');
      setUserData({ username: '', password: '', contactNumber: '' });
      setError('');
      setErrors([]);
      setTimeout(() => navigate('/admin'), 2000);
    } catch (err) {
      const errorResponse = err.response?.data;
      if (errorResponse?.errors) {
        setErrors(errorResponse.errors.map((e) => e.msg));
      } else {
        setErrors([errorResponse?.error || 'Failed to create user. Please try again.']);
      }
      setSuccess('');
      console.error('Error creating user:', err.response?.status, err.response?.data);
    }
  };

  return (
    <div className="admin-container max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4 text-center">Create New Admin User</h2>
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
            value={userData.username}
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
            value={userData.password}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-md focus:ring focus:ring-blue-200"
            placeholder="At least 6 characters"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Contact Number</label>
          <input
            type="tel"
            name="contactNumber"
            value={userData.contactNumber}
            onChange={handleInputChange}
            className="w-full p-2 border rounded-md focus:ring focus:ring-blue-200"
            placeholder="e.g., +12345678901"
            pattern="\+[0-9]{10,15}"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition"
        >
          Create User
        </button>
      </form>
      <Link to="/admin" className="block text-center mt-4 text-blue-500 hover:underline">
        Back to Login
      </Link>
    </div>
  );
}

export default CreateUser;