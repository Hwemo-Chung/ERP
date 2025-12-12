/**
 * WebSocket Service
 * Basic WebSocket connection for real-time notifications
 */
import { Injectable, inject, signal } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';

interface WsMessage {
  type: string;
  payload: any;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private readonly authService = inject(AuthService);
  private ws: WebSocket | null = null;
  private readonly messages$ = new Subject<WsMessage>();
  private readonly _isConnected = signal(false);
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  readonly isConnected = this._isConnected.asReadonly();

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    
    const wsUrl = environment.apiUrl.replace(/^http/, 'ws') + '/ws';
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this._isConnected.set(true);
        this.reconnectAttempts = 0;
        console.log('[WebSocket] Connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WsMessage = JSON.parse(event.data);
          this.messages$.next(message);
        } catch (err) {
          console.error('[WebSocket] Parse error:', err);
        }
      };

      this.ws.onclose = () => {
        this._isConnected.set(false);
        console.log('[WebSocket] Disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._isConnected.set(false);
  }

  /**
   * Listen for specific message types
   */
  onMessage<T = any>(type: string): Observable<T> {
    return this.messages$.asObservable().pipe(
      filter(msg => msg.type === type),
      map(msg => msg.payload as T),
    );
  }

  /**
   * Send message to server
   */
  send(type: string, payload: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('[WebSocket] Not connected, cannot send');
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WebSocket] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
    setTimeout(() => this.connect(), delay);
  }
}
