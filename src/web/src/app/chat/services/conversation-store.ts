import { computed, Injectable, signal } from '@angular/core';
import { ChatApiService } from './chat-api.service';
import { ConversationApiService } from './conversation-api.service';
import {
  ChatImage,
  ChatMessage,
  ComposerSubmit,
  Conversation,
  newId
} from '../models/chat.models';

/**
 * Estado das conversas e orquestração do envio de mensagens.
 * O estado é reativo (signals) e persistido no backend (SQLite) de forma otimista.
 */
@Injectable({ providedIn: 'root' })
export class ConversationStore {
  private readonly _conversations = signal<Conversation[]>([]);
  private readonly _activeId = signal<string | null>(null);
  private readonly _sending = signal(false);

  readonly conversations = this._conversations.asReadonly();
  readonly sending = this._sending.asReadonly();

  readonly active = computed(() => {
    const id = this._activeId();
    return this._conversations().find((c) => c.id === id) ?? null;
  });

  readonly messages = computed(() => this.active()?.messages ?? []);

  constructor(
    private readonly api: ChatApiService,
    private readonly persistence: ConversationApiService
  ) {
    void this.init();
  }

  // ---- Inicialização / carga ----
  private async init(): Promise<void> {
    try {
      const list = await this.persistence.list();
      if (list.length === 0) {
        this.newConversation();
        return;
      }

      this._conversations.set(
        list.map((c) => ({
          id: c.id,
          title: c.title,
          createdAt: c.createdAt,
          messages: [],
          loaded: false
        }))
      );
      this._activeId.set(list[0].id);
      await this.loadMessages(list[0].id);
    } catch (err) {
      console.error('Falha ao carregar conversas; iniciando vazio.', err);
      this.newConversation();
    }
  }

  private async loadMessages(id: string): Promise<void> {
    const conversation = this.conversationById(id);
    if (!conversation || conversation.loaded) {
      return;
    }
    try {
      const dto = await this.persistence.get(id);
      const messages: ChatMessage[] = dto.messages.map((m) => ({
        id: m.id,
        role: m.role as ChatMessage['role'],
        text: m.text,
        images: m.images ?? [],
        createdAt: m.createdAt
      }));
      this._conversations.update((list) =>
        list.map((c) => (c.id === id ? { ...c, messages, loaded: true } : c))
      );
    } catch (err) {
      console.error('Falha ao carregar mensagens da conversa.', err);
    }
  }

  // ---- Comandos ----
  newConversation(): void {
    const conversation: Conversation = {
      id: newId(),
      title: 'Nova conversa',
      messages: [],
      createdAt: Date.now(),
      loaded: true
    };
    this._conversations.update((list) => [conversation, ...list]);
    this._activeId.set(conversation.id);
    this.persist(this.persistence.create(conversation));
  }

  select(id: string): void {
    this._activeId.set(id);
    void this.loadMessages(id);
  }

  delete(id: string): void {
    this.persist(this.persistence.remove(id));
    this._conversations.update((list) => list.filter((c) => c.id !== id));
    if (this._activeId() === id) {
      const first = this._conversations()[0];
      if (first) {
        this._activeId.set(first.id);
        void this.loadMessages(first.id);
      } else {
        this.newConversation();
      }
    }
  }

  /** Ponto de entrada do composer: decide entre chat e geração de imagem. */
  async submit(payload: ComposerSubmit): Promise<void> {
    if (this._sending()) {
      return;
    }

    const conversation = this.active();
    if (!conversation) {
      return;
    }

    const userMessage: ChatMessage = {
      id: newId(),
      role: 'user',
      text: payload.text,
      images: payload.images,
      createdAt: Date.now()
    };
    this.appendMessage(conversation.id, userMessage);
    this.persist(this.persistence.addMessage(conversation.id, userMessage));
    this.maybeSetTitle(conversation.id, payload.text);

    if (payload.mode === 'image') {
      await this.runImage(conversation.id, payload.text);
    } else {
      await this.runChat(conversation.id);
    }
  }

