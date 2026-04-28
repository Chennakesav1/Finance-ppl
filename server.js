const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const { Invoice, Payable, BankTransaction } = require('./models/Finance');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

const MONGO_URI = 'mongodb+srv://chennakesavarao89_db_user:chenna12345@finance.ir4cjql.mongodb.net/?appName=Finance';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Precifast Ultimate ERP Connected!'))
    .catch(err => console.log('❌ Database Connection Error:', err));

// ROBUST DATE PARSER: Handles DD-MM-YYYY from Bank Statements too
const parseExcelDate = (val) => {
    if (!val || val === '') return null; 
    if (typeof val === 'number') {
        const d = new Date(Math.round((val - 25569) * 86400 * 1000));
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
    }
    
    let strVal = String(val).trim();
    const dmyMatch = strVal.match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (dmyMatch) {
        return new Date(Date.UTC(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]), 12, 0, 0));
    }

    const d = new Date(val);
    if (isNaN(d.valueOf())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0));
};

const getVal = (row, searchStr) => {
    const clean = (str) => str.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const searchClean = clean(searchStr);
    const key = Object.keys(row).find(k => clean(k).includes(searchClean));
    return key ? row[key] : undefined;
};

const getSheetName = (workbook, targetName) => {
    return workbook.SheetNames.find(s => s.replace(/\s/g, '').toLowerCase() === targetName.toLowerCase());
};

app.post('/api/finance/upload-excel', upload.single('file'), async (req, res) => {
    try {
        const workbook = xlsx.readFile(req.file.path, { cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const firstSheet = workbook.Sheets[firstSheetName];
        const rawFirstSheet = xlsx.utils.sheet_to_json(firstSheet, { header: 1 });

        // 💥 SMART CHECK: IS THIS A BANK STATEMENT?
        let isBankStmt = false;
        let bankHeaderIndex = -1;
        for (let i = 0; i < Math.min(rawFirstSheet.length, 20); i++) {
            const rowStr = (rawFirstSheet[i] || []).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (rowStr.includes('transactiondate') && rowStr.includes('balance')) {
                isBankStmt = true;
                bankHeaderIndex = i;
                break;
            }
        }

        // --- PROCESS BANK STATEMENT ---
        if (isBankStmt) {
            const bankData = xlsx.utils.sheet_to_json(firstSheet, { range: bankHeaderIndex });
            const bulkBankOps = [];

            bankData.forEach(r => {
                const desc = getVal(r, 'description');
                const tDate = parseExcelDate(getVal(r, 'transactiondate'));
                if (!desc || !tDate) return;

                const doc = {
                    transactionDate: tDate,
                    valueDate: parseExcelDate(getVal(r, 'valuedate')),
                    chequeNo: getVal(r, 'chequeno') || getVal(r, 'cheque'),
                    description: desc,
                    branchCode: getVal(r, 'branchcode'),
                    debit: parseFloat(getVal(r, 'debit')) || 0,
                    credit: parseFloat(getVal(r, 'credit')) || 0,
                    balance: parseFloat(getVal(r, 'balance')) || 0,
                    head: getVal(r, 'head'),
                    name: getVal(r, 'name'),
                    remarks: getVal(r, 'remarks') || getVal(r, 'remakrs')
                };

                bulkBankOps.push({
                    updateOne: {
                        filter: { transactionDate: tDate, description: desc, balance: doc.balance },
                        update: { $set: doc },
                        upsert: true
                    }
                });
            });

            if (bulkBankOps.length > 0) await BankTransaction.bulkWrite(bulkBankOps);
            return res.json({ message: "Bank Statement Processed Successfully!" });
        }

        // --- PROCESS SALES ---
        const salesTab = getSheetName(workbook, 'Sales');
        if (salesTab) {
            const sheet = workbook.Sheets[salesTab];
            const rawArray = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            
            let headerRowIndex = -1;
            for (let i = 0; i < rawArray.length; i++) {
                const rowStr = (rawArray[i] || []).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (rowStr.includes('vchno') && rowStr.includes('particulars')) {
                    headerRowIndex = i;
                    break;
                }
            }

            if (headerRowIndex !== -1) {
                const rawSales = xlsx.utils.sheet_to_json(sheet, { range: headerRowIndex });
                const bulkSalesOps = [];

                rawSales.forEach(r => {
                    let customerName = r['Particulars'];
                    if (customerName && (customerName.trim().toLowerCase() === 'by' || customerName.trim().toLowerCase() === 'to')) {
                        customerName = r['__EMPTY'] || r['__EMPTY_1'] || r['__EMPTY_2'];
                    } else if (!customerName) {
                        customerName = r['__EMPTY'] || r['__EMPTY_1'];
                    }

                    const invNo = getVal(r, 'vchno');
                    if (!invNo) return; 

                    const doc = {
                        invoiceNo: invNo,
                        invoiceDate: parseExcelDate(getVal(r, 'date')),
                        customer: customerName,
                        invoiceValue: parseFloat(getVal(r, 'credit')) || parseFloat(getVal(r, 'debit')) || 0,
                        marketier: getVal(r, 'remakrs') || getVal(r, 'remarks')
                    };

                    bulkSalesOps.push({ updateOne: { filter: { invoiceNo: invNo }, update: { $set: doc }, upsert: true }});
                });
                if (bulkSalesOps.length > 0) await Invoice.bulkWrite(bulkSalesOps);
            }
        }

        // --- PROCESS PURCHASES ---
        const purchaseTab = getSheetName(workbook, 'Purchase');
        if (purchaseTab) {
            const sheet = workbook.Sheets[purchaseTab];
            const rawArray = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            let headerRowIndex = -1;
            
            for (let i = 0; i < rawArray.length; i++) {
                const rowStr = (rawArray[i] || []).join(' ').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (rowStr.includes('gstin') && rowStr.includes('supplier')) {
                    headerRowIndex = i;
                    break;
                }
            }

            if (headerRowIndex !== -1) {
                const rawPurchase = xlsx.utils.sheet_to_json(sheet, { range: headerRowIndex });
                const bulkPurchaseOps = [];

                rawPurchase.forEach(r => {
                    const vendor = getVal(r, 'tradelegalname') || getVal(r, 'supplier');
                    const invoiceNumber = getVal(r, 'invoicenumber');
                    if (!vendor && !invoiceNumber) return;

                    const doc = {
                        gstin: getVal(r, 'gstin'),
                        vendor: vendor,
                        invoiceNumber: invoiceNumber,
                        invoiceDate: parseExcelDate(getVal(r, 'invoicedate')),
                        matRecDate: parseExcelDate(getVal(r, 'matrecdate')) || parseExcelDate(getVal(r, 'tallydate')),
                        invoiceValue: parseFloat(getVal(r, 'invoicevalue')) || 0,
                        taxableValue: parseFloat(getVal(r, 'taxablevalue')) || 0,
                        integratedTax: parseFloat(getVal(r, 'integratedtax')) || 0,
                        centralTax: parseFloat(getVal(r, 'centraltax')) || 0,
                        stateTax: parseFloat(getVal(r, 'statetax')) || 0,
                        remarks: getVal(r, 'remakrs') || getVal(r, 'remarks')
                    };

                    bulkPurchaseOps.push({ updateOne: { filter: { invoiceNumber: invoiceNumber, vendor: vendor }, update: { $set: doc }, upsert: true }});
                });
                if (bulkPurchaseOps.length > 0) await Payable.bulkWrite(bulkPurchaseOps);
            }
        }

        res.json({ message: "MIS Data Attached Successfully!" });
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ error: "Failed to process Excel data." });
    }
});

