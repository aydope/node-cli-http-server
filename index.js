#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import clipboardy from "clipboardy";
import ora from "ora";
import { createInterface } from "readline";
import { stdin, stdout } from "process";
import { createServer } from "http";
import { readFile, stat, readdir, mkdir, writeFile, unlink, rmdir, rename } from "fs/promises";
import { join, extname, resolve, dirname } from "path";
import { existsSync } from "fs";
import { networkInterfaces } from "os";

class StaticFileServer {
  #readline;
  #httpServer = null;
  #port = 3000;
  #publicDir = "./public";

  #allowedFileTypes = ['.txt', '.js', '.html', '.css', '.json', '.md', '.xml', '.jpg', '.png', '.gif', '.svg'];
  #maxFileSize = 10 * 1024 * 1024;
  #restrictedPaths = ['node_modules', '.git', '.env'];

  constructor(options = {}) {
    this.#port = options.port || 3000;
    this.#publicDir = options.directory || "./public";

    this.#readline = createInterface({ input: stdin, output: stdout });
    this.#readline.on("close", () => {
      console.log(chalk.gray("Exiting CLI..."));
      process.exit(0);
    });
  }

  #prompt(promptMessage) {
    return new Promise((resolve) =>
      this.#readline.question(promptMessage, resolve)
    );
  }

  #getContentType(ext) {
    const types = {
      '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css',
      '.js': 'application/javascript', '.json': 'application/json',
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
      '.txt': 'text/plain', '.md': 'text/markdown', '.pdf': 'application/pdf',
      '.zip': 'application/zip', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
      '.xml': 'application/xml'
    };
    return types[ext] || 'application/octet-stream';
  }

  #formatFileSize(bytes) {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  #getFileIcon(filename, isDirectory) {
    if (isDirectory) return 'folder';
    const ext = extname(filename).toLowerCase();
    const icons = {
      '.js': 'javascript', '.html': 'html', '.css': 'css',
      '.json': 'json', '.txt': 'document', '.jpg': 'image',
      '.png': 'image', '.pdf': 'pdf', '.zip': 'archive'
    };
    return icons[ext] || 'file';
  }

  #isValidFilePath(filePath) {
    const normalized = resolve(filePath);
    const publicResolved = resolve(this.#publicDir);
    if (!normalized.startsWith(publicResolved)) return false;
    for (const restricted of this.#restrictedPaths) {
      if (normalized.includes(restricted)) return false;
    }
    return true;
  }

  #isAllowedFileType(filename) {
    const ext = extname(filename).toLowerCase();
    return this.#allowedFileTypes.includes(ext);
  }

  #getIconSvg(iconType) {
    const icons = {
      folder: '<svg viewBox="0 0 24 24" fill="#FDB813"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>',
      file: '<svg viewBox="0 0 24 24" fill="#8A8A8A"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm0 4h5v2H6V6zm0 4h10v2H6v-2zm0 4h10v2H6v-2z"/></svg>',
      html: '<svg viewBox="0 0 24 24" fill="#E44D26"><path d="M4 5h16v14H4z M8 9h8v2H8z M8 13h6v2H8z"/></svg>',
      css: '<svg viewBox="0 0 24 24" fill="#264DE4"><path d="M4 5h16v14H4z M8 9h8v2H8z M8 13h8v2H8z"/></svg>',
      javascript: '<svg viewBox="0 0 24 24" fill="#F7DF1E"><path d="M4 5h16v14H4z M8 10h8v2H8z M8 14h6v2H8z"/></svg>',
      image: '<svg viewBox="0 0 24 24" fill="#4CAF50"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
      pdf: '<svg viewBox="0 0 24 24" fill="#F40F02"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 6h-4v2h4v2h-4v2H8v-8h6v2z"/></svg>'
    };
    return icons[iconType] || icons.file;
  }

  async #generateWindows11Explorer(currentPath = '') {
    const fullPath = join(this.#publicDir, currentPath);

    if (!existsSync(fullPath)) {
      await mkdir(fullPath, { recursive: true });
    }

    const items = await readdir(fullPath, { withFileTypes: true });

    let itemsHtml = '';
    let breadcrumbHtml = '';

    const pathParts = currentPath.split('/').filter(p => p);
    let accumulatedPath = '';

    breadcrumbHtml = '<span class="breadcrumb-item"><a href="/">This PC</a> <span class="separator">></span></span>';
    breadcrumbHtml += '<span class="breadcrumb-item"><a href="/">Documents</a> <span class="separator">></span></span>';

    for (const part of pathParts) {
      accumulatedPath += '/' + part;
      breadcrumbHtml += `<span class="breadcrumb-item"><a href="${accumulatedPath}">${part}</a> <span class="separator">></span></span>`;
    }

    for (const item of items) {
      const itemName = item.name;
      const itemPath = currentPath ? `${currentPath}/${itemName}` : itemName;
      const itemFullPath = join(fullPath, itemName);
      const stats = await stat(itemFullPath);
      const size = item.isDirectory() ? '' : this.#formatFileSize(stats.size);
      const modified = stats.mtime.toLocaleString();
      const icon = this.#getFileIcon(itemName, item.isDirectory());
      const isImage = !item.isDirectory() && ['.jpg', '.jpeg', '.png', '.gif', '.svg'].includes(extname(itemName).toLowerCase());

      itemsHtml += `
        <div class="file-item" data-path="${itemPath}" data-type="${item.isDirectory() ? 'folder' : 'file'}">
          <div class="file-checkbox-container">
            <input type="checkbox" class="file-checkbox" value="${itemPath}">
          </div>
          <div class="file-icon">
            ${this.#getIconSvg(icon)}
          </div>
          <div class="file-info">
            <div class="file-name">
              <a href="${item.isDirectory() ? `/${itemPath}` : `/file/${itemPath}`}">${this.#escapeHtml(itemName)}</a>
              ${!item.isDirectory() && isImage ? '<span class="file-badge">image</span>' : ''}
            </div>
            <div class="file-details">
              <span class="file-size">${size}</span>
              <span class="file-date">${modified}</span>
            </div>
          </div>
          <div class="file-actions">
            ${!item.isDirectory() && this.#isAllowedFileType(itemName) ? `<button class="action-btn edit-btn" data-file="${itemPath}" title="Edit">✏️</button>` : ''}
            <button class="action-btn delete-btn" data-path="${itemPath}" data-type="${item.isDirectory() ? 'folder' : 'file'}" title="Delete">🗑️</button>
            <button class="action-btn rename-btn" data-path="${itemPath}" title="Rename">✏️</button>
          </div>
        </div>
      `;
    }

    if (items.length === 0) {
      itemsHtml = '<div class="empty-folder">This folder is empty</div>';
    }

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Peek File Explorer - ${this.#escapeHtml(currentPath || 'This PC')}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Segoe UI', 'Windows 11', system-ui, -apple-system, sans-serif;
            background: #f0f0f0;
            color: #1a1a1a;
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .title-bar {
            background: #ffffff;
            padding: 12px 20px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          }

          .title-bar h1 {
            font-size: 18px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .title-bar h1 svg {
            width: 24px;
            height: 24px;
          }

          .window-controls {
            display: flex;
            gap: 8px;
          }

          .window-btn {
            width: 32px;
            height: 32px;
            border: none;
            background: transparent;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          }

          .window-btn:hover {
            background: #e0e0e0;
          }

          .nav-bar {
            background: #ffffff;
            padding: 8px 20px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .nav-buttons {
            display: flex;
            gap: 4px;
          }

          .nav-btn {
            width: 36px;
            height: 36px;
            border: none;
            background: transparent;
            border-radius: 6px;
            cursor: pointer;
            font-size: 18px;
          }

          .nav-btn:hover {
            background: #f0f0f0;
          }

          .address-bar {
            flex: 1;
            background: #f0f0f0;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 13px;
            color: #666;
          }

          .search-box {
            background: #f0f0f0;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 8px 12px;
            width: 250px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .search-box input {
            border: none;
            background: none;
            outline: none;
            flex: 1;
            font-size: 13px;
          }

          .toolbar {
            background: #ffffff;
            padding: 8px 20px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            gap: 8px;
          }

          .tool-btn {
            padding: 6px 12px;
            background: transparent;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .tool-btn:hover {
            background: #f0f0f0;
          }

          .breadcrumb {
            background: #ffffff;
            padding: 8px 20px;
            border-bottom: 1px solid #e0e0e0;
            font-size: 13px;
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
          }

          .breadcrumb-item {
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .breadcrumb-item a {
            color: #0078d4;
            text-decoration: none;
          }

          .breadcrumb-item a:hover {
            text-decoration: underline;
          }

          .separator {
            color: #999;
          }

          .main-content {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
          }

          .file-item {
            background: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            margin-bottom: 4px;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            transition: all 0.2s;
            cursor: pointer;
          }

          .file-item:hover {
            background: #f8f9fa;
            border-color: #0078d4;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }

          .file-checkbox-container {
            width: 20px;
          }

          .file-checkbox {
            width: 18px;
            height: 18px;
            cursor: pointer;
          }

          .file-icon {
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .file-icon svg {
            width: 28px;
            height: 28px;
          }

          .file-info {
            flex: 1;
          }

          .file-name {
            font-weight: 500;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }

          .file-name a {
            color: #1a1a1a;
            text-decoration: none;
            font-size: 14px;
          }

          .file-name a:hover {
            color: #0078d4;
            text-decoration: underline;
          }

          .file-badge {
            background: #e8f0fe;
            color: #0078d4;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
          }

          .file-details {
            display: flex;
            gap: 20px;
            font-size: 12px;
            color: #666;
          }

          .file-actions {
            display: flex;
            gap: 8px;
            opacity: 0;
            transition: opacity 0.2s;
          }

          .file-item:hover .file-actions {
            opacity: 1;
          }

          .action-btn {
            width: 28px;
            height: 28px;
            border: none;
            background: transparent;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          }

          .action-btn:hover {
            background: #e0e0e0;
          }

          .edit-btn:hover { background: #0078d4; color: white; }
          .delete-btn:hover { background: #d13438; color: white; }
          .rename-btn:hover { background: #ffb900; color: white; }

          .status-bar {
            background: #ffffff;
            border-top: 1px solid #e0e0e0;
            padding: 6px 20px;
            font-size: 12px;
            color: #666;
            display: flex;
            justify-content: space-between;
          }

          .empty-folder {
            text-align: center;
            padding: 60px;
            color: #999;
            font-size: 14px;
          }

          .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            justify-content: center;
            align-items: center;
            z-index: 1000;
          }

          .modal-content {
            background: #ffffff;
            border-radius: 12px;
            width: 550px;
            max-width: 90%;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            overflow: hidden;
          }

          .modal-header {
            padding: 20px 24px;
            border-bottom: 1px solid #e0e0e0;
            font-weight: 500;
            font-size: 18px;
          }

          .modal-body {
            padding: 24px;
          }

          .modal-body label {
            display: block;
            margin-bottom: 8px;
            font-size: 13px;
            font-weight: 500;
          }

          .modal-body input, .modal-body textarea {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            font-size: 14px;
            font-family: monospace;
          }

          .modal-body textarea {
            min-height: 300px;
            font-family: 'Consolas', monospace;
          }

          .modal-footer {
            padding: 16px 24px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            justify-content: flex-end;
            gap: 8px;
          }

          .modal-footer button {
            padding: 8px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
          }

          .btn-cancel {
            background: #f0f0f0;
          }

          .btn-cancel:hover {
            background: #e0e0e0;
          }

          .btn-primary {
            background: #0078d4;
            color: white;
          }

          .btn-primary:hover {
            background: #106ebe;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .modal.show {
            display: flex;
            animation: fadeIn 0.2s;
          }

          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }

          ::-webkit-scrollbar-track {
            background: #f0f0f0;
          }

          ::-webkit-scrollbar-thumb {
            background: #c0c0c0;
            border-radius: 4px;
          }

          ::-webkit-scrollbar-thumb:hover {
            background: #a0a0a0;
          }
        </style>
      </head>
      <body>
        <div class="title-bar">
          <h1>
            <svg viewBox="0 0 24 24" fill="#0078d4">
              <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
            </svg>
            Peek File Explorer
          </h1>
          <div class="window-controls">
            <button class="window-btn" onclick="window.location.reload()">🔄</button>
          </div>
        </div>

        <div class="nav-bar">
          <div class="nav-buttons">
            <button class="nav-btn" onclick="goBack()">←</button>
          </div>
          <div class="address-bar">📁 ${this.#escapeHtml(currentPath || 'This PC')}</div>
          <div class="search-box">
            🔍 <input type="text" id="searchInput" placeholder="Search" oninput="filterFiles()">
          </div>
        </div>

        <div class="toolbar">
          <button class="tool-btn" onclick="showCreateFileModal()">📄 New file</button>
          <button class="tool-btn" onclick="showCreateFolderModal()">📁 New folder</button>
          <button class="tool-btn" onclick="deleteSelected()">🗑️ Delete</button>
          <button class="tool-btn" onclick="window.location.reload()">🔄 Refresh</button>
        </div>

        <div class="breadcrumb">
          ${breadcrumbHtml}
        </div>

        <div class="main-content" id="fileList">
          ${itemsHtml}
        </div>

        <div class="status-bar">
          <span id="statusMessage">Ready</span>
          <span>📁 ${items.length} items | 💾 Max ${this.#maxFileSize / 1024 / 1024}MB | 📄 ${this.#allowedFileTypes.join(', ')}</span>
        </div>

        <div id="createFileModal" class="modal">
          <div class="modal-content">
            <div class="modal-header">Create new file</div>
            <div class="modal-body">
              <label>Filename</label>
              <input type="text" id="fileName" placeholder="example.txt">
              <label style="margin-top: 16px;">Content</label>
              <textarea id="fileContent" placeholder="File content..."></textarea>
            </div>
            <div class="modal-footer">
              <button class="btn-cancel" onclick="closeModal('createFileModal')">Cancel</button>
              <button class="btn-primary" onclick="createFile()">Create</button>
            </div>
          </div>
        </div>

        <div id="createFolderModal" class="modal">
          <div class="modal-content">
            <div class="modal-header">Create new folder</div>
            <div class="modal-body">
              <label>Folder name</label>
              <input type="text" id="folderName" placeholder="New folder">
            </div>
            <div class="modal-footer">
              <button class="btn-cancel" onclick="closeModal('createFolderModal')">Cancel</button>
              <button class="btn-primary" onclick="createFolder()">Create</button>
            </div>
          </div>
        </div>

        <div id="editFileModal" class="modal">
          <div class="modal-content">
            <div class="modal-header">Edit file</div>
            <div class="modal-body">
              <input type="hidden" id="editFilePath">
              <textarea id="editFileContent" style="min-height: 400px;"></textarea>
            </div>
            <div class="modal-footer">
              <button class="btn-cancel" onclick="closeModal('editFileModal')">Cancel</button>
              <button class="btn-primary" onclick="saveFile()">Save</button>
            </div>
          </div>
        </div>

        <script>
          let currentPath = '${currentPath}';

          function showStatus(message, isError = false) {
            const statusDiv = document.getElementById('statusMessage');
            statusDiv.textContent = message;
            statusDiv.style.color = isError ? '#d13438' : '#107c10';
            setTimeout(() => {
              statusDiv.style.color = '#666';
            }, 3000);
          }

          function goBack() {
            const parts = currentPath.split('/').filter(p => p);
            parts.pop();
            const newPath = parts.join('/');
            window.location.href = '/' + (newPath ? newPath : '');
          }

          function filterFiles() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const items = document.querySelectorAll('.file-item');
            items.forEach(item => {
              const name = item.querySelector('.file-name a')?.textContent.toLowerCase() || '';
              item.style.display = name.includes(searchTerm) ? '' : 'none';
            });
          }

          window.showCreateFileModal = () => {
            document.getElementById('fileName').value = '';
            document.getElementById('fileContent').value = '';
            document.getElementById('createFileModal').style.display = 'flex';
          };

          window.showCreateFolderModal = () => {
            document.getElementById('folderName').value = '';
            document.getElementById('createFolderModal').style.display = 'flex';
          };

          window.closeModal = (modalId) => {
            document.getElementById(modalId).style.display = 'none';
          };

          window.createFile = async () => {
            const fileName = document.getElementById('fileName').value;
            const content = document.getElementById('fileContent').value;

            if (!fileName) {
              showStatus('Please enter a filename', true);
              return;
            }

            const allowedExts = ${JSON.stringify(this.#allowedFileTypes)};
            const ext = fileName.substring(fileName.lastIndexOf('.'));
            if (!allowedExts.includes(ext)) {
              showStatus('File type not allowed. Allowed: ' + allowedExts.join(', '), true);
              return;
            }

            if (content.length > ${this.#maxFileSize}) {
              showStatus('File too large. Maximum size: ${this.#maxFileSize / 1024 / 1024}MB', true);
              return;
            }

            try {
              const response = await fetch('/api/files', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  path: currentPath ? currentPath + '/' + fileName : fileName,
                  content: content
                })
              });

              if (!response.ok) {
                const error = await response.text();
                throw new Error(error);
              }
              showStatus('File created successfully');
              closeModal('createFileModal');
              window.location.reload();
            } catch (error) {
              showStatus(error.message, true);
            }
          };

          window.createFolder = async () => {
            const folderName = document.getElementById('folderName').value;
            if (!folderName) {
              showStatus('Please enter a folder name', true);
              return;
            }

            try {
              const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  path: currentPath ? currentPath + '/' + folderName : folderName
                })
              });

              if (!response.ok) {
                const error = await response.text();
                throw new Error(error);
              }
              showStatus('Folder created successfully');
              closeModal('createFolderModal');
              window.location.reload();
            } catch (error) {
              showStatus(error.message, true);
            }
          };

          window.editFile = async (filePath) => {
            try {
              const response = await fetch('/api/files/' + encodeURIComponent(filePath));
              if (!response.ok) throw new Error('Failed to load file');
              const data = await response.json();
              document.getElementById('editFilePath').value = filePath;
              document.getElementById('editFileContent').value = data.content;
              document.getElementById('editFileModal').style.display = 'flex';
            } catch (error) {
              showStatus(error.message, true);
            }
          };

          window.saveFile = async () => {
            const filePath = document.getElementById('editFilePath').value;
            const content = document.getElementById('editFileContent').value;

            if (content.length > ${this.#maxFileSize}) {
              showStatus('File too large', true);
              return;
            }

            try {
              const response = await fetch('/api/files/' + encodeURIComponent(filePath), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
              });

              if (!response.ok) {
                const error = await response.text();
                throw new Error(error);
              }
              showStatus('File saved successfully');
              closeModal('editFileModal');
              window.location.reload();
            } catch (error) {
              showStatus(error.message, true);
            }
          };

          window.deleteItem = async (path, type) => {
            if (!confirm('Are you sure you want to delete this ' + type + '?')) return;

            try {
              const response = await fetch('/api/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path, type })
              });

              if (!response.ok) {
                const error = await response.text();
                throw new Error(error);
              }
              showStatus(type + ' deleted successfully');
              window.location.reload();
            } catch (error) {
              showStatus(error.message, true);
            }
          };

          window.renameItem = async (oldPath) => {
            const newName = prompt('Enter new name:');
            if (!newName) return;

            try {
              const response = await fetch('/api/rename', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPath, newName })
              });

              if (!response.ok) {
                const error = await response.text();
                throw new Error(error);
              }
              showStatus('Renamed successfully');
              window.location.reload();
            } catch (error) {
              showStatus(error.message, true);
            }
          };

          window.deleteSelected = async () => {
            const selected = Array.from(document.querySelectorAll('.file-checkbox:checked')).map(cb => cb.value);
            if (selected.length === 0) {
              showStatus('No items selected', true);
              return;
            }
            if (!confirm('Delete ' + selected.length + ' item(s)?')) return;

            try {
              const response = await fetch('/api/delete-multiple', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paths: selected })
              });

              if (!response.ok) {
                const error = await response.text();
                throw new Error(error);
              }
              showStatus('Items deleted successfully');
              window.location.reload();
            } catch (error) {
              showStatus(error.message, true);
            }
          };

          document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              editFile(btn.dataset.file);
            });
          });

          document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              deleteItem(btn.dataset.path, btn.dataset.type);
            });
          });

          document.querySelectorAll('.rename-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              renameItem(btn.dataset.path);
            });
          });
        </script>
      </body>
      </html>
    `;
  }

  #escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }

  async #handleAPI(req, res, url) {
    if (url === '/api/files' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { path, content } = JSON.parse(body);
          const fullPath = join(this.#publicDir, path);

          if (!this.#isValidFilePath(fullPath)) throw new Error('Invalid path');
          if (!this.#isAllowedFileType(path)) throw new Error('File type not allowed');
          if (content.length > this.#maxFileSize) throw new Error('File too large');

          await writeFile(fullPath, content, 'utf8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return true;
    }

    if (url.startsWith('/api/files/') && req.method === 'GET') {
      const filePath = decodeURIComponent(url.replace('/api/files/', ''));
      const fullPath = join(this.#publicDir, filePath);

      if (!this.#isValidFilePath(fullPath)) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return true;
      }

      try {
        const content = await readFile(fullPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ content }));
      } catch (error) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'File not found' }));
      }
      return true;
    }

    if (url.startsWith('/api/files/') && req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const filePath = decodeURIComponent(url.replace('/api/files/', ''));
          const { content } = JSON.parse(body);
          const fullPath = join(this.#publicDir, filePath);

          if (!this.#isValidFilePath(fullPath)) throw new Error('Invalid path');
          if (content.length > this.#maxFileSize) throw new Error('File too large');

          await writeFile(fullPath, content, 'utf8');
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return true;
    }

    if (url === '/api/folders' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { path } = JSON.parse(body);
          const fullPath = join(this.#publicDir, path);

          if (!this.#isValidFilePath(fullPath)) throw new Error('Invalid path');

          await mkdir(fullPath, { recursive: true });
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return true;
    }

    if (url === '/api/delete' && req.method === 'DELETE') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { path, type } = JSON.parse(body);
          const fullPath = join(this.#publicDir, path);

          if (!this.#isValidFilePath(fullPath)) throw new Error('Invalid path');

          if (type === 'file') {
            await unlink(fullPath);
          } else {
            await rmdir(fullPath);
          }
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return true;
    }

    if (url === '/api/delete-multiple' && req.method === 'DELETE') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { paths } = JSON.parse(body);
          for (const path of paths) {
            const fullPath = join(this.#publicDir, path);
            if (this.#isValidFilePath(fullPath)) {
              const stats = await stat(fullPath);
              if (stats.isFile()) await unlink(fullPath);
              else await rmdir(fullPath);
            }
          }
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return true;
    }

    if (url === '/api/rename' && req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { oldPath, newName } = JSON.parse(body);
          const oldFullPath = join(this.#publicDir, oldPath);
          const newFullPath = join(dirname(oldFullPath), newName);

          if (!this.#isValidFilePath(oldFullPath) || !this.#isValidFilePath(newFullPath)) {
            throw new Error('Invalid path');
          }

          await rename(oldFullPath, newFullPath);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return true;
    }

    return false;
  }

  async #handleRequest(req, res) {
    try {
      const url = req.url;

      if (url.startsWith('/api/')) {
        await this.#handleAPI(req, res, url);
        return;
      }

      if (url === '/' || url === '/index.html') {
        const page = await this.#generateWindows11Explorer('');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(page);
        return;
      }

      if (url !== '/' && !url.includes('.')) {
        let dirPath = url.startsWith('/') ? url.slice(1) : url;
        const fullPath = join(this.#publicDir, dirPath);

        if (existsSync(fullPath)) {
          const stats = await stat(fullPath);
          if (stats.isDirectory()) {
            if (!url.endsWith('/')) {
              res.writeHead(301, { 'Location': url + '/' });
              res.end();
              return;
            }
            const page = await this.#generateWindows11Explorer(dirPath);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(page);
            return;
          }
        }
      }

      if (url.startsWith('/file/')) {
        const filePath = url.replace('/file/', '');
        const fullPath = join(this.#publicDir, filePath);

        if (!this.#isValidFilePath(fullPath)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        if (existsSync(fullPath)) {
          const stats = await stat(fullPath);
          if (stats.isFile()) {
            const content = await readFile(fullPath);
            const contentType = this.#getContentType(extname(fullPath));
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
            return;
          }
        }
      }

      res.writeHead(404);
      res.end('404 Not Found');

    } catch (error) {
      console.log(chalk.red(`Error: ${error.message}`));
      res.writeHead(500);
      res.end('500 Internal Server Error');
    }
  }

  #createHttpServer() {
    return createServer((req, res) => this.#handleRequest(req, res));
  }

  #getLocalIP() {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
    return 'localhost';
  }

  async startServer() {
    const spinner = ora('Starting server...').start();

    if (this.#httpServer?.listening) {
      spinner.warn('Server is already running');
      return;
    }

    if (!existsSync(this.#publicDir)) {
      spinner.text = 'Creating public directory...';
      await mkdir(this.#publicDir, { recursive: true });
      await writeFile(join(this.#publicDir, 'welcome.txt'), 'Welcome to Windows 11 File Explorer!');
      await writeFile(join(this.#publicDir, 'sample.html'), '<!DOCTYPE html><html><head><title>Sample</title></head><body><h1>Hello World!</h1></body></html>');
    }

    this.#httpServer = this.#httpServer || this.#createHttpServer();

    await new Promise((resolve, reject) => {
      this.#httpServer.listen(this.#port, '0.0.0.0', () => {
        spinner.succeed('Server started successfully');
        console.log(chalk.green(`\n  Local: http://localhost:${this.#port}`));
        console.log(chalk.green(`  Network: http://${this.#getLocalIP()}:${this.#port}`));
        console.log(chalk.gray(`\n  Directory: ${resolve(this.#publicDir)}`));
        console.log(chalk.cyan(`\n  File Explorer: http://localhost:${this.#port}`));
        console.log(chalk.gray(`\n  Allowed files: ${this.#allowedFileTypes.join(', ')}`));
        console.log(chalk.gray(`  Max file size: ${this.#maxFileSize / 1024 / 1024}MB`));
        console.log(chalk.white(`\n  Ready to use! 🚀\n`));
        resolve();
      });
      this.#httpServer.on("error", reject);
    });
  }

  async stopServer() {
    const spinner = ora('Stopping server...').start();

    if (!this.#httpServer?.listening) {
      spinner.warn('Server is not running');
      return;
    }

    await new Promise((resolve, reject) => {
      this.#httpServer.close((err) => {
        if (err) return reject(err);
        spinner.succeed('Server stopped successfully');
        resolve();
      });
    });
  }

  async restartServer() {
    const spinner = ora('Restarting server...').start();

    if (!this.#httpServer?.listening) {
      spinner.warn('Server is not running');
      return;
    }

    await this.stopServer();
    this.#httpServer = null;
    await this.startServer();
  }

  async setPort() {
    const newPort = await this.#prompt('Enter new port number (1024-65535): ');
    const port = parseInt(newPort);

    if (!isNaN(port) && port >= 1024 && port <= 65535) {
      const wasRunning = this.#httpServer?.listening;
      if (wasRunning) await this.stopServer();
      this.#port = port;
      if (wasRunning) await this.startServer();
      console.log(chalk.green(`Port changed to: ${port}`));
    } else {
      console.log(chalk.red('Invalid port number. Use 1024-65535'));
    }
  }

  async setDirectory() {
    const newDir = await this.#prompt('Enter directory path: ');
    const resolvedPath = resolve(newDir);

    if (existsSync(resolvedPath)) {
      const wasRunning = this.#httpServer?.listening;
      if (wasRunning) await this.stopServer();
      this.#publicDir = newDir;
      if (wasRunning) await this.startServer();
      console.log(chalk.green(`Directory changed to: ${resolvedPath}`));
    } else {
      console.log(chalk.red(`Directory not found: ${resolvedPath}`));
    }
  }

  async copyUrlToClipboard() {
    const url = `http://localhost:${this.#port}`;
    await clipboardy.write(url);
    console.log(chalk.green(`URL copied to clipboard: ${url}`));
  }

  showStatus() {
    console.log(chalk.cyan('\n  Server Status:'));
    console.log(`    Status: ${this.#httpServer?.listening ? chalk.green('Running') : chalk.red('Stopped')}`);
    console.log(`    Port: ${this.#port}`);
    console.log(`    Directory: ${resolve(this.#publicDir)}`);
    console.log(`    Allowed Types: ${this.#allowedFileTypes.join(', ')}`);
    console.log(`    Max Size: ${this.#maxFileSize / 1024 / 1024}MB\n`);
  }

  showHelp() {
    console.log(chalk.cyan('\n  Available Commands:'));
    console.log('    start     - Start the HTTP server');
    console.log('    stop      - Stop the HTTP server');
    console.log('    restart   - Restart the HTTP server');
    console.log('    status    - Show server status');
    console.log('    port      - Change server port');
    console.log('    dir       - Change public directory');
    console.log('    copy      - Copy server URL to clipboard');
    console.log('    help      - Show this help');
    console.log('    exit      - Exit the CLI\n');
  }

  async runCLI() {
    console.log(chalk.cyan('\n  Windows 11 File Explorer Server'));
    console.log(chalk.gray('  Type "help" for available commands\n'));

    this.showStatus();

    let userInput = await this.#prompt('Command: ');

    while (userInput.trim().toLowerCase() !== 'exit') {
      switch (userInput.trim().toLowerCase()) {
        case 'start':
          await this.startServer();
          break;
        case 'stop':
          await this.stopServer();
          break;
        case 'restart':
          await this.restartServer();
          break;
        case 'status':
          this.showStatus();
          break;
        case 'port':
          await this.setPort();
          break;
        case 'dir':
          await this.setDirectory();
          break;
        case 'copy':
          await this.copyUrlToClipboard();
          break;
        case 'help':
          this.showHelp();
          break;
        case 'clear':
          console.clear();
          break;
        default:
          if (userInput.trim()) {
            console.log(chalk.red(`Unknown command: ${userInput}`));
            console.log(chalk.gray('Type "help" for available commands'));
          }
      }

      console.log('');
      userInput = await this.#prompt('Command: ');
    }

    if (this.#httpServer?.listening) {
      await this.stopServer();
    }

    this.#readline.close();
  }
}

const program = new Command();

program
  .name('win11-explorer')
  .description('Windows 11 style file explorer server')
  .version('1.0.0');

program
  .option('-p, --port <number>', 'Server port', '3000')
  .option('-d, --dir <path>', 'Public directory', './public');

program
  .command('start')
  .description('Start the server')
  .action(async () => {
    const options = program.opts();
    const server = new StaticFileServer({
      port: parseInt(options.port),
      directory: options.dir
    });
    await server.startServer();
  });

program
  .command('cli')
  .description('Start interactive CLI mode')
  .action(async () => {
    const options = program.opts();
    const server = new StaticFileServer({
      port: parseInt(options.port),
      directory: options.dir
    });
    await server.runCLI();
  });

program.parse();

if (!process.argv.slice(2).length) {
  program.outputHelp();
}