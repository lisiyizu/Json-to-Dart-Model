import { fixFieldName, camelCase, pascalCase, snakeCase, filterListType } from "./helper";
import { Input } from "./input";
import { TypeDefinition } from "./constructor";
import * as _ from "lodash";

export const emptyListWarn = "list is empty";
export const ambiguousListWarn = "list is ambiguous";
export const ambiguousTypeWarn = "type is ambiguous";

export class Warning {
  warning: string;
  path: string;

  constructor(warning: string, path: string) {
    this.warning = warning;
    this.path = path;
  }
}

export function newEmptyListWarn(path: string): Warning {
  return new Warning(emptyListWarn, path);
}

export function newAmbiguousListWarn(path: string): Warning {
  return new Warning(ambiguousListWarn, path);
}

export function newAmbiguousType(path: string): Warning {
  return new Warning(ambiguousTypeWarn, path);
}

export class WithWarning<T> {
  result: T;
  warnings: Array<Warning>;

  constructor(result: T, warnings: Array<Warning>) {
    this.result = result;
    this.warnings = warnings;
  }
}

/**
 * Prints a string to a line.
 * @param print string that will be printed.
 * @param newLine force to the next line.
 * @param tabs how many tabs will be added.
 */
const printLine = (print: string, newLine = false, tabs = 0): string => {
  var sb = '';
  sb += newLine ? '\n' : '';
  for (let i = 0; i < tabs; i++) {
    sb += '\t';
  }
  sb += print;
  return sb;
};

/**
 * Returns a string representation of a value obtained from a JSON
 * @param valueKey The key of the value in the JSON
 */
export function valueFromJson(valueKey: string): string {
  return `json['${valueKey}']`;
}

/**
 * Returns a string representation of a value beign assigned to a field/prop
 * @param key The field/prop name
 * @param value The value to assign to the field/prop
 */
export function joinAsClass(key: string, value: string): string {
  return `${key}: ${value},`;
}

const jsonParseDateTime = (key: string, typeDef: TypeDefinition): string => {
  const jsonValue = valueFromJson(key);
  let formatedValue = '';
  if (typeDef.isDate && typeDef.type !== null) {
    if (typeDef.isList) {
      const result = filterListType(typeDef.type);
      formatedValue += printLine(`(${jsonValue} as List)`);
      for (let i = 0; i < result.length - 1; i++) {
        var index = i * 2;
        formatedValue += printLine(`?.map((e) => (e as List)`, true, 5 + index);
      }
      formatedValue += printLine(`?.map((e) => e == null ? null : DateTime.parse(e as String))`, true, 3 + 2 * result.length);
      for (let i = 0; i < result.length - 1; i++) {
        var index = i * 2;
        formatedValue += printLine(`?.toList())`, true, 3 + 2 * result.length - index);
      }
      formatedValue += printLine(`?.toList()`, true, 5);
    } else {
      formatedValue += printLine(`${jsonValue} == null`);
      formatedValue += printLine(`? null`, true, 5);
      formatedValue += printLine(`: DateTime.parse(${jsonValue} as String)`, true, 5);
    }
  }
  return formatedValue;
};

const jsonParseClass = (key: string, typeDef: TypeDefinition): string => {
  const jsonValue = valueFromJson(key);
  let formatedValue = '';
  if (typeDef.type !== null && !typeDef.isPrimitive) {
    if (typeDef.isList) {
      // Responsive farmatting.
      // List of List Classes (List<List.......<Class>>)
      // This will generate deeply nested infinity list depending on how many lists are in the lists.
      const result = filterListType(typeDef.type);
      formatedValue = printLine(`(${jsonValue} as ${typeDef.type})`);
      for (let i = 0; i < result.length - 1; i++) {
        var index = i * 2;
        formatedValue += printLine(`?.map((e) => (e as ${typeDef.type})`, true, 5 + index);
      }
      formatedValue += printLine(`?.map((e) => e == null`, true, 3 + 2 * result.length);
      formatedValue += printLine(`? null`, true, 5 + 2 * result.length);
      formatedValue += printLine(`: ${buildParseClass(key, jsonValue)})`, true, 5 + 2 * result.length);
      for (let i = 0; i < result.length - 1; i++) {
        var index = i * 2;
        formatedValue += printLine(`?.toList())`, true, 3 + 2 * result.length - index);
      }
      formatedValue += printLine(`?.toList()`, true, 5);
    } else {
      // Class
      formatedValue += printLine(`${jsonValue} == null`);
      formatedValue += printLine(`? null`, true, 5);
      formatedValue += printLine(`: ${buildParseClass(key, jsonValue)}`, true, 5);
    }
  }
  return formatedValue;
};

