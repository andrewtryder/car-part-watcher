import type { EmailNotificationSettings } from "../repositories/email_notification_settings_repository.ts";
import type { NotificationEventV1, Notifier } from "./notification_service.ts";

export class EmailConfigurationError extends Error {
  code = "EMAIL_CONFIGURATION_MISSING";
  constructor(message = "Gmail email delivery is not configured") {
    super(message);
  }
}

export interface RenderedNotificationEmail {
  subject: string;
  text: string;
  html: string;
}
const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
const link = (label: string, value?: string) =>
  value ? `<p><a href="${escapeHtml(value)}">${escapeHtml(label)}</a></p>` : "";
const line = (label: string, value?: string) =>
  value ? `${label}: ${value}` : "";
const linkedImage = (imageUrl?: string, targetUrl?: string) => {
  if (!imageUrl) return "";
  const image = `<img src="${
    escapeHtml(imageUrl)
  }" alt="Part thumbnail" width="240">`;
  return targetUrl
    ? `<p><a href="${escapeHtml(targetUrl)}">${image}</a></p>`
    : `<p>${image}</p>`;
};

export function renderNotificationEmail(
  event: NotificationEventV1,
  settings: EmailNotificationSettings,
): RenderedNotificationEmail {
  const title = event.listing.title.slice(0, 180);
  const subject = `${settings.subjectPrefix} ${event.watch.name}: New ${title}${
    event.listing.price ? ` — ${event.listing.price}` : ""
  }`.slice(0, 500);
  const savedSearch = settings.appBaseUrl
    ? `${settings.appBaseUrl.replace(/\/$/, "")}/watches/${event.watch.id}`
    : undefined;
  const listingUrl = event.listing.listingUrl ?? event.listing.photoUrl;
  const photoUrl = event.listing.photoUrl;
  const combinedListingAndPhotos = Boolean(
    listingUrl && photoUrl && listingUrl === photoUrl,
  );
  const details = [
    line("Price", event.listing.price),
    line("Recycler", event.listing.recyclerName),
    line("Location", event.listing.location),
    line("Stock #", event.listing.stockNumber),
    line("Grade", event.listing.grade),
    line("Damage", event.listing.damageCode),
  ].filter(Boolean);
  const sourceLinks = combinedListingAndPhotos
    ? [`View Listing & Photos:\n${listingUrl}`]
    : [
      listingUrl ? `View Listing:\n${listingUrl}` : "",
      photoUrl ? `View Photos:\n${photoUrl}` : "",
    ];
  const text = [
    `New part found for: ${event.watch.name}`,
    "",
    title,
    event.listing.description ?? "",
    "",
    ...details,
    ...sourceLinks,
    event.listing.quoteUrl ? `Request Quote:\n${event.listing.quoteUrl}` : "",
    savedSearch ? `Saved Search:\n${savedSearch}` : "",
  ].filter(Boolean).join("\n");
  const titleHtml = listingUrl
    ? `<h3><a href="${escapeHtml(listingUrl)}">${escapeHtml(title)}</a></h3>`
    : `<h3>${escapeHtml(title)}</h3>`;
  const sourceLinkHtml = combinedListingAndPhotos
    ? link("View Listing & Photos", listingUrl)
    : `${link("View Listing", listingUrl)}${link("View Photos", photoUrl)}`;
  const html = `<h2>New part found for: ${
    escapeHtml(event.watch.name)
  }</h2>${titleHtml}${
    linkedImage(event.listing.imageUrl, photoUrl ?? listingUrl)
  }${
    event.listing.description
      ? `<p>${escapeHtml(event.listing.description)}</p>`
      : ""
  }<ul>${
    details.map((value) => `<li>${escapeHtml(value)}</li>`).join("")
  }</ul>${sourceLinkHtml}${link("Request Quote", event.listing.quoteUrl)}${
    link("View Saved Search", savedSearch)
  }`;
  return { subject, text, html };
}

export class GmailNotifier implements Notifier {
  constructor(
    private readonly settings: EmailNotificationSettings,
    private readonly send?: (
      message: Record<string, unknown>,
    ) => Promise<unknown>,
    private readonly credentials = () => ({
      username: Deno.env.get("GMAIL_USERNAME"),
      password: Deno.env.get("GMAIL_APP_PASSWORD"),
    }),
  ) {}
  async deliver(event: NotificationEventV1) {
    const { username, password } = this.credentials();
    if (!username || !password || !this.settings.toAddress) {
      throw new EmailConfigurationError();
    }
    const message = renderNotificationEmail(event, this.settings);
    const payload = {
      from: `${this.settings.fromName} <${username}>`,
      to: this.settings.toAddress,
      subject: message.subject,
      text: message.text,
      html: message.html,
      messageId: `<${event.eventId}@car-part-watcher>`,
    };
    if (this.send) {
      await this.send(payload);
      return;
    }
    const nodemailer = (await import("npm:nodemailer@7.0.13")).default;
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: username, pass: password },
    });
    await transport.sendMail(payload);
  }
}
