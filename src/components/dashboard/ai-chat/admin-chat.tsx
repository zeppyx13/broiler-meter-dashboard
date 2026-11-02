"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, LoaderCircle, Bot, User, Trash2 } from "lucide-react";
import { sendAdminChat, type ChatMessage } from "@/lib/admin-chat-api";

// Render markdown sederhana — bold, bullet, newline
function renderMarkdown(text: string) {
    return text
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/^[\*\-] (.+)$/gm, "<li>$1</li>")
        .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
        .replace(/\n/g, "<br/>");
}

const SUGGESTED_QUESTIONS = [
    "Siapa tenant yang belum bayar paling lama?",
    "Kamar mana yang sudah kosong paling lama?",
    "Kontrak siapa yang mau habis bulan ini?",
    "Berikan ringkasan keuangan bulan ini",
    "Keluhan apa yang belum ditangani?",
];

export default function AdminChat() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (open && messages.length === 0) {
            setMessages([{
                role: "assistant",
                content: "Halo! Saya asisten AI Coasther. Saya bisa membantu Anda menganalisis data operasional, keuangan, dan penghuni kost. Apa yang ingin Anda ketahui?",
                timestamp: new Date().toISOString(),
            }]);
        }
    }, [open]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    async function handleSend(question?: string) {
        const text = (question ?? input).trim();
        if (!text || loading) return;

        const userMsg: ChatMessage = {
            role: "user",
            content: text,
            timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const historyToSend = messages
                .slice(1)
                .map((m) => ({ role: m.role, content: m.content }));

            const result = await sendAdminChat(text, historyToSend);

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: result.answer,
                    timestamp: result.timestamp,
                },
            ]);
        } catch (err: any) {
            console.error("[AdminChat] Error:", err?.response?.data || err.message);
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: "Maaf, terjadi kesalahan saat memproses pertanyaan Anda. Silakan coba lagi.",
                    timestamp: new Date().toISOString(),
                },
            ]);
        } finally {
            setLoading(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    function handleClear() {
        setMessages([{
            role: "assistant",
            content: "Percakapan dibersihkan. Ada yang bisa saya bantu?",
            timestamp: new Date().toISOString(),
        }]);
    }

    return (
        <>
            {/* Floating button */}
            <button
                onClick={() => setOpen((v) => !v)}
                suppressHydrationWarning
                className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 ${open ? "bg-[#2F2F2F]" : "bg-[#7B1113]"
                    }`}
            >
                {open ? (
                    <X size={22} className="text-white" />
                ) : (
                    <MessageSquare size={22} className="text-white" />
                )}
                {/* Unread dot — hanya muncul saat chat tertutup dan belum ada pesan */}
                {!open && messages.length === 0 && (
                    <span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-[#C6A971]" />
                )}
            </button>

            {/* Chat panel */}
            {open && (
                <div className="fixed bottom-24 right-6 z-50 flex w-96 flex-col overflow-hidden rounded-3xl border border-[#EAEAEA] bg-white shadow-2xl">

                    {/* Header */}
                    <div className="flex items-center justify-between bg-[#7B1113] px-5 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                                <Bot size={18} className="text-white" />
                            </div>
                            <div>
                                <p className="font-poppins text-sm font-semibold text-white">
                                    Coasther AI
                                </p>
                                <p className="font-inter text-xs text-white/70">
                                    Asisten manajemen kost
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleClear}
                            suppressHydrationWarning
                            title="Bersihkan percakapan"
                            className="rounded-xl p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex h-96 flex-col gap-3 overflow-y-auto px-4 py-4">
                        {messages.map((msg, i) => (
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
                                            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
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
                    {messages.length <= 1 && !loading && (
                        <div className="border-t border-[#EAEAEA] px-4 py-3">
                            <p className="mb-2 font-inter text-xs text-[#999]">Pertanyaan populer:</p>
                            <div className="flex flex-wrap gap-1.5">
                                {SUGGESTED_QUESTIONS.map((q) => (
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
                    <div className="border-t border-[#EAEAEA] px-4 py-3">
                        <div className="flex items-end gap-2">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Tanya sesuatu tentang data kost..."
                                rows={1}
                                suppressHydrationWarning
                                className="flex-1 resize-none rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-2.5 font-inter text-sm outline-none transition focus:border-[#7B1113] placeholder:text-[#BBB]"
                                style={{ maxHeight: "100px", overflowY: "auto" }}
                            />
                            <button
                                title="kirim"
                                onClick={() => handleSend()}
                                disabled={!input.trim() || loading}
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