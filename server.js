// server/index.ts
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt2 from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv2 from "dotenv";
import path2 from "path";
import fs2 from "fs";

// server/db.ts
import pg from "pg";
import dotenv from "dotenv";

// server/local-db.ts
import fs from "fs";
import path from "path";
var DATA_DIR = path.resolve("server/data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
function readJSON(file, defaultData = []) {
  const filePath = path.join(DATA_DIR, file);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    return defaultData;
  }
}
function writeJSON(file, data) {
  const filePath = path.join(DATA_DIR, file);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
function emulateQuery(text, params = []) {
  const normalizedSQL = text.replace(/\s+/g, " ").trim();
  if (normalizedSQL.startsWith("SELECT * FROM users WHERE username = $1")) {
    const users = readJSON("users.json");
    const matched = users.find((u) => u.username === params[0]?.trim().toLowerCase());
    return { rows: matched ? [matched] : [] };
  }
  if (normalizedSQL.startsWith("INSERT INTO users")) {
    const users = readJSON("users.json");
    const username = params[0]?.trim().toLowerCase();
    const email = params[1];
    const name = params[2];
    const role = params[3];
    const password = params[4];
    const newUser = {
      uid: generateUUID(),
      username,
      email,
      name,
      role,
      password,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    users.push(newUser);
    writeJSON("users.json", users);
    return { rows: [newUser] };
  }
  if (normalizedSQL.startsWith("SELECT uid, username, email, name, role, created_at FROM users")) {
    const users = readJSON("users.json");
    return { rows: users };
  }
  if (normalizedSQL.startsWith("UPDATE users SET role = $1") || normalizedSQL.includes("UPDATE users")) {
    const users = readJSON("users.json");
    if (normalizedSQL.includes("role = $1") && normalizedSQL.includes("uid = $2")) {
      const idx = users.findIndex((u) => u.uid === params[1]);
      if (idx !== -1) {
        users[idx].role = params[0];
        writeJSON("users.json", users);
      }
    }
    return { rows: [] };
  }
  if (normalizedSQL.startsWith("SELECT * FROM customers")) {
    const customers = readJSON("customers.json");
    let list = [...customers];
    if (normalizedSQL.includes("assigned_lawyer_id = $1")) {
      list = list.filter((c) => c.assigned_lawyer_id === params[0]);
    }
    list.sort((a, b) => b.customer_number - a.customer_number);
    return { rows: list };
  }
  if (normalizedSQL.startsWith("SELECT * FROM attachments WHERE customer_id = $1")) {
    const attachments = readJSON("attachments.json");
    const filtered = attachments.filter((a) => a.customer_id === params[0] && !a.case_id);
    return { rows: filtered };
  }
  if (normalizedSQL.startsWith("SELECT * FROM attachments WHERE case_id = $1")) {
    const attachments = readJSON("attachments.json");
    const filtered = attachments.filter((a) => a.case_id === params[0]);
    return { rows: filtered };
  }
  if (normalizedSQL.startsWith("INSERT INTO customers")) {
    const customers = readJSON("customers.json");
    const maxNum = customers.reduce((max, c) => Math.max(max, c.customer_number || 1e3), 1e3);
    const nextNum = maxNum + 1;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newCust = {
      id: generateUUID(),
      customer_number: nextNum,
      name: params[0],
      phone: params[1],
      email: params[2],
      service: params[3],
      status: params[4] || "\u0642\u064A\u062F \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631",
      notes: params[5],
      receptionist_id: params[6],
      receptionist_name: params[7],
      case_type: params[8],
      assigned_lawyer_id: params[9],
      assigned_lawyer_name: params[10],
      priority: params[11] || "medium",
      estimated_fee: params[12] ? parseFloat(params[12]) : null,
      referral_source: params[13],
      created_at: now,
      updated_at: now
    };
    customers.push(newCust);
    writeJSON("customers.json", customers);
    return { rows: [newCust] };
  }
  if (normalizedSQL.startsWith("UPDATE customers")) {
    const customers = readJSON("customers.json");
    const id = params[6];
    const idx = customers.findIndex((c) => c.id === id);
    if (idx !== -1) {
      customers[idx] = {
        ...customers[idx],
        name: params[0],
        phone: params[1],
        email: params[2],
        service: params[3],
        status: params[4],
        notes: params[5],
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      writeJSON("customers.json", customers);
      return { rows: [customers[idx]] };
    }
    return { rows: [] };
  }
  if (normalizedSQL.startsWith("DELETE FROM customers WHERE id = $1")) {
    const customers = readJSON("customers.json");
    const filtered = customers.filter((c) => c.id !== params[0]);
    writeJSON("customers.json", filtered);
    return { rows: [] };
  }
  if (normalizedSQL.startsWith("SELECT * FROM cases")) {
    const cases = readJSON("cases.json");
    let list = [...cases];
    if (normalizedSQL.includes("lawyer_id = $1")) {
      list = list.filter((c) => c.lawyer_id === params[0]);
    }
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { rows: list };
  }
  if (normalizedSQL.startsWith("SELECT action_text FROM case_actions WHERE case_id = $1")) {
    const actions = readJSON("case_actions.json");
    const filtered = actions.filter((a) => a.case_id === params[0]);
    return { rows: filtered };
  }
  if (normalizedSQL.startsWith("SELECT note_text FROM case_notes WHERE case_id = $1")) {
    const notes = readJSON("case_notes.json");
    const filtered = notes.filter((n) => n.case_id === params[0]);
    return { rows: filtered };
  }
  if (normalizedSQL.startsWith("INSERT INTO cases")) {
    const cases = readJSON("cases.json");
    const newCase = {
      id: generateUUID(),
      case_number: params[0],
      title: params[1],
      customer_id: params[2],
      customer_name: params[3],
      description: params[4],
      status: params[5] || "\u0645\u0641\u062A\u0648\u062D",
      priority: params[6] || "medium",
      court: params[7],
      case_type: params[8],
      hearing_date: params[9],
      lawyer_id: params[10],
      lawyer_name: params[11],
      archived_by_id: params[12],
      archived_by_name: params[13],
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    cases.push(newCase);
    writeJSON("cases.json", cases);
    return { rows: [newCase] };
  }
  if (normalizedSQL.startsWith("UPDATE cases")) {
    const cases = readJSON("cases.json");
    const id = params[6];
    const idx = cases.findIndex((c) => c.id === id);
    if (idx !== -1) {
      cases[idx] = {
        ...cases[idx],
        status: params[0],
        priority: params[1],
        hearing_date: params[2],
        lawyer_id: params[3],
        lawyer_name: params[4],
        description: params[5]
      };
      writeJSON("cases.json", cases);
      return { rows: [cases[idx]] };
    }
    return { rows: [] };
  }
  if (normalizedSQL.startsWith("DELETE FROM cases WHERE id = $1")) {
    const cases = readJSON("cases.json");
    const filtered = cases.filter((c) => c.id !== params[0]);
    writeJSON("cases.json", filtered);
    return { rows: [] };
  }
  if (normalizedSQL.startsWith("INSERT INTO case_actions")) {
    const actions = readJSON("case_actions.json");
    const newAction = {
      id: generateUUID(),
      case_id: params[0],
      action_text: params[1],
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    actions.push(newAction);
    writeJSON("case_actions.json", actions);
    return { rows: [newAction] };
  }
  if (normalizedSQL.startsWith("INSERT INTO case_notes")) {
    const notes = readJSON("case_notes.json");
    const newNote = {
      id: generateUUID(),
      case_id: params[0],
      note_text: params[1],
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    notes.push(newNote);
    writeJSON("case_notes.json", notes);
    return { rows: [newNote] };
  }
  if (normalizedSQL.startsWith("INSERT INTO attachments")) {
    const attachments = readJSON("attachments.json");
    let newAttachment;
    if (normalizedSQL.includes("case_id")) {
      newAttachment = {
        id: generateUUID(),
        case_id: params[0],
        customer_id: params[1],
        name: params[2],
        url: params[3],
        size: params[4],
        uploaded_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    } else {
      newAttachment = {
        id: generateUUID(),
        customer_id: params[0],
        name: params[1],
        url: params[2],
        size: params[3],
        uploaded_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    attachments.push(newAttachment);
    writeJSON("attachments.json", attachments);
    return { rows: [newAttachment] };
  }
  if (normalizedSQL.startsWith("DELETE FROM attachments WHERE case_id = $1 AND name = $2")) {
    const attachments = readJSON("attachments.json");
    const filtered = attachments.filter((a) => !(a.case_id === params[0] && a.name === params[1]));
    writeJSON("attachments.json", filtered);
    return { rows: [] };
  }
  if (normalizedSQL.startsWith("SELECT * FROM appointments")) {
    const appts = readJSON("appointments.json");
    const list = [...appts];
    list.sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
    return { rows: list };
  }
  if (normalizedSQL.startsWith("INSERT INTO appointments")) {
    const appts = readJSON("appointments.json");
    const newAppt = {
      id: generateUUID(),
      title: params[0],
      case_id: params[1],
      case_number: params[2],
      case_title: params[3],
      date_time: params[4] instanceof Date ? params[4].toISOString() : new Date(params[4]).toISOString(),
      notes: params[5],
      created_by_id: params[6],
      created_by_name: params[7],
      status: "scheduled",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    appts.push(newAppt);
    writeJSON("appointments.json", appts);
    return { rows: [newAppt] };
  }
  if (normalizedSQL.startsWith("UPDATE appointments")) {
    const appts = readJSON("appointments.json");
    const id = params[7];
    const idx = appts.findIndex((a) => a.id === id);
    if (idx !== -1) {
      appts[idx] = {
        ...appts[idx],
        title: params[0],
        case_id: params[1],
        case_number: params[2],
        case_title: params[3],
        date_time: params[4] instanceof Date ? params[4].toISOString() : new Date(params[4]).toISOString(),
        notes: params[5],
        status: params[6]
      };
      writeJSON("appointments.json", appts);
      return { rows: [appts[idx]] };
    }
    return { rows: [] };
  }
  if (normalizedSQL.startsWith("DELETE FROM appointments WHERE id = $1")) {
    const appts = readJSON("appointments.json");
    const filtered = appts.filter((a) => a.id !== params[0]);
    writeJSON("appointments.json", filtered);
    return { rows: [] };
  }
  if (normalizedSQL.includes("chat_rooms")) {
    if (normalizedSQL.startsWith("SELECT r.* FROM chat_rooms r")) {
      const rooms = readJSON("chat_rooms.json");
      const participants = readJSON("chat_room_participants.json");
      const userId = params[0];
      const filtered = rooms.filter((r) => {
        if (r.type === "group") return true;
        return participants.some((p) => p.room_id === r.id && p.user_id === userId);
      });
      return { rows: filtered };
    }
  }
  if (normalizedSQL.startsWith("SELECT user_id FROM chat_room_participants WHERE room_id = $1")) {
    const participants = readJSON("chat_room_participants.json");
    const filtered = participants.filter((p) => p.room_id === params[0]).map((p) => ({ user_id: p.user_id }));
    return { rows: filtered };
  }
  if (normalizedSQL.startsWith("SELECT * FROM chat_messages WHERE room_id = $1")) {
    const messages = readJSON("chat_messages.json");
    const filtered = messages.filter((m) => m.room_id === params[0]);
    filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return { rows: filtered };
  }
  if (normalizedSQL.startsWith("INSERT INTO chat_messages")) {
    const messages = readJSON("chat_messages.json");
    const rooms = readJSON("chat_rooms.json");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newMsg = {
      id: generateUUID(),
      room_id: params[0],
      sender_id: params[1],
      sender_name: params[2],
      text: params[3],
      created_at: now
    };
    messages.push(newMsg);
    writeJSON("chat_messages.json", messages);
    const roomIdx = rooms.findIndex((r) => r.id === params[0]);
    if (roomIdx !== -1) {
      rooms[roomIdx].last_message_at = now;
      writeJSON("chat_rooms.json", rooms);
    }
    return { rows: [newMsg] };
  }
  if (normalizedSQL.startsWith("INSERT INTO chat_rooms")) {
    const rooms = readJSON("chat_rooms.json");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newRoom = {
      id: generateUUID(),
      type: params[0],
      name: params[1] || null,
      created_at: now,
      last_message_at: now
    };
    rooms.push(newRoom);
    writeJSON("chat_rooms.json", rooms);
    return { rows: [newRoom] };
  }
  if (normalizedSQL.startsWith("INSERT INTO chat_room_participants")) {
    const participants = readJSON("chat_room_participants.json");
    const newPart = {
      room_id: params[0],
      user_id: params[1]
    };
    const exists = participants.some((p) => p.room_id === params[0] && p.user_id === params[1]);
    if (!exists) {
      participants.push(newPart);
      writeJSON("chat_room_participants.json", participants);
    }
    return { rows: [newPart] };
  }
  if (normalizedSQL.startsWith("SELECT * FROM audit_logs") || normalizedSQL.includes("audit_logs")) {
    const logs = readJSON("audit_logs.json");
    const list = [...logs];
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { rows: list };
  }
  if (normalizedSQL.startsWith("INSERT INTO audit_logs")) {
    const logs = readJSON("audit_logs.json");
    const newLog = {
      id: generateUUID(),
      performed_by_uid: params[0],
      performed_by_name: params[1],
      performed_by_email: params[2],
      action: params[3],
      details: params[4],
      category: params[5] || "system",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    logs.push(newLog);
    writeJSON("audit_logs.json", logs);
    return { rows: [newLog] };
  }
  return { rows: [] };
}

// server/db.ts
dotenv.config();
var { Pool } = pg;
var actualPool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432", 10),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  database: process.env.PGDATABASE || "crm_system",
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : void 0
});
var isFallbackActive = false;
function activateFallback() {
  if (!isFallbackActive) {
    console.warn("\n\u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F");
    console.warn("PostgreSQL connection failed. Local JSON database fallback activated.");
    console.warn("Data will be safely stored and retrieved from server/data/*.json");
    console.warn("\u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F \u26A0\uFE0F\n");
    isFallbackActive = true;
  }
}
var wrappedPool = {
  async query(text, params) {
    if (isFallbackActive) {
      return emulateQuery(text, params || []);
    }
    try {
      return await actualPool.query(text, params);
    } catch (err) {
      if (err.code === "ECONNREFUSED" || err.message?.includes("connect ECONNREFUSED")) {
        activateFallback();
        return emulateQuery(text, params || []);
      }
      throw err;
    }
  },
  async connect() {
    if (isFallbackActive) {
      return {
        async query(text, params) {
          return emulateQuery(text, params || []);
        },
        release() {
        }
      };
    }
    try {
      const client = await actualPool.connect();
      const actualQuery = client.query.bind(client);
      client.query = async function(text, params) {
        try {
          return await actualQuery(text, params);
        } catch (err) {
          if (err.code === "ECONNREFUSED" || err.message?.includes("connect ECONNREFUSED")) {
            activateFallback();
            return emulateQuery(text, params || []);
          }
          throw err;
        }
      };
      return client;
    } catch (err) {
      if (err.code === "ECONNREFUSED" || err.message?.includes("connect ECONNREFUSED")) {
        activateFallback();
        return {
          async query(text, params) {
            return emulateQuery(text, params || []);
          },
          release() {
          }
        };
      }
      throw err;
    }
  }
};
var db_default = wrappedPool;

// server/init-db.ts
import bcrypt from "bcryptjs";
var schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_number SERIAL UNIQUE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(100),
  service VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  notes TEXT,
  receptionist_id UUID REFERENCES users(uid),
  receptionist_name VARCHAR(100),
  case_type VARCHAR(100),
  assigned_lawyer_id UUID REFERENCES users(uid),
  assigned_lawyer_name VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'medium',
  estimated_fee NUMERIC(12,2),
  referral_source VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(150) NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name VARCHAR(100) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL,
  court VARCHAR(100) NOT NULL,
  case_type VARCHAR(100) NOT NULL,
  hearing_date VARCHAR(50),
  lawyer_id UUID REFERENCES users(uid),
  lawyer_name VARCHAR(100),
  archived_by_id UUID REFERENCES users(uid),
  archived_by_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  action_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  size VARCHAR(50) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(150) NOT NULL,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  case_number VARCHAR(50),
  case_title VARCHAR(150),
  date_time TIMESTAMP NOT NULL,
  notes TEXT,
  created_by_id UUID REFERENCES users(uid),
  created_by_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  performed_by_uid UUID,
  performed_by_name VARCHAR(100),
  performed_by_email VARCHAR(100),
  details TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_room_participants (
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(uid) ON DELETE CASCADE,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(uid),
  sender_name VARCHAR(100) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;
async function initializeDatabase() {
  const client = await db_default.connect();
  try {
    console.log("Initializing database schema in PostgreSQL...");
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await client.query(schemaSql);
    console.log("Database tables verified/created successfully.");
    const adminCheck = await client.query("SELECT * FROM users WHERE username = $1", ["admin"]);
    if (adminCheck.rows.length === 0) {
      console.log("Seeding default administrator profile...");
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await client.query(
        `INSERT INTO users (uid, username, email, name, role, password) 
         VALUES ('e65bcae7-c6cd-4d89-98ee-62ebbf1f1228', $1, $2, $3, $4, $5)`,
        ["admin", "admin@lawfirm.local", "\u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0641\u0646\u064A", "super_admin", hashedPassword]
      );
      console.log("Admin profile bootstrapped successfully.");
    }
  } catch (err) {
    console.error("Error during database initialization:", err);
    throw err;
  } finally {
    client.release();
  }
}
var isDirectRun = process.argv[1]?.endsWith("init-db.ts") || process.argv[1]?.endsWith("init-db.js");
if (isDirectRun) {
  initializeDatabase().then(() => {
    console.log("Database initialized successfully.");
    process.exit(0);
  }).catch((err) => {
    console.error("Database initialization failed.", err);
    process.exit(1);
  });
}

// server/index.ts
dotenv2.config();
var app = express();
var PORT = process.env.PORT || 5e3;
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());
var allowedIpsEnv = process.env.ALLOWED_IPS || "";
var ALLOWED_IPS = allowedIpsEnv.split(",").map((ip) => ip.trim()).filter(Boolean);
app.use((req, res, next) => {
  if (ALLOWED_IPS.length === 0) {
    return next();
  }
  const clientIpHeader = req.headers["x-forwarded-for"];
  let clientIp = "";
  if (typeof clientIpHeader === "string") {
    clientIp = clientIpHeader.split(",")[0].trim();
  } else if (Array.isArray(clientIpHeader)) {
    clientIp = clientIpHeader[0].trim();
  } else {
    clientIp = req.socket.remoteAddress || "";
  }
  if (clientIp.startsWith("::ffff:")) {
    clientIp = clientIp.substring(7);
  }
  const isAllowed = ALLOWED_IPS.includes(clientIp) || clientIp === "127.0.0.1" || clientIp === "::1";
  if (!isAllowed) {
    console.warn(`Blocked unauthorized access attempt from IP: ${clientIp}`);
    return res.status(403).send(`
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 100px 20px; direction: rtl; background-color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box;">
        <div style="background-color: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 40px; max-width: 500px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);">
          <span style="font-size: 50px; display: block; margin-bottom: 20px;">\u{1F512}</span>
          <h1 style="color: #0f172a; font-size: 1.5rem; margin-bottom: 10px; font-family: sans-serif;">\u0639\u0630\u0631\u0627\u064B\u060C \u0627\u0644\u0648\u0635\u0648\u0644 \u063A\u064A\u0631 \u0645\u0635\u0631\u062D!</h1>
          <p style="color: #475569; font-size: 0.95rem; line-height: 1.6; margin-bottom: 25px;">\u064A\u064F\u0633\u0645\u062D \u0628\u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0647\u0630\u0647 \u0627\u0644\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629 \u0641\u0642\u0637 \u0645\u0646 \u0627\u0644\u0623\u062C\u0647\u0632\u0629 \u0648\u0627\u0644\u0623\u0645\u0627\u0643\u0646 \u0627\u0644\u0645\u0639\u062A\u0645\u062F\u0629 \u0627\u0644\u062A\u0627\u0628\u0639\u0629 \u0644\u0645\u0643\u062A\u0628 \u0627\u0644\u0639\u0645\u0644.</p>
          <div style="background-color: #f1f5f9; border-radius: 8px; padding: 12px; font-size: 0.9rem; color: #334155; font-family: monospace;">
            \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0640 IP \u0627\u0644\u062E\u0627\u0635 \u0628\u0643: <span style="font-weight: bold; color: #ef4444;">${clientIp}</span>
          </div>
          <p style="color: #94a3b8; font-size: 0.75rem; margin-top: 20px;">\u0625\u0630\u0627 \u0643\u0646\u062A \u062A\u0639\u062A\u0642\u062F \u0623\u0646 \u0647\u0630\u0627 \u062E\u0637\u0623\u060C \u064A\u0631\u062C\u0649 \u062A\u0632\u0648\u064A\u062F \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0641\u0646\u064A \u0628\u0646\u0633\u062E\u0629 \u0645\u0646 \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0640 IP \u0627\u0644\u062E\u0627\u0635 \u0628\u0643 \u0644\u0625\u0636\u0627\u0641\u062A\u0647 \u0644\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0628\u064A\u0636\u0627\u0621.</p>
        </div>
      </div>
    `);
  }
  next();
});
var DEVICES_FILE = path2.resolve("server/data/registered_devices.json");
var DEVICE_ACTIVATION_KEY = process.env.DEVICE_ACTIVATION_KEY || "Hajjaj2026";
var registeredDevices = [];
if (fs2.existsSync(DEVICES_FILE)) {
  try {
    registeredDevices = JSON.parse(fs2.readFileSync(DEVICES_FILE, "utf8"));
  } catch (err) {
    registeredDevices = [];
  }
}
function registerDeviceToken(token) {
  registeredDevices.push(token);
  try {
    const dir = path2.dirname(DEVICES_FILE);
    if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
    fs2.writeFileSync(DEVICES_FILE, JSON.stringify(registeredDevices, null, 2));
  } catch (err) {
    console.error("Failed to save registered device token:", err);
  }
}
app.post("/api/devices/activate", (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: "\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u062A\u0646\u0634\u064A\u0637." });
  }
  if (code.trim() === DEVICE_ACTIVATION_KEY) {
    const token = "dev_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    registerDeviceToken(token);
    res.cookie("device_token", token, {
      maxAge: 10 * 365 * 24 * 60 * 60 * 1e3,
      httpOnly: true,
      secure: false,
      sameSite: "lax"
    });
    return res.json({ success: true });
  } else {
    return res.status(403).json({ error: "\u0631\u0645\u0632 \u0627\u0644\u062A\u0646\u0634\u064A\u0637 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D." });
  }
});
app.use((req, res, next) => {
  if (req.path === "/api/devices/activate") {
    return next();
  }
  if (req.path.startsWith("/assets/") || req.path.includes("favicon") || req.path.startsWith("/dist/assets/") || req.path.includes(".css") || req.path.includes(".js") || req.path.includes(".png") || req.path.includes(".jpg")) {
    return next();
  }
  const deviceToken = req.cookies.device_token;
  if (deviceToken && registeredDevices.includes(deviceToken)) {
    return next();
  }
  return res.status(403).send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>\u062A\u0646\u0634\u064A\u0637 \u0627\u0644\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629 - \u0645\u0646\u0635\u0629 \u062D\u062C\u0627\u062C</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Cairo', sans-serif;
          background-color: #f4f6f8;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          direction: rtl;
        }
        .card {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          padding: 40px 30px;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 25px 50px -12px rgba(0, 77, 64, 0.12);
          text-align: center;
          box-sizing: border-box;
        }
        .logo-container {
          width: 80px;
          height: 80px;
          background-color: #1e3d30;
          border-radius: 24px;
          margin: 0 auto 24px auto;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px -5px rgba(30, 61, 48, 0.35);
          font-size: 2.2rem;
        }
        h1 {
          font-size: 1.4rem;
          color: #0f172a;
          margin: 0 0 10px 0;
          font-weight: 700;
        }
        p {
          font-size: 0.9rem;
          color: #475569;
          margin: 0 0 25px 0;
          line-height: 1.6;
        }
        .input-group {
          margin-bottom: 20px;
          text-align: right;
        }
        label {
          display: block;
          font-size: 0.8rem;
          font-weight: 700;
          color: #475569;
          margin-bottom: 6px;
        }
        input {
          width: 100%;
          padding: 14px 16px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          font-size: 1.1rem;
          box-sizing: border-box;
          outline: none;
          text-align: center;
          font-family: inherit;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        input:focus {
          border-color: #1e3d30;
          box-shadow: 0 0 0 3px rgba(30, 61, 48, 0.15);
        }
        button {
          width: 100%;
          padding: 14px;
          background-color: #1e3d30;
          color: #ffffff;
          border: none;
          border-radius: 12px;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        button:hover {
          background-color: #12251d;
        }
        .error {
          color: #ef4444;
          background-color: #fef2f2;
          border: 1px solid #fca5a5;
          padding: 12px;
          border-radius: 10px;
          font-size: 0.85rem;
          margin-bottom: 20px;
          display: none;
          line-height: 1.5;
        }
        .footer {
          margin-top: 25px;
          font-size: 0.75rem;
          color: #94a3b8;
          line-height: 1.5;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo-container">\u2696\uFE0F</div>
        <h1>\u062A\u0646\u0634\u064A\u0637 \u062C\u0647\u0627\u0632 \u062C\u062F\u064A\u062F</h1>
        <p>\u0639\u0630\u0631\u0627\u064B\u060C \u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632 \u063A\u064A\u0631 \u0645\u0633\u062C\u0644 \u0644\u0644\u0648\u0635\u0648\u0644 \u0644\u0644\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0642\u0636\u0627\u0626\u064A\u0629. \u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0631\u0645\u0632 \u062A\u0646\u0634\u064A\u0637 \u0627\u0644\u062C\u0647\u0627\u0632 \u0644\u0644\u0628\u062F\u0621 \u0628\u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0622\u0645\u0646.</p>
        
        <div id="error-message" class="error"></div>

        <form id="activation-form">
          <div class="input-group">
            <label for="activation-code">\u0631\u0645\u0632 \u062A\u0646\u0634\u064A\u0637 \u0627\u0644\u062C\u0647\u0627\u0632 (Activation Code)</label>
            <input type="password" id="activation-code" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" required autocomplete="off">
          </div>
          <button type="submit">\u062A\u0646\u0634\u064A\u0637 \u0648\u062A\u0648\u062B\u064A\u0642 \u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632</button>
        </form>

        <div class="footer">
          \u0625\u0630\u0627 \u0643\u0646\u062A \u062A\u0639\u062A\u0642\u062F \u0623\u0646 \u0647\u0630\u0627 \u062E\u0637\u0623\u060C \u064A\u0631\u062C\u0649 \u062A\u0632\u0648\u064A\u062F \u0627\u0644\u062F\u0639\u0645 \u0627\u0644\u0641\u0646\u064A \u0628\u0627\u0644\u0628\u0648\u0627\u0628\u0629 \u0644\u0637\u0644\u0628 \u0631\u0645\u0632 \u0627\u0644\u062A\u0646\u0634\u064A\u0637 \u0627\u0644\u062E\u0627\u0635 \u0628\u0643.
        </div>
      </div>

      <script>
        document.getElementById('activation-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const code = document.getElementById('activation-code').value.trim();
          const errorDiv = document.getElementById('error-message');
          
          errorDiv.style.display = 'none';

          try {
            const response = await fetch('/api/devices/activate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code })
            });
            const result = await response.json();
            if (result.success) {
              window.location.reload();
            } else {
              errorDiv.textContent = result.error || '\u0631\u0645\u0632 \u0627\u0644\u062A\u0646\u0634\u064A\u0637 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D.';
              errorDiv.style.display = 'block';
            }
          } catch (err) {
            errorDiv.textContent = '\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u062E\u0627\u062F\u0645\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u0627\u062D\u0642\u0627\u064B.';
            errorDiv.style.display = 'block';
          }
        });
      </script>
    </body>
    </html>
  `);
});
var formatDate = (d) => {
  if (!d) return (/* @__PURE__ */ new Date()).toISOString();
  if (typeof d === "string") return d;
  if (d instanceof Date) return d.toISOString();
  return new Date(d).toISOString();
};
var authMiddleware = (req, res, next) => {
  const token = req.cookies.session_token;
  if (!token) {
    return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D: \u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B." });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie("session_token");
    return res.status(401).json({ error: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u062C\u0644\u0633\u0629\u060C \u0627\u0644\u0631\u062C\u0627\u0621 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u062C\u062F\u062F\u0627\u064B." });
  }
};
var writeServerAuditLog = async (req, action, details, category = "system") => {
  const user = req.user;
  if (!user) return;
  try {
    await db_default.query(
      `INSERT INTO audit_logs (performed_by_uid, performed_by_name, performed_by_email, action, details, category)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.uid, user.name, user.email, action, details, category]
    );
  } catch (err) {
    console.error("Failed to save audit log:", err);
  }
};
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "\u0627\u0644\u0631\u062C\u0627\u0621 \u0625\u062F\u062E\u0627\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631." });
  }
  try {
    const normUser = username.trim().toLowerCase();
    const result = await db_default.query("SELECT * FROM users WHERE username = $1", [normUser]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "\u062E\u0637\u0623: \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629." });
    }
    const dbUser = result.rows[0];
    const match = await bcrypt2.compare(password, dbUser.password);
    if (!match) {
      return res.status(401).json({ error: "\u062E\u0637\u0623: \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629." });
    }
    const tokenPayload = {
      uid: dbUser.uid,
      username: dbUser.username,
      role: dbUser.role,
      name: dbUser.name,
      email: dbUser.email
    };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || "secret", {
      expiresIn: "30m"
    });
    res.cookie("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 60 * 1e3
      // 30 minutes
    });
    await db_default.query(
      `INSERT INTO audit_logs (performed_by_uid, performed_by_name, performed_by_email, action, details, category)
       VALUES ($1, $2, $3, '\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644', $4, 'auth')`,
      [dbUser.uid, dbUser.name, dbUser.email, `\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0622\u0645\u0646 \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${dbUser.name}`]
    );
    res.json(tokenPayload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645 \u0623\u062B\u0646\u0627\u0621 \u0645\u062D\u0627\u0648\u0644\u0629 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644." });
  }
});
app.post("/api/auth/logout", authMiddleware, async (req, res) => {
  try {
    await writeServerAuditLog(req, "\u062A\u0633\u062C\u064A\u0644 \u062E\u0631\u0648\u062C", `\u0645\u063A\u0627\u062F\u0631\u0629 \u0627\u0644\u0646\u0638\u0627\u0645 \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${req.user?.name}`, "auth");
    res.clearCookie("session_token");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C." });
  }
});
app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json(req.user);
});
app.get("/api/users", authMiddleware, async (req, res) => {
  try {
    const result = await db_default.query("SELECT uid, username, email, name, role, created_at FROM users");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062C\u0644\u0628 \u0642\u0627\u0626\u0645\u0629 \u0641\u0631\u064A\u0642 \u0627\u0644\u0639\u0645\u0644." });
  }
});
app.get("/api/customers", authMiddleware, async (req, res) => {
  try {
    let result;
    if (req.user?.role === "lawyer") {
      result = await db_default.query(
        "SELECT * FROM customers WHERE assigned_lawyer_id = $1 ORDER BY customer_number DESC",
        [req.user.uid]
      );
    } else {
      result = await db_default.query("SELECT * FROM customers ORDER BY customer_number DESC");
    }
    const customersList = [];
    for (const row of result.rows) {
      const attachResult = await db_default.query("SELECT * FROM attachments WHERE customer_id = $1", [row.id]);
      customersList.push({
        ...row,
        customerNumber: row.customer_number,
        receptionistId: row.receptionist_id,
        receptionistName: row.receptionist_name,
        caseType: row.case_type,
        assignedLawyerId: row.assigned_lawyer_id,
        assignedLawyerName: row.assigned_lawyer_name,
        estimatedFee: row.estimated_fee ? parseFloat(row.estimated_fee) : void 0,
        referralSource: row.referral_source,
        createdAt: formatDate(row.created_at),
        updatedAt: formatDate(row.updated_at),
        attachments: attachResult.rows.map((a) => ({
          name: a.name,
          url: a.url,
          size: a.size,
          uploadedAt: formatDate(a.uploaded_at)
        }))
      });
    }
    res.json(customersList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062C\u0644\u0628 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0639\u0645\u0644\u0627\u0621." });
  }
});
app.post("/api/customers", authMiddleware, async (req, res) => {
  const {
    name,
    phone,
    email,
    service,
    status,
    notes,
    caseType,
    assignedLawyerId,
    priority,
    estimatedFee,
    referralSource,
    attachments
  } = req.body;
  if (!name || !phone || !service) {
    return res.status(400).json({ error: "\u0627\u0644\u0627\u0633\u0645 \u0648\u0631\u0642\u0645 \u0627\u0644\u062C\u0648\u0627\u0644 \u0648\u0627\u0644\u062E\u062F\u0645\u0629 \u062D\u0642\u0648\u0644 \u0645\u0637\u0644\u0648\u0628\u0629." });
  }
  const role = req.user?.role || "";
  const isAuthorized = ["admin", "super_admin", "manager", "reception", "receptionist"].includes(role);
  if (!isAuthorized) {
    return res.status(403).json({ error: "\u0639\u0641\u0648\u0627\u064B\u060C \u0644\u0627 \u062A\u0645\u0644\u0643 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u062A\u0633\u062C\u064A\u0644 \u0639\u0645\u064A\u0644 \u062C\u062F\u064A\u062F." });
  }
  try {
    let lawyerName = "";
    if (assignedLawyerId) {
      const lawyerResult = await db_default.query("SELECT name FROM users WHERE uid = $1", [assignedLawyerId]);
      if (lawyerResult.rows.length > 0) lawyerName = lawyerResult.rows[0].name;
    }
    const clientResult = await db_default.query(
      `INSERT INTO customers 
       (name, phone, email, service, status, notes, receptionist_id, receptionist_name, case_type, assigned_lawyer_id, assigned_lawyer_name, priority, estimated_fee, referral_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        name,
        phone,
        email || null,
        service,
        status || "\u0642\u064A\u062F \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631",
        notes || null,
        req.user?.uid,
        req.user?.name,
        caseType || null,
        assignedLawyerId || null,
        lawyerName || null,
        priority || "medium",
        estimatedFee ? parseFloat(estimatedFee) : null,
        referralSource || null
      ]
    );
    const newCust = clientResult.rows[0];
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        await db_default.query(
          "INSERT INTO attachments (customer_id, name, url, size) VALUES ($1, $2, $3, $4)",
          [newCust.id, att.name, att.url, att.size]
        );
      }
    }
    await writeServerAuditLog(req, "\u062A\u0633\u062C\u064A\u0644 \u0639\u0645\u064A\u0644", `\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0639\u0645\u064A\u0644 \u0627\u0644\u062C\u062F\u064A\u062F ${name} \u0628\u0631\u0642\u0645 #${newCust.customer_number}`, "customer");
    res.json({ ...newCust, customerNumber: newCust.customer_number });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062D\u0641\u0638 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u0645\u064A\u0644 \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." });
  }
});
app.put("/api/customers/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, service, status, notes } = req.body;
  try {
    const check = await db_default.query("SELECT * FROM customers WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "\u0627\u0644\u0639\u0645\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    const customer = check.rows[0];
    const role = req.user?.role || "";
    const isOwner = customer.receptionist_id === req.user?.uid;
    const isAdmin = ["admin", "super_admin", "manager"].includes(role);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "\u0639\u0641\u0648\u0627\u064B\u060C \u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0639\u062F\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u0639\u0645\u064A\u0644." });
    }
    const result = await db_default.query(
      `UPDATE customers 
       SET name = $1, phone = $2, email = $3, service = $4, status = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [name, phone, email || null, service, status, notes || null, id]
    );
    await writeServerAuditLog(req, "\u062A\u0639\u062F\u064A\u0644 \u0639\u0645\u064A\u0644", `\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u0645\u064A\u0644 ${name}`, "customer");
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u0645\u064A\u0644." });
  }
});
app.delete("/api/customers/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const role = req.user?.role || "";
  if (!["admin", "super_admin", "manager"].includes(role)) {
    return res.status(403).json({ error: "\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u063A\u064A\u0631 \u0643\u0627\u0641\u064A\u0629 \u0644\u062D\u0630\u0641 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u0645\u064A\u0644." });
  }
  try {
    const check = await db_default.query("SELECT name FROM customers WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "\u0627\u0644\u0639\u0645\u064A\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    await db_default.query("DELETE FROM customers WHERE id = $1", [id]);
    await writeServerAuditLog(req, "\u062D\u0630\u0641 \u0639\u0645\u064A\u0644", `\u0625\u0632\u0627\u0644\u0629 \u0645\u0644\u0641 \u0627\u0644\u0639\u0645\u064A\u0644 ${check.rows[0].name} \u0646\u0647\u0627\u0626\u064A\u0627\u064B`, "customer");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062D\u0630\u0641 \u0627\u0644\u0639\u0645\u064A\u0644." });
  }
});
app.get("/api/cases", authMiddleware, async (req, res) => {
  try {
    let result;
    if (req.user?.role === "lawyer") {
      result = await db_default.query(
        "SELECT * FROM cases WHERE lawyer_id = $1 ORDER BY created_at DESC",
        [req.user.uid]
      );
    } else {
      result = await db_default.query("SELECT * FROM cases ORDER BY created_at DESC");
    }
    const casesList = [];
    for (const row of result.rows) {
      const actions = await db_default.query("SELECT action_text FROM case_actions WHERE case_id = $1 ORDER BY created_at ASC", [row.id]);
      const notes = await db_default.query("SELECT note_text FROM case_notes WHERE case_id = $1 ORDER BY created_at ASC", [row.id]);
      const attachments = await db_default.query("SELECT * FROM attachments WHERE case_id = $1", [row.id]);
      casesList.push({
        ...row,
        caseNumber: row.case_number,
        customerId: row.customer_id,
        customerName: row.customer_name,
        caseType: row.case_type,
        hearingDate: row.hearing_date,
        lawyerId: row.lawyer_id,
        lawyerName: row.lawyer_name,
        archivedById: row.archived_by_id,
        archivedByName: row.archived_by_name,
        createdAt: formatDate(row.created_at),
        actionHistory: actions.rows.map((a) => a.action_text),
        notesHistory: notes.rows.map((n) => n.note_text),
        attachments: attachments.rows.map((a) => ({
          name: a.name,
          url: a.url,
          size: a.size,
          uploadedAt: formatDate(a.uploaded_at)
        }))
      });
    }
    res.json(casesList);
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062C\u0644\u0628 \u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u0642\u0636\u0627\u064A\u0627." });
  }
});
app.post("/api/cases", authMiddleware, async (req, res) => {
  const {
    caseNumber,
    title,
    customerId,
    customerName,
    description,
    status,
    priority,
    court,
    caseType,
    hearingDate,
    lawyerId,
    lawyerName
  } = req.body;
  const role = req.user?.role || "";
  if (!["admin", "super_admin", "manager", "archive"].includes(role)) {
    return res.status(403).json({ error: "\u0644\u0627 \u062A\u0645\u0644\u0643 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u062A\u0633\u062C\u064A\u0644 \u0645\u0644\u0641 \u0642\u0636\u0627\u0626\u064A \u062C\u062F\u064A\u062F." });
  }
  try {
    const result = await db_default.query(
      `INSERT INTO cases 
       (case_number, title, customer_id, customer_name, description, status, priority, court, case_type, hearing_date, lawyer_id, lawyer_name, archived_by_id, archived_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        caseNumber,
        title,
        customerId,
        customerName,
        description || null,
        status || "\u0645\u0641\u062A\u0648\u062D",
        priority || "medium",
        court,
        caseType,
        hearingDate || null,
        lawyerId || null,
        lawyerName || null,
        req.user?.uid,
        req.user?.name
      ]
    );
    const newCase = result.rows[0];
    await db_default.query(
      "INSERT INTO case_actions (case_id, action_text) VALUES ($1, $2)",
      [newCase.id, `\u062A\u0623\u0633\u064A\u0633 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0642\u0636\u0627\u0626\u064A \u0628\u0648\u0627\u0633\u0637\u0629 ${req.user?.name}`]
    );
    await writeServerAuditLog(req, "\u062A\u0633\u062C\u064A\u0644 \u0642\u0636\u064A\u0629", `\u062A\u0623\u0633\u064A\u0633 \u0645\u0644\u0641 \u0627\u0644\u0642\u0636\u064A\u0629 \u0631\u0642\u0645 ${caseNumber}: ${title}`, "case");
    res.json(newCase);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062A\u0633\u062C\u064A\u0644 \u0645\u0644\u0641 \u0627\u0644\u0642\u0636\u064A\u0629. \u0631\u0628\u0645\u0627 \u0631\u0642\u0645 \u0627\u0644\u0642\u0636\u064A\u0629 \u0645\u0643\u0631\u0631." });
  }
});
app.put("/api/cases/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status, priority, hearingDate, lawyerId, lawyerName, description } = req.body;
  try {
    const check = await db_default.query("SELECT * FROM cases WHERE id = $1", [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: "\u0645\u0644\u0641 \u0627\u0644\u0642\u0636\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    const c = check.rows[0];
    const role = req.user?.role || "";
    const isLawyer = c.lawyer_id === req.user?.uid;
    const isAuthorized = ["admin", "super_admin", "manager", "archive"].includes(role) || isLawyer;
    if (!isAuthorized) {
      return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0647\u0630\u0647 \u0627\u0644\u0642\u0636\u064A\u0629." });
    }
    const result = await db_default.query(
      `UPDATE cases 
       SET status = $1, priority = $2, hearing_date = $3, lawyer_id = $4, lawyer_name = $5, description = $6
       WHERE id = $7
       RETURNING *`,
      [
        status || c.status,
        priority || c.priority,
        hearingDate !== void 0 ? hearingDate : c.hearing_date,
        lawyerId !== void 0 ? lawyerId : c.lawyer_id,
        lawyerName !== void 0 ? lawyerName : c.lawyer_name,
        description !== void 0 ? description : c.description,
        id
      ]
    );
    await writeServerAuditLog(req, "\u062A\u0639\u062F\u064A\u0644 \u0642\u0636\u064A\u0629", `\u062A\u0639\u062F\u064A\u0644 \u0645\u0644\u0641 \u0627\u0644\u0642\u0636\u064A\u0629 \u0631\u0642\u0645 ${c.case_number}`, "case");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062A\u062D\u062F\u064A\u062B \u0645\u0644\u0641 \u0627\u0644\u0642\u0636\u064A\u0629." });
  }
});
app.delete("/api/cases/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const role = req.user?.role || "";
  if (!["admin", "super_admin", "manager"].includes(role)) {
    return res.status(403).json({ error: "\u0644\u0627 \u062A\u0645\u0644\u0643 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u062D\u0630\u0641 \u0645\u0644\u0641 \u0642\u0636\u0627\u0626\u064A." });
  }
  try {
    const check = await db_default.query("SELECT case_number FROM cases WHERE id = $1", [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: "\u0627\u0644\u0642\u0636\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
    await db_default.query("DELETE FROM cases WHERE id = $1", [id]);
    await writeServerAuditLog(req, "\u062D\u0630\u0641 \u0642\u0636\u064A\u0629", `\u0625\u0632\u0627\u0644\u0629 \u0645\u0644\u0641 \u0627\u0644\u0642\u0636\u064A\u0629 \u0631\u0642\u0645 ${check.rows[0].case_number} \u0646\u0647\u0627\u0626\u064A\u0627\u064B`, "case");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062D\u0630\u0641 \u0627\u0644\u0642\u0636\u064A\u0629." });
  }
});
app.post("/api/cases/:id/actions", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "\u0646\u0635 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0645\u0637\u0644\u0648\u0628." });
  try {
    await db_default.query("INSERT INTO case_actions (case_id, action_text) VALUES ($1, $2)", [id, text]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u0625\u0636\u0627\u0641\u0629 \u0625\u062C\u0631\u0627\u0621 \u062C\u062F\u064A\u062F." });
  }
});
app.post("/api/cases/:id/notes", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629 \u0645\u0637\u0644\u0648\u0628." });
  try {
    await db_default.query("INSERT INTO case_notes (case_id, note_text) VALUES ($1, $2)", [id, text]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u0625\u0636\u0627\u0641\u0629 \u0645\u0644\u0627\u062D\u0638\u0629 \u062C\u062F\u064A\u062F\u0629." });
  }
});
app.post("/api/cases/:id/attachments", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, url, size } = req.body;
  if (!name || !url || !size) {
    return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0627\u0644\u0645\u0631\u0641\u0642 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629." });
  }
  try {
    const caseCheck = await db_default.query("SELECT customer_id FROM cases WHERE id = $1", [id]);
    if (caseCheck.rows.length === 0) return res.status(404).json({ error: "\u0645\u0644\u0641 \u0627\u0644\u0642\u0636\u064A\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    const customerId = caseCheck.rows[0].customer_id;
    await db_default.query(
      "INSERT INTO attachments (case_id, customer_id, name, url, size) VALUES ($1, $2, $3, $4, $5)",
      [id, customerId, name, url, size]
    );
    await writeServerAuditLog(req, "\u0631\u0641\u0639 \u0645\u0633\u062A\u0646\u062F", `\u0631\u0641\u0639 \u0645\u0633\u062A\u0646\u062F ${name} \u0644\u0644\u0642\u0636\u064A\u0629`, "document");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u0631\u0641\u0639 \u0648\u062D\u0641\u0638 \u0645\u0633\u062A\u0646\u062F \u0627\u0644\u0642\u0636\u064A\u0629." });
  }
});
app.delete("/api/cases/:id/attachments/:name", authMiddleware, async (req, res) => {
  const { id, name } = req.params;
  try {
    await db_default.query("DELETE FROM attachments WHERE case_id = $1 AND name = $2", [id, name]);
    await writeServerAuditLog(req, "\u062D\u0630\u0641 \u0645\u0633\u062A\u0646\u062F", `\u062D\u0630\u0641 \u0627\u0644\u0645\u0633\u062A\u0646\u062F ${name} \u0645\u0646 \u0645\u0644\u0641 \u0627\u0644\u0642\u0636\u064A\u0629`, "document");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062D\u0630\u0641 \u0627\u0644\u0645\u0633\u062A\u0646\u062F." });
  }
});
app.get("/api/appointments", authMiddleware, async (req, res) => {
  try {
    const result = await db_default.query("SELECT * FROM appointments ORDER BY date_time ASC");
    const list = result.rows.map((a) => ({
      ...a,
      caseId: a.case_id,
      caseNumber: a.case_number,
      caseTitle: a.case_title,
      dateTime: formatDate(a.date_time),
      createdById: a.created_by_id,
      createdByName: a.created_by_name,
      createdAt: formatDate(a.created_at)
    }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062C\u0644\u0628 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F." });
  }
});
app.post("/api/appointments", authMiddleware, async (req, res) => {
  const { title, caseId, caseNumber, caseTitle, dateTime, notes } = req.body;
  if (!title || !dateTime) {
    return res.status(400).json({ error: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0648\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u0648\u0639\u062F \u062D\u0642\u0648\u0644 \u0625\u0644\u0632\u0627\u0645\u064A\u0629." });
  }
  try {
    const result = await db_default.query(
      `INSERT INTO appointments (title, case_id, case_number, case_title, date_time, notes, created_by_id, created_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, caseId || null, caseNumber || null, caseTitle || null, new Date(dateTime), notes || null, req.user?.uid, req.user?.name]
    );
    await writeServerAuditLog(req, "\u062C\u062F\u0648\u0644\u0629 \u0645\u0648\u0639\u062F", `\u062C\u062F\u0648\u0644\u0629 \u0645\u0648\u0639\u062F \u062C\u0644\u0633\u0629 \u062C\u062F\u064A\u062F\u0629 \u0628\u0639\u0646\u0648\u0627\u0646 ${title}`, "appointment");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062C\u062F\u0648\u0644\u0629 \u0627\u0644\u0645\u0648\u0639\u062F." });
  }
});
app.put("/api/appointments/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { title, caseId, caseNumber, caseTitle, dateTime, notes, status } = req.body;
  try {
    const check = await db_default.query("SELECT * FROM appointments WHERE id = $1", [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0639\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    const result = await db_default.query(
      `UPDATE appointments 
       SET title = $1, case_id = $2, case_number = $3, case_title = $4, date_time = $5, notes = $6, status = $7
       WHERE id = $8
       RETURNING *`,
      [title, caseId || null, caseNumber || null, caseTitle || null, new Date(dateTime), notes || null, status, id]
    );
    await writeServerAuditLog(req, "\u062A\u0639\u062F\u064A\u0644 \u0645\u0648\u0639\u062F", `\u062A\u0639\u062F\u064A\u0644 \u0645\u0648\u0639\u062F \u0627\u0644\u062C\u0644\u0633\u0629: ${title}`, "appointment");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0648\u0639\u062F." });
  }
});
app.delete("/api/appointments/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const check = await db_default.query("SELECT title FROM appointments WHERE id = $1", [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0639\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    await db_default.query("DELETE FROM appointments WHERE id = $1", [id]);
    await writeServerAuditLog(req, "\u062D\u0630\u0641 \u0645\u0648\u0639\u062F", `\u0625\u0644\u063A\u0627\u0621 \u0645\u0648\u0639\u062F \u0627\u0644\u062C\u0644\u0633\u0629: ${check.rows[0].title}`, "appointment");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062D\u0630\u0641 \u0627\u0644\u0645\u0648\u0639\u062F." });
  }
});
app.get("/api/chat/rooms", authMiddleware, async (req, res) => {
  try {
    const result = await db_default.query(
      `SELECT r.* FROM chat_rooms r
       LEFT JOIN chat_room_participants p ON r.id = p.room_id
       WHERE p.user_id = $1 OR r.type = 'group'
       GROUP BY r.id
       ORDER BY r.last_message_at DESC`,
      [req.user?.uid]
    );
    const roomsList = [];
    for (const row of result.rows) {
      const parts = await db_default.query("SELECT user_id FROM chat_room_participants WHERE room_id = $1", [row.id]);
      roomsList.push({
        ...row,
        lastMessageAt: formatDate(row.last_message_at),
        createdAt: formatDate(row.created_at),
        participantIds: parts.rows.map((p) => p.user_id)
      });
    }
    res.json(roomsList);
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062C\u0644\u0628 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0627\u062A." });
  }
});
app.post("/api/chat/rooms", authMiddleware, async (req, res) => {
  const { type, participantIds, name } = req.body;
  try {
    const roomResult = await db_default.query(
      "INSERT INTO chat_rooms (type, name) VALUES ($1, $2) RETURNING *",
      [type, name || null]
    );
    const newRoom = roomResult.rows[0];
    const allParticipants = Array.from(/* @__PURE__ */ new Set([...participantIds || [], req.user?.uid]));
    for (const uid of allParticipants) {
      await db_default.query(
        "INSERT INTO chat_room_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [newRoom.id, uid]
      );
    }
    res.json({
      ...newRoom,
      participantIds: allParticipants,
      lastMessageAt: formatDate(newRoom.last_message_at),
      createdAt: formatDate(newRoom.created_at)
    });
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u063A\u0631\u0641\u0629 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629." });
  }
});
app.get("/api/chat/rooms/:roomId/messages", authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  try {
    const result = await db_default.query(
      "SELECT * FROM chat_messages WHERE room_id = $1 ORDER BY created_at ASC",
      [roomId]
    );
    const list = result.rows.map((m) => ({
      ...m,
      roomId: m.room_id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      createdAt: formatDate(m.created_at)
    }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062C\u0644\u0628 \u0627\u0644\u0631\u0633\u0627\u0626\u0644." });
  }
});
app.post("/api/chat/rooms/:roomId/messages", authMiddleware, async (req, res) => {
  const { roomId } = req.params;
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0641\u0627\u0631\u063A." });
  try {
    const result = await db_default.query(
      `INSERT INTO chat_messages (room_id, sender_id, sender_name, text)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [roomId, req.user?.uid, req.user?.name, text]
    );
    await db_default.query("UPDATE chat_rooms SET last_message_at = CURRENT_TIMESTAMP WHERE id = $1", [roomId]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0631\u0633\u0627\u0644\u0629." });
  }
});
app.get("/api/admin/stats", authMiddleware, async (req, res) => {
  const role = req.user?.role || "";
  if (!["admin", "super_admin", "manager"].includes(role)) {
    return res.status(403).json({ error: "\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u063A\u064A\u0631 \u0643\u0627\u0641\u064A\u0629 \u0644\u0645\u0634\u0627\u0647\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u062D\u0644\u064A\u0644\u064A\u0629." });
  }
  try {
    const custCount = await db_default.query("SELECT COUNT(*) FROM customers");
    const caseCount = await db_default.query("SELECT COUNT(*) FROM cases");
    const openCases = await db_default.query("SELECT COUNT(*) FROM cases WHERE status = '\u0645\u0641\u062A\u0648\u062D'");
    const closedCases = await db_default.query("SELECT COUNT(*) FROM cases WHERE status = '\u0645\u063A\u0644\u0642'");
    const serviceDistribution = await db_default.query(
      "SELECT service as name, COUNT(*) as value FROM customers GROUP BY service"
    );
    const monthlyTrend = await db_default.query(
      `SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count 
       FROM cases 
       GROUP BY month 
       ORDER BY month ASC`
    );
    res.json({
      totalCustomers: parseInt(custCount.rows[0].count),
      totalCases: parseInt(caseCount.rows[0].count),
      activeCases: parseInt(openCases.rows[0].count),
      closedCases: parseInt(closedCases.rows[0].count),
      servicePieData: serviceDistribution.rows.map((r) => ({ name: r.name, value: parseInt(r.value) })),
      monthlyChartData: monthlyTrend.rows.map((r) => ({ month: r.month, count: parseInt(r.count) }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062C\u0644\u0628 \u062A\u062D\u0644\u064A\u0644\u0627\u062A \u0627\u0644\u0645\u062F\u064A\u0631." });
  }
});
app.post("/api/admin/users", authMiddleware, async (req, res) => {
  const role = req.user?.role || "";
  if (role !== "super_admin" && role !== "admin") {
    return res.status(403).json({ error: "\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u063A\u064A\u0631 \u0643\u0627\u0641\u064A\u0629 \u0644\u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628\u0627\u062A \u0641\u0631\u064A\u0642 \u0627\u0644\u0639\u0645\u0644." });
  }
  const { username, email, name, role: targetRole, password } = req.body;
  if (!username || !email || !name || !targetRole || !password) {
    return res.status(400).json({ error: "\u0627\u0644\u0631\u062C\u0627\u0621 \u0645\u0644\u0621 \u0643\u0627\u0641\u0629 \u0627\u0644\u062D\u0642\u0648\u0644 \u0644\u0625\u062A\u0645\u0627\u0645 \u0627\u0644\u062A\u0633\u062C\u064A\u0644." });
  }
  try {
    const check = await db_default.query("SELECT * FROM users WHERE username = $1", [username.trim().toLowerCase()]);
    if (check.rows.length > 0) return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B." });
    const hashedPassword = await bcrypt2.hash(password, 10);
    const result = await db_default.query(
      `INSERT INTO users (username, email, name, role, password)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING uid, username, email, name, role`,
      [username.trim().toLowerCase(), email.trim(), name.trim(), targetRole, hashedPassword]
    );
    await writeServerAuditLog(req, "\u0625\u0646\u0634\u0627\u0621 \u0645\u0633\u062A\u062E\u062F\u0645", `\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u062C\u062F\u064A\u062F \u0644\u0644\u0645\u0648\u0638\u0641: ${name}`, "auth");
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062A\u0633\u062C\u064A\u0644 \u062D\u0633\u0627\u0628 \u0641\u0631\u064A\u0642 \u0627\u0644\u0639\u0645\u0644." });
  }
});
app.put("/api/admin/users/:uid/role", authMiddleware, async (req, res) => {
  const role = req.user?.role || "";
  if (role !== "super_admin" && role !== "admin") {
    return res.status(403).json({ error: "\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u063A\u064A\u0631 \u0643\u0627\u0641\u064A\u0629 \u0644\u062A\u0639\u062F\u064A\u0644 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646." });
  }
  const { uid } = req.params;
  const { role: targetRole } = req.body;
  try {
    const userCheck = await db_default.query("SELECT name FROM users WHERE uid = $1", [uid]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: "\u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    await db_default.query("UPDATE users SET role = $1 WHERE uid = $2", [targetRole, uid]);
    await writeServerAuditLog(req, "\u062A\u0639\u062F\u064A\u0644 \u0635\u0644\u0627\u062D\u064A\u0629", `\u062A\u0639\u062F\u064A\u0644 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u0645\u0648\u0638\u0641 ${userCheck.rows[0].name} \u0625\u0644\u0649 ${targetRole}`, "auth");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A." });
  }
});
app.get("/api/admin/audit-logs", authMiddleware, async (req, res) => {
  const role = req.user?.role || "";
  if (!["admin", "super_admin", "manager"].includes(role)) {
    return res.status(403).json({ error: "\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u063A\u064A\u0631 \u0643\u0627\u0641\u064A\u0629 \u0644\u0645\u0634\u0627\u0647\u062F\u0629 \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0631\u0642\u0627\u0628\u0629." });
  }
  try {
    const result = await db_default.query("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 200");
    const logs = result.rows.map((row) => ({
      ...row,
      performedByUid: row.performed_by_uid,
      performedByName: row.performed_by_name,
      performedByEmail: row.performed_by_email,
      timestamp: formatDate(row.timestamp)
    }));
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "\u0641\u0634\u0644 \u062C\u0644\u0628 \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0631\u0642\u0627\u0628\u0629." });
  }
});
var __dirname = path2.resolve();
var distPath = path2.join(__dirname, "dist");
if (fs2.existsSync(distPath)) {
  console.log(`Serving static production files from: ${distPath}`);
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path2.join(distPath, "index.html"));
    }
  });
}
var startServer = async () => {
  try {
    await initializeDatabase();
    const systemUserResult = await db_default.query("SELECT uid FROM users WHERE username = 'admin' LIMIT 1");
    if (systemUserResult.rows.length > 0) {
      const adminUid = systemUserResult.rows[0].uid;
      const groups = ["\u062C\u0631\u0648\u0628 \u0639\u0627\u0645 \u0644\u0644\u0634\u0631\u0643\u0629", "\u062C\u0631\u0648\u0628 \u0627\u0644\u0625\u062F\u0627\u0631\u0629", "\u062C\u0631\u0648\u0628 \u0645\u0648\u0638\u0641\u064A \u0627\u0644\u0627\u0633\u062A\u0642\u0628\u0627\u0644", "\u062C\u0631\u0648\u0628 \u0627\u0644\u0623\u0631\u0634\u0641\u0629"];
      for (const name of groups) {
        const check = await db_default.query("SELECT * FROM chat_rooms WHERE name = $1", [name]);
        if (check.rows.length === 0) {
          const roomRes = await db_default.query(
            "INSERT INTO chat_rooms (type, name) VALUES ('group', $1) RETURNING id",
            [name]
          );
          const roomId = roomRes.rows[0].id;
          await db_default.query(
            "INSERT INTO chat_room_participants (room_id, user_id) VALUES ($1, $2)",
            [roomId, adminUid]
          );
        }
      }
    }
    app.listen(PORT, () => {
      console.log(`Server is running securely on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to initialize and start Express server:", err);
    process.exit(1);
  }
};
startServer();