const toJsonDateTime = (typeDef: TypeDefinition, privateField: boolean): string => {
  const fieldKey = typeDef.getName(privateField);
  const thisKey = `${fieldKey}`;
  var sb = '';
  if (typeDef.isDate && typeDef.type !== null) {
    if (typeDef.isList) {
      const result = filterListType(typeDef.type);
      // Responsive formatting.
      sb += printLine(`'${typeDef.jsonKey}': ${thisKey}`);
      sb += Array.from(result).map(_ => printLine('?.map((l) => l')).slice(0, -1).join('');
      sb += printLine(`?.map((e) => e?.toIso8601String())`);
      sb += Array.from(result).map(_ => printLine('?.toList())')).slice(0, -1).join('');
      sb += printLine('?.toList(),');
    } else {
      sb = `'${typeDef.jsonKey}': ${thisKey}?.toIso8601String(),`;
    }
  }
  return sb;
};

const toJsonClass = (typeDef: TypeDefinition, privateField: boolean): string => {
  const fieldKey = typeDef.getName(privateField);
  const thisKey = `${fieldKey}`;
  var sb = '';
  if (typeDef.type !== null && !typeDef.isPrimitive) {
    if (typeDef.isList) {
      const result = filterListType(typeDef.type);
      if (result.length > 1) {
        // Responsive formatting.
        // This will generate infiniti maps depending on how many lists are in the lists.
        // By default this line starts with keyword List, slice will remove it.
        sb += printLine(`'${typeDef.jsonKey}': ${thisKey}`);
        sb += Array.from(result).map(_ => printLine('?.map((l) => l')).slice(0, -1).join('');
        sb += printLine(`?.map((e) => ${buildToJsonClass("e")})`);
        sb += Array.from(result).map(_ => printLine('?.toList())')).slice(0, -1).join('');
        sb += printLine('?.toList(),');
      } else {
        sb = `'${typeDef.jsonKey}': ${thisKey}?.map((e) => ${buildToJsonClass("e")})?.toList(),`;
      }
    } else {
      // Class
      sb = `'${typeDef.jsonKey}': ${buildToJsonClass(thisKey)},`;
    }
  }
  return sb;
};

export function jsonParseValue(key: string, typeDef: TypeDefinition) {
  const jsonValue = valueFromJson(key);
  let formatedValue = '';
  if (typeDef.isPrimitive && typeDef.type !== null) {
    if (typeDef.isDate) {
      formatedValue = jsonParseDateTime(key, typeDef);
    } else {
      formatedValue = `${jsonValue} as ${typeDef.type}`;
    }
  } else {
    formatedValue = jsonParseClass(key, typeDef);
  }
  return formatedValue;
}

export function toJsonExpression(typeDef: TypeDefinition, privateField: boolean): string {
  const fieldKey = typeDef.getName(privateField);
  const thisKey = `${fieldKey}`;
  if (typeDef.isPrimitive && typeDef.type !== null) {
    if (typeDef.isDate) {
      return toJsonDateTime(typeDef, privateField);
    } else {
      return `'${typeDef.jsonKey}': ${thisKey},`;
    }
  } else {
    return toJsonClass(typeDef, privateField);
  }
}

