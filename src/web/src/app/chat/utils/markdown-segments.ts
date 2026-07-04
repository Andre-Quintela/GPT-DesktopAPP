import { marked, type Token } from 'marked';

/** Segmento de uma mensagem: prosa (HTML já renderizado) ou bloco de código. */
export type MessageSegment =
  | { kind: 'html'; html: string }
  | { kind: 'code'; code: string; lang: string };

/**
 * Quebra o texto markdown em segmentos, isolando os blocos de código (```lang)
 * para renderização por um componente interativo, e mantendo o restante como
 * HTML (prosa). Tolerante a cercas ainda abertas durante o streaming.
 */
export function toSegments(text: string): MessageSegment[] {
  const tokens = marked.lexer(text ?? '');
  const segments: MessageSegment[] = [];
  let proseBuffer: Token[] = [];

  const flushProse = () => {
    if (proseBuffer.length === 0) {
      return;
    }
    const html = marked.parser(proseBuffer);
    segments.push({ kind: 'html', html });
    proseBuffer = [];
  };

  for (const token of tokens) {
    if (token.type === 'code') {
      flushProse();
      segments.push({
        kind: 'code',
        code: token.text ?? '',
        lang: (token.lang ?? '').trim()
      });
    } else {
      proseBuffer.push(token);
    }
  }

  flushProse();
  return segments;
}
