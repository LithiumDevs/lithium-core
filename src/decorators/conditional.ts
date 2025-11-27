import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { html } from 'lit';
import type { TemplateResult } from 'lit';

/**
 * Opciones para el decorador @conditional()
 */
export interface ConditionalOptions {
  /** Placeholder a mostrar cuando la condición es false */
  placeholder?: TemplateResult;
  /** Loader function para dynamic imports (lazy loading real) */
  loader?: () => Promise<any>;
}

/**
 * Controller para renderizado condicional
 * Renderiza contenido solo cuando una condición es verdadera
 */
export class ConditionalController implements ReactiveController {
  private host: ReactiveControllerHost & Record<string, any>;
  private conditionKey: string;
  private options: ConditionalOptions;
  private cachedValue: any = null;
  private isLoaded = false;
  private isLoading = false;

  constructor(
    host: ReactiveControllerHost & Record<string, any>,
    conditionKey: string,
    options: ConditionalOptions = {}
  ) {
    this.host = host;
    this.conditionKey = conditionKey;
    this.options = {
      placeholder: options.placeholder,
      loader: options.loader
    };
    host.addController(this);
  }

  hostConnected() {
    // No necesita inicialización especial
  }

  private async load(): Promise<void> {
    if (this.isLoaded || this.isLoading || !this.options.loader) {
      return;
    }

    this.isLoading = true;
    try {
      this.cachedValue = await this.options.loader();
      this.isLoaded = true;
    } catch (error) {
      console.error('Error loading conditional content:', error);
      this.cachedValue = html`<div style="color: red;">Error cargando contenido</div>`;
      this.isLoaded = true;
    } finally {
      this.isLoading = false;
      this.host.requestUpdate();
    }
  }

  render(content: () => TemplateResult): TemplateResult {
    const condition = this.host[this.conditionKey];
    
    if (!condition) {
      return this.options.placeholder || html``;
    }

    // Si hay loader y no se ha cargado, iniciar carga
    if (this.options.loader && !this.isLoaded && !this.isLoading) {
      this.load();
      return this.options.placeholder || html`<div>Cargando...</div>`;
    }

    // Si está cargando, mostrar placeholder
    if (this.isLoading) {
      return this.options.placeholder || html`<div>Cargando...</div>`;
    }

    // Si hay loader y ya está cargado, usar el valor cacheado
    if (this.options.loader && this.isLoaded) {
      return this.cachedValue;
    }
    
    // Sin loader, usar contenido normal
    return content();
  }
}

/**
 * Decorador @conditional
 * Renderiza el método solo cuando la propiedad especificada es true
 * 
 * @param conditionKey - Nombre de la propiedad que controla la condición
 * @param options - Opciones de configuración (placeholder, loader)
 * 
 * @example
 * ```typescript
 * // Ejemplo básico
 * @state() private showModal = false;
 * 
 * @conditional('showModal')
 * private get modal() {
 *   return html`<md-dialog open>...</md-dialog>`;
 * }
 * 
 * // Con placeholder
 * @conditional('showContent', { placeholder: html`<p>Contenido oculto</p>` })
 * private get content() {
 *   return html`<div>Contenido visible</div>`;
 * }
 * 
 * // Con lazy loading
 * @conditional('showHeavyComponent', {
 *   placeholder: html`<div>Cargando componente...</div>`,
 *   loader: () => import('./heavy-component').then(m => m.render())
 * })
 * private get heavyComponent() {
 *   return html``; // El loader reemplaza este contenido
 * }
 * ```
 */
export function conditional(conditionKey: string, options?: TemplateResult | ConditionalOptions) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.get!;
    let controller: ConditionalController;

    // Backward compatibility: si options es un TemplateResult, convertirlo
    const normalizedOptions: ConditionalOptions = 
      options && typeof options === 'object' && 'strings' in options
        ? { placeholder: options as TemplateResult }
        : (options as ConditionalOptions) || {};

    descriptor.get = function (this: ReactiveControllerHost & Record<string, any>) {
      if (!controller) {
        controller = new ConditionalController(this, conditionKey, normalizedOptions);
      }

      return controller.render(() => originalMethod.call(this));
    };

    return descriptor;
  };
}