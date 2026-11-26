export type Lang = 'bn' | 'en';
export type Theme = 'light' | 'dark';
export type MapLayer = 'districts' | 'upazilas';

export interface GeoDistrict {
  id: string;
  divisionId: string;
  name: string;
  bnName: string;
  lat: number;
  lng: number;
  cx: number;
  cy: number;
  bbox: [number, number, number, number];
  path: string;
  neighbors: string[];
}

export interface GeoUpazila {
  id: string;
  districtId: string;
  divisionId: string;
  name: string;
  bnName: string;
  cx: number;
  cy: number;
  bbox: [number, number, number, number];
  areaKm2: number;
  population: number;
  path: string;
  neighbors: string[];
  rivers: string[];
}

export interface GeoDivision {
  id: string;
  name: string;
  bnName: string;
  cx: number;
  cy: number;
  path: string;
}

export interface GeoRiver {
  id: string;
  name: string;
  bnName: string;
  lengthKm: number;
  path: string;
  districts: string[];
}

export interface BdMapGeoData {
  viewBox: string;
  divisions: GeoDivision[];
  districts: GeoDistrict[];
  rivers: GeoRiver[];
}

export interface BdUpazilasGeoData {
  upazilas: GeoUpazila[];
}
