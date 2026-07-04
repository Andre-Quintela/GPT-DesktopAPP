import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { TooltipModule } from 'primeng/tooltip';
import {
  ChatImage,
  ComposerMode,
  ComposerSubmit,
  dataUrlToImage,
  imageToDataUrl
} from '../models/chat.models';

/**
 * Composer reutilizável: texto + anexos de imagem, com toggle para modo "gerar imagem".
 */
@Component({
  selector: 'app-message-composer',
  imports: [FormsModule, ButtonModule, TextareaModule, ToggleButtonModule, TooltipModule],
  templateUrl: './message-composer.html',
  styleUrl: './message-composer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageComposer {
  /** Desabilita o envio enquanto uma resposta está em andamento. */
  readonly disabled = input(false);

  readonly submit = output<ComposerSubmit>();

  protected readonly text = signal('');
  protected readonly images = signal<ChatImage[]>([]);
  protected readonly imageMode = signal(false);

  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected previewSrc(image: ChatImage): string {
    return imageToDataUrl(image);
  }

  protected openFilePicker(): void {
    this.fileInput().nativeElement.click();
  }

  protected async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    for (const file of files) {
      const dataUrl = await readAsDataUrl(file);
      this.images.update((list) => [...list, dataUrlToImage(dataUrl)]);
    }
    input.value = '';
  }

  protected removeImage(id: string): void {
    this.images.update((list) => list.filter((img) => img.id !== id));
  }

  protected onEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.shiftKey) {
      return;
    }
    event.preventDefault();
    this.send();
  }

  protected send(): void {
    if (this.disabled()) {
      return;
    }
    const text = this.text().trim();
    const images = this.images();
    const mode: ComposerMode = this.imageMode() ? 'image' : 'chat';

    if (!text && (mode === 'image' || images.length === 0)) {
      return; // nada para enviar
    }

    this.submit.emit({ text, images, mode });
    this.text.set('');
    this.images.set([]);
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
