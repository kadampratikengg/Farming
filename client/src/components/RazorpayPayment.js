import axios from 'axios';

const initiatePayment = async ({ orderId, amount, formData, apiUrl, onSuccess, onError }) => {
  try {
    // Check for Razorpay key
    const razorpayKeyId = process.env.REACT_APP_RAZORPAY_KEY;
    if (!razorpayKeyId) {
      console.error('Razorpay key ID missing. Add REACT_APP_RAZORPAY_KEY to your client-side .env file.');
      onError('Online payment is currently unavailable. Please add REACT_APP_RAZORPAY_KEY to your .env file, restart the app, or select cash payment.');
      return false;
    }

    // Load Razorpay SDK dynamically
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return new Promise((resolve) => {
      script.onload = () => {
        if (!window.Razorpay) {
          console.error('Razorpay SDK failed to load');
          onError('Failed to load payment gateway. Please check your internet connection or use cash payment.');
          resolve(false);
          return;
        }

        const options = {
          key: razorpayKeyId,
          amount,
          currency: 'INR',
          name: 'Appointment Booking',
          description: `Booking for ${formData.time.length} slot(s)`,
          order_id: orderId,
          handler: async (response) => {
            try {
              console.log('Payment Response:', response);
              const verifyUrl = `${apiUrl}/appointments/verify-payment`;
              const bookingResponse = await axios.post(
                verifyUrl,
                {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  formData,
                },
                {
                  headers: {
                    'Content-Type': 'application/json',
                  },
                }
              );
              console.log('Booking Response:', bookingResponse.data);
              onSuccess(bookingResponse);
              resolve(true);
            } catch (err) {
              console.error('Payment verification error:', err.response || err.message);
              onError(err.response?.data?.error || 'Payment verification failed. Please contact support or use cash payment.');
              resolve(false);
            }
          },
          prefill: {
            name: formData.name,
            email: formData.email,
            contact: formData.contactNumber,
          },
          theme: {
            color: '#3399cc',
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (response) => {
          console.error('Payment failed:', response.error);
          onError(`Payment failed: ${response.error.description}. Please try again or use cash payment.`);
        });
        rzp.open();
      };

      script.onerror = () => {
        console.error('Failed to load Razorpay SDK');
        onError('Failed to load payment gateway. Please check your internet connection or use cash payment.');
        resolve(false);
      };
    });
  } catch (err) {
    console.error('Error initiating payment:', err);
    onError('Failed to initiate payment. Please try again or use cash payment.');
    return false;
  }
};

export default initiatePayment;