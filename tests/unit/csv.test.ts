import { describe, expect, it } from "vitest";
import { csvObjects, parseCsv, toCsv } from "@/lib/csv";

describe("csv", () => {
  it("يكتب مع BOM ويهرّب الفواصل والتنصيص", () => {
    const out = toCsv(["أ", "ب"], [["x,y", 'قال "مرحبا"'], [null, 5]]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toContain('"x,y","قال ""مرحبا"""');
  });
  it("يقرأ ما يكتبه (رحلة كاملة)", () => {
    const rows = parseCsv(toCsv(["رقم", "عنوان"], [["DLV-1", "شارع 1,\nبجانب المسجد"]]));
    expect(rows).toEqual([["رقم", "عنوان"], ["DLV-1", "شارع 1,\nبجانب المسجد"]]);
  });
  it("يدعم الفاصلة المنقوطة من Excel العربي", () => {
    const o = csvObjects("رقم التوصيلة;الحالة\r\nDLV-1;تم التسليم للعميل\r\n");
    expect(o[0].get("رقم التوصيلة")).toBe("DLV-1");
    expect(o[0].get("الحالة")).toBe("تم التسليم للعميل");
    expect(o[0].line).toBe(2);
  });
});
