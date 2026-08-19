import { BrowserRouter, Route, Routes } from "react-router";
import { BookingDetailsPage } from "./pages/BookingDetailsPage";
import { BookingPage } from "./pages/BookingPage";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BookingPage />} />
        <Route path="/bookings/:bookingId" element={<BookingDetailsPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
