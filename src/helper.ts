import * as changeCase from "change-case";
import { ArrayNode, ASTNode, LiteralNode, ObjectNode } from "json-to-ast";
import { isArray, isMap } from "./lib";
import { newAmbiguousType, Warning, WithWarning } from "./syntax";

export enum ListType { Object, String, Double, Int, Dynamic, Null }

class MergeableListType {
    listType: ListType;
    isAmbigous: boolean;

    constructor(listType: ListType, isAmbigous: boolean) {
        this.isAmbigous = isAmbigous;
        this.listType = listType;
    };
}

function mergeableListType(list: Array<any>): MergeableListType {
    var t = ListType.Dynamic;
    var isAmbigous = false;
    list.forEach((e) => {
        var inferredType: ListType;
        if (typeof e + "" === 'number') {
            inferredType = e % 1 === 0 ? ListType.Int : ListType.Double;
        } else if (typeof e === 'string') {
            inferredType = ListType.String;
        } else if (isMap(e)) {
            inferredType = ListType.Object;
        }
        if (t !== ListType.Null && t !== inferredType!!) {
            isAmbigous = true;
        }
        t = inferredType!!;
    });
    return new MergeableListType(t, isAmbigous);
}

/**
 * The list with primitive types.
 * @isPrimitiveType return false if some type not included in this list.
 */
const keywords = ["String", "int", "bool", "num", "double", "dynamic", "DateTime"];

/**
 * Calculates the length of the list type.
 * @param typeName a string that will be calculated.
 * @returns {string[]} A string list.
 * @example
 * ```dart
 * List<List<User>> users; // Return list ["List", "List"].
 * ```
 */
export function filterListType(typeName: string): string[] {
    const split = typeName.replace(/</g, ",").replace(/>/g, ",").split(",");
    const _onlyList = (value: string) => value === "List";
    const result = split.filter(_onlyList);
    return result;
};

/**
 * Returns true if the typeName contains types in @keywords list.
 *  * List type can be infinity as List<List<List<.... As long as the syntax matches Dart style.
 * @param {string} typeName a string for validation.
 * @returns {boolean} a boolean.
 */
export const isPrimitiveType = (typeName: string): boolean => {
    const identical = typeName === typeName.trim() ? true : false;
    const arrowToLeft = typeName.split("").filter((e) => e === "<");
    const leftArrows = arrowToLeft.map(
        (_, __, arr) => typeName.split("")[arr.length * 5 - 1]
    );
    const arrowToRight = typeName.split("").filter((e) => e === ">");
    const rightArrows = typeName.split("").splice(-arrowToRight.length);
    const split = typeName.replace(/</g, ",").replace(/>/g, ",").split(",");
    const _ignoreEmpty = (value: string) => value !== "";
    const values = split.filter(_ignoreEmpty);
    const lists = values.filter((e) => e === "List");
    const validListSyntax =
        leftArrows.every((e) => e === "<") &&
        rightArrows.every((e) => e === ">") &&
        arrowToRight.length === arrowToLeft.length &&
        lists.length === arrowToRight.length &&
        lists.length === arrowToLeft.length;
    const validValue = values.every((e) => ["List", ...keywords].includes(e));
    const validSyntax = lists.length
        ? validListSyntax && validValue
            ? true
            : false
        : validValue
            ? true
            : false;
    return identical && validSyntax ? true : false;
};

export const isList = (text: string): boolean => text.startsWith("List<");
export const camelCase = (text: string): string => changeCase.camelCase(text);
export const pascalCase = (text: string): string => changeCase.pascalCase(text);
export const snakeCase = (text: string): string => changeCase.snakeCase(text);
export const snakeToCamel = (text: string) => text.replace(
    /([-_][a-z])/g,
    (group) => group.toUpperCase().replace('-', '').replace('_', '')
);

export function isDate(date: string): boolean {
    const datePattern = /^(?:[1-9]\d{3}-(?:(?:0[1-9]|1[0-2])-(?:0[1-9]|1\d|2[0-8])|(?:0[13-9]|1[0-2])-(?:29|30)|(?:0[13578]|1[02])-31)|(?:[1-9]\d(?:0[48]|[2468][048]|[13579][26])|(?:[2468][048]|[13579][26])00)-02-29)T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:Z|[+-][01]\d:[0-5]\d)/g;
    return datePattern.exec(date) !== null ? true : false;
}

/**
 * Returns value name. If it reserved by the system will be mixed with class name.
 * @param name value name.
 * @param prefix class name used to recreate reserved names.
 * @param isPrivate means is a private value or not.
 */
