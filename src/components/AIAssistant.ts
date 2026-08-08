import { invoke } from '@tauri-apps/api/core';

interface Message { role: 'user' | 'assistant'; content: string; }
interface GeminiResponse { candidates: { content: { parts: { text: string }[] } }[]; }

export class AIAssistant {
  private panel: HTMLElement;
  private messagesEl: HTMLElement;
  private input: HTMLTextAreaElement;
  private sendBtn: HTMLElement;
  private toggleBtn: HTMLElement;
  private closeBtn: HTMLElement;
  private settings: any;
  private messages: Message[] = [];
  private isOpen = false;
  private abortController: AbortController | null = null;

  constructor(settings: any) {
    this.settings = settings;
    this.panel = document.getElementById('ai-panel')!;
    this.messagesEl = document.getElementById('ai-messages')!;
    this.input = document.getElementById('ai-input') as HTMLTextAreaElement;
    this.sendBtn = document.getElementById('ai-send')!;
    this.toggleBtn = document.getElementById('ai-toggle')!;
    this.closeBtn = document.getElementById('ai-close')!;

    this.loadHistory();
    this.setupInputResize();
  }

  private setupInputResize() {
    this.input.addEventListener('input', () => {
      this.input.style.height = 'auto';
      this.input.style.height = Math.min(this.input.scrollHeight, 120) + 'px';
    });
  }

  private async loadHistory() {
    try {
      const history = await invoke<string>('get_ai_history');
      if (history) this.messages = JSON.parse(history);
      this.renderMessages();
    } catch {}
  }

  private async saveHistory() {
    try {
      await invoke('save_ai_history', { history: JSON.stringify(this.messages.slice(-50)) });
    } catch {}
  }

  toggle() { this.isOpen ? this.hide() : this.show(); }
  show() { this.panel.hidden = false; this.isOpen = true; this.input.focus(); }
  hide() { this.panel.hidden = true; this.isOpen = false; }

  async sendMessage() {
    const text = this.input.value.trim();
    if (!text) return;

    this.addMessage('user', text);
    this.input.value = '';
    this.input.style.height = 'auto';
    this.sendBtn.classList.add('sending');

    this.abortController = new AbortController();
    try {
      await this.streamResponse(text);
    } catch (e) {
      if (e.name !== 'AbortError') this.addMessage('assistant', 'Error: Failed to get response');
    } finally {
      this.sendBtn.classList.remove('sending');
    }
  }

  private async streamResponse(userText: string) {
    const apiKey = this.settings.geminiApiKey;
    if (!apiKey) {
      this.addMessage('assistant', 'Please set your Gemini API key in Settings (Ctrl+,)');
      return;
    }

    const systemPrompt = `You are Nebula, an AI assistant integrated into a sci-fi web browser. 
Be concise, helpful, and slightly futuristic in tone. You can help with browsing, coding, questions, and browser commands.
Current page context: ${this.getCurrentPageContext()}`;

    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Understood. I am Nebula, ready to assist.' }] },
      ...this.messages.slice(-10).map(m => ({ role: m.role, parts: [{ text: m.content }] })),
      { role: 'user', parts: [{ text: userText }] }
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } }),
        signal: this.abortController.signal
      }
    );

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let messageEl: HTMLElement | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;
        try {
          const data: GeminiResponse = JSON.parse(line.slice(6));
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            fullText += text;
            if (!messageEl) {
              messageEl = this.addMessage('assistant', '');
            }
            messageEl.querySelector('.content')!.textContent = fullText;
            this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
          }
        } catch {}
      }
    }

    if (fullText) {
      this.messages.push({ role: 'assistant', content: fullText });
      await this.saveHistory();
    }
  }

  private getCurrentPageContext(): string {
    // Would get from active tab in real implementation
    return 'Unknown';
  }

  private addMessage(role: 'user' | 'assistant', content: string): HTMLElement {
    const msg = document.createElement('div');
    msg.className = `ai-message ${role}`;
    msg.innerHTML = `
      <div class="avatar">${role === 'user' ? '👤' : '◆'}</div>
      <div class="content">${this.escapeHtml(content)}</div>
    `;
    this.messagesEl.appendChild(msg);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return msg;
  }

  private renderMessages() {
    this.messagesEl.innerHTML = '';
    for (const m of this.messages.slice(-20)) {
      this.addMessage(m.role, m.content);
    }
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
  }
}
