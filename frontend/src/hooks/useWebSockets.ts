import { useState, useEffect, useRef } from "react";
import { formatTelemetryTime } from "@/lib/utils";

export interface LogEntry {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "telemetry" | "discovery";
  agentId: string;
  message: string;
  meta?: any;
}

const AGENTS = ["AH-089", "AH-042", "AH-077", "AH-012"];
const SECTORS = ["Alpha-4", "Beta-9", "Delta-1", "Gamma-6", "Epsilon-3"];

const MOCK_MESSAGES = [
  { type: "info", message: "Radar ping dispatched to Sector {sector}." },
  { type: "telemetry", message: "Concentric orbit synchronization locked. Pitch 45.0°." },
  { type: "discovery", message: "Asteroid '{name}' identified in Orbit Ring {ring}." },
  { type: "success", message: "Basalt rock composition analyzed: {composition}." },
  { type: "info", message: "Drone {drone} starting spectral scanning sequence." },
  { type: "warning", message: "Orbit Ring {ring} showing minor gravitational deviation (+0.04m/s²)." },
  { type: "telemetry", message: "Position updated: {coords}." },
  { type: "success", message: "Mining route computed. Fuel efficiency factor: 94.2%." },
  { type: "info", message: "Downloading raw laser reflectometry profiles..." },
  { type: "warning", message: "Solar wind interference detected. Adjusting filter bandwidth." },
];

const ASTEROID_NAMES = ["Bennu-X", "Apophis-Beta", "16-Psyche", "Eros-Prime", "Ceres-Minor", "Castalia-9", "Itokawa-1", "Ryugu-Alpha"];

export function useWebSockets(url?: string) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  // Initialize with some realistic baseline log history
  useEffect(() => {
    const initialLogs: LogEntry[] = [];
    const now = new Date();
    
    // Build initial log items going backwards in time
    for (let i = 8; i >= 0; i--) {
      const pastTime = new Date(now.getTime() - i * 8000);
      const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
      const sector = SECTORS[Math.floor(Math.random() * SECTORS.length)];
      const ring = Math.floor(Math.random() * 4) + 1;
      const name = ASTEROID_NAMES[Math.floor(Math.random() * ASTEROID_NAMES.length)];
      
      let message = "Telemetry scanning online.";
      let type: any = "info";
      
      if (i === 8) {
        message = "ASTROHEDGE Telemetry Core initializing...";
        type = "info";
      } else if (i === 7) {
        message = `Establishing link to satellite receivers in Sector ${sector}.`;
        type = "info";
      } else if (i === 6) {
        message = "Websocket server connection listening on ws://localhost:8080/feed";
        type = "warning";
      } else if (i === 5) {
        message = `Autonomous search agents deployed. Monitoring 5 concentric rings.`;
        type = "success";
      } else {
        const randMsg = MOCK_MESSAGES[i % MOCK_MESSAGES.length];
        type = randMsg.type;
        message = randMsg.message
          .replace("{sector}", sector)
          .replace("{ring}", ring.toString())
          .replace("{name}", name)
          .replace("{drone}", `AH-D${Math.floor(Math.random() * 9) + 1}`)
          .replace("{composition}", "84% basalt, 12% iron, 4% silicates")
          .replace("{coords}", `X:+${(Math.random() * 2).toFixed(4)} Y:-1.2000 Z:${(Math.random() * 5).toFixed(4)}`);
      }

      initialLogs.push({
        id: `init-${i}`,
        timestamp: formatTelemetryTime(pastTime),
        type,
        agentId: agent,
        message,
      });
    }
    
    setLogs(initialLogs);
  }, []);

  // Connect to actual WS server if provided, otherwise simulate
  useEffect(() => {
    if (url) {
      try {
        const socket = new WebSocket(url);
        socketRef.current = socket;

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const newEntry: LogEntry = {
              id: Math.random().toString(36).substr(2, 9),
              timestamp: formatTelemetryTime(new Date()),
              type: data.type || "info",
              agentId: data.agentId || AGENTS[0],
              message: data.message || "",
              meta: data.meta || null
            };
            setLogs((prev) => [...prev.slice(-49), newEntry]); // Keep last 50 logs
          } catch (e) {
            console.error("Failed to parse WebSocket event:", e);
          }
        };

        socket.onerror = (err) => {
          console.warn("WebSocket experienced error, falling back to dynamic simulated telemetry.", err);
        };

        return () => {
          socket.close();
        };
      } catch (err) {
        console.warn("WebSocket connection failed, starting dynamic simulated telemetry.", err);
      }
    }

    // Dynamic telemetry generator (runs when no websocket is active)
    const interval = setInterval(() => {
      const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
      const sector = SECTORS[Math.floor(Math.random() * SECTORS.length)];
      const ring = Math.floor(Math.random() * 4) + 1;
      const name = ASTEROID_NAMES[Math.floor(Math.random() * ASTEROID_NAMES.length)];
      const randMsg = MOCK_MESSAGES[Math.floor(Math.random() * MOCK_MESSAGES.length)];
      
      const compVal = `${(80 + Math.random() * 15).toFixed(1)}% basalt, ${(2 + Math.random() * 8).toFixed(1)}% magnetite, ${(0.1 + Math.random() * 1.5).toFixed(2)}% platinum group metals`;
      const coordsVal = `X:+${(Math.random() * 4 - 2).toFixed(4)} Y:-1.2000 Z:${(Math.random() * 6 - 3).toFixed(4)}`;
      
      const formattedMessage = randMsg.message
        .replace("{sector}", sector)
        .replace("{ring}", ring.toString())
        .replace("{name}", name)
        .replace("{drone}", `AH-D${Math.floor(Math.random() * 9) + 1}`)
        .replace("{composition}", compVal)
        .replace("{coords}", coordsVal);

      const newLog: LogEntry = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: formatTelemetryTime(new Date()),
        type: randMsg.type as any,
        agentId: agent,
        message: formattedMessage,
      };

      setLogs((prev) => [...prev.slice(-49), newLog]);
    }, 4500); // New telemetry log every 4.5 seconds

    return () => clearInterval(interval);
  }, [url]);

  const addManualLog = (message: string, type: LogEntry["type"] = "info", agentId: string = "USER") => {
    const newLog: LogEntry = {
      id: `manual-${Date.now()}`,
      timestamp: formatTelemetryTime(new Date()),
      type,
      agentId,
      message,
    };
    setLogs((prev) => [...prev.slice(-49), newLog]);
  };

  return { logs, addManualLog };
}
export type UseWebSocketsReturn = ReturnType<typeof useWebSockets>;
