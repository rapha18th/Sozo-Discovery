import { NextRequest, NextResponse } from 'next/server';
import FirecrawlApp from '@mendable/firecrawl-js';
import { GoogleGenAI } from '@google/genai';

let firecrawl: FirecrawlApp | null = null;

function getFirecrawl() {
  if (!firecrawl) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      console.warn('FIRECRAWL_API_KEY is missing');
      return null;
    }
    firecrawl = new FirecrawlApp({ apiKey });
  }
  return firecrawl;
}

export async function POST(req: NextRequest) {
  try {
    const { queries, location } = await req.json();

    if (!queries || !Array.isArray(queries)) {
      return NextResponse.json({ error: 'QUERIES_REQUIRED' }, { status: 400 });
    }

    // Step 1: Firecrawl Search
    let searchResults: any[] = [];
    try {
      const fc = getFirecrawl();
      if (fc) {
        const searchPromises = queries.map((query: string) =>
          fc.search(query, { limit: 1 })
        );
        searchResults = await Promise.all(searchPromises);
      }
    } catch (e) {
      console.error('Firecrawl Error:', e);
    }

    const snippets = searchResults
      .map((res: any) => res.data?.[0]?.description || res.data?.[0]?.snippet || '')
      .filter(Boolean);
    
    const firecrawlContext = snippets.join(' · ').slice(0, 500);

    // Step 2: Use Gemini to extract structured sourcing info from snippets
    let bomDetails: any[] = [];
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '' });
      
      const extractionPrompt = `
        Based on these search results and the user's location (${location || 'Global'}), 
        extract the most likely sourcing location and expected price for each item.
        
        Items: ${queries.join(', ')}
        Search Context: ${firecrawlContext}
        
        Return ONLY valid JSON as an array of objects:
        [
          { "name": "item_name", "sourcing_location": "city, country", "expected_price": "$xx.xx" }
        ]
      `;

      const result = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: extractionPrompt,
      });
      
      const text = result.text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        bomDetails = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Gemini Extraction Error:', e);
      // Fallback to basic names if extraction fails
      bomDetails = queries.map(q => ({ name: q, sourcing_location: 'Unknown', expected_price: 'TBD' }));
    }

    return NextResponse.json({ 
      firecrawl_context: firecrawlContext,
      bom_details: bomDetails
    });

  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}