const buildToJsonClass = (expression: string): string => {
  return `${expression}?.toJson()`;
};

const buildParseClass = (className: string, expression: string): string => {
  const _className = pascalCase(className).replace(/_/g, "");
  return `${_className}.fromJson(${expression} as Map<String, dynamic>)`;
};

class Dependency {
  name: string;
  typeDef: TypeDefinition;

  constructor(name: string, typeDef: TypeDefinition) {
    this.name = name;
    this.typeDef = typeDef;
  }

  getClassName(): string {
    return camelCase(this.name);
  }
}

export class ClassDefinition {
  private _name: string;
  private _privateFields: boolean;
  fields: Map<string, TypeDefinition> = new Map<string, TypeDefinition>();

  getName() {
    return this._name;
  }

  getPrivateFields() {
    return this._privateFields;
  }

  getDependencies(): Array<Dependency> {
    var dependenciesList = new Array<Dependency>();
    for (let [key, value] of this.fields) {
      if (!value.isPrimitive) {
        dependenciesList.push(new Dependency(key, value));
      }
    }
    return dependenciesList;
  }

  getFields(callbackfn: (key: string, typeDef: TypeDefinition) => any): TypeDefinition[] {
    return Array.from(this.fields).map(([k, v]) => callbackfn(k, v));
  }

  /**
   * The class for syntax printing.
   * This feature removes all dashes from names to avoid lint warning.
   * @param {string} className a class name to force override default name.
   * @returns {string} by default return name from the ClassDefinition.
   */
  private className(className: string = ""): string {
    if (className.length > 0) {
      return pascalCase(className)?.replace(/_/g, "");
    } else {
      return pascalCase(this._name)?.replace(/_/g, "");
    }
  }

  constructor(name: string, privateFields = false) {
    this._name = name;
    this._privateFields = privateFields;
  }

  has = (other: ClassDefinition): boolean => {
    var otherClassDef: ClassDefinition = other;
    return this.isSubsetOf(otherClassDef) && otherClassDef.isSubsetOf(this)
      ? true
      : false;
  };

  private isSubsetOf = (other: ClassDefinition): boolean => {
    const keys = Array.from(this.fields.keys());
    const len = keys.length;
    for (let i = 0; i < len; i++) {
      const key = keys[i];
      var otherTypeDef = other.fields.get(key);
      if (otherTypeDef !== undefined) {
        var typeDef = this.fields.get(key);
        if (!_.isEqual(typeDef, otherTypeDef)) {
          return false;
        }
      } else {
        return false;
      }
    }
    return true;
  };

  hasField(otherField: TypeDefinition) {
    return (
      Array.from(this.fields.keys()).filter(
        (k: string) => this.fields.get(k) === otherField
      ) !== null
    );
  }

  addField(name: string, typeDef: TypeDefinition) {
    this.fields.set(name, typeDef);
  }

  private addType(typeDef: TypeDefinition) {
    return typeDef.type ?? "dynamic";
  }

  private fieldList(immutable: boolean = false): string {
    return this.getFields((_, f) => {
      const fieldName = f.getName(this._privateFields);
      var sb = "\t";
      if (immutable) {
        sb += this.finalKeyword(true);
      }
      sb += this.addType(f) + ` ${fieldName};`;
      return sb;
    }).join("\n");
  }

  private fieldListCodeGen(immutable: boolean = false): string {
    return this.getFields((_, f) => {
      const fieldName = f.getName(this._privateFields);
      var sb = "\t" + `@JsonKey(name: '${f.jsonKey}')\n`;
      sb += "\t";
      if (immutable) {
        sb += this.finalKeyword(true);
      }
      sb += this.addType(f) + ` ${fieldName};`;
      return sb;
    }).join("\n");
  }

