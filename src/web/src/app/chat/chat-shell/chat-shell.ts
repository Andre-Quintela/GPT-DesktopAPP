import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ChatHeader } from '../chat-header/chat-header';
import { ConversationSidebar } from '../conversation-sidebar/conversation-sidebar';
import { MessageComposer } from '../message-composer/message-composer';
import { MessageList } from '../message-list/message-list';
import { SettingsDialog } from '../settings-dialog/settings-dialog';
import { ComposerSubmit } from '../models/chat.models';
import { ConversationStore } from '../services/conversation-store';
import { SettingsService } from '../../core/settings.service';

/**
 * Layout principal do chat: sidebar de conversas + cabeçalho, lista e composer.
 */
@Component({
  selector: 'app-chat-shell',
  imports: [ConversationSidebar, ChatHeader, MessageList, MessageComposer, SettingsDialog],
  templateUrl: './chat-shell.html',
  styleUrl: './chat-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatShell implements OnInit {
  private readonly store = inject(ConversationStore);
  private readonly settings = inject(SettingsService);

  readonly messages = this.store.messages;
  readonly sending = this.store.sending;
  readonly configured = this.settings.configured;

  readonly settingsVisible = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      await this.settings.load();
      // Primeira execução sem chaves → abre o diálogo automaticamente.
      if (!this.settings.configured()) {
        this.settingsVisible.set(true);
      }
    } catch {
      // backend indisponível — mantém UI utilizável
    }
  }

  openSettings(): void {
    this.settingsVisible.set(true);
  }

  onSubmit(payload: ComposerSubmit): void {
    void this.store.submit(payload);
  }
}
