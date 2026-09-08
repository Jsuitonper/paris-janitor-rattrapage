import { isDatabaseConnected } from '../repositories/health.repository';

export function healthStatus() {
  return {
    status: 'ok',
    db: isDatabaseConnected() ? 'connected' : 'disconnected',
  };
}