export function fixFieldName(name: string, prefix: string, isPrivate = false): string {
    // Keywords that cannot be used as values in the Dart language.
    var reservedKeys: string[] = ['get', 'for', 'default', 'set', 'this', 'break', 'class', 'return', 'in'];
    var fieldName = camelCase(name)?.replace(/_/g, "");

    if (reservedKeys.includes(fieldName)) {
        var reserved = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
        return fieldName = camelCase(`${prefix}${reserved}`)?.replace(/_/g, "");
    }

    return isPrivate ? `_${fieldName}` : fieldName;
}

export function getTypeName(obj: any): string {
    var type = typeof obj + "";
    if (obj === "" || obj === "undefined") {
        return 'dynamic';
    } else if (isDate(obj) && type === "string") {
        return 'DateTime';
    } else if (type === 'string') {
        return 'String';
    } else if (type === 'number') {
        return obj % 1 === 0 ? "int" : "double";
    } else if (type === "boolean") {
        return 'bool';
    } else if (isArray(obj)) {
        return 'List';
    } else {
        // assumed class
        return 'Class';
    }
}

/**
 * Accurate list type that scans each list item and determines the type of list.
 *  * If the list is empty or contains only primitive types returns as 'dynamic' type.
 * @param {Array<any>} arr list that will be scanned for each item in the list.
 * @returns {string} Return a string.
 */
export const getListTypeName = (arr: Array<any>): string => {
    if (Array.isArray(arr) && !arr.length) {
        return "dynamic";
    } else {
        if (arr.every((i) => getTypeName(i) === "DateTime")) {
            return "DateTime";
        } else if (arr.every((i) => getTypeName(i) === "String")) {
            return "String";
        } else if (arr.every((i) => getTypeName(i) === "bool")) {
            return "bool";
        } else if (arr.every((i) => typeof i === "number")) {
            if (arr.every((i) => getTypeName(i) === "int")) {
                return "int";
            } else if (arr.every((i) => getTypeName(i) === "double")) {
                return "double";
            } else {
                return "num";
            }
        } else if (arr.every((i) =>
            typeof i === "string" ||
            typeof i === "number" ||
            typeof i === "boolean" ||
            i instanceof Array
        )) {
            return "dynamic";
        } else {
            return "Class";
        }
    }
};

/**
 * Returns list subtype.
 * @param {any[]} arr a list that will be checked.
 * @returns {string} List type as string.
 * @example
 * var arr = [1, 2, 3]; // return string "List<int>"
 * var arr = [[""]]; // return string "List<List<String>>"  
 */
export function getListSubtype(arr: any[]): string {
    let sb = "";
    const typeSet = new Set();
    const typeName = Array.from(typeSet).toString();
    for (let element of arr) {
        if (arr.every((e) => e instanceof Array)) {
            sb += getListSubtype(element);
        } else {
            typeSet.add(getListTypeName(arr));
        }
    }
    sb += !sb.length ? getListTypeName(arr) : typeName;
    return "List<" + sb + ">";
}

export function navigateNode(astNode: ASTNode, path: string): ASTNode {
    let node: ASTNode;
    if (astNode?.type === "Object") {
        var objectNode: ObjectNode = astNode as ObjectNode;
        var propertyNode = objectNode.children[0];
        if (propertyNode !== null) {
            propertyNode.key.value = path;
            node = propertyNode.value;
        }
    }
    if (astNode?.type === "Array") {
        var arrayNode: ArrayNode = astNode as ArrayNode;
        var index = +path ?? null;
        if (index !== null && arrayNode.children.length > index) {
            node = arrayNode.children[index];
        }
    }
    return node!!;
}

var _pattern = /([0-9]+)\.{0,1}([0-9]*)e(([-0-9]+))/g;

export function isASTLiteralDouble(astNode: ASTNode): boolean {
    if (astNode !== null && astNode !== undefined && astNode.type === "Literal") {
        var literalNode: LiteralNode = astNode as LiteralNode;
        var containsPoint = literalNode.raw.includes('.');
        var containsExponent = literalNode.raw.includes('e');
        if (containsPoint || containsExponent) {
            var isDouble = containsPoint;
            if (containsExponent) {
                var matches = literalNode.raw.split(_pattern);
                if (matches !== null) {
                    var integer = matches[1];
                    var comma = matches[2];
                    var exponent = matches[3];
                    isDouble = _isDoubleWithExponential(integer, comma, exponent);
                }
            }
            return isDouble;
        }
    }
    return false;
}

/**  
 * Get object from the array.
 * @param {any} obj - A object param.
 * @return {any} Return a any object.
 */
export const getObject = (obj: any): any => {
    if (obj instanceof Array) {
        for (let i = 0; i < obj.length; i++) {
            return getObject(obj[i]);
        }
    } else {
        return obj;
    }
};

