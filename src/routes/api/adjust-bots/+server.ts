import type { RequestHandler } from '@sveltejs/kit';
import ChimeAttendeeManager from '$lib/ChimeAttendeeManager';

export const POST: RequestHandler = async ({ request }) => {
  const { meetingId, desiredVideoBots, desiredNoneVideoBots } = await request.json();

  if (!meetingId || desiredVideoBots === undefined || desiredNoneVideoBots === undefined) {
    return new Response(JSON.stringify({ error: 'Invalid parameters' }), { status: 400 });
  }

  await ChimeAttendeeManager.adjustBots(meetingId, desiredVideoBots, desiredNoneVideoBots);

  return new Response(JSON.stringify({ message: 'Bots adjusted successfully' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
