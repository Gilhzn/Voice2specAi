import {
  CreateSessionRequest,
  CreateSessionResponse,
  GenerateSpecResponse,
  GetTranscriptResponse,
  HealthResponse,
} from '@voice2spec/shared-types';

/**
 * Thin REST client to the Voice2Spec server. The base URL is configurable so
 * the same client works against localhost, a LAN dev host, or production.
 */
export const DEFAULT_BASE_URL = 'http://localhost:4000';

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = DEFAULT_BASE_URL) {
    // Normalize: trim and drop a trailing slash.
    this.baseUrl = baseUrl.trim().replace(/\/+$/, '');
  }

  /** Build the WebSocket URL for a given session. */
  wsUrl(sessionId: string, userId: string): string {
    const ws = this.baseUrl.replace(/^http/, 'ws');
    return `${ws}/ws?sessionId=${sessionId}&userId=${encodeURIComponent(userId)}`;
  }

  /** Probe server health; used by Settings to validate a configured URL. */
  async health(timeoutMs = 6000): Promise<HealthResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
      return this.handle<HealthResponse>(res);
    } finally {
      clearTimeout(timer);
    }
  }

  async createSession(body: CreateSessionRequest): Promise<CreateSessionResponse> {
    return this.post('/sessions', body);
  }

  async getTranscript(sessionId: string, userId: string): Promise<GetTranscriptResponse> {
    return this.get(`/sessions/${sessionId}/transcript?userId=${encodeURIComponent(userId)}`);
  }

  async generateSpec(sessionId: string): Promise<GenerateSpecResponse> {
    return this.post('/spec', { sessionId });
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    return this.handle<T>(res);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return this.handle<T>(res);
  }

  private async handle<T>(res: Response): Promise<T> {
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  }
}

export const api = new ApiClient();
