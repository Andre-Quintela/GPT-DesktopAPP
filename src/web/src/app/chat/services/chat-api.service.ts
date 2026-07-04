import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ChatImage, ChatMessage } from '../models/chat.models';

interface ChatApiMessage {
  role: string;
  text: string;
  images: { mediaType: string; base64: string }[];
}

/**
 * Comunicação com a API local (.NET), que faz proxy para o Azure OpenAI.
 * - streamChat: lê a resposta em streaming (SSE) via fetch + ReadableStream.
 * - generateImage: solicita a geração de uma imagem (gpt-image-2).
 */
@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  /**
   * Envia o histórico e invoca `onToken` a cada pedaço de texto recebido.
   * Resolve quando o streaming termina; rejeita em caso de erro/abort.
   */
  async streamChat(
    messages: ChatMessage[],
    onToken: (token: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages.map(toApiMessage) }),
      signal
    });

    if (!response.ok || !response.body) {
      throw new Error(`Falha no chat (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Eventos SSE são separados por linha em branco.
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const event of events) {
        const line = event.trim();
        if (!line.startsWith('data:')) {
          continue;
        }

        const data = line.slice('data:'.length).trim();
        if (data === '[DONE]') {
          return;
        }

        try {
          onToken(JSON.parse(data) as string);
        } catch {
          // ignora pedaços mal-formados
        }
      }
    }
  }

  /** Gera uma imagem a partir do prompt; retorna o base64 (png). */
  async generateImage(prompt: string, size = '1024x1024'): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/images/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size })
    });

    if (!response.ok) {
      throw new Error(`Falha na geração de imagem (${response.status})`);
    }

    const data = (await response.json()) as { b64: string };
    return data.b64;
  }
}

function toApiMessage(m: ChatMessage): ChatApiMessage {
  return {
    role: m.role,
    text: m.text,
    images: m.images.map((img: ChatImage) => ({
      mediaType: img.mediaType,
      base64: img.base64
    }))
  };
}
