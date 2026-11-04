// Adapter axios untuk mode demo: setiap pemanggilan `api.get/post/...` dijawab
// oleh backend tiruan di browser dengan bentuk respons yang sama seperti backend
// Coasther asli. Fungsi-fungsi di src/lib/*-api.ts tidak perlu diubah.

import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import type { Lease } from "@/types/lease";
import type { Room } from "@/types/room";
import type { Meter } from "@/types/meter";
import { DEMO_USER, getDB, saveDB } from "./db";
import { isDeviceCommand, liveStatusList, runDeviceCommand, startTicker } from "./runtime";
import { copilotAnswer } from "./copilot";

class HttpError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

type Body = Record<string, unknown>;

function parseBody(data: unknown): Body {
    if (!data) return {};
    if (typeof data === "string") {
        try {
            return JSON.parse(data);
        } catch {
            return {};
        }
    }
    return data as Body;
}

const ok = (data: unknown, message = "OK") => ({ success: true, message, data });
const nowIso = () => new Date().toISOString();
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function paginate<T>(items: T[], params: Body) {
    const limit = Number(params.limit ?? 20) || 20;
    const page = Number(params.page ?? 1) || 1;
    return { items: items.slice((page - 1) * limit, page * limit), meta: { total: items.length, page, limit } };
}

function withOccupancy(room: Room): Room {
    const occupied = getDB().leases.some((l) => l.room_id === room.id && l.status === "active");
    return { ...room, is_occupied: occupied };
}

function findRoom(id: number) {
    const room = getDB().rooms.find((r) => r.id === id);
    if (!room) throw new HttpError(404, "Kandang tidak ditemukan.");
    return room;
}

/** Perkecil foto sebelum disimpan (localStorage terbatas). */
async function fileToDataUrl(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
}

