import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ThemeService } from '../../core/theme.service';

/**
 * Cabeçalho do chat: título, configurações e alternância de tema claro/escuro.
 */
@Component({
  selector: 'app-chat-header',
  imports: [ButtonModule, TooltipModule],
  templateUrl: './chat-header.html',
  styleUrl: './chat-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatHeader {
  private readonly theme = inject(ThemeService);
  readonly mode = this.theme.mode;

  /** Solicita abrir o diálogo de configurações. */
  readonly openSettings = output<void>();

  toggleTheme(): void {
    this.theme.toggle();
  }
}
