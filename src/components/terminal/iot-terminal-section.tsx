"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { socket } from "@/lib/socket";
import { type LogEntry, type LogLevel, generateId, formatTs } from "../../types/terminal";
import TerminalHeader from "./terminal-header";
import TerminalLogPanel from "./terminal-log-panel";
import TerminalCommandPanel from "./terminal-command-panel";

function authHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function IotTerminalSection() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [input, setInput] = useState("");
    const [history, setHistory] = useState<string[]>([]);
    const [historyIdx, setHistoryIdx] = useState(-1);
    const [sending, setSending] = useState(false);
    const [mqttConnected, setMqttConnected] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [filterLevel, setFilterLevel] = useState<LogLevel | "ALL">("ALL");

    const logEndRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;

    // ── Log helpers ──
    const addLog = useCallback((entry: Omit<LogEntry, "id">) => {
        setLogs((prev) => {
            const next = [...prev, { ...entry, id: generateId() }];
            return next.length > 500 ? next.slice(next.length - 500) : next;
        });
    }, []);

    const sysLog = useCallback((msg: string, level: LogLevel = "SYSTEM") => {
        addLog({ level, msg, ts: new Date().toISOString(), source: "system" });
    }, [addLog]);

    // ── Socket.IO ──
    useEffect(() => {
        socket.connect();

        socket.on("connect", () => {
            setMqttConnected(true);
            sysLog("Socket.IO terhubung ke server.");
        });

        socket.on("disconnect", () => {
            setMqttConnected(false);
            sysLog("Socket.IO terputus.", "WARN");
        });

        socket.on("iot_log", (payload: { level: string; msg: string; ts: string }) => {
            addLog({
                level: (payload.level as LogLevel) ?? "INFO",
                msg: payload.msg,
                ts: payload.ts ?? new Date().toISOString(),
                source: "mqtt",
            });
        });

        sysLog("Terminal siap. Subscribe ke coasther/device/+/log");

        return () => {
            socket.off("connect");
            socket.off("disconnect");
            socket.off("iot_log");
            socket.disconnect();
        };
    }, [addLog, sysLog]);

    // ── Auto scroll ──
    useEffect(() => {
        if (autoScroll && logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, autoScroll]);

    // ── Send command ──
    async function sendCommand(rawCmd: string) {
        const cmd = rawCmd.trim().toLowerCase();
        if (!cmd) return;

        setHistory((prev) => {
            const next = [cmd, ...prev.filter((h) => h !== cmd)];
            return next.slice(0, 50);
        });
        setHistoryIdx(-1);
        sysLog(`> ${cmd}`, "SYSTEM");
        setSending(true);

        try {
            await api.post(`/api/iot/relay/1`, { command: cmd }, { headers: authHeader() });
            sysLog(`Command "${cmd}" berhasil dikirim.`, "INFO");
        } catch (err: any) {
            const msg = err?.response?.data?.message || "Gagal mengirim command.";
            sysLog(`Error: ${msg}`, "ERROR");
        } finally {
            setSending(false);
        }
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!input.trim()) return;
        sendCommand(input);
        setInput("");
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "ArrowUp") {
            e.preventDefault();
            const idx = Math.min(historyIdx + 1, history.length - 1);
            setHistoryIdx(idx);
            setInput(history[idx] ?? "");
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            const idx = Math.max(historyIdx - 1, -1);
            setHistoryIdx(idx);
            setInput(idx === -1 ? "" : history[idx] ?? "");
        }
    }

    function clearLogs() {
        setLogs([]);
        sysLog("Log dibersihkan.");
    }

    function exportLogs() {
        const content = logs
            .map((l) => `[${formatTs(l.ts)}] [${l.level}] ${l.msg}`)
            .join("\n");
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `coasther-log-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const filteredLogs = filterLevel === "ALL"
        ? logs
        : logs.filter((l) => l.level === filterLevel);

    return (
        <div className="flex flex-col gap-4 h-[calc(100vh-120px)]">

            <TerminalHeader
                mqttConnected={mqttConnected}
                filterLevel={filterLevel}
                onFilterChange={setFilterLevel}
                onExport={exportLogs}
                onClear={clearLogs}
            />

            <div className="flex flex-1 gap-4 min-h-0">
                <TerminalLogPanel
                    logs={filteredLogs}
                    autoScroll={autoScroll}
                    sending={sending}
                    input={input}
                    logEndRef={logEndRef}
                    onToggleAutoScroll={() => setAutoScroll((v) => !v)}
                    onWheel={() => setAutoScroll(false)}
                    onInputChange={setInput}
                    onKeyDown={handleKeyDown}
                    onSubmit={handleSubmit}
                />

                <TerminalCommandPanel
                    sending={sending}
                    history={history}
                    onCommand={sendCommand}
                    onHistorySelect={(h) => setInput(h)}
                />
            </div>
        </div>
    );
}