import { useEffect, useState, type FormEvent } from 'react';
import { API_URL, api, uploadFile } from '../api/client';
import type { InterventionSheet } from '../api/types';
import { useAuth } from '../auth/AuthContext';

type Report = { performedAt: string; durationMinutes: number; workDone: string; materialsUsed: string; incidents: string; attachmentIds: string[] };

const EMPTY: Report = { performedAt: '', durationMinutes: 60, workDone: '', materialsUsed: '', incidents: '', attachmentIds: [] };

export function InterventionsPage() {
  const { token } = useAuth();
  const [sheets, setSheets] = useState<InterventionSheet[]>([]);
  const [filter, setFilter] = useState<'prefilled' | 'completed' | ''>('prefilled');
  const [editing, setEditing] = useState<InterventionSheet | null>(null);
  const [report, setReport] = useState<Report>(EMPTY);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showError(err: unknown) {
    setMessage(null);
    setError(err instanceof Error ? err.message : 'Erreur');
  }

  function load() {
    api<InterventionSheet[]>('/admin/interventions' + (filter ? '?status=' + filter : ''), { token })
      .then(setSheets)
      .catch(showError);
  }

  useEffect(load, [token, filter]);

  function startEditing(sheet: InterventionSheet) {
    setEditing(sheet);
    setReport({ ...EMPTY, performedAt: sheet.prefill.scheduledAt.slice(0, 16) });
  }

  async function attach(file: File) {
    if (!editing) return;
    try {
      const stored = await uploadFile<{ id: string }>('/files', file, token, {
        kind: 'booking_attachment',
        bookingId: editing.bookingId,
      });
      setReport({ ...report, attachmentIds: [...report.attachmentIds, stored.id] });
    } catch (err) {
      showError(err);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setError(null);
    try {
      await api('/admin/interventions/' + editing.id + '/complete', {
        method: 'PATCH',
        body: { ...report, performedAt: new Date(report.performedAt).toISOString() },
        token,
      });
      setMessage('Fiche complétée : la prestation peut maintenant être clôturée.');
      setEditing(null);
      setReport(EMPTY);
      load();
    } catch (err) {
      showError(err);
    }
  }

  return (
    <>
      <h1>Fiches d’intervention</h1>
      <p className="muted">
        Chaque fiche est pré-remplie automatiquement à la confirmation de la prestation. La compléter est obligatoire avant de clôturer
        la réservation.
      </p>
      {error && <p className="error">{error}</p>}
      {message && <p className="muted">{message}</p>}

      <div className="row">
        <label>
          Filtrer
          <select value={filter} onChange={(e) => setFilter(e.target.value as 'prefilled' | 'completed' | '')}>
            <option value="prefilled">À compléter</option>
            <option value="completed">Complétées</option>
            <option value="">Toutes</option>
          </select>
        </label>
      </div>

      <div className="two-columns">
        <table>
          <thead>
            <tr>
              <th>Prestation</th>
              <th>Prestataire</th>
              <th>Voyageur</th>
              <th>Planifiée</th>
              <th>Quantité</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sheets.map((sheet) => (
              <tr key={sheet.id}>
                <td>{sheet.prefill.offeringName}</td>
                <td>{sheet.prefill.providerName}</td>
                <td>{sheet.prefill.travelerName}</td>
                <td>{new Date(sheet.prefill.scheduledAt).toLocaleString('fr-FR')}</td>
                <td>
                  {sheet.prefill.qty} {sheet.prefill.unitLabel}
                </td>
                <td>
                  <span className={'badge ' + (sheet.status === 'completed' ? 'published' : 'pending')}>
                    {sheet.status === 'completed' ? 'Complétée' : 'À compléter'}
                  </span>
                </td>
                <td>
                  {sheet.status === 'prefilled' ? (
                    <button type="button" className="small" onClick={() => startEditing(sheet)}>
                      Compléter
                    </button>
                  ) : (
                    <span className="muted">{sheet.report?.durationMinutes} min</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {editing && (
          <form className="card" onSubmit={submit}>
            <h2>Compléter la fiche</h2>
            <p className="muted">
              {editing.prefill.offeringName} · {editing.prefill.providerName} · {editing.prefill.travelerName}
              {editing.prefill.address && ' · ' + editing.prefill.address}
            </p>
            <label>
              Réalisée le
              <input type="datetime-local" value={report.performedAt} onChange={(e) => setReport({ ...report, performedAt: e.target.value })} required />
            </label>
            <label>
              Durée (minutes)
              <input type="number" min={1} value={report.durationMinutes} onChange={(e) => setReport({ ...report, durationMinutes: Number(e.target.value) })} required />
            </label>
            <label>
              Travaux réalisés
              <textarea value={report.workDone} onChange={(e) => setReport({ ...report, workDone: e.target.value })} rows={3} required minLength={3} />
            </label>
            <label>
              Matériel utilisé
              <textarea value={report.materialsUsed} onChange={(e) => setReport({ ...report, materialsUsed: e.target.value })} rows={2} />
            </label>
            <label>
              Incidents
              <textarea value={report.incidents} onChange={(e) => setReport({ ...report, incidents: e.target.value })} rows={2} />
            </label>
            <label>
              Pièces jointes
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => e.target.files?.[0] && attach(e.target.files[0])} />
            </label>
            <div className="row">
              {report.attachmentIds.map((fileId) => (
                <img key={fileId} className="thumb-img" src={API_URL + '/files/' + fileId} alt="Pièce jointe" />
              ))}
            </div>
            <div className="row">
              <button type="submit">Enregistrer la fiche</button>
              <button type="button" className="secondary" onClick={() => { setEditing(null); setReport(EMPTY); }}>
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
