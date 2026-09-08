import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { Message, MessageThread } from '../api/types';
import { useAuth } from '../auth/AuthContext';

type Conversation = { thread: MessageThread; messages: Message[] };

export function ThreadsPage() {
  const { token } = useAuth();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selected, setSelected] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  function showError(err: unknown) {
    setError(err instanceof Error ? err.message : 'Erreur');
  }

  function loadThreads() {
    api<MessageThread[]>('/admin/threads', { token }).then(setThreads).catch(showError);
  }

  useEffect(loadThreads, [token]);

  async function open(thread: MessageThread) {
    setSelected(thread);
    try {
      const conversation = await api<Conversation>('/admin/threads/' + thread.bookingId, { token });
      setMessages(conversation.messages);
      loadThreads();
    } catch (err) {
      showError(err);
    }
  }

  async function reply(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    try {
      await api('/admin/threads/' + selected.bookingId + '/messages', { method: 'POST', body: { body }, token });
      setBody('');
      open(selected);
    } catch (err) {
      showError(err);
    }
  }

  return (
    <>
      <h1>Messagerie</h1>
      <p className="muted">
        Les réponses sont publiées au nom de la conciergerie Paris Janitor, l’espace prestataire étant hors périmètre.
      </p>
      {error && <p className="error">{error}</p>}

      <div className="two-columns">
        <table>
          <thead>
            <tr>
              <th>Prestation</th>
              <th>Dernier message</th>
              <th>Non lus</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {threads.map((thread) => (
              <tr key={thread.id}>
                <td>{thread.subject}</td>
                <td>{thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleString('fr-FR') : '—'}</td>
                <td>{thread.unreadForAdmin > 0 ? <span className="badge pending">{thread.unreadForAdmin}</span> : '—'}</td>
                <td>
                  <button type="button" className="small" onClick={() => open(thread)}>
                    Ouvrir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {selected && (
          <section className="card">
            <h2>{selected.subject}</h2>
            {messages.length === 0 && <p className="muted">Aucun message.</p>}
            {messages.map((message) => (
              <div key={message.id} className={'bubble ' + message.authorRole}>
                <span className="who">
                  {message.authorName} · {new Date(message.createdAt).toLocaleString('fr-FR')}
                </span>
                {message.body}
              </div>
            ))}
            <form onSubmit={reply}>
              <label>
                Répondre au nom de Paris Janitor
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} required />
              </label>
              <button type="submit" disabled={body.trim().length === 0}>
                Envoyer
              </button>
            </form>
          </section>
        )}
      </div>
    </>
  );
}
