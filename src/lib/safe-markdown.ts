// Markdown sederhana (tebal, miring, daftar, baris baru) untuk jawaban AI.
// Seluruh HTML di teks di-escape lebih dulu, jadi jawaban yang memuat tag
// (misal dari deskripsi kandang atau pertanyaan) tidak bisa menjalankan script.

function escapeHtml(text: string) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function renderSafeMarkdown(text: string): string {
    return escapeHtml(text)
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/^[*-] (.+)$/gm, "<li>$1</li>")
        .replace(/(<li>[\s\S]*<\/li>)/g, "<ul>$1</ul>")
        .replace(/\n/g, "<br/>");
}
