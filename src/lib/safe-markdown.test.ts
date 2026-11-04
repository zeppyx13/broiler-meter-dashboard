import { describe, expect, it } from "vitest";
import { renderSafeMarkdown } from "@/lib/safe-markdown";

describe("renderSafeMarkdown", () => {
    it("format tebal, miring, dan daftar", () => {
        expect(renderSafeMarkdown("**Air** turun *sedikit*")).toBe("<strong>Air</strong> turun <em>sedikit</em>");
        expect(renderSafeMarkdown("- kipas\n- lampu")).toContain("<ul><li>kipas</li>");
    });

    it("HTML dari jawaban AI tidak bisa dijalankan", () => {
        const out = renderSafeMarkdown('<img src=x onerror="alert(1)"><script>alert(2)</script>');
        expect(out).not.toMatch(/<img|<script/);
        expect(out).toContain("&lt;img");
        expect(out).toContain("&quot;");
    });
});
