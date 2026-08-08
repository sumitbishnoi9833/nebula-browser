import { WebviewWindow, WebviewWindowOptions } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';

export interface Tab {
  id: string;
  label: string;
  url: string;
  favicon: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
  webview: WebviewWindow | null;
  element: HTMLElement | null;
}

export class TabManager {
  private tabs: Map<string, Tab> = new Map();
  private tabStrip: HTMLElement;
  private container: HTMLElement;
  private settings: any;
  private activeId: string | null = null;
  private tabCounter = 0;
  private closedTabs: Tab[] = [];

  onTabSwitch: (id: string) => void = () => {};
  onTabClose: (id: string) => void = () => {};

  constructor(tabStripId: string, containerId: string, settings: any) {
    this.tabStrip = document.getElementById(tabStripId)!;
    this.container = document.getElementById(containerId)!;
    this.settings = settings;
  }

  async init() {
    await this.createTab(this.settings.homepage || 'https://www.google.com');
  }

  async createTab(url?: string, background = false): Promise<string> {
    const id = uuidv4();
    const label = url ? 'Loading...' : 'New Tab';
    const tabUrl = url || this.settings.newTabPage || 'nebula://newtab';

    const webview = new WebviewWindow(id, {
      url: tabUrl,
      x: 0, y: 0,
      width: this.container.clientWidth,
      height: this.container.clientHeight,
      decorations: false,
      transparent: true,
      resizable: false,
      visible: false,
      focus: true,
      backgroundColor: '#03040c',
      webviewVersion: '120.0.0.0',
    } as WebviewWindowOptions);

    const tab: Tab = { id, label, url: tabUrl, favicon: '', canGoBack: false, canGoForward: false, loading: true, webview, element: null };

    this.tabs.set(id, tab);
    this.createTabElement(tab);
    this.setupWebviewEvents(tab);

    if (!background) this.switchToTab(id);
    return id;
  }

