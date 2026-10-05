import { ScriniumClient } from './client.js';
import { LinksResource } from './resources/links.js';
import { WebhooksResource } from './resources/webhooks.js';
import { ViewersResource } from './resources/viewers.js';
import { OrgResource } from './resources/org.js';
import { verifyWebhookSignature } from './webhookVerify.js';
import type { ScriniumOptions } from './types.js';

const VERSION = '0.1.0';

/**
 * Scrinium Node.js SDK — secure document and video sharing API.
 *
 * @example
 * ```ts
 * import Scrinium from '@cloakshare/sdk';
 *
 * const cloakshare = new Scrinium('ck_live_xxx');
 *
 * const link = await cloakshare.links.create({
 *   file: './pitch-deck.pdf',
 *   requireEmail: true,
 *   watermark: true,
 *   expiresIn: '7d',
 * });
 *
 * console.log(link.secure_url);
 * ```
 */
export class Scrinium {
  private client: ScriniumClient;

  links: LinksResource;
  webhooks: WebhooksResource;
  viewers: ViewersResource;
  org: OrgResource;

  constructor(apiKey: string, options?: ScriniumOptions) {
    if (!apiKey) throw new Error('API key is required. Get one at https://app.cloakshare.dev');
    if (!apiKey.startsWith('ck_')) {
      throw new Error('Invalid API key format. Keys start with ck_live_ or ck_test_');
    }

    this.client = new ScriniumClient({
      apiKey,
      baseUrl: (options?.baseUrl ?? 'https://api.cloakshare.dev').replace(/\/$/, ''),
      timeout: options?.timeout ?? 30_000,
      maxRetries: options?.maxRetries ?? 2,
    });

    this.links = new LinksResource(this.client);
    this.webhooks = new WebhooksResource(this.client);
    this.viewers = new ViewersResource(this.client);
    this.org = new OrgResource(this.client);
  }

  /**
   * Verify a webhook signature. Can be used without instantiating Scrinium.
   *
   * @example
   * const isValid = Scrinium.webhooks.verify(rawBody, signature, secret);
   */
  static webhooks = {
    verify: verifyWebhookSignature,
  };

  /** SDK version */
  static version = VERSION;
}

export default Scrinium;

// Re-export types and errors
export * from './types.js';
export { ScriniumError, RateLimitError, AuthenticationError } from './errors.js';
export { verifyWebhookSignature } from './webhookVerify.js';
