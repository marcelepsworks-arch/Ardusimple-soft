import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { useDeviceStore } from "../../store/useDeviceStore";
import { useMapStore } from "../../store/useMapStore";
import { fixTypeColor } from "../../lib/formats";

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: [2.17, 41.39], // Barcelona default
      zoom: 13,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl(), "bottom-left");

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update rover marker on fix updates
  useEffect(() => {
    return useDeviceStore.subscribe((state) => {
      const fix = state.liveFix;
      const map = mapRef.current;
      if (!fix || !map) return;

      const lngLat: [number, number] = [fix.longitude, fix.latitude];

      if (!markerRef.current) {
        const el = document.createElement("div");
        el.className = "rover-marker";
        el.style.width = "18px";
        el.style.height = "18px";
        el.style.borderRadius = "50%";
        el.style.border = "3px solid white";
        el.style.boxShadow = "0 0 6px rgba(0,0,0,0.5)";
        markerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat(lngLat)
          .addTo(map);
      }

      const el = markerRef.current.getElement();
      el.style.backgroundColor = fixTypeColor(fix.fix_quality);
      markerRef.current.setLngLat(lngLat);

      if (useMapStore.getState().followRover) {
        map.easeTo({ center: lngLat, duration: 300 });
      }
    });
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
