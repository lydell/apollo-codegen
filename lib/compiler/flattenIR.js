"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
class Record {
    constructor(possibleTypes, fieldMap = new Map()) {
        this.possibleTypes = possibleTypes;
        this.fieldMap = fieldMap;
    }
    get fields() {
        return Array.from(this.fieldMap.values());
    }
    addField(field, conditions) {
        const existingField = this.fieldMap.get(field.responseKey);
        if (existingField) {
            if (conditions.length > 0) {
                existingField.conditions = [...(existingField.conditions || []), ...conditions];
                existingField.isConditional = true;
            }
            if (field.selectionSet && existingField.selectionSet) {
                existingField.selectionSet.selections.push(...field.selectionSet.selections);
            }
        }
        else {
            const clonedField = Object.assign({}, field, { selectionSet: field.selectionSet
                    ? Object.assign({}, field.selectionSet, { selections: [...field.selectionSet.selections] }) : undefined });
            clonedField.isConditional = conditions.length > 0;
            this.fieldMap.set(field.responseKey, Object.assign({}, clonedField, { conditions }));
        }
    }
}
exports.Record = Record;
class TypeCase {
    get records() {
        return Array.from(new Set(this.recordsByType.values()));
    }
    constructor(selectionSet) {
        const initialRecord = new Record(selectionSet.possibleTypes);
        this.recordsByType = new Map();
        for (const type of selectionSet.possibleTypes) {
            this.recordsByType.set(type, initialRecord);
        }
        this.default = new Record(selectionSet.possibleTypes);
        this.visitSelectionSet(selectionSet);
        this.replaceFieldsWithObjectTypeSpecificDescriptionsIfAvailable();
    }
    visitSelectionSet(selectionSet, conditions = []) {
        for (const selection of selectionSet.selections) {
            switch (selection.kind) {
                case 'Field':
                    for (const record of this.recordsFor(selectionSet.possibleTypes)) {
                        record.addField(selection, conditions);
                    }
                    if (this.default.possibleTypes.every(type => selectionSet.possibleTypes.includes(type))) {
                        this.default.addField(selection, conditions);
                    }
                    break;
                case 'TypeCondition':
                    this.visitSelectionSet(selection.selectionSet, conditions);
                    break;
                case 'BooleanCondition':
                    this.visitSelectionSet(selection.selectionSet, [selection, ...conditions]);
                    break;
            }
        }
    }
    recordsFor(possibleTypes) {
        const records = possibleTypes
            .map(type => this.recordsByType.get(type))
            .filter(x => x);
        const isRecordDisjoint = records.map(record => {
            return record.possibleTypes.every(type => possibleTypes.includes(type));
        });
        if (isRecordDisjoint.every(x => x)) {
            return records;
        }
        const splits = new Map();
        possibleTypes.forEach((type, index) => {
            if (isRecordDisjoint[index])
                return;
            const originalRecord = records[index];
            let splitRecord = splits.get(originalRecord);
            if (!splitRecord) {
                splitRecord = new Record([], new Map(originalRecord.fieldMap));
                splits.set(originalRecord, splitRecord);
            }
            records[index] = splitRecord;
            splitRecord.possibleTypes.push(type);
        });
        for (const [record, splitRecord] of splits) {
            record.possibleTypes = record.possibleTypes.filter(type => !splitRecord.possibleTypes.includes(type));
            for (const type of splitRecord.possibleTypes) {
                this.recordsByType.set(type, splitRecord);
            }
        }
        return records;
    }
    replaceFieldsWithObjectTypeSpecificDescriptionsIfAvailable() {
        for (let record of [this.default, ...this.records]) {
            if (record.possibleTypes.length == 1) {
                const type = record.possibleTypes[0];
                const fieldDefMap = type.getFields();
                for (const [responseKey, field] of record.fieldMap) {
                    const fieldDef = fieldDefMap[field.name];
                    if (fieldDef && fieldDef.description) {
                        record.fieldMap.set(responseKey, Object.assign({}, field, { description: fieldDef.description }));
                    }
                }
            }
        }
    }
    inspect() {
        return (`TypeCase\n` +
            `  default -> ${util_1.inspect(this.default.fields.map(field => field.name))}\n` +
            this.records
                .map(record => `  ${util_1.inspect(record.possibleTypes)} -> ${util_1.inspect(record.fields.map(field => field.name))}\n`)
                .join(''));
    }
}
exports.TypeCase = TypeCase;
//# sourceMappingURL=flattenIR.js.map