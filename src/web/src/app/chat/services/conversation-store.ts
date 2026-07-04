import { computed, Injectable, signal } from '@angular/core';
import { ChatApiService } from './chat-api.service';
import { ConversationApiService } from './conversation-api.service';
import {
  ChatImage,
  ChatMessage,
  ComposerSubmit,
  Conversation,
  newId,
  ReplyRef
} from '../models/chat.models';

/** Nº máximo de mensagens recentes enviadas como contexto (≈10 turnos). */
const CONTEXT_WINDOW = 20;

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
        createdAt: m.createdAt,
        replyTo: m.replyTo
          ? { id: m.replyTo.id, role: m.replyTo.role as ChatMessage['role'], excerpt: m.replyTo.excerpt }
          : undefined
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
      createdAt: Date.now(),
      replyTo: payload.replyTo
    };
    this.appendMessage(conversation.id, userMessage);
    this.persist(this.persistence.addMessage(conversation.id, userMessage));
    this.maybeSetTitle(conversation.id, payload.text);

    if (payload.mode === 'image') {
      await this.runImage(conversation.id, userMessage.id, payload.text, payload.replyTo);
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
      const history = this.buildContext(conversationId, assistant.id);
      await this.api.streamChat(history, (token) => {
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
  private async runImage(
    conversationId: string,
    userMessageId: string,
    instruction: string,
    replyTo?: ReplyRef
  ): Promise<void> {
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
      // Reply a uma imagem → edição (image-to-image) preservando a original.
      const source = replyTo ? this.imageOf(conversationId, replyTo.id) : undefined;
      let b64: string;
      if (source) {
        b64 = await this.api.editImage(instruction, source.base64, source.mediaType);
      } else {
        const prompt = this.buildImagePrompt(conversationId, userMessageId, instruction, replyTo);
        b64 = await this.api.generateImage(prompt);
      }
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

  /** Retorna a primeira imagem de uma mensagem (para edição via reply). */
  private imageOf(conversationId: string, messageId: string): ChatImage | undefined {
    const msg = this.conversationById(conversationId)?.messages.find((m) => m.id === messageId);
    return msg?.images[0];
  }

  /**
   * Compõe o prompt de geração de imagem. Como o endpoint é texto→imagem (não recebe
   * a imagem anterior), reaproveitamos o prompt base — o texto que originou a imagem
   * citada (reply) ou a última imagem gerada na conversa — e aplicamos a nova instrução.
   */
  private buildImagePrompt(
    conversationId: string,
    userMessageId: string,
    instruction: string,
    replyTo?: ReplyRef
  ): string {
    const msgs = this.conversationById(conversationId)?.messages ?? [];

    // Ponto de partida: a mensagem citada (imagem), ou a mensagem atual do usuário.
    const anchorId = replyTo?.id ?? userMessageId;
    const anchorIdx = msgs.findIndex((m) => m.id === anchorId);
    const searchFrom = anchorIdx >= 0 ? anchorIdx : msgs.length - 1;

    // Prompt base = o texto de usuário anterior mais próximo (o que originou a imagem).
    let base = '';
    for (let i = searchFrom; i >= 0; i--) {
      const m = msgs[i];
      if (m.id === userMessageId) {
        continue; // ignora a instrução atual
      }
      if (m.role === 'user' && m.text.trim()) {
        base = m.text.trim();
        break;
      }
    }

    return base ? `${base}. ${instruction}` : instruction;
  }

  /**
   * Monta o contexto enviado ao modelo: janela recente + "pin" das mensagens citadas
   * (reply) que ficaram fora da janela, e prefixa citação no texto de quem deu reply.
   */
  private buildContext(conversationId: string, excludeId: string): ChatMessage[] {
    const all = (this.conversationById(conversationId)?.messages ?? []).filter(
      (m) => m.id !== excludeId
    );

    let history = all.slice(-CONTEXT_WINDOW);
    const included = new Set(history.map((m) => m.id));

    // Traz mensagens citadas que ficaram fora da janela.
    for (const m of [...history]) {
      const ref = m.replyTo;
      if (ref && !included.has(ref.id)) {
        const target = all.find((x) => x.id === ref.id);
        if (target) {
          history = [target, ...history];
          included.add(target.id);
        }
      }
    }

    // Reforça o ponto citado no texto enviado ao modelo (UI mantém o texto limpo).
    return history.map((m) =>
      m.replyTo
        ? { ...m, text: `> (respondendo a) ${m.replyTo.excerpt}\n\n${m.text}` }
        : m
    );
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
