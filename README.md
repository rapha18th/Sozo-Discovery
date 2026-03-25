# Sozo Discovery

### The world is made of things. We tell you what they are made of.

Most people look at a product and see an object. We look at a product and see a global network of mines, refineries, ports, and factories. We see the geopolitical stress, the environmental cost, and the economic reality of its existence.

**Discovery** is a forensic material engineering system. It turns a single image into a comprehensive supply chain intelligence briefing.

---

## The Experience

### 1. Forensic Identification
You upload an image. A camera, a laptop, a specialized industrial component. Using **Gemini 3.1 Flash Lite**, Discovery deconstructs the object into its core Bill of Materials (BOM). It identifies the exact alloys, the chemical requirements, and the specialized components.

### 2. Real-time Intelligence (Powered by Firecrawl)
Data is only as good as its freshness. Discovery doesn't rely on static databases. It uses **Firecrawl** to search the live web for spot prices, export duties, and port congestion. It even researches alternative manufacturing methods for the most critical materials. The web becomes a sensor for the physical world.

### 3. Conversational Interrogation (Powered by ElevenLabs)
A briefing shouldn't just be read; it should be interrogated. Discovery integrates **ElevenLabs** to provide a low-latency, high-fidelity conversational agent. You can talk to the forensic engineer, ask about the risks in Shenzhen, or explore how to mine rare earth elements from scratch. It’s not a chatbot; it’s a conversation with the supply chain.

---

## Technical Architecture & Data Flow

Discovery is built on a modern, high-performance stack designed for real-time forensic analysis:

### The Stack
*   **Frontend**: Next.js 15 (App Router) with TypeScript.
*   **Styling & Motion**: Tailwind CSS v4 for utility-first design and `motion/react` (Framer Motion) for fluid, cinematic UI transitions.
*   **Vision & Extraction**: **Gemini 3.1 Flash Lite** serves as the primary reasoning engine, performing both visual identification and structured data extraction from raw web context.
*   **Web Intelligence**: **Firecrawl** handles the heavy lifting of searching and scraping the live web, bypassing bot detection and providing clean, LLM-ready snippets.
*   **Conversational Layer**: **ElevenLabs Conversational AI SDK** provides the low-latency WebSocket connection for real-time voice-to-voice interaction.

### The Pipeline
1.  **Visual Audit**: The user captures an image. Gemini 3.1 Flash Lite analyzes the visual data to generate a detailed Bill of Materials (BOM).
2.  **Live Research**: The system generates targeted search queries for each material. **Firecrawl** executes these queries across the live web, gathering market intelligence, pricing, and logistics data.
3.  **Intelligence Extraction**: A second Gemini pass processes the raw Firecrawl snippets, mapping them back to the BOM items to determine accessibility (Abundant, Regulated, Scarce, Critical) and sourcing notes.
4.  **Dynamic Briefing**: The UI renders a forensic report. Simultaneously, the **ElevenLabs** agent is initialized with the full briefing context, enabling immediate conversational interrogation.

---

## How it Works

1.  **Capture**: Upload an image and specify your operational location.
2.  **Audit**: The system runs a multi-stage forensic scan.
    *   **Gemini** identifies the object and generates a BOM.
    *   **Firecrawl** gathers live market intelligence for each material.
    *   **Gemini** extracts the final sourcing hubs, prices, and accessibility profiles.
3.  **Briefing**: View the color-coded material list—from abundant to critical.
4.  **Interrogate**: Start a conversational session to dive deeper into the logistics and risks.

---

## Setup

To run Sozo Discovery, you need to configure the following secrets in your environment:

*   `GEMINI_KEY`: Your Google Gemini API key.
*   `NEXT_PUBLIC_GEMINI_KEY`: The same key, exposed for frontend analysis.
*   `FIRECRAWL_API_KEY`: Your Firecrawl API key for live web intelligence.
*   `NEXT_PUBLIC_ELEVENLABS_AGENT_ID`: Your ElevenLabs Conversational AI Agent ID.

---

### One more thing.
Discovery doesn't just tell you what a thing is. It tells you how the world works. It’s a window into the invisible machinery of global production.

**Welcome to the future of forensic intelligence.**
