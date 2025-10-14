import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';
import { GoogleGenAI } from '@google/genai';

let geminiKey = env.PUBLIC_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: geminiKey });

export const POST: RequestHandler = async ({ request }) => {
    const { posts } = await request.json();

    try {
        const result = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            config: {
                thinkingConfig: {
                    thinkingBudget: 0 // Disables thinking
                },
                systemInstruction:
                    'You are a summarizer that outputs only HTML fragments suitable for embedding inside an existing page container. Do not include html, head, body, style, or script tags. Do not include external links, tracking parameters, images, or inline styles. Use only h2, h3, p, b. Group local news by topic and locality, deduplicate near-duplicates, and produce concise summaries with neutral, factual phrasing. If paragraphs are longer break them up in pieces'
            },
            contents: [
                "generate a local news summary based on the rss data. Don't mention the source names. keep it concise within 200 words. Here's the data:",
                JSON.stringify(posts)
            ]
        });

        const stream = new ReadableStream({
            async start(controller) {
                for await (const chunk of result) {
                    const chunkText = chunk.text;
                    controller.enqueue(chunkText);
                }
                controller.close();
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain'
            }
        });
    } catch (e) {
        error(500, `Error summarising posts: ${e}`);
    }
};
