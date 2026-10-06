import { describe, it, expectTypeOf } from 'vitest';
import type {
  ScriniumViewerProps,
  ScriniumViewEvent,
  ScriniumReadyEvent,
  ScriniumErrorEvent,
  ScriniumErrorCode,
  ScriniumCaptureEvent,
  CaptureReason,
} from '../types.js';

describe('type exports', () => {
  it('ScriniumViewerProps has required src field', () => {
    expectTypeOf<ScriniumViewerProps>().toHaveProperty('src');
    expectTypeOf<ScriniumViewerProps['src']>().toBeString();
  });

  it('ScriniumViewerProps has optional fields', () => {
    expectTypeOf<ScriniumViewerProps>().toHaveProperty('watermark');
    expectTypeOf<ScriniumViewerProps>().toHaveProperty('emailGate');
    expectTypeOf<ScriniumViewerProps>().toHaveProperty('password');
    expectTypeOf<ScriniumViewerProps>().toHaveProperty('theme');
    expectTypeOf<ScriniumViewerProps>().toHaveProperty('allowDownload');
    expectTypeOf<ScriniumViewerProps>().toHaveProperty('expires');
    expectTypeOf<ScriniumViewerProps>().toHaveProperty('apiKey');
    expectTypeOf<ScriniumViewerProps>().toHaveProperty('renderer');
    expectTypeOf<ScriniumViewerProps>().toHaveProperty('branding');
  });

  it('ScriniumViewEvent has expected shape', () => {
    expectTypeOf<ScriniumViewEvent>().toHaveProperty('page');
    expectTypeOf<ScriniumViewEvent>().toHaveProperty('email');
    expectTypeOf<ScriniumViewEvent>().toHaveProperty('timestamp');
    expectTypeOf<ScriniumViewEvent>().toHaveProperty('sessionId');
    expectTypeOf<ScriniumViewEvent>().toHaveProperty('duration');
    expectTypeOf<ScriniumViewEvent>().toHaveProperty('device');
  });

  it('ScriniumReadyEvent has expected shape', () => {
    expectTypeOf<ScriniumReadyEvent>().toHaveProperty('pageCount');
    expectTypeOf<ScriniumReadyEvent>().toHaveProperty('format');
  });

  it('ScriniumErrorEvent has expected shape', () => {
    expectTypeOf<ScriniumErrorEvent>().toHaveProperty('code');
    expectTypeOf<ScriniumErrorEvent>().toHaveProperty('message');
  });

  it('ScriniumErrorCode covers all error codes', () => {
    const codes: ScriniumErrorCode[] = [
      'LOAD_FAILED',
      'PARSE_FAILED',
      'EXPIRED',
      'PASSWORD_REQUIRED',
      'PASSWORD_INCORRECT',
      'EMAIL_REQUIRED',
      'API_ERROR',
      'API_UNAUTHORIZED',
      'UNSUPPORTED_FORMAT',
      'RENDER_ERROR',
    ];
    expectTypeOf(codes).toEqualTypeOf<ScriniumErrorCode[]>();
  });

  it('ScriniumCaptureEvent has expected shape', () => {
    expectTypeOf<ScriniumCaptureEvent>().toHaveProperty('reason');
    expectTypeOf<ScriniumCaptureEvent>().toHaveProperty('page');
    expectTypeOf<ScriniumCaptureEvent>().toHaveProperty('email');
    expectTypeOf<ScriniumCaptureEvent>().toHaveProperty('sessionId');
    expectTypeOf<ScriniumCaptureEvent>().toHaveProperty('timestamp');
  });

  it('CaptureReason covers every reported guard signal', () => {
    const reasons: CaptureReason[] = ['printscreen', 'tab-hidden', 'fullscreen-exit'];
    expectTypeOf(reasons).toEqualTypeOf<CaptureReason[]>();
  });
});