  /**
   * Advanced abstract class with immutable values and objects.
   * @param freezed class should be printed or not.
   */
  private freezedField(): string {
    var sb = "";
    sb += printLine("@freezed");
    sb += printLine(`abstract class ${this.className()} with `, true);
    sb += printLine(`_$${this.className()} {`);
    sb += printLine(`const factory ${this.className()}({`, true, 1);
    for (var [key, value] of this.fields) {
      const fieldName = value.getName(this._privateFields);
      sb += printLine(`@JsonKey(name: "${key}")`, true, 2);
      sb += printLine(` ${this.addType(value)} ${fieldName},`);
    };
    sb += printLine(`}) = _${this.className()};\n\n`, true, 1);
    sb += printLine(`${this.codeGenJsonParseFunc(true)}`);
    sb += printLine("}", true);
    return sb;
  }

  /**
   * Returns a list of props that equatable needs to work properly
   * @param print Whether the props should be printed or not
   */
  private equatablePropList(print: boolean = false): string {
    var expressionBody = `\n\n\t@override\n\tList<Object> get props => [`
      + `${this.getFields((_, f) => `${f.getName(this._privateFields)}`).join(', ')}];`.replace(' ]', ']');
    var blockBody = `\n\n\t@override\n\tList<Object> get props {\n\t\treturn [\n\t\t\t`
      + `${this.getFields((_, f) => `${f.getName(this._privateFields)}`).join(',\n\t\t\t')},\n\t\t];\n\t}`;
    var isShort = expressionBody.length < 87;

    if (!print) {
      return '';
    } else {
      return isShort ? expressionBody : blockBody;
    }
  }

  /**
   * Keyword "final" to mark that object are immutable.
   * @param immutable should print the keyword or not
   */
  private finalKeyword(immutable: boolean = false): string {
    return immutable ? 'final ' : '';
  }

  /**
   * Keyword "const" to mark that class or object are immutable.
   * @param immutable should print the keyword or not.
   */
  private constKeyword(immutable: boolean = false): string {
    return immutable ? 'const ' : '';
  }

  /**
   * All imports from the Dart library.
   * @param input should print the keyword or not.
   */
  private importsFromDart(input: Input): string {
    var imports = "";

    var len = Array.from(this.fields).length;
    // If less two hashcode values do not need import dart:ui.
    if (len > 1) {
      imports += input.equality ? "import 'dart:ui';\n" : "";
    }

    if (imports.length === 0) {
      return imports;
    } else {
      return imports += "\n";
    }
  };

  /**
   * All imports from the packages library.
   * @param {Input} input the input from the user.
   */
  private importsFromPackage(input: Input): string {
    var imports = "";
    // Sorted alphabetically for effective dart style.
    imports += input.equatable ? "import 'package:equatable/equatable.dart';\n" : "";
    imports += input.immutable && !input.generate ? "import 'package:flutter/foundation.dart';\n" : "";
    imports += input.generate && !input.freezed ? `import 'package:json_annotation/json_annotation.dart';\n` : "";
    imports += input.freezed ? "import 'package:freezed_annotation/freezed_annotation.dart';\n" : "";

    if (imports.length === 0) {
      return imports;
    } else {
      return imports += "\n";
    }
  };

  private importsForParts(input: Input): string {
    var imports = "";
    imports += input.freezed ? "part '" + snakeCase(this._name) + ".freezed.dart';\n" : "";
    imports += input.generate ? "part '" + snakeCase(this._name) + ".g.dart';\n" : "";
    if (imports.length === 0) {
      return imports;
    } else {
      return imports += "\n";
    }
  }

  private importList(): string {
    var imports = "";
    imports += this.getFields((_, f) => {
      var sb = "";
      if (f.importName !== null) {
        sb = 'import "' + f.importName + `.dart";\n`;
      }
      return sb;
    }).sort().join("");

    if (imports.length === 0) {
      return imports;
    } else {
      return imports += "\n";
    }
  }

