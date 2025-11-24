import { html, ReactiveControllerHost, type TemplateResult } from 'lit';
import { Router } from '@lit-labs/router';
import { LithiumElement } from './lithium-element.js';
import { unsafeCSS } from '@lit/reactive-element/css-tag.js';
import type { CSSResultGroup } from '@lit/reactive-element/css-tag.js';

/**
 * Opciones para definir la aplicación principal
 */
export interface DefineAppOptions {
  /**
   * Tag HTML de la aplicación (debe contener un guion)
   */
  tag: string;

  /**
   * Configuración de rutas principales de la aplicación
   */
  routes: any[];

  /**
   * Estilos CSS de la aplicación (opcional)
   */
  styles?: (CSSResultGroup | string)[];

  /**
   * Indica si la aplicación debe inicializar i18n automáticamente (opcional)
   */
  i18n?: () => Promise<void> | void;
}

/**
 * Clase base para la aplicación principal de LithiumJS
 * Maneja el router principal y puede tener un layout global
 */
export abstract class LithiumApp extends LithiumElement {
  /**
   * Instancia del router principal de la aplicación
   * Se configura automáticamente desde el decorador
   */
  protected _router!: Router;

  /**
   * Método que se puede sobrescribir para personalizar el layout global
   * Por defecto, renderiza el outlet del router dentro de un main
   * 
   * @example
   * ```typescript
   * // Layout global personalizado
   * render() {
   *   return html`
   *     <app-header></app-header>
   *     <aside>Sidebar</aside>
   *     <main>
   *       ${this._router.outlet()}
   *     </main>
   *     <app-footer></app-footer>
   *   `;
   * }
   * ```
   */
  render(): TemplateResult {
    return html`
      <main>
        ${this._router.outlet()}
      </main>
    `;
  }
}

/**
 * Decorador para definir la aplicación principal con router automático
 * 
 * @param options - Opciones de configuración de la aplicación
 * 
 * @example
 * ```typescript
 * // Aplicación simple
 * @defineApp({
 *   tag: 'my-app',
 *   routes: routes
 * })
 * export class MyApp extends LithiumApp {}
 * 
 * // Con estilos personalizados
 * @defineApp({
 *   tag: 'my-app',
 *   routes: routes,
 *   styles: [appStyle]
 * })
 * export class MyApp extends LithiumApp {}
 * 
 * // Con layout personalizado
 * @defineApp({
 *   tag: 'my-app',
 *   routes: routes
 * })
 * export class MyApp extends LithiumApp {
 *   render() {
 *     return html`
 *       <header>Header</header>
 *       <main>${this._router.outlet()}</main>
 *       <footer>Footer</footer>
 *     `;
 *   }
 * }
 * ```
 */
export function defineApp(options: DefineAppOptions) {
  return function <T extends typeof LithiumApp>(target: T) {
    const { tag, routes, styles } = options;

    // Validar que el tag tenga un guion
    if (!tag.includes('-')) {
      throw new Error(
        `Invalid tag name "${tag}". Custom element tags must contain a hyphen (-).`
      );
    }

    // Crear clase extendida con configuración
    const ExtendedClass = class extends (target as any) {
      static styles = (() => {
        if (styles?.length) {
          const cssResults = styles.map(s => 
            typeof s === 'string' ? unsafeCSS(s) : s
          );

          const base = super.styles;
          if (!base) return cssResults;
          
          return Array.isArray(base)
            ? [...base, ...cssResults]
            : [base, ...cssResults];
        }
        
        return super.styles;
      })();

      constructor(...args: any[]) {
        super(...args);
        // Inicializar el router con las rutas principales
        this._router = new Router(this as unknown as ReactiveControllerHost & HTMLElement, routes);

        if (options.i18n && typeof window !== 'undefined') {
          try {
            options.i18n();
          } catch (err) {
            console.warn('LithiumJS: i18n initialization failed', err);
          }
        }
      }
    };

    // Registrar el custom element
    if (!customElements.get(tag)) {
      customElements.define(tag, ExtendedClass as any);
    }

    return ExtendedClass as unknown as T;
  };
}
