const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const { Invoice, Payable, BankTransaction, SundryLedger, DeletedRecord, CashFlow } = require('./models/Finance');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

const MONGO_URI = 'mongodb+srv://chennakesavarao89_db_user:chenna12345@finance.ir4cjql.mongodb.net/?appName=Finance';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Precifast Ultimate ERP Connected!'))
    .catch(err => console.log('❌ Database Connection Error:', err));

// ─── stripFormulaString ───────────────────────────────────────────────────────
// Handles cells like ="21-08-2026 08:31:39" or =5.9 stored as formula text
const stripFormulaString = (val) => {
    if (typeof val !== 'string') return val;
    const m = val.match(/^="?(.*?)"?$/);
    return m ? m[1].trim() : val.trim();
};

const parseExcelDate = (val) => {
    if (!val || val === '') return null;
    if (typeof val === 'number') {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
    }
    if (val instanceof Date) {
        const safeDate = new Date(val.getTime() + (6 * 60 * 60 * 1000));
        return new Date(Date.UTC(safeDate.getUTCFullYear(), safeDate.getUTCMonth(), safeDate.getUTCDate(), 12, 0, 0));
    }
    let strVal = stripFormulaString(String(val));
    const ymdMatch = strVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) return new Date(Date.UTC(parseInt(ymdMatch[1]), parseInt(ymdMatch[2]) - 1, parseInt(ymdMatch[3]), 12, 0, 0));
    const dmyMatch = strVal.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (dmyMatch) return new Date(Date.UTC(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]), 12, 0, 0));
    // "21 Aug 2026" format
    const dMonthY = strVal.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (dMonthY) {
        const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
        const m = months[dMonthY[2].toLowerCase().slice(0,3)];
        if (m !== undefined) return new Date(Date.UTC(parseInt(dMonthY[3]), m, parseInt(dMonthY[1]), 12, 0, 0));
    }
    const d = new Date(strVal);
    if (isNaN(d.valueOf())) return null;
    const safeDate = new Date(d.getTime() + (6 * 60 * 60 * 1000));
    return new Date(Date.UTC(safeDate.getUTCFullYear(), safeDate.getUTCMonth(), safeDate.getUTCDate(), 12, 0, 0));
};

const parseExcelDateTime = (val) => {
    if (!val || val === '') return null;
    if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000);
    if (val instanceof Date) return val;
    // Strip ="..." wrapper first - THIS IS THE KEY FIX
    let strVal = stripFormulaString(String(val));
    const dmyTimeMatch = strVal.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
    if (dmyTimeMatch) {
        return new Date(Date.UTC(parseInt(dmyTimeMatch[3]), parseInt(dmyTimeMatch[2]) - 1, parseInt(dmyTimeMatch[1]),
            parseInt(dmyTimeMatch[4]), parseInt(dmyTimeMatch[5]), parseInt(dmyTimeMatch[6])));
    }
    const dmyMatch = strVal.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (dmyMatch) return new Date(Date.UTC(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]), 12, 0, 0));
    const d = new Date(strVal);
    if (isNaN(d.valueOf())) return null;
    return d;
};

const getVal = (row, searchStrs) => {
    const keys = Object.keys(row);
    for (let search of searchStrs) {
        const cleanSearch = search.replace(/[^a-z0-9]/gi, '').toLowerCase();
        const exactKey = keys.find(k => k.replace(/[^a-z0-9]/gi, '').toLowerCase() === cleanSearch);
        if (exactKey && row[exactKey] !== undefined && row[exactKey] !== '') return row[exactKey];
        const foundKey = keys.find(k => k.replace(/[^a-z0-9]/gi, '').toLowerCase().includes(cleanSearch));
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') return row[foundKey];
    }
    return undefined;
};

const parseAmount = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const stripped = stripFormulaString(String(val));
    const parsed = parseFloat(stripped.replace(/[^0-9.-]+/g, ''));
    return isNaN(parsed) ? 0 : parsed;
};

const getSheetName = (workbook, targetName) => workbook.SheetNames.find(s => s.replace(/\s/g, '').toLowerCase() === targetName.toLowerCase());

