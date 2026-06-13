const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const { Invoice, Payable, BankTransaction, SundryLedger } = require('./models/Finance');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

const MONGO_URI = 'mongodb+srv://chennakesavarao89_db_user:chenna12345@finance.ir4cjql.mongodb.net/?appName=Finance';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Precifast Ultimate ERP Connected!'))
    .catch(err => console.log('❌ Database Connection Error:', err));

const parseExcelDate = (val) => {
    if (!val || val === '') return null; 

    // 1. Raw Excel Serial Numbers
    if (typeof val === 'number') {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
    }

    // 2. The Timezone Fix (When xlsx automatically creates a Date object)
    if (val instanceof Date) {
        // Adds 6 hours to safely push backward-shifted times (like 18:30) into the correct day!
        const safeDate = new Date(val.getTime() + (6 * 60 * 60 * 1000));
        return new Date(Date.UTC(safeDate.getUTCFullYear(), safeDate.getUTCMonth(), safeDate.getUTCDate(), 12, 0, 0));
    }

    let strVal = String(val).trim();

    // 3. String Matches
    const ymdMatch = strVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) return new Date(Date.UTC(parseInt(ymdMatch[1]), parseInt(ymdMatch[2]) - 1, parseInt(ymdMatch[3]), 12, 0, 0));

    const dmyMatch = strVal.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (dmyMatch) return new Date(Date.UTC(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]), 12, 0, 0));

    // 4. Fallback for weird strings
    const d = new Date(val);
    if (isNaN(d.valueOf())) return null;
    const safeDate = new Date(d.getTime() + (6 * 60 * 60 * 1000));
    return new Date(Date.UTC(safeDate.getUTCFullYear(), safeDate.getUTCMonth(), safeDate.getUTCDate(), 12, 0, 0));
};
const parseExcelDateTime = (val) => {
    if (!val || val === '') return null; 
    if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000); 
    let strVal = String(val).trim();
    const dmyTimeMatch = strVal.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
    if (dmyTimeMatch) {
        return new Date(Date.UTC(parseInt(dmyTimeMatch[3]), parseInt(dmyTimeMatch[2]) - 1, parseInt(dmyTimeMatch[1]), parseInt(dmyTimeMatch[4]), parseInt(dmyTimeMatch[5]), parseInt(dmyTimeMatch[6])));
    }
    const dmyMatch = strVal.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (dmyMatch) return new Date(Date.UTC(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]), 12, 0, 0));
    const d = new Date(val);
    if (isNaN(d.valueOf())) return null;
    return d;
};

const getVal = (row, searchStrs) => {
    const keys = Object.keys(row);
    for (let search of searchStrs) {
        const cleanSearch = search.replace(/[^a-z0-9]/gi, '').toLowerCase();
        
        // Phase 1: Try EXACT match first (prevents grabbing "Debit Balance" instead of "Debit")
        const exactKey = keys.find(k => k.replace(/[^a-z0-9]/gi, '').toLowerCase() === cleanSearch);
        if (exactKey && row[exactKey] !== undefined && row[exactKey] !== '') return row[exactKey];

        // Phase 2: Fallback to INCLUDES
        const foundKey = keys.find(k => k.replace(/[^a-z0-9]/gi, '').toLowerCase().includes(cleanSearch));
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') return row[foundKey];
    }
    return undefined;
};
const parseAmount = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    // Strips out commas and spaces so "21,459.00" becomes perfectly readable
    const parsed = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
    return isNaN(parsed) ? 0 : parsed;
};
const getSheetName = (workbook, targetName) => workbook.SheetNames.find(s => s.replace(/\s/g, '').toLowerCase() === targetName.toLowerCase());

