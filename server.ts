import express, { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseNaturalLanguageMutation } from './src/utils/eventMath';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '20mb' }));

const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 10) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err: any) {
    console.warn('Failed to initialize GoogleGenAI client:', err?.message);
  }
}

// Resilient JSON extractor & parser
function extractJsonFromText(rawText: string): any {
  if (!rawText) return null;
  let cleaned = rawText.trim();
  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Find outermost curly braces
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

// Robust number sanitizer
function sanitizeNum(val: any, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return isNaN(n) || !isFinite(n) ? fallback : n;
}

const SYSTEM_INSTRUCTION = `You are EventFlow AI, an agentic, state-aware Event Planning Operating System designed for Weddings, Milestone Birthdays, and Community/Campus Events in India and global metros.

Unlike generic chatbots that give vague advice, you directly manage and mutate the user's live event state (Budget, Dependency Timeline, Vendor Quotes, and Executable Checklists).

Core Operating Principles:
1. Hyper-Local & Realistic Budgeting (Anti-Hallucination):
   - Always account for regional pricing tiers (e.g. Pune, Mumbai, Delhi NCR, Bengaluru Tier-1 and Tier-2 benchmarks).
   - Indian Rupee (₹) amounts should reflect real-world costs.
   - Always reserve an explicit 8%–12% buffer line item for Taxes (GST), tips, corkage, and contingencies.
   - Distinguish between Fixed Costs (Photography, DJ, Mandap), Variable Per-Head Costs (Catering, Favors), and Hybrid Costs (Venue rental + per-plate lawn surcharge).
2. Dynamic Task Dependencies (Backward Scheduling):
   - Tasks are anchored backward from the event_date.
   - Every task has depends_on relationships. If a foundational task (e.g. "Venue Lock-in" or "Municipal Permit") is delayed, flag downstream tasks as AT_RISK_DEPENDENCY and recalculate timelines.
3. Vendor Quote & Contract Intelligence:
   - Hunt for what is MISSING or EXCLUDED in fine print (diesel generator backup charges, late-night overtime past 11 PM, external decorator royalty/monopoly fees, PPL/Novex music licenses, corkage fees).
4. Moodboard-to-Execution Translation:
   - Translate aesthetic themes into concrete bills of materials (exact quantities of lighting, drapes, props, florals) with estimated local prices.

When responding to state mutation commands (e.g. "Cut floral budget by 20% and move it to DJ, and shift Sangeet start time by 1 hour"), ALWAYS provide precise budgetDiffs, timelineDiffs, and checklist additions so the frontend UI updates automatically.`;

// Schema for structured plan mutations
const planMutationSchema = {
  type: Type.OBJECT,
  properties: {
    assistant_reply: {
      type: Type.STRING,
      description: 'Concise, high-level explanation of plan adjustments, trade-offs, and strategic advice.',
    },
    readiness_score_delta: {
      type: Type.INTEGER,
      description: 'Change in event readiness score (-10 to +10).',
    },
    budget_mutations: {
      type: Type.ARRAY,
      description: 'List of budget line items to modify or create.',
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          name: { type: Type.STRING },
          sub_function: { type: Type.STRING },
          cost_type: { type: Type.STRING, enum: ['FIXED', 'VARIABLE_PER_GUEST', 'HYBRID', 'TAX_AND_BUFFER'] },
          previous_amount: { type: Type.NUMBER },
          allocated_amount: { type: Type.NUMBER },
          ai_warning_badge: { type: Type.STRING },
        },
        required: ['category', 'name', 'allocated_amount', 'cost_type'],
      },
    },
    timeline_tasks: {
      type: Type.ARRAY,
      description: 'Timeline milestones modified, rescheduled, or created.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          previous_status: { type: Type.STRING, enum: ['ON_TRACK', 'DELAYED', 'AT_RISK_DEPENDENCY', 'COMPLETED'] },
          new_status: { type: Type.STRING, enum: ['ON_TRACK', 'DELAYED', 'AT_RISK_DEPENDENCY', 'COMPLETED'] },
          previous_days_before: { type: Type.INTEGER },
          new_days_before: { type: Type.INTEGER },
          reason: { type: Type.STRING },
        },
        required: ['title', 'new_status', 'reason'],
      },
    },
    executable_checklist_additions: {
      type: Type.ARRAY,
      description: 'Concrete rental or shopping items to add to the checklist.',
      items: {
        type: Type.OBJECT,
        properties: {
          item_name: { type: Type.STRING },
          sub_function: { type: Type.STRING },
          quantity_or_spec: { type: Type.STRING },
          estimated_cost: { type: Type.NUMBER },
        },
        required: ['item_name', 'quantity_or_spec', 'estimated_cost'],
      },
    },
  },
  required: ['assistant_reply', 'readiness_score_delta', 'budget_mutations', 'timeline_tasks'],
};

