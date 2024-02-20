import { LocaleDetector } from './types'

export const DEFAULT_LOCALE_PERSIST_KEY = '__i18n__';

export class LocalDetect implements LocaleDetector {
  get locale() {
    return this.currentLocale;
  }

  set locale(locale) {
    this.currentLocale = locale;
    this.save(locale);
  }

  private currentLocale: string;

  constructor() {
    this.currentLocale = this.detect();
  }

  private detect() {
    return window.localStorage.getItem(DEFAULT_LOCALE_PERSIST_KEY) ?? navigator.language;
  }

  private save(locale: string) {
    window.localStorage.setItem(DEFAULT_LOCALE_PERSIST_KEY, locale);
  }
}