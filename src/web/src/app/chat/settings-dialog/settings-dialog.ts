import { ChangeDetectionStrategy, Component, effect, inject, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { AppSettings, SettingsService } from '../../core/settings.service';

/**
 * Diálogo de configuração das chaves Azure OpenAI (chat e imagens).
 */
@Component({
  selector: 'app-settings-dialog',
  imports: [FormsModule, DialogModule, InputTextModule, PasswordModule, ButtonModule],
  templateUrl: './settings-dialog.html',
  styleUrl: './settings-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsDialog {
  private readonly settings = inject(SettingsService);

  readonly visible = model(false);

  protected readonly saving = signal(false);
  protected readonly form = signal<AppSettings>(emptySettings());

  constructor() {
    // Carrega os valores atuais sempre que o diálogo é aberto.
    effect(() => {
      if (this.visible()) {
        void this.loadCurrent();
      }
    });
  }

  private async loadCurrent(): Promise<void> {
    try {
      this.form.set(await this.settings.load());
    } catch {
      this.form.set(emptySettings());
    }
  }

  protected patchChat<K extends keyof AppSettings['chat']>(key: K, value: string): void {
    this.form.update((f) => ({ ...f, chat: { ...f.chat, [key]: value } }));
  }

  protected patchImages<K extends keyof AppSettings['images']>(key: K, value: string): void {
    this.form.update((f) => ({ ...f, images: { ...f.images, [key]: value } }));
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    try {
      await this.settings.save(this.form());
      this.visible.set(false);
    } catch (err) {
      console.error('Falha ao salvar configurações.', err);
    } finally {
      this.saving.set(false);
    }
  }
}

function emptySettings(): AppSettings {
  return {
    chat: { endpoint: '', deploymentName: '', apiKey: '' },
    images: { endpoint: '', deploymentName: '', apiVersion: '2024-02-01', apiKey: '' }
  };
}
