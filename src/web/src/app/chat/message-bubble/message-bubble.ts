import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { ImageModule } from 'primeng/image';
import { CodeBlock } from '../code-block/code-block';
import { ChatImage, ChatMessage, imageToDataUrl } from '../models/chat.models';
import { toSegments } from '../utils/markdown-segments';

/**
 * Bolha de mensagem reutilizável. Renderiza texto (markdown + blocos de código
 * interativos para o assistente), imagens (com preview/zoom) e o estado de streaming.
 */
@Component({
  selector: 'app-message-bubble',
  imports: [AvatarModule, ImageModule, CodeBlock],
  templateUrl: './message-bubble.html',
  styleUrl: './message-bubble.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageBubble {
  readonly message = input.required<ChatMessage>();

  readonly isUser = computed(() => this.message().role === 'user');

  /** Segmentos (prosa vs. código) da resposta do assistente. */
  readonly segments = computed(() => toSegments(this.message().text));

  imageSrc(image: ChatImage): string {
    return imageToDataUrl(image);
  }
}
