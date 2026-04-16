import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { useDeviceStore } from "../../store/useDeviceStore";
import { useMapStore } from "../../store/useMapStore";
import { useSurveyStore } from "../../store/useSurveyStore";
import { fixTypeColor } from "../../lib/formats";
import { Crosshair, Navigation } from "lucide-react";

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const surveyMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const followRover = useMapStore((s) => s.followRover);
  const setFollowRover = useMapStore((s) => s.setFollowRover);

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
      center: [2.17, 41.39],
      zoom: 13,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl(), "bottom-left");

    // Disable follow when user pans manually
    map.on("dragstart", () => {
      useMapStore.getState().setFollowRover(false);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      surveyMarkersRef.current.clear();
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
        el.style.cssText = [
          "width:18px", "height:18px", "border-radius:50%",
          "border:3px solid white", "box-shadow:0 0 6px rgba(0,0,0,0.5)",
        ].join(";");
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

  // Sync survey point markers (all sessions, active session bolder)
  useEffect(() => {
    return useSurveyStore.subscribe((state) => {
      const map = mapRef.current;
      if (!map) return;

      const current = surveyMarkersRef.current;
      // Flatten all points across all sessions
      const allPoints = state.sessions.flatMap((s) =>
        s.points.map((p) => ({ ...p, isActive: s.id === state.activeSessionId }))
      );
      const pointIds = new Set(allPoints.map((p) => p.id));

      // Remove deleted markers
      current.forEach((marker, id) => {
        if (!pointIds.has(id)) {
          marker.remove();
          current.delete(id);
        }
      });

      // Add new markers
      allPoints.forEach((p) => {
        if (current.has(p.id)) return;

        const size = p.isActive ? "12px" : "8px";
        const border = p.isActive ? "2px solid white" : "1.5px solid rgba(255,255,255,0.5)";
        const shadow = p.isActive
          ? "0 0 5px rgba(0,0,0,0.7)"
          : "0 0 3px rgba(0,0,0,0.4)";

        const el = document.createElement("div");
        el.style.cssText = [
          `background-color:${fixTypeColor(p.fix_quality)}`,
          `width:${size}`, `height:${size}`, "border-radius:50%",
          `border:${border}`, `box-shadow:${shadow}`,
          "cursor:pointer", "position:relative",
        ].join(";");

        if (p.isActive) {
          const label = document.createElement("div");
          label.textContent = p.name;
          label.style.cssText = [
            "position:absolute", "top:-15px", "left:50%",
            "transform:translateX(-50%)",
            "font-size:9px", "font-family:monospace", "font-weight:700",
            "color:white", "white-space:nowrap",
            "text-shadow:0 0 3px black,0 0 3px black",
            "pointer-events:none",
          ].join(";");
          el.appendChild(label);
        }

        const popup = new maplibregl.Popup({ offset: 12, closeButton: false })
          .setHTML(
            `<div style="font-size:11px;font-family:monospace;line-height:1.6">
              <b>${p.name}</b>${p.code ? ` <span style="color:#94a3b8">${p.code}</span>` : ""}<br/>
              ${p.latitude.toFixed(7)}<br/>
              ${p.longitude.toFixed(7)}<br/>
              Alt: ${p.altitude.toFixed(3)} m
            </div>`
          );

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([p.longitude, p.latitude])
          .setPopup(popup)
          .addTo(map);

        current.set(p.id, marker);
      });
    });
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Follow toggle button */}
      <button
        onClick={() => setFollowRover(!followRover)}
        title={followRover ? "Following rover — click to unlock map" : "Map unlocked — click to follow rover"}
        className={`absolute bottom-12 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium shadow-lg transition-colors ${
          followRover
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-gray-800/90 hover:bg-gray-700 text-gray-300 border border-gray-600"
        }`}
      >
        {followRover ? (
          <><Navigation size={13} className="fill-white" /> Following</>
        ) : (
          <><Crosshair size={13} /> Free</>
        )}
      </button>
    </div>
  );
}
