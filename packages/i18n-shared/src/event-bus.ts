/* eslint-disable @typescript-eslint/no-var-requires */
const EventEmitter = require('node:events');

/**
 * 创建事件总线
 * @returns
 */
export function createEventBus() {
  return new EventEmitter();
}
