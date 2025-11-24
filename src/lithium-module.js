var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
import { html } from 'lit';
import { Routes } from '@lit-labs/router/routes.js';
import { LithiumElement } from './lithium-element.js';
import { unsafeCSS } from '@lit/reactive-element/css-tag.js';
/**
 * Clase base para módulos de LithiumJS
 * Los módulos tienen rutas automáticas y pueden tener layouts personalizados
 */
export class LithiumModule extends LithiumElement {
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
    render() {
        return html `${this._routes.outlet()}`;
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
export function defineModule(options) {
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
                    // Inicializar el router con las rutas del módulo
                    this._routes = new Routes(this, routes);
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
