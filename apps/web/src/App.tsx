import { BrowserRouter, Route, Routes } from "react-router";
import { AppHeader } from "./components/AppHeader";
import { BookingDetailsPage } from "./pages/BookingDetailsPage";
import { BookingPage } from "./pages/BookingPage";
import { ChaosControlPage } from "./pages/ChaosControlPage";

const App = () => {
  return (
    <BrowserRouter>
      <AppHeader />
      <Routes>
        <Route path="/" element={<BookingPage />} />
        <Route path="/bookings/:bookingId" element={<BookingDetailsPage />} />
        <Route path="/chaos" element={<ChaosControlPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
