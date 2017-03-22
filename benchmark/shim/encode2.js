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

function tString(str = '', enc = 'utf8') {
  if (!(str instanceof Buffer)) str += '';

  const length = Buffer.byteLength(str, enc);
  const buf = Buffer.allocUnsafe(length + 4);
  buf.writeInt32BE(length);
  if (str instanceof Buffer) {
    str = str.toString();
  }

  buf.write(str, 4);
  return buf;
}

function tBool(value = 0) {
  const boolBuf = Buffer.allocUnsafe(1);
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
  boolBuf.writeInt8(+!!value);

  return boolBuf;
}

function tInt32(value = 0) {
  const int32Buf = Buffer.allocUnsafe(4);
  if (+value !== +value || value === null) throw new ThriftTypeError(`cannot convert "${value}" to int32`);
  value = +value;
  if (value < -2147483648 || value > 2147483647) throw new ThriftRangeError(`${value} is out of int32 bounds`);
  int32Buf.writeInt32BE(value);

  return int32Buf;
}

function tInt16(value = 0) {
  const int16Buf = Buffer.allocUnsafe(2);
  if (+value !== +value || value === null) throw new ThriftTypeError(`cannot convert "${value}" to int16`);
  value = +value;
  if (value < -32768 || value > 32767) throw new ThriftRangeError(`${value} is out of int16 bounds`);
  int16Buf.writeInt16BE(value);

  return int16Buf;
}

function tInt8(value = 0) {
  const int8Buf = Buffer.allocUnsafe(1);
  if (+value !== +value || value === null) throw new ThriftTypeError(`cannot convert "${value}" to int8`);
  value = +value;
  if (value < -128 || value > 127) {
    throw new ThriftRangeError(`${value} is out of int8 bounds`);
  }
  int8Buf.writeInt8(value);
  return int8Buf;
}

function tDouble(value = 0) {
  const doubleBuf = Buffer.allocUnsafe(8);
  if (+value !== +value || value === null) throw new ThriftTypeError(`cannot convert "${value}" to double`);
  doubleBuf.writeDoubleBE(+value);
  return doubleBuf;
}

function tInt64(value = 0) {
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
  const int64Buf = Buffer.allocUnsafe(8);
  int64Buf.writeUInt32BE(h);
  int64Buf.writeUInt32BE(l, 4);
  return int64Buf;
}

function tMessage({ id, name, type, fields = [], header, strict = true }) {
  const bufs = [];
  if (typeof header === 'object') bufs.push(tStruct(header));
  type = METHODS[type];
  if (strict) {
    bufs.push(
      tInt32(VERSION_1 | type),
      tString(name)
    );
  } else {
    bufs.push(
      tString(name),
      tInt8(type)
    );
  }
  bufs.push(
    tInt32(id),
    tStruct({ fields })
  );
  return Buffer.concat(bufs);
}

function tStruct({ fields }) {
  // const types = tInt8(TYPES.STOP);
  // let length = types.length;
  //
  // const fieldsBufs = fields.map(({ type, id, value }) => {
  //   const typeBuf = tInt8(TYPES[type]);
  //   const idBuf = tInt16(id);
  //   const valueBuf = tValue({ type, value });
  //   length += typeBuf.length + idBuf.length + valueBuf.length;
  //   return [typeBuf, idBuf, valueBuf];
  // });
  //
  // const buf = fieldsBufs.reduce((preBuf, [typeBuf, idBuf, valueBuf]) => {
  //   preBuf.writeInt8(typeBuf);
  //   preBuf.writeInt16BE(idBuf);
  //   return Buffer.concat([preBuf, valueBuf]);
  // }, Buffer.allocUnsafe(length));
  // buf.writeInt8(types);
  return Buffer.concat([
    ...[].concat(...fields.map(({ type, id, value }) => [
      tInt8(TYPES[type]),
      tInt16(id),
      tValue({ type, value })
    ])),
    tInt8(TYPES.STOP)
  ]);
  // return buf;
}

function tMap({ keyType, valueType, data }) {
  return Buffer.concat([
    tInt8(TYPES[keyType]),
    tInt8(TYPES[valueType]),
    tInt32(data.length),
    ...[].concat(...data.map(({ key, value }) => [
      tValue({ type: keyType, value: key }),
      tValue({ type: valueType, value: value })
    ]))
  ]);
}

function tList({ valueType, data }) {
  return Buffer.concat([
    tInt8(TYPES[valueType]),
    tInt32(data.length),
    ...data.map(value => tValue({ type: valueType, value: value }))
  ]);
}

function tValue({ type, value }) {
  switch (TYPES[type]) {
    case TYPES.VOID: return Buffer.allocUnsafe(0);
    case TYPES.BOOL: return tBool(value);
    case TYPES.I8: return tInt8(value);
    case TYPES.I16: return tInt16(value);
    case TYPES.I32: return tInt32(value);
    case TYPES.I64: return tInt64(value);
    case TYPES.DOUBLE: return tDouble(value);
    case TYPES.BYTE: return tInt8(value);
    case TYPES.STRING: return tString(value);
    case TYPES.MAP: return tMap(value);
    case TYPES.LIST: return tList(value);
    case TYPES.STRUCT: return tStruct(value);
    case TYPES.UTF16: return tString(value, 'utf16le');
    default: throw new ThriftProtocolError(`Unknown type ${type}`);
  }
}

module.exports = tMessage;
