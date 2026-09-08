import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { Message, MessageThread } from '../api/types';
import { useAuth } from '../auth/AuthContext';

type Conversation = { thread: MessageThread; messages: Message[] };

export function Conversation({ bookingId }: { bookingId: string }) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function load() {
    api<Conversation>('/threads/' + bookingId, { token })
      .then((conversation) => setMessages(conversation.messages))
      .catch((err) => setError(err instanceof Error ? err.message : 'Discussion indisponible'));
  }

  useEffect(load, [token, bookingId]);

  async function send(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSending(true);
    try {
      await api('/threads/' + bookingId + '/messages', { method: 'POST', token, body: { body } });
      setBody('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="card">
      <h3>Discussion avec la conciergerie</h3>
      {messages.length === 0 && <p className="muted">Aucun message pour le moment.</p>}
      <div className="thread">
        {messages.map((message) => (
          <div key={message.id} className={'bubble ' + message.authorRole}>
            <span className="who">
              {message.authorName} · {new Date(message.createdAt).toLocaleString('fr-FR')}
            </span>
            {message.body}
          </div>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <form onSubmit={send}>
        <label>
          Votre message
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} required />
        </label>
        <button type="submit" disabled={sending || body.trim().length === 0}>
          Envoyer
        </button>
      </form>
    </section>
  );
}
