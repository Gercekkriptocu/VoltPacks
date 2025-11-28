import { NextResponse } from "next/server";

export const runtime = "edge";

const customSecretMappings: Record<string, string> = {};

function createSecretMap(): Map<string, string> {
    const secretMap = new Map<string, string>();

    for (const [key, value] of Object.entries(customSecretMappings)) {
        secretMap.set(key, value);
    }

    return secretMap;
}

export async function GET(request: Request) {
    return handleRequest(request);
}

export async function POST(request: Request) {
    return handleRequest(request);
}

export async function PUT(request: Request) {
    return handleRequest(request);
}

export async function PATCH(request: Request) {
    return handleRequest(request);
}

export async function DELETE(request: Request) {
    return handleRequest(request);
}

async function handleRequest(request: Request) {
    let body;
    try {
        body = await request.json();
    } catch (error) {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const wordMap = createSecretMap();
    if (wordMap.size > 0) {
        body = replaceMaskedWordsWithSecrets(body, wordMap);
    }

    const { protocol, origin, path, method, headers, body: b } = body;

    if (!protocol || !origin || !path || !method || !headers) {
        return NextResponse.json({ error: "Missing required fields in request body" }, { status: 400 });
    }

    const fetchHeaders = new Headers(headers);
    const requestBody = typeof b === "string" ? b : JSON.stringify(b);

    try {
        const response = await fetch(`${protocol}://${origin}/${path.startsWith("/") ? path.slice(1) : path}`, {
            method,
            body: requestBody,
            headers: fetchHeaders,
        });

        const json = await response.json();
        return NextResponse.json(json);
    } catch (error) {
        if (error instanceof Error) {
            return NextResponse.json({ error: "Failed to fetch external API", details: error.message }, { status: 500 });
        } else {
            return NextResponse.json({ error: "Failed to fetch external API", details: "Unknown error" }, { status: 500 });
        }
    }
}

function replaceMaskedWordsWithSecrets(obj: any, wordMap: Map<string, string>): any {
    if (typeof obj === "string") {
        return replaceInString(obj, wordMap);
    } else if (Array.isArray(obj)) {
        return obj.map(item => replaceMaskedWordsWithSecrets(item, wordMap));
    } else if (typeof obj === "object" && obj !== null) {
        const newObj: any = {};
        for (const key in obj) {
            newObj[key] = replaceMaskedWordsWithSecrets(obj[key], wordMap);
        }
        return newObj;
    }
    return obj;
}

function replaceInString(str: string, wordMap: Map<string, string>): string {
    for (const [word, replacement] of Array.from(wordMap.entries())) {
        const regex = new RegExp(`\\b${word}\\b`, "gi");
        str = str.replace(regex, replacement);
    }
    return str;
}