  // ---- Chat com streaming ----
  private async runChat(conversationId: string): Promise<void> {
    const assistant: ChatMessage = {
      id: newId(),
      role: 'assistant',
      text: '',
      images: [],
      streaming: true,
      createdAt: Date.now()
    };
    this.appendMessage(conversationId, assistant);
    this._sending.set(true);

    try {
      const history = this.conversationById(conversationId)?.messages.filter(
        (m) => m.id !== assistant.id
      );
      await this.api.streamChat(history ?? [], (token) => {
        this.updateMessage(conversationId, assistant.id, (m) => ({
          ...m,
          text: m.text + token
        }));
      });
    } catch (err) {
      this.updateMessage(conversationId, assistant.id, (m) => ({
        ...m,
        text: m.text || `⚠️ Erro ao obter resposta: ${(err as Error).message}`
      }));
    } finally {
      this.finishAssistant(conversationId, assistant.id);
    }
  }

  // ---- Geração de imagem ----
  private async runImage(conversationId: string, prompt: string): Promise<void> {
    const assistant: ChatMessage = {
      id: newId(),
      role: 'assistant',
      text: '',
      images: [],
      streaming: true,
      createdAt: Date.now()
    };
    this.appendMessage(conversationId, assistant);
    this._sending.set(true);

    try {
      const b64 = await this.api.generateImage(prompt);
      const image: ChatImage = { id: newId(), mediaType: 'image/png', base64: b64 };
      this.updateMessage(conversationId, assistant.id, (m) => ({
        ...m,
        images: [image]
      }));
    } catch (err) {
      this.updateMessage(conversationId, assistant.id, (m) => ({
        ...m,
        text: `⚠️ Erro ao gerar imagem: ${(err as Error).message}`
      }));
    } finally {
      this.finishAssistant(conversationId, assistant.id);
    }
  }

  /** Encerra o streaming e persiste a mensagem final do assistente. */
  private finishAssistant(conversationId: string, messageId: string): void {
    this.updateMessage(conversationId, messageId, (m) => ({ ...m, streaming: false }));
    this._sending.set(false);

    const finalMessage = this.conversationById(conversationId)?.messages.find(
      (m) => m.id === messageId
    );
    if (finalMessage) {
      this.persist(this.persistence.addMessage(conversationId, finalMessage));
    }
  }

  // ---- Helpers de estado ----
  private conversationById(id: string): Conversation | undefined {
    return this._conversations().find((c) => c.id === id);
  }

  private appendMessage(conversationId: string, message: ChatMessage): void {
    this._conversations.update((list) =>
      list.map((c) =>
        c.id === conversationId ? { ...c, messages: [...c.messages, message] } : c
      )
    );
  }

  private updateMessage(
    conversationId: string,
    messageId: string,
    updater: (m: ChatMessage) => ChatMessage
  ): void {
    this._conversations.update((list) =>
      list.map((c) =>
        c.id === conversationId
          ? { ...c, messages: c.messages.map((m) => (m.id === messageId ? updater(m) : m)) }
          : c
      )
    );
  }

  private maybeSetTitle(conversationId: string, text: string): void {
    const conversation = this.conversationById(conversationId);
    if (!conversation || conversation.messages.length > 1 || !text.trim()) {
      return;
    }
    const title = text.trim().slice(0, 40) + (text.trim().length > 40 ? '…' : '');
    this._conversations.update((list) =>
      list.map((c) => (c.id === conversationId ? { ...c, title } : c))
    );
    this.persist(this.persistence.updateTitle(conversationId, title));
  }

  /** Persistência otimista: não bloqueia a UI; apenas registra erros. */
  private persist(promise: Promise<void>): void {
    promise.catch((err) => console.error('Falha ao persistir.', err));
  }
}
