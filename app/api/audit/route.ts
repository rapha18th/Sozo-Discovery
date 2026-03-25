import { NextRequest, NextResponse } from 'next/server';
import FirecrawlApp from '@mendable/firecrawl-js';
import { GoogleGenAI } from '@google/genai';

let firecrawl: any = null;

function getFirecrawl() {
  // Check multiple possible secret names for resilience
  const apiKey = process.env.FIRECRAWL_API_KEY || 
                 process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY || 
                 process.env.FIRECRAWL_API_KEY_SECRET;
  
  // Diagnostic: Log available environment keys (not values) to help debug missing secrets
  const envKeys = Object.keys(process.env).filter(k => k.toUpperCase().includes('FIRE') || k.toUpperCase().includes('CRAWL'));
  console.log('DEBUG: Firecrawl Initialization. Relevant env keys found:', envKeys);
  console.log('DEBUG: API Key resolved:', !!apiKey);
  
  if (!firecrawl) {
    if (!apiKey) {
      console.warn('FIRECRAWL_API_KEY is missing from environment.');
      return null;
    }
    try {
      // Use default import for @mendable/firecrawl-js v4+
      // @ts-ignore - Handling potential type mismatch in different SDK versions
      firecrawl = new (FirecrawlApp.default || FirecrawlApp)({ apiKey });
      console.log('DEBUG: FirecrawlApp instance created successfully');
    } catch (e) {
      console.error('DEBUG: Failed to create FirecrawlApp instance:', e);
      return null;
    }
  }
  return firecrawl;
}

