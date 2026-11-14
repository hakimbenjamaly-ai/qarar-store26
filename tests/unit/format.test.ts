import { describe, expect, it } from "vitest";
import { normalizePhone, slugify } from "@/lib/format";

describe("normalizePhone", () => {
  it.each([
    ["0912345678", "0912345678"],
    ["+218 91 234 5678", "0912345678"],
    ["00218912345678", "0912345678"],
    ["912345678", "0912345678"],
    ["٠٩٢١٢٣٤٥٦٧", "0921234567"],
  ])("%s", (i, o) => expect(normalizePhone(i)).toBe(o));
  it("يرفض الأرقام غير الصحيحة", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("0212345678")).toBeNull();
  });
});

describe("slugify", () => {
  it("يحافظ على العربية", () => expect(slugify("  حذاء رياضي / أسود ")).toBe("حذاء-رياضي-أسود"));
});
