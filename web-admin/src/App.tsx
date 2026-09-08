import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { BookingsPage } from './pages/BookingsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { DashboardPage } from './pages/DashboardPage';
import { InterventionsPage } from './pages/InterventionsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { LeadsPage } from './pages/LeadsPage';
import { LoginPage } from './pages/LoginPage';
import { OfferingsPage } from './pages/OfferingsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { PricingPage } from './pages/PricingPage';
import { PropertiesPage } from './pages/PropertiesPage';
import { ProvidersPage } from './pages/ProvidersPage';
import { ReviewsPage } from './pages/ReviewsPage';
import { ThreadsPage } from './pages/ThreadsPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/providers" element={<ProvidersPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/offerings" element={<OfferingsPage />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/interventions" element={<InterventionsPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/threads" element={<ThreadsPage />} />
          <Route path="/leads" element={<LeadsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
