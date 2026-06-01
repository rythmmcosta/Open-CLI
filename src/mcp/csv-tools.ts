import * as fs from 'fs';
import * as path from 'path';
import { ToolDef } from '../types';

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const csvTools: ToolDef[] = [
  {
    name: 'csv_parse',
    description: 'Parse a CSV file or CSV string into a JSON array of row objects.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath:  { type: 'string', description: 'Path to a CSV file (use this OR csvString)' },
        csvString: { type: 'string', description: 'Raw CSV content as a string (use this OR filePath)' },
        delimiter: { type: 'string', description: 'Field delimiter character (default: ",")' },
      },
    },
  },
  {
    name: 'csv_write',
    description: 'Write an array of row objects to a CSV file.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath:  { type: 'string', description: 'Output file path' },
        rows:      { type: 'array',  description: 'Array of objects to write as CSV rows', items: { type: 'object' } },
        delimiter: { type: 'string', description: 'Field delimiter character (default: ",")' },
      },
      required: ['filePath', 'rows'],
    },
  },
  {
    name: 'csv_filter',
    description: 'Filter rows from a CSV file or string where a column matches a value.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath:     { type: 'string', description: 'Path to a CSV file (use this OR csvString)' },
        csvString:    { type: 'string', description: 'Raw CSV content as a string' },
        delimiter:    { type: 'string', description: 'Field delimiter (default: ",")' },
        filterColumn: { type: 'string', description: 'Column name to filter on' },
        filterValue:  { type: 'string', description: 'Value to compare against' },
        operator:     { type: 'string', description: "Comparison operator: 'eq' | 'contains' | 'gt' | 'lt' (default: 'eq')" },
      },
      required: ['filterColumn', 'filterValue'],
    },
  },
  {
    name: 'csv_aggregate',
    description: 'Group CSV rows and compute an aggregate (sum, avg, count, min, max) over a column.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath:        { type: 'string', description: 'Path to a CSV file (use this OR csvString)' },
        csvString:       { type: 'string', description: 'Raw CSV content as a string' },
        delimiter:       { type: 'string', description: 'Field delimiter (default: ",")' },
        groupByColumn:   { type: 'string', description: 'Column to group rows by' },
        aggregateColumn: { type: 'string', description: 'Column to aggregate' },
        operation:       { type: 'string', description: "Aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max'" },
      },
      required: ['groupByColumn', 'aggregateColumn', 'operation'],
    },
  },
  {
    name: 'csv_transform',
    description: 'Rename columns and/or drop columns from a CSV file or string.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath:    { type: 'string', description: 'Path to a CSV file (use this OR csvString)' },
        csvString:   { type: 'string', description: 'Raw CSV content as a string' },
        delimiter:   { type: 'string', description: 'Field delimiter (default: ",")' },
        mapping:     { type: 'object', description: 'Column rename map: {oldName: newName}' },
        dropColumns: { type: 'array',  description: 'Column names to remove', items: { type: 'string' } },
        outputPath:  { type: 'string', description: 'If provided, write result to this CSV file path' },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// CSV parser — handles quoted fields with embedded commas and newlines
// ---------------------------------------------------------------------------

function parseCSV(text: string, delim = ','): Record<string, string>[] {
  const result: Record<string, string>[] = [];

  function parseFields(line: string): string[] {
    const fields: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        // Quoted field
        let field = '';
        i++; // skip opening quote
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') {
            field += '"';
            i += 2;
          } else if (line[i] === '"') {
            i++; // skip closing quote
            break;
          } else {
            field += line[i++];
          }
        }
        fields.push(field);
        if (line[i] === delim) i++; // skip delimiter after closing quote
      } else {
        // Unquoted field — read until delimiter
        const start = i;
        while (i < line.length && line[i] !== delim) i++;
        fields.push(line.slice(start, i));
        if (line[i] === delim) i++;
      }
    }
    // Handle trailing delimiter producing empty last field
    if (line.endsWith(delim)) fields.push('');
    return fields;
  }

  // Split text into logical lines (respecting quoted newlines)
  const logicalLines: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { inQuote = !inQuote; current += ch; }
    else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      if (current.length > 0) logicalLines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length > 0) logicalLines.push(current);

  if (logicalLines.length === 0) return result;

  const headers = parseFields(logicalLines[0]);
  for (let r = 1; r < logicalLines.length; r++) {
    const values = parseFields(logicalLines[r]);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    result.push(row);
  }
  return result;
}

