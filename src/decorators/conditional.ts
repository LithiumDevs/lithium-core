import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { html } from 'lit';
import type { TemplateResult } from 'lit';

/**
 * Controller para renderizado condicional
 * Renderiza contenido solo cuando una condición es verdadera
 */
export class ConditionalController implements ReactiveController {
  private host: ReactiveControllerHost & Record<string, any>;
  private conditionKey: string;
  private placeholder?: TemplateResult;

  constructor(
    host: ReactiveControllerHost & Record<string, any>,
    conditionKey: string,
    placeholder?: TemplateResult
  ) {
    this.host = host;
    this.conditionKey = conditionKey;
    this.placeholder = placeholder;
    host.addController(this);
  }

  hostConnected() {
    // No necesita inicialización especial
  }

  render(content: () => TemplateResult): TemplateResult {
    const condition = this.host[this.conditionKey];
    
    if (condition) {
      return content();
    }
    
    return this.placeholder || html``;
  }
}

/**
 * Decorador @conditional
 * Renderiza el método solo cuando la propiedad especificada es true
 * 
 * @param conditionKey - Nombre de la propiedad que controla la condición
 * @param placeholder - Template opcional a mostrar cuando la condición es false
 * 
 * @example
 * ```typescript
 * @state() private showModal = false;
 * 
 * @conditional('showModal')
 * private get modal() {
 *   return html`<md-dialog open>...</md-dialog>`;
 * }
 * 
 * private openModal() {
 *   this.showModal = true;
 * }
 * ```
 */
export function conditional(conditionKey: string, placeholder?: TemplateResult) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.get!;
    let controller: ConditionalController;

    descriptor.get = function (this: ReactiveControllerHost & Record<string, any>) {
      if (!controller) {
        controller = new ConditionalController(this, conditionKey, placeholder);
      }

      return controller.render(() => originalMethod.call(this));
    };

    return descriptor;
  };
}