"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = require("./");
const mergeInFragmentSpreads_1 = require("./visitors/mergeInFragmentSpreads");
const collectFragmentsReferenced_1 = require("./visitors/collectFragmentsReferenced");
const flattenIR_1 = require("./flattenIR");
require("../utilities/array");
const generateOperationId_1 = require("./visitors/generateOperationId");
function compileToLegacyIR(schema, document, options = { mergeInFieldsFromFragmentSpreads: true }) {
    const context = _1.compileToIR(schema, document, options);
    const transformer = new LegacyIRTransformer(context, options);
    return transformer.transformIR();
}
exports.compileToLegacyIR = compileToLegacyIR;
class LegacyIRTransformer {
    constructor(context, options = { mergeInFieldsFromFragmentSpreads: true }) {
        this.context = context;
        this.options = options;
    }
    transformIR() {
        const operations = Object.create({});
        for (const [operationName, operation] of Object.entries(this.context.operations)) {
            const { filePath, operationType, rootType, variables, source, selectionSet } = operation;
            const fragmentsReferenced = collectFragmentsReferenced_1.collectFragmentsReferenced(this.context, selectionSet);
            const { sourceWithFragments, operationId } = generateOperationId_1.generateOperationId(this.context, operation, fragmentsReferenced);
            operations[operationName] = Object.assign({ filePath,
                operationName,
                operationType,
                rootType,
                variables,
                source }, this.transformSelectionSetToLegacyIR(selectionSet), { fragmentsReferenced: Array.from(fragmentsReferenced), sourceWithFragments,
                operationId });
        }
        const fragments = Object.create({});
        for (const [fragmentName, fragment] of Object.entries(this.context.fragments)) {
            const { selectionSet, type } = fragment, fragmentWithoutSelectionSet = __rest(fragment, ["selectionSet", "type"]);
            fragments[fragmentName] = Object.assign({ typeCondition: type, possibleTypes: selectionSet.possibleTypes }, fragmentWithoutSelectionSet, this.transformSelectionSetToLegacyIR(selectionSet));
        }
        const legacyContext = {
            schema: this.context.schema,
            operations,
            fragments,
            typesUsed: this.context.typesUsed,
            options: this.options
        };
        return legacyContext;
    }
    transformSelectionSetToLegacyIR(selectionSet) {
        const typeCase = new flattenIR_1.TypeCase(this.options.mergeInFieldsFromFragmentSpreads
            ? mergeInFragmentSpreads_1.mergeInFragmentSpreads(this.context, selectionSet)
            : selectionSet);
        const fields = this.transformFieldsToLegacyIR(typeCase.default.fields);
        const inlineFragments = typeCase.records
            .filter(record => !selectionSet.possibleTypes.every(type => record.possibleTypes.includes(type)) &&
            record.fieldMap.size > 0)
            .flatMap(record => {
            const fields = this.transformFieldsToLegacyIR(record.fields);
            const fragmentSpreads = this.collectFragmentSpreads(selectionSet, record.possibleTypes).map((fragmentSpread) => fragmentSpread.fragmentName);
            return record.possibleTypes.map(possibleType => {
                return {
                    typeCondition: possibleType,
                    possibleTypes: [possibleType],
                    fields,
                    fragmentSpreads
                };
            });
        });
        for (const inlineFragment of inlineFragments) {
            inlineFragments[inlineFragment.typeCondition.name] = inlineFragment;
        }
        const fragmentSpreads = this.collectFragmentSpreads(selectionSet).map((fragmentSpread) => fragmentSpread.fragmentName);
        return {
            fields,
            fragmentSpreads,
            inlineFragments
        };
    }
    transformFieldsToLegacyIR(fields) {
        return fields.map(field => {
            const { args, type, isConditional, description, isDeprecated, deprecationReason, selectionSet } = field;
            const conditions = (field.conditions && field.conditions.length > 0)
                ? field.conditions.map(({ kind, variableName, inverted }) => {
                    return {
                        kind,
                        variableName,
                        inverted
                    };
                })
                : undefined;
            return Object.assign({ responseName: field.alias || field.name, fieldName: field.name, type,
                args,
                isConditional,
                conditions,
                description,
                isDeprecated,
                deprecationReason }, selectionSet ? this.transformSelectionSetToLegacyIR(selectionSet) : {});
        });
    }
    collectFragmentSpreads(selectionSet, possibleTypes = selectionSet.possibleTypes) {
        const fragmentSpreads = [];
        for (const selection of selectionSet.selections) {
            switch (selection.kind) {
                case 'FragmentSpread':
                    fragmentSpreads.push(selection);
                    break;
                case 'TypeCondition':
                    if (possibleTypes.every(type => selection.selectionSet.possibleTypes.includes(type))) {
                        fragmentSpreads.push(...this.collectFragmentSpreads(selection.selectionSet, possibleTypes));
                    }
                    break;
                case 'BooleanCondition':
                    fragmentSpreads.push(...this.collectFragmentSpreads(selection.selectionSet, possibleTypes));
                    break;
            }
        }
        return fragmentSpreads;
    }
}
//# sourceMappingURL=legacyIR.js.map