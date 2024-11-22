import type { RequestHandler } from '@sveltejs/kit';
import ChimeAttendeeManager from '$lib/ChimeAttendeeManager';
import type { MeetingStatus } from '$lib/types';

export const GET: RequestHandler = async () => {
    const status: { [meetingId: string]: MeetingStatus } = ChimeAttendeeManager.getMeetingStatus();

    return new Response(JSON.stringify(status), {
        headers: { 'Content-Type': 'application/json' },
    });
};