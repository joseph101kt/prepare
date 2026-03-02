'use client';

import { 
  LiveKitRoom, 
  VideoTrack, 
  useTracks, 
  DisconnectButton,
  useLocalParticipant,
  RoomAudioRenderer,
  isTrackReference,
  useRoomContext, // ← NEW: lets us inspect the Room object directly
} from '@livekit/components-react';
import { Track, RoomEvent, ConnectionState } from 'livekit-client'; // ← NEW: RoomEvent, ConnectionState
import { useEffect, useState } from 'react';
import '@livekit/components-styles';
import { getLiveKitToken } from '@/lib/livekit/token_generator';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

// ─── DEBUG HELPER ─────────────────────────────────────────────────────────────
const DEBUG = true;

function log(area: string, msg: string, data?: unknown) {
  if (!DEBUG) return;
  const style = {
    '[TOKEN]':      'color:#facc15;font-weight:bold',
    '[ROOM]':       'color:#34d399;font-weight:bold',
    '[CONN]':       'color:#2dd4bf;font-weight:bold',
    '[TRACKS]':     'color:#60a5fa;font-weight:bold',
    '[LOCAL]':      'color:#f472b6;font-weight:bold',
    '[REMOTE]':     'color:#a78bfa;font-weight:bold',
    '[CONTROLS]':   'color:#fb923c;font-weight:bold',
    '[PERMS]':      'color:#86efac;font-weight:bold',
    '[RENDER]':     'color:#94a3b8;font-weight:bold',
    '[ERROR]':      'color:#f87171;font-weight:bold',
  }[area] ?? 'color:#e2e8f0';
  if (data !== undefined) {
    console.log(`%c${area}%c ${msg}`, style, 'color:inherit', data);
  } else {
    console.log(`%c${area}%c ${msg}`, style, 'color:inherit');
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// NEW: Check camera/mic permissions before even trying to connect
async function checkPermissions() {
  log('[PERMS]', 'Checking camera and microphone permissions...');
  try {
    const camPerm = await navigator.permissions.query({ name: 'camera' as PermissionName });
    const micPerm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    log('[PERMS]', `Camera permission: ${camPerm.state} | Microphone permission: ${micPerm.state}`);
    if (camPerm.state === 'denied') log('[ERROR]', '🚫 Camera permission is DENIED — browser is blocking camera access');
    if (micPerm.state === 'denied') log('[ERROR]', '🚫 Microphone permission is DENIED — browser is blocking mic access');
    if (camPerm.state === 'prompt') log('[PERMS]', '⚠️ Camera permission not yet granted — browser will prompt user');
    if (micPerm.state === 'prompt') log('[PERMS]', '⚠️ Microphone permission not yet granted — browser will prompt user');
  } catch (err) {
    log('[PERMS]', '⚠️ navigator.permissions.query not supported in this browser', err);
  }

  // Also try actually requesting the stream to force the browser prompt
  log('[PERMS]', 'Attempting getUserMedia to verify device access...');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    log('[PERMS]', `✅ getUserMedia succeeded — tracks: ${stream.getTracks().map(t => t.kind + '/' + t.readyState).join(', ')}`);
    // Stop the test stream immediately so LiveKit can use the devices
    stream.getTracks().forEach(t => { t.stop(); });
    log('[PERMS]', '🛑 Test stream stopped (LiveKit will create its own)');
  } catch (err: unknown) {
    if (err instanceof Error) {
      log('[ERROR]', `❌ getUserMedia FAILED: ${err.name} — ${err.message}`);
      if (err.name === 'NotAllowedError')    log('[ERROR]', '→ User denied permission or no permission prompt appeared');
      if (err.name === 'NotFoundError')      log('[ERROR]', '→ No camera/mic device found on this machine');
      if (err.name === 'NotReadableError')   log('[ERROR]', '→ Device is already in use by another app');
      if (err.name === 'OverconstrainedError') log('[ERROR]', '→ Constraints could not be satisfied by any device');
    } else {
      log('[ERROR]', '❌ getUserMedia threw unknown error', err);
    }
  }
}

export default function VideoStreamingComponent() {
  const [token, setToken] = useState("");
  const [tokenError, setTokenError] = useState(false);

  log('[RENDER]', 'VideoStreamingComponent rendered', {
    token: token ? '✅ present' : '❌ empty',
    tokenError,
  });

  useEffect(() => {
    // Run permission check on mount
    checkPermissions();

    const name = "User_" + Math.floor(Math.random() * 100);
    log('[TOKEN]', `Requesting token for room: my-test-room, participant: ${name}`);
    log('[TOKEN]', `LiveKit server URL: ${process.env.NEXT_PUBLIC_LIVEKIT_URL ?? '⚠️ UNDEFINED — check .env'}`);

    getLiveKitToken("my-test-room", name)
      .then((t) => {
        log('[TOKEN]', '✅ Token received', { length: t.length, preview: t.slice(0, 40) + '...' });
        setToken(t);
      })
      .catch((err) => {
        log('[ERROR]', '❌ Token fetch failed', err);
        setTokenError(true);
      });
  }, []);

  if (tokenError) return (
    <div className="flex h-screen items-center justify-center bg-neutral-900 text-white font-sans">
      <div className="text-lg font-medium text-red-400">Failed to connect. Please try again.</div>
    </div>
  );

  if (token === "") return (
    <div className="flex h-screen items-center justify-center bg-neutral-900 text-white font-sans">
      <div className="animate-pulse text-lg font-medium">Connecting...</div>
    </div>
  );

  log('[ROOM]', '🚀 Rendering LiveKitRoom with token');
  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative font-sans text-white">
      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL!}
        data-lk-theme="default"
        onConnected={() => log('[ROOM]', '✅ onConnected fired — room is fully connected')}
        onDisconnected={() => log('[ROOM]', '🔌 onDisconnected fired')}
        onError={(err) => log('[ERROR]', '❌ LiveKitRoom onError', err)}
      >
        {/* NEW: Inner component that directly watches the Room object */}
        <RoomDiagnostics />
        <DuoLayout />
      </LiveKitRoom>
    </div>
  );
}

