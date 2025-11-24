/**
 * Controller para carga diferida
 */
class DeferController {
    constructor(host, originalGetter, options = {}) {
        this.cachedValue = null;
        this.isLoaded = false;
        this.host = host;
        this.originalGetter = originalGetter;
        this.options = {
            placeholder: options.placeholder ?? null,
            delay: options.delay ?? 0,
            loader: options.loader
        };
        host.addController(this);
    }
    hostConnected() {
        // Diferir la carga
        if (this.options.delay > 0) {
            this.timeoutId = setTimeout(() => this.load(), this.options.delay);
        }
        else {
            // Siguiente microtask (después del render)
            Promise.resolve().then(() => this.load());
        }
    }
    hostDisconnected() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
    }
    async load() {
        if (this.isLoaded)
            return;
        try {
            // Si hay loader, ejecutarlo primero (dynamic import)
            if (this.options.loader) {
                await this.options.loader();
            }
            this.isLoaded = true;
            this.cachedValue = this.originalGetter.call(this.host);
            this.host.requestUpdate();
        }
        catch (error) {
            console.error('[DeferController] Error loading content:', error);
            this.isLoaded = true; // Mostrar contenido original aunque falle
            this.cachedValue = this.originalGetter.call(this.host);
            this.host.requestUpdate();
        }
    }
    getValue() {
        if (this.isLoaded) {
            return this.cachedValue;
        }
        // Retornar placeholder o null
        return this.options.placeholder ?? null;
    }
}
/**
 * Decorador @defer()
 * Carga el contenido después del render inicial
 *
 * @example
 * ```typescript
 * // Sin placeholder
 * @defer()
 * private get analytics() {
 *   return html`<analytics-widget></analytics-widget>`;
 * }
 *
 * // Con placeholder
 * @defer({ placeholder: html`<p>Loading...</p>` })
 * private get heavyComponent() {
 *   return html`<heavy-component></heavy-component>`;
 * }
 *
 * // Con delay
 * @defer({ delay: 2000, placeholder: html`<spinner></spinner>` })
 * private get delayedContent() {
 *   return html`<delayed-content></delayed-content>`;
 * }
 * ```
 */
export function defer(options) {
    return function (_target, propertyKey, descriptor) {
        const originalGetter = descriptor.get;
        const controllerKey = `__defer_${propertyKey}`;
        descriptor.get = function () {
            if (!this[controllerKey]) {
                this[controllerKey] = new DeferController(this, originalGetter, options);
            }
            return this[controllerKey].getValue();
        };
        return descriptor;
    };
}
