export const CHIP_TYPES = {
  COUNTRY: 'country',
  CITY: 'city',
  PORT: 'port',
  ATTRACTION: 'attraction',
};

export type ChipType = (typeof CHIP_TYPES)[keyof typeof CHIP_TYPES];