app.get('/api/finance/all-data', async (req, res) => {
    try {
        let targetDate;
        if (req.query.date && req.query.date !== '') {
            targetDate = new Date(req.query.date);
        } else {
            const latestInvoice = await Invoice.findOne().sort({ invoiceDate: -1 });
            const latestPayable = await Payable.findOne().sort({ matRecDate: -1 });
            const latestBank = await BankTransaction.findOne().sort({ transactionDate: -1 });
            
            const dates = [
                latestInvoice?.invoiceDate || new Date(0),
                latestPayable?.matRecDate || new Date(0),
                latestBank?.transactionDate || new Date(0)
            ];
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
        const payables = await Payable.find({}).sort({ invoiceDate: -1 });
        const bankTransactions = await BankTransaction.find({}).sort({ transactionDate: -1 });

        const salesAnalysis = await Invoice.aggregate([
            { $match: matchMTDSales },
            { $group: { _id: '$marketier', mtd: { $sum: '$invoiceValue' }, today: { $sum: { $cond: [ { $and: [ { $gte: ['$invoiceDate', startOfDay] }, { $lte: ['$invoiceDate', endOfDay] } ] }, '$invoiceValue', 0 ] } } } }
        ]);

        const purchaseAnalysis = await Payable.aggregate([
            { $match: matchMTDPurchase },
            { $group: { _id: '$remarks', mtd: { $sum: '$taxableValue' }, today: { $sum: { $cond: [ { $and: [ { $gte: ['$matRecDate', startOfDay] }, { $lte: ['$matRecDate', endOfDay] } ] }, '$taxableValue', 0 ] } } } }
        ]);

        // 💥 NEW: PAYMENTS & COLLECTIONS SUMMARY MATH
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
            analysis: { salesAnalysis, purchaseAnalysis, paymentAnalysis, collectionAnalysis } 
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch data" });
    }
});

app.post('/api/finance/manual-sale', async (req, res) => { await new Invoice(req.body).save(); res.json({ message: "Manual Sale Added!" }); });
app.post('/api/finance/manual-purchase', async (req, res) => { await new Payable(req.body).save(); res.json({ message: "Manual Purchase Added!" }); });

app.put('/api/finance/update-record/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const { field, value } = req.body;
        
        let Model;
        if (type === 'Sales') Model = Invoice;
        else if (type === 'Purchase') Model = Payable;
        else Model = BankTransaction; // Support inline editing for bank records
        
        let parsedValue = value;
        if (field.toLowerCase().includes('date')) parsedValue = parseExcelDate(value);
        else if (['invoiceValue', 'taxableValue', 'integratedTax', 'centralTax', 'stateTax', 'debit', 'credit', 'balance'].includes(field)) parsedValue = Number(value);

        await Model.findByIdAndUpdate(id, { [field]: parsedValue });
        res.json({ message: "Cell Updated Successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to update record." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));