import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { LithiumElement } from './lithium-element.js';
import { defineElement } from './lithium-element.js';
import { EventBus } from './event-bus.js';

/**
 * Resultado del callback beforeRoute
 */
export interface BeforeRouteResult {
  /** Si permite continuar con la navegación */
  continue: boolean;
  /** Ruta a la que redirigir si continue es false */
  redirect?: string;
}

/**
 * Callback que se ejecuta antes de cada navegación
 * Puede retornar:
 * - boolean: true para permitir, false para bloquear
 * - BeforeRouteResult: objeto con continue y redirect
 */
export type BeforeRouteCallback = (
  path: string
) => boolean | BeforeRouteResult | Promise<boolean | BeforeRouteResult>;

/**
 * Componente LithiumRouter
 * Wrapper simple que ejecuta un callback antes de cada navegación
 * 
 * @example
 * ```typescript
 * <lithium-router .beforeRoute=${this.myGuard}>
 *   ${this._router.outlet()}
 * </lithium-router>
 * ```
 */
@defineElement({
  tag: 'lithium-router',
  styles: []
})
export class LithiumRouter extends LithiumElement {
  
  static get properties() {
    return {
      beforeRoute: { attribute: false }
    };
  }

  beforeRoute?: BeforeRouteCallback;

  private currentPath: string = '';
  private observer?: MutationObserver;
  private unsubscribeNavigate?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this.currentPath = window.location.pathname;
    this.setupUrlMonitoring();
    
    // Escuchar evento de navegación
    this.unsubscribeNavigate = EventBus.on('lithium:navigate', (data: any) => {
      this.handleNavigate(data);
    });
    
    // Validar la ruta inicial (cuando entras directamente por URL)
    this.checkInitialRoute();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.observer?.disconnect();
    this.unsubscribeNavigate?.();
  }

  /**
   * Maneja el evento de navegación emitido por navigate()
   */
  private async handleNavigate(data: {
    path: string;
    replace: boolean;
    state: any;
    currentPath: string;
  }) {
    const { path, replace, state } = data;
    
    // Normalizar la ruta
    const targetPath = path.startsWith('http') 
      ? new URL(path).pathname
      : path;
    
    if (this.beforeRoute) {
      try {
        const result = await this.beforeRoute(targetPath);
        const { canAccess, redirectTo } = this.parseResult(result);
        
        if (!canAccess) {
          // No permitido, redirigir si es necesario
          if (redirectTo) {
            this.performNavigation(redirectTo, replace, state);
          }
          // Si no hay redirect, simplemente no navega
          return;
        }
        
        // Permitido, proceder con la navegación
        this.performNavigation(targetPath, replace, state);
      } catch (error) {
        console.error('❌ Error in beforeRoute:', error);
        // En caso de error, no navegar
      }
    } else {
      // Sin beforeRoute, navegar directamente
      this.performNavigation(targetPath, replace, state);
    }
  }

  /**
   * Ejecuta la navegación efectiva
   */
  private performNavigation(path: string, replace: boolean, state: any) {
    const url = path.startsWith('http') 
      ? path 
      : new URL(path, window.location.origin).href;
    
    if (replace) {
      window.history.replaceState(state, '', url);
    } else {
      window.history.pushState(state, '', url);
    }
    
    // Actualizar ruta actual
    this.currentPath = new URL(url).pathname;
    
    // Disparar evento popstate para que el router lo capture
    window.dispatchEvent(new PopStateEvent('popstate', { state }));
  }

  /**
   * Valida la ruta inicial al cargar la página
   */
  private async checkInitialRoute() {
    const initialPath = window.location.pathname;
    
    if (this.beforeRoute && initialPath !== '/') {
      
      try {
        const result = await this.beforeRoute(initialPath);
        const { canAccess, redirectTo } = this.parseResult(result);
    
        if (!canAccess) {
          const target = redirectTo || '/';
          
          // NO actualizar currentPath todavía, esperar a que se complete la redirección
          window.location.href = target; // Usar location.href para forzar recarga
        } else {
          this.currentPath = initialPath;
        }
      } catch (error) {
        console.error('❌ Error in beforeRoute (initial):', error);
        window.location.href = '/';
      }
    } else {
      this.currentPath = initialPath;
    }
  }

  /**
   * Monitorea cambios de URL
   */
  private setupUrlMonitoring() {
    // Observar cambios en el DOM (cuando el router renderiza)
    this.observer = new MutationObserver(() => {
      this.checkUrlChange();
    });

    this.observer.observe(this, {
      childList: true,
      subtree: true
    });

    // También escuchar popstate (botón back/forward)
    window.addEventListener('popstate', () => this.checkUrlChange());
  }

  /**
   * Verifica si la URL cambió y ejecuta beforeRoute
   */
  private async checkUrlChange() {
    const newPath = window.location.pathname;
    
    if (newPath !== this.currentPath) {
      
      if (this.beforeRoute) {
        
        try {
          const result = await this.beforeRoute(newPath);
          const { canAccess, redirectTo } = this.parseResult(result);
          
          if (!canAccess) {
            const target = redirectTo || this.currentPath;
            
            // Forzar navegación a la ruta de redirección
            window.location.href = target;
            return;
          }
          
          this.currentPath = newPath;
        } catch (error) {
          console.error('❌ Error in beforeRoute:', error);
          // En caso de error, revertir
          window.history.pushState({}, '', this.currentPath);
          window.dispatchEvent(new PopStateEvent('popstate'));
          return;
        }
      } else {
        // Sin beforeRoute, actualizar directamente
        this.currentPath = newPath;
      }
    }
  }

  /**
   * Parsea el resultado de beforeRoute (puede ser boolean o objeto)
   */
  private parseResult(result: boolean | BeforeRouteResult): { canAccess: boolean; redirectTo?: string } {
    if (typeof result === 'boolean') {
      return { canAccess: result };
    }
    
    return {
      canAccess: result.continue,
      redirectTo: result.redirect
    };
  }

  render() {
    return html`<slot></slot>`;
  }
}
