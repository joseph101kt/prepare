'use client';

import { 
  LiveKitRoom, 
  VideoTrack, 
  useTracks, 
  DisconnectButton,
  useLocalParticipant,
  RoomAudioRenderer,
  isTrackReference,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useEffect, useState } from 'react';
import '@livekit/components-styles';
import { getLiveKitToken } from '@/lib/livekit/token_generator';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

// ─── DEBUG HELPER ─────────────────────────────────────────────────────────────
const DEBUG = true; // Set to false to silence all logs in production

function log(area: string, msg: string, data?: unknown) {
  if (!DEBUG) return;
  const style = {
    '[TOKEN]':    'color:#facc15;font-weight:bold',
    '[ROOM]':     'color:#34d399;font-weight:bold',
    '[TRACKS]':   'color:#60a5fa;font-weight:bold',
    '[LOCAL]':    'color:#f472b6;font-weight:bold',
    '[REMOTE]':   'color:#a78bfa;font-weight:bold',
    '[CONTROLS]': 'color:#fb923c;font-weight:bold',
    '[RENDER]':   'color:#94a3b8;font-weight:bold',
    '[ERROR]':    'color:#f87171;font-weight:bold',
  }[area] ?? 'color:#e2e8f0';

  if (data !== undefined) {
    console.log(`%c${area}%c ${msg}`, style, 'color:inherit', data);
  } else {
    console.log(`%c${area}%c ${msg}`, style, 'color:inherit');
  }
}
// ─────────────────────────────────────────────────────────────────────────────

export default function VideoStreamingComponent() {
  const [token, setToken] = useState("");
  const [tokenError, setTokenError] = useState(false);

  log('[RENDER]', 'VideoStreamingComponent rendered', {
    token: token ? '✅ present' : '❌ empty',
    tokenError,
  });

  useEffect(() => {
    const name = "User_" + Math.floor(Math.random() * 100);
    log('[TOKEN]', `Requesting token for room: my-test-room, participant: ${name}`);
    log('[TOKEN]', `LiveKit server URL from env: ${process.env.NEXT_PUBLIC_LIVEKIT_URL ?? '⚠️ UNDEFINED — check your .env file'}`);

    getLiveKitToken("my-test-room", name)
      .then((t) => {
        log('[TOKEN]', '✅ Token received successfully', {
          length: t.length,
          preview: t.slice(0, 40) + '...',
        });
        setToken(t);
      })
      .catch((err) => {
        log('[ERROR]', '❌ Token fetch failed', err);
        setTokenError(true);
      });
  }, []);

  if (tokenError) {
    log('[ERROR]', '⛔ Rendering error state — token fetch failed');
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-900 text-white font-sans">
        <div className="text-lg font-medium text-red-400">Failed to connect. Please try again.</div>
      </div>
    );
  }

  if (token === "") {
    log('[TOKEN]', '⏳ Token not yet received — showing loading state');
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-900 text-white font-sans">
        <div className="animate-pulse text-lg font-medium">Connecting...</div>
      </div>
    );
  }

  log('[ROOM]', '🚀 Rendering LiveKitRoom with token');
  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative font-sans text-white">
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL!}
        data-lk-theme="default"
        onConnected={() => log('[ROOM]', '✅ Room connected!')}
        onDisconnected={() => log('[ROOM]', '🔌 Room disconnected')}
        onError={(err) => log('[ERROR]', '❌ LiveKitRoom error', err)}
      >
        <DuoLayout />
      </LiveKitRoom>
    </div>
  );
}

