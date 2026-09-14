"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

export interface ProjectActivity {
  projectId: string;
  type: string;
  payload: unknown;
}

/**
 * Joins the project's Socket.io room and calls `onActivity` for every
 * `project-activity` event the server broadcasts (currently: stage and
 * expense create/update/delete — see apps/api's ProjectsGateway).
 */
export function useProjectSocket(projectId: string, onActivity: (event: ProjectActivity) => void) {
  const onActivityRef = useRef(onActivity);
  onActivityRef.current = onActivity;

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;

    const socket: Socket = io(apiUrl, {
      // Called before every (re)connection attempt, not just the first —
      // fetches a fresh access token each time rather than capturing a
      // single one that would go stale after 15 minutes.
      auth: (cb) => {
        fetch("/api/auth/socket-token")
          .then((res) => res.json())
          .then((data) => cb({ token: data.token }))
          .catch(() => cb({}));
      },
    });

    socket.on("connect", () => {
      socket.emit("join-project", { projectId });
    });

    socket.on("project-activity", (event: ProjectActivity) => {
      onActivityRef.current(event);
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId]);
}
