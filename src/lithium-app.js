var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
import { html } from 'lit';
import { Router } from '@lit-labs/router';
import { LithiumElement } from './lithium-element.js';
import { unsafeCSS } from '@lit/reactive-element/css-tag.js';
/**
 * Clase base para la aplicación principal de LithiumJS
 * Maneja el router principal y puede tener un layout global
 */
export class LithiumApp extends LithiumElement {
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
    render() {
        return html `
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
export function defineApp(options) {
    return function (target) {
        var _a, _b;
        const { tag, routes, styles } = options;
        // Validar que el tag tenga un guion
        if (!tag.includes('-')) {
            throw new Error(`Invalid tag name "${tag}". Custom element tags must contain a hyphen (-).`);
        }
        // Crear clase extendida con configuración
        const ExtendedClass = (_a = class extends (_b = target) {
                constructor(...args) {
                    super(...args);
                    // Inicializar el router con las rutas principales
                    this._router = new Router(this, routes);
                    if (options.i18n && typeof window !== 'undefined') {
                        try {
                            options.i18n();
                        }
                        catch (err) {
                            console.warn('LithiumJS: i18n initialization failed', err);
                        }
                    }
                }
            },
            __setFunctionName(_a, "ExtendedClass"),
            _a.styles = (() => {
                if (styles && styles.length > 0) {
                    const cssResults = styles.map(style => typeof style === 'string' ? unsafeCSS(style) : style);
                    // Combinar estilos base con los nuevos estilos
                    const baseStyles = Array.isArray(Reflect.get(_b, "styles", _a))
                        ? Reflect.get(_b, "styles", _a)
                        : [Reflect.get(_b, "styles", _a)];
                    return [...baseStyles, ...cssResults];
                }
                return Reflect.get(_b, "styles", _a);
            })(),
            _a);
        // Registrar el custom element
        if (!customElements.get(tag)) {
            customElements.define(tag, ExtendedClass);
        }
        return ExtendedClass;
    };
}
