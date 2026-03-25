import { NextRequest, NextResponse } from 'next/server';
import FirecrawlApp from '@mendable/firecrawl-js';
import { GoogleGenAI } from '@google/genai';

let firecrawl: any = null;

function getFirecrawl() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  console.log('DEBUG: Firecrawl API Key present:', !!apiKey);
  
  if (!firecrawl) {
    if (!apiKey) {
      console.warn('FIRECRAWL_API_KEY is missing from environment.');
      return null;
    }
    try {
      firecrawl = new FirecrawlApp({ apiKey });
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
    console.log('DEBUG: Raw request body:', body);
    const { queries, location } = body;

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
            console.log(`DEBUG: Query "${queries[i]}" succeeded. Raw value:`, (r as PromiseFulfilledResult<any>).value);
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
        const items = res.data || res.web || [];
        const first = items[0] || {};
        return first.description || first.snippet || first.markdown || first.title || '';
      })
      .filter(Boolean);
    
    console.log(`DEBUG: Collected ${snippets.length} snippets`);
    const firecrawlContext = snippets.join(' · ').slice(0, 2000);

    const responseData = { 
      firecrawl_context: firecrawlContext,
      errors: {
        firecrawl: firecrawlError
      }
    };
    console.log('DEBUG: Sending final response data:', responseData);
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('DEBUG: Critical Search API Error:', error);
    return NextResponse.json({ 
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
