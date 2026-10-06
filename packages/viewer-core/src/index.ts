/**
 * @cloakshare/viewer — Drop-in secure document viewer component.
 *
 * Usage:
 *   <cloak-viewer src="/deck.pdf" watermark="Confidential" email-gate></cloak-viewer>
 *
 * @see https://cloakshare.dev/embed
 */

export { ScriniumViewerElement } from './cloak-viewer.js';
export type {
  ScriniumViewerProps,
  ScriniumViewEvent,
  ScriniumReadyEvent,
  ScriniumErrorEvent,
  ScriniumErrorCode,
  ScriniumCaptureEvent,
  CaptureReason,
} from './types.js';

// Auto-register the custom element
import { ScriniumViewerElement } from './cloak-viewer.js';

if (typeof window !== 'undefined' && !customElements.get('cloak-viewer')) {
  customElements.define('cloak-viewer', ScriniumViewerElement);
}
