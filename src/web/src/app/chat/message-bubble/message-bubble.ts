import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';
import { ImageModule } from 'primeng/image';
import { MarkdownPipe } from '../../core/markdown.pipe';
import { ChatImage, ChatMessage, imageToDataUrl } from '../models/chat.models';

/**
 * Bolha de mensagem reutilizável. Renderiza texto (markdown para o assistente),
 * imagens (com preview/zoom) e um cursor durante o streaming.
 */
@Component({
  selector: 'app-message-bubble',
  imports: [AvatarModule, ImageModule, MarkdownPipe],
  templateUrl: './message-bubble.html',
  styleUrl: './message-bubble.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageBubble {
  readonly message = input.required<ChatMessage>();

  readonly isUser = computed(() => this.message().role === 'user');

  imageSrc(image: ChatImage): string {
    return imageToDataUrl(image);
  }
}