export async function POST(req: NextRequest) {
  console.log('DEBUG: /api/audit POST request received');
  try {
    const body = await req.json();
    const { queries, location } = body;
    console.log('DEBUG: Request body:', { queriesCount: queries?.length, location });

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      console.warn('DEBUG: No queries provided or queries is not an array');
      return NextResponse.json({ 
        error: 'QUERIES_REQUIRED',
        details: 'The system failed to identify materials to search for.'
      }, { status: 400 });
    }

    // Step 1: Firecrawl Search with individual timeouts
    let searchResults: any[] = [];
    let firecrawlError: string | null = null;
    try {
      const fc = getFirecrawl();
      if (fc) {
        console.log(`DEBUG: Starting Firecrawl search for ${queries.length} queries`);
        const searchStartTime = Date.now();
        const searchPromises = queries.map((query: string) => {
          console.log(`DEBUG: Searching for: "${query}"`);
          // Using a slightly longer timeout for search
          const searchPromise = fc.search(query, { limit: 1 });
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`TIMEOUT_${query.slice(0, 10)}`)), 15000)
          );
          return Promise.race([searchPromise, timeoutPromise]);
        });
        
        const settledResults = await Promise.allSettled(searchPromises);
        const searchEndTime = Date.now();
        console.log(`DEBUG: All Firecrawl searches settled in ${searchEndTime - searchStartTime}ms`);
        
        settledResults.forEach((r, i) => {
          if (r.status === 'rejected') {
            console.error(`DEBUG: Query "${queries[i]}" failed:`, r.reason);
          } else {
            console.log(`DEBUG: Query "${queries[i]}" succeeded`);
          }
        });

        searchResults = settledResults
          .filter(r => r.status === 'fulfilled')
          .map(r => (r as PromiseFulfilledResult<any>).value);

        if (searchResults.length === 0) {
          const failures = settledResults.filter(r => r.status === 'rejected');
          if (failures.length > 0) {
            firecrawlError = (failures[0] as PromiseRejectedResult).reason?.message || 'SEARCH_FAILED';
          } else {
            firecrawlError = 'NO_RESULTS_FOUND';
          }
        }
      } else {
        console.error('DEBUG: Firecrawl client could not be initialized (likely missing API key)');
        firecrawlError = 'FIRECRAWL_API_KEY_MISSING';
      }
    } catch (e) {
      console.error('DEBUG: Unexpected Firecrawl Error:', e);
      firecrawlError = e instanceof Error ? e.message : 'UNKNOWN_SEARCH_ERROR';
    }

    const snippets = searchResults
      .map((res: any) => {
        // Handle both 'data' (v0/v1) and 'web' (v1 search) formats
        const items = res.data || res.web || [];
        const first = items[0] || {};
        return first.description || first.snippet || first.markdown || first.title || '';
      })
      .filter(Boolean);
    
    console.log(`DEBUG: Collected ${snippets.length} snippets`);
    const firecrawlContext = snippets.join(' · ').slice(0, 2000);

    // Step 2: Use Gemini to extract structured sourcing info from snippets
    let bomDetails: any[] = [];
    let extractionError: string | null = null;
    try {
      console.log('DEBUG: Starting Gemini extraction');
      // Prioritize user-provided GEMINI_KEY over reserved GEMINI_API_KEY
      const apiKey = process.env.GEMINI_KEY || 
                     process.env.NEXT_PUBLIC_GEMINI_KEY ||
                     process.env.GEMINI_API_KEY || 
                     process.env.NEXT_PUBLIC_GEMINI_API_KEY || 
                     '';
      
      const usedKeyName = process.env.GEMINI_KEY ? 'GEMINI_KEY' : 
                          process.env.NEXT_PUBLIC_GEMINI_KEY ? 'NEXT_PUBLIC_GEMINI_KEY' :
                          process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' : 
                          process.env.NEXT_PUBLIC_GEMINI_API_KEY ? 'NEXT_PUBLIC_GEMINI_API_KEY' : 
                          'NONE';
      
      console.log(`DEBUG: Gemini extraction using key from: ${usedKeyName}`);
      
      if (!apiKey) {
        console.error('DEBUG: Gemini API key is missing from environment');
        throw new Error('GEMINI_API_KEY_MISSING');
      }
      
      const ai = new GoogleGenAI({ apiKey });
      
      const extractionPrompt = `
        Based on these search results and the user's location (${location || 'Global'}), 
        extract the most likely sourcing location, expected price, and accessibility for each item.
        
        Items: ${queries.join(', ')}
        Search Context: ${firecrawlContext || 'No search results available.'}
        
        Return ONLY valid JSON as an array of objects:
        [
          { 
            "name": "item_name", 
            "sourcing_location": "city, country", 
            "expected_price": "$xx.xx",
            "accessibility": "abundant | regulated | scarce | critical",
            "sourcing_note": "A brief note on sourcing intelligence found in the context"
          }
        ]
      `;

      const geminiPromise = ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: extractionPrompt,
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('GEMINI_EXTRACTION_TIMEOUT')), 20000)
      );

      const result = await Promise.race([geminiPromise, timeoutPromise]) as any;
      
      const text = result.text;
      console.log('DEBUG: Gemini extraction response received');
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        bomDetails = JSON.parse(jsonMatch[0]);
        console.log(`DEBUG: Successfully parsed ${bomDetails.length} BOM items`);
      } else {
        console.warn('DEBUG: No JSON array found in Gemini response');
        throw new Error('INVALID_EXTRACTION_FORMAT');
      }
    } catch (e) {
      console.error('DEBUG: Gemini Extraction Error:', e);
      extractionError = e instanceof Error ? e.message : 'EXTRACTION_FAILED';
      // Fallback to basic names if extraction fails
      bomDetails = queries.map(q => ({ name: q, sourcing_location: 'Unknown', expected_price: 'TBD' }));
    }

    return NextResponse.json({ 
      firecrawl_context: firecrawlContext,
      bom_details: bomDetails,
      errors: {
        firecrawl: firecrawlError,
        extraction: extractionError
      }
    });

  } catch (error) {
    console.error('DEBUG: Critical Search API Error:', error);
    return NextResponse.json({ 
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
