import { MessageType } from './types';

export function sendMessage(msg: MessageType): Promise<any> {
  return chrome.runtime.sendMessage(msg);
}

export function onMessage(handler: (msg: MessageType, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void) {
  chrome.runtime.onMessage.addListener(handler);
}

export function sendToTab(tabId: number, msg: MessageType): Promise<any> {
  return chrome.tabs.sendMessage(tabId, msg);
}

// Port-based streaming connection
export function connectPort(name: string): chrome.runtime.Port {
  return chrome.runtime.connect({ name });
}

export function onPortConnect(handler: (port: chrome.runtime.Port) => void) {
  chrome.runtime.onConnect.addListener(handler);
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