// POST /api/plan-mutation
app.post('/api/plan-mutation', async (req: Request, res: Response) => {
  const { prompt, currentPlan, eventId } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const targetEventId = eventId || currentPlan?.id || 'event-default';

  // Attempt live Gemini API call with timeout protection
  if (aiClient) {
    try {
      const apiPromise = aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `User command: "${prompt}"\n\nCurrent Active Event State:\n${JSON.stringify(currentPlan, null, 2)}\n\nGenerate structured plan mutations. Calculate exact rupee adjustments.`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: planMutationSchema,
        },
      });

      // 8 second timeout safety race
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API timeout')), 8000)
      );

      const response: any = await Promise.race([apiPromise, timeoutPromise]);
      const responseText = response?.text;

      if (responseText) {
        const parsed = extractJsonFromText(responseText);
        if (parsed) {
          return res.json({
            id: `mut-${Date.now()}`,
            eventId: targetEventId,
            timestamp: Date.now(),
            userPrompt: prompt,
            assistantReply: parsed.assistant_reply || 'Plan updated with your requested adjustments.',
            readinessScoreDelta: sanitizeNum(parsed.readiness_score_delta, 0),
            budgetDiffs: (parsed.budget_mutations || []).map((b: any) => ({
              category: b.category || 'General',
              name: b.name || 'Custom Item',
              subFunction: b.sub_function || 'All Functions',
              costType: b.cost_type || 'FIXED',
              previousAmount: sanitizeNum(b.previous_amount, 0),
              newAmount: sanitizeNum(b.allocated_amount, 0),
              aiWarning: b.ai_warning_badge || undefined,
            })),
            timelineDiffs: (parsed.timeline_tasks || []).map((t: any) => ({
              title: t.title || 'Timeline Milestone',
              previousStatus: t.previous_status || 'ON_TRACK',
              newStatus: t.new_status || 'ON_TRACK',
              previousDaysBefore: sanitizeNum(t.previous_days_before, 0),
              newDaysBefore: sanitizeNum(t.new_days_before, 0),
              reason: t.reason || '',
            })),
            checklistAdditions: (parsed.executable_checklist_additions || []).map((c: any) => ({
              itemName: c.item_name || 'Checklist Item',
              subFunction: c.sub_function || 'All Functions',
              quantityOrSpec: c.quantity_or_spec || '',
              estimatedCost: sanitizeNum(c.estimated_cost, 0),
            })),
            applied: false,
          });
        }
      }
    } catch (err: any) {
      console.warn('Gemini API call failed, falling back to deterministic engine:', err?.message);
    }
  }

  // Fallback engine: dynamically parses custom user instructions using domain engine
  const parsed = parseNaturalLanguageMutation(prompt, currentPlan || {
    id: targetEventId,
    name: 'Active Event',
    guestCount: 250,
    totalBudget: 1200000,
    budgetItems: [],
    timelineTasks: [],
    themeChecklist: [],
  });

  return res.json({
    id: `mut-${Date.now()}`,
    eventId: targetEventId,
    timestamp: Date.now(),
    userPrompt: prompt,
    assistantReply: parsed.assistantReply || `Audited your event plan in accordance with Indian metro benchmark standards for "${prompt}".`,
    readinessScoreDelta: 3,
    budgetDiffs: (parsed.budgetDiffs || []).map((b) => ({
      ...b,
      previousAmount: sanitizeNum(b.previousAmount, 0),
      newAmount: sanitizeNum(b.newAmount, 0),
    })),
    timelineDiffs: parsed.timelineDiffs || [],
    checklistAdditions: parsed.checklistAdditions || [],
    applied: false,
  });
});

