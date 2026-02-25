export interface LocationDetails {
  name: string;
  map_query: string;
}

export interface Locations {
  terminals: { [key: string]: LocationDetails };
  airports: { [key: string]: LocationDetails };
  stations: { [key: string]: LocationDetails };
  landmarks: { [key: string]: LocationDetails };
  aliases: { [key: string]: string };
} 