import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { User } from '../api/types';
import { useAuth } from '../auth/AuthContext';

export function DashboardPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<User[]>('/admin/users', { token })
      .then(setUsers)
      .catch((err) => setError(err instanceof Error ? err.message : 'Chargement impossible'));
  }, [token]);

  return (
    <>
      <h1>Utilisateurs</h1>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>E-mail</th>
            <th>Nom</th>
            <th>Rôle</th>
            <th>Formule</th>
            <th>Inscrit le</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>
                {u.profile.firstName} {u.profile.lastName}
              </td>
              <td>{u.role}</td>
              <td>{u.vip.tier}</td>
              <td>{new Date(u.createdAt).toLocaleDateString('fr-FR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
