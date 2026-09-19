"use client";

// Browser-only: Leaflet touches `window`, so this file is loaded with next/dynamic (ssr: false).
import "leaflet/dist/leaflet.css";
import Image from "next/image";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip } from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import type { LatLon, Photo, PhotoStatus } from "@/lib/types";

const STATUS_COLOR: Record<PhotoStatus, string> = {
  verified: "#10b981",
  likely: "#f59e0b",
  unverified: "#71717a",
};

export default function CampusMapLeaflet({
  campus,
  cityCenter,
  photos,
  labels,
}: {
  campus: LatLon;
  cityCenter?: LatLon;
  photos: Photo[];
  labels: { campus: string; cityCenter?: string; source: string };
}) {
  const campusPoint: LatLngTuple = [campus.lat, campus.lon];
  const centerPoint: LatLngTuple | undefined = cityCenter ? [cityCenter.lat, cityCenter.lon] : undefined;

  return (
    <MapContainer
      {...(centerPoint
        ? { bounds: [campusPoint, centerPoint], boundsOptions: { padding: [48, 48], maxZoom: 16 } }
        : { center: campusPoint, zoom: 15 })}
      scrollWheelZoom={false}
      className="size-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {photos.map((photo) => (
        <CircleMarker
          key={photo.id}
          center={[photo.coords!.lat, photo.coords!.lon]}
          radius={5}
          pathOptions={{ color: "#ffffff", weight: 1, fillColor: STATUS_COLOR[photo.status], fillOpacity: 0.9 }}
        >
          <Popup>
            <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="block w-48">
              <Image
                src={photo.thumbUrl}
                alt={photo.title}
                width={192}
                height={128}
                unoptimized
                className="h-32 w-48 rounded object-cover"
              />
              <span className="mt-1 block text-xs font-medium">{photo.title}</span>
              <span className="block text-[11px] opacity-70">{labels.source}: Wikimedia Commons ↗</span>
            </a>
          </Popup>
        </CircleMarker>
      ))}

      {centerPoint && (
        <>
          <Polyline positions={[campusPoint, centerPoint]} pathOptions={{ color: "#2563eb", weight: 3, dashArray: "8 8" }} />
          <CircleMarker
            center={centerPoint}
            radius={9}
            pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}
          >
            <Tooltip permanent direction="top" offset={[0, -10]}>
              {labels.cityCenter}
            </Tooltip>
          </CircleMarker>
        </>
      )}

      <CircleMarker
        center={campusPoint}
        radius={11}
        pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#171717", fillOpacity: 1 }}
      >
        <Tooltip permanent direction="top" offset={[0, -12]}>
          {labels.campus}
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
