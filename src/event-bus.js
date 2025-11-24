import { signal } from '@lit-labs/signals';
/**
 * EventBus global con soporte para Signals y SessionStorage
 *
 * Características:
 * - Cada canal es un Signal reactivo
 * - Persistencia automática en sessionStorage/localStorage
 * - Suscripción/publicación desacoplada
 * - Auto-cleanup de suscriptores
 *
 * @example
 * ```typescript
 * // Crear un canal con signal
 * const userSignal = EventBus.channel('user:current', {
 *   initialValue: null,
 *   storage: 'session'
 * });
 *
 * // Leer el valor (reactivo en SignalWatcher components)
 * console.log(userSignal.get());
 *
 * // Publicar (actualiza el signal y notifica suscriptores)
 * EventBus.publish('user:current', { id: 123, name: 'John' });
 *
 * // Suscribirse a cambios
 * const unsub = EventBus.subscribe('user:current', (user) => {
 *   console.log('User changed:', user);
 * });
 * ```
 */
export class EventBus {
    /**
     * Inicializa el EventBus (auto-llamado)
     * Configura listeners para cleanup
     */
    static init() {
        if (this.initialized)
            return;
        // Limpiar canales de memoria al cerrar la página
        window.addEventListener('beforeunload', () => {
            this.channels.forEach((channel, name) => {
                if (channel.storage === 'memory') {
                    this.clear(name);
                }
            });
        });
        this.initialized = true;
    }
    /**
     * Obtiene o crea un canal con su signal
     *
     * @param channelName - Nombre del canal
     * @param config - Configuración del canal
     * @returns Signal del canal
     */
    static channel(channelName, config) {
        this.init();
        // Si el canal ya existe, retornarlo
        if (this.channels.has(channelName)) {
            return this.channels.get(channelName).signal;
        }
        const { initialValue = undefined, storage = 'memory', storageKey = `lithium:${channelName}`, ttl, autoCleanup = false, } = config || {};
        // Intentar recuperar valor del storage
        const storedValue = this.getFromStorage(storageKey, storage);
        const value = storedValue !== undefined ? storedValue : initialValue;
        // Crear signal
        const channelSignal = signal(value);
        // Determinar si el canal ya está inicializado (tiene valor no-undefined/null)
        const isInitialized = value !== undefined && value !== null;
        // Guardar canal
        const channel = {
            signal: channelSignal,
            storage,
            storageKey,
            subscribers: new Set(),
            ttl,
            autoCleanup,
            createdAt: Date.now(),
            config, // 👈 Guardar config para acceder a hooks
            isInitialized, // 👈 Para detectar onInit
        };
        this.channels.set(channelName, channel);
        // Configurar TTL si está definido
        if (ttl) {
            channel.timeoutId = setTimeout(() => {
                this.clear(channelName);
            }, ttl);
        }
        // Ejecutar onInit si el canal ya tiene valor inicial
        if (isInitialized && config?.onInit) {
            try {
                config.onInit(value);
            }
            catch (error) {
                console.error(`Error in onInit for channel "${channelName}":`, error);
            }
        }
        return channelSignal;
    }
    /**
     * Publica un valor en un canal
     * - Valida el valor (si validate está configurado)
     * - Transforma el valor (si transform está configurado)
     * - Actualiza el signal
     * - Persiste en storage si está configurado
     * - Ejecuta hooks (onInit, onChange)
     * - Notifica a todos los suscriptores
     *
     * @param channelName - Nombre del canal
     * @param value - Valor a publicar
     */
    static publish(channelName, value) {
        const channel = this.channels.get(channelName);
        if (!channel) {
            // Si el canal no existe, crearlo automáticamente
            this.channel(channelName, { initialValue: value });
            return;
        }
        const oldValue = channel.signal.get();
        const config = channel.config;
        // 1️⃣ Validar (si existe validate hook)
        if (config?.validate) {
            const isValid = config.validate(value);
            if (!isValid) {
                console.warn(`Validation failed for channel "${channelName}"`, value);
                return; // No actualizar si no es válido
            }
        }
        // 2️⃣ Transformar (si existe transform hook)
        const transformedValue = config?.transform
            ? config.transform(value)
            : value;
        // 3️⃣ Actualizar signal
        channel.signal.set(transformedValue);
        // 4️⃣ Persistir en storage
        if (channel.storage !== 'memory') {
            this.saveToStorage(channel.storageKey, transformedValue, channel.storage);
        }
        else {
            console.log(`[EventBus.publish] Skipping storage (memory mode)`);
        }
        // 5️⃣ Ejecutar onInit si es la primera vez que tiene valor
        if (!channel.isInitialized && transformedValue !== undefined && transformedValue !== null) {
            channel.isInitialized = true;
            if (config?.onInit) {
                try {
                    config.onInit(transformedValue);
                }
                catch (error) {
                    console.error(`Error in onInit for channel "${channelName}":`, error);
                }
            }
        }
        // 6️⃣ Ejecutar onChange con debounce/throttle
        if (config?.onChange) {
            this.executeOnChange(channelName, channel, transformedValue, oldValue);
        }
        // 7️⃣ Notificar suscriptores
        channel.subscribers.forEach(callback => {
            try {
                callback(transformedValue);
            }
            catch (error) {
                console.error(`Error in subscriber for channel "${channelName}":`, error);
            }
        });
    }
    /**
     * Ejecuta onChange con soporte para debounce/throttle
     */
    static executeOnChange(channelName, channel, newValue, oldValue) {
        const config = channel.config;
        if (!config?.onChange)
            return;
        const executeCallback = () => {
            try {
                config.onChange(newValue, oldValue);
            }
            catch (error) {
                console.error(`Error in onChange for channel "${channelName}":`, error);
            }
        };
        // Debounce: espera X ms después del último cambio
        if (config.debounce) {
            if (channel.onChangeDebounceTimer) {
                clearTimeout(channel.onChangeDebounceTimer);
            }
            channel.onChangeDebounceTimer = setTimeout(executeCallback, config.debounce);
            return;
        }
        // Throttle: ejecuta máximo cada X ms
        if (config.throttle) {
            const now = Date.now();
            const lastCall = channel.onChangeLastCall || 0;
            const timeSinceLastCall = now - lastCall;
            if (timeSinceLastCall >= config.throttle) {
                channel.onChangeLastCall = now;
                executeCallback();
            }
            return;
        }
        // Sin debounce ni throttle: ejecutar inmediatamente
        executeCallback();
    }
    /**
     * Se suscribe a un canal
     *
     * @param channelName - Nombre del canal
     * @param callback - Función que se ejecuta cuando cambia el valor
     * @returns Función para cancelar la suscripción
     */
    static subscribe(channelName, callback) {
        // Asegurar que el canal existe
        if (!this.channels.has(channelName)) {
            this.channel(channelName);
        }
        const channel = this.channels.get(channelName);
        channel.subscribers.add(callback);
        // Retornar función de limpieza
        return () => {
            channel.subscribers.delete(callback);
            // Auto-cleanup si está configurado y no hay suscriptores
            if (channel.autoCleanup && channel.subscribers.size === 0) {
                this.clear(channelName);
            }
        };
    }
    /**
     * Obtiene el signal de un canal (para uso reactivo)
     *
     * @param channelName - Nombre del canal
     * @returns Signal del canal o undefined si no existe
     */
    static getSignal(channelName) {
        return this.channels.get(channelName)?.signal;
    }
    /**
     * Obtiene el valor actual de un canal (no reactivo)
     *
     * @param channelName - Nombre del canal
     * @returns Valor actual o undefined si no existe
     */
    static getValue(channelName) {
        return this.channels.get(channelName)?.signal.get();
    }
    /**
     * Limpia un canal (elimina signal, storage y suscriptores)
     *
     * @param channelName - Nombre del canal
     */
    static clear(channelName) {
        const channel = this.channels.get(channelName);
        if (!channel)
            return;
        // 1️⃣ Ejecutar onClear hook antes de limpiar
        if (channel.config?.onClear) {
            try {
                channel.config.onClear();
            }
            catch (error) {
                console.error(`Error in onClear for channel "${channelName}":`, error);
            }
        }
        // 2️⃣ Cancelar timeout de TTL si existe
        if (channel.timeoutId) {
            clearTimeout(channel.timeoutId);
        }
        // 3️⃣ Cancelar debounce timer si existe
        if (channel.onChangeDebounceTimer) {
            clearTimeout(channel.onChangeDebounceTimer);
        }
        // 4️⃣ Limpiar storage
        if (channel.storage !== 'memory') {
            this.removeFromStorage(channel.storageKey, channel.storage);
        }
        // 5️⃣ Limpiar suscriptores
        channel.subscribers.clear();
        // 6️⃣ Eliminar canal
        this.channels.delete(channelName);
    }
    /**
     * Limpia todos los canales
     *
     * @param storageOnly - Si es true, solo limpia canales con el tipo de storage especificado
     */
    static clearAll(storageOnly) {
        if (storageOnly) {
            this.channels.forEach((channel, channelName) => {
                if (channel.storage === storageOnly) {
                    this.clear(channelName);
                }
            });
        }
        else {
            this.channels.forEach((_, channelName) => this.clear(channelName));
        }
    }
    /**
     * Obtiene información de un canal
     *
     * @param channelName - Nombre del canal
     * @returns Información del canal o undefined
     */
    static getChannelInfo(channelName) {
        const channel = this.channels.get(channelName);
        if (!channel)
            return undefined;
        return {
            storage: channel.storage,
            storageKey: channel.storageKey,
            subscribersCount: channel.subscribers.size,
            ttl: channel.ttl,
            autoCleanup: channel.autoCleanup,
            createdAt: channel.createdAt,
            age: Date.now() - channel.createdAt,
        };
    }
    /**
     * Lista todos los canales activos
     */
    static listChannels() {
        return Array.from(this.channels.keys());
    }
    // ==========================================
    // Sistema de Eventos Instantáneos (Fire-and-Forget)
    // ==========================================
    /**
     * Emite un evento instantáneo sin persistencia
     * El evento se dispara inmediatamente a todos los listeners y no se guarda en memoria
     *
     * @param eventName - Nombre del evento
     * @param data - Datos a emitir
     *
     * @example
     * ```typescript
     * // Emitir un evento
     * EventBus.emit('user:logout', { reason: 'timeout' });
     *
     * // Los listeners reciben el evento inmediatamente
     * EventBus.on('user:logout', (data) => {
     *   console.log('User logged out:', data);
     * });
     * ```
     */
    static emit(eventName, data) {
        const listeners = this.eventListeners.get(eventName);
        if (!listeners || listeners.size === 0)
            return;
        // Ejecutar todos los listeners inmediatamente
        listeners.forEach(listener => {
            try {
                listener(data);
            }
            catch (error) {
                console.error(`Error in event listener for "${eventName}":`, error);
            }
        });
    }
    /**
     * Escucha eventos instantáneos
     *
     * @param eventName - Nombre del evento
     * @param listener - Función que se ejecuta cuando se emite el evento
     * @param options - Opciones del listener (validate, transform, debounce, throttle, once)
     * @returns Función para dejar de escuchar
     *
     * @example
     * ```typescript
     * // Escuchar un evento simple
     * const unlisten = EventBus.on('user:logout', (data) => {
     *   console.log('User logged out:', data);
     * });
     *
     * // Con opciones
     * EventBus.on('toast:show', (data) => {
     *   console.log(data);
     * }, {
     *   validate: (data) => data.type === 'error', // Solo errors
     *   debounce: 500 // Máximo 1 cada 500ms
     * });
     * ```
     */
    static on(eventName, listener, options) {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, new Set());
        }
        // Crear wrapper del listener con opciones
        let debounceTimer;
        let lastCallTime = 0;
        let hasExecuted = false;
        const wrappedListener = (data) => {
            // Si ya ejecutó y es once, no hacer nada
            if (options?.once && hasExecuted)
                return;
            // Validate: filtrar eventos
            if (options?.validate && !options.validate(data))
                return;
            // Transform: transformar data
            const transformedData = options?.transform ? options.transform(data) : data;
            const executeListener = () => {
                try {
                    listener(transformedData);
                    hasExecuted = true;
                    // Auto-unlisten si once está activo
                    if (options?.once) {
                        unlisten();
                    }
                }
                catch (error) {
                    console.error(`Error in event listener for "${eventName}":`, error);
                }
            };
            // Debounce: esperar X ms después del último evento
            if (options?.debounce) {
                if (debounceTimer)
                    clearTimeout(debounceTimer);
                debounceTimer = setTimeout(executeListener, options.debounce);
                return;
            }
            // Throttle: ejecutar máximo cada X ms
            if (options?.throttle) {
                const now = Date.now();
                const timeSinceLastCall = now - lastCallTime;
                if (timeSinceLastCall >= options.throttle) {
                    lastCallTime = now;
                    executeListener();
                }
                return;
            }
            // Sin debounce ni throttle
            executeListener();
        };
        const listeners = this.eventListeners.get(eventName);
        listeners.add(wrappedListener);
        // Retornar función para dejar de escuchar
        const unlisten = () => {
            if (debounceTimer)
                clearTimeout(debounceTimer);
            listeners.delete(wrappedListener);
            // Limpiar el Set si no hay listeners
            if (listeners.size === 0) {
                this.eventListeners.delete(eventName);
            }
        };
        return unlisten;
    }
    /**
     * Escucha un evento instantáneo solo una vez
     * Después de ejecutarse, se elimina automáticamente
     * Es un alias de on() con { once: true }
     *
     * @param eventName - Nombre del evento
     * @param listener - Función que se ejecuta una sola vez
     * @returns Función para cancelar el listener
     */
    static once(eventName, listener) {
        return this.on(eventName, listener, { once: true });
    }
    /**
     * Elimina todos los listeners de un evento instantáneo
     *
     * @param eventName - Nombre del evento
     */
    static off(eventName) {
        this.eventListeners.delete(eventName);
    }
    // ==========================================
    // Métodos internos de Storage
    // ==========================================
    static getFromStorage(key, storage) {
        if (storage === 'memory')
            return undefined;
        try {
            const store = storage === 'session' ? sessionStorage : localStorage;
            const raw = store.getItem(key);
            return raw ? JSON.parse(raw) : undefined;
        }
        catch (error) {
            console.error(`Error reading from ${storage}Storage:`, error);
            return undefined;
        }
    }
    static saveToStorage(key, value, storage) {
        if (storage === 'memory')
            return;
        try {
            const store = storage === 'session' ? sessionStorage : localStorage;
            store.setItem(key, JSON.stringify(value));
            // Verificar que se guardó
            const saved = store.getItem(key);
        }
        catch (error) {
            console.error(`Error writing to ${storage}Storage:`, error);
        }
    }
    static removeFromStorage(key, storage) {
        if (storage === 'memory')
            return;
        try {
            const store = storage === 'session' ? sessionStorage : localStorage;
            store.removeItem(key);
        }
        catch (error) {
            console.error(`Error removing from ${storage}Storage:`, error);
        }
    }
}
EventBus.channels = new Map();
EventBus.initialized = false;
// Sistema de eventos instantáneos (fire-and-forget)
EventBus.eventListeners = new Map();
