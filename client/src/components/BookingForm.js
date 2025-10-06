import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { FaDownload, FaTimes } from 'react-icons/fa';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './BookingForm.css';
import initiatePayment from './RazorpayPayment';
import generateInvoicePDF from './Invoice';

// Configuration
const WHATSAPP_NUMBER = process.env.REACT_APP_WHATSAPP_NUMBER || 'YOUR_PHONE_NUMBER';
const NOMINATIM_USER_AGENT = process.env.REACT_APP_NOMINATIM_USER_AGENT || 'YourAppName';
const TRANSPORT_MINIMUM_RATE = parseFloat(process.env.REACT_APP_TRANSPORT_MINIMUM_RATE) || 500;

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
    pickupLocation: '',
    deliveryLocation: '',
    kilometers: '',
    pickupCoords: null,
    deliveryCoords: null,
  });
  const [bookedSlots, setBookedSlots] = useState([]);
  const [showBookingCard, setShowBookingCard] = useState(false);
  const [bookingDetails, setBookingDetails] = useState(null);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [deliverySuggestions, setDeliverySuggestions] = useState([]);

  // Get current system date and time (IST)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const currentIST = new Date(now.getTime() + istOffset);
  const currentDate = currentIST.toISOString().split('T')[0];
  const currentHours = currentIST.getHours();
  const currentMinutes = currentIST.getMinutes();

  // Work categories
  const workCategories = JSON.parse(process.env.REACT_APP_WORK_CATEGORIES || '[]');

  // Generate time options
  const timeOptions = useMemo(() => {
    const options = [];
    let startHour, startMinute;

    if (formData.date === currentDate) {
      const totalMinutes = currentHours * 60 + currentMinutes;
      const nextSlotMinutes = Math.ceil((totalMinutes + 30) / 30) * 30;
      startHour = Math.floor(nextSlotMinutes / 60);
      startMinute = nextSlotMinutes % 60;
    } else {
      startHour = 9;
      startMinute = 0;
    }

    const endHour = 17;
    for (let hour = startHour; hour <= endHour; hour++) {
      const minutes = hour === startHour ? startMinute : 0;
      for (let minute = minutes; minute < 60; minute += 30) {
        if (hour === endHour && minute > 0) break;
        const isPM = hour >= 12;
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const timeLabel = `${displayHour}:${minute.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
        options.push({ value: timeValue, label: timeLabel });
      }
    }
    return options;
  }, [formData.date, currentDate, currentHours, currentMinutes]);

  // Debounced Nominatim search
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  const handleSearch = debounce(async (input, type) => {
    if (input.length < 3) {
      type === 'pickup' ? setPickupSuggestions([]) : setDeliverySuggestions([]);
      return;
    }
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: input,
          format: 'json',
          addressdetails: 1,
          limit: 5,
          countrycodes: 'in',
        },
        headers: { 'User-Agent': NOMINATIM_USER_AGENT },
      });
      const suggestions = response.data;
      type === 'pickup' ? setPickupSuggestions(suggestions) : setDeliverySuggestions(suggestions);
    } catch (err) {
      console.error('Nominatim error:', err);
      toast.error('Failed to fetch location suggestions.');
    }
  }, 500);

  // Haversine formula for distance calculation
  const calculateDistance = () => {
    if (formData.pickupCoords && formData.deliveryCoords) {
      const { lat: lat1, lon: lon1 } = formData.pickupCoords;
      const { lat: lat2, lon: lon2 } = formData.deliveryCoords;
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      setFormData(prev => ({ ...prev, kilometers: distance.toFixed(2) }));
    }
  };

  const handleInputChange = async (e) => {
    const { name, value } = e.target;
    if (name === 'date' && value < currentDate) {
      toast.error('Cannot select a past date.');
      return;
    }
    if (name === 'contactNumber') {
      const phoneRegex = /^(\+)?\d{0,13}$/;
      if (value && !phoneRegex.test(value)) {
        toast.error('Contact number must be 10-13 digits with optional + prefix.');
        return;
      }
    } else if (name === 'pincode') {
      const pinRegex = /^[0-9]{0,6}$/;
      if (value && !pinRegex.test(value)) {
        toast.error('PIN code must be exactly 6 digits.');
        return;
      }
    } else if (name === 'kilometers') {
      const kmRegex = /^[0-9]*\.?[0-9]*$/;
      if (value && !kmRegex.test(value)) {
        toast.error('Kilometers must be a valid number.');
        return;
      }
    } else if (name === 'gunta' || name === 'acre') {
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
      return;
    } else if (name === 'workCategory' && value !== 'Transport') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        time: name === 'date' ? '' : prev.time,
        pickupLocation: '',
        deliveryLocation: '',
        kilometers: '',
        pickupCoords: null,
        deliveryCoords: null,
      }));
      setPickupSuggestions([]);
      setDeliverySuggestions([]);
      return;
    } else if (name === 'pickupLocation') {
      handleSearch(value, 'pickup');
    } else if (name === 'deliveryLocation') {
      handleSearch(value, 'delivery');
    }

    setFormData(prev => ({ ...prev, [name]: value, time: name === 'date' ? '' : prev.time }));

    if (name === 'pincode' && value.length === 6) {
      try {
        const response = await axios.get(`https://api.postalpincode.in/pincode/${value}`);
        const postOffice = response.data[0]?.PostOffice?.[0];
        if (postOffice) {
          setFormData(prev => ({
            ...prev,
            district: postOffice.District,
            state: postOffice.State,
          }));
        } else {
          toast.error('Invalid PIN code. Please try again.');
          setFormData(prev => ({ ...prev, district: '', state: '' }));
        }
      } catch (err) {
        console.error('Error fetching PIN code data:', err);
        toast.error('Failed to fetch address details. Please try again.');
        setFormData(prev => ({ ...prev, district: '', state: '' }));
      }
    }
  };

  const handleSuggestionSelect = (suggestion, type) => {
    setFormData(prev => ({
      ...prev,
      [type === 'pickup' ? 'pickupLocation' : 'deliveryLocation']: suggestion.display_name,
      [type === 'pickup' ? 'pickupCoords' : 'deliveryCoords']: {
        lat: parseFloat(suggestion.lat),
        lon: parseFloat(suggestion.lon),
      },
    }));
    type === 'pickup' ? setPickupSuggestions([]) : setDeliverySuggestions([]);
  };

  const handleTimeSelect = (time) => {
    if (bookedSlots.includes(time)) {
      toast.error('This time slot is already booked.');
      return;
    }
    setFormData(prev => ({ ...prev, time }));
  };

  const calculateTotalPrice = () => {
    const selectedCategory = workCategories.find(cat => cat.name === formData.workCategory);
    if (selectedCategory?.name === 'Transport') {
      const kilometers = parseFloat(formData.kilometers) || 0;
      const kmRate = selectedCategory.rate || 14; // Use rate from env
      const roundTripKm = kilometers * 2; // Multiply by 2 for round trip
      const calculatedPrice = roundTripKm * kmRate;
      return calculatedPrice < TRANSPORT_MINIMUM_RATE ? TRANSPORT_MINIMUM_RATE.toFixed(2) : calculatedPrice.toFixed(2);
    } else if (selectedCategory?.name === 'Customize') {
      const kilometers = parseFloat(formData.kilometers) || 0;
      const kmRate = 14;
      const calculatedPrice = kilometers * kmRate;
      return calculatedPrice > 500 ? calculatedPrice.toFixed(2) : '500.00';
    } else {
      const rate = selectedCategory ? selectedCategory.rate : 20;
      const acres = parseFloat(formData.acre) || parseFloat(formData.gunta) / 40 || 0;
      return (rate * acres).toFixed(2);
    }
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
    const requiredFields = ['name', 'contactNumber', 'pincode', 'address', 'district', 'state', 'village', 'workCategory', 'date', 'time', 'sevenTwelveNumber'];
    if (formData.workCategory === 'Transport') {
      requiredFields.push('pickupLocation', 'deliveryLocation', 'kilometers');
    } else if (formData.workCategory !== 'Customize') {
      requiredFields.push('area');
    }
    const missingFields = requiredFields.filter(field => !formData[field]);
    if (missingFields.length > 0) {
      toast.error(`Please fill in: ${missingFields.join(', ')}`);
      return;
    }
    if (!/^(\+)?\d{10,13}$/.test(formData.contactNumber)) {
      toast.error('Contact number must be 10-13 digits with optional + prefix.');
      return;
    }
    if (formData.workCategory !== 'Transport' && formData.workCategory !== 'Customize' && !formData.gunta && !formData.acre) {
      toast.error('Please enter either gunta or acre.');
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const selectedCategory = workCategories.find(cat => cat.name === formData.workCategory);
      const slotPrice = selectedCategory?.name === 'Transport'
        ? Math.max(parseFloat(formData.kilometers) * 2 * (selectedCategory.rate || 14), TRANSPORT_MINIMUM_RATE) // Round trip: km * 2 * rate, min from env
        : selectedCategory?.name === 'Customize'
        ? (parseFloat(formData.kilometers) * 14 > 500 ? parseFloat(formData.kilometers) * 14 : 500)
        : selectedCategory ? selectedCategory.rate * (parseFloat(formData.acre) || parseFloat(formData.gunta) / 40) : 20;

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
          headers: { 'Content-Type': 'application/json' },
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
          pickupLocation: '',
          deliveryLocation: '',
          kilometers: '',
          pickupCoords: null,
          deliveryCoords: null,
        });
        setPickupSuggestions([]);
        setDeliverySuggestions([]);
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
          { headers: { 'Content-Type': 'application/json' } }
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
              pickupLocation: '',
              deliveryLocation: '',
              kilometers: '',
              pickupCoords: null,
              deliveryCoords: null,
            });
            setPickupSuggestions([]);
            setDeliverySuggestions([]);
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
      const errorMessage = err.response?.data?.error || err.message || 'Failed to process submission. Please try again.';
      toast.error(errorMessage);
    }
  };

  useEffect(() => {
    if (formData.date) {
      const fetchBookedSlots = async () => {
        try {
          const apiUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/appointments?date=${formData.date}`;
          const response = await axios.get(apiUrl, {
            headers: { 'Content-Type': 'application/json' },
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

  useEffect(() => {
    if (formData.workCategory === 'Transport' && formData.pickupCoords && formData.deliveryCoords) {
      calculateDistance();
    }
  }, [formData.pickupCoords, formData.deliveryCoords]);

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
              <p className='card-detail'><strong>7/12 Number:</strong> {bookingDetails.sevenTwelveNumber}</p>
              <p className='card-detail'><strong>Khata Number:</strong> {bookingDetails.khataNumber || 'None'}</p>
              <p className='card-detail'><strong>Work Category:</strong> {bookingDetails.workCategory}</p>
              {bookingDetails.workCategory !== 'Transport' && (
                <>
                  <p className='card-detail'><strong>Area:</strong> {bookingDetails.area || 'None'}</p>
                  <p className='card-detail'><strong>Gunta:</strong> {bookingDetails.gunta || 'None'}</p>
                  <p className='card-detail'><strong>Acre:</strong> {bookingDetails.acre || 'None'}</p>
                </>
              )}
              {bookingDetails.workCategory === 'Transport' && (
                <>
                  <p className='card-detail'><strong>Pickup Location:</strong> {bookingDetails.pickupLocation}</p>
                  <p className='card-detail'><strong>Delivery Location:</strong> {bookingDetails.deliveryLocation}</p>
                  <p className='card-detail'><strong>Kilometers:</strong> {bookingDetails.kilometers}</p>
                </>
              )}
              <p className='card-detail'><strong>Date:</strong> {bookingDetails.date}</p>
              <p className='card-detail'><strong>Time:</strong> {Array.isArray(bookingDetails.time) ? bookingDetails.time.join(', ') : bookingDetails.time}</p>
              <p className='card-detail'><strong>Remark:</strong> {bookingDetails.remark || 'None'}</p>
              <p className='card-detail'><strong>Payment Mode:</strong> {bookingDetails.paymentMode === 'online' ? 'Online (Razorpay)' : 'Cash'}</p>
              <p className='card-detail'><strong>Status:</strong> {bookingDetails.attempted ? 'Attempted' : 'Not Attempted'}</p>
              <div className='card-actions'>
                <button onClick={downloadCardAsPDF} className='action-button download'>
                  <FaDownload className='w-5 h-5' />
                </button>
                <button onClick={closePopup} className='action-button close'>
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
            placeholder='Enter 10 digits (e.g., 9876543210)'
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
                {category.name} {category.name === 'Transport' ? `(₹${category.rate}/km round trip, min ₹${TRANSPORT_MINIMUM_RATE})` : category.name === 'Customize' ? '(₹500 or ₹14/km)' : `(₹${category.rate} per acre)`}
              </option>
            ))}
          </select>
        </div>
        {formData.workCategory === 'Transport' && (
          <div className='flex space-x-4'>
            <div className='flex-1'>
              <label>Pickup Location</label>
              <input
                type='text'
                name='pickupLocation'
                value={formData.pickupLocation}
                onChange={handleInputChange}
                required
                placeholder='Enter pickup location'
              />
              {pickupSuggestions.length > 0 && (
                <ul className='suggestions-list'>
                  {pickupSuggestions.map((suggestion, idx) => (
                    <li
                      key={idx}
                      onClick={() => handleSuggestionSelect(suggestion, 'pickup')}
                      className='suggestion-item'
                    >
                      {suggestion.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className='flex-1'>
              <label>Delivery Location</label>
              <input
                type='text'
                name='deliveryLocation'
                value={formData.deliveryLocation}
                onChange={handleInputChange}
                required
                placeholder='Enter delivery location'
              />
              {deliverySuggestions.length > 0 && (
                <ul className='suggestions-list'>
                  {deliverySuggestions.map((suggestion, idx) => (
                    <li
                      key={idx}
                      onClick={() => handleSuggestionSelect(suggestion, 'delivery')}
                      className='suggestion-item'
                    >
                      {suggestion.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className='flex-1'>
              <label>Kilometers</label>
              <input
                type='number'
                name='kilometers'
                value={formData.kilometers}
                onChange={handleInputChange}
                min='0'
                step='0.1'
                required
              />
            </div>
          </div>
        )}
        {formData.workCategory !== 'Transport' && (
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
          <div className='whatsapp-link'>
          <a
            href='https://bhulekh.mahabhumi.gov.in/'
            target='_blank'
            rel='noopener noreferrer'
          >
            Don’t know your 7/12 or Khata number? Click here to find it.
          </a>
        </div>
          </div>
        )}
    
        
        
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
        <button type='submit'>
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