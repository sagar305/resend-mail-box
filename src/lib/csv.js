/*
 * CSV import for the recipient table.
 *
 * Written by hand rather than pulled in as a dependency: the job is one file
 * format, read once, in a browser that already has everything else it needs. The
 * quoting rules are the part that matters — a spreadsheet exports "Smith, Ltd"
 * with the comma inside quotes, and splitting on commas would turn one company
 * into two columns and shift every value after it.
 */

/** Splits CSV text into rows of cells, honouring quotes and escaped quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  // Normalize line endings first so a file saved on Windows does not leave a
  // stray carriage return on the end of every last column.
  const input = String(text ?? '').replace(/\r\n?/g, '\n');

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quoted) {
      if (character === '"') {
        // A doubled quote inside a quoted cell is a literal quote.
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  // Whatever is left when the text runs out is the final cell, unless the file
  // ended on a newline and there is nothing pending.
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((value) => value.trim() !== ''));
}

/** Picks the column most likely to hold addresses: named like one, or containing one. */
function findEmailColumn(headers, firstRow) {
  const named = headers.findIndex((header) => /^e-?mail(\s*address)?$/i.test(header.trim()));
  if (named !== -1) return named;

  const looksLikeEmail = (firstRow ?? []).findIndex((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim()));
  return looksLikeEmail;
}

/**
 * Turns CSV text into the shape the recipient table holds.
 *
 * The header row names the merge columns, so whatever someone puts there becomes
 * available as a token. The address column is found rather than assumed, since a
 * spreadsheet rarely has it first.
 */
export function parseRecipientCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) {
    return { error: 'That file has no rows in it.', columns: [], recipients: [] };
  }

  const headers = rows[0].map((header) => header.trim());
  const body = rows.slice(1);

  const emailIndex = findEmailColumn(headers, body[0]);
  if (emailIndex === -1) {
    return {
      error: 'No email column found. Name one of the columns "email", or put addresses in it.',
      columns: [],
      recipients: [],
    };
  }

  // Every column except the addresses becomes a merge column. A blank header
  // would produce a token nobody can type, so those are dropped.
  const columns = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header, index }) => index !== emailIndex && header !== '');

  const recipients = body
    .map((cells) => {
      const email = String(cells[emailIndex] ?? '').trim();
      const vars = {};
      for (const { header, index } of columns) {
        vars[header] = String(cells[index] ?? '').trim();
      }
      return { email, vars };
    })
    .filter((recipient) => recipient.email !== '');

  if (!recipients.length) {
    return { error: 'No rows in that file had an email address.', columns: [], recipients: [] };
  }

  return { error: null, columns: columns.map(({ header }) => header), recipients };
}
