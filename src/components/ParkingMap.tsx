'use client';
import { MapContainer,TileLayer,Marker,Popup } from 'react-leaflet';
import L from 'leaflet';
import type { LatLngExpression } from 'leaflet';
export type MapLot={id:number;name:string;lat:number;lng:number;distance?:number};
const parkingIcon=L.divIcon({className:'parksmart-marker',html:'<span>🅿</span>',iconSize:[34,34],iconAnchor:[17,17]});
export default function ParkingMap({lots,center=[12.9756,77.6068] as LatLngExpression}:{lots:MapLot[];center?:LatLngExpression}){return <MapContainer center={center} zoom={13} scrollWheelZoom className="h-[360px] w-full rounded-xl"><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{lots.map(l=><Marker key={l.id} position={[l.lat,l.lng]} icon={parkingIcon}><Popup><b>{l.name}</b><br/>{l.distance} m away</Popup></Marker>)}</MapContainer>}