  private gettersSetters(): string {
    return this.getFields((_, f) => {
      var publicName = f.getName(false);
      var privateName = f.getName(true);
      var sb = "";
      sb += "\t";
      sb += this.addType(f);
      sb += `get ${publicName} => $privateFieldName;\n\tset ${publicName}(`;
      sb += this.addType(f);
      sb += ` ${publicName}) => ${privateName} = ${publicName};`;
      return sb;
    }).join("\n");
  }

  private defaultPrivateConstructor(): string {
    var sb = "";
    sb += `\t${this._name}({`;
    var i = 0;
    var len = Array.from(this.fields.keys()).length - 1;
    this.getFields((_, f) => {
      var publicName = f.getName(false);
      sb += this.addType(f);
      sb += ` ${publicName}`;
      if (i !== len) {
        sb += ", ";
      }
      i++;
    });
    sb += "}) {\n";
    this.getFields((_, f) => {
      var publicName = f.getName(false);
      var privateName = f.getName(true);
      sb += `this.${privateName} = ${publicName};\n`;
    });
    sb += "}";
    return sb;
  }

  private defaultConstructor(equatable: boolean = false, immutable: boolean = false): string {
    var sb = "";
    if (equatable || immutable) {
      sb += `\t${this.constKeyword(true)}${this.className()}({`;
    } else {
      sb += `\t${this.constKeyword(false)}${this.className()}({`;
    }
    var len = Array.from(this.fields).length;
    var isShort = len < 3;
    this.getFields((_, f) => {
      var fieldName = f.getName(this._privateFields);
      sb += isShort ? `this.${fieldName}` : `\n\t\tthis.${fieldName},`;
      if (isShort) { sb += ", "; }
    });
    sb += isShort ? "});" : "\n\t});";
    return isShort ? sb.replace(", });", "});") : sb;
  }

  private jsonParseFunc(): string {
    var sb = "";
    sb += `\tfactory ${this.className()}`;
    sb += `.fromJson(Map<String, dynamic> json) {\n\t\treturn ${this.className()}(\n`;
    sb += this.getFields((k, f) => {
      return `\t\t\t${joinAsClass(f.getName(this._privateFields), jsonParseValue(k, f))}`;
    }).join('\n');
    sb += "\n\t\t);\n\t}";
    return sb;
  }

  private jsonGenFunc(): string {
    var sb = "";
    sb += "\tMap<String, dynamic> toJson() {\n\t\treturn {\n";
    this.getFields((_, f) => {
      sb += `\t\t\t${toJsonExpression(f, this._privateFields)}\n`;
    });
    sb += "\t\t};\n";
    sb += "\t}";
    return sb;
  }

  /**
   * Generate function for json_serializable and freezed.
   * @param freezed force to generate expression body (required for freezed generator).
   */
  private codeGenJsonParseFunc(freezed: boolean = false): string {
    var expressionBody = `\tfactory ${this.className()}.fromJson(Map<String, dynamic> json) => _$${this.className()}FromJson(json);`;
    var blockBody = `\tfactory ${this.className()}.fromJson(Map<String, dynamic> json) {\n\t\treturn _$${this.className()}FromJson(json);\n\t}`;
    return expressionBody.length > 78 && !freezed ? blockBody : expressionBody;
  }

  private codeGenJsonGenFunc(): string {
    var expressionBody = `\tMap<String, dynamic> toJson() => _$${this.className()}ToJson(this);`;
    var blockBody = `\tMap<String, dynamic> toJson() {\n\t\treturn _$${this.className()}ToJson(this);\n\t}`;
    return expressionBody.length > 78 ? blockBody : expressionBody;
  }

