const BigNumber = require('bignumber.js');

class ThriftProtocolError extends Error {
  constructor(message) {
    super(message);
    this.name = 'THRIFT_PROTOCOL_ERROR';
  }
}

class ThriftRangeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'THRIFT_RANGE_ERROR';
  }
}

class ThriftTypeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'THRIFT_TYPE_ERROR';
  }
}

const VERSION_1 = 0x80010000 | 0;

const TYPES = {
  STOP: 0,
  VOID: 1,
  BOOL: 2,
  BYTE: 3,
  I08: 3,
  DOUBLE: 4,
  I16: 6,
  I32: 8,
  I64: 10,
  UTF7: 11,
  BINARY: 11,
  STRING: 11,
  STRUCT: 12,
  MAP: 13,
  SET: 14,
  LIST: 15,
  UTF8: 16,
  UTF16: 17
};

const TYPES_R = Object.keys(TYPES).reduce((base, key) => {
  base[TYPES[key]] = key;
  return base;
}, {});

const METHODS = {
  CALL: 1,
  REPLY: 2,
  EXCEPTION: 3,
  ONEWAY: 4
};

const METHODS_R = Object.keys(METHODS).reduce((base, key) => {
  base[METHODS[key]] = key;
  return base;
}, {});

class TMessage {
  constructor({ id, name, type, fields = [], header, strict = true }) {
    this.bufs = [];
    this.totalLength = 0;
    this.offset = 0;

    if (typeof header === 'object') {
      this.tStruct(header);
    };
    type = METHODS[type];
    if (strict) {
      this.tInt32(VERSION_1 | type);
      this.tString(name);
    } else {
      this.tString(name);
      this.tInt8(type);
    }
    this.tInt32(id);
    this.tStruct({ fields });
  }

  concat() {
    const buf = Buffer.allocUnsafe(this.totalLength);

    for (let i = 0; i < this.bufs.length; i++) {
      const { method, length, value } = this.bufs[i];

      if (method === 'tInt64') {
        const { h, l } = value;

        buf.writeUInt32BE(h, this.offset);
        this.offset += 4;
        buf.writeUInt32BE(l, this.offset);
        this.offset += 4;
      } else if (method === 'iVoid') {
        // 什么都不做可以吗
      } else {
        buf[method](value, this.offset);
        this.offset += length;
      }
    }

    return buf;
  }

  tString(str = '', enc = 'utf8') {
    if (!(str instanceof Buffer)) str += '';

    const length = Buffer.byteLength(str, enc);
    this.bufs.push({
      method: 'writeInt32BE',
      length: 4,
      value: length
    });
    this.totalLength += 4;

    if (str instanceof Buffer) {
      str = str.toString();
    }
    this.bufs.push({
      method: 'write',
      length: length,
      value: str
    });
    this.totalLength += length;
  }

  tBool(value = 0) {
    if (typeof value !== 'boolean') {
      if (value instanceof Object) value = value.valueOf();
      if (value instanceof Object) value = value.toString();
      switch (true) {
        case value === true:
        case value === false:
          break;
        case value === 'true':
          value = true;
          break;
        case value === 'false':
          value = false;
          break;
        case typeof value === 'number':
          value = !!value;
          break;
        default:
          throw new ThriftTypeError(`cannot convert "${value}" to boolean, require "true" or "false"`);
      }
    }
    this.bufs.push({
      method: 'writeInt8',
      length: 1,
      value: value
    });
    this.totalLength += 1;
  }

  tInt32(value = 0) {
    if (+value !== +value || value === null) throw new ThriftTypeError(`cannot convert "${value}" to int32`);
    value = +value;
    if (value < -2147483648 || value > 2147483647) throw new ThriftRangeError(`${value} is out of int32 bounds`);

    this.bufs.push({
      method: 'writeInt32BE',
      length: 4,
      value
    });
    this.totalLength += 4;
  }

  tInt16(value = 0) {
    if (+value !== +value || value === null) throw new ThriftTypeError(`cannot convert "${value}" to int16`);
    value = +value;
    if (value < -32768 || value > 32767) throw new ThriftRangeError(`${value} is out of int16 bounds`);

    this.bufs.push({
      method: 'writeInt16BE',
      length: 2,
      value
    });
    this.totalLength += 2;
  }

  tInt8(value = 0) {
    if (+value !== +value || value === null) throw new ThriftTypeError(`cannot convert "${value}" to int8`);
    value = +value;
    if (value < -128 || value > 127) {
      throw new ThriftRangeError(`${value} is out of int8 bounds`);
    }

    this.bufs.push({
      method: 'writeInt8',
      length: 1,
      value
    });
    this.totalLength += 1;
  }

  tDouble(value = 0) {
    if (+value !== +value || value === null) throw new ThriftTypeError(`cannot convert "${value}" to double`);

    this.bufs.push({
      method: 'writeDoubleBE',
      length: 8,
      value
    });
    this.totalLength += 8;
  }

  tInt64(value = 0) {
    if (value instanceof Object) value = value.valueOf();
    if (value instanceof Object) value = value.toString();
    if (typeof value === 'boolean') value = +value;
    if (+value !== +value || value === null) throw new ThriftTypeError(`cannot convert "${value}" to i64`);
    if (value === '') value = 0;
    if (!(value instanceof BigNumber)) value = new BigNumber(value);
    value = value.toString(16);
    let nega = false;
    if (value[0] === '-') {
      nega = true;
      value = value.slice(1);
    }
    let l = parseInt(value.slice(-8), 16) || 0;
    let h = parseInt(value.slice(-16, -8), 16) || 0;
    if (nega) {
      l = ~l + 1 >>> 0;
      h = ~h + !l >>> 0;
    }

    this.bufs.push({
      method: 'tInt64',
      length: 8,
      value: { h, l }
    });
    this.totalLength += 8;
  }

  tStruct({ fields }) {
    fields.forEach(({ type, id, value }) => {
      this.tInt8(TYPES[type]);
      this.tInt16(id);
      this.tValue({ type, value });
    });
    this.tInt8(TYPES.STOP);
  }

  tMap({ keyType, valueType, data }) {
    this.tInt8(TYPES[keyType]);
    this.tInt8(TYPES[valueType]);
    this.tInt32(data.length);
    data.forEach(({ key, value }) => {
      this.tValue({ type: keyType, value: key });
      this.tValue({ type: valueType, value: value });
    });
  }

  tList({ valueType, data }) {
    this.tInt8(TYPES[valueType]);
    this.tInt32(data.length);
    data.forEach(value => this.tValue({ type: valueType, value: value }));
  }

  tVoid() {
    this.bufs.push({
      method: 'tVoid',
      length: 0
    });
    this.totalLength += 0;
  }

  tValue({ type, value }) {
    switch (TYPES[type]) {
      case TYPES.VOID: return this.tVoid();
      case TYPES.BOOL: return this.tBool(value);
      case TYPES.I8: return this.tInt8(value);
      case TYPES.I16: return this.tInt16(value);
      case TYPES.I32: return this.tInt32(value);
      case TYPES.I64: return this.tInt64(value);
      case TYPES.DOUBLE: return this.tDouble(value);
      case TYPES.BYTE: return this.tInt8(value);
      case TYPES.STRING: return this.tString(value);
      case TYPES.MAP: return this.tMap(value);
      case TYPES.LIST: return this.tList(value);
      case TYPES.STRUCT: return this.tStruct(value);
      case TYPES.UTF16: return this.tString(value, 'utf16le');
      default: throw new ThriftProtocolError(`Unknown type ${type}`);
    }
  }
}
module.exports = (...args) => {
  return new TMessage(...args).concat();
};
