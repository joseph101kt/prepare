'use client';

import { 
  LiveKitRoom, 
  VideoTrack, 
  useTracks, 
  DisconnectButton,
  useLocalParticipant,
  AudioConference,
  isTrackReference, // Crucial for type guarding
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
      <div className="animate-pulse text-lg font-medium">Connecting...</div>
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
  // 1. FIX: Added 'withPlaceholder' to satisfy TrackSourceWithOptions
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: false },
    { source: Track.Source.Microphone, withPlaceholder: false },
  ]);
  
  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } = useLocalParticipant();

  // 2. FIX: Use isTrackReference to narrow the type and strip away 'Placeholder'
  // This satisfies the VideoTrack 'trackRef' requirement
  const remoteVideoTrack = tracks.find(
    (t) => t.source === Track.Source.Camera && !t.participant.isLocal && isTrackReference(t)
  );
  
  const localVideoTrack = tracks.find(
    (t) => t.source === Track.Source.Camera && t.participant.isLocal && isTrackReference(t)
  );

  return (
    <div className="relative h-full w-full flex items-center justify-center">
      <AudioConference />
      
      {/* --- BACKGROUND: Remote Participant --- */}
      <div className="absolute inset-0 z-0 bg-neutral-800">
        {remoteVideoTrack && isTrackReference(remoteVideoTrack) ? (
          <VideoTrack 
            trackRef={remoteVideoTrack} 
            className="h-full w-full object-cover" 
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-neutral-500 gap-4">
             <div className="w-24 h-24 rounded-full bg-neutral-700 animate-pulse flex items-center justify-center">
                <Video size={40} className="text-neutral-600" />
             </div>
             <p className="text-sm font-medium tracking-wide uppercase">Waiting for partner...</p>
          </div>
        )}
      </div>

      {/* --- PIP: Local Participant (You) --- */}
      <div className="absolute top-6 right-6 w-32 h-44 md:w-48 md:h-64 rounded-2xl overflow-hidden shadow-2xl border border-white/10 z-20 bg-neutral-900">
        {localVideoTrack && isCameraEnabled && isTrackReference(localVideoTrack) ? (
          <VideoTrack 
            trackRef={localVideoTrack} 
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
        
        <button 
          onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          className={`p-3 rounded-full transition-all duration-200 ${!isMicrophoneEnabled ? 'bg-red-500 text-white' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}
        >
          {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        <button 
          onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
          className={`p-3 rounded-full transition-all duration-200 ${!isCameraEnabled ? 'bg-red-500 text-white' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}
        >
          {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        <div className="w-px h-6 bg-white/10 mx-1" />
        
        <DisconnectButton className="bg-red-600 hover:bg-red-700 p-3 rounded-full transition-colors flex items-center justify-center shadow-lg">
          <PhoneOff size={24} className="text-white fill-current" />
        </DisconnectButton>
      </div>
    </div>
  );
}