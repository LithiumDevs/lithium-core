var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { LithiumElement } from './lithium-element.js';
import { defineElement } from './lithium-element.js';
import { EventBus } from './event-bus.js';
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
let LithiumRouter = class LithiumRouter extends LithiumElement {
    constructor() {
        super(...arguments);
        this.currentPath = '';
    }
    connectedCallback() {
        super.connectedCallback();
        this.currentPath = window.location.pathname;
        this.setupUrlMonitoring();
        // Escuchar evento de navegación
        this.unsubscribeNavigate = EventBus.on('lithium:navigate', (data) => {
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
    async handleNavigate(data) {
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
            }
            catch (error) {
                console.error('❌ Error in beforeRoute:', error);
                // En caso de error, no navegar
            }
        }
        else {
            // Sin beforeRoute, navegar directamente
            this.performNavigation(targetPath, replace, state);
        }
    }
    /**
     * Ejecuta la navegación efectiva
     */
    performNavigation(path, replace, state) {
        const url = path.startsWith('http')
            ? path
            : new URL(path, window.location.origin).href;
        if (replace) {
            window.history.replaceState(state, '', url);
        }
        else {
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
    async checkInitialRoute() {
        const initialPath = window.location.pathname;
        if (this.beforeRoute && initialPath !== '/') {
            try {
                const result = await this.beforeRoute(initialPath);
                const { canAccess, redirectTo } = this.parseResult(result);
                if (!canAccess) {
                    const target = redirectTo || '/';
                    // NO actualizar currentPath todavía, esperar a que se complete la redirección
                    window.location.href = target; // Usar location.href para forzar recarga
                }
                else {
                    this.currentPath = initialPath;
                }
            }
            catch (error) {
                console.error('❌ Error in beforeRoute (initial):', error);
                window.location.href = '/';
            }
        }
        else {
            this.currentPath = initialPath;
        }
    }
    /**
     * Monitorea cambios de URL
     */
    setupUrlMonitoring() {
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
    async checkUrlChange() {
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
                }
                catch (error) {
                    console.error('❌ Error in beforeRoute:', error);
                    // En caso de error, revertir
                    window.history.pushState({}, '', this.currentPath);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                    return;
                }
            }
            else {
                // Sin beforeRoute, actualizar directamente
                this.currentPath = newPath;
            }
        }
    }
    /**
     * Parsea el resultado de beforeRoute (puede ser boolean o objeto)
     */
    parseResult(result) {
        if (typeof result === 'boolean') {
            return { canAccess: result };
        }
        return {
            canAccess: result.continue,
            redirectTo: result.redirect
        };
    }
    render() {
        return html `<slot></slot>`;
    }
};
__decorate([
    property({ attribute: false })
], LithiumRouter.prototype, "beforeRoute", void 0);
LithiumRouter = __decorate([
    defineElement({
        tag: 'lithium-router',
        styles: []
    })
], LithiumRouter);
export { LithiumRouter };
