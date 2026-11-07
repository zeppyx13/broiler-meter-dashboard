"use client";

import { useState, useRef, useEffect } from "react";
import Swal from "sweetalert2";
import { MessageSquare, X, Send, LoaderCircle, Bot, User, Trash2 } from "lucide-react";
import type { ChatMessage } from "@/lib/admin-chat-api";
import { readData, writeData } from "@/lib/broiler-api";
import { useActiveCycle } from "@/lib/broiler-queries";
import { useBroiler } from "@/components/broiler/broiler-provider";
import { renderSafeMarkdown } from "@/lib/safe-markdown";
import { usePathname } from "next/navigation";
import { COPILOT_ASK_EVENT, focusRoomIdFromPath, KANDANG_QUESTIONS } from "@/lib/copilot-context";
import { apiErrorMessage } from "@/lib/api-error";

const FARM_QUESTIONS = [
    "Kandang mana yang konsumsi airnya paling tidak normal hari ini?",
    "Siklus mana yang sebentar lagi panen?",
    "Berikan ringkasan pemakaian listrik dan biaya energi bulan ini",
    "Bagaimana cara menghemat listrik kipas di siang hari?",
];

export default function AdminChat() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const b = useBroiler();
    // Di halaman detail kandang, Copilot otomatis fokus ke kandang tersebut; selain itu kandang terpilih.
    const focusRoomId = focusRoomIdFromPath(usePathname());
    const [requestedCoop, setRequestedCoop] = useState<number>();
    const [queuedAsk, setQueuedAsk] = useState<{ question: string; coopId?: number } | null>(null);
    const coopId = requestedCoop ?? focusRoomId ?? b.coopId;
    useEffect(() => setRequestedCoop(undefined), [focusRoomId, b.coopId]);
    const focusRoom = b.coops.find((c) => c.id === coopId);
    const suggestions = focusRoomId != null ? KANDANG_QUESTIONS : FARM_QUESTIONS;
    const cycle = useActiveCycle(coopId);
    // Satu percakapan server per kandang + sumber data; berganti kandang membuka percakapan baru.
    const [conversation, setConversation] = useState<{ key: string; id?: number; cycleId?: number | null }>({ key: "" });
    const conversationKey = `${b.user?.id ?? "none"}-${coopId ?? "none"}-${b.source}-${cycle.data?.cycle?.id ?? "none"}`;
    const scope = useRef(conversationKey);
    scope.current = conversationKey;
    const busy = useRef(false);
    const pendingRequest = useRef<{ key: string; text: string; id: string; conversationId?: number } | null>(null);
    const [messageScope, setMessageScope] = useState(conversationKey);
    const visibleMessages = messageScope === conversationKey ? messages : [];
    const historicalConversation = conversation.key === conversationKey && conversation.id != null && conversation.cycleId !== undefined && Number(conversation.cycleId ?? 0) !== Number(cycle.data?.cycle?.id ?? 0);
    const preserveScroll = useRef(false);
    useEffect(() => {
        scope.current = conversationKey;
        setMessages([]); setInput(""); setLoading(false); setMessageScope(conversationKey);
        setConversation({ key: conversationKey }); pendingRequest.current = null; busy.current = false; olderMessages.current = null;
        return () => { scope.current = "closed"; };
    }, [conversationKey]);

    useEffect(() => {
        if (!open) return;
        // Sapaan selalu di urutan pertama — pertanyaan dari tombol "Tanya Copilot" bisa masuk lebih dulu.
        setMessages((prev) => prev[0]?.role === "assistant" ? prev : [{
            role: "assistant",
            content: "Petunjuk Copilot: pilih kandang dan sumber data, lalu ajukan pertanyaan. Jawaban AI tersedia jika Gemini siap. Tombol di kanan atas membuka riwayat pribadi atau percakapan baru.",
            timestamp: new Date().toISOString(),
        }, ...prev]);
    }, [open, conversationKey]);

    useEffect(() => {
        if (!preserveScroll.current) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        preserveScroll.current = false;
    }, [messages]);

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    // Tombol "Tanya Copilot" di halaman lain (kartu peringatan, detail kandang).
    const handleSendRef = useRef<(q: string) => void>(() => {});
    useEffect(() => {
        const onAsk = (e: Event) => {
            const detail = (e as CustomEvent<{ question?: string; coopId?: number }>).detail;
            const question = detail?.question;
            setRequestedCoop(detail?.coopId);
            setOpen(true);
            if (question) setQueuedAsk({ question, coopId: detail?.coopId });
            else setTimeout(() => inputRef.current?.focus(), 0);
        };
        window.addEventListener(COPILOT_ASK_EVENT, onAsk);
        window.addEventListener("broiler:copilot", onAsk);
        return () => { window.removeEventListener(COPILOT_ASK_EVENT, onAsk); window.removeEventListener("broiler:copilot", onAsk); };
    }, []);

    async function handleSend(question?: string) {
        const text = (question ?? input).trim();
        if (!text || busy.current || !b.user || !coopId || cycle.isPending || historicalConversation) return;
        const requestScope = conversationKey;
        const previous = pendingRequest.current;
        const request = previous && previous.key === requestScope && previous.text === text ? previous : { key: requestScope, text, id: crypto.randomUUID(), conversationId: conversation.key === conversationKey ? conversation.id : undefined };
        const retry = request === previous;
        pendingRequest.current = request;
        busy.current = true;

        const userMsg: ChatMessage = {
            role: "user",
            content: text,
            timestamp: new Date().toISOString(),
        };

        if (!retry) setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            if (!coopId) throw new Error("Belum ada kandang yang bisa dianalisis.");
            // Server menyusun konteks kandang sendiri (snapshot terotorisasi), jadi cukup kirim pertanyaan.
            const result = await writeData<{ state: string; reason?: string; conversation_id?: number; message?: { content: string; created_at?: string } }>(
                "post",
                "/api/ai/copilot",
                { coop_id: coopId, source: b.source, conversation_id: request.conversationId, request_id: request.id, message: text }
            );
            if (scope.current !== requestScope) return;
            if (result.state !== "ready" || !result.message) {
                setMessages((prev) => [...prev, {
                    role: "assistant",
                    content: `Copilot belum tersedia (${result.reason ?? "layanan AI belum dikonfigurasi"}). Data kandang tetap bisa dilihat di halaman Ringkasan.`,
                    timestamp: new Date().toISOString(),
                }]);
                setInput(text);
                return;
            }
            pendingRequest.current = null;
            setConversation({ key: conversationKey, id: result.conversation_id });
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: result.message!.content,
                    timestamp: result.message!.created_at ?? new Date().toISOString(),
                },
            ]);
        } catch (err) {
            if (scope.current !== requestScope) return;
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: `Permintaan belum selesai: ${apiErrorMessage(err)}. Kirim ulang teks yang sama untuk menggunakan ID permintaan yang sama.`,
                    timestamp: new Date().toISOString(),
                },
            ]);
            setInput(text);
        } finally {
            if (scope.current === requestScope) { busy.current = false; setLoading(false); }
        }
    }

    useEffect(() => {
        handleSendRef.current = handleSend;
    });
    useEffect(() => {
        if (!queuedAsk || loading || cycle.isPending || !b.user || !coopId || queuedAsk.coopId != null && queuedAsk.coopId !== coopId) return;
        setQueuedAsk(null);
        handleSendRef.current(queuedAsk.question);
    }, [queuedAsk, loading, cycle.isPending, b.user, coopId, conversationKey]);

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    async function handleClear() {
        if (busy.current || !coopId || !b.user) return;
        const requestScope = conversationKey;
        busy.current = true; setLoading(true);
        let before: number | undefined;
        try {
            for (;;) {
                const page = await readData<{ conversations: { id: number; title: string; source: string | null; flock_cycle_id: number | null }[]; next_before_id: number | null }>("/api/ai/conversations", { coop_id: coopId, limit: 50, before_id: before });
                if (scope.current !== requestScope) return;
                const options = Object.fromEntries(page.conversations.filter((c) => !c.source || c.source === b.source).map((c) => [String(c.id), `${c.title} · #${c.id} · siklus ${c.flock_cycle_id ?? "tanpa siklus"}`]));
                const choice = await Swal.fire({ title: "Riwayat Copilot pribadi", text: `Kandang ${focusRoom?.code ?? coopId} · ${b.source}. Histori tersimpan di server.`, input: "select", inputOptions: { "": "Percakapan baru", ...options }, showCancelButton: true, cancelButtonText: "Kembali", showDenyButton: Boolean(page.next_before_id), denyButtonText: "Sesi lebih lama", confirmButtonText: "Buka", confirmButtonColor: "#7B1113" });
                if (scope.current !== requestScope) return;
                if (choice.isDenied && page.next_before_id) { before = page.next_before_id; continue; }
                if (!choice.isConfirmed) return;
                pendingRequest.current = null; setInput("");
                if (!choice.value) { setConversation({ key: requestScope }); setMessages([]); olderMessages.current = null; return; }
                const id = Number(choice.value);
                const result = await readData<{ messages: { role: string; content: string; created_at: string; context: { source: string } }[]; next_before_id: number | null }>(`/api/ai/conversations/${id}/messages`, { limit: 50 });
                if (scope.current !== requestScope) return;
                if (result.messages.some((m) => m.context.source !== b.source)) throw new Error("Sumber percakapan berbeda; pilih sesi untuk sumber ini.");
                setConversation({ key: requestScope, id, cycleId: page.conversations.find((c) => c.id === id)?.flock_cycle_id });
                setMessages([...result.messages].reverse().map((m) => ({ role: m.role === "user" ? "user" as const : "assistant" as const, content: m.content, timestamp: m.created_at })));
                olderMessages.current = result.next_before_id;
                return;
            }
        } catch (error) {
            if (scope.current === requestScope) await Swal.fire({ icon: "error", title: "Riwayat belum dapat dimuat", text: apiErrorMessage(error), confirmButtonColor: "#7B1113" });
        } finally { if (scope.current === requestScope) { busy.current = false; setLoading(false); } }
    }
    const olderMessages = useRef<number | null>(null);
    async function loadOlder() {
        if (busy.current || !olderMessages.current || !conversation.id || conversation.key !== conversationKey) return;
        const requestScope = conversationKey; busy.current = true;
        try {
            const page = await readData<{ messages: { role: string; content: string; created_at: string; context: { source: string } }[]; next_before_id: number | null }>(`/api/ai/conversations/${conversation.id}/messages`, { before_id: olderMessages.current, limit: 50 });
            if (scope.current !== requestScope) return;
            if (page.messages.some((m) => m.context.source !== b.source)) throw new Error("Sumber percakapan berbeda.");
            olderMessages.current = page.next_before_id;
            preserveScroll.current = true;
            setMessages((prev) => [...page.messages].reverse().map((m): ChatMessage => ({ role: m.role === "user" ? "user" : "assistant", content: m.content, timestamp: m.created_at })).concat(prev));
        } catch (error) {
            if (scope.current === requestScope) await Swal.fire({ icon: "error", title: "Pesan sebelumnya belum dapat dimuat", text: apiErrorMessage(error), confirmButtonColor: "#7B1113" });
        } finally { if (scope.current === requestScope) busy.current = false; }
    }

    return (
        <>
            {/* Floating button */}
            <button
                onClick={() => setOpen((v) => !v)}
                suppressHydrationWarning
                title="Copilot"
                className={`fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 lg:bottom-6 lg:right-6 ${open ? "bg-[#2F2F2F]" : "bg-[#7B1113]"
                    }`}
            >
                {open ? (
                    <X size={22} className="text-white" />
                ) : (
                    <MessageSquare size={22} className="text-white" />
                )}
                {/* Unread dot — hanya muncul saat chat tertutup dan belum ada pesan */}
                {!open && visibleMessages.length === 0 && (
                    <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-[#C6A971]" />
                )}
            </button>

            {/* Chat panel */}
            {open && (
                <div className="fixed bottom-40 left-4 right-4 z-50 flex max-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-3xl border border-[#EAEAEA] bg-white shadow-2xl sm:left-auto sm:w-96 lg:bottom-24 lg:right-6 lg:max-h-[calc(100dvh-7.5rem)]">

                    {/* Header */}
                    <div className="flex shrink-0 items-center justify-between bg-[#7B1113] px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                                <Bot size={18} className="text-white" />
                            </div>
                            <div>
                                <p className="font-poppins text-sm font-semibold text-white">
                                    Copilot Coasther
                                </p>
                                <p className="font-inter text-xs text-white/70">
                                    {focusRoom ? `Fokus: Kandang ${focusRoom.code} · ${b.source === "simulation" ? "SIMULASI" : "REAL"}` : "Pilih kandang dulu"}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleClear}
                            suppressHydrationWarning
                            title="Percakapan baru / riwayat pribadi"
                            className="rounded-xl p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>

                    {/* Messages */}
                    {/* Area pesan menyusut lebih dulu bila layar pendek, header & input tetap terlihat. */}
                    <div onScroll={(event) => { if (event.currentTarget.scrollTop === 0) void loadOlder(); }} className="flex h-96 min-h-24 flex-col gap-3 overflow-y-auto px-4 py-4">
                        {visibleMessages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                            >
                                {/* Avatar */}
                                <div className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${msg.role === "user"
                                    ? "bg-[#7B1113]"
                                    : "bg-[#F0F0F0]"
                                    }`}>
                                    {msg.role === "user"
                                        ? <User size={13} className="text-white" />
                                        : <Bot size={13} className="text-[#555]" />
                                    }
                                </div>

                                {/* Bubble */}
                                <div className={`max-w-[80%] rounded-2xl px-4 py-3 font-inter text-sm leading-relaxed ${msg.role === "user"
                                    ? "rounded-tr-sm bg-[#7B1113] text-white"
                                    : "rounded-tl-sm bg-[#F8F8F8] text-[#2F2F2F]"
                                    }`}>
                                    {msg.role === "assistant" ? (
                                        <div
                                            dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(msg.content) }}
                                            className="[&_ul]:mt-1 [&_ul]:space-y-1 [&_li]:ml-3 [&_li]:list-disc"
                                        />
                                    ) : (
                                        msg.content
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Loading bubble */}
                        {loading && (
                            <div className="flex gap-2">
                                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F0F0F0]">
                                    <Bot size={13} className="text-[#555]" />
                                </div>
                                <div className="rounded-2xl rounded-tl-sm bg-[#F8F8F8] px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                        <LoaderCircle size={14} className="animate-spin text-[#7B1113]" />
                                        <span className="font-inter text-xs text-[#777]">Sedang menganalisis data...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Suggested questions — hanya tampil saat baru mulai */}
                    {visibleMessages.length <= 1 && !loading && (
                        <div className="max-h-40 shrink-0 overflow-y-auto border-t border-[#EAEAEA] px-4 py-3">
                            <p className="mb-2 font-inter text-xs text-[#999]">Pertanyaan populer:</p>
                            <div className="flex flex-wrap gap-1.5">
                                {suggestions.map((q) => (
                                    <button
                                        key={q}
                                        onClick={() => handleSend(q)}
                                        suppressHydrationWarning
                                        className="rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] px-3 py-1.5 font-inter text-xs text-[#555] transition hover:border-[#7B1113]/30 hover:bg-[#F8F1E7] hover:text-[#7B1113]"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input */}
                    <div className="shrink-0 border-t border-[#EAEAEA] px-4 py-3">
                        <div className="flex items-end gap-2">
                            <textarea
                                ref={inputRef}
                                value={messageScope === conversationKey ? input : ""}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={historicalConversation ? "Riwayat siklus lama; buka percakapan baru untuk mengirim." : "Tanya sesuatu tentang data kandang..."}
                                rows={1}
                                maxLength={2000}
                                suppressHydrationWarning
                                className="flex-1 resize-none rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-2.5 font-inter text-sm outline-none transition focus:border-[#7B1113] placeholder:text-[#BBB]"
                                style={{ maxHeight: "100px", overflowY: "auto" }}
                            />
                            <button
                                title="kirim"
                                onClick={() => handleSend()}
                                disabled={!input.trim() || loading || !coopId || !b.user || cycle.isPending || historicalConversation}
                                suppressHydrationWarning
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#7B1113] transition hover:opacity-90 disabled:opacity-40"
                            >
                                <Send size={15} className="text-white" />
                            </button>
                        </div>
                        <p className="mt-1.5 font-inter text-[10px] text-[#CCC]">
                            Enter untuk kirim · Shift+Enter untuk baris baru
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
