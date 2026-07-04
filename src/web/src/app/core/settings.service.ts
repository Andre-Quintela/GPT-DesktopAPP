import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

export interface ChatResourceSettings {
  endpoint: string;
  deploymentName: string;
  apiKey: string;
}

export interface ImageResourceSettings {
  endpoint: string;
  deploymentName: string;
  apiVersion: string;
  apiKey: string;
}

export interface AppSettings {
  chat: ChatResourceSettings;
  images: ImageResourceSettings;
}

interface SettingsResponse extends AppSettings {
  configured: boolean;
}

/**
 * Configuração das chaves Azure OpenAI (inseridas pelo usuário), persistidas no host.
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly url = `${environment.apiBaseUrl}/api/settings`;

  private readonly _configured = signal<boolean>(true);
  /** false quando o usuário ainda não informou as chaves. */
  readonly configured = this._configured.asReadonly();

  async load(): Promise<AppSettings> {
    const res = await fetch(this.url);
    if (!res.ok) {
      throw new Error(`Falha ao carregar configurações (${res.status})`);
    }
    const data = (await res.json()) as SettingsResponse;
    this._configured.set(data.configured);
    return { chat: data.chat, images: data.images };
  }

  async save(settings: AppSettings): Promise<void> {
    const res = await fetch(this.url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!res.ok) {
      throw new Error(`Falha ao salvar configurações (${res.status})`);
    }
    // Considera configurado se há endpoint + chave de chat.
    this._configured.set(!!settings.chat.endpoint && !!settings.chat.apiKey && !!settings.chat.deploymentName);
  }
}
