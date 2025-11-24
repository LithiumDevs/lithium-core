import { unsafeCSS } from '@lit/reactive-element/css-tag.js';
import type { CSSResultGroup } from '@lit/reactive-element/css-tag.js';
import { LithiumElement } from './lithium-element.js';

/**
 * Opciones para definir una página
 */
interface DefinePageOptions {
  /** Nombre del tag HTML (debe contener un guion) */
  tag: string;
  /** Título de la página (se establece en document.title) */
  title?: string;
  /** Estilos del componente (CSS inline o CSSResult) */
  styles?: (CSSResultGroup | string)[];
}

/**
 * Decorador para definir una página con título automático
 * Similar a @defineElement pero con funcionalidades específicas de página
 * 
 * @param options - Configuración de la página (tag, título y estilos opcionales)
 * 
 * @example
 * ```typescript
 * // Página con título
 * @definePage({ 
 *   tag: 'home-page',
 *   title: 'Home - My App'
 * })
 * export class HomePage extends LithiumElement {
 *   render() {
 *     return html`<h1>Welcome!</h1>`;
 *   }
 * }
 * 
 * // Página con título y estilos
 * import style from './home.page.css?inline';
 * 
 * @definePage({ 
 *   tag: 'home-page',
 *   title: 'Home',
 *   styles: [style]
 * })
 * export class HomePage extends LithiumElement {
 *   render() {
 *     return html`<h1>Welcome!</h1>`;
 *   }
 * }
 * 
 * // Página sin título (no cambia document.title)
 * @definePage({ tag: 'home-page' })
 * export class HomePage extends LithiumElement {
 *   render() {
 *     return html`<h1>Welcome!</h1>`;
 *   }
 * }
 * ```
 */
export function definePage(options: DefinePageOptions) {
  return function <T extends CustomElementConstructor>(constructor: T) {
    const { tag, title, styles } = options;

    // Guardar el tag name como propiedad estática para el router
    (constructor as any).tagName = tag;

    if (styles && styles.length > 0) {
      const cssResults = styles.map(style => 
        typeof style === 'string' ? unsafeCSS(style) : style
      );

      const base = LithiumElement.styles;

      if (!base) {
        (constructor as any).styles = [...cssResults];
      } else {
        (constructor as any).styles = Array.isArray(base) 
        ? [...base, ...cssResults] 
        : [base, ...cssResults];
      }
    }

    // Si se especificó un título, sobrescribir connectedCallback
    if (title) {
      const originalConnectedCallback = constructor.prototype.connectedCallback;
      
      constructor.prototype.connectedCallback = function() {
        // Llamar al connectedCallback original si existe
        if (originalConnectedCallback) {
          originalConnectedCallback.call(this);
        }
        
        // Establecer el título de la página
        document.title = title;
      };
    }

    // Registrar el elemento personalizado
    if (!customElements.get(tag)) {
      customElements.define(tag, constructor);
    }

    return constructor;
  };
}
