export interface Airport {
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

export interface Flight {
  icao24: string;
  callsign: string;
  originCountry: string;
  longitude: number;
  latitude: number;
  baroAltitude: number | null;
  velocity: number | null;
  trueTrack: number | null;
  verticalRate: number | null;
  onGround: boolean;
  lastContact: number;
  origin?: Airport;
  destination?: Airport;
  takeoff?: number;
  landing?: number;
  aircraftType?: string;
}

export interface FlightsResponse {
  flights: Flight[];
  lastRefresh: number;
  count: number;
  enriching: number;
}
