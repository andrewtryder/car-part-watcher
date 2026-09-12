export interface SelectOption {
  label: string;
  value: string;
}

export interface SearchOptions {
  years: SelectOption[];
  makeModels: SelectOption[];
  parts: SelectOption[];
  locations: SelectOption[];
  sorts: SelectOption[];
}

export interface CarPartSearchRequest {
  year: string;
  makeModel: string;
  part: string;
  location?: string;
  sort: string;
  postalCode?: string;
  refinement?: { label: string };
}

export interface CarPartListing {
  year?: string;
  makeModel?: string;
  part?: string;
  description?: string;
  grade?: string;
  stockNumber?: string;
  price?: { amount?: number; currency?: string; display: string };
  recycler?: { name?: string; location?: string; phone?: string };
  sellerUserId?: string;
  partSourceId?: string;
  partGuid?: string;
  vehicleGuid?: string;
  imageUrl?: string;
  quoteUrl?: string;
}

export interface SpikeResult {
  search: CarPartSearchRequest;
  refinement?: { selected: string; available: string[] };
  results: { count: number; hasNextPage: boolean; listings: CarPartListing[] };
}

export type SpikeErrorCode =
  | "SEARCH_OPTION_NOT_FOUND"
  | "REFINEMENT_REQUIRED"
  | "REFINEMENT_OPTION_NOT_FOUND"
  | "UNEXPECTED_PAGE"
  | "ACCESS_CHALLENGE"
  | "BROWSER_LAUNCH_FAILED"
  | "RESULTS_PARSE_FAILED";

export class SpikeError extends Error {
  constructor(
    public readonly code: SpikeErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }

  toJSON() {
    return {
      error: { code: this.code, message: this.message, details: this.details },
    };
  }
}