  /**
   * Generate copyWith(); mehtod for easier work with immutable classes.
   * @param copyWith method should be generated or not.
   */
  private copyWithMethod(copyWith: boolean = false): string {
    if (!copyWith) { return ''; }
    var sb = "";
    sb += printLine(`\n\n\t${this.className()} copyWith({`, false, 1);
    // Constructor objects.
    for (let [_, value] of this.fields) {
      var fieldName = value.getName(this._privateFields);
      sb += printLine(`${this.addType(value)} ${fieldName},`, true, 2);
    }
    sb += printLine("}) {", true, 1);
    sb += printLine(`return ${this.className()}(`, true, 2);
    // Return constructor.
    for (let [_, value] of this.fields) {
      var fieldName = value.getName(this._privateFields);
      sb += printLine(`${fieldName}: ${fieldName} ?? this.${fieldName},`, true, 3);
    }
    sb += printLine(");", true, 2);
    sb += printLine("}", true, 1);
    return sb;
  }

  /**
   * Generate toString(); mehtod to improve the debugging experience..
   * @param toString method should be generated or not.
   */
  private toStringMethod(toString: boolean = false): string {
    if (!toString) { return ''; }
    var fieldName = (name: string): string => `${name}: $${name}`;
    var expressionBody = `\n\n\t@override\n\tString toString() => `
      + `'${this.className()}(${this.getFields((_, v) => fieldName(v.getName(this._privateFields))).join(', ')})';`.replace(' \'', '\'');
    var blockBody = `\n\n\t@override\n\tString toString() {\n\t\treturn '`
      + `${this.className()}(${this.getFields((_, v) => fieldName(v.getName(this._privateFields))).join(', ')})';\n\t}`;
    var isShort = expressionBody.length < 76;
    return isShort ? expressionBody : blockBody;
  }

  /**
   * Equality Operator to compare different instances of `Objects`.
   * @param equality method should be generated or not.
   */
  private equalityOperator(equality: boolean = false): string {
    if (!equality) { return ''; }
    var fieldName = (name: string): string => `identical(o.${name}, ${name})`;
    var expressionBody = `\n\n\t@override\n\tbool operator ==(Object o) => o is `
      + `${this.className()} && `
      + `${this.getFields((_, v) => fieldName(v.getName(this._privateFields))).join(' &&')};`.replace(' &&;', ';');
    var blockBody = `\n\n\t@override\n\tbool operator ==(Object o) =>\n\t\t\to is `
      + `${this.className()} &&\n\t\t\t`
      + `${this.getFields((_, v) => fieldName(v.getName(this._privateFields))).join(' &&\n\t\t\t')};`.replace(' &&;', ';');
    var isShort = expressionBody.length < 89;
    return isShort ? expressionBody : blockBody;
  }

  private hashCode(equality: boolean = false): string {
    if (!equality) { return ''; }
    var keys = Array.from(this.fields.keys());
    var len = keys.length;
    var oneValueBody = `\n\n\t@override\n\tint get hashCode => `
      + `${keys.map((name) => `${fixFieldName(name, this._name, this._privateFields)}`)}`
      + `.hashCode;`;
    var expressionBody = `\n\n\t@override\n\tint get hashCode => hashValues(`
      + `${keys.map((name) => `${fixFieldName(name, this._name, this._privateFields)}`).join(', ')});`.replace(' ,);', ');');
    var blockBody = `\n\n\t@override\n\tint get hashCode {\n\t\treturn hashValues(\n\t\t\t`
      + `${keys.map((name) => `${fixFieldName(name, this._name, this._privateFields)},`).join('\n\t\t\t')}\n\t\t);\n\t}`;
    var isShort = expressionBody.length < 87;
    var expression = len === 1 ? oneValueBody : expressionBody;
    return isShort ? expression : blockBody;
  }

