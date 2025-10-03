Appointment Booking App
A responsive React app for booking appointments with an admin panel to view appointment details, using MongoDB for data storage and Express.js for the backend.
Features

Book appointments with name, email, date, and time.
Admin panel to view all appointments (protected by JWT authentication).
Responsive design with Tailwind CSS.
Environment variables for secure configuration.
Dockerized setup for easy deployment.

Setup Instructions
Prerequisites

Node.js (v18 or higher)
Docker (optional, for containerized setup)
MongoDB (local or MongoDB Atlas)

Installation

Clone the Repository
git clone <repository-url>
cd appointment-booking-app


Install Frontend Dependencies
cd client
npm install


Install Backend Dependencies
cd ../server
npm install


Configure Environment Variables

Create client/.env:VITE_API_URL=http://localhost:5000/api


Create server/.env:MONGO_URI=mongodb://mongodb:27017/appointment_db
PORT=5000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
JWT_SECRET=your_jwt_secret_here




Run the App
With Docker:
docker-compose up


Frontend: http://localhost:3000
Backend: http://localhost:5000

Without Docker:

Start MongoDB locally or use MongoDB Atlas.
Start backend:cd server
npm start


Start frontend:cd client
npm run dev




Access the App

Booking form: http://localhost:3000/
Admin panel: http://localhost:3000/admin (login with admin/admin123)



Project Structure

client/: React frontend with Vite.
server/: Express.js backend with MongoDB.
docker-compose.yml: Docker configuration for frontend, backend, and MongoDB.

Notes

The admin login uses simple JWT authentication. For production, use bcrypt and refresh tokens.
Ensure .env files are not committed to version control.
The app is responsive and tested for mobile and desktop views.

License
MIT