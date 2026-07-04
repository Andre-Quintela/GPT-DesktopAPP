import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ButtonModule } from 'primeng/button';
import hljs from 'highlight.js/lib/core';
import { registerHljsLanguages } from './hljs-languages';

registerHljsLanguages(hljs);

/**
 * Bloco de código interativo (estilo ChatGPT): cabeçalho com a linguagem,
 * botão "Copiar" com feedback e syntax highlighting via highlight.js.
 */
@Component({
  selector: 'app-code-block',
  imports: [ButtonModule],
  templateUrl: './code-block.html',
  styleUrl: './code-block.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CodeBlock {
  private readonly sanitizer = inject(DomSanitizer);

  readonly code = input.required<string>();
  readonly language = input<string>('');

  protected readonly copied = signal(false);

  /** Rótulo exibido no cabeçalho. */
  protected readonly label = computed(() => this.language() || 'código');

  /** HTML colorizado (hljs escapa o conteúdo → seguro para bypass). */
  protected readonly highlighted = computed<SafeHtml>(() => {
    const code = this.code();
    const lang = this.language();
    let html: string;

    if (lang && hljs.getLanguage(lang)) {
      html = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    } else {
      html = hljs.highlightAuto(code).value;
    }

    return this.sanitizer.bypassSecurityTrustHtml(html);
  });

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // clipboard indisponível — ignora silenciosamente
    }
  }
}
