import { LitElement } from 'lit';
import { unsafeCSS } from '@lit/reactive-element/css-tag.js';
import { SignalWatcher, type Signal } from '@lit-labs/signals';
import type { CSSResultGroup } from '@lit/reactive-element/css-tag.js';
import { EventBus } from './event-bus.js';

/**
 * Tipo de almacenamiento para canales
 */
export type StorageType = 'memory' | 'session' | 'local';

/**
 * Clase base para todos los elementos/componentes de LithiumJS
 * Componentes reutilizables sin estado global ni control de páginas
 */
export abstract class LithiumElement extends SignalWatcher(LitElement) {
  /**
   * Emite un evento personalizado hacia arriba en el árbol de componentes
   * Similar a $emit en Vue o eventos en Angular
   * 
   * @param eventName - Nombre del evento a emitir
   * @param detail - Datos que se enviarán con el evento
   * @param options - Opciones adicionales del evento (bubbles, composed, etc)
   * 
   * @example
   * ```typescript
   * // Emitir un evento simple
   * this.output('button-clicked');
   * 
   * // Emitir un evento con datos
   * this.output('user-selected', { id: 123, name: 'John' });
   * 
   * // Emitir un evento que no burbujea
   * this.output('internal-change', data, { bubbles: false });
   * ```
   */
  protected output<T = any>(
    eventName: string, 
    detail?: T,
    options?: Partial<Omit<CustomEventInit<T>, 'detail'>>
  ): void {
    const event = new CustomEvent(eventName, {
      detail,
      bubbles: true,
      composed: true,
      ...options
    });
    this.dispatchEvent(event);
  }

  /**
   * Navega a otra ruta
   * Emite un evento que lithium-router intercepta para validación
   * 
   * @param path - Ruta a la que navegar (puede ser relativa o absoluta)
   * @param options - Opciones de navegación
   * 
   * @example
   * ```typescript
   * // Navegación simple
   * this.navigate('/dashboard');
   * 
   * // Navegación con reemplazo (no crea entrada en historial)
   * this.navigate('/login', { replace: true });
   * 
   * // Navegación con estado
   * this.navigate('/profile/123', { state: { from: 'home' } });
   * ```
   */
  protected navigate(
    path: string, 
    options?: { replace?: boolean; state?: any }
  ): void {
    const { replace = false, state = {} } = options || {};
    
    // Emitir evento de navegación que lithium-router puede interceptar
    EventBus.emit('lithium:navigate', {
      path,
      replace,
      state,
      currentPath: window.location.pathname
    });
  }

  /**
   * Crea o accede a un canal con Signal
   * El signal es reactivo y automáticamente re-renderiza el componente cuando cambia
   * 
   * @param channelName - Nombre del canal
   * @param options - Configuración del canal (valor inicial, storage, hooks, etc)
   * @returns Signal del canal
   * 
   * @example
   * ```typescript
   * // Crear canal solo en memoria
   * const userSignal = this.channel('user:current', {
   *   initialValue: null
   * });
   * 
   * // Crear canal con sessionStorage y hooks
   * const userSignal = this.channel('user:current', {
   *   initialValue: null,
   *   storage: 'session',
   *   onChange: (user, prev) => console.log('User changed', user),
   *   onInit: (user) => this.loadUserData(user),
   *   onClear: () => this.logout(),
   *   validate: (user) => user?.id > 0,
   *   transform: (user) => normalizeUser(user)
   * });
   * 
   * // Con debounce para forms
   * const searchSignal = this.channel('search:query', {
   *   initialValue: '',
   *   onChange: (query) => this.search(query),
   *   debounce: 500 // onChange se ejecuta 500ms después del último cambio
   * });
   * 
   * // Usar en render (auto-reactivo)
   * render() {
   *   const user = userSignal.get();
   *   return html`<p>User: ${user?.name}</p>`;
   * }
   * ```
   */
  protected channel<T = any>(
    channelName: string,
    options?: {
      initialValue?: T;
      storage?: StorageType;
      storageKey?: string;
      ttl?: number;
      autoCleanup?: boolean;
      // 🔥 Hooks
      onChange?: (newValue: T, oldValue: T) => void;
      onInit?: (value: T) => void;
      onClear?: () => void;
      validate?: (value: T) => boolean;
      transform?: (value: T) => T;
      debounce?: number;
      throttle?: number;
    }
  ): Signal.State<T> {
    return EventBus.channel(channelName, options);
  }

  /**
   * Publica un valor en un canal
   * - Actualiza el signal (reactivo)
   * - Persiste en storage si está configurado
   * - Notifica a todos los suscriptores
   * 
   * @param channelName - Nombre del canal
   * @param data - Datos a publicar
   * 
   * @example
   * ```typescript
   * // Publicar datos de usuario
   * this.publish('user:current', { id: 123, name: 'John' });
   * 
   * // Todos los componentes con channel('user:current') se actualizan automáticamente
   * ```
   */
  protected publish<T = any>(channelName: string, data: T): void {
    EventBus.publish(channelName, data);
  }

  /**
   * Se suscribe a cambios en un canal
   * Útil cuando necesitas ejecutar efectos secundarios
   * 
   * @param channelName - Nombre del canal
   * @param callback - Función que se ejecuta cuando cambia el valor
   * @returns Función para cancelar la suscripción
   * 
   * @example
   * ```typescript
   * connectedCallback() {
   *   super.connectedCallback();
   *   
   *   // Suscribirse a cambios
   *   this._unsubscribe = this.subscribe('user:login', (user) => {
   *     console.log('User logged in:', user);
   *     this.loadUserData(user.id);
   *   });
   * }
   * 
   * disconnectedCallback() {
   *   super.disconnectedCallback();
   *   this._unsubscribe?.(); // Limpiar suscripción
   * }
   * ```
   */
  protected subscribe<T = any>(
    channelName: string,
    callback: (data: T) => void
  ): () => void {
    return EventBus.subscribe(channelName, callback);
  }

