/**
 * Document Parser Service
 * Sabi Intelligence Suite · AI Goal Generator
 *
 * Parses uploaded documents into text content or image data
 * for the Claude AI goal generation pipeline.
 *
 * Supported: PDF, DOCX, XLSX/XLS, JPEG, PNG
 *
 * npm install pdf-parse mammoth xlsx
 */

'use strict';

// ── Result types ──────────────────────────────────────────────────────────────
// { type: 'text',  fileName, content }           for PDF / DOCX / XLSX
// { type: 'image', fileName, base64, mimeType }  for JPEG / PNG

// ── PDF ──────────────────────────────────────────────────────────────────────
async function parsePDF(buffer, fileName) {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer, { max: 50 }); // cap at 50 pages
    return {
      type:     'text',
      fileName,
      content:  data.text.trim().slice(0, 80_000), // ~20k tokens max
    };
  } catch (err) {
    throw new Error(`Failed to read PDF "${fileName}": ${err.message}`);
  }
}

// ── DOCX ─────────────────────────────────────────────────────────────────────
async function parseDOCX(buffer, fileName) {
  try {
    const mammoth = require('mammoth');
    const result  = await mammoth.extractRawText({ buffer });
    return {
      type:     'text',
      fileName,
      content:  result.value.trim().slice(0, 80_000),
    };
  } catch (err) {
    throw new Error(`Failed to read Word document "${fileName}": ${err.message}`);
  }
}

// ── XLSX / XLS ────────────────────────────────────────────────────────────────
async function parseExcel(buffer, fileName) {
  try {
    const XLSX   = require('xlsx');
    const wb     = XLSX.read(buffer, { type: 'buffer' });
    const lines  = [];

    for (const sheetName of wb.SheetNames) {
      lines.push(`=== Sheet: ${sheetName} ===`);
      const rows = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
      lines.push(rows.slice(0, 20_000)); // cap each sheet
    }

    return {
      type:     'text',
      fileName,
      content:  lines.join('\n').slice(0, 80_000),
    };
  } catch (err) {
    throw new Error(`Failed to read Excel file "${fileName}": ${err.message}`);
  }
}

// ── JPEG / PNG (vision) ───────────────────────────────────────────────────────
async function parseImage(buffer, mimeType, fileName) {
  return {
    type:     'image',
    fileName,
    base64:   buffer.toString('base64'),
    mimeType: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
  };
}

// ── Main dispatcher ───────────────────────────────────────────────────────────
async function parseDocument(file) {
  const { originalname, mimetype, buffer } = file;
  const ext = (originalname.split('.').pop() || '').toLowerCase();

  if (ext === 'pdf' || mimetype === 'application/pdf') {
    return parsePDF(buffer, originalname);
  }

  if (ext === 'docx' ||
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return parseDOCX(buffer, originalname);
  }

  if (['xlsx', 'xls'].includes(ext) ||
      mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimetype === 'application/vnd.ms-excel') {
    return parseExcel(buffer, originalname);
  }

  if (['jpg', 'jpeg', 'png'].includes(ext) || mimetype.startsWith('image/')) {
    return parseImage(buffer, mimetype, originalname);
  }

  throw new Error(
    `"${originalname}" is not a supported file type. Upload PDF, DOCX, XLSX, JPEG, or PNG.`
  );
}

// ── Batch parse ───────────────────────────────────────────────────────────────
async function parseDocuments(files) {
  const results = await Promise.allSettled(files.map(parseDocument));
  const parsed = [], errors = [];

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') parsed.push(r.value);
    else errors.push({ file: files[i].originalname, error: r.reason?.message });
  });

  if (parsed.length === 0) {
    throw new Error(
      `None of the uploaded files could be read. ${errors.map(e => e.error).join(' · ')}`
    );
  }

  return { parsed, errors };
}

module.exports = { parseDocument, parseDocuments };
