/* eslint-disable @typescript-eslint/no-extraneous-class */

declare module 'utils' {
  interface EventEmitter {
    addListener(event: string | symbol, listener: (...args: any[]) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this;
    removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
    off(event: string | symbol, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string | symbol): this;
    setMaxListeners(n: number): this;
    getMaxListeners(): number;
    listeners(event: string | symbol): Function[];
    rawListeners(event: string | symbol): Function[];
    emit(event: string | symbol, ...args: any[]): boolean;
    listenerCount(event: string | symbol): number;
    // Added in Node 6...
    prependListener(event: string | symbol, listener: (...args: any[]) => void): this;
    prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;
    eventNames(): (string | symbol)[];
  }
}

export interface EventEmitterOptions {
  /**
   * Enables automatic capturing of promise rejection.
   */
  captureRejections?: boolean;
}

export interface NodeEventTarget {
  once(event: string | symbol, listener: (...args: any[]) => void): this;
}

export interface DOMEventTarget {
  addEventListener(event: string, listener: (...args: any[]) => void, opts?: { once: boolean }): any;
}

export interface StaticEventEmitterOptions {
  signal?: AbortSignal;
}

interface EventEmitter extends Utils.EventEmitter { }

export class EventEmitter {
  constructor(options?: EventEmitterOptions);

  static once(emitter: NodeEventTarget, event: string | symbol, options?: StaticEventEmitterOptions): Promise<any[]>;
  static once(emitter: DOMEventTarget, event: string, options?: StaticEventEmitterOptions): Promise<any[]>;
  static on(
    emitter: Utils.EventEmitter,
    event: string,
    options?: StaticEventEmitterOptions
  ): AsyncIterableIterator<any>;

  /** @deprecated since v4.0.0 */
  static listenerCount(emitter: Utils.EventEmitter, event: string | symbol): number;
  /**
   * Returns a list listener for a specific emitter event name.
   */
  static getEventListener(emitter: DOMEventTarget | Utils.EventEmitter, name: string | symbol): Function[];

  /**
   * This symbol shall be used to install a listener for only monitoring `'error'`
   * events. Listeners installed using this symbol are called before the regular
   * `'error'` listeners are called.
   *
   * Installing a listener using this symbol does not change the behavior once an
   * `'error'` event is emitted, therefore the process will still crash if no
   * regular `'error'` listener is installed.
   */
  static readonly errorMonitor: unique symbol;
  static readonly captureRejectionSymbol: unique symbol;

  /**
   * Sets or gets the default captureRejection value for all emitters.
   */
  // TODO: These should be described using static getter/setter pairs:
  static captureRejections: boolean;
  static defaultMaxListeners: number;
}