async function route(method: string, path: string, params: Body, rawData: unknown, authed: boolean): Promise<unknown> {
    const body = parseBody(rawData);
    const db = getDB();
    let m: RegExpMatchArray | null;

    // ── Auth ──
    if (method === "post" && path === "/api/auth/login") {
        if (!body.email || !body.password) throw new HttpError(400, "Email dan password wajib diisi.");
        const user = db.users[0] ?? DEMO_USER;
        return ok({ token: `demo-${Date.now().toString(36)}`, user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone } }, "Login berhasil");
    }
    if (!authed) throw new HttpError(401, "Sesi berakhir, silakan login ulang.");

    // ── Kandang ──
    if (method === "get" && path === "/api/rooms/all") {
        const search = String(params.search ?? "").toLowerCase();
        const rooms = db.rooms.filter((r) => !search || r.number.toLowerCase().includes(search)).map(withOccupancy);
        const { items, meta } = paginate(rooms, params);
        return ok({ rooms: items, meta });
    }
    if ((m = path.match(/^\/api\/rooms\/(\d+)$/))) {
        const id = Number(m[1]);
        if (method === "get") return ok({ room: { ...withOccupancy(findRoom(id)), facilities: [] } });
        if (method === "patch") {
            const room = findRoom(id);
            Object.assign(room, pickRoomFields(body), { updated_at: nowIso() });
            db.leases.forEach((l) => {
                if (l.room_id === id) Object.assign(l, { room_number: room.number, room_floor: room.floor ?? 0 });
            });
            db.meters.forEach((mt) => {
                if (mt.room_id === id) Object.assign(mt, { room_number: room.number, room_floor: room.floor ?? 0 });
            });
            saveDB();
            return ok({ room }, "Kandang diperbarui");
        }
        if (method === "delete") {
            findRoom(id);
            if (db.leases.some((l) => l.room_id === id && l.status === "active")) throw new HttpError(400, "Kandang masih punya siklus berjalan. Tutup siklusnya dulu.");
            db.rooms = db.rooms.filter((r) => r.id !== id);
            db.meters = db.meters.filter((mt) => mt.room_id !== id);
            saveDB();
            return ok(null, "Kandang dihapus");
        }
    }
    if (method === "post" && path === "/api/rooms") {
        if (!body.number) throw new HttpError(400, "Nama kandang wajib diisi.");
        if (db.rooms.some((r) => r.number.toLowerCase() === String(body.number).toLowerCase())) throw new HttpError(400, "Nama kandang sudah dipakai.");
        const room: Room = {
            id: ++db.seq.room,
            number: String(body.number),
            floor: null,
            price_monthly: 1,
            deposit: 0,
            is_available: true,
            description: null,
            main_image_url: null,
            is_occupied: false,
            created_at: nowIso(),
            updated_at: nowIso(),
            facilities: [],
            ...pickRoomFields(body),
        };
        db.rooms.push(room);
        // Alat IoT baru ikut terpasang di kandang baru.
        (["water", "electricity"] as const).forEach((type) => {
            db.meters.push({
                id: ++db.seq.meter, room_id: room.id, type, device_uid: `ESP32-${room.number}`, unit: type === "water" ? "m3" : "kwh",
                is_active: true, installed_at: nowIso().slice(0, 10), created_at: nowIso(), updated_at: nowIso(),
                room_number: room.number, room_floor: room.floor ?? 0,
            });
        });
        saveDB();
        return ok({ room, id: room.id }, "Kandang ditambahkan");
    }
    if (method === "post" && path === "/api/upload/room-image") {
        const file = rawData instanceof FormData ? rawData.get("image") : null;
        if (!(file instanceof File)) throw new HttpError(400, "File foto tidak ditemukan.");
        return ok({ url: await fileToDataUrl(file) }, "Foto diunggah");
    }

    // ── Siklus (leases) ──
    if (method === "get" && path === "/api/leases") {
        const leases = db.leases
            .filter((l) => !params.status || l.status === params.status)
            .sort((a, b) => b.start_date.localeCompare(a.start_date) || b.id - a.id);
        const { items, meta } = paginate(leases, params);
        return ok({ leases: items, meta });
    }
    if (method === "post" && path === "/api/leases") {
        const room = findRoom(Number(body.room_id));
        if (db.leases.some((l) => l.room_id === room.id && l.status === "active")) throw new HttpError(400, "Kandang ini masih punya siklus berjalan.");
        const user = db.users[0] ?? DEMO_USER;
        const lease: Lease = {
            id: ++db.seq.lease,
            user_id: user.id,
            room_id: room.id,
            start_date: String(body.start_date ?? nowIso().slice(0, 10)).slice(0, 10),
            end_date: (body.end_date as string | null) ?? null,
            status: "active",
            monthly_rent_snapshot: Number(body.monthly_rent_snapshot ?? 1),
            note: (body.note as string | null) ?? null,
            created_at: nowIso(),
            updated_at: nowIso(),
            tenant_name: user.name,
            tenant_email: user.email,
            room_number: room.number,
            room_floor: room.floor ?? 0,
        };
        db.leases.push(lease);
        saveDB();
        return ok({ lease, id: lease.id }, "Siklus dimulai");
    }
    if ((m = path.match(/^\/api\/leases\/(\d+)$/))) {
        const id = Number(m[1]);
        const lease = db.leases.find((l) => l.id === id);
        if (!lease) throw new HttpError(404, "Siklus tidak ditemukan.");
        if (method === "patch") {
            const allowed = ["end_date", "status", "monthly_rent_snapshot", "note"] as const;
            allowed.forEach((k) => {
                if (k in body) (lease as Record<string, unknown>)[k] = body[k];
            });
            lease.updated_at = nowIso();
            saveDB();
            return ok({ lease }, "Siklus diperbarui");
        }
        if (method === "delete") {
            db.leases = db.leases.filter((l) => l.id !== id);
            saveDB();
            return ok(null, "Siklus dihapus");
        }
    }

    // ── Tarif ──
    if (path === "/api/tariff") {
        if (method === "get") return ok(db.tariff);
        if (method === "put") {
            const fields = ["water_rate", "water_free_quota", "electricity_rate", "electricity_free_quota", "late_fee_flat"] as const;
            fields.forEach((k) => {
                if (body[k] != null && !Number.isNaN(Number(body[k]))) db.tariff[k] = Number(body[k]);
            });
            db.tariff.updated_at = nowIso();
            saveDB();
            return ok(db.tariff, "Tarif diperbarui");
        }
    }

    // ── IoT ──
    if (method === "get" && path === "/api/iot/live-status") {
        startTicker();
        return ok(liveStatusList());
    }
    if (method === "post" && (m = path.match(/^\/api\/iot\/relay\/(\d+)$/))) {
        if (!isDeviceCommand(body.command)) throw new HttpError(400, "Perintah tidak dikenal.");
        try {
            return ok(null, runDeviceCommand(Number(m[1]), body.command));
        } catch (err) {
            throw new HttpError(409, err instanceof Error ? err.message : "Perangkat tidak merespons.");
        }
    }
    if (path === "/api/meters" && method === "get") {
        const meters = db.meters.filter((mt) =>
            (params.room_id == null || mt.room_id === Number(params.room_id)) &&
            (params.type == null || mt.type === params.type) &&
            (params.is_active == null || Number(Boolean(mt.is_active)) === Number(params.is_active)));
        return ok({ meters });
    }
    if (path === "/api/meters" && method === "post") {
        const room = findRoom(Number(body.room_id));
        if (!body.device_uid) throw new HttpError(400, "Device UID wajib diisi.");
        const meter: Meter = {
            id: ++db.seq.meter,
            room_id: room.id,
            type: body.type === "electricity" ? "electricity" : "water",
            device_uid: String(body.device_uid),
            unit: body.unit === "kwh" ? "kwh" : "m3",
            is_active: body.is_active ?? true,
            installed_at: (body.installed_at as string | null) ?? null,
            created_at: nowIso(),
            updated_at: nowIso(),
            room_number: room.number,
            room_floor: room.floor ?? 0,
        } as Meter;
        db.meters.push(meter);
        saveDB();
        return ok({ meter }, "Meter ditambahkan");
    }
    if ((m = path.match(/^\/api\/meters\/(\d+)$/))) {
        const id = Number(m[1]);
        const meter = db.meters.find((mt) => mt.id === id);
        if (!meter) throw new HttpError(404, "Meter tidak ditemukan.");
        if (method === "patch") {
            (["device_uid", "unit", "is_active", "installed_at"] as const).forEach((k) => {
                if (k in body) (meter as Record<string, unknown>)[k] = body[k];
            });
            meter.updated_at = nowIso();
            saveDB();
            return ok({ meter }, "Meter diperbarui");
        }
        if (method === "delete") {
            db.meters = db.meters.filter((mt) => mt.id !== id);
            saveDB();
            return ok(null, "Meter dihapus");
        }
    }

    // ── Profil peternak ──
    if (method === "get" && path === "/api/users-admin") {
        const { items, meta } = paginate(db.users, params);
        return ok({ users: items, meta });
    }
    if ((m = path.match(/^\/api\/users-admin\/(\d+)$/))) {
        const user = db.users.find((u) => u.id === Number(m![1]));
        if (!user) throw new HttpError(404, "Pengguna tidak ditemukan.");
        if (method === "patch") {
            if (typeof body.name === "string" && body.name.trim()) user.name = body.name.trim();
            if ("phone" in body) user.phone = (body.phone as string | null) || null;
            user.updated_at = nowIso();
            db.leases.forEach((l) => {
                if (l.user_id === user.id) l.tenant_name = user.name;
            });
            saveDB();
            return ok({ user }, "Profil diperbarui");
        }
        if (method === "delete") throw new HttpError(400, "Akun peternak tidak bisa dihapus di mode demo.");
    }

    // ── Copilot ──
    if (method === "post" && path === "/api/ai/admin-chat") {
        await delay(700 + Math.random() * 700);
        return ok({ answer: copilotAnswer(String(body.question ?? "")), timestamp: nowIso() });
    }

    throw new HttpError(404, `Endpoint ${method.toUpperCase()} ${path} tidak tersedia di mode demo.`);
}

