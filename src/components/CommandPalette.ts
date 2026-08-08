import { invoke } from '@tauri-apps/api/core';

interface Command {
  id: string;
  label: string;
  description: string;
  shortcut?: string;
  action: () => void | Promise<void>;
  category: string;
}

export class CommandPalette {
  private palette: HTMLElement;
  private input: HTMLInputElement;
  private results: HTMLElement;
  private browser: any;
  private commands: Command[] = [];
  private filtered: Command[] = [];
  private selectedIndex = 0;
  private visible = false;

  constructor(browser: any) {
    this.browser = browser;
    this.palette = document.getElementById('command-palette')!;
    this.input = document.getElementById('cmd-input') as HTMLInputElement;
    this.results = document.getElementById('cmd-results')!;
    this.registerCommands();
    this.setupInput();
  }

  private registerCommands() {
    this.commands = [
      { id: 'new-tab', label: 'New Tab', description: 'Open a new tab', shortcut: 'Ctrl+T', action: () => this.browser.tabs.createTab(), category: 'Tabs' },
      { id: 'close-tab', label: 'Close Tab', description: 'Close current tab', shortcut: 'Ctrl+W', action: () => this.browser.tabs.closeCurrentTab(), category: 'Tabs' },
      { id: 'reopen-tab', label: 'Reopen Closed Tab', description: 'Restore last closed tab', shortcut: 'Ctrl+Shift+T', action: () => this.browser.tabs.reopenClosedTab(), category: 'Tabs' },
      { id: 'focus-url', label: 'Focus Address Bar', description: 'Focus the URL/input bar', shortcut: 'Ctrl+L', action: () => this.browser.focusUrlBar(), category: 'Navigation' },
      { id: 'back', label: 'Go Back', description: 'Navigate back', shortcut: 'Alt+←', action: () => this.browser.tabs.goBack(), category: 'Navigation' },
      { id: 'forward', label: 'Go Forward', description: 'Navigate forward', shortcut: 'Alt+→', action: () => this.browser.tabs.goForward(), category: 'Navigation' },
      { id: 'reload', label: 'Reload', description: 'Reload current page', shortcut: 'Ctrl+R', action: () => this.browser.tabs.reload(), category: 'Navigation' },
      { id: 'hard-reload', label: 'Hard Reload', description: 'Reload ignoring cache', shortcut: 'Ctrl+Shift+R', action: () => this.browser.tabs.reload(true), category: 'Navigation' },
      { id: 'toggle-ai', label: 'Toggle Nebula AI', description: 'Open/close AI assistant', shortcut: 'Ctrl+K', action: () => this.browser.ai.toggle(), category: 'AI' },
      { id: 'settings', label: 'Settings', description: 'Open settings', shortcut: 'Ctrl+,', action: () => this.showCategory('settings'), category: 'Settings' },
      { id: 'extensions', label: 'Extensions', description: 'Manage extensions', shortcut: '', action: () => this.showCategory('extensions'), category: 'Settings' },
      { id: 'bookmarks', label: 'Bookmarks', description: 'View bookmarks', shortcut: 'Ctrl+B', action: () => this.showCategory('bookmarks'), category: 'Settings' },
      { id: 'history', label: 'History', description: 'View browsing history', shortcut: 'Ctrl+H', action: () => this.showCategory('history'), category: 'Settings' },
      { id: 'downloads', label: 'Downloads', description: 'View downloads', shortcut: 'Ctrl+J', action: () => this.showCategory('downloads'), category: 'Settings' },
      { id: 'devtools', label: 'Developer Tools', description: 'Open devtools for current tab', shortcut: 'F12', action: () => invoke('open_devtools'), category: 'Developer' },
      { id: 'view-source', label: 'View Page Source', description: 'View source of current page', shortcut: 'Ctrl+U', action: () => this.browser.tabs.getCurrentTab()?.webview.eval('window.open("view-source:" + window.location.href)'), category: 'Developer' },
      { id: 'clear-data', label: 'Clear Browsing Data', description: 'Clear cache, cookies, history', shortcut: '', action: () => invoke('clear_browsing_data'), category: 'Privacy' },
      { id: 'fullscreen', label: 'Toggle Fullscreen', description: 'Enter/exit fullscreen', shortcut: 'F11', action: () => invoke('toggle_fullscreen'), category: 'Window' },
      { id: 'minimize', label: 'Minimize Window', description: 'Minimize to taskbar', shortcut: '', action: () => invoke('window_minimize'), category: 'Window' },
    ];
  }

