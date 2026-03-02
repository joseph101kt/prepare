'use client';

import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import { useEffect, useState } from 'react';
import '@livekit/components-styles';
import { getLiveKitToken } from '@/lib/livekit/token_generator';

export default function VideoStreamingComponent() {
  const [token, setToken] = useState("");

  useEffect(() => {
    // For testing, we just hardcode a room and a random name
    const name = "User_" + Math.floor(Math.random() * 100);
    getLiveKitToken("my-test-room", name).then(setToken);
  }, []);

  if (token === "") return <div>Generating token...</div>;

  return (
    <div className="h-screen">
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
        data-lk-theme="default"
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}