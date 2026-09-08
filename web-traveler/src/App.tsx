import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { AccountPage } from './pages/AccountPage';
import { BookingsPage } from './pages/BookingsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { LoginPage } from './pages/LoginPage';
import { PayPage } from './pages/PayPage';
import { PropertiesPage } from './pages/PropertiesPage';
import { PropertyPage } from './pages/PropertyPage';
import { RegisterPage } from './pages/RegisterPage';
import { ServiceBookingPage } from './pages/ServiceBookingPage';
import { ServicesPage } from './pages/ServicesPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { VipPage } from './pages/VipPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<PropertiesPage />} />
        <Route path="/properties/:id" element={<PropertyPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/vip" element={<VipPage />} />
        <Route path="/simulateur" element={<SimulatorPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/pay/:kind/:id" element={<PayPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/bookings/services/:id" element={<ServiceBookingPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
