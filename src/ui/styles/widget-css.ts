// CSS exported as a string to prevent tsup from extracting it to a separate file.
// This ensures the CSS is inlined in the JS bundle.
export default `#baseportal-chat-widget {
  display: block;
  position: static;
  width: 0;
  height: 0;
  overflow: visible;
  padding: 0;
  margin: 0;
  border: none;

  --bp-primary: #6366f1;
  --bp-primary-contrast: #ffffff;
  --bp-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;
  --bp-radius: 16px;
  --bp-radius-sm: 8px;
  --bp-bubble-size: 60px;
  --bp-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  --bp-shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.1);
  --bp-gray-50: #f9fafb;
  --bp-gray-100: #f3f4f6;
  --bp-gray-200: #e5e7eb;
  --bp-gray-300: #d1d5db;
  --bp-gray-500: #6b7280;
  --bp-gray-700: #374151;
  --bp-gray-900: #111827;
  --bp-transition: 0.2s ease;
}

#baseportal-chat-widget *,
#baseportal-chat-widget *::before,
#baseportal-chat-widget *::after {
  box-sizing: border-box;
}

/* ===== Chat Bubble (FAB) ===== */
.bp-bubble {
  pointer-events: auto;
  position: fixed;
  bottom: 24px;
  z-index: 2147483646;
  width: var(--bp-bubble-size);
  height: var(--bp-bubble-size);
  border-radius: 50%;
  background: var(--bp-primary);
  color: var(--bp-primary-contrast);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--bp-shadow);
  transition: transform var(--bp-transition), box-shadow var(--bp-transition);
  font-family: var(--bp-font-family);
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
  padding: 0;
}

.bp-bubble:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 32px rgba(0, 0, 0, 0.2);
}

.bp-bubble--right {
  right: 24px;
}

.bp-bubble--left {
  left: 24px;
}

.bp-bubble svg {
  width: 28px;
  height: 28px;
  fill: currentColor;
}

.bp-bubble__badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  background: #ef4444;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

/* ===== Chat Window ===== */
.bp-window {
  pointer-events: auto;
  position: fixed;
  bottom: 96px;
  z-index: 2147483647;
  width: 380px;
  height: 520px;
  border-radius: var(--bp-radius);
  background: #fff;
  box-shadow: var(--bp-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: bp-slide-up 0.25s ease-out;
  font-family: var(--bp-font-family);
  font-size: 14px;
  line-height: 1.5;
  color: var(--bp-gray-900);
}

.bp-window--right {
  right: 24px;
}

.bp-window--left {
  left: 24px;
}

@keyframes bp-slide-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Mobile fullscreen */
@media (max-width: 480px) {
  .bp-window {
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    border-radius: 0;
  }
}

/* ===== Header ===== */
.bp-header {
  padding: 16px;
  background: var(--bp-primary);
  color: var(--bp-primary-contrast);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.bp-header__title {
  font-size: 16px;
  font-weight: 600;
  color: inherit;
  display: flex;
  align-items: center;
  gap: 8px;
}

.bp-header__back,
.bp-header__close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--bp-transition);
}

.bp-header__back:hover,
.bp-header__close:hover {
  background: rgba(255, 255, 255, 0.15);
}

.bp-header__back svg,
.bp-header__close svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

/* ===== Message List ===== */
.bp-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bp-gray-50);
}

.bp-messages::-webkit-scrollbar {
  width: 4px;
}

.bp-messages::-webkit-scrollbar-thumb {
  background: var(--bp-gray-300);
  border-radius: 2px;
}

/* ===== Message Bubble ===== */
.bp-msg {
  display: flex;
  max-width: 80%;
}

.bp-msg--client {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.bp-msg--agent {
  align-self: flex-start;
}

.bp-msg__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bp-primary);
  color: var(--bp-primary-contrast);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: auto;
}

.bp-msg__avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.bp-msg__body {
  margin: 0 8px;
}

.bp-msg__content {
  padding: 10px 14px;
  border-radius: 16px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  line-height: 1.4;
}

.bp-msg--client .bp-msg__content {
  background: var(--bp-primary);
  color: var(--bp-primary-contrast);
  border-bottom-right-radius: 4px;
}

.bp-msg--agent .bp-msg__content {
  background: var(--bp-gray-100);
  color: var(--bp-gray-900);
  border-bottom-left-radius: 4px;
}

.bp-msg__time {
  font-size: 11px;
  color: var(--bp-gray-500);
  margin-top: 2px;
  padding: 0 4px;
}

.bp-msg--client .bp-msg__time {
  text-align: right;
}

/* ===== Message Input ===== */
.bp-input {
  padding: 12px 16px;
  border-top: 1px solid var(--bp-gray-200);
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: #fff;
  flex-shrink: 0;
}

.bp-input__field {
  flex: 1;
  border: 1px solid var(--bp-gray-200);
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.4;
  resize: none;
  outline: none;
  max-height: 100px;
  overflow-y: auto;
  transition: border-color var(--bp-transition);
  color: var(--bp-gray-900);
  background: #fff;
}

.bp-input__field:focus {
  border-color: var(--bp-primary);
}

.bp-input__field::placeholder {
  color: var(--bp-gray-500);
}

.bp-input__field:disabled {
  background: var(--bp-gray-50);
  cursor: not-allowed;
}

.bp-input__send {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bp-primary);
  color: var(--bp-primary-contrast);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity var(--bp-transition);
}

.bp-input__send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bp-input__send svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

/* ===== Pre-Chat Form ===== */
.bp-prechat {
  flex: 1;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.bp-prechat__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--bp-gray-900);
}

.bp-prechat__desc {
  font-size: 13px;
  color: var(--bp-gray-500);
}

.bp-prechat__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bp-prechat__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--bp-gray-700);
}

.bp-prechat__input {
  border: 1px solid var(--bp-gray-200);
  border-radius: var(--bp-radius-sm);
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color var(--bp-transition);
  color: var(--bp-gray-900);
  background: #fff;
}

.bp-prechat__input:focus {
  border-color: var(--bp-primary);
}

.bp-prechat__submit {
  padding: 10px 20px;
  border-radius: var(--bp-radius-sm);
  background: var(--bp-primary);
  color: var(--bp-primary-contrast);
  border: none;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: opacity var(--bp-transition);
}

.bp-prechat__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.bp-prechat__privacy {
  font-size: 12px;
  color: var(--bp-gray-500);
  text-align: center;
  margin-top: auto;
}

.bp-prechat__privacy a {
  color: var(--bp-primary);
  text-decoration: underline;
}

/* ===== Conversation List ===== */
.bp-convlist {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.bp-convlist__new {
  padding: 12px 16px;
  border-bottom: 1px solid var(--bp-gray-200);
}

.bp-convlist__new-btn {
  width: 100%;
  padding: 10px 16px;
  border-radius: var(--bp-radius-sm);
  background: rgba(99, 102, 241, 0.08);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  color: var(--bp-primary);
  transition: background var(--bp-transition);
}

.bp-convlist__new-btn:hover {
  background: rgba(99, 102, 241, 0.15);
}

.bp-convlist__items {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.bp-convlist__item {
  width: 100%;
  padding: 12px;
  border-radius: var(--bp-radius-sm);
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  font-family: inherit;
  transition: background var(--bp-transition);
  color: var(--bp-gray-900);
}

.bp-convlist__item:hover {
  background: var(--bp-gray-50);
}

.bp-convlist__item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.bp-convlist__item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.bp-convlist__item-title {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.bp-convlist__item-status {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.bp-convlist__item-status--open {
  background: #dcfce7;
  color: #166534;
}

.bp-convlist__item-status--closed {
  background: var(--bp-gray-100);
  color: var(--bp-gray-500);
}

.bp-convlist__item-preview {
  font-size: 13px;
  color: var(--bp-gray-500);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bp-convlist__empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--bp-gray-500);
  font-size: 14px;
}

/* ===== Closed conversation banner ===== */
.bp-closed-banner {
  padding: 12px 16px;
  border-top: 1px solid var(--bp-gray-200);
  text-align: center;
  background: var(--bp-gray-50);
  flex-shrink: 0;
}

.bp-closed-banner__text {
  font-size: 13px;
  color: var(--bp-gray-500);
}

.bp-closed-banner__reopen {
  display: inline-block;
  margin-top: 8px;
  padding: 6px 16px;
  border-radius: var(--bp-radius-sm);
  background: var(--bp-primary);
  color: var(--bp-primary-contrast);
  border: none;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: opacity var(--bp-transition);
}

.bp-closed-banner__reopen:hover {
  opacity: 0.9;
}

/* ===== Privacy footer ===== */
.bp-privacy-footer {
  padding: 4px 16px 8px;
  text-align: center;
  font-size: 11px;
  color: var(--bp-gray-500);
  flex-shrink: 0;
}

.bp-privacy-footer a {
  color: var(--bp-primary);
  text-decoration: underline;
}

/* ===== Loading ===== */
.bp-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bp-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--bp-gray-200);
  border-top-color: var(--bp-primary);
  border-radius: 50%;
  animation: bp-spin 0.6s linear infinite;
}

@keyframes bp-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ===== Hidden ===== */
.bp-hidden {
  display: none !important;
}
` as string
