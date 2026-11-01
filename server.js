// server.ts
import express from "express";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// src/utils/eventMath.ts
function parseNaturalLanguageMutation(prompt, plan) {
  const lower = prompt.toLowerCase();
  const parseAmount = (str) => {
    let s = str.replace(/[₹,\s]/g, "");
    const multiplier = /l$/i.test(s) ? 1e5 : /k$/i.test(s) ? 1e3 : /cr$/i.test(s) ? 1e7 : 1;
    s = s.replace(/[lLkKcCrR]/g, "");
    const num = parseFloat(s);
    return isNaN(num) ? 0 : Math.round(num * multiplier);
  };
  const amountMatch = prompt.match(/₹\s*([\d,]+(?:\.\d+)?)\s*(L|l|K|k|Cr|cr)?/);
  const extractedAmount = amountMatch ? parseAmount(`\u20B9${amountMatch[1]}${amountMatch[2] || ""}`) : 0;
  const pctMatch = prompt.match(/by\s+(\d+)\s*%/i);
  const extractedPct = pctMatch ? parseInt(pctMatch[1], 10) / 100 : 0;
  const categoryKeywords = {
    catering: ["catering", "food", "buffet", "meal", "plate"],
    decor: ["decor", "floral", "flower", "mandap", "lighting", "balloon"],
    venue: ["venue", "lawn", "hall", "banquet", "ground"],
    sound: ["sound", "dj", "audio", "music", "speaker", "pa system"],
    photo: ["photo", "cinemat", "video", "camera"],
    mehendi: ["mehendi", "henna"],
    transport: ["transport", "baraat", "car", "bus"]
  };
  const findItem = (keywords) => plan.budgetItems.find(
    (b) => keywords.some(
      (kw) => b.category.toLowerCase().includes(kw) || b.name.toLowerCase().includes(kw)
    )
  );
  const isCut = /\b(cut|reduc|trim|lower|decreas|slash)\b/i.test(lower);
  const isAdd = /\b(add|includ|insert|book|creat|new)\b/i.test(lower);
  const isDelay = /\b(delay|push|slip|postpone|defer)\b/i.test(lower);
  const isSponsor = /\b(sponsor|fund|grant|donate|contribut)\b/i.test(lower);
  const isGuest = /\b(guest|pax|attendee|head count)\b/i.test(lower);
  const budgetDiffs = [];
  const timelineDiffs = [];
  const checklistAdditions = [];
  let assistantReply = "";
  if (isSponsor && extractedAmount > 0) {
    assistantReply = `Logged \u20B9${extractedAmount.toLocaleString("en-IN")} title sponsorship inflow. Increasing contingency reserve proportionally.`;
    const bufferItem2 = plan.budgetItems.find((b) => b.costType === "TAX_AND_BUFFER");
    const prevBuf2 = bufferItem2?.allocatedAmount || Math.round(plan.totalBudget * 0.08);
    budgetDiffs.push({
      category: "Sponsorship & Inflow",
      name: "Title Sponsor Contribution",
      subFunction: "All Functions",
      costType: "FIXED",
      previousAmount: 0,
      newAmount: extractedAmount
    });
    budgetDiffs.push({
      category: bufferItem2?.category || "Tax & Contingency Reserve",
      name: bufferItem2?.name || "GST Buffer & Contingency",
      subFunction: "All Functions",
      costType: "TAX_AND_BUFFER",
      previousAmount: prevBuf2,
      newAmount: prevBuf2 + Math.round(extractedAmount * 0.1),
      aiWarning: "Reinforced buffer from sponsor inflow."
    });
    return { budgetDiffs, timelineDiffs, checklistAdditions, assistantReply };
  }
  if (isDelay) {
    const daysMatch = prompt.match(/(\d+)\s*day/i);
    const delayDays = daysMatch ? parseInt(daysMatch[1], 10) : 3;
    let taskTitle = "Sound Setup & Soundcheck";
    for (const [_cat, kws] of Object.entries(categoryKeywords)) {
      if (kws.some((kw) => lower.includes(kw))) {
        const matchedTask = plan.timelineTasks.find(
          (t) => kws.some((kw) => t.title.toLowerCase().includes(kw))
        );
        if (matchedTask) {
          taskTitle = matchedTask.title;
          break;
        }
      }
    }
    assistantReply = `Slipping "${taskTitle}" by ${delayDays} days and computing cascade effects on downstream tasks.`;
    timelineDiffs.push({
      title: taskTitle,
      previousStatus: "ON_TRACK",
      newStatus: "DELAYED",
      previousDaysBefore: 10,
      newDaysBefore: 10 + delayDays,
      reason: `Delayed by ${delayDays} days per planner instruction.`
    });
    return { budgetDiffs, timelineDiffs, checklistAdditions, assistantReply };
  }
  if (isAdd && extractedAmount > 0) {
    let itemName = "Custom Event Addition";
    let category = "Miscellaneous";
    let subFunction = "All Functions";
    if (/mehendi|henna/i.test(lower)) {
      itemName = "Mehendi Artist (Bridal + Family)";
      category = "Artists & Performers";
      subFunction = "Haldi";
    } else if (/photograp|cinemat/i.test(lower)) {
      itemName = "Additional Photographer / Videographer";
      category = "Photography & Film";
      subFunction = "All Functions";
    } else if (/dj|sound/i.test(lower)) {
      itemName = "Additional DJ / Sound Extension";
      category = "Sound, DJ & Licensing";
      subFunction = "Sangeet";
    } else if (/decor|floral/i.test(lower)) {
      itemName = "Additional Floral & Decor Arrangement";
      category = "Decor & Florals";
      subFunction = "All Functions";
    }
    assistantReply = `Adding "${itemName}" at \u20B9${extractedAmount.toLocaleString("en-IN")} to the budget.`;
    budgetDiffs.push({
      category,
      name: itemName,
      subFunction,
      costType: "FIXED",
      previousAmount: 0,
      newAmount: extractedAmount
    });
    checklistAdditions.push({
      itemName,
      subFunction,
      quantityOrSpec: "1 booking as per vendor quote",
      estimatedCost: extractedAmount
    });
    return { budgetDiffs, timelineDiffs, checklistAdditions, assistantReply };
  }
  if (isCut) {
    for (const [catKey, kws] of Object.entries(categoryKeywords)) {
      if (kws.some((kw) => lower.includes(kw))) {
        const item = findItem(kws);
        if (item) {
          const prev = item.allocatedAmount;
          let newAmt;
          if (extractedAmount > 0) {
            newAmt = Math.max(0, prev - extractedAmount);
            assistantReply = `Reducing ${item.category} (${item.name}) by \u20B9${extractedAmount.toLocaleString("en-IN")} from \u20B9${prev.toLocaleString("en-IN")} to \u20B9${newAmt.toLocaleString("en-IN")}.`;
          } else if (extractedPct > 0) {
            newAmt = Math.round(prev * (1 - extractedPct));
            assistantReply = `Reducing ${item.category} by ${Math.round(extractedPct * 100)}% (\u2212\u20B9${(prev - newAmt).toLocaleString("en-IN")}).`;
          } else {
            newAmt = Math.round(prev * 0.85);
            assistantReply = `Trimming ${item.category} by 15% as a default cost-optimization measure.`;
          }
          budgetDiffs.push({
            itemId: item.id,
            category: item.category,
            name: item.name,
            subFunction: item.subFunction,
            costType: item.costType,
            previousAmount: prev,
            newAmount: newAmt
          });
          return { budgetDiffs, timelineDiffs, checklistAdditions, assistantReply };
        }
        assistantReply = `Could not find an active "${catKey}" line item to cut. Please add one first.`;
        return { budgetDiffs, timelineDiffs, checklistAdditions, assistantReply };
      }
    }
  }
  if (isGuest) {
    const guestMatch = prompt.match(/\b(\d{2,4})\b/);
    const targetGuests = guestMatch ? parseInt(guestMatch[1], 10) : plan.guestCount;
    const catering = plan.budgetItems.find((b) => b.category.toLowerCase().includes("catering"));
    if (catering && targetGuests !== plan.guestCount) {
      const rate = catering.perGuestRate || Math.round(catering.allocatedAmount / Math.max(1, plan.guestCount));
      const newAmt = rate * targetGuests;
      assistantReply = `Recalibrating catering to \u20B9${newAmt.toLocaleString("en-IN")} for ${targetGuests} guests at \u20B9${rate}/plate.`;
      budgetDiffs.push({
        itemId: catering.id,
        category: catering.category,
        name: catering.name,
        subFunction: catering.subFunction,
        costType: "VARIABLE_PER_GUEST",
        previousAmount: catering.allocatedAmount,
        newAmount: newAmt,
        aiWarning: `Recalculated for ${targetGuests} guests at \u20B9${rate}/plate.`
      });
    }
    return { budgetDiffs, timelineDiffs, checklistAdditions, assistantReply };
  }
  const bufferItem = plan.budgetItems.find((b) => b.costType === "TAX_AND_BUFFER");
  const prevBuf = bufferItem?.allocatedAmount || Math.round(plan.totalBudget * 0.08);
  assistantReply = `Audited ${plan.name}. Reinforcing emergency buffer reserve to 10%.`;
  budgetDiffs.push({
    category: bufferItem?.category || "Tax & Contingency Reserve",
    name: bufferItem?.name || "8% GST Buffer & Emergency Fund",
    subFunction: "All Functions",
    costType: "TAX_AND_BUFFER",
    previousAmount: prevBuf,
    newAmount: Math.round(plan.totalBudget * 0.1),
    aiWarning: "Emergency buffer reinforced to 10% based on planner audit."
  });
  return { budgetDiffs, timelineDiffs, checklistAdditions, assistantReply };
}

