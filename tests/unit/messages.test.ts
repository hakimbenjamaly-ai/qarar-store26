import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATES, intlPhone, messageLink, renderTemplate, templateFor } from "@/lib/messages";

const vars = { name: "Ali", order: "ORD-1", total: "100 LYD", remaining: "40 LYD", track_link: "https://x/track?n=ORD-1", store: "Qarar" };

describe("customer message templates", () => {
  it("replaces all known variables and leaves unknown text intact", () => {
    expect(renderTemplate("{name} {order} {total} {remaining} {track_link} {store} {other}", vars)).toBe("Ali ORD-1 100 LYD 40 LYD https://x/track?n=ORD-1 Qarar {other}");
  });
  it("uses custom template when set, default otherwise", () => {
    expect(templateFor({ "order.confirmed": { ar: "مخصص", en: "" } }, "order.confirmed", "ar")).toBe("مخصص");
    expect(templateFor({ "order.confirmed": { ar: "مخصص", en: "  " } }, "order.confirmed", "en")).toBe(DEFAULT_TEMPLATES["order.confirmed"].en);
    expect(templateFor(undefined, "order.delivered", "ar")).toBe(DEFAULT_TEMPLATES["order.delivered"].ar);
  });
  it("every default template exists in both languages", () => {
    for (const t of Object.values(DEFAULT_TEMPLATES)) {
      expect(t.ar.length).toBeGreaterThan(10);
      expect(t.en.length).toBeGreaterThan(10);
    }
  });
  it("converts Libyan phones to international format", () => {
    expect(intlPhone("0912345678")).toBe("218912345678");
    expect(intlPhone("+218 91 234 5678")).toBe("218912345678");
    expect(intlPhone("00218912345678")).toBe("218912345678");
    expect(intlPhone("912345678")).toBe("218912345678");
  });
  it("builds encoded whatsapp and sms links", () => {
    expect(messageLink("whatsapp", "0912345678", "مرحبا & شكرا")).toBe(`https://wa.me/218912345678?text=${encodeURIComponent("مرحبا & شكرا")}`);
    expect(messageLink("sms", "0912345678", "hi")).toBe("sms:+218912345678?body=hi");
  });
});
