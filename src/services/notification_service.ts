import {
  claimNotificationEvents,
  markDelivered,
  markFailed,
  type NotificationEvent,
} from "../repositories/notification_repository.ts";
import type { NormalizedListing } from "../listing_normalizer.ts";

export interface NotificationEventV1 {
  version: 1;
  eventId: string;
  eventType: "new_listing";
  watch: {
    id: string;
    name: string;
  };
  listing: {
    id: string;
    title: string;
    price?: string;
    location?: string;
    recyclerName?: string;
    stockNumber?: string;
    description?: string;
    grade?: string;
    damageCode?: string;
    imageUrl?: string;
    photoUrl?: string;
    quoteUrl?: string;
  };
  schedule: {
    slot: string;
  };
}

export class NotificationPayloadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationPayloadValidationError";
  }
}

export function buildNotificationEventV1(params: {
  eventId?: string;
  watch: { id: string; name: string };
  listing: { id: string; listing: NormalizedListing };
  scheduleSlot?: string;
}): NotificationEventV1 {
  const rawListing = params.listing.listing;
  const title = [rawListing.year, rawListing.makeModel, rawListing.part]
    .filter(Boolean)
    .join(" ") || rawListing.part || rawListing.makeModel || "Listing";

  return {
    version: 1,
    eventId: params.eventId ?? crypto.randomUUID(),
    eventType: "new_listing",
    watch: {
      id: params.watch.id,
      name: params.watch.name,
    },
    listing: {
      id: params.listing.id,
      title,
      price: rawListing.priceDisplay ?? (rawListing.priceAmount ? `$${rawListing.priceAmount}` : undefined),
      location: rawListing.recyclerLocation,
      recyclerName: rawListing.recyclerName,
      stockNumber: rawListing.stockNumber,
      description: rawListing.description,
      grade: rawListing.grade,
      damageCode: rawListing.damageCode,
      imageUrl: rawListing.imageUrl,
      photoUrl: rawListing.photoUrl,
      quoteUrl: rawListing.quoteUrl,
    },
    schedule: {
      slot: params.scheduleSlot ?? "manual",
    },
  };
}

export function parseNotificationEventV1(raw: unknown): NotificationEventV1 {
  let parsed = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new NotificationPayloadValidationError("Payload must be valid JSON");
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new NotificationPayloadValidationError("Payload must be a non-null object");
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.version !== 1) {
    throw new NotificationPayloadValidationError(
      `Unsupported notification payload version: ${String(obj.version)}`,
    );
  }

  if (obj.eventType !== "new_listing") {
    throw new NotificationPayloadValidationError(
      `Invalid or missing eventType: ${String(obj.eventType)}`,
    );
  }

  if (typeof obj.eventId !== "string" || !obj.eventId.trim()) {
    throw new NotificationPayloadValidationError("Missing or invalid eventId");
  }

  if (!obj.watch || typeof obj.watch !== "object" || Array.isArray(obj.watch)) {
    throw new NotificationPayloadValidationError("Missing or invalid watch object");
  }

  const watch = obj.watch as Record<string, unknown>;
  if (typeof watch.id !== "string" || !watch.id.trim()) {
    throw new NotificationPayloadValidationError("Missing or invalid watch.id");
  }
  if (typeof watch.name !== "string" || !watch.name.trim()) {
    throw new NotificationPayloadValidationError("Missing or invalid watch.name");
  }

  if (!obj.listing || typeof obj.listing !== "object" || Array.isArray(obj.listing)) {
    throw new NotificationPayloadValidationError("Missing or invalid listing object");
  }

  const listing = obj.listing as Record<string, unknown>;
  if (typeof listing.id !== "string" || !listing.id.trim()) {
    throw new NotificationPayloadValidationError("Missing or invalid listing.id");
  }
  if (typeof listing.title !== "string" || !listing.title.trim()) {
    throw new NotificationPayloadValidationError("Missing or invalid listing.title");
  }

  if (!obj.schedule || typeof obj.schedule !== "object" || Array.isArray(obj.schedule)) {
    throw new NotificationPayloadValidationError("Missing or invalid schedule object");
  }

  const schedule = obj.schedule as Record<string, unknown>;
  if (typeof schedule.slot !== "string" || !schedule.slot.trim()) {
    throw new NotificationPayloadValidationError("Missing or invalid schedule.slot");
  }

  return {
    version: 1,
    eventId: obj.eventId,
    eventType: "new_listing",
    watch: {
      id: watch.id,
      name: watch.name,
    },
    listing: {
      id: listing.id,
      title: listing.title,
      price: typeof listing.price === "string" ? listing.price : undefined,
      location: typeof listing.location === "string" ? listing.location : undefined,
      recyclerName: typeof listing.recyclerName === "string" ? listing.recyclerName : undefined,
      stockNumber: typeof listing.stockNumber === "string" ? listing.stockNumber : undefined,
      description: typeof listing.description === "string" ? listing.description : undefined,
      grade: typeof listing.grade === "string" ? listing.grade : undefined,
      damageCode: typeof listing.damageCode === "string" ? listing.damageCode : undefined,
      imageUrl: typeof listing.imageUrl === "string" ? listing.imageUrl : undefined,
      photoUrl: typeof listing.photoUrl === "string" ? listing.photoUrl : undefined,
      quoteUrl: typeof listing.quoteUrl === "string" ? listing.quoteUrl : undefined,
    },
    schedule: {
      slot: schedule.slot,
    },
  };
}

export interface Notifier {
  deliver(event: NotificationEventV1): Promise<void>;
}

export class LoggingNotifier implements Notifier {
  async deliver(event: NotificationEventV1) {
    console.log(
      `[notification] eventId=${event.eventId} watchId=${event.watch.id} watch=${JSON.stringify(event.watch.name)} listingId=${event.listing.id} listing=${JSON.stringify(event.listing.title)} price=${event.listing.price ?? ""} slot=${event.schedule.slot}`,
    );
  }
}

export async function processNotificationOutbox(
  notifier: Notifier = new LoggingNotifier(),
) {
  const events = await claimNotificationEvents();
  let delivered = 0;
  let failed = 0;

  for (const row of events) {
    let canonicalEvent: NotificationEventV1;
    try {
      canonicalEvent = parseNotificationEventV1(row.payload);
    } catch (validationErr) {
      const message = validationErr instanceof Error
        ? validationErr.message
        : "Invalid payload";
      console.error(
        `[notification_payload_invalid] outboxId=${row.id} eventType=${row.eventType} error=${message}`,
      );
      await markFailed(
        row.id,
        row.attempts,
        "NOTIFICATION_PAYLOAD_INVALID",
        message,
        { terminal: true },
      );
      failed++;
      continue;
    }

    try {
      console.log(
        `[notification_outbox_claimed] eventId=${canonicalEvent.eventId} outboxId=${row.id}`,
      );
      await notifier.deliver(canonicalEvent);
      await markDelivered(row.id);
      console.log(
        `[notification_delivered] eventId=${canonicalEvent.eventId} outboxId=${row.id}`,
      );
      delivered++;
    } catch (deliverErr) {
      const message = deliverErr instanceof Error
        ? deliverErr.message
        : "Notifier failed";
      console.error(
        `[notification_failed] eventId=${canonicalEvent.eventId} outboxId=${row.id} error=${message}`,
      );
      await markFailed(row.id, row.attempts, "NOTIFIER_FAILED", message);
      failed++;
    }
  }

  return { claimed: events.length, delivered, failed };
}
