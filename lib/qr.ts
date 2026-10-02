import QRCode from "qrcode";

/** Crisp SVG QR (black on white) for a member code. Rendered on the server. */
export function qrSvg(value: string): Promise<string> {
  return QRCode.toString(value, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
}
