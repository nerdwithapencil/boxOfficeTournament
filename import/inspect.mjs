import { readFileSync } from 'fs';

// minimal CSV parser (handles quoted fields with commas, e.g. "$2,026.11")
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const text = readFileSync(process.argv[2], 'utf8');
const rows = parseCSV(text);

for (let r = 0; r < rows.length; r++) {
  const nonEmpty = rows[r].map((v, i) => [i, v]).filter(([, v]) => v !== '');
  console.log(`row ${r}:`, JSON.stringify(nonEmpty));
}