  private createTabElement(tab: Tab) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === this.activeId ? ' active' : '');
    el.dataset.tabId = tab.id;
    el.innerHTML = `
      <img class="favicon" src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌌</text></svg>" alt="">
      <span class="tab-title">${tab.label}</span>
      <button class="tab-close">×</button>
    `;
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('tab-close')) {
        e.stopPropagation();
        this.closeTab(tab.id);
      } else {
        this.switchToTab(tab.id);
      }
    });
    el.addEventListener('dblclick', () => this.renameTab(tab.id));
    this.tabStrip.insertBefore(el, document.getElementById('new-tab-btn'));
    tab.element = el;
  }

  private setupWebviewEvents(tab: Tab) {
    tab.webview!.onPageLoad(({ payload: url }) => {
      tab.loading = false;
      tab.url = url;
      this.updateTab(tab);
    });

    tab.webview!.onNavigation(({ payload }) => {
      tab.loading = true;
      tab.url = payload.url;
      this.updateTab(tab);
    });

    tab.webview!.onTitleChanged(({ payload }) => {
      tab.label = payload.title || 'New Tab';
      this.updateTab(tab);
    });

    tab.webview!.onFaviconChanged(({ payload }) => {
      tab.favicon = payload.favicon || '';
      this.updateTab(tab);
    });

    listen<{ canGoBack: boolean; canGoForward: boolean }>(`webview-nav-state-${tab.id}`, (e) => {
      tab.canGoBack = e.payload.canGoBack;
      tab.canGoForward = e.payload.canGoForward;
      this.updateNavButtons();
    }).then(unlisten => tab.webview!.once('destroyed', unlisten));
  }

  private updateTab(tab: Tab) {
    if (!tab.element) return;
    tab.element.querySelector('.tab-title')!.textContent = tab.label;
    const favicon = tab.element.querySelector('.favicon') as HTMLImageElement;
    if (tab.favicon) favicon.src = tab.favicon;
    tab.element.classList.toggle('active', tab.id === this.activeId);
    if (tab.loading) tab.element.classList.add('loading'); else tab.element.classList.remove('loading');
  }

  switchToTab(id: string) {
    const tab = this.tabs.get(id);
    if (!tab) return;

    if (this.activeId) {
      const oldTab = this.tabs.get(this.activeId);
      if (oldTab) {
        oldTab.element?.classList.remove('active');
        oldTab.webview!.hide();
      }
    }

    this.activeId = id;
    tab.element?.classList.add('active');
    tab.webview!.show();
    tab.webview!.setFocus();
    this.resizeWebview(tab);
    this.onTabSwitch(id);
    this.updateUrlBar();
  }

  private updateUrlBar() {
    const tab = this.tabs.get(this.activeId!);
    const input = document.getElementById('url-input') as HTMLInputElement;
    if (tab && input !== document.activeElement) {
      input.value = tab.url.startsWith('nebula://') ? '' : tab.url;
    }
    this.updateNavButtons();
  }

  private updateNavButtons() {
    const tab = this.tabs.get(this.activeId!);
    (document.getElementById('back-btn') as HTMLButtonElement).disabled = !tab?.canGoBack;
    (document.getElementById('forward-btn') as HTMLButtonElement).disabled = !tab?.canGoForward;
  }

  async closeTab(id: string) {
    const tab = this.tabs.get(id);
    if (!tab) return;

    if (this.tabs.size === 1) {
      await invoke('window_close');
      return;
    }

    const wasActive = id === this.activeId;
    tab.webview!.destroy();
    tab.element?.remove();
    this.closedTabs.push(tab);
    if (this.closedTabs.length > 10) this.closedTabs.shift();
    this.tabs.delete(id);

    if (wasActive) {
      const remaining = Array.from(this.tabs.values());
      this.switchToTab(remaining[remaining.length - 1].id);
    }
    this.onTabClose(id);
  }

  reopenClosedTab() {
    const tab = this.closedTabs.pop();
    if (tab) {
      this.createTab(tab.url).then(id => {
        const newTab = this.tabs.get(id)!;
        newTab.webview!.once('did-finish-load', () => {
          newTab.webview!.eval(`window.history.go(${tab.url})`).catch(() => {});
        });
      });
    }
  }

  getCurrentTab(): Tab | null {
    return this.activeId ? this.tabs.get(this.activeId) || null : null;
  }

  getTabCount(): number { return this.tabs.size; }

  navigate(url: string) {
    const tab = this.getCurrentTab();
    if (tab) tab.webview!.navigate(this.normalizeUrl(url));
  }

  goBack() { this.getCurrentTab()?.webview!.eval('window.history.back()'); }
  goForward() { this.getCurrentTab()?.webview!.eval('window.history.forward()'); }
  reload(force = false) { this.getCurrentTab()?.webview!.reload(force); }
  goHome() { this.getCurrentTab()?.webview!.navigate(this.settings.homepage || 'https://www.google.com'); }

  closeCurrentTab() { if (this.activeId) this.closeTab(this.activeId); }

  toggleBookmark() {
    const tab = this.getCurrentTab();
    if (tab) invoke('save_bookmark', { url: tab.url, title: tab.label });
  }

  blurWebview() { this.getCurrentTab()?.webview!.eval('document.activeElement?.blur()'); }

  private normalizeUrl(input: string): string {
    try { return new URL(input).href; } catch {
      if (input.includes('.') && !input.includes(' ')) return 'https://' + input;
      return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
    }
  }

  private resizeWebview(tab: Tab) {
    tab.webview!.setSize({ width: this.container.clientWidth, height: this.container.clientHeight });
    tab.webview!.setPosition({ x: 0, y: 80 });
  }

  renameTab(id: string) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    const newLabel = prompt('Rename tab:', tab.label);
    if (newLabel) { tab.label = newLabel; this.updateTab(tab); }
  }
}