export function mergeObjectList(list: Array<any>, path: string, idx = -1): WithWarning<Map<any, any>> {
    var warnings = new Array<Warning>();
    var obj = new Map();
    for (var i = 0; i < list.length; i++) {
        var toMerge = new Map(Object.entries(getObject(list[i])));
        if (toMerge.size !== 0) {
            toMerge.forEach((v: any, k: any) => {
                var t = getTypeName(obj.get(k));
                if (obj.get(k) === undefined) {
                    obj.set(k, v);
                } else {
                    var otherType = getTypeName(v);
                    if (t !== otherType) {
                        if (t === 'int' && otherType === 'double') {
                            // if double was found instead of int, assign the double
                            obj.set(k, v);
                        } else if (t !== 'double' && otherType !== 'int') {
                            // if types are not equal, then
                            var realIndex = i;
                            if (idx !== -1) {
                                realIndex = idx - i;
                            }
                            var ambiguosTypePath = `${path}[${realIndex}]/${k}`;
                            warnings.push(newAmbiguousType(ambiguosTypePath));
                        }
                    } else if (t === 'List' || t === 'Class') {
                        var l = Array.from(obj.get(k));
                        var beginIndex = l.length;
                        var mergeableType = mergeableListType(l);
                        if (ListType.Object === mergeableType.listType) {
                            var mergedList =
                                mergeObjectList(l, `${path}[${i}]/${k}`, beginIndex);
                            mergedList.warnings.forEach((wrn) => warnings.push(wrn));
                            obj.set(k, new Array((mergedList.result)));
                        } else {
                            if (l.length > 0) {
                                obj.set(k, new Array(l[0]));
                            }
                            if (mergeableType.isAmbigous) {
                                warnings.push(newAmbiguousType(`${path}[${i}]/${k}`));
                            }
                        }
                    } else if (t === 'Class') {
                        var properIndex = i;
                        if (idx !== -1) {
                            properIndex = i - idx;
                        }
                        var mergedObj = mergeObj(
                            obj.get(k),
                            v,
                            `${path}[${properIndex}]/${k}`,
                        );
                        mergedObj.warnings.forEach((wrn) => warnings.push(wrn));
                        obj.set(k, mergedObj.result);
                    }
                }
            });
        }
    }
    return new WithWarning(obj, warnings);
}

function mergeObj(obj: Map<any, any>, other: Map<any, any>, path: string): WithWarning<Map<any, any>> {
    var warnings = new Array<Warning>();
    var clone = new Map(obj);
    other.forEach((k, v) => {
        if (clone.get(k) === null) {
            clone.set(k, v);
        } else {
            var otherType = getTypeName(v);
            var t = getTypeName(clone.get(k));
            if (t !== otherType) {
                if (t === 'int' && otherType === 'double') {
                    // if double was found instead of int, assign the double
                    clone.set(k, v);
                } else if (typeof v + "" !== 'number' && clone.get(k) % 1 === 0) {
                    // if types are not equal, then
                    warnings.push(newAmbiguousType(`${path}/${k}`));
                }
            } else if (t === 'List') {
                var l = Array(clone.get(k));
                l.push(other.get(k));
                var mergeableType = mergeableListType(l);
                if (ListType.Object === mergeableType.listType) {
                    var mergedList = mergeObjectList(l, `${path}`);
                    mergedList.warnings.forEach((wrn) => warnings.push(wrn));
                    clone.set(k, new Array(mergedList.result));
                } else {
                    if (l.length > 0) {
                        clone.set(k, new Array(l[0]));
                    }
                    if (mergeableType.isAmbigous) {
                        warnings.push(newAmbiguousType(`${path}/${k}`));
                    }
                }
            } else if (t === 'Class') {
                var mergedObj = mergeObj(clone.get(k), other.get(k), `${path}/${k}`);
                mergedObj.warnings.forEach((wrn) => warnings.push(wrn));
                clone.set(k, mergedObj.result);
            }
        }
    });
    return new WithWarning(clone, warnings);
}

function _isDoubleWithExponential(integer: string, comma: string, exponent: string): boolean {
    var integerNumber = +integer ?? 0;
    var exponentNumber = +exponent ?? 0;
    var commaNumber = +comma ?? 0;
    if (exponentNumber !== null) {
        if (exponentNumber === 0) {
            return commaNumber > 0;
        }
        if (exponentNumber > 0) {
            return exponentNumber < comma.length && commaNumber > 0;
        }
        return commaNumber > 0 ||
            ((integerNumber * Math.pow(10, exponentNumber)) % 1 > 0);
    }
    return false;
}
