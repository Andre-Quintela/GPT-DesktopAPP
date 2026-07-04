import type { HLJSApi } from 'highlight.js';

// Linguagens registradas no highlight.js core (mantém o bundle enxuto).
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import csharp from 'highlight.js/lib/languages/csharp';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import shell from 'highlight.js/lib/languages/shell';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import sql from 'highlight.js/lib/languages/sql';
import java from 'highlight.js/lib/languages/java';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import plaintext from 'highlight.js/lib/languages/plaintext';

let registered = false;

/** Registra o conjunto curado de linguagens uma única vez. */
export function registerHljsLanguages(hljs: HLJSApi): void {
  if (registered) {
    return;
  }
  registered = true;

  hljs.registerLanguage('typescript', typescript);
  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('python', python);
  hljs.registerLanguage('csharp', csharp);
  hljs.registerLanguage('json', json);
  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('shell', shell);
  hljs.registerLanguage('xml', xml);
  hljs.registerLanguage('css', css);
  hljs.registerLanguage('scss', scss);
  hljs.registerLanguage('sql', sql);
  hljs.registerLanguage('java', java);
  hljs.registerLanguage('go', go);
  hljs.registerLanguage('rust', rust);
  hljs.registerLanguage('yaml', yaml);
  hljs.registerLanguage('markdown', markdown);
  hljs.registerLanguage('plaintext', plaintext);

  // Aliases comuns
  hljs.registerAliases(['ts'], { languageName: 'typescript' });
  hljs.registerAliases(['js'], { languageName: 'javascript' });
  hljs.registerAliases(['py'], { languageName: 'python' });
  hljs.registerAliases(['cs', 'c#'], { languageName: 'csharp' });
  hljs.registerAliases(['sh', 'zsh'], { languageName: 'bash' });
  hljs.registerAliases(['html'], { languageName: 'xml' });
  hljs.registerAliases(['yml'], { languageName: 'yaml' });
  hljs.registerAliases(['md'], { languageName: 'markdown' });
}
