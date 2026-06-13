const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    invoiceNo: String,
    invoiceDate: Date,
    customer: String,
    invoiceValue: Number,
    debit: { type: Number, default: 0 },   // <--- MONGODB WILL NOW SAVE THIS
    credit: { type: Number, default: 0 },  // <--- MONGODB WILL NOW SAVE THIS
    marketier: String
});

const payableSchema = new mongoose.Schema({
    gstin: String,
    vendor: String, 
    invoiceNumber: String,
    invoiceDate: Date,
    matRecDate: Date, 
    invoiceValue: Number,
    taxableValue: Number,
    integratedTax: Number,
    centralTax: Number,
    stateTax: Number,
    remarks: String 
});

const bankTransactionSchema = new mongoose.Schema({
    transactionDate: Date,
    valueDate: Date,
    chequeNo: String,
    description: String,
    branchCode: String,
    debit: Number,     
    credit: Number,    
    balance: Number,        // First Balance
    finalBalance: Number,   // Second Balance
    head: String,
    name: String,
    remarks: String
});

const sundryLedgerSchema = new mongoose.Schema({
    ledgerName:  { type: String, required: true, unique: true },
    category:    { type: String },   // e.g. "AUTO SECTOR CUSTOMERS", "OE - BAJAJ"
    sectorType:  { type: String },   // "Auto" | "Industrial" | "SS" | "OE" | "Other"
    gstin:       { type: String },
    extra:       { type: String }
}, { timestamps: true });

module.exports = {
    Invoice:        mongoose.model('Invoice', invoiceSchema),
    Payable:        mongoose.model('Payable', payableSchema),
    BankTransaction: mongoose.model('BankTransaction', bankTransactionSchema),
    SundryLedger:   mongoose.model('SundryLedger', sundryLedgerSchema)
};