// ─── NEW: Watches Room-level events directly ──────────────────────────────────
function RoomDiagnostics() {
  const room = useRoomContext();

useEffect(() => {
  if (!room) return;

  const isConnected = room.state === ConnectionState.Connected;

const sidValue = ('sid' in room) ? room.sid : 'pending';

log('[CONN]', `Room object available`, {
  sid: sidValue,
  name: room.name,
});

    const onStateChanged = (state: ConnectionState) => {
      log('[CONN]', `🔄 Connection state changed → ${state}`, {
        roomName: room.name,
        numParticipants: room.numParticipants,
      });
    };

    const onParticipantConnected = (p: { identity: string; sid: string }) => {
      log('[REMOTE]', `🙋 Remote participant joined: ${p.identity} (sid: ${p.sid})`);
    };

    const onParticipantDisconnected = (p: { identity: string }) => {
      log('[REMOTE]', `👋 Remote participant left: ${p.identity}`);
    };

    const onLocalTrackPublished = (pub: { trackSid: string; kind: string }) => {
      log('[LOCAL]', `📤 Local track published: kind=${pub.kind}, sid=${pub.trackSid}`);
    };

    const onLocalTrackUnpublished = (pub: { trackSid: string; kind: string }) => {
      log('[LOCAL]', `📤 Local track UNpublished: kind=${pub.kind}, sid=${pub.trackSid}`);
    };

    const onTrackSubscribed = (
      _track: unknown,
      pub: { trackSid: string; kind: string },
      participant: { identity: string }
    ) => {
      log('[REMOTE]', `📥 Subscribed to remote track: kind=${pub.kind}, participant=${participant.identity}`);
    };

    const onMediaDevicesError = (err: Error) => {
      log('[ERROR]', `❌ Media device error: ${err.name} — ${err.message}`);
      if (err.name === 'NotAllowedError')  log('[ERROR]', '→ Camera or mic permission was DENIED');
      if (err.name === 'NotFoundError')    log('[ERROR]', '→ No camera/mic device found');
      if (err.name === 'NotReadableError') log('[ERROR]', '→ Camera/mic already in use by another app');
    };

    room.on(RoomEvent.ConnectionStateChanged, onStateChanged);
    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);

    return () => {
      room.off(RoomEvent.ConnectionStateChanged, onStateChanged);
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.LocalTrackPublished, onLocalTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, onLocalTrackUnpublished);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
    };
  }, [room, room.state]);

  return null; // renders nothing, just observes
}
// ─────────────────────────────────────────────────────────────────────────────

