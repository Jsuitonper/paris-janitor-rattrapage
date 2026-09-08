import { useRef, useState, type ChangeEvent } from 'react';
import { API_URL, api, uploadFile } from '../api/client';
import type { Property } from '../api/types';
import { useAuth } from '../auth/AuthContext';

type Props = { property: Property; onChange: (property: Property) => void; onError: (message: string) => void };

export function PropertyPhotos({ property, onChange, onError }: Props) {
  const { token } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function add(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadFile<Property>('/admin/properties/' + property.id + '/photos', file, token));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Envoi impossible');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function remove(fileId: string) {
    setBusy(true);
    try {
      onChange(await api<Property>('/admin/properties/' + property.id + '/photos/' + fileId, { method: 'DELETE', token }));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Suppression impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row">
      {property.photoIds.map((photoId) => (
        <span key={photoId} className="thumb">
          <img src={API_URL + '/files/' + photoId} alt={property.title} />
          <button type="button" className="danger small" disabled={busy} onClick={() => remove(photoId)}>
            ×
          </button>
        </span>
      ))}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={add} />
    </div>
  );
}