  // ==========================================
  // Sistema de Eventos Instantáneos
  // ==========================================

  /**
   * Emite un evento instantáneo sin persistencia (fire-and-forget)
   * El evento no se guarda en memoria, solo notifica a los listeners actuales
   * 
   * @param eventName - Nombre del evento
   * @param data - Datos a emitir
   * 
   * @example
   * ```typescript
   * // Emitir evento de acción completada
   * this.emit('form:submitted', { success: true });
   * 
   * // Emitir evento de notificación
   * this.emit('toast:show', { message: 'Guardado!', type: 'success' });
   * 
   * // Emitir sin datos
   * this.emit('modal:close');
   * ```
   */
  protected emit<T = any>(eventName: string, data?: T): void {
    EventBus.emit(eventName, data);
  }

  /**
   * Escucha un evento instantáneo
   * 
   * @param eventName - Nombre del evento
   * @param listener - Función que se ejecuta cuando se emite el evento
   * @param options - Opciones del listener (validate, transform, debounce, throttle, once)
   * @returns Función para dejar de escuchar
   * 
   * @example
   * ```typescript
   * connectedCallback() {
   *   super.connectedCallback();
   *   
   *   // Escuchar evento simple
   *   this._unlisten = this.on('toast:show', (data) => {
   *     this.showToast(data.message, data.type);
   *   });
   *   
   *   // Con opciones: solo errors, máximo 1 cada segundo
   *   this._unlistenError = this.on('toast:show', (data) => {
   *     this.showErrorToast(data);
   *   }, {
   *     validate: (data) => data.type === 'error',
   *     throttle: 1000
   *   });
   * }
   * 
   * disconnectedCallback() {
   *   super.disconnectedCallback();
   *   this._unlisten?.();
   *   this._unlistenError?.();
   * }
   * ```
   */
  protected on<T = any>(
    eventName: string,
    listener: (data: T) => void,
    options?: {
      validate?: (data: T) => boolean;
      transform?: (data: T) => T;
      debounce?: number;
      throttle?: number;
      once?: boolean;
    }
  ): () => void {
    return EventBus.on(eventName, listener, options);
  }

  /**
   * Escucha un evento instantáneo solo una vez
   * 
   * @param eventName - Nombre del evento
   * @param listener - Función que se ejecuta una sola vez
   * @returns Función para cancelar
   * 
   * @example
   * ```typescript
   * // Escuchar solo la primera vez
   * this.once('user:firstLogin', (user) => {
   *   this.showWelcomeTour();
   * });
   * ```
   */
  protected once<T = any>(
    eventName: string,
    listener: (data: T) => void
  ): () => void {
    return EventBus.once(eventName, listener);
  }
}

/**
 * Opciones para definir un elemento
 */
interface DefineElementOptions {
  /** Nombre del tag HTML (debe contener un guion) */
  tag: string;
  /** Estilos del componente (CSS inline o CSSResult) */
  styles?: (CSSResultGroup | string)[];
}

/**
 * Decorador para definir un elemento personalizado con estilos opcionales
 * Registra automáticamente el elemento en el CustomElementRegistry
 * 
 * @param options - Configuración del elemento (tag y estilos opcionales)
 * 
 * @example
 * ```typescript
 * // Solo con tag
 * @defineElement({ tag: 'my-button' })
 * export class MyButton extends LithiumElement {
 *   render() {
 *     return html`<button><slot></slot></button>`;
 *   }
 * }
 * 
 * // Con tag y estilos
 * import style from './my-button.css?inline';
 * 
 * @defineElement({ 
 *   tag: 'my-button',
 *   styles: [style]
 * })
 * export class MyButton extends LithiumElement {
 *   render() {
 *     return html`<button><slot></slot></button>`;
 *   }
 * }
 * 
 * // Con múltiples estilos
 * import baseStyle from './base.css?inline';
 * import buttonStyle from './button.css?inline';
 * 
 * @defineElement({ 
 *   tag: 'my-button',
 *   styles: [baseStyle, buttonStyle]
 * })
 * export class MyButton extends LithiumElement { ... }
 * 
 * // También soporta el formato legacy (string directo)
 * @defineElement('my-button')
 * export class MyButton extends LithiumElement { ... }
 * ```
 */
export function defineElement(options: DefineElementOptions | string) {
  return function <T extends CustomElementConstructor>(constructor: T) {
    // Soporte para formato legacy: @defineElement('tag-name')
    const config = typeof options === 'string' 
      ? { tag: options, styles: undefined }
      : options;

    const { tag, styles } = config;

    // Guardar el tag name como propiedad estática para el router
    (constructor as any).tagName = tag;

    // Aplicar estilos si fueron proporcionados
    if (styles && styles.length > 0) {
      const cssResults = styles.map(style => 
        typeof style === 'string' ? unsafeCSS(style) : style
      );

      const base = LithiumElement.styles;

      if (!base) {
        (constructor as any).styles = [...cssResults];
      } else {
        (constructor as any).styles = Array.isArray(base) 
        ? [...base, ...cssResults] 
        : [base, ...cssResults];
      }
    }

    // Registrar el elemento personalizado
    if (!customElements.get(tag)) {
      customElements.define(tag, constructor);
    }

    return constructor;
  };
}
