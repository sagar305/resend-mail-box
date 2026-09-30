import { useRef } from 'react';
import { CloseIcon, PlusIcon, UploadIcon } from './Icons.jsx';
import { parseRecipientCsv } from '../lib/csv.js';

/*
 * The recipient list, one row per mail.
 *
 * A table rather than a textarea because every row carries its own merge values,
 * and pairing those to an address in free text is guesswork. CSV import fills the
 * table rather than replacing it as a separate mode, so there is one editor and
 * one shape of data however the addresses arrived.
 *
 * Rows that cannot fill a token in use are marked here rather than at send time.
 * The job refuses to start until they are fixed, so finding out while the list is
 * in front of you is the difference between an edit and a hunt.
 */

const normalize = (name) => String(name ?? '').trim().toLowerCase();

const cellClass =
  'w-full min-w-0 bg-transparent px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-300 focus:bg-white focus:outline-none';

export default function RecipientTable({
  columns,
  recipients,
  onChange,
  requiredTokens,
  disabled,
}) {
  const fileInput = useRef(null);

  const required = new Set(requiredTokens.map(normalize));
  const columnIsRequired = (column) => required.has(normalize(column));

  const missingIn = (recipient) => requiredTokens.filter((token) => {
    const match = columns.find((column) => normalize(column) === normalize(token));
    return !match || String(recipient.vars[match] ?? '').trim() === '';
  });

  const update = (next) => onChange(next);

  const setCell = (rowIndex, column, value) => {
    update({
      columns,
      recipients: recipients.map((recipient, index) => (
        index === rowIndex
          ? { ...recipient, vars: { ...recipient.vars, [column]: value } }
          : recipient
      )),
    });
  };

  const setEmail = (rowIndex, value) => {
    update({
      columns,
      recipients: recipients.map((recipient, index) => (
        index === rowIndex ? { ...recipient, email: value } : recipient
      )),
    });
  };

  const addRow = () => {
    update({
      columns,
      recipients: [...recipients, { email: '', vars: Object.fromEntries(columns.map((c) => [c, ''])) }],
    });
  };

  const removeRow = (rowIndex) => {
    update({ columns, recipients: recipients.filter((_row, index) => index !== rowIndex) });
  };

  const addColumn = () => {
    // Named by position so two new columns never collide, and renameable in place.
    let name = 'column';
    let suffix = 1;
    while (columns.some((column) => normalize(column) === normalize(name))) {
      suffix += 1;
      name = `column ${suffix}`;
    }
    update({ columns: [...columns, name], recipients });
  };

  const renameColumn = (oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || columns.some((column) => column !== oldName && normalize(column) === normalize(trimmed))) {
      return;
    }
    update({
      columns: columns.map((column) => (column === oldName ? trimmed : column)),
      // Values move with the column, or renaming would silently empty it.
      recipients: recipients.map((recipient) => {
        const { [oldName]: value, ...rest } = recipient.vars;
        return { ...recipient, vars: { ...rest, [trimmed]: value ?? '' } };
      }),
    });
  };

  const removeColumn = (name) => {
    update({
      columns: columns.filter((column) => column !== name),
      recipients: recipients.map((recipient) => {
        const { [name]: _removed, ...rest } = recipient.vars;
        return { ...recipient, vars: rest };
      }),
    });
  };

  const importCsv = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const result = parseRecipientCsv(await file.text());
    if (result.error) {
      update({ columns, recipients, error: result.error });
      return;
    }
    // A fresh import replaces the table: merging two lists with different columns
    // produces rows that are half filled and nobody can tell which half.
    update({ columns: result.columns, recipients: result.recipients, error: null });
  };

  const incompleteCount = recipients.filter((recipient) => missingIn(recipient).length).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add row
        </button>
        <button
          type="button"
          onClick={addColumn}
          disabled={disabled}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add column
        </button>

        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          onChange={importCsv}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={disabled}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <UploadIcon className="h-3.5 w-3.5" />
          Import CSV
        </button>

        <span className="ml-auto text-xs text-slate-500 tabular-nums">
          {recipients.length} recipient{recipients.length === 1 ? '' : 's'}
          {incompleteCount > 0 && (
            <span className="ml-2 text-amber-700">{incompleteCount} incomplete</span>
          )}
        </span>
      </div>

      {/* A wide table must scroll inside its own box rather than pushing the
          modal sideways. */}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              <th className="w-8 border-b border-slate-200 px-2 py-2 text-left text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                #
              </th>
              <th className="min-w-[14rem] border-b border-slate-200 px-2 py-2 text-left text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                Email
              </th>
              {columns.map((column) => (
                <th
                  key={column}
                  className="min-w-[9rem] border-b border-slate-200 px-2 py-1 text-left"
                >
                  <span className="flex items-center gap-1">
                    <input
                      value={column}
                      onChange={(event) => renameColumn(column, event.target.value)}
                      disabled={disabled}
                      aria-label={`Column name: ${column}`}
                      className={`w-full min-w-0 rounded bg-transparent px-1 py-1 text-[11px] font-medium tracking-wide uppercase focus:bg-white focus:outline-none ${
                        columnIsRequired(column) ? 'text-slate-700' : 'text-slate-400'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => removeColumn(column)}
                      disabled={disabled}
                      aria-label={`Remove column ${column}`}
                      className="shrink-0 rounded p-1 text-slate-300 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50"
                    >
                      <CloseIcon className="h-3 w-3" />
                    </button>
                  </span>
                </th>
              ))}
              <th className="w-9 border-b border-slate-200" />
            </tr>
          </thead>

          <tbody>
            {recipients.map((recipient, rowIndex) => {
              const missing = missingIn(recipient);
              return (
                <tr
                  key={rowIndex}
                  className={missing.length ? 'bg-amber-50/60' : 'odd:bg-white even:bg-slate-50/40'}
                >
                  <td className="border-b border-slate-100 px-2 py-1 text-xs text-slate-400 tabular-nums">
                    {rowIndex + 1}
                  </td>
                  <td className="border-b border-slate-100">
                    <input
                      value={recipient.email}
                      onChange={(event) => setEmail(rowIndex, event.target.value)}
                      disabled={disabled}
                      placeholder="someone@example.com"
                      autoComplete="off"
                      aria-label={`Email for row ${rowIndex + 1}`}
                      className={cellClass}
                    />
                  </td>
                  {columns.map((column) => {
                    const blank = String(recipient.vars[column] ?? '').trim() === '';
                    return (
                      <td key={column} className="border-b border-slate-100">
                        <input
                          value={recipient.vars[column] ?? ''}
                          onChange={(event) => setCell(rowIndex, column, event.target.value)}
                          disabled={disabled}
                          aria-label={`${column} for row ${rowIndex + 1}`}
                          placeholder={columnIsRequired(column) && blank ? 'Required' : ''}
                          className={`${cellClass} ${
                            columnIsRequired(column) && blank ? 'placeholder:text-amber-600' : ''
                          }`}
                        />
                      </td>
                    );
                  })}
                  <td className="border-b border-slate-100 px-1">
                    <button
                      type="button"
                      onClick={() => removeRow(rowIndex)}
                      disabled={disabled}
                      aria-label={`Remove row ${rowIndex + 1}`}
                      className="rounded p-1.5 text-slate-300 hover:bg-slate-200 hover:text-red-700 disabled:opacity-50"
                    >
                      <CloseIcon className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {recipients.length === 0 && (
              <tr>
                <td colSpan={columns.length + 3} className="px-3 py-6 text-center text-sm text-slate-400">
                  No recipients yet. Add a row, or import a CSV.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
