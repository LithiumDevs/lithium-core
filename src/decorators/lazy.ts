import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { TemplateResult } from 'lit';
import { html } from 'lit';

/**
 * Opciones para el decorador @lazy()
 */
export interface LazyOptions {
  /** Placeholder a mostrar mientras no es visible */
  placeholder?: TemplateResult | null;
  /** Threshold del IntersectionObserver (0-1) */
  threshold?: number;
  /** RootMargin del IntersectionObserver */
  rootMargin?: string;
  /** Altura mínima del placeholder (para evitar layout shift) */
  minHeight?: string;
  /** Loader function para dynamic imports (lazy loading real) */
  loader?: () => Promise<any>;
}

/**
 * Controller para lazy loading con Intersection Observer
 */
class LazyController implements ReactiveController {
  private host: ReactiveControllerHost & { [key: string]: any };
  private originalGetter: () => any;
  private cachedValue: any = null;
  private isLoaded = false;
  private observer?: IntersectionObserver;
  private options: LazyOptions;
  private placeholderKey: string;

  constructor(
    host: ReactiveControllerHost,
    originalGetter: () => any,
    options: LazyOptions = {}
  ) {
    this.host = host as any;
    this.originalGetter = originalGetter;
    this.placeholderKey = `lazy-${Math.random().toString(36).substring(7)}`;
    this.options = {
      placeholder: options.placeholder ?? html`
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
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.load();
          }
        });
      },
      {
        threshold: this.options.threshold,
        rootMargin: this.options.rootMargin
      }
    );

    // Observar después del render
    requestAnimationFrame(() => {
      const element = (this.host as any).renderRoot?.querySelector(`[data-lazy="${this.placeholderKey}"]`);
      if (element) {
        this.observer!.observe(element);
      }
    });
  }

  hostDisconnected() {
    this.observer?.disconnect();
  }

  private async load() {
    if (this.isLoaded) return;
    
    try {
      
      // Si hay loader, ejecutarlo primero (dynamic import)
      if (this.options.loader) {
        await this.options.loader();
      }
      
      this.isLoaded = true;
      this.cachedValue = this.originalGetter.call(this.host);
      this.observer?.disconnect();
      this.host.requestUpdate();
    } catch (error) {
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
    return html`
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
export function lazy(options?: LazyOptions) {
  return function (_target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalGetter = descriptor.get!;
    const controllerKey = `__lazy_${propertyKey}`;

    descriptor.get = function (this: any) {
      if (!this[controllerKey]) {
        this[controllerKey] = new LazyController(this, originalGetter, options);
      }

      return this[controllerKey].getValue();
    };

    return descriptor;
  };
}
