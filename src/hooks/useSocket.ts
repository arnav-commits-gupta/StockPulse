import { useEffect, useRef, useCallback } from "react";
import io, { Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_BASE || "http://127.0.0.1:5001";

interface SocketHookOptions {
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
}

/**
 * React hook for Socket.IO connection to Flask backend
 * Provides real-time quote updates, chart ticks, and other events
 */
export function useSocket(options: SocketHookOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);

  // Initialize socket connection
  useEffect(() => {
    if (socketRef.current) return; // Already connected

    const defaultOptions: SocketHookOptions = {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      ...options,
    };

    console.log(`[Socket] Connecting to ${SOCKET_URL}`);

    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: defaultOptions.reconnection,
      reconnectionDelay: defaultOptions.reconnectionDelay,
      reconnectionDelayMax: defaultOptions.reconnectionDelayMax,
      reconnectionAttempts: defaultOptions.reconnectionAttempts,
    });

    const socket = socketRef.current;

    // Connection events
    socket.on("connect", () => {
      console.log("[Socket] Connected to backend");
      isConnectedRef.current = true;
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      isConnectedRef.current = false;
    });

    socket.on("connect_error", (error) => {
      console.error("[Socket] Connection error:", error);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        isConnectedRef.current = false;
      }
    };
  }, []);

  /**
   * Subscribe to real-time quote updates for a symbol
   */
  const subscribeQuote = useCallback(
    (symbol: string, callback: (data: any) => void) => {
      if (!socketRef.current || !isConnectedRef.current) {
        console.warn(
          `[Socket] Not connected. Cannot subscribe to ${symbol} quotes`
        );
        return () => {};
      }

      console.log(`[Socket] Subscribing to quote updates: ${symbol}`);
      socketRef.current.emit("subscribe", { symbol });
      socketRef.current.on("quote_update", callback);
      socketRef.current.on("quote_error", (error) => {
        console.error(`[Socket] Quote error for ${symbol}:`, error);
      });

      // Return unsubscribe function
      return () => {
        console.log(`[Socket] Unsubscribing from quote updates: ${symbol}`);
        socketRef.current?.emit("unsubscribe", { symbol });
        socketRef.current?.off("quote_update", callback);
      };
    },
    []
  );

  /**
   * Subscribe to real-time chart tick updates
   */
  const subscribeChart = useCallback(
    (symbol: string, callback: (data: any) => void) => {
      if (!socketRef.current || !isConnectedRef.current) {
        console.warn(
          `[Socket] Not connected. Cannot subscribe to ${symbol} chart updates`
        );
        return;
      }

      console.log(`[Socket] Subscribing to chart updates: ${symbol}`);
      socketRef.current.emit("subscribe_chart", { symbol });
      socketRef.current.on(`chart_tick:${symbol}`, callback);

      return () => {
        console.log(`[Socket] Unsubscribing from chart updates: ${symbol}`);
        socketRef.current?.emit("unsubscribe_chart", { symbol });
        socketRef.current?.off(`chart_tick:${symbol}`, callback);
      };
    },
    []
  );

  /**
   * Subscribe to multi-stock index updates
   */
  const subscribeIndex = useCallback((callback: (data: any) => void) => {
    if (!socketRef.current || !isConnectedRef.current) {
      console.warn("[Socket] Not connected. Cannot subscribe to index updates");
      return;
    }

    console.log("[Socket] Subscribing to index updates");
    socketRef.current.emit("subscribe_index");
    socketRef.current.on("index_update", callback);

    return () => {
      console.log("[Socket] Unsubscribing from index updates");
      socketRef.current?.emit("unsubscribe_index");
      socketRef.current?.off("index_update", callback);
    };
  }, []);

  /**
   * Emit custom events to backend
   */
  const emit = useCallback((event: string, data?: any) => {
    if (!socketRef.current || !isConnectedRef.current) {
      console.warn(`[Socket] Not connected. Cannot emit event: ${event}`);
      return;
    }
    socketRef.current.emit(event, data);
  }, []);

  /**
   * Listen for custom events from backend
   */
  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (!socketRef.current) {
      console.warn(`[Socket] Socket not initialized. Cannot listen to: ${event}`);
      return () => {};
    }
    socketRef.current.on(event, callback);
    return () => socketRef.current?.off(event, callback);
  }, []);

  return {
    socket: socketRef.current,
    isConnected: isConnectedRef.current,
    subscribeQuote,
    subscribeChart,
    subscribeIndex,
    emit,
    on,
  };
}

export default useSocket;