app.post('/api/finance/upload-excel', upload.single('file'), async (req, res) => {
    try {
        const workbook = xlsx.readFile(req.file.path, { cellDates: true });
        
        // 1. BANK STATEMENT
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
            const bankSheet = workbook.Sheets[bankSheetName];
            const bankData = xlsx.utils.sheet_to_json(bankSheet, { range: bankHeaderIndex });
            const bulkBankOps = [];
            bankData.forEach(r => {
                const desc = getVal(r, ['description']);
                const tDate = parseExcelDateTime(getVal(r, ['transactiondate']));
                if (!desc || !tDate) return;
                const keys = Object.keys(r);
                const balanceKeys = keys.filter(k => k.toLowerCase().includes('balance'));
                const firstBal = balanceKeys.length > 0 ? parseFloat(r[balanceKeys[0]]) : 0;
                const secondBal = balanceKeys.length > 1 ? parseFloat(r[balanceKeys[1]]) : 0;
                const doc = {
                    transactionDate: tDate, valueDate: parseExcelDate(getVal(r, ['valuedate'])),
                    chequeNo: getVal(r, ['chequeno', 'cheque']), description: desc, branchCode: getVal(r, ['branchcode']),
                    debit: parseFloat(getVal(r, ['debit'])) || 0, credit: parseFloat(getVal(r, ['credit'])) || 0,
                    balance: firstBal || 0, finalBalance: secondBal || 0,
                    head: getVal(r, ['head']), name: getVal(r, ['name']), remarks: getVal(r, ['remarks', 'remakrs'])
                };
                bulkBankOps.push({ updateOne: { filter: { transactionDate: tDate, description: desc, debit: doc.debit, credit: doc.credit }, update: { $set: doc }, upsert: true }});
            });
            if (bulkBankOps.length > 0) await BankTransaction.bulkWrite(bulkBankOps);
        }

        // 2. SALES
        let isSalesStmt = false, salesHeaderIndex = -1, salesSheetName = null;
        
        // Step A: Dynamically search all sheets for "vchno" and "particulars"
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

        // Step B: If found, process the data no matter what the tab is named
        if (isSalesStmt) {
            const sheet = workbook.Sheets[salesSheetName];
            const rawSales = xlsx.utils.sheet_to_json(sheet, { range: salesHeaderIndex });
            const bulkSalesOps = [];
            
            // Bulletproof number parser (removes commas from 84,961.00)
            const parseAmount = (val) => {
                if (val === undefined || val === null || val === '') return 0;
                if (typeof val === 'number') return val;
                const parsed = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
                return isNaN(parsed) ? 0 : parsed;
            };

            rawSales.forEach(r => {
                let customerName = r['Particulars'];
                if (customerName && (customerName.trim().toLowerCase() === 'by' || customerName.trim().toLowerCase() === 'to')) {
                    customerName = r['__EMPTY'] || r['__EMPTY_1'] || r['__EMPTY_2'];
                } else if (!customerName) { customerName = r['__EMPTY'] || r['__EMPTY_1']; }
                const invNo = getVal(r, ['vchno', 'invoiceno']);
                if (!invNo) return; 

                // Use the parser to extract clean numbers
                const debitAmount = parseAmount(getVal(r, ['debit', 'debitamount', 'dr']));
                const creditAmount = parseAmount(getVal(r, ['credit', 'creditamount', 'cr']));

                // THE MATH FIX: Net Sales = Credit (Sales) - Debit (Credit Notes / Returns)
                const invoiceValue = creditAmount - debitAmount;

                const doc = {
                    invoiceNo: invNo,
                    invoiceDate: parseExcelDate(getVal(r, ['date', 'invoicedate'])),
                    customer: customerName,
                    debit: debitAmount,
                    credit: creditAmount,
                    invoiceValue: invoiceValue,
                    marketier: getVal(r, ['remakrs', 'remarks', 'marketier'])
                };

                // === THE SPY ===
                console.log("--- NEW SALE DETECTED ---");
                console.log("Customer:", customerName);
                console.log("Debit Found:", debitAmount, "| Credit Found:", creditAmount);
                console.log("-------------------------");

                bulkSalesOps.push({ updateOne: { filter: { invoiceNo: invNo }, update: { $set: doc }, upsert: true }});
            });
            if (bulkSalesOps.length > 0) await Invoice.bulkWrite(bulkSalesOps);
        }

        // 3. PURCHASES
        let isPurchaseStmt = false, purchaseHeaderIndex = -1, purchaseSheetName = null;
        for (let sheetName of workbook.SheetNames) {
            const rawSheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
            for (let i = 0; i < Math.min(rawSheet.length, 20); i++) {
                const rowStr = (rawSheet[i] || []).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (rowStr.includes('gstin') && rowStr.includes('supplier')) { 
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
                    gstin: getVal(r, ['gstin']), vendor: vendor, invoiceNumber: invoiceNumber,
                    invoiceDate: parseExcelDate(getVal(r, ['invoicedate', 'date'])),
                    matRecDate: parseExcelDate(getVal(r, ['matrecdate', 'tallydate'])),
                    invoiceValue: parseFloat(getVal(r, ['invoicevalue'])) || 0,
                    taxableValue: parseFloat(getVal(r, ['taxablevalue'])) || 0,
                    integratedTax: parseFloat(getVal(r, ['integratedtax', 'igst'])) || 0,
                    centralTax: parseFloat(getVal(r, ['centraltax', 'cgst'])) || 0,
                    stateTax: parseFloat(getVal(r, ['statetax', 'sgst'])) || 0,
                    remarks: getVal(r, ['remakrs', 'remarks'])
                };
                bulkPurchaseOps.push({ updateOne: { filter: { invoiceNumber: invoiceNumber, vendor: vendor }, update: { $set: doc }, upsert: true }});
            });
            if (bulkPurchaseOps.length > 0) await Payable.bulkWrite(bulkPurchaseOps);
        }

        // 4. SUNDRY LEDGERS
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

                const isHeader = firstVal === firstVal.toUpperCase() && 
                                 firstVal.length > 3 && 
                                 !firstVal.includes('LTD') && 
                                 !firstVal.includes('PVT') &&
                                 (row[1] || '').toString().trim() === '';

                if (isHeader) {
                    currentCategory = firstVal;
                    return; 
                }

                if (firstVal.toLowerCase() === 'ledger name' || firstVal.toLowerCase() === 'list of ledgers') return;

                let sectorType = 'Other';
                const catUpper = currentCategory.toUpperCase();
                if (catUpper.includes('AUTO')) sectorType = 'Auto';
                else if (catUpper.includes('INDUSTRIAL')) sectorType = 'Industrial';
                else if (catUpper.includes('SS')) sectorType = 'SS';
                else if (catUpper.includes('OE') || catUpper.includes('BAJAJ') || catUpper.includes('GABRIEL')) sectorType = 'OE';

                const doc = {
                    ledgerName: firstVal,
                    category: currentCategory,
                    sectorType: sectorType,
                    gstin: (row[1] || '').toString().trim() || null,
                    extra: (row[2] || '').toString().trim() || null
                };
                bulkLedgerOps.push({ updateOne: { filter: { ledgerName: firstVal }, update: { $set: doc }, upsert: true }});
            });

            if (bulkLedgerOps.length > 0) await SundryLedger.bulkWrite(bulkLedgerOps);
        }
        
        res.json({ message: "Excel Data Attached & Updated Successfully!" });
    } catch (error) { console.error(error); res.status(500).json({ error: "Failed to process Excel data." }); }
});

