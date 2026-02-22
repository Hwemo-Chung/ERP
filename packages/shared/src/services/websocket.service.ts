import { Injectable, inject, signal } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { ENVIRONMENT_CONFIG } from '../tokens/environment.token';
import { LoggerService } from './logger.service';

interface WsMessage {
  type: string;
  payload: unknown;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private readonly logger = inject(LoggerService);
  private readonly env = inject(ENVIRONMENT_CONFIG);
  private ws: WebSocket | null = null;
  private readonly messages$ = new Subject<WsMessage>();
  private readonly _isConnected = signal(false);
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  readonly isConnected = this._isConnected.asReadonly();

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const wsUrl = this.env.apiUrl.replace(/^http/, 'ws') + '/ws';

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this._isConnected.set(true);
        this.reconnectAttempts = 0;
        this.logger.log('[WebSocket] Connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WsMessage = JSON.parse(event.data);
          this.messages$.next(message);
        } catch (err) {
          this.logger.error('[WebSocket] Parse error:', err);
        }
      };

      this.ws.onclose = () => {
        this._isConnected.set(false);
        this.logger.log('[WebSocket] Disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        this.logger.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      this.logger.error('[WebSocket] Connection failed:', error);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._isConnected.set(false);
  }

  onMessage<T = unknown>(type: string): Observable<T> {
    return this.messages$.asObservable().pipe(
      filter((msg) => msg.type === type),
      map((msg) => msg.payload as T),
    );
  }

  send(type: string, payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      this.logger.warn('[WebSocket] Not connected, cannot send');
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.log('[WebSocket] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    this.logger.log(`[WebSocket] Reconnecting in ${delay}ms...`);
    setTimeout(() => this.connect(), delay);
  }
}
