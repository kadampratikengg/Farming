import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { FaDownload, FaTimes } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './BookingForm.css';
import initiatePayment from './RazorpayPayment';
import generateInvoicePDF from './Invoice';

// Local logo path (adjust if needed)
const WHATSAPP_NUMBER = process.env.REACT_APP_WHATSAPP_NUMBER || 'YOUR_PHONE_NUMBER'; // Fallback if not set

function BookingForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    contactNumber: '',
    pincode: '',
    address: '',
    district: '',
    state: '',
    village: '',
    gunta: '',
    acre: '',
    area: '',
    sevenTwelveNumber: '',
    khataNumber: '',
    workCategory: '',
    date: '',
    time: '',
    remark: '',
    paymentMode: 'online',
  });
  const [bookedSlots, setBookedSlots] = useState([]);
  const [showBookingCard, setShowBookingCard] = useState(false);
  const [bookingDetails, setBookingDetails] = useState(null);

  // Get current system date and time
  const now = new Date();
  const istOffset = 0.1 * 60 * 60 * 1000; // Adjusted as requested (UTC+0:06)
  const currentIST = new Date(now.getTime() + istOffset);
  const currentDate = currentIST.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  const currentHours = currentIST.getHours();
  const currentMinutes = currentIST.getMinutes();

  // Work categories and rates from environment variables
  const workCategories = JSON.parse(process.env.REACT_APP_WORK_CATEGORIES || '[]');

  // Generate time options
  const timeOptions = useMemo(() => {
    const options = [];
    let startHour, startMinute;

    if (formData.date === currentDate) {
      // For today, start from current time + 30 minutes, rounded to nearest 30-minute slot
      const totalMinutes = currentHours * 60 + currentMinutes;
      const nextSlotMinutes = Math.ceil((totalMinutes + 30) / 30) * 30;
      startHour = Math.floor(nextSlotMinutes / 60);
      startMinute = nextSlotMinutes % 60;
    } else {
      // For future days, start from 9:00 AM
      startHour = 9;
      startMinute = 0;
    }

    const endHour = 17; // 5:00 PM
    for (let hour = startHour; hour <= endHour; hour++) {
      const minutes = hour === startHour ? startMinute : 0;
      for (let minute = minutes; minute < 60; minute += 30) {
        if (hour === endHour && minute > 0) break; // Stop at 5:00 PM
        const isPM = hour >= 12;
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const timeLabel = `${displayHour}:${minute.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
        options.push({ value: timeValue, label: timeLabel });
      }
    }
    return options;
  }, [formData.date, currentDate, currentHours, currentMinutes]);

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    if (name === 'date' && value < currentDate) {
      toast.error('Cannot select a past date.');
      return;
    }
    // Validate contact number
    if (name === 'contactNumber') {
      const phoneRegex = /^(\+)?\d{0,13}$/;
      if (value && !phoneRegex.test(value)) {
        toast.error('Contact number must be 10-13 digits with optional + prefix.');
        return;
      }
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    // Validate PIN code
    else if (name === 'pincode') {
      const pinRegex = /^[0-9]{0,6}$/;
      if (value && !pinRegex.test(value)) {
        toast.error('PIN code must be exactly 6 digits.');
        return;
      }
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    // Handle gunta and acre conversion
    else if (name === 'gunta' || name === 'acre') {
      const newValue = value === '' ? '' : parseFloat(value);
      let newState = { ...formData, [name]: newValue };
      if (name === 'gunta') {
        newState.acre = newValue ? (newValue / 40).toFixed(3) : '';
        newState.area = newValue ? `${newValue} gunta` : '';
      } else if (name === 'acre') {
        newState.gunta = newValue ? (newValue * 40).toFixed(2) : '';
        newState.area = newValue ? `${newValue} acres` : '';
      }
      setFormData(newState);
    } else {
      setFormData((prev) => ({ ...prev, [name]: value, time: name === 'date' ? '' : prev.time }));
    }

    // Fetch address details based on pincode
    if (name === 'pincode' && value.length === 6) {
      try {
        const response = await axios.get(`https://api.postalpincode.in/pincode/${value}`);
        const postOffice = response.data[0]?.PostOffice?.[0];
        if (postOffice) {
          setFormData((prev) => ({
            ...prev,
            district: postOffice.District,
            state: postOffice.State,
          }));
        } else {
          toast.error('Invalid PIN code. Please try again.');
          setFormData((prev) => ({ ...prev, district: '', state: '' }));
        }
      } catch (err) {
        console.error('Error fetching PIN code data:', err);
        toast.error('Failed to fetch address details. Please try again.');
        setFormData((prev) => ({ ...prev, district: '', state: '' }));
      }
    }
  };

  const handleTimeSelect = (time) => {
    if (bookedSlots.includes(time)) {
      toast.error('This time slot is already booked.');
      return;
    }
    setFormData((prev) => ({ ...prev, time }));
  };

  const calculateTotalPrice = () => {
    const selectedCategory = workCategories.find(cat => cat.name === formData.workCategory);
    const rate = selectedCategory ? selectedCategory.rate : 20;
    const acres = parseFloat(formData.acre) || parseFloat(formData.gunta) / 40 || 0;
    return (rate * acres).toFixed(2);
  };

  const downloadCardAsPDF = () => {
    generateInvoicePDF(bookingDetails, bookingDetails.paymentMode === 'online');
  };

  const closePopup = () => {
    setShowBookingCard(false);
    setBookingDetails(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validate all required fields (email excluded)
    const requiredFields = ['name', 'contactNumber', 'area', 'pincode', 'address', 'district', 'state', 'village', 'workCategory', 'date', 'time', 'sevenTwelveNumber'];
    const missingFields = requiredFields.filter(field => !formData[field]);
    if (missingFields.length > 0) {
      toast.error(`Please fill in: ${missingFields.join(', ')}`);
      return;
    }
    if (!/^(\+)?\d{10,13}$/.test(formData.contactNumber)) {
      toast.error('Contact number must be 10-13 digits with optional + prefix.');
      return;
    }
    if (!formData.gunta && !formData.acre) {
      toast.error('Please enter either gunta or acre.');
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const selectedCategory = workCategories.find(cat => cat.name === formData.workCategory);
      const slotPrice = selectedCategory ? selectedCategory.rate * (parseFloat(formData.acre) || parseFloat(formData.gunta) / 40) : 20;

      const bookingData = {
        ...formData,
        _id: `temp-${Date.now()}`,
        time: [formData.time],
        attempted: false,
      };

      if (formData.paymentMode === 'cash') {
        const response = await axios.post(`${apiUrl}/appointments`, {
          ...formData,
          time: [formData.time],
          paymentStatus: 'pending',
          paymentMode: 'cash',
        }, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        toast.success('Appointment booked successfully! Please proceed with cash payment.');
        setBookingDetails({ ...bookingData, _id: response.data._id });
        setShowBookingCard(true);
        setBookedSlots([...bookedSlots, formData.time]);
        setFormData({
          name: '',
          email: '',
          contactNumber: '',
          pincode: '',
          address: '',
          district: '',
          state: '',
          village: '',
          gunta: '',
          acre: '',
          area: '',
          sevenTwelveNumber: '',
          khataNumber: '',
          workCategory: '',
          date: '',
          time: '',
          remark: '',
          paymentMode: 'online',
        });
        generateInvoicePDF(bookingDetails, false);
      } else {
        const orderResponse = await axios.post(
          `${apiUrl}/appointments/create-order`,
          {
            amount: Math.round(slotPrice * 100),
            currency: 'INR',
            slots: [formData.time],
            date: formData.date,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        const { orderId } = orderResponse.data;

        const result = await initiatePayment({
          orderId,
          amount: Math.round(slotPrice * 100),
          formData: { ...formData, time: [formData.time] },
          apiUrl,
          onSuccess: (bookingResponse) => {
            toast.success('Appointment booked successfully!');
            setBookingDetails({
              ...bookingData,
              _id: bookingResponse.data._id || bookingData._id,
              time: Array.isArray(bookingResponse.data.time) ? bookingResponse.data.time : [bookingResponse.data.time],
            });
            setShowBookingCard(true);
            setBookedSlots([...bookedSlots, formData.time]);
            setFormData({
              name: '',
              email: '',
              contactNumber: '',
              pincode: '',
              address: '',
              district: '',
              state: '',
              village: '',
              gunta: '',
              acre: '',
              area: '',
              sevenTwelveNumber: '',
              khataNumber: '',
              workCategory: '',
              date: '',
              time: '',
              remark: '',
              paymentMode: 'online',
            });
            generateInvoicePDF(bookingDetails, true);
          },
          onError: (errorMessage) => {
            console.error('Payment initiation error:', errorMessage);
            toast.error(errorMessage || 'Failed to initiate payment. Please try again or use cash payment.');
          },
        });
        if (!result) {
          toast.error('Failed to initiate payment. Please try again or use cash payment.');
        }
      }
    } catch (err) {
      console.error('Error processing submission:', err.response || err.message);
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        'Failed to process submission. Please try again.';
      toast.error(errorMessage);
    }
  };

  useEffect(() => {
    if (formData.date) {
      const fetchBookedSlots = async () => {
        try {
          const apiUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/appointments?date=${formData.date}`;
          const response = await axios.get(apiUrl, {
            headers: {
              'Content-Type': 'application/json',
            },
          });
          setBookedSlots(response.data);
        } catch (err) {
          console.error('Error fetching booked slots:', err);
          toast.error('Failed to fetch booked slots. Please try again.');
        }
      };
      fetchBookedSlots();
    }
  }, [formData.date]);

  return (
    <div className='booking-form-container'>
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} closeOnClick pauseOnHover />
      {showBookingCard && bookingDetails && (
        <div className='modal'>
          <div className='modal-content'>
            <div className='appointment-card today-card'>
              <h4 className='card-title'>{bookingDetails.name}</h4>
              <p className='card-detail'><strong>Email:</strong> {bookingDetails.email || 'Not provided'}</p>
              <p className='card-detail'><strong>Contact:</strong> {bookingDetails.contactNumber}</p>
              <p className='card-detail'><strong>Address:</strong> {bookingDetails.address}</p>
              <p className='card-detail'><strong>PIN Code:</strong> {bookingDetails.pincode}</p>
              <p className='card-detail'><strong>District:</strong> {bookingDetails.district}</p>
              <p className='card-detail'><strong>State:</strong> {bookingDetails.state}</p>
              <p className='card-detail'><strong>Village:</strong> {bookingDetails.village}</p>
              <p className='card-detail'><strong>Area:</strong> {bookingDetails.area || 'None'}</p>
              <p className='card-detail'><strong>Gunta:</strong> {bookingDetails.gunta || 'None'}</p>
              <p className='card-detail'><strong>Acre:</strong> {bookingDetails.acre || 'None'}</p>
              <p className='card-detail'><strong>7/12 Number:</strong> {bookingDetails.sevenTwelveNumber}</p>
              <p className='card-detail'><strong>Khata Number:</strong> {bookingDetails.khataNumber || 'None'}</p>
              <p className='card-detail'><strong>Work Category:</strong> {bookingDetails.workCategory}</p>
              <p className='card-detail'><strong>Date:</strong> {bookingDetails.date}</p>
              <p className='card-detail'><strong>Time:</strong> {Array.isArray(bookingDetails.time) ? bookingDetails.time.join(', ') : bookingDetails.time}</p>
              <p className='card-detail'><strong>Remark:</strong> {bookingDetails.remark || 'None'}</p>
              <p className='card-detail'><strong>Payment Mode:</strong> {bookingDetails.paymentMode === 'online' ? 'Online (Razorpay)' : 'Cash'}</p>
              <p className='card-detail'><strong>Status:</strong> {bookingDetails.attempted ? 'Attempted' : 'Not Attempted'}</p>
              <div className='card-actions'>
                <button
                  onClick={downloadCardAsPDF}
                  className='action-button download'
                >
                  <FaDownload className='w-5 h-5' />
                </button>
                <button
                  onClick={closePopup}
                  className='action-button close'
                >
                  <FaTimes className='w-5 h-5' />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name</label>
          <input
            type='text'
            name='name'
            value={formData.name}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label>Email</label>
          <input
            type='email'
            name='email'
            value={formData.email}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label>Contact Number</label>
          <input
            type='tel'
            name='contactNumber'
            value={formData.contactNumber}
            onChange={handleInputChange}
            pattern='(\\+)?[0-9]{10,13}'
            placeholder='Enter 10-13 digits (e.g., +919876543210 or 9876543210)'
            required
          />
        </div>
        <div>
          <label>Address</label>
          <input
            type='text'
            name='address'
            value={formData.address}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label>Village</label>
          <input
            type='text'
            name='village'
            value={formData.village}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label>PIN Code</label>
          <input
            type='text'
            name='pincode'
            value={formData.pincode}
            onChange={handleInputChange}
            pattern='[0-9]{6}'
            maxLength='6'
            required
          />
        </div>
        <div>
          <label>District</label>
          <input
            type='text'
            name='district'
            value={formData.district}
            onChange={handleInputChange}
            readOnly
          />
        </div>
        <div>
          <label>State</label>
          <input
            type='text'
            name='state'
            value={formData.state}
            onChange={handleInputChange}
            readOnly
          />
        </div>
        <div className='flex space-x-4'>
          <div className='flex-1'>
            <label>Gunta</label>
            <input
              type='number'
              name='gunta'
              value={formData.gunta}
              onChange={handleInputChange}
              min='0'
              step='0.1'
            />
          </div>
          <div className='flex-1'>
            <label>Acre</label>
            <input
              type='number'
              name='acre'
              value={formData.acre}
              onChange={handleInputChange}
              min='0'
              step='0.001'
            />
          </div>
        </div>
        <div className='flex space-x-4'>
          <div className='flex-1'>
            <label>7/12 Number</label>
            <input
              type='text'
              name='sevenTwelveNumber'
              value={formData.sevenTwelveNumber}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className='flex-1'>
            <label>Khata Number</label>
            <input
              type='text'
              name='khataNumber'
              value={formData.khataNumber}
              onChange={handleInputChange}
            />
          </div>
        </div>
        <div className='whatsapp-link'>
          <a
            href='https://bhulekh.mahabhumi.gov.in/'
            target='_blank'
            rel='noopener noreferrer'
          >
            Don’t know your 7/12 or Khata number? Click here to find it.
          </a>
        </div>
        <div>
          <label>Work Category</label>
          <select
            name='workCategory'
            value={formData.workCategory}
            onChange={handleInputChange}
            className='custom-select'
            required
          >
            <option value='' disabled>
              Select a work category
            </option>
            {workCategories.map((category, index) => (
              <option key={index} value={category.name}>
                {category.name} (₹{category.rate} per acre)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Payment Mode</label>
          <select
            name='paymentMode'
            value={formData.paymentMode}
            onChange={handleInputChange}
            className='custom-select'
            required
          >
            <option value='online'>Online (Razorpay)</option>
            <option value='cash'>Cash</option>
          </select>
        </div>
        <div>
          <label>Date</label>
          <input
            type='date'
            name='date'
            value={formData.date}
            onChange={handleInputChange}
            required
            min={currentDate}
          />
        </div>
        <div>
          <label>Time Slot</label>
          {formData.date ? (
            timeOptions.length > 0 ? (
              <div className='time-table-container'>
                <table className='time-table'>
                  <tbody>
                    {Array.from({ length: Math.ceil(timeOptions.length / 4) }).map((_, rowIndex) => (
                      <tr key={rowIndex}>
                        {timeOptions.slice(rowIndex * 4, rowIndex * 4 + 4).map((option) => (
                          <td
                            key={option.value}
                            className={`time-slot ${formData.time === option.value ? 'selected' : ''} ${
                              bookedSlots.includes(option.value) ? 'booked' : ''
                            }`}
                            onClick={() => handleTimeSelect(option.value)}
                          >
                            {option.label}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className='text-sm text-gray-500'>
                {formData.date === currentDate
                  ? `No time slots available for today after ${currentHours}:${currentMinutes.toString().padStart(2, '0')} PM.`
                  : 'No available time slots for this date.'}
              </p>
            )
          ) : (
            <p className='text-sm text-gray-500'>Please select a date to view available time slots.</p>
          )}
        </div>
        <div>
          <label>Remark</label>
          <textarea
            name='remark'
            value={formData.remark}
            onChange={handleInputChange}
            className='custom-textarea'
            rows='4'
          />
        </div>
        <div>
          <p className='text-sm font-medium'>
            Total: ₹{calculateTotalPrice()}
          </p>
        </div>
        <button
          type='submit'
        >
          Proceed to {formData.paymentMode === 'online' ? 'Payment' : 'Booking'}
        </button>
      </form>
      <div className='whatsapp-link'>
        <a
          href={`https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=Hello! I have a question about my appointment.`}
          target='_blank'
          rel='noopener noreferrer'
        >
          Contact Us on WhatsApp
        </a>
      </div>
    </div>
  );
}

export default BookingForm;