// ─── SUNDRY LEDGERS API ───────────────────────────────────────────────────────

app.get('/api/finance/sundry-ledgers', async (req, res) => {
    try {
        const ledgers = await SundryLedger.find({}).sort({ category: 1, ledgerName: 1 });
        res.json(ledgers);
    } catch (error) { res.status(500).json({ error: "Failed to fetch ledgers" }); }
});

app.post('/api/finance/sundry-ledger', async (req, res) => {
    try {
        await SundryLedger.findOneAndUpdate(
            { ledgerName: req.body.ledgerName },
            { $set: req.body },
            { upsert: true }
        );
        res.json({ message: "Ledger entry saved!" });
    } catch (error) { res.status(500).json({ error: "Failed to save ledger" }); }
});

app.delete('/api/finance/sundry-ledger/:id', async (req, res) => {
    try {
        await SundryLedger.findByIdAndDelete(req.params.id);
        res.json({ message: "Ledger deleted!" });
    } catch (error) { res.status(500).json({ error: "Failed to delete ledger" }); }
});

// ─── MAIN DATA API (UPDATED WITH SMART DATA MATCHING) ─────────────────────────

app.get('/api/finance/all-data', async (req, res) => {
    try {
        let targetDate;
        if (req.query.date && req.query.date !== '') {
            targetDate = new Date(req.query.date);
        } else {
            const latestInvoice = await Invoice.findOne().sort({ invoiceDate: -1 });
            const latestPayable = await Payable.findOne().sort({ matRecDate: -1 });
            const latestBank = await BankTransaction.findOne().sort({ transactionDate: -1 });
            const dates = [ latestInvoice?.invoiceDate || new Date(0), latestPayable?.matRecDate || new Date(0), latestBank?.transactionDate || new Date(0) ];
            targetDate = new Date(Math.max(...dates.map(d => d.getTime())));
            if (targetDate.getTime() === 0) targetDate = new Date(); 
        }

        const startOfMonth = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1));
        const startOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0));
        const endOfDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59));

        const matchMTDSales = { invoiceDate: { $gte: startOfMonth, $lte: endOfDay } };
        const matchMTDPurchase = { matRecDate: { $gte: startOfMonth, $lte: endOfDay } };
        const matchMTDBank = { transactionDate: { $gte: startOfMonth, $lte: endOfDay } };

        const receivables = await Invoice.find({}).sort({ invoiceDate: -1 });
        const payables = await Payable.find({}).sort({ matRecDate: -1 });
        const bankTransactions = await BankTransaction.find({}).sort({ transactionDate: -1 });

        // Load all ledgers to perform smart auto-categorization
        const allLedgers = await SundryLedger.find({});
        
        const bajajLedgerNames = allLedgers.filter(l => l.category && l.category.toUpperCase().includes('BAJAJ')).map(l => l.ledgerName.toUpperCase());
        const gabrielLedgerNames = allLedgers.filter(l => l.category && l.category.toUpperCase().includes('GABRIEL')).map(l => l.ledgerName.toUpperCase());
        const autoLedgerNames = allLedgers.filter(l => l.sectorType === 'Auto').map(l => l.ledgerName.toUpperCase());
        const industrialLedgerNames = allLedgers.filter(l => l.sectorType === 'Industrial').map(l => l.ledgerName.toUpperCase());
        const ssLedgerNames = allLedgers.filter(l => l.sectorType === 'SS').map(l => l.ledgerName.toUpperCase());

        // We fetch all MTD Sales and dynamically categorize them to fix empty/wrong Excel remarks
        const allMTDSales = await Invoice.find(matchMTDSales);
        
        const salesMap = {};
        const oeSubAnalysis = { BAJAJ: { today: 0, mtd: 0 }, 'GABRIEL INDIA LIMITED': { today: 0, mtd: 0 }, 'OTHER OE': { today: 0, mtd: 0 } };
        const retailSubAnalysis = { AUTO: { today: 0, mtd: 0 }, INDUSTRIAL: { today: 0, mtd: 0 }, SS: { today: 0, mtd: 0 } };

        allMTDSales.forEach(inv => {
            const custUpper = (inv.customer || '').toUpperCase();
            let markUpper = (inv.marketier || '').toUpperCase();
            const isToday = inv.invoiceDate >= startOfDay && inv.invoiceDate <= endOfDay;
            const val = inv.invoiceValue || 0;

            // SMART MATCHING: Check customer against ledgers to override empty/wrong categories
            let isAuto = autoLedgerNames.some(n => custUpper === n || custUpper.includes(n) || n.includes(custUpper));
            let isInd = industrialLedgerNames.some(n => custUpper === n || custUpper.includes(n) || n.includes(custUpper));
            let isSS = ssLedgerNames.some(n => custUpper === n || custUpper.includes(n) || n.includes(custUpper));
            let isBajaj = bajajLedgerNames.some(n => custUpper.includes(n) || n.includes(custUpper)) || custUpper.includes('BAJAJ');
            let isGabriel = gabrielLedgerNames.some(n => custUpper.includes(n) || n.includes(custUpper)) || custUpper.includes('GABRIEL');

            // 👉 THE "CUT IN" FIX: Force unmapped Retails to cut from the AUTO sector automatically
            if (markUpper === 'RETAILS' && !isAuto && !isInd && !isSS) {
                isAuto = true;
            }

            // Force the Main Category based on ledger match
            if (isAuto || isInd) markUpper = 'RETAILS';
            else if (isSS) markUpper = 'SS DEALERS';
            else if (isBajaj || isGabriel) markUpper = 'OE';
            
            if (!markUpper) markUpper = 'UNCATEGORIZED';

            // 1. Build Main Dashboard Analysis
            if (!salesMap[markUpper]) salesMap[markUpper] = { _id: markUpper, mtd: 0, today: 0 };
            salesMap[markUpper].mtd += val;
            if (isToday) salesMap[markUpper].today += val;

            // 2. Build Sub Analysis Rows (e.g., ↳ Industrial)
            if (isBajaj) {
                oeSubAnalysis['BAJAJ'].mtd += val;
                if (isToday) oeSubAnalysis['BAJAJ'].today += val;
            } else if (isGabriel) {
                oeSubAnalysis['GABRIEL INDIA LIMITED'].mtd += val;
                if (isToday) oeSubAnalysis['GABRIEL INDIA LIMITED'].today += val;
            } else if (markUpper === 'OE') {
                oeSubAnalysis['OTHER OE'].mtd += val;
                if (isToday) oeSubAnalysis['OTHER OE'].today += val;
            } else if (isAuto) {
                retailSubAnalysis['AUTO'].mtd += val;
                if (isToday) retailSubAnalysis['AUTO'].today += val;
            } else if (isInd) {
                retailSubAnalysis['INDUSTRIAL'].mtd += val;
                if (isToday) retailSubAnalysis['INDUSTRIAL'].today += val;
            } else if (isSS) {
                retailSubAnalysis['SS'].mtd += val;
                if (isToday) retailSubAnalysis['SS'].today += val;
            }
        });

        // Convert the map to an array for the frontend
        const salesAnalysis = Object.values(salesMap);

        const purchaseAnalysis = await Payable.aggregate([
            { $match: matchMTDPurchase },
            { $group: { _id: '$remarks', mtd: { $sum: '$taxableValue' }, today: { $sum: { $cond: [ { $and: [ { $gte: ['$matRecDate', startOfDay] }, { $lte: ['$matRecDate', endOfDay] } ] }, '$taxableValue', 0 ] } } } }
        ]);

        const paymentAnalysis = await BankTransaction.aggregate([
            { $match: { ...matchMTDBank, debit: { $gt: 0 } } },
            { $group: { _id: '$remarks', mtd: { $sum: '$debit' }, today: { $sum: { $cond: [ { $and: [ { $gte: ['$transactionDate', startOfDay] }, { $lte: ['$transactionDate', endOfDay] } ] }, '$debit', 0 ] } } } }
        ]);

        const collectionAnalysis = await BankTransaction.aggregate([
            { $match: { ...matchMTDBank, credit: { $gt: 0 } } },
            { $group: { _id: '$remarks', mtd: { $sum: '$credit' }, today: { $sum: { $cond: [ { $and: [ { $gte: ['$transactionDate', startOfDay] }, { $lte: ['$transactionDate', endOfDay] } ] }, '$credit', 0 ] } } } }
        ]);

        res.json({
            currentDate: targetDate.toISOString().split('T')[0],
            tables: { receivables, payables, bankTransactions },
            analysis: { salesAnalysis, purchaseAnalysis, paymentAnalysis, collectionAnalysis, oeSubAnalysis, retailSubAnalysis }
        });
    } catch (error) { console.error(error); res.status(500).json({ error: "Failed to fetch data" }); }
});

app.post('/api/finance/manual-sale', async (req, res) => { await new Invoice({...req.body, invoiceDate: parseExcelDate(req.body.invoiceDate)}).save(); res.json({ message: "Manual Sale Added!" }); });
app.post('/api/finance/manual-purchase', async (req, res) => { await new Payable({...req.body, invoiceDate: parseExcelDate(req.body.invoiceDate), matRecDate: parseExcelDate(req.body.matRecDate)}).save(); res.json({ message: "Manual Purchase Added!" }); });
app.post('/api/finance/manual-bank', async (req, res) => { 
    try {
        const incomingData = { ...req.body };
        incomingData.transactionDate = new Date(req.body.transactionDate);
        incomingData.valueDate = parseExcelDate(req.body.valueDate);
        await new BankTransaction(incomingData).save(); 
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
        else if (['invoiceValue', 'taxableValue', 'integratedTax', 'centralTax', 'stateTax', 'debit', 'credit', 'balance', 'finalBalance'].includes(field)) parsedValue = Number(value);
        await Model.findByIdAndUpdate(id, { [field]: parsedValue });
        res.json({ message: "Cell Updated Successfully!" });
    } catch (error) { res.status(500).json({ error: "Failed to update record." }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));