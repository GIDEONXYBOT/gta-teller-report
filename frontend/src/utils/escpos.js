// Minimal ESC/POS builder for 58mm receipts
// Note: Use ASCII-safe characters for widest compatibility (avoid ₱; use PHP)

function textToBytes(str = "") {
  // Replace peso with 'PHP '
  const safe = str.replace(/₱/g, "PHP ");
  const bytes = [];
  for (let i = 0; i < safe.length; i++) {
    const code = safe.charCodeAt(i);
    bytes.push(code & 0xff); // naive ASCII, works for basic chars
  }
  return bytes;
}

export function buildTellerReceipt58({
  orgName = "RMI Teller Report",
  tellerName = "",
  dateStr = new Date().toLocaleString(),
  systemBalance = 0,
  cashOnHand = 0,
  d = { d1000: 0, d500: 0, d200: 0, d100: 0, d50: 0, d20: 0, coins: 0 },
  over = 0,
  short = 0,
}) {
  const bytes = [];
  const write = (...arr) => bytes.push(...arr);
  const lf = () => write(0x0a);

  const setAlign = (n) => write(0x1b, 0x61, n & 0x02); // 0 left,1 center,2 right
  const init = () => write(0x1b, 0x40);
  const boldOn = () => write(0x1b, 0x45, 0x01);
  const boldOff = () => write(0x1b, 0x45, 0x00);
  const dblOn = () => write(0x1d, 0x21, 0x11);
  const dblOff = () => write(0x1d, 0x21, 0x00);
  const line = () => {
    write(...textToBytes("--------------------------------")); lf();
  };
  const print = (s = "") => { write(...textToBytes(s)); lf(); };
  const padTable = (col1 = "", col2 = "", col3 = "") => {
    const c1 = String(col1).padEnd(10);
    const c2 = String(col2).padStart(6);
    const c3 = String(col3).padStart(12);
    return c1 + c2 + c3;
  };
  const padField = (label = "", value = "") => {
    const total = 32;
    const spaces = Math.max(1, total - label.length - value.length);
    return label + " ".repeat(spaces) + value;
  };

  init();
  setAlign(1); boldOn(); dblOn();
  print(orgName.toUpperCase());
  dblOff(); boldOff();
  lf();
  
  // Header section
  setAlign(0);
  print(padField("SV:", ""));
  print(padField("TELLER:", (tellerName || "").toUpperCase()));
  print(padField("DATE:", dateStr));
  print(padField("SYSTEM BALANCE:", Number(systemBalance).toLocaleString()));
  print(padField("CASH ON HAND:", Number(cashOnHand).toLocaleString()));
  print(padField("OVER:", over ? Number(over).toLocaleString() : "0"));
  print(padField("SHORT:", short ? Number(short).toLocaleString() : "0"));
  lf();
  
  // Denomination table header
  setAlign(1); boldOn();
  print("DENOMINATION");
  boldOff(); setAlign(0);
  print(padTable("", "PCS", "TOTAL"));
  line();
  
  // Denomination rows
  const d1000Count = Number(d.d1000 || 0);
  const d500Count = Number(d.d500 || 0);
  const d200Count = Number(d.d200 || 0);
  const d100Count = Number(d.d100 || 0);
  const d50Count = Number(d.d50 || 0);
  const d20Count = Number(d.d20 || 0);
  const coinsValue = Number(d.coins || 0);
  
  print(padTable("1000x", d1000Count.toString(), (d1000Count * 1000).toLocaleString()));
  print(padTable("500x", d500Count.toString(), (d500Count * 500).toLocaleString()));
  print(padTable("200x", d200Count.toString(), (d200Count * 200).toLocaleString()));
  print(padTable("100x", d100Count.toString(), (d100Count * 100).toLocaleString()));
  print(padTable("50x", d50Count.toString(), (d50Count * 50).toLocaleString()));
  print(padTable("20x", d20Count.toString(), (d20Count * 20).toLocaleString()));
  print(padTable("COINS", "", coinsValue.toLocaleString()));
  line();
  print(padTable("TOTAL", "", Number(cashOnHand).toLocaleString()));
  
  lf();
  setAlign(1); print("Thank you"); setAlign(0);

  // Feed and (optional) cut
  write(0x1b, 0x64, 0x04); // feed 4 lines
  write(0x1d, 0x56, 0x00); // full cut (ignored if no cutter)

  return new Uint8Array(bytes);
}

export function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, sub);
  }
  return btoa(binary);
}

export function tryPrintRawBT(bytes) {
  const b64 = bytesToBase64(bytes);
  // RawBT deep link, supported by RawBT app on Android
  const url = `rawbt:base64,${b64}`;
  // Open via window.open for better compatibility
  const w = window.open(url, "_blank");
  return !!w;
}
