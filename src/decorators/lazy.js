import { html } from 'lit';
/**
 * Controller para lazy loading con Intersection Observer
 */
class LazyController {
    constructor(host, originalGetter, options = {}) {
        this.cachedValue = null;
        this.isLoaded = false;
        this.host = host;
        this.originalGetter = originalGetter;
        this.placeholderKey = `lazy-${Math.random().toString(36).substring(7)}`;
        this.options = {
            placeholder: options.placeholder ?? html `
        <div class="lazy-placeholder">
          <span style="color: #999;">Cargando...</span>
        </div>
      `,
            threshold: options.threshold ?? 0.1,
            rootMargin: options.rootMargin ?? '50px',
            minHeight: options.minHeight ?? '100px',
            loader: options.loader
        };
        host.addController(this);
    }
    hostConnected() {
        // Crear observer
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    this.load();
                }
            });
        }, {
            threshold: this.options.threshold,
            rootMargin: this.options.rootMargin
        });
        // Observar después del render
        requestAnimationFrame(() => {
            const element = this.host.renderRoot?.querySelector(`[data-lazy="${this.placeholderKey}"]`);
            if (element) {
                this.observer.observe(element);
            }
        });
    }
    hostDisconnected() {
        this.observer?.disconnect();
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
            this.observer?.disconnect();
            this.host.requestUpdate();
        }
        catch (error) {
            console.error('[LazyController] Error loading content:', error);
            this.isLoaded = true;
            this.cachedValue = this.originalGetter.call(this.host);
            this.observer?.disconnect();
            this.host.requestUpdate();
        }
    }
    getValue() {
        if (this.isLoaded) {
            return this.cachedValue;
        }
        // Retornar placeholder con data attribute para observar
        return html `
      <div 
        data-lazy="${this.placeholderKey}"
        style="min-height: ${this.options.minHeight}; display: flex; align-items: center; justify-content: center;">
        ${this.options.placeholder}
      </div>
    `;
    }
}
/**
 * Decorador @lazy()
 * Carga el contenido solo cuando entra en viewport (Intersection Observer)
 *
 * @example
 * ```typescript
 * // Lazy loading básico
 * @lazy()
 * private get comments() {
 *   return html`<comments-section></comments-section>`;
 * }
 *
 * // Con placeholder personalizado
 * @lazy({
 *   placeholder: html`<skeleton-loader></skeleton-loader>`,
 *   threshold: 0.5
 * })
 * private get reviews() {
 *   return html`<reviews-section></reviews-section>`;
 * }
 * ```
 */
export function lazy(options) {
    return function (_target, propertyKey, descriptor) {
        const originalGetter = descriptor.get;
        const controllerKey = `__lazy_${propertyKey}`;
        descriptor.get = function () {
            if (!this[controllerKey]) {
                this[controllerKey] = new LazyController(this, originalGetter, options);
            }
            return this[controllerKey].getValue();
        };
        return descriptor;
    };
}