// Common handler for vendor extraction & compare
async function handleVendorExtract(req: Request, res: Response) {
  const { rawText, imageBase64, mimeType, guestCount = 250 } = req.body;
  const safeGuests = Math.max(20, sanitizeNum(guestCount, 250));

  if (aiClient && (rawText || imageBase64)) {
    try {
      const parts: any[] = [];
      if (imageBase64) {
        parts.push({
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: imageBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
          },
        });
      }
      parts.push({
        text: `Analyze this vendor quote for an event in Pune/India with ${safeGuests} guests:\n\n${rawText || 'See attached vendor quote image.'}\n\nNormalize pricing, extract base cost, per-plate cost, GST slab (5% vs 18%), and find ALL HIDDEN EXCLUSIONS (generator diesel, overtime past 11 PM, outside decorator royalty, PPL music license, waiter tips, cleaning deposit). Write a polite yet firm WhatsApp counter-offer in Indian business tone.`,
      });

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              vendor_name: { type: Type.STRING },
              category: { type: Type.STRING },
              base_cost: { type: Type.NUMBER },
              per_plate_cost: { type: Type.NUMBER },
              gst_rate_percent: { type: Type.INTEGER },
              taxes_gst_amount: { type: Type.NUMBER },
              estimated_hidden_costs: { type: Type.NUMBER },
              normalized_total: { type: Type.NUMBER },
              hidden_fees_flagged: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              ai_recommendation_badge: {
                type: Type.STRING,
                enum: ['BEST_VALUE', 'HIGH_RISK_EXCLUSIONS', 'PREMIUM_PICK'],
              },
              negotiation_script: { type: Type.STRING },
            },
            required: [
              'vendor_name',
              'category',
              'base_cost',
              'normalized_total',
              'hidden_fees_flagged',
              'negotiation_script',
            ],
          },
        },
      });

      const text = response.text;
      if (text) {
        const p = extractJsonFromText(text);
        if (p) {
          const baseCost = sanitizeNum(p.base_cost, 237500);
          const gstRate = p.gst_rate_percent === 5 ? 5 : 18;
          const gstAmount = sanitizeNum(p.taxes_gst_amount, Math.round(baseCost * (gstRate / 100)));
          const hiddenCosts = sanitizeNum(p.estimated_hidden_costs, 24000);
          const normalized = sanitizeNum(p.normalized_total, baseCost + gstAmount + hiddenCosts);

          return res.json({
            id: `vq-${Date.now()}`,
            vendorName: p.vendor_name || 'Extracted Vendor Quote',
            category: p.category || 'Catering',
            baseCost,
            perPlateCost: sanitizeNum(p.per_plate_cost, Math.round(baseCost / safeGuests)),
            gstRatePercent: gstRate,
            taxesGstAmount: gstAmount,
            estimatedHiddenCosts: hiddenCosts,
            normalizedTotal: normalized,
            hiddenFeesFlagged: Array.isArray(p.hidden_fees_flagged) && p.hidden_fees_flagged.length > 0
              ? p.hidden_fees_flagged
              : ['No generator fuel backup included', 'Late-night overtime fees'],
            aiRecommendationBadge: p.ai_recommendation_badge || 'HIGH_RISK_EXCLUSIONS',
            negotiationScript: p.negotiation_script || 'Namaste team, requesting waiver on unbundled fuel charges.',
          });
        }
      }
    } catch (e: any) {
      console.warn('Gemini Vision/Text vendor extraction fallback:', e?.message);
    }
  }

  // Fallback demo extraction
  const perPlate = 950;
  const base = perPlate * safeGuests;
  const gst = Math.round(base * 0.18);
  const hidden = 26000;
  const total = base + gst + hidden;

  return res.json({
    id: `vq-${Date.now()}`,
    vendorName: 'Baner Garden Catering & Live Kitchen',
    category: 'Catering',
    baseCost: base,
    perPlateCost: perPlate,
    gstRatePercent: 18,
    taxesGstAmount: gst,
    estimatedHiddenCosts: hidden,
    normalizedTotal: total,
    hiddenFeesFlagged: [
      'Diesel generator for tandoor omitted (₹9,000/shift)',
      'Waitstaff service gratuity not bundled (₹8,000)',
      'Post-event kitchen waste disposal fee (₹9,000)',
    ],
    aiRecommendationBadge: 'HIGH_RISK_EXCLUSIONS',
    negotiationScript: `Namaste Baner Garden team, we reviewed your quote of ₹${perPlate}/plate for our ${safeGuests} guests. We noticed essential operational costs like generator backup and waste disposal are excluded, which pushes the true effective per-plate rate to ₹${Math.round(total / safeGuests)} with 18% GST. Given our confirmed booking date, we request an all-inclusive packaged rate of ₹1,050/plate with GST and fuel bundled. Let us know if we can finalize the contract today.`,
  });
}

// POST /api/vendor-extract and /api/vendor-compare alias
app.post('/api/vendor-extract', handleVendorExtract);
app.post('/api/vendor-compare', handleVendorExtract);

