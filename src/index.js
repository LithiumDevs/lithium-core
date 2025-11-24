import { html } from 'lit';
import { unsafeCSS } from '@lit/reactive-element/css-tag.js';
import { property } from 'lit/decorators.js';
export { html, unsafeCSS, property };
export { LithiumElement, defineElement } from './lithium-element.js';
export { definePage } from './lithium-page.js';
export { LithiumModule, defineModule } from './lithium-module.js';
export { LithiumApp, defineApp } from './lithium-app.js';
export { EventBus } from './event-bus.js';
// Decoradores de carga diferida
export { defer } from './decorators/defer.js';
export { lazy } from './decorators/lazy.js';
export { delay } from './decorators/delay.js';
export { conditional } from './decorators/conditional.js';
// Router wrapper con beforeRoute callback (auto-registra el componente)
export { LithiumRouter } from './lithium-router.js';
import './lithium-router.js'; // ← Esto registra el componente automáticamente
