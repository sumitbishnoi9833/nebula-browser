import './styles/main.css';
import { TabManager } from './components/TabManager';
import { ParticleBackground } from './components/ParticleBackground';
import { AIAssistant } from './components/AIAssistant';
import { CommandPalette } from './components/CommandPalette';
import { Settings } from './utils/Settings';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

class NebulaBrowser {
  private tabs: TabManager;
  private particles: ParticleBackground;
  private ai: AIAssistant;
  private cmdPalette: CommandPalette;
  private settings: any;
  private currentTabId: string | null = null;

  async init() {
    this.settings = await Settings.load();
    this.particles = new ParticleBackground('bg-canvas');
    this.tabs = new TabManager('tab-strip', 'webview-container', this.settings);
    this.ai = new AIAssistant(this.settings);
    this.cmdPalette = new CommandPalette(this);

    await this.tabs.init();
    this.setupGlobalShortcuts();
    this.setupWindowControls();
    this.setupToolbar();
    this.setupAI();
    this.setupCommandPalette();

    this.tabs.onTabSwitch = (id) => this.onTabSwitch(id);
    this.tabs.onTabClose = (id) => this.onTabClose(id);

    document.getElementById('new-tab-btn')!.addEventListener('click', () => this.tabs.createTab());
    document.getElementById('url-input')!.addEventListener('keydown', (e) => this.handleUrlKeydown(e));
    document.getElementById('back-btn')!.addEventListener('click', () => this.tabs.goBack());
    document.getElementById('forward-btn')!.addEventListener('click', () => this.tabs.goForward());
    document.getElementById('reload-btn')!.addEventListener('click', () => this.tabs.reload());
    document.getElementById('home-btn')!.addEventListener('click', () => this.tabs.goHome());

    this.particles.start();
    document.body.style.opacity = '1';
  }

  private setupGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 't') { e.preventDefault(); this.tabs.createTab(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') { e.preventDefault(); this.tabs.closeCurrentTab(); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') { e.preventDefault(); this.tabs.reopenClosedTab(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') { e.preventDefault(); this.focusUrlBar(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); this.ai.toggle(); }
      if (e.key === 'Escape') { this.ai.hide(); this.cmdPalette.hide(); this.tabs.blurWebview(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); this.cmdPalette.show(); }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); this.cmdPalette.show('settings'); }
      if (e.altKey && e.key === 'ArrowLeft') { this.tabs.goBack(); }
      if (e.altKey && e.key === 'ArrowRight') { this.tabs.goForward(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') { e.preventDefault(); this.tabs.reload(); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') { e.preventDefault(); this.tabs.reload(true); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); this.cmdPalette.show('bookmarks'); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') { e.preventDefault(); this.cmdPalette.show('history'); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') { e.preventDefault(); this.cmdPalette.show('downloads'); }
    });
  }

  private setupWindowControls() {
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-action');
        if (action === 'minimize') await invoke('window_minimize');
        if (action === 'maximize') await invoke('window_maximize');
        if (action === 'close') await invoke('window_close');
      });
    });

    listen('tauri://resize', () => this.particles.resize());
  }

  private setupToolbar() {
    document.getElementById('bookmark-btn')!.addEventListener('click', () => this.tabs.toggleBookmark());
    document.getElementById('extensions-btn')!.addEventListener('click', () => this.cmdPalette.show('extensions'));
    document.getElementById('settings-btn')!.addEventListener('click', () => this.cmdPalette.show('settings'));
  }

  private setupAI() {
    document.getElementById('ai-toggle')!.addEventListener('click', () => this.ai.toggle());
    document.getElementById('ai-close')!.addEventListener('click', () => this.ai.hide());
    document.getElementById('ai-send')!.addEventListener('click', () => this.ai.sendMessage());
    document.getElementById('ai-input')!.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.ai.sendMessage(); }
    });
    document.getElementById('ai-btn')!.addEventListener('click', () => this.ai.toggle());
  }

  private setupCommandPalette() {
    document.getElementById('cmd-input')!.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.cmdPalette.hide();
    });
  }

  private focusUrlBar() {
    const input = document.getElementById('url-input') as HTMLInputElement;
    input.focus();
    input.select();
  }

  private handleUrlKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      const url = (e.target as HTMLInputElement).value.trim();
      if (url) this.tabs.navigate(url);
    }
  }

  private onTabSwitch(id: string) {
    this.currentTabId = id;
    this.updateUrlBar();
  }

  private onTabClose(id: string) {
    if (this.tabs.getTabCount() === 0) {
      this.tabs.createTab();
    }
  }

  private updateUrlBar() {
    const tab = this.tabs.getCurrentTab();
    const input = document.getElementById('url-input') as HTMLInputElement;
    if (tab && input !== document.activeElement) {
      input.value = tab.url.startsWith('nebula://') ? '' : tab.url;
    }
    this.updateNavButtons();
  }

  private updateNavButtons() {
    const tab = this.tabs.getCurrentTab();
    (document.getElementById('back-btn') as HTMLButtonElement).disabled = !tab?.canGoBack;
    (document.getElementById('forward-btn') as HTMLButtonElement).disabled = !tab?.canGoForward;
  }
}

const browser = new NebulaBrowser();
browser.init().catch(console.error);
