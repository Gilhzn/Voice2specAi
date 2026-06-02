import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientMessage, ServerMessage } from '@voice2spec/shared-types';

export type WsStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

interface UseWebSocketOptions {
  url: string | null;
  onMessage: (msg: ServerMessage) => void;
  /** Max reconnect attempts before giving up. */
  maxRetries?: number;
}

/**
 * Manages a single WebSocket connection with an async outbound buffer and
 * exponential-backoff reconnection. Messages enqueued while the socket is
 * connecting are flushed on open so no audio chunk is dropped.
 */
export function useWebSocket({ url, onMessage, maxRetries = 5 }: UseWebSocketOptions) {
  const socketRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<ClientMessage[]>([]);
  const retriesRef = useRef(0);
  const [status, setStatus] = useState<WsStatus>('idle');

  const flush = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    while (bufferRef.current.length > 0) {
      const msg = bufferRef.current.shift()!;
      socket.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (!url) return;
    setStatus('connecting');
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      retriesRef.current = 0;
      setStatus('open');
      flush();
    };
    socket.onmessage = (event) => {
      try {
        onMessage(JSON.parse(String(event.data)) as ServerMessage);
      } catch {
        /* ignore malformed frames */
      }
    };
    socket.onerror = () => setStatus('error');
    socket.onclose = () => {
      setStatus('closed');
      if (retriesRef.current < maxRetries && url) {
        const delay = Math.min(1000 * 2 ** retriesRef.current, 16000);
        retriesRef.current += 1;
        setTimeout(connect, delay);
      }
    };
  }, [url, onMessage, flush, maxRetries]);

  useEffect(() => {
    if (url) connect();
    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [url, connect]);

  /** Enqueue a message; sent immediately if open, buffered otherwise. */
  const send = useCallback(
    (msg: ClientMessage) => {
      bufferRef.current.push(msg);
      flush();
    },
    [flush],
  );

  return { status, send };
}
