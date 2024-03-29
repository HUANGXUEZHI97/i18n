/* eslint-disable consistent-return */
import { PromiseQueue } from './promise'
import { hasProp, addHiddenProp } from './object'

import { asyncModuleLoader, httpLoader } from './loader';
import { I18nAsyncBundle, I18nBundle } from './types';
import { LayerLink } from './layer';

/**
 * 语言包缓存
 */
const LOADED = Symbol('loaded');
const LOADED_URLS = new Set();
const LAYER = Symbol('layer');
const DEFAULT_LAYER = 10;

function isLoaded(bundle: I18nBundle) {
  if (typeof bundle === 'string') {
    return LOADED_URLS.has(bundle);
  }

  return hasProp(bundle, LOADED);
}

function setLoaded(bundle: I18nBundle) {
  if (typeof bundle === 'string') {
    LOADED_URLS.add(bundle);
  } else {
    addHiddenProp(bundle, LOADED, 1);
  }
}

/**
 * 语言包注册器
 */
export class BundleRegister {
  private executing = false;

  private resources: { [locale: string]: Set<I18nBundle> } = {};

  private layerLinks: { [locale: string]: LayerLink } = {};

  /**
   * 缓存资源的层级
   */
  private resourceLayer: Map<I18nBundle, number> = new Map();

  private pendingQueue = new PromiseQueue<void>();

  constructor(
    private registerBundle: (locale: string, bundle: Record<string, any>) => void,
    private getLocaleChain: () => string[],
    private onBundleChange: () => void
  ) { }

  /**
   * 判断是否存在正在加载中的语言包
   */
  hasPendingBundle() {
    if (this.executing) {
      return true;
    }

    return this.hasUnloadedBundle();
  }

  /**
   * 调度语言包加载和合并
   */
  async schedulerMerge(): Promise<void> {
    // 正在合并
    if (this.executing) {
      return await this.pendingQueue.push();
    }

    let queue = this.pendingQueue;

    try {
      this.executing = true;

      // 等待更多 bundle 插入，批量执行
      await Promise.resolve();

      // 下一批执行
      this.pendingQueue = new PromiseQueue();

      // 加载当前语言
      const localeChain = this.getLocaleChain();

      let messages: { [locale: string]: Record<string, any>[] } = {};
      let task: Promise<void>[] = [];

      for (const locale of localeChain) {
        const resource = this.resources[locale.toLowerCase()];

        if (resource == null) {
          continue;
        }

        for (const bundle of resource.values()) {
          if (isLoaded(bundle)) {
            continue;
          }

          const layer = this.resourceLayer.get(bundle) ?? DEFAULT_LAYER;

          if (typeof bundle === 'function') {
            // 异步加载函数
            task.push(
              (async () => {
                const loadedBundle = await asyncModuleLoader(bundle as I18nAsyncBundle);
                if (loadedBundle) {
                  this.setLayer(loadedBundle, layer);
                  console.debug(`[i18n] bundle loaded: `, bundle);
                  (messages[locale] ??= []).push(loadedBundle);
                }
              })()
            );
          } else if (typeof bundle === 'string') {
            // http 链接
            task.push(
              (async () => {
                const loadedBundle = await httpLoader(bundle);

                if (loadedBundle) {
                  this.setLayer(loadedBundle, layer);
                  console.debug(`[i18n] bundle loaded: `, bundle);
                  (messages[locale] ??= []).push(loadedBundle);
                }
              })()
            );
          } else {
            // 直接就是语言包
            this.setLayer(bundle, layer); // 设置优先级
            (messages[locale] ??= []).push(bundle); // 按语言区分各自语言包（新合并来的）
          }

          setLoaded(bundle);
        }
      }

      if (task.length) {
        try {
          await Promise.all(task);
        } catch (err) {
          console.warn(`[i18n] 加载语言包失败:`, err);
        }
      }

      const messageKeys = Object.keys(messages);

      if (messageKeys.length) {
        const messageToUpdate: { [locale: string]: LayerLink } = {};
        // 合并
        for (const locale of messageKeys) {
          const layerLink = (this.layerLinks[locale] ??= new LayerLink());

          for (const bundle of messages[locale]) {
            const layer = this.getLayer(bundle);

            layerLink.assignLayer(layer, bundle);
          }

          messageToUpdate[locale] = layerLink;
        }

        Promise.resolve().then(() => {
          // 为什么放在下一 tick? 这是为了 判断 hasPendingBundle 更加精确
          // 触发更新
          for (const locale in messageToUpdate) {
            this.registerBundle(locale, messageToUpdate[locale].flattenLayer());
          }

          this.onBundleChange();
        });
      }
    } catch (err) {
      console.error(`[i18n] 语言包加载失败`, err);
    } finally {
      this.executing = false;
      queue.flushResolve();

      // 判断是否有新的 bundle 加进来，需要继续调度加载
      if (this.hasUnloadedBundle()) {
        // 继续调度
        this.schedulerMerge();
      } else {
        // 没有了，清空队列不需要继续等待了
        this.pendingQueue.flushResolve();
      }
    }
  }

  /**
   * 注册语言包
   */
  registerBundles = async (bundles: { [locale: string]: I18nBundle }, layer: number = 10): Promise<void> => {
    let dirty = false;
    Object.keys(bundles).forEach(k => {
      const normalizedKey = k.toLowerCase();
      const list = (this.resources[normalizedKey] ??= new Set());
      const bundle = bundles[k];

      const add = (b: I18nBundle) => {
        if (!list.has(b)) {
          list.add(b); // 记录当前文件（某个语言的某模块*.tr文件）
          this.resourceLayer.set(b, layer); // 设置当前引入文件（某个语言的某模块*.tr文件）优先级
          dirty = true;
        }
      };

      if (Array.isArray(bundle)) {
        for (const child of bundle) {
          add(child);
        }
      } else {
        add(bundle);
      }
    });

    // 如果有新注册的语言包，则新旧合并
    if (dirty) {
      return await this.schedulerMerge();
    }
  };

  /**
   * 判断是否有未加载的语言包
   */
  private hasUnloadedBundle() {
    const localeChain = this.getLocaleChain();
    for (const locale of localeChain) {
      const resource = this.resources[locale.toLowerCase()];

      if (resource == null) {
        continue;
      }

      for (const bundle of resource.values()) {
        if (!isLoaded(bundle)) {
          return true;
        }
      }
    }

    return false;
  }

  private getLayer(value: any): number {
    return value?.[LAYER] ?? DEFAULT_LAYER;
  }

  private setLayer(value: object, layer: number) {
    Object.defineProperty(value, LAYER, {
      value: layer,
      enumerable: false,
    });
  }
}
