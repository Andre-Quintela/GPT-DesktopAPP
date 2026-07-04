import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  viewChild
} from '@angular/core';
import { MessageBubble } from '../message-bubble/message-bubble';
import { ChatMessage } from '../models/chat.models';

/**
 * Lista rolável de mensagens com auto-scroll para o fim quando chegam novidades.
 */
@Component({
  selector: 'app-message-list',
  imports: [MessageBubble],
  templateUrl: './message-list.html',
  styleUrl: './message-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageList implements AfterViewInit {
  readonly messages = input.required<ChatMessage[]>();

  private readonly scroller = viewChild.required<ElementRef<HTMLDivElement>>('scroller');

  constructor() {
    // Sempre que a lista de mensagens (ou o texto em streaming) mudar, rola para o fim.
    effect(() => {
      this.messages();
      queueMicrotask(() => this.scrollToBottom());
    });
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    const el = this.scroller().nativeElement;
    el.scrollTop = el.scrollHeight;
  }
}
