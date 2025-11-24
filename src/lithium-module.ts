import { html, type TemplateResult } from 'lit';
import { Routes } from '@lit-labs/router/routes.js';
import { LithiumElement } from './lithium-element.js';
import { unsafeCSS } from '@lit/reactive-element/css-tag.js';
import type { CSSResultGroup } from '@lit/reactive-element/css-tag.js';
import { ReactiveControllerHost } from 'lit';

/**
 * Opciones para definir un módulo
 */
export interface DefineModuleOptions {
  /**
   * Tag HTML del módulo (debe contener un guion)
   */
  tag: string;

  /**
   * Configuración de rutas del módulo
   */
  routes: any[];

  /**
   * Estilos CSS del módulo (opcional)
   */
  styles?: (CSSResultGroup | string)[];
}

/**
 * Clase base para módulos de LithiumJS
 * Los módulos tienen rutas automáticas y pueden tener layouts personalizados
 */
export abstract class LithiumModule extends LithiumElement {
  /**
   * Instancia del router interno del módulo
   * Se configura automáticamente desde el decorador
   */
  protected _routes!: Routes;

  /**
   * Método que se puede sobrescribir para personalizar el layout
   * Por defecto, solo renderiza el outlet de las rutas
   * 
   * @example
   * ```typescript
   * // Con layout personalizado
   * render() {
   *   return html`
   *     <header>Mi Header</header>
   *     <main>${this._routes.outlet()}</main>
   *     <footer>Mi Footer</footer>
   *   `;
   * }
   * ```
   */
  render(): TemplateResult {
    return html`${this._routes.outlet()}`;
  }
}

/**
 * Decorador para definir un módulo Lithium con rutas automáticas
 * 
 * @param options - Opciones de configuración del módulo
 * 
 * @example
 * ```typescript
 * @defineModule({
 *   tag: 'public-module',
 *   routes: publicRoutes
 * })
 * export class PublicModule extends LithiumModule {}
 * 
 * // Con layout personalizado
 * @defineModule({
 *   tag: 'admin-module',
 *   routes: adminRoutes
 * })
 * export class AdminModule extends LithiumModule {
 *   render() {
 *     return html`
 *       <nav>Navigation</nav>
 *       ${this._routes.outlet()}
 *     `;
 *   }
 * }
 * ```
 */
export function defineModule(options: DefineModuleOptions) {
  return function <T extends typeof LithiumModule>(target: T) {
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
        // Inicializar el router con las rutas del módulo
        this._routes = new Routes(this as unknown as ReactiveControllerHost & HTMLElement, routes);
      }
    };

    // Registrar el custom element
    if (!customElements.get(tag)) {
      customElements.define(tag, ExtendedClass as any);
    }

    return ExtendedClass as unknown as T;
  };
}