function DuoLayout() {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: false },
  ]);

  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } = useLocalParticipant();

  // ── Track diagnostics ────────────────────────────────────────────────────
  log('[TRACKS]', `useTracks returned ${tracks.length} track(s)`, tracks.map((t) => ({
    source: t.source,
    participantIdentity: t.participant.identity,
    isLocal: t.participant.isLocal,
    isTrackReference: isTrackReference(t),
    trackSid: isTrackReference(t) ? t.publication.trackSid : 'N/A (not a TrackReference)',
    isMuted: isTrackReference(t) ? t.publication.isMuted : 'N/A',
    isSubscribed: isTrackReference(t) ? t.publication.isSubscribed : 'N/A',
  })));

  const remoteVideoTrack = tracks.find(
    (t) => t.source === Track.Source.Camera && !t.participant.isLocal && isTrackReference(t)
  );

  const localVideoTrack = tracks.find(
    (t) => t.source === Track.Source.Camera && t.participant.isLocal && isTrackReference(t)
  );

  // ── Local participant diagnostics ────────────────────────────────────────
  log('[LOCAL]', 'Local participant state', {
    identity: localParticipant?.identity ?? '⚠️ undefined',
    sid: localParticipant?.sid ?? '⚠️ undefined',
    isMicrophoneEnabled,
    isCameraEnabled,
    localVideoTrackFound: !!localVideoTrack,
    localVideoIsTrackRef: localVideoTrack ? isTrackReference(localVideoTrack) : false,
  });

  // ── Remote participant diagnostics ───────────────────────────────────────
  log('[REMOTE]', 'Remote video track state', {
    found: !!remoteVideoTrack,
    isTrackRef: remoteVideoTrack ? isTrackReference(remoteVideoTrack) : false,
    remoteIdentity: remoteVideoTrack?.participant?.identity ?? '⚠️ no remote participant yet',
    trackSid: remoteVideoTrack && isTrackReference(remoteVideoTrack)
      ? remoteVideoTrack.publication.trackSid
      : 'N/A',
  });

  return (
    <div className="relative h-full w-full flex items-center justify-center">
      <RoomAudioRenderer
      />

      {/* --- BACKGROUND: Remote Participant --- */}
      <div className="absolute inset-0 z-0 bg-neutral-800">
        {remoteVideoTrack && isTrackReference(remoteVideoTrack) ? (
          <>
            {log('[REMOTE]', '🎥 Rendering remote VideoTrack component')}
            <VideoTrack
              trackRef={remoteVideoTrack}
              className="h-full w-full object-cover"
              onSubscriptionStatusChanged={(status) =>
                log('[REMOTE]', `📡 Remote track subscription changed → ${status}`)
              }
            />
          </>
        ) : (
          <>
            {log('[REMOTE]', '🕳️ No remote track found — showing "Waiting for partner" placeholder')}
            <div className="flex h-full flex-col items-center justify-center text-neutral-500 gap-4">
              <div className="w-24 h-24 rounded-full bg-neutral-700 animate-pulse flex items-center justify-center">
                <Video size={40} className="text-neutral-600" />
              </div>
              <p className="text-sm font-medium tracking-wide uppercase">Waiting for partner...</p>
            </div>
          </>
        )}
      </div>

      {/* --- PIP: Local Participant (You) --- */}
      <div className="absolute top-6 right-6 w-32 h-44 md:w-48 md:h-64 rounded-2xl overflow-hidden shadow-2xl border border-white/10 z-20 bg-neutral-900">
        {localVideoTrack && isTrackReference(localVideoTrack) ? (
          <>
            {log('[LOCAL]', '🎥 Rendering local VideoTrack (PiP)')}
            <VideoTrack
              trackRef={localVideoTrack}
              className="h-full w-full object-cover scale-x-[-1]"
              onSubscriptionStatusChanged={(status) =>
                log('[LOCAL]', `📡 Local track subscription changed → ${status}`)
              }
            />
          </>
        ) : (
          <>
            {log('[LOCAL]', `📷 No local video track — showing VideoOff icon`, {
              isCameraEnabled,
              localVideoTrackFound: !!localVideoTrack,
            })}
            <div className="h-full w-full flex items-center justify-center bg-neutral-800 text-neutral-600">
              <VideoOff size={32} />
            </div>
          </>
        )}
      </div>

      {/* --- CONTROLS --- */}
      <div className="absolute bottom-10 z-30 flex items-center gap-4 md:gap-6 px-6 py-3 bg-neutral-900/90 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl">

        <button
          onClick={() => {
            const next = !isMicrophoneEnabled;
            log('[CONTROLS]', `🎙️ Mic toggle clicked: ${isMicrophoneEnabled} → ${next}`);
            localParticipant
              .setMicrophoneEnabled(next)
              .then(() => log('[CONTROLS]', `✅ Microphone is now ${next ? 'ENABLED' : 'DISABLED'}`))
              .catch((err: unknown) => log('[ERROR]', '❌ setMicrophoneEnabled() failed', err));
          }}
          className={`p-3 rounded-full transition-all duration-200 ${
            !isMicrophoneEnabled
              ? 'bg-red-500 text-white'
              : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
          }`}
        >
          {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        <button
          onClick={() => {
            const next = !isCameraEnabled;
            log('[CONTROLS]', `📷 Camera toggle clicked: ${isCameraEnabled} → ${next}`);
            localParticipant
              .setCameraEnabled(next)
              .then(() => log('[CONTROLS]', `✅ Camera is now ${next ? 'ENABLED' : 'DISABLED'}`))
              .catch((err: unknown) => log('[ERROR]', '❌ setCameraEnabled() failed', err));
          }}
          className={`p-3 rounded-full transition-all duration-200 ${
            !isCameraEnabled
              ? 'bg-red-500 text-white'
              : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
          }`}
        >
          {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        <div className="w-px h-6 bg-white/10 mx-1" />

        <DisconnectButton
          onClick={() => log('[CONTROLS]', '📴 Disconnect button clicked — leaving room')}
          className="bg-red-600 hover:bg-red-700 p-3 rounded-full transition-colors flex items-center justify-center shadow-lg"
        >
          <PhoneOff size={24} className="text-white fill-current" />
        </DisconnectButton>
      </div>
    </div>
  );
}