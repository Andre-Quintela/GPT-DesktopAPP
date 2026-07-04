export type ChatRole = 'user' | 'assistant' | 'system';

/** Imagem anexada/gerada. `base64` sem prefixo data URL; `mediaType` ex.: image/png. */
export interface ChatImage {
  id: string;
  mediaType: string;
  base64: string;
}

/** Referência a uma mensagem citada (reply). */
export interface ReplyRef {
  id: string;
  role: ChatRole;
  excerpt: string;
  /** true quando a mensagem citada contém imagem (habilita edição/modo imagem). */
  hasImage?: boolean;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  images: ChatImage[];
  /** true enquanto a resposta está sendo recebida em streaming. */
  streaming?: boolean;
  createdAt: number;
  /** Mensagem anterior citada por esta (reply). */
  replyTo?: ReplyRef;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  /** true quando as mensagens já foram carregadas do backend. */
  loaded?: boolean;
}

/** Modo de envio do composer. */
export type ComposerMode = 'chat' | 'image';

export interface ComposerSubmit {
  text: string;
  images: ChatImage[];
  mode: ComposerMode;
  replyTo?: ReplyRef;
}

/** Recorte curto do texto de uma mensagem para citação. */
export function makeExcerpt(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

/** Helper para gerar ids curtos e únicos. */
export function newId(): string {
  return crypto.randomUUID();
}

/** Converte um data URL (data:image/png;base64,XXXX) em ChatImage. */
export function dataUrlToImage(dataUrl: string): ChatImage {
  const [meta, base64] = dataUrl.split(',');
  const mediaType = meta.substring(meta.indexOf(':') + 1, meta.indexOf(';'));
  return { id: newId(), mediaType, base64 };
}

/** Monta um data URL a partir de uma ChatImage (para exibição). */
export function imageToDataUrl(image: ChatImage): string {
  return `data:${image.mediaType};base64,${image.base64}`;
}
