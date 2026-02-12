import { google } from 'googleapis';
import { Event } from '@/types';

export function getGoogleCalendarClient(accessToken: string) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: 'v3', auth });
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  event: Event
) {
  const calendar = getGoogleCalendarClient(accessToken);

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: {
        dateTime: event.start_time,
        timeZone: 'America/Rio_Branco',
      },
      end: {
        dateTime: event.end_time,
        timeZone: 'America/Rio_Branco',
      },
    },
  });

  return response.data.id;
}

export async function updateGoogleCalendarEvent(
  accessToken: string,
  googleEventId: string,
  event: Partial<Event>
) {
  const calendar = getGoogleCalendarClient(accessToken);

  await calendar.events.update({
    calendarId: 'primary',
    eventId: googleEventId,
    requestBody: {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: event.start_time
        ? { dateTime: event.start_time, timeZone: 'America/Rio_Branco' }
        : undefined,
      end: event.end_time
        ? { dateTime: event.end_time, timeZone: 'America/Rio_Branco' }
        : undefined,
    },
  });
}

export async function deleteGoogleCalendarEvent(
  accessToken: string,
  googleEventId: string
) {
  const calendar = getGoogleCalendarClient(accessToken);

  await calendar.events.delete({
    calendarId: 'primary',
    eventId: googleEventId,
  });
}

export async function listGoogleCalendarEvents(
  accessToken: string,
  timeMin?: string,
  timeMax?: string
) {
  const calendar = getGoogleCalendarClient(accessToken);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin || new Date().toISOString(),
    timeMax:
      timeMax ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
}
