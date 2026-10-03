import type { ListingChangeDto } from "./common.ts";

export type NotificationEventTypeDto = "new_listing" | "listing_updated";

export interface NotificationPayloadDto {
  version: 1;
  eventId: string;
  eventType: NotificationEventTypeDto;
  watch: { id: string; name: string };
  listing: {
    id: string;
    title: string;
    price?: string;
    recyclerName?: string;
    location?: string;
    stockNumber?: string;
    description?: string;
    grade?: string;
    damageCode?: string;
    imageUrl?: string;
    listingUrl?: string;
    photoUrl?: string;
    quoteUrl?: string;
  };
  changes?: ListingChangeDto[];
  schedule: { slot: string };
}

export interface NotificationDto {
  id: string;
  watchId: string;
  searchRunId: string;
  listingId?: string;
  eventType: NotificationEventTypeDto;
  payload: NotificationPayloadDto;
  deliveryId?: string;
  status?: "pending" | "processing" | "delivered" | "failed";
  attempts?: number;
  availableAt?: string;
  processedAt?: string;
  readAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  createdAt: string;
}

export interface NotificationListDto {
  items: NotificationDto[];
  unreadCount: number;
}
