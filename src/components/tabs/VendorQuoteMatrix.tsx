import React, { useState } from 'react';
import { useEventContext } from '../../context/EventContext';
import { VendorQuote } from '../../types/event';
import { formatINR } from '../../utils/formatters';
import {
  FileText,
  Upload,
  AlertOctagon,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  Plus,
} from 'lucide-react';

export const VendorQuoteMatrix: React.FC = () => {
  const { activeEvent, addVendorQuote } = useEventContext();

  const [rawText, setRawText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedScript, setSelectedScript] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const loadSampleQuote = () => {
    setRawText(`Namaste, here is our banquet catering quote for Baner event:
- Guest count: 300 pax
- Silver Maharashtrian & North Indian Buffet: Rs 950 per plate
- Live Chaat Counter: Included
- Desserts: Gulab jamun + Jalebi with Rabdi
Note: Tandoor/generator power backup extra at Rs 9,000. Waiters gratuity Rs 8,000 separate. Outside cleaning deposit Rs 9,000 refundable. 18% GST applicable.
Advance 50% to block date.`);
  };

  const handleExtractQuote = async () => {
    if (!rawText && !previewUrl) return;

    setIsExtracting(true);
    try {
      const res = await fetch('/api/vendor-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          imageBase64: previewUrl,
          guestCount: activeEvent.guestCount,
        }),
      });

      if (!res.ok) throw new Error('Extraction failed');
      const data: VendorQuote = await res.json();
      addVendorQuote(data);
      setRawText('');
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch (err: any) {
      console.error('Error extracting quote:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  const copyNegotiationScript = (script: string) => {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-[#E7E5E4]">
        <div>
          <h2 className="font-display text-base font-semibold text-[#1C1917]">
            Vendor Quote Matrix & Exclusion Scanner
          </h2>
          <p className="text-xs text-[#78716C]">
            Normalizes quotes to True Effective Cost per guest and uncovers hidden fine-print traps before you sign.
          </p>
        </div>
      </div>

      {/* Quote Ingestion Dock (Paste or Upload Image/PDF) */}
      <div className="bg-[#FAF8F5] border border-[#E7E5E4] rounded-xl p-4 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#4F46E5]" />
            <span className="text-xs font-semibold text-[#1C1917]">
              AI Multimodal Quote Auditor
            </span>
          </div>

          <button
            onClick={loadSampleQuote}
            className="text-[11px] text-[#4F46E5] hover:underline font-medium"
          >
            Load Sample Unparsed Caterer Quote (Test 3)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 space-y-1.5">
            <textarea
              rows={3}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste raw vendor quote from WhatsApp, Email, or SMS here (e.g. 'Rs 950/plate for 300 guests, live chaat, generator extra...')"
              className="w-full p-2.5 bg-white border border-[#E7E5E4] rounded-lg text-xs placeholder:text-[#A8A29E] outline-none focus:border-[#4F46E5] transition-colors resize-none"
            />
          </div>

          <div className="flex flex-col justify-between p-3 bg-white border border-dashed border-[#D6D3D1] rounded-lg text-center">
            {previewUrl ? (
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-[#16A34A] flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Image Attached
                </span>
                <span className="text-[10px] text-[#78716C] truncate block">
                  {selectedFile?.name}
                </span>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="text-[10px] text-rose-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="cursor-pointer space-y-1 flex flex-col items-center justify-center h-full">
                <Upload className="w-4 h-4 text-[#78716C]" />
                <span className="text-[11px] font-medium text-[#1C1917]">
                  Upload Quote Image
                </span>
                <span className="text-[10px] text-[#78716C]">PNG, JPG, or PDF</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}

            <button
              onClick={handleExtractQuote}
              disabled={isExtracting || (!rawText && !previewUrl)}
              className="mt-2 w-full py-1.5 text-xs font-semibold text-white bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 rounded-md transition-colors flex items-center justify-center gap-1.5 shadow-xs"
            >
              {isExtracting ? (
                <span>Auditing Exclusions...</span>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Scan & Add to Matrix</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Side-by-Side Normalized Comparison Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeEvent.vendorQuotes.map((quote) => (
          <div
            key={quote.id}
            className={`bg-white border rounded-xl p-4 space-y-3.5 transition-all shadow-xs flex flex-col justify-between ${
              quote.aiRecommendationBadge === 'BEST_VALUE'
                ? 'border-emerald-300 ring-1 ring-emerald-300'
                : quote.aiRecommendationBadge === 'HIGH_RISK_EXCLUSIONS'
                ? 'border-amber-300 ring-1 ring-amber-300'
                : 'border-[#E7E5E4]'
            }`}
          >
            <div className="space-y-2.5">
              {/* Badge & Vendor Title */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display font-semibold text-[#1C1917] text-sm">
                    {quote.vendorName}
                  </h3>
                  <div className="text-[11px] text-[#78716C]">
                    {quote.category} · {quote.contactPerson || 'Vendor Lead'}
                  </div>
                </div>

                {quote.aiRecommendationBadge === 'BEST_VALUE' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    BEST VALUE
                  </span>
                )}
                {quote.aiRecommendationBadge === 'HIGH_RISK_EXCLUSIONS' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    HIDDEN FEES DETECTED
                  </span>
                )}
                {quote.aiRecommendationBadge === 'PREMIUM_PICK' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
                    PREMIUM TIER
                  </span>
                )}
              </div>

              {/* Financial Metrics Strip */}
              <div className="bg-[#FAF8F5] border border-[#E7E5E4] rounded-lg p-2.5 space-y-1.5 text-xs">
                <div className="flex justify-between text-[#78716C]">
                  <span>Quoted Base Rate:</span>
                  <span className="font-mono-numbers text-[#1C1917]">
                    {quote.perPlateCost ? `₹${quote.perPlateCost}/plate` : formatINR(quote.baseCost)}
                  </span>
                </div>
                <div className="flex justify-between text-[#78716C]">
                  <span>GST Slab ({quote.gstRatePercent}%):</span>
                  <span className="font-mono-numbers text-[#1C1917]">
                    +{formatINR(quote.taxesGstAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-amber-800 font-medium">
                  <span>Hidden Exclusions (₹ Est.):</span>
                  <span className="font-mono-numbers">
                    +{formatINR(quote.estimatedHiddenCosts)}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-[#E7E5E4] flex justify-between font-semibold text-[#1C1917] text-sm">
                  <span>True Effective Total:</span>
                  <span className="font-mono-numbers text-[#E05A47]">
                    {formatINR(quote.normalizedTotal)}
                  </span>
                </div>
              </div>

              {/* Red-Flag Exclusions */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-[#58413D] uppercase tracking-wider flex items-center gap-1">
                  <AlertOctagon className="w-3.5 h-3.5 text-amber-600" />
                  <span>Audit Findings</span>
                </div>
                <ul className="space-y-1 text-xs text-[#58413D]">
                  {quote.hiddenFeesFlagged.map((fee, idx) => (
                    <li
                      key={idx}
                      className="text-[11px] leading-snug flex items-start gap-1.5 bg-amber-50/60 p-1.5 rounded-sm border border-amber-100"
                    >
                      <span className="text-amber-700 font-bold shrink-0">•</span>
                      <span>{fee}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Negotiation CTA */}
            <button
              onClick={() => setSelectedScript(quote.negotiationScript)}
              className="mt-3 w-full py-1.5 px-2.5 text-xs font-semibold text-[#1C1917] bg-[#FAF8F5] border border-[#E7E5E4] hover:bg-[#F5F2EC] rounded-md transition-colors flex items-center justify-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#E05A47]" />
              <span>WhatsApp Counter-Offer</span>
            </button>
          </div>
        ))}
      </div>

      {/* WhatsApp Counter-Offer Script Modal */}
      {selectedScript && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E7E5E4] rounded-xl shadow-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E7E5E4]">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#16A34A]" />
                <h3 className="font-display font-semibold text-[#1C1917] text-sm">
                  Ready-to-Send WhatsApp Negotiation Message
                </h3>
              </div>
              <button
                onClick={() => setSelectedScript(null)}
                className="text-[#78716C] hover:text-[#1C1917]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#78716C]">
              Culturally calibrated for Indian wedding vendors: respectful, firm on local benchmarks, and polite.
            </p>

            <div className="bg-[#FAF8F5] border border-[#E7E5E4] rounded-lg p-3 text-xs text-[#1C1917] font-mono whitespace-pre-wrap leading-relaxed select-all">
              {selectedScript}
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-[#78716C]">
                Click copy and paste directly into WhatsApp
              </span>
              <button
                onClick={() => copyNegotiationScript(selectedScript)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-md transition-colors flex items-center gap-1.5 shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Script'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