  private setupInput() {
    this.input.addEventListener('input', () => this.filter());
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
  }

  show(category?: string) {
    this.palette.hidden = false;
    this.visible = true;
    this.input.value = category ? category + ' ' : '';
    this.filter();
    this.input.focus();
    this.selectedIndex = 0;
    this.updateSelection();
  }

  hide() {
    this.palette.hidden = true;
    this.visible = false;
    this.input.value = '';
  }

  private filter() {
    const query = this.input.value.toLowerCase().trim();
    if (!query) {
      this.filtered = this.commands;
    } else {
      this.filtered = this.commands.filter(c =>
        c.label.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query) ||
        c.shortcut.toLowerCase().includes(query) ||
        c.category.toLowerCase().includes(query)
      );
    }
    this.selectedIndex = 0;
    this.render();
  }

  private showCategory(category: string) {
    this.hide();
    // Would open specific settings panel
    console.log('Open category:', category);
  }

  private handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); this.selectedIndex = Math.min(this.selectedIndex + 1, this.filtered.length - 1); this.updateSelection(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.selectedIndex = Math.max(this.selectedIndex - 1, 0); this.updateSelection(); }
    else if (e.key === 'Enter') { e.preventDefault(); this.executeSelected(); }
    else if (e.key === 'Escape') { this.hide(); }
  }

  private updateSelection() {
    this.results.querySelectorAll('.cmd-item').forEach((el, i) => {
      el.classList.toggle('selected', i === this.selectedIndex);
    });
    const selected = this.results.querySelector('.cmd-item.selected');
    if (selected) selected.scrollIntoView({ block: 'nearest' });
  }

  private executeSelected() {
    const cmd = this.filtered[this.selectedIndex];
    if (cmd) {
      cmd.action();
      this.hide();
    }
  }

  private render() {
    this.results.innerHTML = '';
    let currentCategory = '';
    for (const cmd of this.filtered) {
      if (cmd.category !== currentCategory) {
        currentCategory = cmd.category;
        const catEl = document.createElement('div');
        catEl.className = 'cmd-category';
        catEl.textContent = currentCategory;
        catEl.style.cssText = 'padding: 8px 20px 4px; font-size: 11px; text-transform: uppercase; color: var(--fg-muted); letter-spacing: 0.5px; font-weight: 600;';
        this.results.appendChild(catEl);
      }
      const el = document.createElement('div');
      el.className = 'cmd-item';
      el.innerHTML = `
        <span class="cmd-label">${this.highlight(cmd.label, this.input.value)}</span>
        <span class="cmd-desc">${this.highlight(cmd.description, this.input.value)}</span>
        ${cmd.shortcut ? `<span class="cmd-kbd kbd">${cmd.shortcut}</span>` : ''}
      `;
      el.addEventListener('click', () => { cmd.action(); this.hide(); });
      this.results.appendChild(el);
    }
    if (this.filtered.length === 0) {
      this.results.innerHTML = '<div class="cmd-item" style="justify-content:center; color:var(--fg-muted);">No commands found</div>';
    }
    this.updateSelection();
  }

  private highlight(text: string, query: string): string {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map(p => p.toLowerCase() === query.toLowerCase() ? `<mark>${p}</mark>` : p).join('');
  }
}
