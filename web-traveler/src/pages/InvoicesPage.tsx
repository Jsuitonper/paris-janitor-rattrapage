import { useEffect, useState } from 'react';
import { api, downloadBlob, saveBlob } from '../api/client';
import type { Invoice } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { formatDate, formatEuros } from '../lib/money';

export function InvoicesPage() {
  const { token } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Invoice[]>('/invoices', { token })
      .then(setInvoices)
      .catch((err) => setError(err instanceof Error ? err.message : 'Chargement impossible'));
  }, [token]);

  async function download(invoice: Invoice) {
    setError(null);
    try {
      saveBlob(await downloadBlob('/files/' + invoice.gridFsId, token), invoice.number + '.pdf');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Téléchargement impossible');
    }
  }

  return (
    <>
      <h1>Mes factures</h1>
      <p className="muted">Chaque facture est archivée à son émission : son montant ne change jamais.</p>
      {error && <p className="error">{error}</p>}
      {invoices.length === 0 && <p className="muted">Aucune facture pour le moment.</p>}
      <table>
        <thead>
          <tr>
            <th>Numéro</th>
            <th>Émise le</th>
            <th>Objet</th>
            <th>HT</th>
            <th>TVA</th>
            <th>TTC</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td>
                <code>{invoice.number}</code>
              </td>
              <td>{formatDate(invoice.issuedAt)}</td>
              <td>{invoice.lines.map((line) => line.label).join(', ')}</td>
              <td>{formatEuros(invoice.totals.netHtCents)}</td>
              <td>{formatEuros(invoice.totals.vatCents)}</td>
              <td>{formatEuros(invoice.totals.totalTtcCents)}</td>
              <td>
                <button type="button" onClick={() => download(invoice)}>
                  PDF
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
