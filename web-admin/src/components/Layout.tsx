import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const LINKS = [
  ['/', 'Utilisateurs'],
  ['/providers', 'Prestataires'],
  ['/categories', 'Catégories'],
  ['/offerings', 'Prestations'],
  ['/properties', 'Biens'],
  ['/bookings', 'Réservations'],
  ['/subscriptions', 'Abonnés VIP'],
  ['/payments', 'Règlements'],
  ['/invoices', 'Factures'],
  ['/interventions', 'Interventions'],
  ['/reviews', 'Avis'],
  ['/threads', 'Messagerie'],
  ['/leads', 'Simulations'],
  ['/pricing', 'Tarification'],
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <nav>
        <strong>Paris Janitor</strong>
        {LINKS.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {label}
          </NavLink>
        ))}
        <div className="nav-footer">
          <span className="muted">{user?.email}</span>
          <button type="button" onClick={logout}>
            Se déconnecter
          </button>
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