  toCodeGenString(input: Input): string {
    var field = "";

    if (input.freezed) {
      field += `${this.importsFromDart(input)}`;
      field += `${this.importsFromPackage(input)}`;
      field += `${this.importList()}`;
      field += `${this.importsForParts(input)}`;
      field += `${this.freezedField()}`;
      return field;
    } else {
      if (this._privateFields) {
        field += `${this.importsFromDart(input)}`;
        field += `${this.importsFromPackage(input)}`;
        field += `${this.importList()}`;
        field += `${this.importsForParts(input)}`;
        field += `@JsonSerializable()\n`;
        field += `class ${this.className()}${input.equatable ? ' extends Equatable' : ''}; {\n`;
        field += `${this.fieldListCodeGen(input.isImmutable())}\n\n`;
        field += `${this.defaultPrivateConstructor()}`;
        field += `${this.toStringMethod(input.toString)}\n\n`;
        field += `${this.gettersSetters()}\n\n`;
        field += `${this.codeGenJsonParseFunc()}\n\n`;
        field += `${this.codeGenJsonGenFunc()}`;
        field += `${this.copyWithMethod(input.copyWith)}`;
        field += `${this.equalityOperator(input.equality)}`;
        field += `${this.hashCode(input.equality)}`;
        field += `${this.equatablePropList(input.equatable)}\n}\n`;
        return field;
      } else {
        field += `${this.importsFromDart(input)}`;
        field += `${this.importsFromPackage(input)}`;
        field += `${this.importList()}`;
        field += `${this.importsForParts(input)}`;
        field += `@JsonSerializable()\n`;
        field += `class ${this.className()}${input.equatable ? ' extends Equatable' : ''} {\n`;
        field += `${this.fieldListCodeGen(input.isImmutable())}\n\n`;
        field += `${this.defaultConstructor(input.isImmutable())}`;
        field += `${this.toStringMethod(input.toString)}\n\n`;
        field += `${this.codeGenJsonParseFunc()}\n\n`;
        field += `${this.codeGenJsonGenFunc()}`;
        field += `${this.copyWithMethod(input.copyWith)}`;
        field += `${this.equalityOperator(input.equality)}`;
        field += `${this.hashCode(input.equality)}`;
        field += `${this.equatablePropList(input.equatable)}\n}\n`;
        return field;
      }
    }
  }

  toString(input: Input): string {
    var field = "";
    if (this._privateFields) {
      field += `${this.importsFromDart(input)}`;
      field += `${this.importsFromPackage(input)}`;
      field += `${this.importList()}`;
      field += `${this.importsForParts(input)}`;
      field += `${input.immutable ? '@immutable\n' : ''}`;
      field += `class ${this.className()}${input.equatable ? ' extends Equatable' : ''} {\n`;
      field += `${this.fieldList(input.isImmutable())}\n\n`;
      field += `${this.defaultPrivateConstructor()}`;
      field += `${this.toStringMethod(input.toString)}\n\n`;
      field += `${this.gettersSetters()}\n\n`;
      field += `${this.jsonParseFunc()}\n\n`;
      field += `${this.jsonGenFunc()}`;
      field += `${this.copyWithMethod(input.copyWith)}`;
      field += `${this.equalityOperator(input.equality)}`;
      field += `${this.hashCode(input.equality)}`;
      field += `${this.equatablePropList(input.equatable)}\n}\n`;
      return field;
    } else {
      field += `${this.importsFromDart(input)}`;
      field += `${this.importsFromPackage(input)}`;
      field += `${this.importList()}`;
      field += `${this.importsForParts(input)}`;
      field += `${input.immutable ? '@immutable\n' : ''}`;
      field += `class ${this.className()}${input.equatable ? ' extends Equatable' : ''} {\n`;
      field += `${this.fieldList(input.isImmutable())}\n\n`;
      field += `${this.defaultConstructor(input.isImmutable())}`;
      field += `${this.toStringMethod(input.toString)}\n\n`;
      field += `${this.jsonParseFunc()}\n\n`;
      field += `${this.jsonGenFunc()}`;
      field += `${this.copyWithMethod(input.copyWith)}`;
      field += `${this.equalityOperator(input.equality)}`;
      field += `${this.hashCode(input.equality)}`;
      field += `${this.equatablePropList(input.equatable)}\n}\n`;
      return field;
    }
  }
}