function DuoLayout() {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: false },
  ]);

  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } = useLocalParticipant();

  log('[TRACKS]', `useTracks returned ${tracks.length} track(s)`, tracks.map((t) => ({
    source: t.source,
    participantIdentity: t.participant.identity,
    isLocal: t.participant.isLocal,
    isTrackReference: isTrackReference(t),
    trackSid: isTrackReference(t) ? t.publication.trackSid : 'N/A',
    isMuted: isTrackReference(t) ? t.publication.isMuted : 'N/A',
    isSubscribed: isTrackReference(t) ? t.publication.isSubscribed : 'N/A',
  })));

  const remoteVideoTrack = tracks.find(
    (t) => t.source === Track.Source.Camera && !t.participant.isLocal && isTrackReference(t)
  );
  const localVideoTrack = tracks.find(
    (t) => t.source === Track.Source.Camera && t.participant.isLocal && isTrackReference(t)
  );

  log('[LOCAL]', 'Local participant state', {
    identity: localParticipant?.identity ?? '⚠️ undefined',
    sid: localParticipant?.sid ?? '⚠️ undefined',
    isMicrophoneEnabled,
    isCameraEnabled,
    localVideoTrackFound: !!localVideoTrack,
  });

  log('[REMOTE]', 'Remote video track state', {
    found: !!remoteVideoTrack,
    identity: remoteVideoTrack?.participant?.identity ?? '⚠️ no remote participant yet',
  });

  return (
    <div className="relative h-full w-full flex items-center justify-center">
      <RoomAudioRenderer      />

      {/* --- BACKGROUND: Remote Participant --- */}
      <div className="absolute inset-0 z-0 bg-neutral-800">
        {remoteVideoTrack && isTrackReference(remoteVideoTrack) ? (
          <>
            {log('[REMOTE]', '🎥 Rendering remote VideoTrack')}
            <VideoTrack
              trackRef={remoteVideoTrack}
              className="h-full w-full object-cover"
              onSubscriptionStatusChanged={(s) => log('[REMOTE]', `📡 Remote subscription → ${s}`)}
            />
          </>
        ) : (
          <>
            {log('[REMOTE]', '🕳️ No remote track — showing placeholder')}
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
              onSubscriptionStatusChanged={(s) => log('[LOCAL]', `📡 Local track subscription → ${s}`)}
            />
          </>
        ) : (
          <>
            {log('[LOCAL]', '📷 No local track — showing VideoOff', { isCameraEnabled })}
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
            log('[CONTROLS]', `🎙️ Mic toggle: ${isMicrophoneEnabled} → ${next}`);
            localParticipant
              .setMicrophoneEnabled(next)
              .then(() => log('[CONTROLS]', `✅ Mic now ${next ? 'ENABLED' : 'DISABLED'}`))
              .catch((err: unknown) => log('[ERROR]', '❌ setMicrophoneEnabled failed', err));
          }}
          className={`p-3 rounded-full transition-all duration-200 ${!isMicrophoneEnabled ? 'bg-red-500 text-white' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}
        >
          {isMicrophoneEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        <button
          onClick={() => {
            const next = !isCameraEnabled;
            log('[CONTROLS]', `📷 Camera toggle: ${isCameraEnabled} → ${next}`);
            localParticipant
              .setCameraEnabled(next)
              .then(() => log('[CONTROLS]', `✅ Camera now ${next ? 'ENABLED' : 'DISABLED'}`))
              .catch((err: unknown) => log('[ERROR]', '❌ setCameraEnabled failed', err));
          }}
          className={`p-3 rounded-full transition-all duration-200 ${!isCameraEnabled ? 'bg-red-500 text-white' : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'}`}
        >
          {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        <div className="w-px h-6 bg-white/10 mx-1" />

        <DisconnectButton
          onClick={() => log('[CONTROLS]', '📴 Disconnect clicked')}
          className="bg-red-600 hover:bg-red-700 p-3 rounded-full transition-colors flex items-center justify-center shadow-lg"
        >
          <PhoneOff size={24} className="text-white fill-current" />
        </DisconnectButton>
      </div>
    </div>
  );
}