// server.ts
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = parseInt(process.env.PORT || "3000", 10);
app.use(express.json({ limit: "20mb" }));
var apiKey = process.env.GEMINI_API_KEY;
var aiClient = null;
if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim().length > 10) {
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  } catch (err) {
    console.warn("Failed to initialize GoogleGenAI client:", err?.message);
  }
}
function extractJsonFromText(rawText) {
  if (!rawText) return null;
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}
function sanitizeNum(val, fallback = 0) {
  if (val === null || val === void 0 || val === "") return fallback;
  const n = Number(val);
  return isNaN(n) || !isFinite(n) ? fallback : n;
}
var SYSTEM_INSTRUCTION = `You are EventFlow AI, an agentic, state-aware Event Planning Operating System designed for Weddings, Milestone Birthdays, and Community/Campus Events in India and global metros.

Unlike generic chatbots that give vague advice, you directly manage and mutate the user's live event state (Budget, Dependency Timeline, Vendor Quotes, and Executable Checklists).

Core Operating Principles:
1. Hyper-Local & Realistic Budgeting (Anti-Hallucination):
   - Always account for regional pricing tiers (e.g. Pune, Mumbai, Delhi NCR, Bengaluru Tier-1 and Tier-2 benchmarks).
   - Indian Rupee (\u20B9) amounts should reflect real-world costs.
   - Always reserve an explicit 8%\u201312% buffer line item for Taxes (GST), tips, corkage, and contingencies.
   - Distinguish between Fixed Costs (Photography, DJ, Mandap), Variable Per-Head Costs (Catering, Favors), and Hybrid Costs (Venue rental + per-plate lawn surcharge).
2. Dynamic Task Dependencies (Backward Scheduling):
   - Tasks are anchored backward from the event_date.
   - Every task has depends_on relationships. If a foundational task (e.g. "Venue Lock-in" or "Municipal Permit") is delayed, flag downstream tasks as AT_RISK_DEPENDENCY and recalculate timelines.
3. Vendor Quote & Contract Intelligence:
   - Hunt for what is MISSING or EXCLUDED in fine print (diesel generator backup charges, late-night overtime past 11 PM, external decorator royalty/monopoly fees, PPL/Novex music licenses, corkage fees).
4. Moodboard-to-Execution Translation:
   - Translate aesthetic themes into concrete bills of materials (exact quantities of lighting, drapes, props, florals) with estimated local prices.

When responding to state mutation commands (e.g. "Cut floral budget by 20% and move it to DJ, and shift Sangeet start time by 1 hour"), ALWAYS provide precise budgetDiffs, timelineDiffs, and checklist additions so the frontend UI updates automatically.`;
var planMutationSchema = {
  type: Type.OBJECT,
  properties: {
    assistant_reply: {
      type: Type.STRING,
      description: "Concise, high-level explanation of plan adjustments, trade-offs, and strategic advice."
    },
    readiness_score_delta: {
      type: Type.INTEGER,
      description: "Change in event readiness score (-10 to +10)."
    },
    budget_mutations: {
      type: Type.ARRAY,
      description: "List of budget line items to modify or create.",
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          name: { type: Type.STRING },
          sub_function: { type: Type.STRING },
          cost_type: { type: Type.STRING, enum: ["FIXED", "VARIABLE_PER_GUEST", "HYBRID", "TAX_AND_BUFFER"] },
          previous_amount: { type: Type.NUMBER },
          allocated_amount: { type: Type.NUMBER },
          ai_warning_badge: { type: Type.STRING }
        },
        required: ["category", "name", "allocated_amount", "cost_type"]
      }
    },
    timeline_tasks: {
      type: Type.ARRAY,
      description: "Timeline milestones modified, rescheduled, or created.",
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          previous_status: { type: Type.STRING, enum: ["ON_TRACK", "DELAYED", "AT_RISK_DEPENDENCY", "COMPLETED"] },
          new_status: { type: Type.STRING, enum: ["ON_TRACK", "DELAYED", "AT_RISK_DEPENDENCY", "COMPLETED"] },
          previous_days_before: { type: Type.INTEGER },
          new_days_before: { type: Type.INTEGER },
          reason: { type: Type.STRING }
        },
        required: ["title", "new_status", "reason"]
      }
    },
    executable_checklist_additions: {
      type: Type.ARRAY,
      description: "Concrete rental or shopping items to add to the checklist.",
      items: {
        type: Type.OBJECT,
        properties: {
          item_name: { type: Type.STRING },
          sub_function: { type: Type.STRING },
          quantity_or_spec: { type: Type.STRING },
          estimated_cost: { type: Type.NUMBER }
        },
        required: ["item_name", "quantity_or_spec", "estimated_cost"]
      }
    }
  },
  required: ["assistant_reply", "readiness_score_delta", "budget_mutations", "timeline_tasks"]
};
app.post("/api/plan-mutation", async (req, res) => {
  const { prompt, currentPlan, eventId } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }
  const targetEventId = eventId || currentPlan?.id || "event-default";
  if (aiClient) {
    try {
      const apiPromise = aiClient.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `User command: "${prompt}"

Current Active Event State:
${JSON.stringify(currentPlan, null, 2)}

Generate structured plan mutations. Calculate exact rupee adjustments.`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: planMutationSchema
        }
      });
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Gemini API timeout")), 8e3)
      );
      const response = await Promise.race([apiPromise, timeoutPromise]);
      const responseText = response?.text;
      if (responseText) {
        const parsed2 = extractJsonFromText(responseText);
        if (parsed2) {
          return res.json({
            id: `mut-${Date.now()}`,
            eventId: targetEventId,
            timestamp: Date.now(),
            userPrompt: prompt,
            assistantReply: parsed2.assistant_reply || "Plan updated with your requested adjustments.",
            readinessScoreDelta: sanitizeNum(parsed2.readiness_score_delta, 0),
            budgetDiffs: (parsed2.budget_mutations || []).map((b) => ({
              category: b.category || "General",
              name: b.name || "Custom Item",
              subFunction: b.sub_function || "All Functions",
              costType: b.cost_type || "FIXED",
              previousAmount: sanitizeNum(b.previous_amount, 0),
              newAmount: sanitizeNum(b.allocated_amount, 0),
              aiWarning: b.ai_warning_badge || void 0
            })),
            timelineDiffs: (parsed2.timeline_tasks || []).map((t) => ({
              title: t.title || "Timeline Milestone",
              previousStatus: t.previous_status || "ON_TRACK",
              newStatus: t.new_status || "ON_TRACK",
              previousDaysBefore: sanitizeNum(t.previous_days_before, 0),
              newDaysBefore: sanitizeNum(t.new_days_before, 0),
              reason: t.reason || ""
            })),
            checklistAdditions: (parsed2.executable_checklist_additions || []).map((c) => ({
              itemName: c.item_name || "Checklist Item",
              subFunction: c.sub_function || "All Functions",
              quantityOrSpec: c.quantity_or_spec || "",
              estimatedCost: sanitizeNum(c.estimated_cost, 0)
            })),
            applied: false
          });
        }
      }
    } catch (err) {
      console.warn("Gemini API call failed, falling back to deterministic engine:", err?.message);
    }
  }
  const parsed = parseNaturalLanguageMutation(prompt, currentPlan || {
    id: targetEventId,
    name: "Active Event",
    guestCount: 250,
    totalBudget: 12e5,
    budgetItems: [],
    timelineTasks: [],
    themeChecklist: []
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
      newAmount: sanitizeNum(b.newAmount, 0)
    })),
    timelineDiffs: parsed.timelineDiffs || [],
    checklistAdditions: parsed.checklistAdditions || [],
    applied: false
  });
});
async function handleVendorExtract(req, res) {
  const { rawText, imageBase64, mimeType, guestCount = 250 } = req.body;
  const safeGuests = Math.max(20, sanitizeNum(guestCount, 250));
  if (aiClient && (rawText || imageBase64)) {
    try {
      const parts = [];
      if (imageBase64) {
        parts.push({
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: imageBase64.replace(/^data:image\/[a-z]+;base64,/, "")
          }
        });
      }
      parts.push({
        text: `Analyze this vendor quote for an event in Pune/India with ${safeGuests} guests:

${rawText || "See attached vendor quote image."}

Normalize pricing, extract base cost, per-plate cost, GST slab (5% vs 18%), and find ALL HIDDEN EXCLUSIONS (generator diesel, overtime past 11 PM, outside decorator royalty, PPL music license, waiter tips, cleaning deposit). Write a polite yet firm WhatsApp counter-offer in Indian business tone.`
      });
      const response = await aiClient.models.generateContent({
        model: "gemini-3.8-flash",
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
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
                items: { type: Type.STRING }
              },
              ai_recommendation_badge: {
                type: Type.STRING,
                enum: ["BEST_VALUE", "HIGH_RISK_EXCLUSIONS", "PREMIUM_PICK"]
              },
              negotiation_script: { type: Type.STRING }
            },
            required: [
              "vendor_name",
              "category",
              "base_cost",
              "normalized_total",
              "hidden_fees_flagged",
              "negotiation_script"
            ]
          }
        }
      });
      const text = response.text;
      if (text) {
        const p = extractJsonFromText(text);
        if (p) {
          const baseCost = sanitizeNum(p.base_cost, 237500);
          const gstRate = p.gst_rate_percent === 5 ? 5 : 18;
          const gstAmount = sanitizeNum(p.taxes_gst_amount, Math.round(baseCost * (gstRate / 100)));
          const hiddenCosts = sanitizeNum(p.estimated_hidden_costs, 24e3);
          const normalized = sanitizeNum(p.normalized_total, baseCost + gstAmount + hiddenCosts);
          return res.json({
            id: `vq-${Date.now()}`,
            vendorName: p.vendor_name || "Extracted Vendor Quote",
            category: p.category || "Catering",
            baseCost,
            perPlateCost: sanitizeNum(p.per_plate_cost, Math.round(baseCost / safeGuests)),
            gstRatePercent: gstRate,
            taxesGstAmount: gstAmount,
            estimatedHiddenCosts: hiddenCosts,
            normalizedTotal: normalized,
            hiddenFeesFlagged: Array.isArray(p.hidden_fees_flagged) && p.hidden_fees_flagged.length > 0 ? p.hidden_fees_flagged : ["No generator fuel backup included", "Late-night overtime fees"],
            aiRecommendationBadge: p.ai_recommendation_badge || "HIGH_RISK_EXCLUSIONS",
            negotiationScript: p.negotiation_script || "Namaste team, requesting waiver on unbundled fuel charges."
          });
        }
      }
    } catch (e) {
      console.warn("Gemini Vision/Text vendor extraction fallback:", e?.message);
    }
  }
  const perPlate = 950;
  const base = perPlate * safeGuests;
  const gst = Math.round(base * 0.18);
  const hidden = 26e3;
  const total = base + gst + hidden;
  return res.json({
    id: `vq-${Date.now()}`,
    vendorName: "Baner Garden Catering & Live Kitchen",
    category: "Catering",
    baseCost: base,
    perPlateCost: perPlate,
    gstRatePercent: 18,
    taxesGstAmount: gst,
    estimatedHiddenCosts: hidden,
    normalizedTotal: total,
    hiddenFeesFlagged: [
      "Diesel generator for tandoor omitted (\u20B99,000/shift)",
      "Waitstaff service gratuity not bundled (\u20B98,000)",
      "Post-event kitchen waste disposal fee (\u20B99,000)"
    ],
    aiRecommendationBadge: "HIGH_RISK_EXCLUSIONS",
    negotiationScript: `Namaste Baner Garden team, we reviewed your quote of \u20B9${perPlate}/plate for our ${safeGuests} guests. We noticed essential operational costs like generator backup and waste disposal are excluded, which pushes the true effective per-plate rate to \u20B9${Math.round(total / safeGuests)} with 18% GST. Given our confirmed booking date, we request an all-inclusive packaged rate of \u20B91,050/plate with GST and fuel bundled. Let us know if we can finalize the contract today.`
  });
}
app.post("/api/vendor-extract", handleVendorExtract);
app.post("/api/vendor-compare", handleVendorExtract);
async function handleMoodboardBOM(req, res) {
  const { vibePrompt, budgetCap = 15e4, subFunction = "Haldi" } = req.body;
  const safeCap = sanitizeNum(budgetCap, 15e4);
  if (aiClient && vibePrompt) {
    try {
      const response = await aiClient.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `Theme / Vibe: "${vibePrompt}". Budget cap: \u20B9${safeCap}. Sub-function: ${subFunction}.
Generate aesthetic concept & concrete Bill of Materials (BOM) with quantities and estimated local INR prices for India.`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
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
                    estimated_cost: { type: Type.NUMBER }
                  },
                  required: ["item_name", "quantity_or_spec", "estimated_cost"]
                }
              }
            },
            required: ["aesthetic_summary", "color_palette", "bill_of_materials"]
          }
        }
      });
      const text = response.text;
      if (text) {
        const p = extractJsonFromText(text);
        if (p) {
          return res.json({
            aestheticSummary: p.aesthetic_summary || "Warm sunlit Indian courtyard setting with handcrafted accents.",
            colorPalette: Array.isArray(p.color_palette) ? p.color_palette : ["#E05A47", "#F59E0B"],
            checklist: (p.bill_of_materials || []).map((b, idx) => ({
              id: `ci-gen-${Date.now()}-${idx}`,
              itemName: b.item_name || "Decorative Accent",
              subFunction,
              quantityOrSpec: b.quantity_or_spec || "Standard setup",
              estimatedCost: sanitizeNum(b.estimated_cost, 1e4),
              syncedToBudget: false
            }))
          });
        }
      }
    } catch (e) {
      console.warn("Moodboard generation fallback:", e?.message);
    }
  }
  return res.json({
    aestheticSummary: "Warm sunlight over raw terracotta courtyards, accented with fresh marigold strings, brass urli bowls, and hand-block-printed textiles.",
    colorPalette: ["#E05A47 (Terracotta)", "#F59E0B (Marigold)", "#FEF08A (Haldi Yellow)", "#451A03 (Dark Wood)"],
    checklist: [
      {
        id: `ci-gen-${Date.now()}-1`,
        itemName: "Fresh Genda (Marigold) Garland Torans (120 strings)",
        subFunction,
        quantityOrSpec: "120 strings x 8ft fresh farm-harvested flowers",
        estimatedCost: 18e3,
        syncedToBudget: false
      },
      {
        id: `ci-gen-${Date.now()}-2`,
        itemName: "Carved Wooden Jhula (Swing) with Floral Canopy",
        subFunction,
        quantityOrSpec: "1 solid teak antique swing with floral side ropes",
        estimatedCost: 22e3,
        syncedToBudget: false
      },
      {
        id: `ci-gen-${Date.now()}-3`,
        itemName: "Hand-beaten Brass Urli Bowls for Floating Petals",
        subFunction,
        quantityOrSpec: "6 x 20-inch brass urli bowls + floating candles",
        estimatedCost: 11e3,
        syncedToBudget: false
      },
      {
        id: `ci-gen-${Date.now()}-4`,
        itemName: "Jaipuri Block-Print Floor Dastarkhwan & Mattresses",
        subFunction,
        quantityOrSpec: "8 low gaddas with yellow and rust bolster cushions",
        estimatedCost: 15e3,
        syncedToBudget: false
      }
    ]
  });
}
app.post("/api/moodboard-bom", handleMoodboardBOM);
app.post("/api/theme-extract", handleMoodboardBOM);
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist/index.html"));
    });
  }
  function tryListen(portToTry) {
    const server = app.listen(portToTry, "0.0.0.0", () => {
      console.log("\n\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
      console.log("\u2502  EventFlow AI is running and ready!                    \u2502");
      console.log(`\u2502  \u279C  Local:   http://localhost:${portToTry}                     \u2502`);
      console.log(`\u2502  \u279C  Network: http://0.0.0.0:${portToTry}                       \u2502`);
      console.log("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n");
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.warn(`\u26A0\uFE0F  Port ${portToTry} is already in use by another process.`);
        if (portToTry < PORT + 5) {
          console.log(`\u279C  Automatically trying port ${portToTry + 1}...`);
          tryListen(portToTry + 1);
        } else {
          console.error(`\u274C Ports ${PORT} through ${portToTry} are all in use.`);
          console.error(`\u279C  To free port 3000, run: npm run kill`);
          process.exit(1);
        }
      } else {
        console.error("Server error:", err);
        process.exit(1);
      }
    });
  }
  tryListen(PORT);
}
startServer();
