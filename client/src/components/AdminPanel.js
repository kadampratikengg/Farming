// AdminPanel.js
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import generateInvoicePDF from './Invoice';
import './AdminStyles.css';
import { FaDownload, FaEdit, FaTrash } from 'react-icons/fa';
import * as XLSX from 'xlsx';

function AdminPanel({ appointments, onCreateUser, fetchAppointments }) {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState({});
  const [localAppointments, setLocalAppointments] = useState(appointments || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchField, setSearchField] = useState('name');
  const API_URL = process.env.REACT_APP_API_URL;

  const workCategories = JSON.parse(process.env.REACT_APP_WORK_CATEGORIES || '[]');

  const localFetchAppointments = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        console.error('No admin token found');
        alert('Please log in to fetch appointments.');
        navigate('/admin');
        return;
      }
      const response = await axios.get(`${API_URL}/appointments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLocalAppointments(response.data);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      alert('Failed to fetch appointments: ' + (err.message || 'Unknown error'));
    }
  };

  const effectiveFetchAppointments = fetchAppointments || localFetchAppointments;

  useEffect(() => {
    if (localAppointments.length === 0 && typeof effectiveFetchAppointments === 'function') {
      effectiveFetchAppointments();
    }
  }, []);

  useEffect(() => {
    if (appointments && Array.isArray(appointments) && appointments.length > 0) {
      setLocalAppointments(appointments);
    }
  }, [appointments]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin');
  };

  const currentDateTime = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const currentIST = new Date(currentDateTime.getTime() + istOffset);
  const today = currentIST.toISOString().split('T')[0];

  const sortedAppointments = [...localAppointments].sort((a, b) => {
    try {
      const dateTimeA = new Date(`${a.date}T${Array.isArray(a.time) ? a.time[0] : a.time}+05:30`);
      const dateTimeB = new Date(`${b.date}T${Array.isArray(b.time) ? b.time[0] : b.time}+05:30`);
      if (isNaN(dateTimeA.getTime()) && isNaN(dateTimeB.getTime())) return 0;
      if (isNaN(dateTimeA.getTime())) return 1;
      if (isNaN(dateTimeB.getTime())) return -1;
      return dateTimeA - dateTimeB;
    } catch (err) {
      console.error('Sorting error:', err);
      return 0;
    }
  });

  const filteredAppointments = sortedAppointments.filter((appointment) => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    switch (searchField) {
      case 'name': return appointment.name?.toLowerCase().includes(lowerQuery);
      case 'contactNumber': return appointment.contactNumber?.toLowerCase().includes(lowerQuery);
      case 'paymentStatus': return appointment.paymentStatus?.toLowerCase().includes(lowerQuery);
      case 'paymentMode': return (appointment.paymentMode === 'online' ? 'Online (Razorpay)' : 'Cash').toLowerCase().includes(lowerQuery);
      case 'sevenTwelveNumber': return appointment.sevenTwelveNumber?.toLowerCase().includes(lowerQuery);
      default: return true;
    }
  });

  const completedAppointments = filteredAppointments.filter((appointment) => {
    try {
      const appointmentDateTime = new Date(`${appointment.date}T${Array.isArray(appointment.time) ? appointment.time[0] : appointment.time}+05:30`);
      return appointmentDateTime < currentIST;
    } catch (err) {
      console.error('Error filtering completed appointment:', err);
      return false;
    }
  });

  const todayAppointments = filteredAppointments.filter((appointment) => appointment.date === today);

  const futureAppointments = filteredAppointments.filter((appointment) => {
    try {
      const appointmentDateTime = new Date(`${appointment.date}T${Array.isArray(appointment.time) ? appointment.time[0] : appointment.time}+05:30`);
      return (appointment.date > today || (appointment.date === today && appointmentDateTime > currentIST));
    } catch (err) {
      console.error('Error filtering future appointment:', err);
      return false;
    }
  });

  const validateAppointment = async (id) => {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      alert('Invalid appointment ID format.');
      return false;
    }
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        alert('Please log in to perform this action.');
        navigate('/admin');
        return false;
      }
      await axios.get(`${API_URL}/appointments/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return true;
    } catch (err) {
      if (err.response?.status === 404) {
        alert('Appointment not found. It may have been deleted.');
        await localFetchAppointments();
        return false;
      }
      console.error('Validation error:', err);
      alert('Failed to validate appointment: ' + (err.message || 'Unknown error'));
      return false;
    }
  };

  const handleDelete = async (id) => {
    if (loading[id]) return;
    setLoading((prev) => ({ ...prev, [id]: 'delete' }));
    const previousAppointments = localAppointments;
    setLocalAppointments((prev) => prev.filter((appt) => appt._id !== id));
    try {
      if (!(await validateAppointment(id))) return;
      if (window.confirm('Are you sure you want to delete this appointment?')) {
        const token = localStorage.getItem('adminToken');
        await axios.delete(`${API_URL}/appointments/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        alert('Appointment deleted successfully.');
      } else {
        setLocalAppointments(previousAppointments);
      }
    } catch (err) {
      console.error('Error deleting appointment:', err);
      setLocalAppointments(previousAppointments);
      if (err.response?.status === 404) {
        alert('Appointment not found. It may have been deleted already.');
      } else {
        alert('Failed to delete appointment: ' + (err.message || 'Unknown error'));
      }
      await localFetchAppointments();
    } finally {
      setLoading((prev) => ({ ...prev, [id]: null }));
    }
  };

  const handleDownloadInvoice = async (appointment) => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        alert('Please log in to download invoice.');
        navigate('/admin');
        return;
      }
      const response = await axios.get(`${API_URL}/appointments/${appointment._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updatedAppointment = response.data;
      generateInvoicePDF(updatedAppointment, updatedAppointment.paymentStatus === 'completed');
    } catch (err) {
      console.error('Error fetching appointment for invoice:', err);
      alert('Failed to fetch appointment details for invoice: ' + (err.message || 'Unknown error'));
    }
  };

  const handleEdit = (appointment) => {
    setEditingId(appointment._id);
    setEditForm({
      name: appointment.name || '',
      email: appointment.email || '',
      contactNumber: appointment.contactNumber || '',
      pincode: appointment.pincode || '',
      address: appointment.address || '',
      district: appointment.district || '',
      state: appointment.state || '',
      village: appointment.village || '',
      gunta: appointment.gunta || '',
      acre: appointment.acre || '',
      area: appointment.area || '',
      sevenTwelveNumber: appointment.sevenTwelveNumber || '',
      khataNumber: appointment.khataNumber || '',
      workCategory: appointment.workCategory || '',
      date: appointment.date || '',
      time: Array.isArray(appointment.time) ? appointment.time[0] : appointment.time || '',
      remark: appointment.remark || '',
      paymentMode: appointment.paymentMode || 'online',
      paymentStatus: appointment.paymentStatus || 'pending',
      attempted: appointment.attempted || false,
      pickupLocation: appointment.pickupLocation || '',
      deliveryLocation: appointment.deliveryLocation || '',
      kilometers: appointment.kilometers || '',
    });
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm((prev) => {
      let newState = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'gunta' && prev.workCategory !== 'Transport' && prev.workCategory !== 'Customize') {
        const newValue = value === '' ? '' : parseFloat(value);
        newState.acre = newValue ? (newValue / 40).toFixed(3) : '';
        newState.area = newValue ? `${newValue} gunta` : '';
      } else if (name === 'acre' && prev.workCategory !== 'Transport' && prev.workCategory !== 'Customize') {
        const newValue = value === '' ? '' : parseFloat(value);
        newState.gunta = newValue ? (newValue * 40).toFixed(2) : '';
        newState.area = newValue ? `${newValue} acres` : '';
      } else if (name === 'pincode' && value.length === 6) {
        axios.get(`https://api.postalpincode.in/pincode/${value}`)
          .then((response) => {
            const postOffice = response.data[0]?.PostOffice?.[0];
            if (postOffice) {
              setEditForm((prev) => ({
                ...prev,
                district: postOffice.District,
                state: postOffice.State,
              }));
            } else {
              alert('Invalid PIN code.');
            }
          })
          .catch((err) => {
            console.error('Error fetching PIN code data:', err);
            alert('Failed to fetch address details.');
          });
      }
      return newState;
    });
  };

  const handleEditSubmit = async (id) => {
    if (loading[id]) return;
    setLoading((prev) => ({ ...prev, [id]: 'edit' }));
    const previousAppointments = localAppointments;

    const requiredFields = ['name', 'contactNumber', 'pincode', 'address', 'district', 'state', 'village', 'workCategory', 'date', 'time'];
    if (editForm.workCategory === 'Transport' || editForm.workCategory === 'Customize') {
      requiredFields.push('pickupLocation', 'deliveryLocation', 'kilometers');
    } else {
      requiredFields.push('area', 'sevenTwelveNumber');
    }
    const missingFields = requiredFields.filter((field) => !editForm[field]);
    if (missingFields.length > 0) {
      alert(`Please fill in: ${missingFields.join(', ')}`);
      setLoading((prev) => ({ ...prev, [id]: null }));
      return;
    }
    if (!/^(\+)?\d{10,13}$/.test(editForm.contactNumber)) {
      alert('Contact number must be 10-13 digits with optional + prefix.');
      setLoading((prev) => ({ ...prev, [id]: null }));
      return;
    }
    if (!/^[0-9]{6}$/.test(editForm.pincode)) {
      alert('PIN code must be exactly 6 digits.');
      setLoading((prev) => ({ ...prev, [id]: null }));
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        alert('Please log in to perform this action.');
        navigate('/admin');
        return;
      }
      const timeArray = Array.isArray(editForm.time) ? editForm.time : [editForm.time];
      const response = await axios.put(`${API_URL}/appointments/${id}`, {
        ...editForm,
        time: timeArray,
        // Clear fields not relevant to Transport/Customize
        ...(editForm.workCategory === 'Transport' || editForm.workCategory === 'Customize'
          ? { area: undefined, sevenTwelveNumber: undefined, gunta: undefined, acre: undefined }
          : { pickupLocation: undefined, deliveryLocation: undefined, kilometers: undefined }),
      }, { headers: { Authorization: `Bearer ${token}` } });
      setLocalAppointments((prev) => prev.map((appt) => (appt._id === id ? response.data : appt)));
      setEditingId(null);
      alert('Appointment updated successfully.');
    } catch (err) {
      console.error('Error updating appointment:', err);
      setLocalAppointments(previousAppointments);
      if (err.response?.status === 404) {
        alert('Appointment not found. It may have been deleted.');
      } else {
        alert('Failed to update appointment: ' + (err.message || 'Unknown error'));
      }
      await localFetchAppointments();
    } finally {
      setLoading((prev) => ({ ...prev, [id]: null }));
    }
  };

  const handleToggleAttempted = async (appointment, status) => {
    if (loading[appointment._id]) return;
    setLoading((prev) => ({ ...prev, [appointment._id]: 'attempted' }));
    const previousAppointments = localAppointments;
    const newAttempted = status === 'attended';
    setLocalAppointments((prev) => prev.map((appt) => appt._id === appointment._id ? { ...appt, attempted: newAttempted } : appt));
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        alert('Please log in to perform this action.');
        navigate('/admin');
        return;
      }
      const response = await axios.patch(`${API_URL}/appointments/${appointment._id}/attempted`, { attempted: newAttempted }, { headers: { Authorization: `Bearer ${token}` } });
      setLocalAppointments((prev) => prev.map((appt) => appt._id === appointment._id ? response.data : appt));
    } catch (err) {
      console.error('Error updating attempted status:', err);
      setLocalAppointments(previousAppointments);
      if (err.response?.status === 404) {
        alert('Appointment not found. It may have been deleted.');
      } else {
        alert('Failed to update attempted status: ' + (err.message || 'Unknown error'));
      }
      await localFetchAppointments();
    } finally {
      setLoading((prev) => ({ ...prev, [appointment._id]: null }));
    }
  };

  const handleMarkAllAttended = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        alert('Please log in to perform this action.');
        navigate('/admin');
        return;
      }
      const response = await axios.post(`${API_URL}/appointments/mark-attended`, { appointmentIds: filteredAppointments.map((appt) => appt._id) }, { headers: { Authorization: `Bearer ${token}` } });
      setLocalAppointments((prev) => prev.map((appt) => filteredAppointments.some((filtered) => filtered._id === appt._id) ? { ...appt, attempted: true } : appt));
      alert('All filtered appointments marked as attended.');
    } catch (err) {
      console.error('Error marking all attended:', err);
      alert('Failed to mark all attended: ' + (err.message || 'Unknown error'));
      await localFetchAppointments();
    }
  };

  const handleMarkAllNotAttended = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        alert('Please log in to perform this action.');
        navigate('/admin');
        return;
      }
      const response = await axios.post(`${API_URL}/appointments/mark-not-attended`, { appointmentIds: filteredAppointments.map((appt) => appt._id) }, { headers: { Authorization: `Bearer ${token}` } });
      setLocalAppointments((prev) => prev.map((appt) => filteredAppointments.some((filtered) => filtered._id === appt._id) ? { ...appt, attempted: false } : appt));
      alert('All filtered appointments marked as not attended.');
    } catch (err) {
      console.error('Error marking all not attended:', err);
      alert('Failed to mark all not attended: ' + (err.message || 'Unknown error'));
      await localFetchAppointments();
    }
  };

  const handleExportExcel = (appointments, filename) => {
    const data = appointments.map((appointment) => {
      const category = workCategories.find((cat) => cat.name === appointment.workCategory);
      let totalAmount = 0;
      if (category) {
        if (appointment.workCategory === 'Transport' || appointment.workCategory === 'Customize') {
          const kilometers = parseFloat(appointment.kilometers) || 0;
          totalAmount = kilometers * (category.rate || 0);
        } else {
          const acres = parseFloat(appointment.acre) || 0;
          totalAmount = acres * (category.rate || 0);
        }
      }
      return {
        ID: appointment._id,
        Name: appointment.name,
        Email: appointment.email || 'Not provided',
        'Contact Number': appointment.contactNumber,
        Address: appointment.address,
        Village: appointment.village,
        'PIN Code': appointment.pincode,
        District: appointment.district,
        State: appointment.state,
        Gunta: appointment.gunta || 'None',
        Acre: appointment.acre || 'None',
        Area: appointment.area || 'None',
        '7/12 Number': appointment.sevenTwelveNumber || 'None',
        'Khata Number': appointment.khataNumber || 'None',
        'Work Category': appointment.workCategory,
        Date: appointment.date,
        Time: Array.isArray(appointment.time) ? appointment.time.join(', ') : appointment.time,
        Remark: appointment.remark || 'None',
        'Payment Mode': appointment.paymentMode === 'online' ? 'Online (Razorpay)' : 'Cash',
        'Payment Status': appointment.paymentStatus === 'completed' ? 'Paid' : appointment.paymentStatus === 'pending' ? 'Unpaid' : 'Failed',
        Attempted: appointment.attempted ? 'Yes' : 'No',
        'Pickup Location': appointment.pickupLocation || 'N/A',
        'Delivery Location': appointment.deliveryLocation || 'N/A',
        Kilometers: appointment.kilometers || 'N/A',
        'Total Amount (INR)': totalAmount.toFixed(2),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Appointments');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  const renderSection = (appointments, title, cardClass) => (
    <div className='section'>
      <div className='section-header'>
        <h3 className='section-title'>{title} Appointments ({appointments.length})</h3>
        <a href='#' onClick={() => handleExportExcel(appointments, `${title.toLowerCase()}_appointments`)} className='export-link'>Export {title}</a>
      </div>
      {appointments.length === 0 ? (
        <p className='no-appointments'>No {title.toLowerCase()} appointments.</p>
      ) : (
        <div className='appointment-grid'>
          {appointments.map((appointment) => (
            <div key={appointment._id} className={`appointment-card ${cardClass}`}>
              <div className='card-actions'>
                <button onClick={() => handleDownloadInvoice(appointment)} className='action-button download' title='Download Invoice' disabled={loading[appointment._id]}><FaDownload /></button>
                <button onClick={() => handleEdit(appointment)} className='action-button edit' title='Edit' disabled={loading[appointment._id]}><FaEdit /></button>
                <button onClick={() => handleDelete(appointment._id)} className='action-button delete' title='Delete' disabled={loading[appointment._id]}><FaTrash /></button>
              </div>
              {editingId === appointment._id ? (
                <>
                  <p className='card-detail'><strong>Name:</strong> <input type='text' name='name' value={editForm.name} onChange={handleEditChange} placeholder='Name' className='edit-input w-full' required /></p>
                  <p className='card-detail'><strong>Email:</strong> <input type='email' name='email' value={editForm.email} onChange={handleEditChange} placeholder='Email (optional)' className='edit-input w-full' /></p>
                  <p className='card-detail'><strong>Contact Number:</strong> <input type='text' name='contactNumber' value={editForm.contactNumber} onChange={handleEditChange} placeholder='Contact Number' className='edit-input w-full' required /></p>
                  <p className='card-detail'><strong>Address:</strong> <input type='text' name='address' value={editForm.address} onChange={handleEditChange} placeholder='Address' className='edit-input w-full' required /></p>
                  <p className='card-detail'><strong>Village:</strong> <input type='text' name='village' value={editForm.village} onChange={handleEditChange} placeholder='Village' className='edit-input w-full' required /></p>
                  <p className='card-detail'><strong>PIN Code:</strong> <input type='text' name='pincode' value={editForm.pincode} onChange={handleEditChange} placeholder='PIN Code' className='edit-input w-full' required /></p>
                  <p className='card-detail'><strong>District:</strong> <input type='text' name='district' value={editForm.district} onChange={handleEditChange} placeholder='District' className='edit-input w-full' required /></p>
                  <p className='card-detail'><strong>State:</strong> <input type='text' name='state' value={editForm.state} onChange={handleEditChange} placeholder='State' className='edit-input w-full' required /></p>
                  {editForm.workCategory === 'Transport' || editForm.workCategory === 'Customize' ? (
                    <>
                      <p className='card-detail'><strong>Pickup Location:</strong> <input type='text' name='pickupLocation' value={editForm.pickupLocation} onChange={handleEditChange} placeholder='Pickup Location' className='edit-input w-full' required /></p>
                      <p className='card-detail'><strong>Delivery Location:</strong> <input type='text' name='deliveryLocation' value={editForm.deliveryLocation} onChange={handleEditChange} placeholder='Delivery Location' className='edit-input w-full' required /></p>
                      <p className='card-detail'><strong>Kilometers:</strong> <input type='text' name='kilometers' value={editForm.kilometers} onChange={handleEditChange} placeholder='Kilometers' className='edit-input w-full' required /></p>
                    </>
                  ) : (
                    <>
                      <p className='card-detail'><strong>Gunta:</strong> <input type='number' name='gunta' value={editForm.gunta} onChange={handleEditChange} placeholder='Gunta' className='edit-input w-full' min='0' step='0.1' /></p>
                      <p className='card-detail'><strong>Acre:</strong> <input type='number' name='acre' value={editForm.acre} onChange={handleEditChange} placeholder='Acre' className='edit-input w-full' min='0' step='0.001' /></p>
                      <p className='card-detail'><strong>Area:</strong> <input type='text' name='area' value={editForm.area} onChange={handleEditChange} placeholder='Area' className='edit-input w-full' readOnly /></p>
                      <p className='card-detail'><strong>7/12 Number:</strong> <input type='text' name='sevenTwelveNumber' value={editForm.sevenTwelveNumber} onChange={handleEditChange} placeholder='7/12 Number' className='edit-input w-full' required /></p>
                      <p className='card-detail'><strong>Khata Number:</strong> <input type='text' name='khataNumber' value={editForm.khataNumber} onChange={handleEditChange} placeholder='Khata Number (optional)' className='edit-input w-full' /></p>
                    </>
                  )}
                  <p className='card-detail'><strong>Work Category:</strong> <select name='workCategory' value={editForm.workCategory} onChange={handleEditChange} className='edit-input w-full' required>
                    <option value='' disabled>Select a work category</option>
                    {workCategories.map((category, index) => (
                      <option key={index} value={category.name}>{category.name} (₹{category.rate} per acre)</option>
                    ))}
                  </select></p>
                  <p className='card-detail'><strong>Date:</strong> <input type='date' name='date' value={editForm.date} onChange={handleEditChange} className='edit-input w-full' required min={today} /></p>
                  <p className='card-detail'><strong>Time:</strong> <input type='time' name='time' value={editForm.time} onChange={handleEditChange} className='edit-input w-full' required /></p>
                  <p className='card-detail'><strong>Remark:</strong> <textarea name='remark' value={editForm.remark} onChange={handleEditChange} placeholder='Remark (optional)' className='edit-textarea w-full' /></p>
                  <p className='card-detail'><strong>Payment Mode:</strong> <select name='paymentMode' value={editForm.paymentMode} onChange={handleEditChange} className='edit-input w-full' required>
                    <option value='online'>Online (Razorpay)</option>
                    <option value='cash'>Cash</option>
                  </select></p>
                  <p className='card-detail'><strong>Payment Status:</strong> <select name='paymentStatus' value={editForm.paymentStatus} onChange={handleEditChange} className='edit-input w-full' required>
                    <option value='completed'>Paid</option>
                    <option value='pending'>Unpaid</option>
                    <option value='failed'>Failed</option>
                  </select></p>
                  <p className='card-detail'><strong>Attempted:</strong> <input type='checkbox' name='attempted' checked={editForm.attempted} onChange={handleEditChange} className='edit-input' /></p>
                  <div className='edit-actions'>
                    <button onClick={() => handleEditSubmit(appointment._id)} className='save-button' disabled={loading[appointment._id] === 'edit'}>{loading[appointment._id] === 'edit' ? 'Saving...' : 'Save'}</button>
                    <button onClick={() => setEditingId(null)} className='cancel-button' disabled={loading[appointment._id] === 'edit'}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <h4 className='card-title'>{appointment.name}</h4>
                  <p className='card-detail'><strong>Email:</strong> {appointment.email || 'Not provided'}</p>
                  <p className='card-detail'><strong>Contact:</strong> {appointment.contactNumber}</p>
                  <p className='card-detail'><strong>Address:</strong> {appointment.address}</p>
                  <p className='card-detail'><strong>Village:</strong> {appointment.village}</p>
                  <p className='card-detail'><strong>PIN Code:</strong> {appointment.pincode}</p>
                  <p className='card-detail'><strong>District:</strong> {appointment.district}</p>
                  <p className='card-detail'><strong>State:</strong> {appointment.state}</p>
                  {appointment.workCategory === 'Transport' || appointment.workCategory === 'Customize' ? (
                    <>
                      <p className='card-detail'><strong>Pickup Location:</strong> {appointment.pickupLocation || 'N/A'}</p>
                      <p className='card-detail'><strong>Delivery Location:</strong> {appointment.deliveryLocation || 'N/A'}</p>
                      <p className='card-detail'><strong>Kilometers:</strong> {appointment.kilometers || 'N/A'}</p>
                    </>
                  ) : (
                    <>
                      <p className='card-detail'><strong>Gunta:</strong> {appointment.gunta || 'None'}</p>
                      <p className='card-detail'><strong>Acre:</strong> {appointment.acre || 'None'}</p>
                      <p className='card-detail'><strong>Area:</strong> {appointment.area || 'None'}</p>
                      <p className='card-detail'><strong>7/12 Number:</strong> {appointment.sevenTwelveNumber || 'None'}</p>
                      <p className='card-detail'><strong>Khata Number:</strong> {appointment.khataNumber || 'None'}</p>
                    </>
                  )}
                  <p className='card-detail'><strong>Work Category:</strong> {appointment.workCategory}</p>
                  <p className='card-detail'><strong>Date:</strong> {appointment.date}</p>
                  <p className='card-detail'><strong>Time:</strong> {Array.isArray(appointment.time) ? appointment.time[0] : appointment.time}</p>
                  <p className='card-detail'><strong>Remark:</strong> {appointment.remark || 'None'}</p>
                  <p className='card-detail'><strong>Payment Mode:</strong> {appointment.paymentMode === 'online' ? 'Online (Razorpay)' : 'Cash'}</p>
                  <p className='card-detail'><strong>Payment Status:</strong> {appointment.paymentStatus === 'completed' ? 'Paid' : appointment.paymentStatus === 'pending' ? 'Unpaid' : 'Failed'}</p>
                  <p className='card-detail'><strong>Status:</strong> <button onClick={() => handleToggleAttempted(appointment, appointment.attempted ? 'not-attended' : 'attended')} className='mark-attended-button' disabled={loading[appointment._id] === 'attempted'}>{loading[appointment._id] === 'attempted' ? 'Updating...' : appointment.attempted ? 'Mark Not Attended' : 'Mark Attended'}</button></p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className='admin-panel'>
      <div className='panel-header'>
        <h2>Appointments</h2>
        <div className='search-bar'>
          <select value={searchField} onChange={(e) => setSearchField(e.target.value)} className='search-select'>
            <option value='name'>Name</option>
            <option value='contactNumber'>Contact Number</option>
            <option value='paymentStatus'>Payment Status</option>
            <option value='paymentMode'>Payment Mode</option>
            <option value='sevenTwelveNumber'>7/12 Number</option>
          </select>
          <input type='text' value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={`Search by ${searchField}`} className='search-input' />
          <a href='#' onClick={() => handleExportExcel(filteredAppointments, 'filtered_appointments')} className='export-link'>Export Filtered</a>
          <a href='#' onClick={() => handleExportExcel(localAppointments, 'all_appointments')} className='export-link'>Export All</a>
          <div className='button-row'>
            {/* <button onClick={onCreateUser} className='create-user-button'>Create User</button> */}
            <button onClick={handleLogout} className='logout-button'>Logout</button>
          </div>
        </div>
      </div>
      {renderSection(todayAppointments, "Today's", 'today-card')}
      {renderSection(futureAppointments, 'Future', 'future-card')}
      {renderSection(completedAppointments, 'Completed', 'completed-card')}
    </div>
  );
}

export default AdminPanel;