import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ChatImage, ChatMessage, Conversation, ReplyRef } from '../models/chat.models';

interface ConversationSummaryDto {
  id: string;
  title: string;
  createdAt: number;
}

interface MessageDto {
  id: string;
  role: string;
  text: string;
  createdAt: number;
  images: ChatImage[];
  replyTo?: ReplyRef;
}

interface ConversationDto extends ConversationSummaryDto {
  messages: MessageDto[];
}

/**
 * Persistência de conversas/mensagens via API local (.NET + SQLite).
 */
@Injectable({ providedIn: 'root' })
export class ConversationApiService {
  private readonly baseUrl = `${environment.apiBaseUrl}/api/conversations`;

  async list(): Promise<ConversationSummaryDto[]> {
    const res = await fetch(this.baseUrl);
    if (!res.ok) {
      throw new Error(`Falha ao listar conversas (${res.status})`);
    }
    return (await res.json()) as ConversationSummaryDto[];
  }

  async get(id: string): Promise<ConversationDto> {
    const res = await fetch(`${this.baseUrl}/${id}`);
    if (!res.ok) {
      throw new Error(`Falha ao carregar conversa (${res.status})`);
    }
    return (await res.json()) as ConversationDto;
  }

  async create(conversation: Conversation): Promise<void> {
    await this.send(this.baseUrl, 'POST', {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt
    });
  }

  async updateTitle(id: string, title: string): Promise<void> {
    await this.send(`${this.baseUrl}/${id}/title`, 'PUT', { title });
  }

  async addMessage(conversationId: string, message: ChatMessage): Promise<void> {
    await this.send(`${this.baseUrl}/${conversationId}/messages`, 'POST', {
      id: message.id,
      role: message.role,
      text: message.text,
      createdAt: message.createdAt,
      images: message.images,
      replyToId: message.replyTo?.id ?? null,
      replyToRole: message.replyTo?.role ?? null,
      replyExcerpt: message.replyTo?.excerpt ?? null
    });
  }

  async remove(id: string): Promise<void> {
    await this.send(`${this.baseUrl}/${id}`, 'DELETE');
  }

  private async send(url: string, method: string, body?: unknown): Promise<void> {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      throw new Error(`${method} ${url} falhou (${res.status})`);
    }
  }
}