function serializeCSV(rows: Record<string, unknown>[], delim = ','): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);

  function quoteField(v: unknown): string {
    const s = String(v ?? '');
    if (s.includes(delim) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  const lines = [headers.map(quoteField).join(delim)];
  for (const row of rows) {
    lines.push(headers.map(h => quoteField(row[h])).join(delim));
  }
  return lines.join('\n');
}

function loadCsvInput(input: Record<string, unknown>): { rows: Record<string, string>[]; delim: string } {
  const delim     = (input.delimiter as string | undefined) || ',';
  const filePath  = input.filePath  as string | undefined;
  const csvString = input.csvString as string | undefined;

  let text: string;
  if (filePath) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) throw new Error(`File not found: ${resolved}`);
    text = fs.readFileSync(resolved, 'utf8');
  } else if (csvString) {
    text = csvString;
  } else {
    throw new Error('Provide either filePath or csvString.');
  }

  return { rows: parseCSV(text, delim), delim };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function formatRowsAsTable(rows: Record<string, unknown>[], maxRows = 100): string {
  if (rows.length === 0) return '(no rows)';
  const cols   = Object.keys(rows[0]);
  const widths = cols.map(c => Math.max(c.length, ...rows.slice(0, maxRows).map(r => String(r[c] ?? '').length)));
  const header = cols.map((c, i) => pad(c, widths[i])).join('  ');
  const sep    = widths.map(w => '─'.repeat(w)).join('  ');
  const body   = rows.slice(0, maxRows).map(r => cols.map((c, i) => pad(String(r[c] ?? ''), widths[i])).join('  '));
  const extra  = rows.length > maxRows ? [`\n… (${rows.length - maxRows} more rows not shown)`] : [];
  return [header, sep, ...body, ...extra].join('\n');
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeCsvTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ output: string; isError: boolean }> {
  try {
    // -----------------------------------------------------------------------
    if (name === 'csv_parse') {
      const { rows, delim } = loadCsvInput(input);
      if (!rows.length) return { output: 'CSV is empty or has no data rows.', isError: false };
      const cols = Object.keys(rows[0]);
      const table = formatRowsAsTable(rows);
      return {
        output: `Parsed ${rows.length} row(s), ${cols.length} column(s) — delimiter: "${delim}"\nColumns: ${cols.join(', ')}\n\n${table}`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'csv_write') {
      const filePath = path.resolve(input.filePath as string);
      const rows     = input.rows as Record<string, unknown>[];
      const delim    = (input.delimiter as string | undefined) || ',';
      if (!rows.length) return { output: 'rows array is empty — nothing to write.', isError: true };
      const csv = serializeCSV(rows, delim);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, csv, 'utf8');
      const cols = Object.keys(rows[0]);
      return {
        output: [
          `CSV written to: ${filePath}`,
          `  Rows    : ${rows.length}`,
          `  Columns : ${cols.length} — ${cols.join(', ')}`,
          `  Size    : ${fs.statSync(filePath).size} bytes`,
        ].join('\n'),
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'csv_filter') {
      const { rows } = loadCsvInput(input);
      const col      = input.filterColumn as string;
      const val      = input.filterValue  as string;
      const op       = (input.operator    as string | undefined) || 'eq';

      if (rows.length && !(col in rows[0])) {
        return { output: `Column "${col}" not found. Available: ${Object.keys(rows[0]).join(', ')}`, isError: true };
      }

      const filtered = rows.filter(r => {
        const cell = r[col] ?? '';
        switch (op) {
          case 'contains': return cell.includes(val);
          case 'gt':       return parseFloat(cell) > parseFloat(val);
          case 'lt':       return parseFloat(cell) < parseFloat(val);
          default:         return cell === val; // 'eq'
        }
      });

      if (!filtered.length) return { output: `No rows match ${col} ${op} "${val}".`, isError: false };
      return {
        output: `${filtered.length} of ${rows.length} row(s) match ${col} ${op} "${val}":\n\n${formatRowsAsTable(filtered)}`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'csv_aggregate') {
      const { rows }   = loadCsvInput(input);
      const groupCol   = input.groupByColumn   as string;
      const aggCol     = input.aggregateColumn as string;
      const operation  = input.operation       as string;

      if (!rows.length) return { output: 'No data rows found.', isError: false };

      if (!(groupCol in rows[0])) {
        return { output: `Group column "${groupCol}" not found. Available: ${Object.keys(rows[0]).join(', ')}`, isError: true };
      }
      if (operation !== 'count' && !(aggCol in rows[0])) {
        return { output: `Aggregate column "${aggCol}" not found. Available: ${Object.keys(rows[0]).join(', ')}`, isError: true };
      }

      // Group
      const groups = new Map<string, string[]>();
      for (const row of rows) {
        const key = row[groupCol] ?? '';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row[aggCol] ?? '');
      }

      // Compute
      const results: Array<{ group: string; result: number }> = [];
      for (const [group, values] of groups) {
        const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
        let result: number;
        switch (operation) {
          case 'sum':   result = nums.reduce((a, b) => a + b, 0); break;
          case 'avg':   result = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0; break;
          case 'min':   result = nums.length ? Math.min(...nums) : 0; break;
          case 'max':   result = nums.length ? Math.max(...nums) : 0; break;
          default:      result = values.length; break; // count
        }
        results.push({ group, result });
      }

      results.sort((a, b) => b.result - a.result);
      const maxGrpLen = Math.max(groupCol.length, ...results.map(r => r.group.length));
      const header    = `${pad(groupCol, maxGrpLen)}  ${operation}(${aggCol})`;
      const sep       = '─'.repeat(header.length);
      const lines     = results.map(r => `${pad(r.group, maxGrpLen)}  ${r.result.toFixed(4).replace(/\.?0+$/, '')}`);
      return {
        output: `Aggregation (${operation} of "${aggCol}" grouped by "${groupCol}"):\n\n${header}\n${sep}\n${lines.join('\n')}`,
        isError: false,
      };
    }

    // -----------------------------------------------------------------------
    if (name === 'csv_transform') {
      const { rows, delim } = loadCsvInput(input);
      const mapping     = (input.mapping     as Record<string, string> | undefined) || {};
      const dropColumns = (input.dropColumns as string[]          | undefined) || [];
      const outputPath  = input.outputPath   as string | undefined;

      const transformed = rows.map(row => {
        const newRow: Record<string, string> = {};
        for (const [col, val] of Object.entries(row)) {
          if (dropColumns.includes(col)) continue;
          const newCol = mapping[col] || col;
          newRow[newCol] = val;
        }
        return newRow;
      });

      const csv = serializeCSV(transformed, delim);

      if (outputPath) {
        const resolved = path.resolve(outputPath);
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        fs.writeFileSync(resolved, csv, 'utf8');
        return {
          output: [
            `Transform complete. Written to: ${resolved}`,
            `  Rows   : ${transformed.length}`,
            `  Renamed: ${Object.entries(mapping).map(([o, n]) => `${o}→${n}`).join(', ') || 'none'}`,
            `  Dropped: ${dropColumns.join(', ') || 'none'}`,
          ].join('\n'),
          isError: false,
        };
      }

      // Return as inline text preview
      const preview = transformed.slice(0, 50);
      return {
        output: [
          `Transform complete (${transformed.length} rows).`,
          `  Renamed: ${Object.entries(mapping).map(([o, n]) => `${o}→${n}`).join(', ') || 'none'}`,
          `  Dropped: ${dropColumns.join(', ') || 'none'}`,
          '',
          formatRowsAsTable(preview),
          ...(transformed.length > 50 ? [`\n… (${transformed.length - 50} more rows)`] : []),
        ].join('\n'),
        isError: false,
      };
    }

    return { output: `Unknown CSV tool: ${name}`, isError: true };
  } catch (err: unknown) {
    return { output: (err as Error).message, isError: true };
  }
}