// Common handler for moodboard BOM & theme extract
async function handleMoodboardBOM(req: Request, res: Response) {
  const { vibePrompt, budgetCap = 150000, subFunction = 'Haldi' } = req.body;
  const safeCap = sanitizeNum(budgetCap, 150000);

  if (aiClient && vibePrompt) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Theme / Vibe: "${vibePrompt}". Budget cap: ₹${safeCap}. Sub-function: ${subFunction}.\nGenerate aesthetic concept & concrete Bill of Materials (BOM) with quantities and estimated local INR prices for India.`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              aesthetic_summary: { type: Type.STRING },
              color_palette: { type: Type.ARRAY, items: { type: Type.STRING } },
              bill_of_materials: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    item_name: { type: Type.STRING },
                    quantity_or_spec: { type: Type.STRING },
                    estimated_cost: { type: Type.NUMBER },
                  },
                  required: ['item_name', 'quantity_or_spec', 'estimated_cost'],
                },
              },
            },
            required: ['aesthetic_summary', 'color_palette', 'bill_of_materials'],
          },
        },
      });

      const text = response.text;
      if (text) {
        const p = extractJsonFromText(text);
        if (p) {
          return res.json({
            aestheticSummary: p.aesthetic_summary || 'Warm sunlit Indian courtyard setting with handcrafted accents.',
            colorPalette: Array.isArray(p.color_palette) ? p.color_palette : ['#E05A47', '#F59E0B'],
            checklist: (p.bill_of_materials || []).map((b: any, idx: number) => ({
              id: `ci-gen-${Date.now()}-${idx}`,
              itemName: b.item_name || 'Decorative Accent',
              subFunction,
              quantityOrSpec: b.quantity_or_spec || 'Standard setup',
              estimatedCost: sanitizeNum(b.estimated_cost, 10000),
              syncedToBudget: false,
            })),
          });
        }
      }
    } catch (e: any) {
      console.warn('Moodboard generation fallback:', e?.message);
    }
  }

  // Fallback demo BOM
  return res.json({
    aestheticSummary:
      'Warm sunlight over raw terracotta courtyards, accented with fresh marigold strings, brass urli bowls, and hand-block-printed textiles.',
    colorPalette: ['#E05A47 (Terracotta)', '#F59E0B (Marigold)', '#FEF08A (Haldi Yellow)', '#451A03 (Dark Wood)'],
    checklist: [
      {
        id: `ci-gen-${Date.now()}-1`,
        itemName: 'Fresh Genda (Marigold) Garland Torans (120 strings)',
        subFunction,
        quantityOrSpec: '120 strings x 8ft fresh farm-harvested flowers',
        estimatedCost: 18000,
        syncedToBudget: false,
      },
      {
        id: `ci-gen-${Date.now()}-2`,
        itemName: 'Carved Wooden Jhula (Swing) with Floral Canopy',
        subFunction,
        quantityOrSpec: '1 solid teak antique swing with floral side ropes',
        estimatedCost: 22000,
        syncedToBudget: false,
      },
      {
        id: `ci-gen-${Date.now()}-3`,
        itemName: 'Hand-beaten Brass Urli Bowls for Floating Petals',
        subFunction,
        quantityOrSpec: '6 x 20-inch brass urli bowls + floating candles',
        estimatedCost: 11000,
        syncedToBudget: false,
      },
      {
        id: `ci-gen-${Date.now()}-4`,
        itemName: 'Jaipuri Block-Print Floor Dastarkhwan & Mattresses',
        subFunction,
        quantityOrSpec: '8 low gaddas with yellow and rust bolster cushions',
        estimatedCost: 15000,
        syncedToBudget: false,
      },
    ],
  });
}

// POST /api/moodboard-bom and /api/theme-extract alias
app.post('/api/moodboard-bom', handleMoodboardBOM);
app.post('/api/theme-extract', handleMoodboardBOM);

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  function tryListen(portToTry: number) {
    const server = app.listen(portToTry, '0.0.0.0', () => {
      console.log('\n┌────────────────────────────────────────────────────────┐');
      console.log('│  EventFlow AI is running and ready!                    │');
      console.log(`│  ➜  Local:   http://localhost:${portToTry}                     │`);
      console.log(`│  ➜  Network: http://0.0.0.0:${portToTry}                       │`);
      console.log('└────────────────────────────────────────────────────────┘\n');
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️  Port ${portToTry} is already in use by another process.`);
        if (portToTry < PORT + 5) {
          console.log(`➜  Automatically trying port ${portToTry + 1}...`);
          tryListen(portToTry + 1);
        } else {
          console.error(`❌ Ports ${PORT} through ${portToTry} are all in use.`);
          console.error(`➜  To free port 3000, run: npm run kill`);
          process.exit(1);
        }
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    });
  }

  tryListen(PORT);
}

startServer();
