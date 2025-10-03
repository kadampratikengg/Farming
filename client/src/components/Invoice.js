import jsPDF from 'jspdf';

const generateInvoicePDF = (bookingDetails, isPaid, logoUrl = '/assets/logo.png') => {
  if (!bookingDetails) return;
  const doc = new jsPDF();
  const logoWidth = 30;
  const logoHeight = 30;

  // Handle logo (skip if fails)
  const img = new Image();
  img.src = logoUrl;
  img.onload = () => {
    try {
      doc.addImage(logoUrl, 'PNG', 20, 10, logoWidth, logoHeight);
    } catch (err) {
      console.warn('Logo image failed to load:', err.message);
    }
    generatePDFContent(doc, isPaid);
  };
  img.onerror = () => {
    console.warn(`Logo image failed to load: Ensure ${logoUrl} is a valid PNG file`);
    generatePDFContent(doc, isPaid);
  };

  const generatePDFContent = (doc, isPaid) => {
    // Invoice Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Invoice', 20, 50);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('(Non-Taxable)', 20, 56);

    // Invoice Number and Date (right-aligned)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const invoiceNumber = `INV-${Date.now()}-${bookingDetails.village.replace(/\s+/g, '-')}`;
    doc.text(`Invoice Number: ${invoiceNumber}`, 190, 50, { align: 'right' });
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 190, 60, { align: 'right' });

    // Customer Details
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Customer Details', 20, 80);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const addressLine1 = `${bookingDetails.address}, ${bookingDetails.village}`;
    const addressLine2 = `${bookingDetails.pincode}, ${bookingDetails.district}, ${bookingDetails.state}`;
    const customerDetails = [
      `Name: ${bookingDetails.name}`,
      `Contact: ${bookingDetails.contactNumber}`,
      `Email: ${bookingDetails.email || 'Not provided'}`,
      `Address: ${addressLine1}`,
      addressLine2,
    ];
    customerDetails.forEach((line, index) => {
      doc.text(line, 20, 90 + index * 10);
    });

    // Payment Information (1 row, 2 columns)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Information', 20, 140);
    doc.setFont('helvetica', 'normal');
    doc.text('Payment Status:', 20, 150);
    doc.text(isPaid ? 'Paid' : 'Unpaid', 80, 150);
    doc.text('Payment Mode:', 110, 150);
    doc.text(bookingDetails.paymentMode === 'online' ? 'Online (Razorpay)' : 'Cash', 170, 150);
    doc.line(20, 152, 190, 152);

    // Invoice Details Table
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Invoice Details', 20, 170);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    // Table headers
    doc.text('Work', 20, 180);
    doc.text('Area (Acres)', 80, 180);
    doc.text('Rate (Rs./Acre)', 120, 180);
    doc.text('Amount (Rs.)', 160, 180);
    doc.line(20, 182, 190, 182);
    // Table row
    const workCategories = JSON.parse(process.env.REACT_APP_WORK_CATEGORIES || '[]');
    const selectedCategory = workCategories.find(cat => cat.name === bookingDetails.workCategory);
    const rate = selectedCategory ? selectedCategory.rate : 20;
    const acres = parseFloat(bookingDetails.acre) || parseFloat(bookingDetails.gunta) / 40;
    const amount = (rate * acres).toFixed(2);
    doc.text(bookingDetails.workCategory, 20, 190);
    doc.text(acres.toFixed(3), 80, 190);
    doc.text(rate.toString(), 120, 190);
    doc.text(amount, 160, 190);
    doc.line(20, 192, 190, 192);
    // Total
    doc.setFont('helvetica', 'bold');
    doc.text('Total:', 120, 200);
    doc.text(`RS.${amount}`, 160, 200);

    // Additional Details (below Invoice Details)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Additional Details', 20, 220);
    doc.setFont('helvetica', 'normal');
    const additionalDetails = [
      `7/12 Number: ${bookingDetails.sevenTwelveNumber}`,
      `Khata Number: ${bookingDetails.khataNumber || 'Not provided'}`,
      `Appointment Date: ${bookingDetails.date}`,
      `Time: ${Array.isArray(bookingDetails.time) ? bookingDetails.time.join(', ') : bookingDetails.time}`,
      `Remark: ${bookingDetails.remark || 'Not provided'}`,
    ];
    additionalDetails.forEach((line, index) => {
      doc.text(line, 20, 230 + index * 10);
    });

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Computer Generated Non Taxable Invoice', 105, 280, { align: 'center' });
    doc.save(`invoice_${invoiceNumber}_${isPaid ? 'paid' : 'unpaid'}.pdf`);
  };
};

export default generateInvoicePDF;