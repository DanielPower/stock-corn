import { DATABASE_PATH } from '$lib/server/env';
import type { RequestHandler } from '@sveltejs/kit';
import { createReadStream, existsSync, statSync } from 'node:fs';

export const GET: RequestHandler = async () => {
    // Check if DATABASE_PATH is configured
    if (!DATABASE_PATH) {
        console.error('Database path not configured');
        return new Response('Database path not configured', { status: 500 });
    }

    // Check if database file exists
    if (!existsSync(DATABASE_PATH)) {
        console.error('Database file not found');
        return new Response('Database file not found', { status: 404 });
    }

    try {
        // Get database file stats for Content-Length
        const stat = statSync(DATABASE_PATH);
        const fileStream = createReadStream(DATABASE_PATH);

        // Make stream web-compatible
        const stream = fileStream as unknown as ReadableStream;

        // Return the database file as a stream with appropriate headers
        return new Response(stream, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': 'attachment; filename="stock-corn.db"',
                'Content-Length': stat.size.toString(),
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    } catch (err) {
        console.error('Error serving database file:', err);
        return new Response('Failed to serve database file', { status: 500 });
    }
};
