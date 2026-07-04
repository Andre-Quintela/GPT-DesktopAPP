import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ChatShell } from './chat/chat-shell/chat-shell';

@Component({
  selector: 'app-root',
  imports: [ChatShell],
  template: '<app-chat-shell />',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {}
