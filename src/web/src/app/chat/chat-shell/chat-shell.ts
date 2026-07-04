import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ChatHeader } from '../chat-header/chat-header';
import { ConversationSidebar } from '../conversation-sidebar/conversation-sidebar';
import { MessageComposer } from '../message-composer/message-composer';
import { MessageList } from '../message-list/message-list';
import { ComposerSubmit } from '../models/chat.models';
import { ConversationStore } from '../services/conversation-store';

/**
 * Layout principal do chat: sidebar de conversas + cabeçalho, lista e composer.
 */
@Component({
  selector: 'app-chat-shell',
  imports: [ConversationSidebar, ChatHeader, MessageList, MessageComposer],
  templateUrl: './chat-shell.html',
  styleUrl: './chat-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatShell {
  private readonly store = inject(ConversationStore);

  readonly messages = this.store.messages;
  readonly sending = this.store.sending;

  onSubmit(payload: ComposerSubmit): void {
    void this.store.submit(payload);
  }
}
