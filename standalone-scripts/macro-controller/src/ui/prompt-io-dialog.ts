/**
 * Prompt IO Dialog — UI Shell (Issue 131 Task 5)
 * 
 * Provides a floating, draggable dialog for importing and exporting prompts.
 * Follows the style and behavior of the Bulk Rename dialog.
 */

import { 
  cPanelBg, 
  cPrimary, 
  cPrimaryLighter, 
  cPrimaryBgA 
} from '../shared-state';
import { exportPromptsToJson } from './prompt-io';

export function renderPromptIODialog(): void {
  removePromptIODialog();

  const panel = document.createElement('div');
  panel.id = 'ahk-loop-prompt-io-dialog';
  panel.style.cssText = `
    position:fixed;top:100px;right:60px;z-index:100005;
    background:${cPanelBg};border:1px solid ${cPrimary};
    border-radius:8px;padding:0;min-width:380px;max-width:450px;
    box-shadow:0 8px 32px rgba(0,0,0,.6);font-family:monospace;
    overflow:hidden;
  `;

  // Title Bar
  const titleBar = document.createElement('div');
  titleBar.style.cssText = `
    display:flex;align-items:center;justify-content:space-between;
    padding:8px 12px;background:${cPrimaryBgA};
    cursor:grab;user-select:none;border-bottom:1px solid rgba(124,58,237,0.3);
  `;

  const titleText = document.createElement('span');
  titleText.style.cssText = `font-size:11px;color:${cPrimaryLighter};font-weight:700;`;
  titleText.textContent = '📥 Prompts Import / Export';

  const closeBtn = document.createElement('span');
  closeBtn.style.cssText = 'cursor:pointer;color:#94a3b8;font-size:14px;padding:0 4px;';
  closeBtn.textContent = '✕';
  closeBtn.onclick = removePromptIODialog;

  titleBar.appendChild(titleText);
  titleBar.appendChild(closeBtn);
  panel.appendChild(titleBar);

  // Body
  const body = document.createElement('div');
  body.style.cssText = 'padding:16px;display:flex;flex-direction:column;gap:12px;';

  // Export Section
  const exportBtn = document.createElement('button');
  exportBtn.textContent = '📤 Export to JSON';
  exportBtn.style.cssText = `
    padding:8px;background:${cPrimary};color:white;border:none;
    border-radius:4px;cursor:pointer;font-weight:bold;
  `;
  exportBtn.onclick = () => exportPromptsToJson();
  body.appendChild(exportBtn);

  // Drop Zone (Placeholder for Task 6)
  const dropZone = document.createElement('div');
  dropZone.id = 'prompt-io-drop-zone';
  dropZone.style.cssText = `
    border:2px dashed #475569;border-radius:6px;padding:24px;
    text-align:center;color:#94a3b8;background:rgba(0,0,0,0.2);
    transition:all 0.2s;
  `;
  dropZone.innerHTML = `
    <div style="font-size:24px;margin-bottom:8px;">📄</div>
    <div style="font-size:12px;">Drop JSON file here</div>
    <div style="font-size:10px;margin-top:4px;color:#64748b;">or click to browse</div>
  `;
  body.appendChild(dropZone);

  panel.appendChild(body);
  document.body.appendChild(panel);

  // Dragging logic
  _makeDraggable(panel, titleBar);
}

export function removePromptIODialog(): void {
  const existing = document.getElementById('ahk-loop-prompt-io-dialog');
  if (existing) existing.remove();
}

function _makeDraggable(panel: HTMLElement, handle: HTMLElement): void {
  let isDragging = false;
  let dragOffX = 0;
  let dragOffY = 0;

  handle.onmousedown = (e) => {
    isDragging = true;
    dragOffX = e.clientX - panel.getBoundingClientRect().left;
    dragOffY = e.clientY - panel.getBoundingClientRect().top;
    handle.style.cursor = 'grabbing';
  };

  document.onmousemove = (e) => {
    if (!isDragging) return;
    panel.style.left = (e.clientX - dragOffX) + 'px';
    panel.style.top = (e.clientY - dragOffY) + 'px';
    panel.style.right = 'auto';
  };

  document.onmouseup = () => {
    isDragging = false;
    handle.style.cursor = 'grab';
  };
}
