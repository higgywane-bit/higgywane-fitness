/*
 * Thai QR (PromptPay) payload builder, EMVCo merchant-presented format.
 * Spec: Bank of Thailand "Thai QR Code Standard" (AID A000000677010111).
 */

function tlv(id: string, value: string) {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

/** CRC-16/CCITT-FALSE, as required by EMVCo tag 63 */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Phone numbers become 0066XXXXXXXXX; 13-digit IDs (tax/national) are used as-is. */
function formatTarget(id: string) {
  const digits = id.replace(/\D/g, "");
  if (digits.length >= 13) return { tag: "02", value: digits };
  return { tag: "01", value: ("0000000000000" + digits.replace(/^0/, "66")).slice(-13) };
}

export function promptPayPayload(promptPayId: string, amount?: number): string {
  const target = formatTarget(promptPayId);
  const merchant = tlv("00", "A000000677010111") + tlv(target.tag, target.value);
  const body =
    tlv("00", "01") +
    tlv("01", amount ? "12" : "11") + // 12 = dynamic (one-time amount)
    tlv("29", merchant) +
    tlv("58", "TH") +
    tlv("53", "764") + // THB
    (amount ? tlv("54", amount.toFixed(2)) : "");
  const withCrcTag = body + "6304";
  return withCrcTag + crc16(withCrcTag);
}