app.post('/api/finance/upload-excel', upload.single('file'), async (req, res) => {
    try {
        const workbook = xlsx.readFile(req.file.path, { cellDates: true });

        // ═══════════════════════════════════════════════════════════════════════
        // 1. BANK STATEMENT
        // CRITICAL FIX: Use raw array mode (header:1) instead of object mode.
        // Reason: Your sheet has TWO columns both named "Balance" (cols 9 and 10).
        // xlsx.sheet_to_json in object mode creates { Balance: val1, Balance: val2 }
        // but JavaScript objects can only have ONE key named "Balance" — the second
        // overwrites the first, so the real numeric balance is lost and replaced
        // by the formula string "=K3+I4-H4". Raw array mode avoids this entirely.
        // ═══════════════════════════════════════════════════════════════════════
        let isBankStmt = false, bankHeaderIndex = -1, bankSheetName = null;
        for (let sheetName of workbook.SheetNames) {
            const rawSheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
            for (let i = 0; i < Math.min(rawSheet.length, 20); i++) {
                const rowStr = (rawSheet[i] || []).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (rowStr.includes('transactiondate') && rowStr.includes('balance')) {
                    isBankStmt = true; bankSheetName = sheetName; bankHeaderIndex = i; break;
                }
            }
            if (isBankStmt) break;
        }

        if (isBankStmt) {
            // Use raw array mode — every row is an array, we access by column INDEX
            const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[bankSheetName], { header: 1 });
            const headerRow = rawRows[bankHeaderIndex];

            // Find column indices by scanning header names
            const colIdx = {};
            headerRow.forEach((h, i) => {
                if (!h) return;
                const clean = String(h).replace(/[^a-z0-9]/gi, '').toLowerCase();
                // For duplicate 'Balance': first one goes to 'balance', second to 'balance2'
                if (clean === 'balance' && colIdx['balance'] === undefined) colIdx['balance'] = i;
                else if (clean === 'balance') colIdx['balance2'] = i;
                else if (!colIdx[clean]) colIdx[clean] = i;
            });

            console.log('Bank column indices found:', colIdx);

            const bulkBankOps = [];
            // Start from bankHeaderIndex+1, skip the blank row right after header if any
            for (let ri = bankHeaderIndex + 1; ri < rawRows.length; ri++) {
                const row = rawRows[ri];
                if (!row || row.length === 0) continue;

                const get = (key) => (colIdx[key] !== undefined) ? row[colIdx[key]] : undefined;

                // FIX 1: Strip ="..." from date string before parsing
                const rawTDate = get('transactiondate');
                const tDate = parseExcelDateTime(rawTDate);
                const rawDesc = get('description');
                const desc = rawDesc ? stripFormulaString(String(rawDesc)) : null;

                if (!tDate || !desc) continue; // skip blank/invalid rows

                // FIX 2: Access both Balance columns by index directly — no key collision
                const firstBal  = parseAmount(colIdx['balance']  !== undefined ? row[colIdx['balance']]  : 0);
                const secondBal = parseAmount(colIdx['balance2'] !== undefined ? row[colIdx['balance2']] : 0);

                const debit  = parseAmount(get('debit'));
                const credit = parseAmount(get('credit'));

                const doc = {
                    transactionDate: tDate,
                    valueDate:   parseExcelDate(get('valuedate')),
                    chequeNo:    stripFormulaString(String(get('chequeno') ?? get('cheque') ?? '')),
                    description: desc,
                    branchCode:  String(get('branchcode') ?? ''),
                    debit,
                    credit,
                    balance:      firstBal,
                    finalBalance: secondBal,
                    head:    get('head')    ?? '',
                    name:    get('name')    ?? '',
                    remarks: get('remarks') ?? get('remakrs') ?? ''
                };

                bulkBankOps.push({
                    updateOne: {
                        filter: { transactionDate: tDate, description: desc, debit: doc.debit, credit: doc.credit },
                        update: { $set: doc },
                        upsert: true
                    }
                });
            }

            console.log(`✅ Bank: ${bulkBankOps.length} rows ready to save`);
            if (bulkBankOps.length > 0) await BankTransaction.bulkWrite(bulkBankOps);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 2. SALES
        // FIX: Tally exports "By" in Particulars column; actual customer name is
        // in the next merged cell which xlsx names "__EMPTY". Use raw array mode
        // too so col 2 (None header) is accessible as __EMPTY by index.
        // ═══════════════════════════════════════════════════════════════════════
        let isSalesStmt = false, salesHeaderIndex = -1, salesSheetName = null;
        for (let sheetName of workbook.SheetNames) {
            const rawSheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
            for (let i = 0; i < Math.min(rawSheet.length, 20); i++) {
                const rowStr = (rawSheet[i] || []).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (rowStr.includes('vchno') && rowStr.includes('particulars')) {
                    isSalesStmt = true; salesSheetName = sheetName; salesHeaderIndex = i; break;
                }
            }
            if (isSalesStmt) break;
        }

        if (isSalesStmt) {
            // Use raw array mode for Sales too
            const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[salesSheetName], { header: 1 });
            const headerRow = rawRows[salesHeaderIndex];

            // Map column indices: Date=0, Particulars=1, CustomerName(merged)=2, VchType=3, VchNo=4, Debit=5, Credit=6
            const colIdx = {};
            headerRow.forEach((h, i) => {
                if (!h) {
                    // col 2 is None (merged cell carrying customer name)
                    if (colIdx['customername'] === undefined) colIdx['customername'] = i;
                    return;
                }
                const clean = String(h).replace(/[^a-z0-9]/gi, '').toLowerCase();
                colIdx[clean] = i;
            });
            console.log('Sales column indices:', colIdx);

            const bulkSalesOps = [];
            for (let ri = salesHeaderIndex + 1; ri < rawRows.length; ri++) {
                const row = rawRows[ri];
                if (!row || row.length === 0) continue;

                const get = (key) => (colIdx[key] !== undefined) ? row[colIdx[key]] : undefined;

                const invNo = get('vchno');
                if (!invNo) continue;

                // Particulars col = "By" or "To", actual name is in the merged next col
                const particulars = get('particulars');
                let customerName;
                if (!particulars || (typeof particulars === 'string' &&
                    (particulars.trim().toLowerCase() === 'by' || particulars.trim().toLowerCase() === 'to'))) {
                    customerName = get('customername');
                } else {
                    customerName = particulars;
                }

                const debitAmount  = parseAmount(get('debit'));
                const creditAmount = parseAmount(get('credit'));
                const invoiceValue = creditAmount - debitAmount;

                // Date: already a Date object from xlsx cellDates:true
                const rawDate = get('date');
                const invoiceDate = rawDate instanceof Date ? parseExcelDate(rawDate) : parseExcelDate(rawDate);

                const doc = {
                    invoiceNo:    String(invNo).trim(),
                    invoiceDate,
                    customer:     customerName || '',
                    debit:        debitAmount,
                    credit:       creditAmount,
                    invoiceValue,
                    marketier:    get('remarks') ?? get('remakrs') ?? ''
                };

                console.log('SALE:', doc.invoiceNo, '| Customer:', customerName, '| Credit:', creditAmount, '| Debit:', debitAmount);
                bulkSalesOps.push({
                    updateOne: { filter: { invoiceNo: doc.invoiceNo }, update: { $set: doc }, upsert: true }
                });
            }

            console.log(`✅ Sales: ${bulkSalesOps.length} rows ready to save`);
            if (bulkSalesOps.length > 0) await Invoice.bulkWrite(bulkSalesOps);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 3. PURCHASES
        // ═══════════════════════════════════════════════════════════════════════
        let isPurchaseStmt = false, purchaseHeaderIndex = -1, purchaseSheetName = null;
        for (let sheetName of workbook.SheetNames) {
            const rawSheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
            for (let i = 0; i < Math.min(rawSheet.length, 5); i++) {
                const rowStr = (rawSheet[i] || []).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (rowStr.includes('gstin') && (rowStr.includes('supplier') || rowStr.includes('tradelegalname'))) {
                    isPurchaseStmt = true; purchaseSheetName = sheetName; purchaseHeaderIndex = i; break;
                }
            }
            if (isPurchaseStmt) break;
        }

        if (isPurchaseStmt) {
            const sheet = workbook.Sheets[purchaseSheetName];
            const rawPurchase = xlsx.utils.sheet_to_json(sheet, { range: purchaseHeaderIndex });
            const bulkPurchaseOps = [];
            rawPurchase.forEach(r => {
                const vendor = getVal(r, ['tradelegalname', 'supplier', 'name']);
                const invoiceNumber = getVal(r, ['invoicenumber', 'invoiceno']);
                if (!vendor && !invoiceNumber) return;
                const doc = {
                    gstin: getVal(r, ['gstin']), vendor, invoiceNumber,
                    invoiceDate:  parseExcelDate(getVal(r, ['invoicedate', 'date'])),
                    matRecDate:   parseExcelDate(getVal(r, ['matrecdate', 'tallydate'])),
                    invoiceValue: parseAmount(getVal(r, ['invoicevalue'])),
                    taxableValue: parseAmount(getVal(r, ['taxablevalue'])),
                    integratedTax: parseAmount(getVal(r, ['integratedtax', 'igst'])),
                    centralTax:    parseAmount(getVal(r, ['centraltax', 'cgst'])),
                    stateTax:      parseAmount(getVal(r, ['statetax', 'sgst'])),
                    remarks:       getVal(r, ['remakrs', 'remarks'])
                };
                bulkPurchaseOps.push({ updateOne: { filter: { invoiceNumber, vendor }, update: { $set: doc }, upsert: true }});
            });
            console.log(`✅ Purchases: ${bulkPurchaseOps.length} rows ready to save`);
            if (bulkPurchaseOps.length > 0) await Payable.bulkWrite(bulkPurchaseOps);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 4. SUNDRY LEDGERS
        // ═══════════════════════════════════════════════════════════════════════
        let sundrySheetName = null;
        for (let sheetName of workbook.SheetNames) {
            const clean = sheetName.replace(/\s/g, '').toLowerCase();
            if (clean.includes('listofledger') || clean.includes('ledger') || clean.includes('sundry')) {
                sundrySheetName = sheetName; break;
            }
        }

        if (sundrySheetName) {
            const sheet = workbook.Sheets[sundrySheetName];
            const rawArray = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            const bulkLedgerOps = [];
            let currentCategory = 'UNCATEGORIZED';
            rawArray.forEach((row) => {
                const firstVal = (row[0] || '').toString().trim();
                if (!firstVal) return;
                const isHeader = firstVal === firstVal.toUpperCase() && firstVal.length > 3 &&
                                 !firstVal.includes('LTD') && !firstVal.includes('PVT') &&
                                 (row[1] || '').toString().trim() === '';
                if (isHeader) { currentCategory = firstVal; return; }
                if (firstVal.toLowerCase() === 'ledger name' || firstVal.toLowerCase() === 'list of ledgers') return;
                let sectorType = 'Other';
                const catUpper = currentCategory.toUpperCase();
                if (catUpper.includes('AUTO')) sectorType = 'Auto';
                else if (catUpper.includes('INDUSTRIAL')) sectorType = 'Industrial';
                else if (catUpper.includes('SS')) sectorType = 'SS';
                else if (catUpper.includes('OE') || catUpper.includes('BAJAJ') || catUpper.includes('GABRIEL')) sectorType = 'OE';
                const doc = { ledgerName: firstVal, category: currentCategory, sectorType,
                    gstin: (row[1] || '').toString().trim() || null, extra: (row[2] || '').toString().trim() || null };
                bulkLedgerOps.push({ updateOne: { filter: { ledgerName: firstVal }, update: { $set: doc }, upsert: true }});
            });
            if (bulkLedgerOps.length > 0) await SundryLedger.bulkWrite(bulkLedgerOps);
        }

        res.json({ message: "Excel Data Attached & Updated Successfully!" });
    } catch (error) { console.error(error); res.status(500).json({ error: "Failed to process Excel data." }); }
});

// ─── SUNDRY LEDGERS API ───────────────────────────────────────────────────────
app.get('/api/finance/sundry-ledgers', async (req, res) => {
    try { res.json(await SundryLedger.find({}).sort({ category: 1, ledgerName: 1 })); }
    catch (error) { res.status(500).json({ error: "Failed to fetch ledgers" }); }
});
app.post('/api/finance/sundry-ledger', async (req, res) => {
    try { await SundryLedger.findOneAndUpdate({ ledgerName: req.body.ledgerName }, { $set: req.body }, { upsert: true }); res.json({ message: "Ledger entry saved!" }); }
    catch (error) { res.status(500).json({ error: "Failed to save ledger" }); }
});
app.delete('/api/finance/sundry-ledger/:id', async (req, res) => {
    try { await SundryLedger.findByIdAndDelete(req.params.id); res.json({ message: "Ledger deleted!" }); }
    catch (error) { res.status(500).json({ error: "Failed to delete ledger" }); }
});

// ─── SOFT DELETE ──────────────────────────────────────────────────────────────
app.delete('/api/finance/sales/:id', async (req, res) => {
    try {
        const record = await Invoice.findById(req.params.id);
        if (!record) return res.status(404).json({ error: 'Record not found' });
        await DeletedRecord.create({ originalCollection: 'Invoice', originalId: req.params.id.toString(), data: record.toObject(), deletedAt: new Date() });
        await Invoice.findByIdAndDelete(req.params.id);
        res.json({ message: 'Sale moved to trash!' });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to delete sale' }); }
});
app.delete('/api/finance/purchase/:id', async (req, res) => {
    try {
        const record = await Payable.findById(req.params.id);
        if (!record) return res.status(404).json({ error: 'Record not found' });
        await DeletedRecord.create({ originalCollection: 'Payable', originalId: req.params.id.toString(), data: record.toObject(), deletedAt: new Date() });
        await Payable.findByIdAndDelete(req.params.id);
        res.json({ message: 'Purchase moved to trash!' });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to delete purchase' }); }
});
app.delete('/api/finance/bank/:id', async (req, res) => {
    try {
        const record = await BankTransaction.findById(req.params.id);
        if (!record) return res.status(404).json({ error: 'Record not found' });
        await DeletedRecord.create({ originalCollection: 'BankTransaction', originalId: req.params.id.toString(), data: record.toObject(), deletedAt: new Date() });
        await BankTransaction.findByIdAndDelete(req.params.id);
        res.json({ message: 'Bank transaction moved to trash!' });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to delete bank transaction' }); }
});
app.get('/api/finance/deleted-records', async (req, res) => {
    try { res.json(await DeletedRecord.find({}).sort({ deletedAt: -1 })); }
    catch (e) { res.status(500).json({ error: 'Failed to fetch deleted records' }); }
});
app.post('/api/finance/restore/:id', async (req, res) => {
    try {
        const deleted = await DeletedRecord.findById(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Not found in trash' });
        const { _id, __v, ...cleanData } = deleted.data;
        const Model = deleted.originalCollection === 'Invoice' ? Invoice : deleted.originalCollection === 'Payable' ? Payable : BankTransaction;
        await Model.findByIdAndUpdate(deleted.originalId, { $set: cleanData }, { upsert: true, new: true });
        await DeletedRecord.findByIdAndDelete(req.params.id);
        res.json({ message: 'Record restored successfully!' });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to restore record' }); }
});
app.delete('/api/finance/trash/:id', async (req, res) => {
    try { await DeletedRecord.findByIdAndDelete(req.params.id); res.json({ message: 'Permanently deleted!' }); }
    catch (e) { res.status(500).json({ error: 'Failed to permanently delete' }); }
});

// ─── MAIN DATA API ────────────────────────────────────────────────────────────
app.get('/api/finance/all-data', async (req, res) => {
    try {
        let targetDate;
        if (req.query.date && req.query.date !== '') {
            targetDate = new Date(req.query.date);
        } else {
            const latestInvoice = await Invoice.findOne().sort({ invoiceDate: -1 });
            const latestPayable = await Payable.findOne().sort({ matRecDate: -1 });
            const latestBank    = await BankTransaction.findOne().sort({ transactionDate: -1 });
            const dates = [latestInvoice?.invoiceDate || new Date(0), latestPayable?.matRecDate || new Date(0), latestBank?.transactionDate || new Date(0)];
            targetDate = new Date(Math.max(...dates.map(d => d.getTime())));
            if (targetDate.getTime() === 0) targetDate = new Date();
        }
        const startOfMonth = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1));
        const startOfDay   = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0));
        const endOfDay     = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59));
        const matchMTDSales    = { invoiceDate:    { $gte: startOfMonth, $lte: endOfDay } };
        const matchMTDPurchase = { matRecDate:      { $gte: startOfMonth, $lte: endOfDay } };
        const matchMTDBank     = { transactionDate: { $gte: startOfMonth, $lte: endOfDay } };

        const receivables      = await Invoice.find({}).sort({ invoiceDate: -1 });
        const payables         = await Payable.find({}).sort({ matRecDate: -1 });
        const bankTransactions = await BankTransaction.find({}).sort({ transactionDate: -1 });

        const allLedgers = await SundryLedger.find({});
        const bajajLedgerNames      = allLedgers.filter(l => l.category?.toUpperCase().includes('BAJAJ')).map(l => l.ledgerName.toUpperCase());
        const gabrielLedgerNames    = allLedgers.filter(l => l.category?.toUpperCase().includes('GABRIEL')).map(l => l.ledgerName.toUpperCase());
        const autoLedgerNames       = allLedgers.filter(l => l.sectorType === 'Auto').map(l => l.ledgerName.toUpperCase());
        const industrialLedgerNames = allLedgers.filter(l => l.sectorType === 'Industrial').map(l => l.ledgerName.toUpperCase());
        const ssLedgerNames         = allLedgers.filter(l => l.sectorType === 'SS').map(l => l.ledgerName.toUpperCase());

        const allMTDSales = await Invoice.find(matchMTDSales);
        const salesMap = {};
        const oeSubAnalysis     = { BAJAJ: {today:0,mtd:0}, 'GABRIEL INDIA LIMITED': {today:0,mtd:0}, 'OTHER OE': {today:0,mtd:0} };
        const retailSubAnalysis = { AUTO: {today:0,mtd:0}, INDUSTRIAL: {today:0,mtd:0}, SS: {today:0,mtd:0} };

        allMTDSales.forEach(inv => {
            const custUpper = (inv.customer || '').toUpperCase();
            let markUpper   = (inv.marketier || '').toUpperCase();
            const isToday   = inv.invoiceDate >= startOfDay && inv.invoiceDate <= endOfDay;
            const val       = inv.invoiceValue || 0;
            let isAuto    = autoLedgerNames.some(n => custUpper === n || custUpper.includes(n) || n.includes(custUpper));
            let isInd     = industrialLedgerNames.some(n => custUpper === n || custUpper.includes(n) || n.includes(custUpper));
            let isSS      = ssLedgerNames.some(n => custUpper === n || custUpper.includes(n) || n.includes(custUpper));
            let isBajaj   = bajajLedgerNames.some(n => custUpper.includes(n) || n.includes(custUpper)) || custUpper.includes('BAJAJ');
            let isGabriel = gabrielLedgerNames.some(n => custUpper.includes(n) || n.includes(custUpper)) || custUpper.includes('GABRIEL');
            if (markUpper === 'RETAILS' && !isAuto && !isInd && !isSS) isAuto = true;
            if (isAuto || isInd) markUpper = 'RETAILS';
            else if (isSS) markUpper = 'SS DEALERS';
            else if (isBajaj || isGabriel) markUpper = 'OE';
            if (!markUpper) markUpper = 'UNCATEGORIZED';
            if (!salesMap[markUpper]) salesMap[markUpper] = { _id: markUpper, mtd: 0, today: 0 };
            salesMap[markUpper].mtd += val;
            if (isToday) salesMap[markUpper].today += val;
            if (isBajaj) { oeSubAnalysis['BAJAJ'].mtd += val; if (isToday) oeSubAnalysis['BAJAJ'].today += val; }
            else if (isGabriel) { oeSubAnalysis['GABRIEL INDIA LIMITED'].mtd += val; if (isToday) oeSubAnalysis['GABRIEL INDIA LIMITED'].today += val; }
            else if (markUpper === 'OE') { oeSubAnalysis['OTHER OE'].mtd += val; if (isToday) oeSubAnalysis['OTHER OE'].today += val; }
            else if (isAuto) { retailSubAnalysis['AUTO'].mtd += val; if (isToday) retailSubAnalysis['AUTO'].today += val; }
            else if (isInd) { retailSubAnalysis['INDUSTRIAL'].mtd += val; if (isToday) retailSubAnalysis['INDUSTRIAL'].today += val; }
            else if (isSS) { retailSubAnalysis['SS'].mtd += val; if (isToday) retailSubAnalysis['SS'].today += val; }
        });
        const salesAnalysis = Object.values(salesMap);

        const purchaseAnalysis = await Payable.aggregate([
            { $match: matchMTDPurchase },
            { $group: { _id: '$remarks', mtd: { $sum: '$taxableValue' }, today: { $sum: { $cond: [{ $and: [{ $gte: ['$matRecDate', startOfDay] }, { $lte: ['$matRecDate', endOfDay] }] }, '$taxableValue', 0] } } } }
        ]);
        const paymentAnalysis = await BankTransaction.aggregate([
            { $match: { ...matchMTDBank, debit: { $gt: 0 } } },
            { $group: { _id: '$remarks', mtd: { $sum: '$debit' }, today: { $sum: { $cond: [{ $and: [{ $gte: ['$transactionDate', startOfDay] }, { $lte: ['$transactionDate', endOfDay] }] }, '$debit', 0] } } } }
        ]);
        const collectionAnalysis = await BankTransaction.aggregate([
            { $match: { ...matchMTDBank, credit: { $gt: 0 } } },
            { $group: { _id: '$remarks', mtd: { $sum: '$credit' }, today: { $sum: { $cond: [{ $and: [{ $gte: ['$transactionDate', startOfDay] }, { $lte: ['$transactionDate', endOfDay] }] }, '$credit', 0] } } } }
        ]);

        const statutorySubRaw = await BankTransaction.aggregate([
            { $match: { ...matchMTDBank, debit: { $gt: 0 }, $or: [{ remarks: { $regex: /^statutory$/i } }, { remarks: { $regex: /^statutary$/i } }] } },
            { $addFields: { subCategory: { $switch: { branches: [
                { case: { $regexMatch: { input: { $ifNull: ['$head', ''] }, regex: 'salari|wage', options: 'i' } }, then: 'SALARIES' },
                { case: { $regexMatch: { input: { $ifNull: ['$head', ''] }, regex: 'bank.?charge|penalty|lc.?charge|folio', options: 'i' } }, then: 'BANK CHARGES' },
                { case: { $regexMatch: { input: { $ifNull: ['$head', ''] }, regex: 'electric', options: 'i' } }, then: 'ELECTRICITY BILL' },
                { case: { $regexMatch: { input: { $ifNull: ['$head', ''] }, regex: 'apsfc|gecl|working.?capital|narasimha|canara.?loan|loan.?process', options: 'i' } }, then: 'LOANS' }
            ], default: 'OTHER' } } } },
            { $group: { _id: '$subCategory', mtd: { $sum: '$debit' }, today: { $sum: { $cond: [{ $and: [{ $gte: ['$transactionDate', startOfDay] }, { $lte: ['$transactionDate', endOfDay] }] }, '$debit', 0] } } } }
        ]);
        const STATUTORY_SUBS = ['LOANS', 'SALARIES', 'ELECTRICITY BILL', 'BANK CHARGES'];
        const statutorySubAnalysis = {};
        STATUTORY_SUBS.forEach(n => { statutorySubAnalysis[n] = { today: 0, mtd: 0 }; });
        statutorySubRaw.forEach(row => {
            const key = (row._id || '').toUpperCase().trim();
            if (statutorySubAnalysis[key]) { statutorySubAnalysis[key].today = row.today; statutorySubAnalysis[key].mtd = row.mtd; }
        });

        const lastTxOfPreviousMonth = await BankTransaction.findOne({ transactionDate: { $lt: startOfMonth } }).sort({ transactionDate: -1 });
        const lastTxOfMonth = await BankTransaction.findOne({ transactionDate: { $gte: startOfMonth, $lte: endOfDay } }).sort({ transactionDate: -1, _id: 1 });
        const openingBalance = lastTxOfPreviousMonth ? (lastTxOfPreviousMonth.finalBalance || lastTxOfPreviousMonth.balance || 0) : 0;
        const closingBalance = lastTxOfMonth        ? (lastTxOfMonth.finalBalance  || lastTxOfMonth.balance  || 0) : 0;

        res.json({
            currentDate: targetDate.toISOString().split('T')[0],
            tables: { receivables, payables, bankTransactions },
            analysis: { salesAnalysis, purchaseAnalysis, paymentAnalysis, collectionAnalysis, oeSubAnalysis, retailSubAnalysis, statutorySubAnalysis, openingBalance, closingBalance }
        });
    } catch (error) { console.error(error); res.status(500).json({ error: "Failed to fetch data" }); }
});