function pickRoomFields(body: Body): Partial<Room> {
    const out: Partial<Room> = {};
    if (typeof body.number === "string" && body.number.trim()) out.number = body.number.trim();
    if ("floor" in body) out.floor = body.floor == null || body.floor === "" ? null : Number(body.floor);
    if ("description" in body) out.description = (body.description as string | null) || null;
    if ("main_image_url" in body) out.main_image_url = (body.main_image_url as string | null) || null;
    if ("price_monthly" in body) out.price_monthly = Number(body.price_monthly) || 1;
    if ("is_available" in body) out.is_available = Boolean(body.is_available);
    return out;
}

function pathOf(config: InternalAxiosRequestConfig) {
    const url = config.url ?? "";
    try {
        return new URL(url, "http://demo.local").pathname;
    } catch {
        return url.split("?")[0];
    }
}

export const mockAdapter: AxiosAdapter = async (config) => {
    // Latensi jaringan kecil agar loading state tetap terasa wajar.
    await delay(120 + Math.random() * 180);

    const method = (config.method ?? "get").toLowerCase();
    const path = pathOf(config);
    const headers = AxiosHeaders.from(config.headers as never);
    const authed = Boolean(headers.get("Authorization"));

    try {
        const data = await route(method, path, (config.params ?? {}) as Body, config.data, authed);
        const response: AxiosResponse = { data, status: 200, statusText: "OK", headers: {}, config, request: {} };
        return response;
    } catch (err) {
        const status = err instanceof HttpError ? err.status : 500;
        const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
        const response: AxiosResponse = { data: { success: false, message }, status, statusText: message, headers: {}, config, request: {} };
        throw new AxiosError(message, status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, {}, response);
    }
};
