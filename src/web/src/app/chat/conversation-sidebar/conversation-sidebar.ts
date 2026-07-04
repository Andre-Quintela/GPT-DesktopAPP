import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ConversationStore } from '../services/conversation-store';

/**
 * Barra lateral: novo chat, lista de conversas com seleção e exclusão.
 */
@Component({
  selector: 'app-conversation-sidebar',
  imports: [ButtonModule, TooltipModule],
  templateUrl: './conversation-sidebar.html',
  styleUrl: './conversation-sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConversationSidebar {
  private readonly store = inject(ConversationStore);

  readonly conversations = this.store.conversations;
  readonly active = this.store.active;

  newChat(): void {
    this.store.newConversation();
  }

  select(id: string): void {
    this.store.select(id);
  }

  remove(event: Event, id: string): void {
    event.stopPropagation();
    this.store.delete(id);
  }
}
