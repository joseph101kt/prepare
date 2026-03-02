'use client';

import { 
  LiveKitRoom, 
  VideoTrack, 
  useTracks, 
  DisconnectButton,
  useLocalParticipant,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useEffect, useState } from 'react';
import '@livekit/components-styles';
import { getLiveKitToken } from '@/lib/livekit/token_generator';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

export default function VideoStreamingComponent() {
  const [token, setToken] = useState("");

  useEffect(() => {
    const name = "User_" + Math.floor(Math.random() * 100);
    getLiveKitToken("my-test-room", name).then(setToken);
  }, []);

  if (token === "") return (
    <div className="flex h-screen items-center justify-center bg-neutral-900 text-white font-sans">
      <div className="animate-pulse">Generating token...</div>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative font-sans text-white">
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
        data-lk-theme="default"
      >
        <DuoLayout />
      </LiveKitRoom>
    </div>
  );
}

function DuoLayout() {
  // 1. Get tracks and local participant state
  const tracks = useTracks([Track.Source.Camera]);
  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } = useLocalParticipant();

  // 2. Identify participants
  const remoteTrack = tracks.find((t) => !t.participant.isLocal);
  const localTrack = tracks.find((t) => t.participant.isLocal);

  return (
    <div className="relative h-full w-full flex items-center justify-center">
      
      {/* --- BACKGROUND: Remote Participant --- */}
      <div className="absolute inset-0 z-0 bg-neutral-800">
        {remoteTrack ? (
          <VideoTrack 
            trackRef={remoteTrack} 
            className="h-full w-full object-cover" 
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-neutral-400 gap-4">
             <div className="w-20 h-20 rounded-full bg-neutral-700 animate-pulse" />
             <p className="text-sm font-medium">Waiting for partner...</p>
          </div>
        )}
      </div>

      {/* --- PIP: Local Participant (You) --- */}
      <div className="absolute top-6 right-6 w-32 h-44 md:w-48 md:h-64 rounded-2xl overflow-hidden shadow-2xl border border-white/10 z-20 bg-neutral-900">
        {localTrack && isCameraEnabled ? (
          <VideoTrack 
            trackRef={localTrack} 
            className="h-full w-full object-cover scale-x-[-1]" 
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-neutral-800 text-neutral-600">
            <VideoOff size={32} />
          </div>
        )}
      </div>

      {/* --- CONTROLS --- */}
      <div className="absolute bottom-10 z-30 flex items-center gap-4 md:gap-6 px-6 py-3 bg-neutral-900/90 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl">
        
        {/* Toggle Mic */}
        <div className="relative">
          <button 
            onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
            className={`p-3 rounded-full transition-all ${!isMicrophoneEnabled ? 'bg-red-500 text-white' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}
          >
            {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          
          {/* Simple Manual Mute Label */}
          {!isMicrophoneEnabled && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-red-500 text-[10px] px-2 py-1 rounded uppercase font-bold tracking-wider shadow-lg">
              Muted
            </div>
          )}
        </div>

        {/* Toggle Camera */}
        <button 
          onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
          className={`p-3 rounded-full transition-all ${!isCameraEnabled ? 'bg-red-500 text-white' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}
        >
          {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        <div className="w-px h-6 bg-white/10 mx-1" />
        
        {/* Leave Call */}
        <DisconnectButton className="bg-red-500 hover:bg-red-600 p-3 rounded-full transition-colors flex items-center justify-center">
          <PhoneOff size={24} className="text-white fill-current" />
        </DisconnectButton>
      </div>

    </div>
  );
}