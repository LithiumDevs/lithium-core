import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { TemplateResult } from 'lit';

/**
 * Opciones para el decorador @delay()
 */
export interface DelayOptions {
  /** Placeholder a mostrar mientras espera */
  placeholder?: TemplateResult | null;
  /** Loader function para dynamic imports (lazy loading real) */
  loader?: () => Promise<any>;
}

/**
 * Controller para carga con delay específico
 */
class DelayController implements ReactiveController {
  private host: ReactiveControllerHost & { [key: string]: any };
  private originalGetter: () => any;
  private cachedValue: any = null;
  private isLoaded = false;
  private delay: number;
  private options: DelayOptions;
  private timeoutId?: ReturnType<typeof setTimeout>;

  constructor(
    host: ReactiveControllerHost,
    originalGetter: () => any,
    delay: number,
    options: DelayOptions = {}
  ) {
    this.host = host as any;
    this.originalGetter = originalGetter;
    this.delay = delay;
    this.options = {
      placeholder: options.placeholder ?? null,
      loader: options.loader
    };
    host.addController(this);
  }

  hostConnected() {
    this.timeoutId = setTimeout(() => this.load(), this.delay);
  }

  hostDisconnected() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
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
      this.host.requestUpdate();
    } catch (error) {
      console.error('[DelayController] Error loading content:', error);
      this.isLoaded = true;
      this.cachedValue = this.originalGetter.call(this.host);
      this.host.requestUpdate();
    }
  }

  getValue() {
    if (this.isLoaded) {
      return this.cachedValue;
    }
    
    return this.options.placeholder ?? null;
  }
}

/**
 * Decorador @delay()
 * Carga el contenido después de X milisegundos
 * 
 * @example
 * ```typescript
 * // Delay simple sin placeholder
 * @delay(2000)
 * private get delayedSection() {
 *   return html`<delayed-content></delayed-content>`;
 * }
 * 
 * // Con placeholder
 * @delay(3000, { 
 *   placeholder: html`<p>⏳ Esperando 3 segundos...</p>` 
 * })
 * private get specialOffer() {
 *   return html`<special-offer></special-offer>`;
 * }
 * ```
 */
export function delay(ms: number, options?: DelayOptions) {
  return function (_target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalGetter = descriptor.get!;
    const controllerKey = `__delay_${propertyKey}`;

    descriptor.get = function (this: any) {
      if (!this[controllerKey]) {
        this[controllerKey] = new DelayController(this, originalGetter, ms, options);
      }

      return this[controllerKey].getValue();
    };

    return descriptor;
  };
}
