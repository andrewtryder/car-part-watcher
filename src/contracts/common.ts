export interface SelectOptionDto {
  label: string;
  value: string;
}

export interface ListingChangeDto {
  field: string;
  oldValue?: string;
  newValue?: string;
}

export interface OkResponseDto {
  ok: true;
}
