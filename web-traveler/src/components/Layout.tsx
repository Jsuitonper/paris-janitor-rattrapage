import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <>
      <header className="topbar">
        <strong>Paris Janitor</strong>
        <NavLink to="/" end>
          Logements
        </NavLink>
        <NavLink to="/services">Prestations</NavLink>
        <NavLink to="/vip">VIP</NavLink>
        <NavLink to="/simulateur">Estimer mes gains</NavLink>
        {user && <NavLink to="/bookings">Mes réservations</NavLink>}
        {user && <NavLink to="/invoices">Mes factures</NavLink>}
        <span className="spacer" />
        {user ? (
          <>
            <NavLink to="/account">{user.profile.firstName}</NavLink>
            <button type="button" onClick={logout}>
              Se déconnecter
            </button>
          </>
        ) : (
          <Link to="/login">Se connecter</Link>
        )}
      </header>
      <main className="wide">
        <Outlet />
      </main>
    </>
  );
}
