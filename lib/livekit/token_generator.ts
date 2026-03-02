'use server';

import { AccessToken } from 'livekit-server-sdk';

export async function getLiveKitToken(room: string, username: string) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  const at = new AccessToken(apiKey, apiSecret, {
    identity: username,
  });

  at.addGrant({ 
    roomJoin: true, 
    room: room, 
    canPublish: true, 
    canSubscribe: true 
  });

  return await at.toJwt();
}