app.post('/api/finance/manual-sale', async (req, res) => { await new Invoice({...req.body, invoiceDate: parseExcelDate(req.body.invoiceDate)}).save(); res.json({ message: "Manual Sale Added!" }); });
app.post('/api/finance/manual-purchase', async (req, res) => { await new Payable({...req.body, invoiceDate: parseExcelDate(req.body.invoiceDate), matRecDate: parseExcelDate(req.body.matRecDate)}).save(); res.json({ message: "Manual Purchase Added!" }); });
app.post('/api/finance/manual-bank', async (req, res) => {
    try {
        const d = { ...req.body };
        d.transactionDate = new Date(req.body.transactionDate);
        d.valueDate = parseExcelDate(req.body.valueDate);
        await new BankTransaction(d).save();
        res.json({ message: "Manual Bank Entry Added!" });
    } catch (err) { res.status(500).json({ error: "Failed to save bank entry" }); }
});

app.put('/api/finance/update-record/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const { field, value } = req.body;
        let Model = type === 'Sales' ? Invoice : (type === 'Purchase' ? Payable : (type === 'Ledger' ? SundryLedger : BankTransaction));
        let parsedValue = value;
        if (field === 'transactionDate') parsedValue = parseExcelDateTime(value);
        else if (field.toLowerCase().includes('date')) parsedValue = parseExcelDate(value);
        else if (['invoiceValue','taxableValue','integratedTax','centralTax','stateTax','debit','credit','balance','finalBalance'].includes(field)) parsedValue = Number(value);
        await Model.findByIdAndUpdate(id, { [field]: parsedValue });
        res.json({ message: "Cell Updated Successfully!" });
    } catch (error) { res.status(500).json({ error: "Failed to update record." }); }
});

// ─── CASH FLOW PLANNER API ────────────────────────────────────────────────────
app.get('/api/cashflow/load', async (req, res) => {
    try { const cf = await CashFlow.findOne({ name: 'default' }); res.json(cf || { data: null, openingBal: 5, startMonthIdx: 0 }); }
    catch (e) { res.status(500).json({ error: 'Failed to load cash flow data' }); }
});
app.post('/api/cashflow/save', async (req, res) => {
    try {
        await CashFlow.findOneAndUpdate({ name: 'default' }, { $set: { data: req.body.data, openingBal: req.body.openingBal ?? 5, startMonthIdx: req.body.startMonthIdx ?? 0, updatedAt: new Date() } }, { upsert: true, new: true });
        res.json({ message: 'Cash flow data saved!' });
    } catch (e) { res.status(500).json({ error: 'Failed to save cash flow data' }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));